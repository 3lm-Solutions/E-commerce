const express = require('express');
const CartController = require('../controllers/cartController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Routes du panier selon FonctionnalitéHaute#1774
 * 
 * Base URL: /api/cart (contrat : cahier 02, §2.1)
 * Toutes les routes requièrent une authentification JWT (middleware verifyToken)
 */

/**
 * @route   GET /api/cart
 * @desc    Récupérer le panier de l'utilisateur connecté
 * @access  Private (JWT required)
 * @headers Authorization: Bearer <accessToken>
 * @returns { userId: UUID, items: [], createdAt: Date, updatedAt: Date }
 * 
 * Comportement:
 * - Si l'utilisateur n'a pas de panier, en crée un vide automatiquement
 * - Retourne tous les articles (CartItem) avec leurs détails
 * - Trie les articles par date de création (plus anciens en premier)
 */
router.get('/', verifyToken, CartController.getCart);

/**
 * @route   POST /api/cart/items
 * @desc    Ajouter un produit au panier
 * @access  Private (JWT required)
 * @headers Authorization: Bearer <accessToken>
 * @body    { product_id: UUID, quantity: number }
 * @returns { userId: UUID, items: [], createdAt: Date, updatedAt: Date }
 * 
 * Comportement:
 * - Valide que product_id est un UUID valide
 * - Valide que quantity est un entier > 0
 * - Si le produit existe déjà dans le panier, incrémente la quantité
 * - Si le produit n'existe pas, l'ajoute avec la quantité spécifiée
 * - Crée automatiquement un panier si l'utilisateur n'en a pas
 * 
 * Erreurs possibles:
 * - 400: Product ID invalide ou quantité invalide
 * - 401: Token manquant ou invalide
 * - 500: Erreur serveur
 */
router.post('/items', verifyToken, CartController.addItemToCart);

/**
 * @route   PUT /api/cart/items/:product_id
 * @desc    Modifier la quantité d'un produit spécifique dans le panier
 * @access  Private (JWT required)
 * @headers Authorization: Bearer <accessToken>
 * @params  { product_id: UUID }
 * @body    { quantity: number }
 * @returns { userId: UUID, items: [], createdAt: Date, updatedAt: Date }
 * 
 * Comportement:
 * - Valide que product_id est un UUID valide
 * - Valide que quantity est un entier > 0
 * - Met à jour la quantité du produit spécifié
 * - Le produit doit exister dans le panier
 * 
 * Erreurs possibles:
 * - 400: Product ID invalide ou quantité invalide
 * - 401: Token manquant ou invalide
 * - 404: Panier non trouvé ou produit non trouvé dans le panier
 * - 500: Erreur serveur
 */
router.put('/items/:product_id', verifyToken, CartController.updateItemQuantity);

/**
 * @route   DELETE /api/cart/items/:product_id
 * @desc    Retirer un produit spécifique du panier
 * @access  Private (JWT required)
 * @headers Authorization: Bearer <accessToken>
 * @params  { product_id: UUID }
 * @returns { userId: UUID, items: [], createdAt: Date, updatedAt: Date }
 * 
 * Comportement:
 * - Valide que product_id est un UUID valide
 * - Supprime complètement le produit du panier (peu importe la quantité)
 * - Le produit doit exister dans le panier
 * 
 * Erreurs possibles:
 * - 400: Product ID invalide
 * - 401: Token manquant ou invalide
 * - 404: Panier non trouvé ou produit non trouvé dans le panier
 * - 500: Erreur serveur
 */
router.delete('/items/:product_id', verifyToken, CartController.removeItemFromCart);

/**
 * @route   DELETE /api/cart
 * @desc    Vider complètement le panier de l'utilisateur connecté
 * @access  Private (JWT required)
 * @headers Authorization: Bearer <accessToken>
 * @returns { userId: UUID, items: [], createdAt: Date, updatedAt: Date }
 * 
 * Comportement:
 * - Supprime tous les articles (CartItem) du panier
 * - Le panier (Cart) reste existant mais vide
 * - Si l'utilisateur n'a pas de panier, en crée un vide
 * 
 * Erreurs possibles:
 * - 401: Token manquant ou invalide
 * - 500: Erreur serveur
 */
router.delete('/', verifyToken, CartController.clearCart);

/**
 * Anciennes routes, conservées comme alias (dépréciées) : utiliser les routes
 * /api/cart/items et DELETE /api/cart du cahier des charges (02, §2.1).
 */
router.post('/add', verifyToken, CartController.addItemToCart);
router.put('/update/:product_id', verifyToken, CartController.updateItemQuantity);
router.delete('/remove/:product_id', verifyToken, CartController.removeItemFromCart);
router.delete('/clear', verifyToken, CartController.clearCart);

module.exports = router;