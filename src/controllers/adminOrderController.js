const { Order, User, OrderStatusHistory } = require('../../models');
const { Op } = require('sequelize');

/**
 * Contrôleur d'administration des commandes
 * FonctionnalitéHaute#427
 *
 * Routes ADMIN uniquement (middleware verifyAdmin requis au niveau des routes) :
 * - GET    /api/admin/orders                : Liste toutes les commandes (tous utilisateurs)
 * - GET    /api/admin/orders/:orderId       : Détail complet d'une commande (sans filtre userId), avec statusHistory
 * - PUT    /api/admin/orders/:orderId/status: Changer le statut de N'IMPORTE QUELLE commande
 *
 * Contrairement aux routes utilisateur (/api/orders), ces routes n'appliquent
 * AUCUN filtre userId : un admin doit pouvoir consulter et gérer toutes les
 * commandes de tous les clients.
 *
 * La machine à états (pending → confirmed → processing → shipped → delivered, annulation)
 * est réutilisée directement depuis le modèle Order (updateStatus()).
 */

class AdminOrderController {

  /**
   * GET /api/admin/orders - Lister toutes les commandes de tous les utilisateurs
   * FonctionnalitéHaute#427
   *
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   *
   * Query params optionnels :
   * - status       : filtre exact sur le statut (pending|confirmed|processing|shipped|delivered|cancelled)
   * - startDate    : filtre sur created_at >= startDate (YYYY-MM-DD)
   * - endDate      : filtre sur created_at <= endDate (YYYY-MM-DD)
   * - userId       : filtre par utilisateur (UUID)
   * - userEmail    : filtre par email client (recherche insensible à la casse)
   * - page         : pagination, défaut 1
   * - limit        : pagination, défaut 20
   *
   * Tri par created_at DESC par défaut.
   */
  static async getAllOrders(req, res) {
    try {
      const {
        status,
        startDate,
        endDate,
        userId,
        userEmail,
        page = 1,
        limit = 20
      } = req.query;

      console.log('📋 AdminOrderController#getAllOrders - Liste de toutes les commandes');

      // Construire les conditions de recherche
      const whereConditions = {};

      // Filtre par statut exact
      if (status && Object.values(Order.STATUS).includes(status)) {
        whereConditions.status = status;
      }

      // Filtre par date de création (intervalle)
      const dateConditions = [];
      if (startDate) {
        dateConditions.push({ created_at: { [Op.gte]: new Date(startDate) } });
      }
      if (endDate) {
        // Fin de journée inclusive pour endDate
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateConditions.push({ created_at: { [Op.lte]: end } });
      }
      if (dateConditions.length > 0) {
        whereConditions[Op.and] = dateConditions;
      }

      // Filtre par utilisateur (userId direct)
      if (userId) {
        whereConditions.userId = userId;
      }

      // Filtre par email client (via le modèle User inclus)
      const includeUser = {
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'name'],
        required: false // LEFT JOIN pour ne pas exclure les commandes sans utilisateur
      };

      // Recherche par email : on ajoute une condition sur le modèle inclus
      if (userEmail) {
        includeUser.where = {
          email: { [Op.iLike]: `%${userEmail}%` }
        };
        includeUser.required = true; // INNER JOIN lorsqu'on filtre par email
      }

      // Calcul de la pagination
      const limitInt = Math.min(parseInt(limit) || 20, 100); // Limite max de 100
      const pageInt = Math.max(parseInt(page) || 1, 1); // Page min de 1
      const offsetCalculated = (pageInt - 1) * limitInt;

      // Requête avec toutes les commandes (aucun filtre userId)
      const { count, rows: orders } = await Order.findAndCountAll({
        where: whereConditions,
        include: [includeUser],
        order: [['created_at', 'DESC']], // Tri par date décroissante
        limit: limitInt,
        offset: offsetCalculated,
        attributes: [
          'id', 'orderId', 'userId', 'status', 'totalAmount', 'items',
          'shippingAddress', 'billingAddress', 'paymentMethod',
          'trackingNumber', 'notes', 'created_at', 'updated_at',
          'confirmedAt', 'processingAt', 'shippedAt', 'deliveredAt', 'cancelledAt'
        ]
      });

      console.log(`📋 ${orders.length} commandes trouvées sur ${count} total`);

      // Formater les résultats pour l'admin
      const formattedOrders = orders.map(order => AdminOrderController.formatOrder(order));

      // Pagination détaillée
      const totalPages = Math.ceil(count / limitInt);
      const hasNextPage = (offsetCalculated + limitInt) < count;
      const hasPrevPage = offsetCalculated > 0;

      res.status(200).json({
        success: true,
        message: `${count} commandes trouvées`,
        data: {
          orders: formattedOrders,
          pagination: {
            page: pageInt,
            limit: limitInt,
            total: count,
            totalPages: totalPages,
            offset: offsetCalculated,
            hasNextPage: hasNextPage,
            hasPrevPage: hasPrevPage,
            nextPage: hasNextPage ? pageInt + 1 : null,
            prevPage: hasPrevPage ? pageInt - 1 : null
          }
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des commandes admin:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur lors de la récupération des commandes'
      });
    }
  }

  /**
   * GET /api/admin/orders/:orderId - Détail complet d'une commande (accès admin)
   * FonctionnalitéHaute#427
   *
   * Contrairement à la version utilisateur (getOrderById), aucune vérification
   * userId n'est appliquée : l'admin peut consulter n'importe quelle commande.
   *
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns 404 si la commande n'existe pas
   */
  static async getOrderByIdAdmin(req, res) {
    try {
      const { orderId } = req.params;

      console.log(`📦 AdminOrderController#getOrderByIdAdmin - Récupération commande ${orderId}`);

      // Récupérer la commande SANS filtre userId
      const order = await Order.findOne({
        where: { orderId: orderId },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'name']
        }],
        attributes: [
          'id', 'orderId', 'userId', 'status', 'totalAmount', 'items',
          'shippingAddress', 'billingAddress', 'paymentMethod',
          'trackingNumber', 'notes', 'created_at', 'updated_at',
          'confirmedAt', 'processingAt', 'shippedAt', 'deliveredAt', 'cancelledAt'
        ]
      });

      if (!order) {
        console.log(`❌ Commande ${orderId} non trouvée`);
        return res.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        });
      }

      console.log(`✅ Commande ${orderId} trouvée (${order.status})`);

      // Historique des états, du plus ancien au plus récent (cahier 03, §3.1)
      const history = await OrderStatusHistory.findAll({
        where: { orderId: order.id },
        include: [{ model: User, as: 'author', attributes: ['id', 'email', 'name', 'role'] }],
        order: [['created_at', 'ASC']]
      });

      res.status(200).json({
        success: true,
        message: 'Commande récupérée avec succès',
        data: {
          ...AdminOrderController.formatOrder(order),
          statusHistory: history.map((entry) => ({
            fromStatus: entry.fromStatus,
            toStatus: entry.toStatus,
            changedAt: entry.created_at,
            changedBy: entry.author
              ? { id: entry.author.id, email: entry.author.email, name: entry.author.name, role: entry.author.role }
              : null
          }))
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération de la commande admin:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur lors de la récupération de la commande'
      });
    }
  }

  /**
   * PUT /api/admin/orders/:orderId/status - Changer le statut de N'IMPORTE QUELLE commande
   * FonctionnalitéHaute#427
   *
   * Route dédiée admin : aucune vérification userId (contrairement à
   * updateOrderStatus du contrôleur utilisateur). Utilise la machine à états
   * existante du modèle Order (updateStatus()).
   *
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @body { newStatus: "pending"|"confirmed"|"processing"|"shipped"|"delivered"|"cancelled" }
   */
  static async updateOrderStatusAdmin(req, res) {
    try {
      const { orderId } = req.params;
      const { newStatus } = req.body;

      console.log(`🔄 AdminOrderController#updateOrderStatusAdmin - Commande ${orderId} -> ${newStatus}`);

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

      // Trouver la commande SANS filtre userId (l'admin peut tout modifier)
      const order = await Order.findOne({
        where: { orderId: orderId }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        });
      }

      // Tenter la mise à jour du statut (validation via la machine à états)
      try {
        await order.updateStatus(newStatus, { changedBy: req.user.id });

        console.log(`✅ Commande ${order.orderId} mise à jour vers "${newStatus}"`);

        return res.status(200).json({
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
        // Transition invalide (ex: tentative de revenir en arrière)
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
      console.error('Erreur lors de la mise à jour du statut admin:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur lors de la mise à jour du statut'
      });
    }
  }

  /**
   * Helper : formate une commande (avec infos utilisateur) pour la réponse admin
   * @param {Order} order - Instance Sequelize Order
   * @returns {Object} - Commande formatée
   */
  static formatOrder(order) {
    return {
      orderId: order.orderId,
      id: order.id,
      userId: order.userId,
      status: order.status,
      totalAmount: parseFloat(order.totalAmount),

      // Items de la commande
      items: order.items?.map(item => ({
        productId: item.productId,
        name: item.name,
        image: item.image || null,
        quantity: item.quantity,
        price: parseFloat(item.price),
        total: parseFloat(item.total || (item.price * item.quantity))
      })) || [],

      // Détails d'adresse et paiement
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      paymentMethod: order.paymentMethod,
      trackingNumber: order.trackingNumber,
      notes: order.notes,

      // Informations sur les transitions et état
      availableTransitions: order.getAvailableTransitions(),
      isModifiable: order.isModifiable(),
      isCompleted: order.isCompleted(),
      isCancelable: order.isCancelable(),

      // Informations client (sans données sensibles)
      user: order.user ? {
        id: order.user.id,
        email: order.user.email,
        name: order.user.name
      } : null,

      // Dates complètes
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      // Attributs du modèle en camelCase (order.confirmed_at valait toujours undefined)
      confirmedAt: order.confirmedAt,
      processingAt: order.processingAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt
    };
  }
}

module.exports = AdminOrderController;
