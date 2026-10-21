const { Review, Product, User } = require('../../models');
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const reviewSummaryService = require('../services/reviewSummaryService');
/**
 * Contrôleur pour la gestion des avis produits
 */
const ReviewController = {
  /**
   * GET /products/:id/reviews
   * Récupérer la liste des avis d'un produit avec pagination
   */
  getProductReviews: async (req, res) => {
    try {
      const { id: productId } = req.params;
      const { 
        page = 1, 
        limit = 10, 
        sortBy = 'created_at', 
        sortOrder = 'DESC' 
      } = req.query;

      // Vérifier que le produit existe
      const product = await Product.findByPk(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        });
      }

      // Calcul de la pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const limitInt = parseInt(limit);

      // Validation des paramètres de tri
      const allowedSortFields = ['created_at', 'rating'];
      const allowedSortOrders = ['ASC', 'DESC'];
      
      const finalSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const finalSortOrder = allowedSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      // Récupérer les avis avec les informations utilisateur
      const reviews = await Review.findAll({
        where: { productId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email'] // Ne pas exposer le mot de passe
          }
        ],
        order: [[finalSortBy, finalSortOrder]],
        limit: limitInt,
        offset: offset
      });

      const totalReviews = await Review.count({
        where: { productId }
      });

      // Calculer les métadonnées de pagination
      const totalPages = Math.ceil(totalReviews / limitInt);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      // Calculer les statistiques des avis
      const ratingStats = await Review.findAll({
        where: { productId },
        attributes: [
          [Review.sequelize.fn('AVG', Review.sequelize.col('rating')), 'averageRating'],
          [Review.sequelize.fn('COUNT', Review.sequelize.col('id')), 'totalReviews']
        ],
        raw: true
      });

      const stats = ratingStats[0] || { averageRating: 0, totalReviews: 0 };

      return res.status(200).json({
        success: true,
        data: {
          reviews: reviews.map(review => ({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.created_at,
            user: {
              id: review.user.id,
              name: review.user.name || 'Utilisateur anonyme',
              // Ne pas exposer l'email complet pour la confidentialité
              email: review.user.email ? review.user.email.replace(/(.{2}).*@/, '$1***@') : null
            }
          })),
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalReviews,
            limit: limitInt,
            hasNextPage,
            hasPreviousPage
          },
          stats: {
            averageRating: parseFloat(stats.averageRating || 0).toFixed(2),
            totalReviews: parseInt(stats.totalReviews || 0)
          }
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des avis:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * POST /products/:id/reviews
   * Ajouter un avis sur un produit (authentification requise)
   */
  createReview: async (req, res) => {
    try {
      // Vérifier les erreurs de validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données invalides',
          errors: errors.array()
        });
      }

      const { id: productId } = req.params;
      const { rating, comment } = req.body;
      const userId = req.user.id; // Récupéré du middleware verifyToken

      // Vérifier que le produit existe
      const product = await Product.findByPk(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        });
      }

      // Vérifier que l'utilisateur n'a pas déjà laissé un avis sur ce produit
      const existingReview = await Review.findOne({
        where: {
          userId,
          productId
        }
      });

      if (existingReview) {
        return res.status(409).json({
          success: false,
          message: 'Vous avez déjà laissé un avis sur ce produit'
        });
      }

      // Créer le nouvel avis
      const reviewId = uuidv4();
      const newReview = await Review.create({
        id: reviewId,
        userId,
        productId,
        rating: parseInt(rating),
        comment: comment || null
      });

      // Récupérer l'avis créé avec les informations utilisateur
      const createdReview = await Review.findByPk(reviewId, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email']
          }
        ]
      });

      // Mettre à jour les statistiques du produit (optionnel, peut être fait en arrière-plan)
      await updateProductRatingStats(productId);

      return res.status(201).json({
        success: true,
        message: 'Avis créé avec succès',
        data: {
          review: {
            id: createdReview.id,
            rating: createdReview.rating,
            comment: createdReview.comment,
            createdAt: createdReview.created_at,
            user: {
              id: createdReview.user.id,
              name: createdReview.user.name || 'Utilisateur anonyme'
            }
          }
        }
      });

    } catch (error) {
      console.error('Erreur lors de la création de l\'avis:', error);
      
      // Gérer les erreurs de contrainte unique
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          message: 'Vous avez déjà laissé un avis sur ce produit'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

/**
 * Fonction utilitaire pour mettre à jour les statistiques de rating d'un produit
 */
async function updateProductRatingStats(productId) {
  try {
    const stats = await Review.findAll({
      where: { productId },
      attributes: [
        [Review.sequelize.fn('AVG', Review.sequelize.col('rating')), 'averageRating'],
        [Review.sequelize.fn('COUNT', Review.sequelize.col('id')), 'totalReviews']
      ],
      raw: true
    });

    const { averageRating, totalReviews } = stats[0] || { averageRating: 0, totalReviews: 0 };

    await Product.update({
      ratingAvg: parseFloat(averageRating || 0),
      ratingCount: parseInt(totalReviews || 0)
    }, {
      where: { id: productId }
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour des statistiques du produit:', error);
  }
}

ReviewController.getReviewSummary = async (req, res) => {
  try {
    const { id: productId } = req.params;
 
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de produit invalide'
      });
    }
 
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }
 
    const reviews = await reviewSummaryService.getLatestReviews(productId);
 
    if (reviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ce produit n\'a pas encore d\'avis à résumer'
      });
    }
 
    let summary;
    let cached;
    try {
      ({ summary, cached } = await reviewSummaryService.getCachedReviewSummary(productId, reviews));
    } catch (groqError) {
      console.error('Erreur Groq lors du résumé des avis:', groqError.message);
      return res.status(502).json({
        success: false,
        message: 'Impossible de générer le résumé des avis pour le moment',
        error: process.env.NODE_ENV === 'development' ? groqError.message : undefined
      });
    }
 
    res.status(200).json({
      success: true,
      data: {
        productId,
        reviewsAnalyzed: reviews.length,
        cached,
        summary
      }
    });
 
  } catch (error) {
    console.error('Erreur lors de la génération du résumé d\'avis:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la génération du résumé',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = ReviewController;