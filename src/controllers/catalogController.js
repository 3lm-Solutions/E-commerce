const { Product, Category } = require('../../models');
const { Op } = require('sequelize');

/**
 * Contrôleur du catalogue produits et catégories
 * 
 * Routes publiques (pas d'authentification requise):
 * - GET /api/products : Liste des produits avec pagination et filtres
 * - GET /api/products/:id : Détail d'un produit
 * - GET /api/categories : Liste des catégories
 */

class CatalogController {

  /**
   * GET /api/products - Liste des produits avec pagination et filtres
   * 
   * Query params:
   * - page: numéro de page (défaut: 1)
   * - limit: nombre d'éléments par page (défaut: 10, max: 50)
   * - categoryId: filtrer par catégorie
   * - minPrice: prix minimum
   * - maxPrice: prix maximum
   * - search: recherche dans nom/description
   * - sortBy: tri (price, name, rating, createdAt)
   * - sortOrder: ordre (asc, desc) - défaut: asc
   * - active: afficher seulement les produits actifs (défaut: true)
   * 
   * Returns: { products: [], pagination: { page, limit, total, pages }, filters }
   */
  static async getProducts(req, res) {
    try {
      // Extraction et validation des paramètres
      const {
        page = 1,
        limit = 10,
        categoryId,
        minPrice,
        maxPrice,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        active = 'true'
      } = req.query;

      // Validation des paramètres
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
      const offset = (pageNum - 1) * limitNum;

      // Construction des conditions WHERE
      const whereConditions = {};

      // Filtre par statut actif
      if (active === 'true') {
        whereConditions.isActive = true;
      }

      // Filtre par catégorie
      if (categoryId) {
        whereConditions.categoryId = categoryId;
      }

      // Filtre par prix
      if (minPrice || maxPrice) {
        whereConditions.price = {};
        if (minPrice) {
          const minPriceNum = parseFloat(minPrice);
          if (!isNaN(minPriceNum) && minPriceNum >= 0) {
            whereConditions.price[Op.gte] = minPriceNum;
          }
        }
        if (maxPrice) {
          const maxPriceNum = parseFloat(maxPrice);
          if (!isNaN(maxPriceNum) && maxPriceNum >= 0) {
            whereConditions.price[Op.lte] = maxPriceNum;
          }
        }
      }

      // Filtre de recherche textuelle
      if (search && search.trim()) {
        const searchTerm = search.trim();
        whereConditions[Op.or] = [
          {
            name: {
              [Op.iLike]: `%${searchTerm}%` // Recherche insensible à la casse
            }
          },
          {
            description: {
              [Op.iLike]: `%${searchTerm}%`
            }
          }
        ];
      }

      // Configuration du tri
      const allowedSortFields = ['price', 'name', 'ratingAvg', 'createdAt', 'stock'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
      const sortDirection = ['asc', 'desc'].includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : 'desc';

      // Exécution de la requête avec pagination
      const result = await Product.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'description']
          }
        ],
        attributes: {
          exclude: [] // Inclure tous les champs
        },
        order: [[sortField === 'createdAt' ? 'created_at' : sortField, sortDirection.toUpperCase()]],
        limit: limitNum,
        offset: offset,
        distinct: true // Important pour le count avec les JOINs
      });

      // Calcul de la pagination
      const totalPages = Math.ceil(result.count / limitNum);
      
      // Formatage de la réponse
      const formattedProducts = result.rows.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: parseFloat(product.price),
        stock: product.stock,
        images: product.images || [],
        tags: product.tags || [],
        isActive: product.isActive,
        ratingAvg: parseFloat(product.ratingAvg),
        ratingCount: product.ratingCount,
        createdAt: product.get('created_at'),
        updatedAt: product.get('updated_at'),
        category: product.category ? {
          id: product.category.id,
          name: product.category.name,
          description: product.category.description
        } : null
      }));

      res.status(200).json({
        success: true,
        data: {
          products: formattedProducts,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: result.count,
            pages: totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1
          },
          filters: {
            categoryId: categoryId || null,
            minPrice: minPrice ? parseFloat(minPrice) : null,
            maxPrice: maxPrice ? parseFloat(maxPrice) : null,
            search: search || null,
            sortBy: sortField,
            sortOrder: sortDirection,
            active: active === 'true'
          }
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des produits:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des produits',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * GET /api/products/:id - Détail complet d'un produit
   * 
   * Params: id (UUID du produit)
   * Returns: { product }
   */
  static async getProductById(req, res) {
    try {
      const { id } = req.params;

      // Validation de l'UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID de produit invalide'
        });
      }

      // Récupération du produit avec sa catégorie
      const product = await Product.findOne({
        where: { 
          id,
          isActive: true // Seuls les produits actifs sont visibles publiquement
        },
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'description']
          }
        ]
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Produit non trouvé ou inactif'
        });
      }

      // Formatage de la réponse
      const formattedProduct = {
        id: product.id,
        name: product.name,
        description: product.description,
        price: parseFloat(product.price),
        stock: product.stock,
        images: product.images || [],
        tags: product.tags || [],
        isActive: product.isActive,
        ratingAvg: parseFloat(product.ratingAvg),
        ratingCount: product.ratingCount,
        createdAt: product.get('created_at'),
        updatedAt: product.get('updated_at'),
        category: product.category ? {
          id: product.category.id,
          name: product.category.name,
          description: product.category.description
        } : null
      };

      res.status(200).json({
        success: true,
        data: {
          product: formattedProduct
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération du produit:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération du produit',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * GET /api/categories - Liste simple des catégories
   * 
   * Query params:
   * - includeProductCount: inclure le nombre de produits par catégorie (défaut: false)
   * 
   * Returns: { categories }
   */
  static async getCategories(req, res) {
    try {
      const { includeProductCount = 'false' } = req.query;
      const shouldIncludeCount = includeProductCount === 'true';

      // Configuration de base
      const queryOptions = {
        attributes: ['id', 'name', 'description', 'created_at', 'updated_at'],
        order: [['name', 'ASC']]
      };

      // Ajouter le comptage de produits si demandé
      if (shouldIncludeCount) {
        queryOptions.include = [
          {
            model: Product,
            as: 'products',
            attributes: [],
            where: { isActive: true },
            required: false // LEFT JOIN pour inclure les catégories sans produits
          }
        ];
        queryOptions.attributes.push([
          require('sequelize').fn('COUNT', require('sequelize').col('products.id')),
          'productCount'
        ]);
        queryOptions.group = ['Category.id'];
      }

      const categories = await Category.findAll(queryOptions);

      // Formatage de la réponse
      const formattedCategories = categories.map(category => {
        const formatted = {
          id: category.id,
          name: category.name,
          description: category.description,
          createdAt: category.get('created_at'),
          updatedAt: category.get('updated_at')
        };

        // Ajouter le comptage si demandé
        if (shouldIncludeCount) {
          formatted.productCount = parseInt(category.dataValues.productCount || 0, 10);
        }

        return formatted;
      });

      res.status(200).json({
        success: true,
        data: {
          categories: formattedCategories
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des catégories:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des catégories',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * GET /api/products/search/suggestions - Suggestions de recherche
   * 
   * Query params:
   * - q: terme de recherche (minimum 2 caractères)
   * - limit: nombre de suggestions (défaut: 5, max: 10)
   * 
   * Returns: { suggestions: [{ id, name, price, image }] }
   */
  static async getSearchSuggestions(req, res) {
    try {
      const { q, limit = 5 } = req.query;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Le terme de recherche doit contenir au moins 2 caractères'
        });
      }

      const limitNum = Math.min(10, Math.max(1, parseInt(limit, 10) || 5));
      const searchTerm = q.trim();

      const suggestions = await Product.findAll({
        where: {
          isActive: true,
          [Op.or]: [
            {
              name: {
                [Op.iLike]: `%${searchTerm}%`
              }
            },
            {
              description: {
                [Op.iLike]: `%${searchTerm}%`
              }
            }
          ]
        },
        attributes: ['id', 'name', 'price', 'images'],
        order: [['ratingAvg', 'DESC'], ['name', 'ASC']],
        limit: limitNum
      });

      const formattedSuggestions = suggestions.map(product => ({
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        image: product.images && product.images.length > 0 ? product.images[0] : null
      }));

      res.status(200).json({
        success: true,
        data: {
          suggestions: formattedSuggestions
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des suggestions:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des suggestions',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = CatalogController;