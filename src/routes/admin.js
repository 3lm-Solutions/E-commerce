const express = require('express');
const AdminProductController = require('../controllers/adminProductController');
const AdminCategoryController = require('../controllers/adminCategoryController');
const AdminOrderController = require('../controllers/adminOrderController');
const AdminUserController = require('../controllers/adminUserController');
const AdminAnalyticsController = require('../controllers/adminAnalyticsController');
const UploadController = require('../controllers/uploadController');
const { upload } = require('../config/multer');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * Routes d'administration des produits
 * 
 * Base URL: /api/admin
 * Toutes les routes nécessitent l'authentification admin
 */

// Middleware global pour toutes les routes admin
router.use(verifyToken); // Vérification du token JWT
router.use(verifyAdmin); // Vérification du rôle admin

/**
 * @route   GET /api/admin/products
 * @desc    Liste des produits pour admin (inclut les inactifs si demandé)
 * @access  Admin only
 * @query   { includeInactive?: boolean }
 * @returns { products: [], stats: { total, active, inactive } }
 */
router.get('/products', AdminProductController.getAdminProducts);

/**
 * @route   POST /api/admin/products
 * @desc    Créer un nouveau produit
 * @access  Admin only
 * @body    { name, description, price, categoryId, stock?, images?, tags?, isActive? }
 * @returns { product } avec status 201
 */
router.post('/products', 
  AdminProductController.validateCreateProduct,
  AdminProductController.createProduct
);

/**
 * @route   PUT /api/admin/products/:id
 * @desc    Modifier un produit existant
 * @access  Admin only
 * @params  { id: UUID }
 * @body    { name?, description?, price?, categoryId?, stock?, images?, tags?, isActive? }
 * @returns { product }
 */
router.put('/products/:id', 
  AdminProductController.validateUpdateProduct,
  AdminProductController.updateProduct
);

/**
 * @route   DELETE /api/admin/products/:id
 * @desc    Supprimer un produit
 * @access  Admin only
 * @params  { id: UUID }
 * @returns { message, deletedProduct }
 */
router.delete('/products/:id', AdminProductController.deleteProduct);

/**
 * @route   POST /api/admin/products/upload-image
 * @desc    Uploader une image de produit (multipart/form-data, champ "image")
 * @access  Admin only
 * @returns { url } avec status 200
 */
router.post(
  '/products/upload-image',
  upload.single('image'),
  UploadController.uploadProductImage
);

/**
 * @route   GET /api/admin/categories
 * @desc    Liste toutes les catégories avec le nombre de produits
 * @access  Admin only
 * @returns { categories: [{ id, name, description, createdAt, updatedAt, productCount }] }
 */
router.get('/categories', AdminCategoryController.getCategories);

/**
 * @route   POST /api/admin/categories
 * @desc    Créer une nouvelle catégorie
 * @access  Admin only
 * @body    { name, description? }
 * @returns { category } avec status 201
 */
router.post(
  '/categories',
  AdminCategoryController.validateCreateCategory,
  AdminCategoryController.createCategory
);

/**
 * @route   PUT /api/admin/categories/:id
 * @desc    Modifier une catégorie existante
 * @access  Admin only
 * @params  { id: UUID }
 * @body    { name?, description? }
 * @returns { category }
 */
router.put(
  '/categories/:id',
  AdminCategoryController.validateUpdateCategory,
  AdminCategoryController.updateCategory
);

/**
 * @route   DELETE /api/admin/categories/:id
 * @desc    Supprimer une catégorie (bloquée si des produits y sont liés)
 * @access  Admin only
 * @params  { id: UUID }
 * @returns { message, deletedCategory } avec status 200, ou 409 si des produits sont liés
 */
router.delete('/categories/:id', AdminCategoryController.deleteCategory);

/**
 * @route   GET /api/admin/orders
 * @desc    Liste toutes les commandes de tous les utilisateurs (FonctionnalitéHaute#427)
 * @access  Admin only
 * @query   { status?, startDate?, endDate?, userId?, userEmail?, page?, limit? }
 * @returns { success, data: { orders: [], pagination: { page, limit, total, totalPages } } }
 */
router.get('/orders', AdminOrderController.getAllOrders);

/**
 * @route   GET /api/admin/orders/:orderId
 * @desc    Détail complet d'une commande (accès admin, sans filtre userId) (FonctionnalitéHaute#427)
 * @access  Admin only
 * @params  { orderId: string }
 * @returns { success, data: { orderId, status, totalAmount, items, shippingAddress,
 *            billingAddress, paymentMethod, trackingNumber, notes, user, createdAt, ... } }
 */
router.get('/orders/:orderId', AdminOrderController.getOrderByIdAdmin);

/**
 * @route   PUT /api/admin/orders/:orderId/status
 * @desc    Changer le statut de N'IMPORTE QUELLE commande (FonctionnalitéHaute#427)
 * @access  Admin only
 * @params  { orderId: string }
 * @body    { newStatus: "pending"|"confirmed"|"processing"|"shipped"|"delivered"|"cancelled" }
 * @returns { success, data: { orderId, previousStatus, currentStatus, availableTransitions, ... } }
 */
router.put('/orders/:orderId/status', AdminOrderController.updateOrderStatusAdmin);

/**
 * @route   GET /api/admin/users
 * @desc    Liste tous les clients (FonctionnalitéMoyenne#428)
 * @access  Admin only
 * @query   { search?, page?, limit? }
 * @returns { success, data: { users: [{ id, name, email, createdAt, isActive, ordersCount }], pagination } }
 */
router.get('/users', AdminUserController.getAllUsers);

/**
 * @route   GET /api/admin/users/:userId
 * @desc    Profil détaillé d'un client (FonctionnalitéMoyenne#428)
 * @access  Admin only
 * @params  { userId: string }
 * @returns { success, data: { user, orders: [], totalSpent, ordersCount } }
 */
router.get('/users/:userId', AdminUserController.getUserById);

/**
 * @route   PUT /api/admin/users/:userId/deactivate
 * @access  Admin only
 * @params  { userId: string }
 * @returns { success, message, data: { userId, isActive: false } }
 */
router.put('/users/:userId/deactivate', AdminUserController.deactivateUser);

/**
 * @route   PUT /api/admin/users/:userId/reactivate
 * @desc    Réactiver un compte client (FonctionnalitéMoyenne#428)
 * @access  Admin only
 * @params  { userId: string }
 * @returns { success, message, data: { userId, isActive: true } }
 */
router.put('/users/:userId/reactivate', AdminUserController.reactivateUser);

/**
 * @route   GET /api/admin/analytics/revenue
 * @desc    Évolution du chiffre d'affaires (série temporelle continue)
 * @access  Admin only
 * @query   { period?: "7d"|"30d"|"12m" } (défaut: 7d)
 * @returns { success, data: { period, series: [{ date, revenue, ordersCount }], totalRevenue, totalOrders } }
 */
router.get('/analytics/revenue', AdminAnalyticsController.getRevenueAnalytics);

/**
 * @route   GET /api/admin/analytics/top-products
 * @desc    Top produits les plus vendus (agrégation côté Node sur le JSONB items)
 * @access  Admin only
 * @query   { limit?: number } (défaut: 10, max: 50)
 * @returns { success, data: { products: [{ productId, name, quantitySold, revenue }] } }
 */
router.get('/analytics/top-products', AdminAnalyticsController.getTopProducts);

/**
 * @route   GET /api/admin/dashboard/metrics
 * @desc    KPIs précis du tableau de bord (FonctionnalitéHaute#429)
 * @access  Admin only
 * @returns { success, data: { totalRevenue, todayOrdersCount, newCustomersCount,
 *            outOfStockCount, lowStockProducts: [{ id, name, stock }] } }
 */
router.get('/dashboard/metrics', AdminAnalyticsController.getDashboardMetrics);

/**
 * @route   GET /api/admin/dashboard/recent-orders
 * @desc    10 dernières commandes (tous utilisateurs) (FonctionnalitéHaute#429)
 * @access  Admin only
 * @returns { success, data: { orders: Array } } (format cohérent avec AdminOrderController.formatOrder)
 */
router.get('/dashboard/recent-orders', AdminAnalyticsController.getRecentOrders);

module.exports = router;
