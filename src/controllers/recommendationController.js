const similarityService = require('../services/similarityService');
const recommendationService = require('../services/recommendationService');
const trendingService = require('../services/trendingService');

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const DEFAULT_LIMIT = 4;

    class RecommendationController {

   
    static async getSimilarProducts(req, res) {
        try {
        const { product_id } = req.params;

        // Validation de l'UUID
        if (!product_id || !UUID_REGEX.test(product_id)) {
            return res.status(400).json({
            success: false,
            message: 'product_id invalide (UUID requis)'
            });
        }

        // Limite personnalisable (par défaut 4, plafonnée à 20)
        const limit = Math.min(parseInt(req.query.limit) || DEFAULT_LIMIT, 20);

        let result;
        try {
            // Intégration de la fonction get_similar_products() développée précédemment
            result = await similarityService.getSimilarProducts(product_id, limit);
        } catch (error) {
            // Produit de référence non trouvé ou inactif
            return res.status(404).json({
            success: false,
            message: error.message
            });
        }

        const { similarProducts } = result;

        // Formatage de la réponse avec les informations complètes demandées :
        // id, nom, prix, image, score de similarité
        const formattedProducts = similarProducts.map(({ product, score }) => ({
            id: product.id,
            name: product.name,
            price: parseFloat(product.price),
            image: product.images && product.images.length > 0 ? product.images[0] : null,
            category: product.category ? { id: product.category.id, name: product.category.name } : null,
            ratingAvg: parseFloat(product.ratingAvg) || 0,
            similarityScore: score
        }));

        res.status(200).json({
            success: true,
            data: {
            productId: product_id,
            count: formattedProducts.length,
            similarProducts: formattedProducts
            }
        });

        } catch (error) {
        console.error('Erreur lors de la récupération des recommandations:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors du calcul des recommandations',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
        }
    }

    /**
     * GET /recommendations/for-you - Recommandations personnalisées 
     */
    static async getForYou(req, res) {
        try {
        const userId = req.user.id; // Injecté par le middleware verifyToken

        const limit = Math.min(parseInt(req.query.limit) || 10, 50);

        const { basedOnCategories, hasHistory, recommendations } =
            await recommendationService.getPersonalizedRecommendations(userId, { limit });

        const formattedRecommendations = recommendations.map((product) => ({
            id: product.id,
            name: product.name,
            price: parseFloat(product.price),
            image: product.images && product.images.length > 0 ? product.images[0] : null,
            categoryId: product.categoryId,
            ratingAvg: parseFloat(product.ratingAvg || 0)
        }));

        res.status(200).json({
            success: true,
            data: {
            basedOnCategories,
            hasHistory,
            count: formattedRecommendations.length,
            recommendations: formattedRecommendations
            }
        });

        } catch (error) {
        console.error('Erreur lors du calcul des recommandations personnalisées:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors du calcul des recommandations personnalisées',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
        }
    }

    //
    static async getTrending(req, res) {
    try {
    const days = Math.min(parseInt(req.query.days) || 7, 90);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const trending = await trendingService.getTrendingProducts(days, limit);

    const formatted = trending.map(({ product, viewCount }) => ({
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        image: product.images && product.images.length > 0 ? product.images[0] : null,
        category: product.category ? product.category.name : null,
        ratingAvg: parseFloat(product.ratingAvg || 0),
        viewCount
    }));

    res.status(200).json({
        success: true,
        data: {
        days,
        count: formatted.length,
        trending: formatted
        }
    });

    } catch (error) {
    console.error('Erreur lors du calcul des produits tendances:', error);
    res.status(500).json({
        success: false,
        message: 'Erreur serveur lors du calcul des produits tendances',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
    }
}
    }

    module.exports = RecommendationController;