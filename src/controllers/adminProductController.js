const { Product, Category } = require('../../models');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

/**
 * Contrôleur d'administration des produits
 * 
 * Routes ADMIN uniquement (middleware verifyAdmin requis):
 * - POST /admin/products : Créer un produit
 * - PUT /admin/products/:id : Modifier un produit
 * - DELETE /admin/products/:id : Supprimer un produit
 */

class AdminProductController {

  /**
   * POST /admin/products - Créer un nouveau produit
   * 
   * Requires: Admin authentication
   * Body: { name, description, price, categoryId, stock, images?, tags? }
   * Returns: { product } avec status 201
   */
  static async createProduct(req, res) {
    try {
      // Validation des erreurs
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données invalides',
          errors: errors.array()
        });
      }

      const {
        name,
        description,
        price,
        categoryId,
        stock = 0,
        images = [],
        tags = [],
        isActive = true
      } = req.body;

      // Vérifier que la catégorie existe
      const category = await Category.findByPk(categoryId);
      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Catégorie non trouvée',
          error: `La catégorie avec l'ID ${categoryId} n'existe pas`
        });
      }

      // Créer le produit avec un UUID
      const productData = {
        id: uuidv4(),
        name,
        description,
        price: parseFloat(price),
        categoryId,
        stock: parseInt(stock, 10),
        images: Array.isArray(images) ? images : [],
        tags: Array.isArray(tags) ? tags : [],
        isActive: Boolean(isActive),
        ratingAvg: 0.00,
        ratingCount: 0
      };

      const product = await Product.create(productData);

      // Récupérer le produit créé avec sa catégorie
      const createdProduct = await Product.findByPk(product.id, {
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'description']
          }
        ]
      });

      // Formater la réponse
      const formattedProduct = {
        id: createdProduct.id,
        name: createdProduct.name,
        description: createdProduct.description,
        price: parseFloat(createdProduct.price),
        stock: createdProduct.stock,
        images: createdProduct.images || [],
        tags: createdProduct.tags || [],
        isActive: createdProduct.isActive,
        ratingAvg: parseFloat(createdProduct.ratingAvg),
        ratingCount: createdProduct.ratingCount,
        createdAt: createdProduct.get('created_at'),
        updatedAt: createdProduct.get('updated_at'),
        category: createdProduct.category ? {
          id: createdProduct.category.id,
          name: createdProduct.category.name,
          description: createdProduct.category.description
        } : null
      };

      res.status(201).json({
        success: true,
        message: 'Produit créé avec succès',
        data: {
          product: formattedProduct
        }
      });

    } catch (error) {
      console.error('Erreur lors de la création du produit:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la création du produit',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * PUT /admin/products/:id - Modifier un produit existant
   * 
   * Requires: Admin authentication
   * Params: { id: UUID }
   * Body: { name?, description?, price?, categoryId?, stock?, images?, tags?, isActive? }
   * Returns: { product }
   */
  static async updateProduct(req, res) {
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

      // Validation des erreurs de données
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données invalides',
          errors: errors.array()
        });
      }

      // Trouver le produit à modifier
      const product = await Product.findByPk(id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        });
      }

      const {
        name,
        description,
        price,
        categoryId,
        stock,
        images,
        tags,
        isActive
      } = req.body;

      // Si categoryId est fourni, vérifier qu'elle existe
      if (categoryId && categoryId !== product.categoryId) {
        const category = await Category.findByPk(categoryId);
        if (!category) {
          return res.status(400).json({
            success: false,
            message: 'Catégorie non trouvée',
            error: `La catégorie avec l'ID ${categoryId} n'existe pas`
          });
        }
      }

      // Construire l'objet de mise à jour (seulement les champs fournis)
      const updateData = {};
      
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (price !== undefined) updateData.price = parseFloat(price);
      if (categoryId !== undefined) updateData.categoryId = categoryId;
      if (stock !== undefined) updateData.stock = parseInt(stock, 10);
      if (images !== undefined) updateData.images = Array.isArray(images) ? images : [];
      if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);

      // Mettre à jour le produit
      await product.update(updateData);

      // Récupérer le produit mis à jour avec sa catégorie
      const updatedProduct = await Product.findByPk(id, {
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'description']
          }
        ]
      });

      // Formater la réponse
      const formattedProduct = {
        id: updatedProduct.id,
        name: updatedProduct.name,
        description: updatedProduct.description,
        price: parseFloat(updatedProduct.price),
        stock: updatedProduct.stock,
        images: updatedProduct.images || [],
        tags: updatedProduct.tags || [],
        isActive: updatedProduct.isActive,
        ratingAvg: parseFloat(updatedProduct.ratingAvg),
        ratingCount: updatedProduct.ratingCount,
        createdAt: updatedProduct.get('created_at'),
        updatedAt: updatedProduct.get('updated_at'),
        category: updatedProduct.category ? {
          id: updatedProduct.category.id,
          name: updatedProduct.category.name,
          description: updatedProduct.category.description
        } : null
      };

      res.status(200).json({
        success: true,
        message: 'Produit mis à jour avec succès',
        data: {
          product: formattedProduct
        }
      });

    } catch (error) {
      console.error('Erreur lors de la mise à jour du produit:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la mise à jour du produit',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * DELETE /admin/products/:id - Supprimer un produit
   * 
   * Requires: Admin authentication
   * Params: { id: UUID }
   * Returns: { message }
   */
  static async deleteProduct(req, res) {
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

      // Trouver le produit à supprimer
      const product = await Product.findByPk(id, {
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name']
          }
        ]
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        });
      }

      // Sauvegarder les infos du produit avant suppression (pour le log)
      const productInfo = {
        id: product.id,
        name: product.name,
        category: product.category?.name || 'Sans catégorie'
      };

      // Supprimer le produit
      await product.destroy();

      res.status(200).json({
        success: true,
        message: `Produit "${productInfo.name}" supprimé avec succès`,
        data: {
          deletedProduct: {
            id: productInfo.id,
            name: productInfo.name,
            category: productInfo.category
          }
        }
      });

    } catch (error) {
      console.error('Erreur lors de la suppression du produit:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la suppression du produit',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * GET /admin/products - Liste des produits avec infos admin
   * 
   * Requires: Admin authentication
   * Query params: { includeInactive? }
   * Returns: { products } avec produits inactifs si demandé
   */
  static async getAdminProducts(req, res) {
    try {
      const { includeInactive = 'false' } = req.query;
      const shouldIncludeInactive = includeInactive === 'true';

      // Conditions WHERE basées sur les paramètres
      const whereConditions = shouldIncludeInactive ? {} : { isActive: true };

      const products = await Product.findAll({
        where: whereConditions,
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'description']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      const formattedProducts = products.map(product => ({
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

      const activeCount = formattedProducts.filter(p => p.isActive).length;
      const inactiveCount = formattedProducts.filter(p => !p.isActive).length;

      res.status(200).json({
        success: true,
        data: {
          products: formattedProducts,
          stats: {
            total: formattedProducts.length,
            active: activeCount,
            inactive: inactiveCount,
            includeInactive: shouldIncludeInactive
          }
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des produits admin:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des produits',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

/**
 * Middlewares de validation pour les routes d'administration
 */
AdminProductController.validateCreateProduct = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Le nom du produit doit contenir entre 2 et 200 caractères'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('La description ne peut pas dépasser 2000 caractères'),
  body('price')
    .isNumeric({ min: 0 })
    .withMessage('Le prix doit être un nombre positif')
    .custom((value) => {
      if (parseFloat(value) < 0) {
        throw new Error('Le prix ne peut pas être négatif');
      }
      return true;
    }),
  body('categoryId')
    .isUUID()
    .withMessage('L\'ID de catégorie doit être un UUID valide'),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Le stock doit être un nombre entier positif'),
  body('images')
    .optional()
    .isArray()
    .withMessage('Les images doivent être un tableau')
    .custom((value) => {
      if (Array.isArray(value) && value.length > 10) {
        throw new Error('Maximum 10 images par produit');
      }
      return true;
    }),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Les tags doivent être un tableau')
    .custom((value) => {
      if (Array.isArray(value) && value.length > 20) {
        throw new Error('Maximum 20 tags par produit');
      }
      return true;
    }),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive doit être un booléen')
];

AdminProductController.validateUpdateProduct = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Le nom du produit doit contenir entre 2 et 200 caractères'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('La description ne peut pas dépasser 2000 caractères'),
  body('price')
    .optional()
    .isNumeric({ min: 0 })
    .withMessage('Le prix doit être un nombre positif'),
  body('categoryId')
    .optional()
    .isUUID()
    .withMessage('L\'ID de catégorie doit être un UUID valide'),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Le stock doit être un nombre entier positif'),
  body('images')
    .optional()
    .isArray()
    .withMessage('Les images doivent être un tableau'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Les tags doivent être un tableau'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive doit être un booléen')
];

module.exports = AdminProductController;