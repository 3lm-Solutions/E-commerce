const { User, Order } = require('../../models');
const { Op, fn, col } = require('sequelize');

/**
 * Contrôleur d'administration des utilisateurs (clients)
 * FonctionnalitéMoyenne#428
 *
 * Routes ADMIN uniquement (middleware verifyAdmin requis au niveau des routes) :
 * - GET  /api/admin/users                : Liste tous les clients
 * - GET  /api/admin/users/:userId        : Profil détaillé d'un client (infos + commandes + total dépensé)
 * - PUT  /api/admin/users/:userId/deactivate : Désactiver un compte
 * - PUT  /api/admin/users/:userId/reactivate : Réactiver un compte
 *
 * Le champ `password` n'est JAMAIS renvoyé dans les réponses JSON.
 * Le champ `isActive` (mappé sur `is_active`) indique si le compte est actif.
 */

class AdminUserController {

  /**
   * GET /api/admin/users - Lister tous les clients
   * FonctionnalitéMoyenne#428
   *
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   *
   * Query params optionnels :
   * - search : recherche sur le nom ou l'email (insensible à la casse)
   * - page   : pagination, défaut 1
   * - limit  : pagination, défaut 20
   *
   * Pour chaque utilisateur, on calcule le nombre de commandes via un
   * COUNT GROUP BY (évite le N+1 pour le volume attendu).
   */
  static async getAllUsers(req, res) {
    try {
      const { search, page = 1, limit = 20 } = req.query;

      console.log('👥 AdminUserController#getAllUsers - Liste de tous les clients');

      // Construire les conditions de recherche
      const whereConditions = {};

      // Recherche sur le nom ou l'email (insensible à la casse)
      if (search && String(search).trim()) {
        const q = String(search).trim();
        whereConditions[Op.or] = [
          { name: { [Op.iLike]: `%${q}%` } },
          { email: { [Op.iLike]: `%${q}%` } }
        ];
      }

      // Calcul de la pagination
      const limitInt = Math.min(parseInt(limit) || 20, 100); // Limite max de 100
      const pageInt = Math.max(parseInt(page) || 1, 1); // Page min de 1
      const offsetCalculated = (pageInt - 1) * limitInt;

      // Récupérer les utilisateurs (TOUJOURS exclure le password)
      const { count, rows: users } = await User.findAndCountAll({
        where: whereConditions,
        attributes: ['id', 'email', 'name', 'role', 'isActive', 'created_at', 'updated_at'],
        order: [['created_at', 'DESC']],
        limit: limitInt,
        offset: offsetCalculated
      });

      // Comptage des commandes par utilisateur (COUNT GROUP BY)
      const orderCounts = await Order.findAll({
        attributes: ['userId', [fn('COUNT', col('id')), 'count']],
        group: ['userId'],
        raw: true
      });

      // Mapper userId -> nombre de commandes
      const countMap = {};
      for (const row of orderCounts) {
        countMap[row.userId] = parseInt(row.count, 10) || 0;
      }

      console.log(`👥 ${users.length} clients trouvés sur ${count} total`);

      // Formater les utilisateurs (sans données sensibles)
      const formattedUsers = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
        isActive: user.isActive,
        ordersCount: countMap[user.id] || 0
      }));

      // Pagination détaillée
      const totalPages = Math.ceil(count / limitInt);
      const hasNextPage = (offsetCalculated + limitInt) < count;
      const hasPrevPage = offsetCalculated > 0;

      res.status(200).json({
        success: true,
        message: `${count} clients trouvés`,
        data: {
          users: formattedUsers,
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
      console.error('Erreur lors de la récupération des utilisateurs admin:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur lors de la récupération des utilisateurs'
      });
    }
  }

  /**
   * GET /api/admin/users/:userId - Profil détaillé d'un client
   * FonctionnalitéMoyenne#428
   *
   * Retourne les infos du user (sans password) + la liste de ses commandes
   * (triées par created_at DESC) + le total dépensé (somme des totalAmount
   * en excluant les commandes annulées) + le nombre de commandes.
   *
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns 404 si l'utilisateur n'existe pas
   */
  static async getUserById(req, res) {
    try {
      const { userId } = req.params;

      console.log(`👤 AdminUserController#getUserById - Profil du client ${userId}`);

      // Récupérer l'utilisateur SANS le password
      const user = await User.findByPk(userId, {
        attributes: ['id', 'email', 'name', 'role', 'isActive', 'created_at', 'updated_at']
      });

      if (!user) {
        console.log(`❌ Client ${userId} non trouvé`);
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé'
        });
      }

      // Récupérer toutes les commandes du client (triées par date décroissante)
      const orders = await Order.findAll({
        where: { userId },
        order: [['created_at', 'DESC']],
        attributes: [
          'id', 'orderId', 'status', 'totalAmount', 'shippingCost', 'items',
          'paymentMethod', 'created_at', 'trackingNumber'
        ]
      });

      // Nombre total de commandes
      const ordersCount = orders.length;

      // Total dépensé : somme des totalAmount des commandes NON annulées
      const totalSpent = orders
        .filter(order => order.status !== 'cancelled')
        .reduce((sum, order) => sum + parseFloat(order.totalAmount || 0), 0);

      // Formater les commandes pour l'affichage
      const formattedOrders = orders.map(order => ({
        orderId: order.orderId,
        id: order.id,
        status: order.status,
        totalAmount: parseFloat(order.totalAmount),
        shippingCost: parseFloat(order.shippingCost || 0),
        itemsCount: (order.items || []).length,
        paymentMethod: order.paymentMethod,
        trackingNumber: order.trackingNumber,
        createdAt: order.created_at
      }));

      res.status(200).json({
        success: true,
        message: 'Client récupéré avec succès',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.created_at,
            updatedAt: user.updated_at
          },
          orders: formattedOrders,
          totalSpent: totalSpent,
          ordersCount: ordersCount
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération du client admin:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur lors de la récupération du client'
      });
    }
  }

  /**
   * PUT /api/admin/users/:userId/deactivate - Désactiver un compte client
   * FonctionnalitéMoyenne#428
   *
   * Met isActive à false. Un admin ne peut PAS se désactiver lui-même.
   *
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  static async deactivateUser(req, res) {
    try {
      const { userId } = req.params;

      console.log(`🚫 AdminUserController#deactivateUser - Désactivation du client ${userId}`);

      // Empêcher un admin de se désactiver lui-même
      if (req.user.id === userId) {
        console.log('❌ Tentative de désactivation de son propre compte admin');
        return res.status(400).json({
          success: false,
          message: 'Vous ne pouvez pas désactiver votre propre compte administrateur'
        });
      }

      // Trouver l'utilisateur
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé'
        });
      }

      // Mettre à jour isActive
      await user.update({ isActive: false });

      console.log(`✅ Client ${userId} désactivé avec succès`);

      res.status(200).json({
        success: true,
        message: 'Le compte client a été désactivé avec succès',
        data: {
          userId: user.id,
          isActive: false
        }
      });

    } catch (error) {
      console.error('Erreur lors de la désactivation du client admin:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur lors de la désactivation du client'
      });
    }
  }

  /**
   * PUT /api/admin/users/:userId/reactivate - Réactiver un compte client
   * FonctionnalitéMoyenne#428
   *
   * Met isActive à true (logique inversée de deactivateUser).
   *
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  static async reactivateUser(req, res) {
    try {
      const { userId } = req.params;

      console.log(`✅ AdminUserController#reactivateUser - Réactivation du client ${userId}`);

      // Trouver l'utilisateur
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé'
        });
      }

      // Mettre à jour isActive
      await user.update({ isActive: true });

      console.log(`✅ Client ${userId} réactivé avec succès`);

      res.status(200).json({
        success: true,
        message: 'Le compte client a été réactivé avec succès',
        data: {
          userId: user.id,
          isActive: true
        }
      });

    } catch (error) {
      console.error('Erreur lors de la réactivation du client admin:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur lors de la réactivation du client'
      });
    }
  }
}

module.exports = AdminUserController;
