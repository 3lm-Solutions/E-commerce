const { Order, Product, User } = require('../../models');
const { Op } = require('sequelize');

/**
 * Contrôleur d'analytics pour l'administration
 *
 * Routes ADMIN uniquement (middleware verifyAdmin requis):
 * - GET /admin/analytics/revenue       : Évolution du chiffre d'affaires (série temporelle)
 * - GET /admin/analytics/top-products  : Top produits les plus vendus
 * - GET /admin/dashboard/metrics       : KPIs précis du tableau de bord (FonctionnalitéHaute#429)
 * - GET /admin/dashboard/recent-orders : 10 dernières commandes (FonctionnalitéHaute#429)
 *
 * Décision métier :
 * Les commandes au statut "cancelled" sont EXCLUES du calcul du chiffre d'affaires
 * et du top produits, car elles ne représentent pas une vente effective.
 * Tous les autres statuts (pending, confirmed, processing, shipped, delivered) sont inclus.
 *
 * Note d'implémentation : les items de commande sont stockés en JSONB dans Order.items
 * (structure : { productId, name, price, quantity, total } — voir orderController.createOrder).
 * L'agrégation est donc réalisée côté Node plutôt qu'en SQL sur du JSONB, ce qui est
 * plus simple et plus lisible étant donné la volumétrie du projet.
 */

class AdminAnalyticsController {

  /**
   * GET /admin/analytics/revenue?period=7d
   *
   * Query param period : "7d" | "30d" | "12m" (défaut: 7d)
   *  - 7d  : 7 derniers jours, granularité jour
   *  - 30d : 30 derniers jours, granularité jour
   *  - 12m : 12 derniers mois, granularité mois
   *
   * Agrège SUM(totalAmount) et COUNT(*) par jour (ou par mois) sur les commandes
   * dont status != 'cancelled' et createdAt dans la plage demandée.
   * Les jours/mois sans commande sont inclus dans la série avec revenue: 0, ordersCount: 0
   * afin de produire une série continue pour le graphique.
   *
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  static async getRevenueAnalytics(req, res) {
    try {
      // Validation du paramètre period
      const { period = '7d' } = req.query;
      const allowedPeriods = ['7d', '30d', '12m'];
      if (!allowedPeriods.includes(period)) {
        return res.status(400).json({
          success: false,
          message: `Paramètre "period" invalide. Valeurs autorisées : ${allowedPeriods.join(', ')}`
        });
      }

      const now = new Date();
      const granularity = period === '12m' ? 'month' : 'day';

      // Calcul de la date de début de la plage
      let startDate;
      if (period === '12m') {
        // 12 mois en arrière (début du mois courant)
        startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      } else {
        // N jours en arrière (incluant aujourd'hui)
        const days = period === '7d' ? 6 : 29;
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(startDate.getDate() - days);
      }

      // Récupérer les commandes non annulées dans la plage de dates
      const orders = await Order.findAll({
        where: {
          status: { [Op.ne]: 'cancelled' }, // Décision métier : exclure les commandes annulées
          created_at: { [Op.gte]: startDate }
        },
        attributes: ['totalAmount', 'created_at']
      });

      // Construire un Map par bucket (jour ou mois) -> { revenue, ordersCount }
      const bucketMap = new Map();

      orders.forEach((order) => {
        const date = new Date(order.created_at);
        const key = granularity === 'month'
          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        const current = bucketMap.get(key) || { revenue: 0, ordersCount: 0 };
        current.revenue += parseFloat(order.totalAmount) || 0;
        current.ordersCount += 1;
        bucketMap.set(key, current);
      });

      // Générer une série continue sans trous (jours/mois sans commande => 0)
      const series = [];
      const totalRevenue = orders.reduce((sum, order) => sum + (parseFloat(order.totalAmount) || 0), 0);
      const totalOrders = orders.length;

      if (granularity === 'month') {
        // 12 mois : de startDate (11 mois en arrière) à aujourd'hui
        for (let i = 0; i < 12; i++) {
          const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const bucket = bucketMap.get(key) || { revenue: 0, ordersCount: 0 };
          series.push({ date: key, revenue: Number(bucket.revenue.toFixed(2)), ordersCount: bucket.ordersCount });
        }
      } else {
        // Jours : de startDate à aujourd'hui
        const numDays = period === '7d' ? 7 : 30;
        for (let i = 0; i < numDays; i++) {
          const d = new Date(startDate);
          d.setDate(startDate.getDate() + i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const bucket = bucketMap.get(key) || { revenue: 0, ordersCount: 0 };
          series.push({ date: key, revenue: Number(bucket.revenue.toFixed(2)), ordersCount: bucket.ordersCount });
        }
      }

      res.status(200).json({
        success: true,
        data: {
          period,
          series,
          totalRevenue: Number(totalRevenue.toFixed(2)),
          totalOrders
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des analytics de revenus:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des analytics de revenus',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * GET /admin/analytics/top-products?limit=10
   *
   * Query param limit : défaut 10, max 50.
   *
   * Parcourt les commandes non annulées, extrait chaque item de leur champ JSONB items,
   * et agrège par productId : somme des quantités vendues et somme du chiffre d'affaires
   * généré (price * quantity par ligne).
   *
   * Une fois le top N calculé (trié par quantité décroissante), on récupère les infos
   * produit (name) via Product.findAll pour enrichir la réponse, avec un fallback
   * "Produit supprimé" si un produit n'existe plus.
   *
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  static async getTopProducts(req, res) {
    try {
      // Validation du paramètre limit
      let limit = parseInt(req.query.limit, 10);
      if (isNaN(limit)) limit = 10;
      limit = Math.min(Math.max(limit, 1), 50); // entre 1 et 50

      // Récupérer uniquement le champ items des commandes non annulées
      const orders = await Order.findAll({
        where: {
          status: { [Op.ne]: 'cancelled' } // Décision métier : exclure les commandes annulées
        },
        attributes: ['items']
      });

      // Agréger par productId via une Map
      const productMap = new Map();

      orders.forEach((order) => {
        if (!Array.isArray(order.items)) return;
        order.items.forEach((item) => {
          const productId = item.productId;
          if (!productId) return;

          const quantity = parseInt(item.quantity, 10) || 0;
          // Le montant généré par ligne = price * quantity
          const lineRevenue = (parseFloat(item.price) || 0) * quantity;

          const current = productMap.get(productId) || { productId, quantitySold: 0, revenue: 0 };
          current.quantitySold += quantity;
          current.revenue += lineRevenue;
          productMap.set(productId, current);
        });
      });

      // Trier par quantité vendue décroissante et prendre le top N
      const sorted = Array.from(productMap.values())
        .sort((a, b) => b.quantitySold - a.quantitySold)
        .slice(0, limit);

      const products = sorted.map((p) => ({
        productId: p.productId,
        quantitySold: p.quantitySold,
        revenue: Number(p.revenue.toFixed(2))
      }));

      // Enrichir avec le nom des produits
      if (products.length > 0) {
        const productIds = products.map((p) => p.productId);
        const productRows = await Product.findAll({
          where: { id: { [Op.in]: productIds } },
          attributes: ['id', 'name']
        });
        const nameMap = new Map(productRows.map((p) => [p.id, p.name]));

        products.forEach((p) => {
          p.name = nameMap.get(p.productId) || 'Produit supprimé'; // Fallback si produit supprimé
        });
      }

res.status(200).json({
        success: true,
        data: {
          products
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération du top produits:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération du top produits',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Helper : calcule le revenu total (toutes périodes) sur les commandes non annulées.
   *
   * Factorise la logique déjà utilisée dans getRevenueAnalytics pour éviter toute
   * duplication lors du calcul du KPI "Revenus totaux" du tableau de bord.
   *
   * Décision métier : les commandes au statut "cancelled" sont EXCLUES du calcul.
   *
   * @returns {Promise<number>} Somme des totalAmount des commandes non annulées
   */
  static async computeTotalRevenue() {
    // Récupérer uniquement le champ totalAmount des commandes non annulées
    const orders = await Order.findAll({
      where: {
        status: { [Op.ne]: 'cancelled' } // Décision métier : exclure les commandes annulées
      },
      attributes: ['totalAmount']
    });

    // Somme des montants (avec fallback à 0 si valeur invalide)
    const total = orders.reduce((sum, order) => sum + (parseFloat(order.totalAmount) || 0), 0);
    return Number(total.toFixed(2));
  }

  /**
   * GET /admin/dashboard/metrics
   * FonctionnalitéHaute#429
   *
   * Retourne les KPIs précis du tableau de bord "Aujourd'hui" ainsi que les alertes
   * de stock faible. Contrairement aux cartes génériques (toutes périodes), ces
   * métriques sont ciblées :
   *   - totalRevenue        : revenu total (toutes périodes, commandes non annulées)
   *   - todayOrdersCount    : commandes créées depuis le début de la journée
   *   - newCustomersCount   : clients inscrits depuis le début de la journée ("Aujourd'hui")
   *   - outOfStockCount     : produits en rupture totale (stock = 0, actifs)
   *   - lowStockProducts    : produits actifs avec 0 < stock < 5 (pour l'alerte automatique)
   *
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  static async getDashboardMetrics(req, res) {
    try {
      // Début de la journée actuelle (00:00:00) pour les métriques "du jour"
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      // Lancer les requêtes en parallèle pour optimiser le temps de réponse
      const [
        totalRevenue,
        todayOrdersCount,
        newCustomersCount,
        outOfStockCount,
        lowStockProducts
      ] = await Promise.all([
        // Revenu total : réutilise la logique factorisée (non annulées)
        AdminAnalyticsController.computeTotalRevenue(),
        // Commandes créées aujourd'hui (tous statuts confondus)
        Order.count({
          where: {
            created_at: { [Op.gte]: startOfToday }
          }
        }),
        // Nouveaux clients inscrits aujourd'hui
        User.count({
          where: {
            created_at: { [Op.gte]: startOfToday }
          }
        }),
        // Produits en rupture totale (stock = 0) et actifs
        Product.count({
          where: {
            stock: 0,
            isActive: true
          }
        }),
        // Produits à stock faible (0 < stock < 5) et actifs — pour l'alerte
        Product.findAll({
          where: {
            stock: { [Op.gt]: 0, [Op.lt]: 5 },
            isActive: true
          },
          attributes: ['id', 'name', 'stock']
        })
      ]);

      // Formater la liste des produits à stock faible
      const lowStockList = lowStockProducts.map((p) => ({
        id: p.id,
        name: p.name,
        stock: p.stock
      }));

      res.status(200).json({
        success: true,
        data: {
          totalRevenue,
          todayOrdersCount,
          newCustomersCount,
          outOfStockCount,
          lowStockProducts: lowStockList
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des métriques du tableau de bord:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des métriques du tableau de bord',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * GET /admin/dashboard/recent-orders
   * FonctionnalitéHaute#429
   *
   * Retourne les 10 dernières commandes (tous utilisateurs confondus), triées par
   * date de création décroissante. Le formatage réutilise AdminOrderController.formatOrder
   * afin de rester cohérent avec le tab "Commandes" (statut, client, montant, dates).
   *
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  static async getRecentOrders(req, res) {
    try {
      // Import dynamique pour éviter une dépendance circulaire au sommet du fichier
      const AdminOrderController = require('./adminOrderController');

      // Récupérer les 10 dernières commandes avec les infos utilisateur (email, nom)
      const orders = await Order.findAll({
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'name'], // Sans données sensibles (mot de passe, refreshToken)
          required: false // LEFT JOIN pour ne pas exclure les commandes sans utilisateur
        }],
        order: [['created_at', 'DESC']], // Plus récentes en premier
        limit: 10,
        attributes: [
          'id', 'orderId', 'userId', 'status', 'totalAmount', 'items',
          'shippingAddress', 'billingAddress', 'paymentMethod',
          'trackingNumber', 'notes', 'created_at', 'updated_at',
          'confirmedAt', 'processingAt', 'shippedAt', 'deliveredAt', 'cancelledAt'
        ]
      });

      // Formater chaque commande avec le format réutilisé côté admin
      const formattedOrders = orders.map((order) => AdminOrderController.formatOrder(order));

      res.status(200).json({
        success: true,
        data: {
          orders: formattedOrders
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des dernières commandes:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des dernières commandes',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = AdminAnalyticsController;
