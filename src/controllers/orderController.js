const { Order, Cart, CartItem, User, Product, sequelize } = require('../../models');

/**
 * Erreur levée dans la transaction de createOrder quand un produit manque :
 * annule la transaction et donne les détails du conflit (réponse 409).
 */
class StockConflictError extends Error {
  constructor(conflicts) {
    super('Stock insuffisant : ' + conflicts
      .map(c => `${c.name} (demandé ${c.requested}, disponible ${c.available})`)
      .join(', '));
    this.conflicts = conflicts;
  }
}
/**
 * Erreur levée dans la transaction de createOrder quand le panier est absent
 * ou vide (réponse 400). Cas typique : une 2e requête simultanée (double clic)
 * qui attend le verrou du panier et le trouve vidé par la 1re.
 */
class EmptyCartError extends Error {}
const { v4: uuidv4 } = require('uuid');
const { computeShippingCost } = require('../config/shopPolicy');

/**
 * Contrôleur de gestion des commandes
 * FonctionnalitéHaute#1778 (POST /orders) + FonctionnalitéHaute#1777 (machine à états) + FonctionnalitéHaute#1779 (historique)
 * 
 * Fonctionnalités:
 * - Création de commandes depuis le panier (FonctionnalitéHaute#1778)
 * - Gestion machine à états (pending -> confirmed -> processing -> shipped -> delivered) (FonctionnalitéHaute#1777)
 * - Historique et consultation des commandes (FonctionnalitéHaute#1779)
 * - Validation des transitions de statut
 * - Sécurité : utilisateurs n'accèdent qu'à leurs propres commandes
 */

class OrderController {

  /**
   * POST /api/orders - Créer une commande depuis le panier
   * FonctionnalitéHaute#1778
   * 
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  static async createOrder(req, res) {
    try {
      const userId = req.user.id;
      const { shippingAddress, billingAddress, paymentMethod, notes } = req.body || {};

      console.log(`📦 Création de commande pour l'utilisateur ${userId}`);

      // Transaction : verrouillage du panier puis des produits, contrôle et
      // décrément du stock, création de la commande et vidage du panier.
      // Tout est annulé en cas d'échec.
      const order = await sequelize.transaction(async (t) => {
        // Sous-tâche 1 : panier verrouillé (FOR UPDATE) et lu dans la transaction.
        // Deux requêtes simultanées passent l'une après l'autre : la 2e trouve
        // le panier vidé par la 1re au lieu de créer une commande en double.
        const cart = await Cart.findOne({
          where: { userId },
          lock: t.LOCK.UPDATE,
          transaction: t
        });
        if (!cart) {
          throw new EmptyCartError('Aucun panier trouvé pour cet utilisateur');
        }

        // Sous-tâche 2 : vérifier que le panier contient des articles
        const cartItems = await CartItem.findAll({
          where: { cartId: cart.id },
          order: [['created_at', 'ASC']],
          transaction: t
        });
        if (cartItems.length === 0) {
          throw new EmptyCartError('Le panier est vide. Ajoutez des produits avant de passer commande.');
        }
        console.log(`🛒 Panier trouvé avec ${cartItems.length} items`);

        const productIds = cartItems.map(item => item.productId);
        // FOR UPDATE, dans un ordre fixe pour éviter les interblocages entre deux commandes
        const products = await Product.findAll({
          where: { id: productIds },
          order: [['id', 'ASC']],
          lock: t.LOCK.UPDATE,
          transaction: t
        });
        const productsById = new Map(products.map(p => [p.id, p]));

        const conflicts = [];
        for (const item of cartItems) {
          const product = productsById.get(item.productId);
          const available = product && product.isActive ? product.stock : 0;
          if (available < item.quantity) {
            conflicts.push({
              productId: item.productId,
              name: product ? product.name : 'Produit indisponible',
              requested: item.quantity,
              available
            });
          }
        }
        if (conflicts.length > 0) {
          throw new StockConflictError(conflicts);
        }

        // Snapshot des produits au moment de l'achat (nom, prix actuel, image) :
        // la commande ne dépend plus de la table products ensuite.
        // stockReserved : le stock a été décrémenté, il sera remis en cas d'annulation.
        const orderItems = cartItems.map(item => {
          const product = productsById.get(item.productId);
          const price = parseFloat(product.price) || 0;
          return {
            productId: product.id,
            name: product.name,
            price,
            image: (product.images && product.images[0]) || null,
            quantity: item.quantity,
            total: Math.round(price * item.quantity * 100) / 100,
            stockReserved: true
          };
        });

        for (const item of orderItems) {
          await productsById.get(item.productId).decrement('stock', { by: item.quantity, transaction: t });
        }

        // Frais de port calculés côté serveur (politique de la boutique), inclus dans le total
        const subtotal = Math.round(orderItems.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
        const shippingCost = computeShippingCost(subtotal);
        const totalAmount = Math.round((subtotal + shippingCost) * 100) / 100;
        console.log(`💰 Total calculé: ${subtotal}€ + livraison ${shippingCost}€ = ${totalAmount}€`);

        // Créer la commande avec status=pending
        const created = await Order.create({
          id: uuidv4(),
          orderId: `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          userId: userId,
          items: orderItems,
          shippingCost,
          totalAmount: totalAmount,
          status: 'pending', // Status initial selon spécification FonctionnalitéHaute#1778
          shippingAddress: shippingAddress || null,
          billingAddress: billingAddress || null,
          paymentMethod: paymentMethod || null,
          notes: notes || null
        }, { transaction: t });

        // Sous-tâche 3: vider le panier (dans la même transaction)
        await cart.clear({ transaction: t });

        return created;
      });

      const totalAmount = parseFloat(order.totalAmount);
      console.log(`✅ Commande créée: ${order.orderId} (Status: ${order.status})`);

      // Retourner la réponse selon la spécification: { orderId, total, status: 'pending' }
      res.status(201).json({
        success: true,
        message: 'Commande créée avec succès',
        data: {
          orderId: order.orderId,
          total: parseFloat(totalAmount),
          shippingCost: parseFloat(order.shippingCost),
          status: 'pending'
        }
      });

    } catch (error) {
      if (error instanceof EmptyCartError) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      if (error instanceof StockConflictError) {
        return res.status(409).json({
          success: false,
          message: error.message,
          conflicts: error.conflicts
        });
      }
      console.error('Erreur lors de la création de commande:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur lors de la création de la commande'
      });
    }
  }

  /**
   * PUT /api/orders/:orderId/status - Mettre à jour le statut d'une commande
   * 
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  static async updateOrderStatus(req, res) {
    try {
      const { orderId } = req.params;
      const { newStatus } = req.body || {};

      console.log(`🔄 Tentative de mise à jour statut commande ${orderId}: -> ${newStatus}`);

      // Validation du nouveau statut
      if (!newStatus) {
        return res.status(400).json({
          success: false,
          message: 'Le nouveau statut est requis'
        });
      }

      if (!Object.values(Order.STATUS).includes(newStatus)) {
        return res.status(400).json({
          success: false,
          message: `Statut invalide. Statuts autorisés: [${Object.values(Order.STATUS).join(', ')}]`
        });
      }

      // Trouver la commande (route réservée aux admins : n'importe quelle commande,
      // pas seulement celles passées par l'admin connecté)
      const order = await Order.findOne({
        where: { orderId: orderId }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        });
      }

      // Tenter la mise à jour du statut (avec validation automatique)
      try {
        await order.updateStatus(newStatus, { changedBy: req.user.id });

        res.status(200).json({
          success: true,
          message: `Statut de la commande mis à jour vers "${newStatus}"`,
          data: {
            orderId: order.orderId,
            previousStatus: order._previousDataValues?.status,
            currentStatus: order.status,
            availableTransitions: order.getAvailableTransitions(),
            trackingNumber: order.trackingNumber,
            updatedAt: order.updated_at
          }
        });

      } catch (transitionError) {
        // Erreur de transition invalide
        console.log(`❌ Transition refusée: ${transitionError.message}`);
        
        return res.status(400).json({
          success: false,
          message: transitionError.message,
          data: {
            currentStatus: order.status,
            requestedStatus: newStatus,
            availableTransitions: order.getAvailableTransitions()
          }
        });
      }

    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur lors de la mise à jour du statut'
      });
    }
  }

  /**
   * GET /api/orders - Lister les commandes de l'utilisateur (FonctionnalitéHaute#1779)
   * Sous-tâche 1: Implémenter GET /orders : requête find({ userId }) avec tri par date décroissante
   * 
   * @param {Object} req - Requête Express  
   * @param {Object} res - Réponse Express
   */
  static async getUserOrders(req, res) {
    try {
      const userId = req.user.id;
      const { status, limit = 50, offset = 0, page = 1 } = req.query;

      console.log(`📋 FonctionnalitéHaute#1779 - Récupération historique commandes utilisateur ${userId}`);

      // Sous-tâche 1: Construire les conditions de recherche find({ userId })
      const whereConditions = { userId: userId };
      if (status && Object.values(Order.STATUS).includes(status)) {
        whereConditions.status = status;
      }

      // Calcul de pagination
      const limitInt = Math.min(parseInt(limit) || 50, 100); // Limite max de 100
      const pageInt = Math.max(parseInt(page) || 1, 1); // Page min de 1
      const offsetCalculated = offset ? parseInt(offset) : (pageInt - 1) * limitInt;

      // Sous-tâche 1: Requête avec tri par date décroissante
      const { count, rows: orders } = await Order.findAndCountAll({
        where: whereConditions,
        order: [['created_at', 'DESC']], // Tri par date décroissante selon spécification
        limit: limitInt,
        offset: offsetCalculated,
        attributes: [
          'id', 'orderId', 'userId', 'status', 'totalAmount', 'shippingCost', 'items',
          'shippingAddress', 'billingAddress', 'paymentMethod', 
          'trackingNumber', 'notes', 'created_at', 'updated_at',
          'cancelledAt', 'confirmedAt', 'processingAt', 'shippedAt', 'deliveredAt'
        ]
      });

      console.log(`📋 ${orders.length} commandes trouvées sur ${count} total`);

      // Formatter les résultats avec tous les détails selon spécification
      const formattedOrders = orders.map(order => ({
        orderId: order.orderId,
        id: order.id,
        status: order.status,
        totalAmount: parseFloat(order.totalAmount),
        shippingCost: parseFloat(order.shippingCost || 0),
        itemsCount: order.items?.length || 0,
        // Sous-tâche 3: Retourner les détails complets
        items: order.items?.map(item => ({
          productId: item.productId,
          name: item.name,
          image: item.image || null,
          quantity: item.quantity,
          price: parseFloat(item.price),
          total: parseFloat(item.total || (item.price * item.quantity))
        })) || [],
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        paymentMethod: order.paymentMethod,
        trackingNumber: order.trackingNumber,
        notes: order.notes,
        // Informations sur les transitions et état
        availableTransitions: order.getAvailableTransitions(),
        isModifiable: order.isModifiable(),
        isCompleted: order.isCompleted(),
        isCancelable: order.isCancelable(), // FonctionnalitéMoyenne#1782
        // Sous-tâche 3: Dates complètes
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        // Dates de suivi (FonctionnalitéMoyenne#1782)
        cancelledAt: order.cancelledAt,
        confirmedAt: order.confirmedAt,
        processingAt: order.processingAt,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt
      }));

      // Pagination détaillée
      const hasNextPage = (offsetCalculated + limitInt) < count;
      const hasPrevPage = offsetCalculated > 0;
      const totalPages = Math.ceil(count / limitInt);

      res.status(200).json({
        success: true,
        message: `${count} commandes trouvées pour l'utilisateur`,
        data: {
          orders: formattedOrders,
          pagination: {
            total: count,
            count: formattedOrders.length,
            page: pageInt,
            totalPages: totalPages,
            limit: limitInt,
            offset: offsetCalculated,
            hasNextPage: hasNextPage,
            hasPrevPage: hasPrevPage,
            nextPage: hasNextPage ? pageInt + 1 : null,
            prevPage: hasPrevPage ? pageInt - 1 : null
          }
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des commandes:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur lors de la récupération des commandes'
      });
    }
  }

  /**
   * GET /api/orders/:orderId - Récupérer une commande spécifique (FonctionnalitéHaute#1779)
   * Sous-tâche 2: Implémenter GET /orders/:id : récupérer l'order par id et vérifier userId === user.id du token
   * Sous-tâche 3: Retourner les détails complets (items avec product_id/quantity/price, total, status, dates)
   * 
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  static async getOrderById(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id; // user.id du token JWT

      console.log(`📦 FonctionnalitéHaute#1779 - Récupération commande ${orderId} pour utilisateur ${userId}`);

      // Sous-tâche 2: Récupérer l'order par id et vérifier userId === user.id du token
      const order = await Order.findOne({
        where: { 
          orderId: orderId,
          userId: userId // Vérification de sécurité: l'utilisateur n'accède qu'à ses propres commandes
        },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'name']
        }],
        attributes: [
          'id', 'orderId', 'userId', 'status', 'totalAmount', 'shippingCost', 'items',
          'shippingAddress', 'billingAddress', 'paymentMethod', 
          'trackingNumber', 'notes', 'created_at', 'updated_at',
          'cancelledAt', 'confirmedAt', 'processingAt', 'shippedAt', 'deliveredAt'
        ]
      });

      if (!order) {
        console.log(`❌ Commande ${orderId} non trouvée ou n'appartient pas à l'utilisateur ${userId}`);
        return res.status(404).json({
          success: false,
          message: 'Commande non trouvée ou accès non autorisé'
        });
      }

      console.log(`✅ Commande ${orderId} trouvée avec ${order.items?.length || 0} items`);

      // Sous-tâche 3: Retourner les détails complets
      const detailedResponse = {
        orderId: order.orderId,
        id: order.id,
        status: order.status,
        totalAmount: parseFloat(order.totalAmount),
        shippingCost: parseFloat(order.shippingCost || 0),
        
        // Items avec product_id/quantity/price selon spécification
        items: order.items?.map(item => ({
          productId: item.productId, // product_id selon spécification
          name: item.name,
          image: item.image || null,
          quantity: item.quantity,
          price: parseFloat(item.price),
          total: parseFloat(item.total || (item.price * item.quantity))
        })) || [],
        
        // Détails d'adresse et paiement complets
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        paymentMethod: order.paymentMethod,
        trackingNumber: order.trackingNumber,
        notes: order.notes,
        
        // Informations sur les transitions et état
        availableTransitions: order.getAvailableTransitions(),
        isModifiable: order.isModifiable(),
        isCompleted: order.isCompleted(),
        isCancelable: order.isCancelable(), // FonctionnalitéMoyenne#1782
        
        // Informations utilisateur (sans données sensibles)
        user: order.user ? {
          id: order.user.id,
          email: order.user.email,
          name: order.user.name
        } : null,
        
        // Dates complètes selon spécification
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        // Dates de suivi (FonctionnalitéMoyenne#1782)
        cancelledAt: order.cancelledAt,
        confirmedAt: order.confirmedAt,
        processingAt: order.processingAt,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt
      };

      // Log des détails pour debugging
      console.log(`📦 Détails commande ${orderId}:`);
      console.log(`   - Status: ${detailedResponse.status}`);
      console.log(`   - Total: ${detailedResponse.totalAmount}€`);
      console.log(`   - Items: ${detailedResponse.items.length}`);
      console.log(`   - Paiement: ${detailedResponse.paymentMethod || 'Non spécifié'}`);
      console.log(`   - Créée le: ${detailedResponse.createdAt}`);

      res.status(200).json({
        success: true,
        message: 'Commande récupérée avec succès',
        data: detailedResponse
      });

    } catch (error) {
      console.error('Erreur lors de la récupération de la commande:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur lors de la récupération de la commande'
      });
    }
  }

  /**
   * GET /api/orders/:orderId/transitions - Obtenir les transitions possibles
   * 
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  static async getOrderTransitions(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const order = await Order.findOne({
        where: { 
          orderId: orderId,
          userId: userId
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          orderId: order.orderId,
          currentStatus: order.status,
          availableTransitions: order.getAvailableTransitions(),
          allStatuses: Object.values(Order.STATUS),
          isModifiable: order.isModifiable(),
          isCompleted: order.isCompleted()
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des transitions:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  /**
   * PUT /api/orders/:orderId/cancel - Annuler une commande (FonctionnalitéMoyenne#1782)
   * Sous-tâche 1: Implémenter PUT /orders/:id/cancel : vérifier que status=pending avant d'autoriser
   * Sous-tâche 2: Créer un champ cancelledAt et passer status à 'cancelled'
   * 
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  static async cancelOrder(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;
      // Raison d'annulation optionnelle (Express 5 : req.body absent sans corps)
      const { reason } = req.body || {};

      console.log(`🚫 FonctionnalitéMoyenne#1782 - Tentative d'annulation commande ${orderId} par utilisateur ${userId}`);

      // Trouver la commande
      const order = await Order.findOne({
        where: { 
          orderId: orderId,
          userId: userId // Sécurité: l'utilisateur ne peut annuler que ses propres commandes
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Commande non trouvée ou accès non autorisé'
        });
      }

      // Sous-tâche 1: Vérifier que status=pending avant d'autoriser l'annulation
      if (order.status !== 'pending') {
        console.log(`❌ Tentative d'annulation refusée - Commande ${orderId} n'est pas en statut pending (actuel: ${order.status})`);
        return res.status(400).json({
          success: false,
          message: `Impossible d'annuler une commande avec le statut "${order.status}". Seules les commandes en attente ("pending") peuvent être annulées.`,
          data: {
            currentStatus: order.status,
            cancelable: false,
            allowedCancelationStatuses: ['pending']
          }
        });
      }

      // Vérifier si la commande peut être annulée (double validation)
      if (!order.isCancelable()) {
        return res.status(400).json({
          success: false,
          message: 'Cette commande ne peut pas être annulée dans son état actuel',
          data: {
            currentStatus: order.status,
            cancelable: false
          }
        });
      }

      // Sous-tâche 2: Passer status à 'cancelled' (automatiquement avec cancelledAt via updateStatus)
      try {
        // Ajouter la raison d'annulation aux notes si fournie
        if (reason) {
          const cancelReason = `Raison d'annulation: ${reason}`;
          order.notes = order.notes ? `${order.notes}\n${cancelReason}` : cancelReason;
        }

        // Utiliser updateStatus qui se charge de la validation et de la mise à jour de cancelledAt
        await order.updateStatus('cancelled', { changedBy: req.user.id });

        console.log(`✅ Commande ${orderId} annulée avec succès`);

        res.status(200).json({
          success: true,
          message: 'Commande annulée avec succès',
          data: {
            orderId: order.orderId,
            previousStatus: 'pending',
            currentStatus: order.status,
            cancelledAt: order.cancelledAt,
            reason: reason || null,
            updatedAt: order.updated_at
          }
        });

      } catch (transitionError) {
        console.log(`❌ Erreur lors de l'annulation: ${transitionError.message}`);
        
        return res.status(400).json({
          success: false,
          message: transitionError.message,
          data: {
            currentStatus: order.status,
            cancelable: order.isCancelable()
          }
        });
      }

    } catch (error) {
      console.error('Erreur lors de l\'annulation de la commande:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur lors de l\'annulation de la commande'
      });
    }
  }

  /**
   * GET /api/orders/:orderId/tracking - Obtenir le suivi d'une commande (FonctionnalitéMoyenne#1782)
   * Sous-tâche 3: Implémenter GET /orders/:id/tracking : retourner { status, createdAt, confirmedAt, shippedAt, deliveredAt }
   * 
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  static async getOrderTracking(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      console.log(`📍 FonctionnalitéMoyenne#1782 - Suivi commande ${orderId} pour utilisateur ${userId}`);

      // Récupérer la commande avec toutes les informations de suivi
      const order = await Order.findOne({
        where: { 
          orderId: orderId,
          userId: userId // Sécurité: utilisateur ne peut suivre que ses propres commandes
        },
        attributes: [
          'orderId', 'status', 'trackingNumber',
          'created_at', 'updated_at', 'cancelledAt', 'confirmedAt', 'processingAt', 'shippedAt', 'deliveredAt'
        ]
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Commande non trouvée ou accès non autorisé'
        });
      }

      // Sous-tâche 3: Retourner le suivi simplifié selon spécification
      const trackingData = {
        orderId: order.orderId,
        status: order.status,
        createdAt: order.created_at,
        confirmedAt: order.confirmedAt || null,
        processingAt: order.processingAt || null,
        shippedAt: order.shippedAt || null,
        deliveredAt: order.deliveredAt || null,
        cancelledAt: order.cancelledAt || null, // Ajout du support d'annulation
        trackingNumber: order.trackingNumber || null
      };

      // Calculer les informations de progression
      const progressInfo = {
        isCompleted: order.status === 'delivered' || order.status === 'cancelled',
        isCancelled: order.status === 'cancelled',
        currentStep: order.status,
        timeline: [
          { step: 'pending', completed: true, date: order.created_at },
          { step: 'confirmed', completed: !!order.confirmedAt, date: order.confirmedAt },
          { step: 'processing', completed: !!order.processingAt, date: order.processingAt },
          { step: 'shipped', completed: !!order.shippedAt, date: order.shippedAt },
          { step: 'delivered', completed: !!order.deliveredAt, date: order.deliveredAt }
        ]
      };

      // Si annulée, ajuster la timeline
      if (order.status === 'cancelled') {
        progressInfo.timeline = [
          { step: 'pending', completed: true, date: order.created_at },
          { step: 'cancelled', completed: true, date: order.cancelledAt }
        ];
      }

      console.log(`📍 Suivi commande ${orderId}: ${order.status}`);

      res.status(200).json({
        success: true,
        message: 'Suivi de commande récupéré avec succès',
        data: {
          ...trackingData,
          progress: progressInfo
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération du suivi:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur lors de la récupération du suivi'
      });
    }
  }

  /**
   * GET /api/orders/statuses - Obtenir tous les statuts disponibles
   * 
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  static async getAvailableStatuses(req, res) {
    try {
      res.status(200).json({
        success: true,
        data: {
          statuses: Object.values(Order.STATUS),
          transitions: Order.VALID_TRANSITIONS,
          statusDescriptions: {
            [Order.STATUS.PENDING]: 'En attente de paiement',
            [Order.STATUS.CONFIRMED]: 'Confirmée',
            [Order.STATUS.PROCESSING]: 'En préparation',
            [Order.STATUS.SHIPPED]: 'Expédiée',
            [Order.STATUS.DELIVERED]: 'Livrée',
            [Order.STATUS.CANCELLED]: 'Annulée' // FonctionnalitéMoyenne#1782
          }
        }
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des statuts:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }
}

module.exports = OrderController;