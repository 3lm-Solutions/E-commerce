const { Product, Category } = require('../../models');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { Sequelize } = require('sequelize');

/**
 * Contrôleur d'administration des catégories
 * 
 * Routes ADMIN uniquement (middleware verifyAdmin requis):
 * - GET    /admin/categories : Liste des catégories avec comptage produits
 * - POST   /admin/categories : Créer une catégorie
 * - PUT    /admin/categories/:id : Modifier une catégorie
 * - DELETE /admin/categories/:id : Supprimer une catégorie
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class AdminCategoryController {

  /**
   * GET /admin/categories - Liste toutes les catégories avec nombre de produits
   * 
   * Requires: Admin authentication
   * Returns: { categories: [{ id, name, description, createdAt, updatedAt, productCount }] }
   */
  static async getCategories(req, res) {
    try {
      const categories = await Category.findAll({
        attributes: [
          'id',
          'name',
          'description',
          'created_at',
          'updated_at',
          [
            Sequelize.fn('COUNT', Sequelize.col('products.id')),
            'productCount'
          ]
        ],
        include: [
          {
            model: Product,
            as: 'products',
            attributes: [],
            required: false // LEFT JOIN pour inclure les catégories sans produits
          }
        ],
        group: ['Category.id'],
        order: [['name', 'ASC']]
      });

      const formattedCategories = categories.map(category => ({
        id: category.id,
        name: category.name,
        description: category.description,
        createdAt: category.get('created_at'),
        updatedAt: category.get('updated_at'),
        productCount: parseInt(category.dataValues.productCount || 0, 10)
      }));

      res.status(200).json({
        success: true,
        data: {
          categories: formattedCategories
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des catégories admin:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des catégories',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * POST /admin/categories - Créer une nouvelle catégorie
   * 
   * Requires: Admin authentication
   * Body: { name, description? }
   * Returns: { category } avec status 201
   */
  static async createCategory(req, res) {
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

      const { name, description } = req.body;

      const category = await Category.create({
        id: uuidv4(),
        name,
        description: description || null
      });

      const formattedCategory = {
        id: category.id,
        name: category.name,
        description: category.description,
        createdAt: category.get('created_at'),
        updatedAt: category.get('updated_at'),
        productCount: 0
      };

      res.status(201).json({
        success: true,
        message: 'Catégorie créée avec succès',
        data: {
          category: formattedCategory
        }
      });

    } catch (error) {
      // Gestion spécifique de la contrainte unique (nom déjà utilisé)
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          message: 'Ce nom de catégorie existe déjà'
        });
      }

      console.error('Erreur lors de la création de la catégorie:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la création de la catégorie',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * PUT /admin/categories/:id - Modifier une catégorie existante
   * 
   * Requires: Admin authentication
   * Params: { id: UUID }
   * Body: { name?, description? }
   * Returns: { category }
   */
  static async updateCategory(req, res) {
    try {
      const { id } = req.params;

      // Validation de l'UUID
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID de catégorie invalide'
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

      // Trouver la catégorie à modifier
      const category = await Category.findByPk(id);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Catégorie non trouvée'
        });
      }

      const { name, description } = req.body;

      // Construire l'objet de mise à jour (seulement les champs fournis)
      const updateData = {};

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      // Mettre à jour la catégorie
      await category.update(updateData);

      const updatedCategory = await Category.findByPk(id);

      const formattedCategory = {
        id: updatedCategory.id,
        name: updatedCategory.name,
        description: updatedCategory.description,
        createdAt: updatedCategory.get('created_at'),
        updatedAt: updatedCategory.get('updated_at')
      };

      res.status(200).json({
        success: true,
        message: 'Catégorie mise à jour avec succès',
        data: {
          category: formattedCategory
        }
      });

    } catch (error) {
      // Gestion spécifique de la contrainte unique (nom déjà utilisé)
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          message: 'Ce nom de catégorie existe déjà'
        });
      }

      console.error('Erreur lors de la mise à jour de la catégorie:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la mise à jour de la catégorie',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * DELETE /admin/categories/:id - Supprimer une catégorie
   * 
   * Requires: Admin authentication
   * Params: { id: UUID }
   * Returns: { message } avec status 200, ou 409 si des produits sont liés
   */
  static async deleteCategory(req, res) {
    try {
      const { id } = req.params;

      // Validation de l'UUID
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID de catégorie invalide'
        });
      }

      // Trouver la catégorie à supprimer
      const category = await Category.findByPk(id);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Catégorie non trouvée'
        });
      }

      // Compter les produits liés à cette catégorie
      const productCount = await Product.count({ where: { categoryId: id } });

      // Si des produits sont liés, refuser la suppression (contrainte RESTRICT en DB)
      if (productCount > 0) {
        return res.status(409).json({
          success: false,
          message: `Impossible de supprimer : ${productCount} produit(s) sont liés à cette catégorie`,
          data: {
            productCount
          }
        });
      }

      // Supprimer la catégorie
      await category.destroy();

      res.status(200).json({
        success: true,
        message: `Catégorie "${category.name}" supprimée avec succès`,
        data: {
          deletedCategory: {
            id: category.id,
            name: category.name
          }
        }
      });

    } catch (error) {
      console.error('Erreur lors de la suppression de la catégorie:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la suppression de la catégorie',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

/**
 * Middlewares de validation pour les routes d'administration des catégories
 */
AdminCategoryController.validateCreateCategory = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom de la catégorie doit contenir entre 2 et 100 caractères'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La description ne peut pas dépasser 500 caractères')
];

AdminCategoryController.validateUpdateCategory = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom de la catégorie doit contenir entre 2 et 100 caractères'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La description ne peut pas dépasser 500 caractères')
];

module.exports = AdminCategoryController;
