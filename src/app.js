require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');


// Importation des routes
const authRoutes = require('./routes/auth');
const catalogRoutes = require('./routes/catalog');
const adminRoutes = require('./routes/admin');
const reviewRoutes = require('./routes/reviews');
const cartRoutes = require('./routes/cart');
const wishlistRoutes = require('./routes/wishlist');
const orderRoutes = require('./routes/orders');
const recommendationRoutes = require('./routes/recommendations');
const eventRoutes = require('./routes/events');
const searchRoutes = require('./routes/search');
const paymentRoutes = require('./routes/payments');
const webhookRoutes = require('./routes/webhooks');
const internalChatbotRoutes = require('./routes/internalChatbotRoutes');

// Importation des middlewares
const rawBodyMiddleware = require('./middleware/rawBody');

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 3000;


/**
 * Configuration des middlewares globaux
 */
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Middleware pour raw body sur les webhooks (avant express.json())
app.use(rawBodyMiddleware);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de logging des requêtes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Servir les fichiers uploadés (images de produits) en statique
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

/**
 * Configuration des routes principales
 */

// Route de santé de l'API
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: '3LM-Solutions E-commerce API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Routes d'authentification
app.use('/api/auth', authRoutes);

// Routes du catalogue (publiques)
app.use('/api', catalogRoutes);

// Routes des avis (publiques et privées)
app.use('/api', reviewRoutes);

// Routes d'administration (admin uniquement)
app.use('/api/admin', adminRoutes);

// Routes du panier (authentification requise)
app.use('/api/cart', cartRoutes);

// Routes de la wishlist (authentification requise)
app.use('/api/wishlist', wishlistRoutes);

// Routes des commandes (authentification requise)
app.use('/api/orders', orderRoutes);

// Routes de recommandations (publiques)
app.use('/recommendations', recommendationRoutes);

//Routes de events
app.use('/events', eventRoutes);

// Routes de recherche (NLP + classique)
app.use('/search', searchRoutes);
// Routes des paiements (FonctionnalitéHaute#1780)
app.use('/api/payments', paymentRoutes);

// Routes des webhooks (FonctionnalitéHaute#1781)
app.use('/webhooks', webhookRoutes);

// Routes internes du chatbot IA (FonctionnalitéHaute#1671)
// ⚠️ Accès interne uniquement (Flask chatbot → Node, réseau local).
// En production : restreindre l'accès (clé interne partagée ou IP/réseau).
app.use('/api/internal', internalChatbotRoutes);

// Route de test de la base de données
app.get('/api/test-db', async (req, res) => {
  try {
    const { User } = require('../models');
    const count = await User.count();
    res.status(200).json({
      success: true,
      message: 'Connexion à la base de données réussie',
      data: {
        userCount: count,
        database: 'PostgreSQL (Neon)',
        orm: 'Sequelize + Prisma'
      }
    });
  } catch (error) {
    console.error('Erreur de connexion à la base de données:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur de connexion à la base de données',
      error: error.message
    });
  }
});

// Route de test du catalogue
app.get('/api/test-catalog', async (req, res) => {
  try {
    const { Product, Category } = require('../models');
    
    const categoryCount = await Category.count();
    const productCount = await Product.count();
    
    // Test simple d'un produit
    const firstProduct = await Product.findOne({
      attributes: ['id', 'name', 'price'],
      raw: true
    });
    
    res.status(200).json({
      success: true,
      message: 'Catalogue test réussi',
      data: {
        categoryCount,
        productCount,
        sampleProduct: firstProduct
      }
    });
  } catch (error) {
    console.error('Erreur test catalogue:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur test catalogue',
      error: error.message
    });
  }
});

// Gestion des routes non trouvées
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint non trouvé',
    availableEndpoints: [
      'GET /health',
      'GET /api/test-db',
      'GET /api/test-catalog',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/logout',
      'POST /api/auth/refresh', 
      'GET /api/auth/me',
      'GET /api/auth/verify',
      'GET /api/products',
      'GET /api/products/:id',
      'GET /api/products/:id/reviews',
      'POST /api/products/:id/reviews (AUTH)',
      'GET /api/categories',
      'GET /api/admin/products (ADMIN)',
      'POST /api/admin/products (ADMIN)',
      'PUT /api/admin/products/:id (ADMIN)',
      'DELETE /api/admin/products/:id (ADMIN)',
      'GET /api/cart',
      'POST /api/cart/add',
      'PUT /api/cart/update',
      'DELETE /api/cart/remove',
      'DELETE /api/cart/clear',
      'GET /api/wishlist',
      'POST /api/wishlist',
      'DELETE /api/wishlist/:productId',
      'DELETE /api/wishlist',
      'GET /api/wishlist/check/:productId',
      'GET /recommendations/similar/:product_id',
      'POST /events/view',
      'POST /events/purchase',
      'GET /recommendations/for-you',
      'POST /search/nlp',
      'GET /search',
      'POST /api/payments/create-intent (AUTH)',
      'GET /api/payments/config',
      'POST /api/payments/webhook',
      'POST /webhooks/stripe'
    ]
  });
});

// Middleware global de gestion d'erreurs
app.use((error, req, res, next) => {
  console.error('Erreur serveur:', error);
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

/**
 * Démarrage du serveur
 */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║        3LM-Solutions E-commerce        ║
║              API Server                ║
╠════════════════════════════════════════╣
║ Port: ${PORT.toString().padEnd(30)} ║
║ Environment: ${(process.env.NODE_ENV || 'development').padEnd(21)} ║
║ Database: PostgreSQL (Neon)           ║
║ ORM: Sequelize + Prisma                ║
╚════════════════════════════════════════╝
    `);
    
    console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
    console.log(`🔗 API Health check: http://localhost:${PORT}/health`);
    console.log(`🔑 Authentication endpoint: http://localhost:${PORT}/api/auth`);
    console.log(`📦 Catalog endpoint: http://localhost:${PORT}/api/products`);
    console.log(`🏷️ Categories endpoint: http://localhost:${PORT}/api/categories`);
    console.log(`⚡ Admin endpoint: http://localhost:${PORT}/api/admin (Admin only)`);
    console.log(`🛒 Cart endpoint: http://localhost:${PORT}/api/cart`);
  });
}

module.exports = app;
console.log("App.js reached the end");