const express = require('express');
const OrderController = require('../controllers/orderController');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * Routes de gestion des commandes avec historique
 * FonctionnalitéHaute#1777 (machine à états) + FonctionnalitéHaute#1778 (POST /orders) + FonctionnalitéHaute#1779 (historique)
 * 
 * Base URL: /api/orders
 * Toutes les routes requièrent une authentification JWT
 * Sécurité : Les utilisateurs n'accèdent qu'à leurs propres commandes
 */

/**
 * @route   POST /api/orders
 * @desc    Créer une nouvelle commande depuis le panier utilisateur
 * @access  Private (JWT required)
 * @headers Authorization: Bearer <accessToken>
 * @body    {
 *            shippingAddress?: object,
 *            billingAddress?: object,
 *            paymentMethod?: string,
 *            notes?: string
 *          }
 * @returns {
 *            success: boolean,
 *            message: string,
 *            data: {
 *              orderId: string,
 *              id: string,
 *              status: "pending",
 *              totalAmount: number,
 *              itemsCount: number,
 *              items: array,
 *              availableTransitions: array,
 *              createdAt: datetime
 *            }
 *          }
 * 
 * Comportement:
 * - Copie tous les items du panier vers une nouvelle commande
 * - Calcule le montant total automatiquement
 * - Génère un orderId unique (ex: ORD-ABC123-DEF456)
 * - Initialise le statut à "pending"
 * - Vide le panier après création réussie
 * - Retourne les transitions disponibles depuis "pending"
 */
router.post('/', verifyToken, OrderController.createOrder);

/**
 * @route   GET /api/orders
 * @desc    Historique des commandes utilisateur (FonctionnalitéHaute#1779)
 * @access  Private (JWT required)
 * @headers Authorization: Bearer <accessToken>
 * @query   {
 *            status?: "pending"|"confirmed"|"processing"|"shipped"|"delivered",
 *            limit?: number (default: 50),
 *            offset?: number (default: 0),
 *            page?: number (default: 1)
 *          }
 * @returns {
 *            success: boolean,
 *            message: string,
 *            data: {
 *              orders: array,
 *              pagination: object
 *            }
 *          }
 * 
 * Spécification FonctionnalitéHaute#1779:
 * - Sous-tâche 1: find({ userId }) avec tri par date décroissante
 * - Sous-tâche 3: Détails complets (items avec product_id/quantity/price, total, status, dates)
 * - Pagination optionnelle avec limit/offset ou page
 * - Sécurité: Utilisateur n'accède qu'à ses propres commandes
 */
router.get('/', verifyToken, OrderController.getUserOrders);

/**
 * @route   GET /api/orders/statuses
 * @desc    Obtenir tous les statuts disponibles et leurs transitions
 * @access  Private (JWT required)
 * @headers Authorization: Bearer <accessToken>
 * @returns {
 *            success: boolean,
 *            data: {
 *              statuses: array,
 *              transitions: object,
 *              statusDescriptions: object
 *            }
 *          }
 * 
 * Utile pour construire des interfaces utilisateur avec les statuts valides
 */
router.get('/statuses', verifyToken, OrderController.getAvailableStatuses);

/**
 * @route   GET /api/orders/:orderId
 * @desc    Détails d'une commande spécifique (FonctionnalitéHaute#1779)
 * @access  Private (JWT required)
 * @headers Authorization: Bearer <accessToken>
 * @params  { orderId: string } (ex: ORD-ABC123-DEF456)
 * @returns {
 *            success: boolean,
 *            message: string,
 *            data: {
 *              orderId: string,
 *              id: string,
 *              status: string,
 *              totalAmount: number,
 *              items: array with product_id/quantity/price,
 *              shippingAddress: object,
 *              billingAddress: object,
 *              paymentMethod: string,
 *              trackingNumber: string,
 *              notes: string,
 *              availableTransitions: array,
 *              isModifiable: boolean,
 *              isCompleted: boolean,
 *              user: object,
 *              createdAt: datetime,
 *              updatedAt: datetime
 *            }
 *          }
 * 
 * Spécification FonctionnalitéHaute#1779:
 * - Sous-tâche 2: Récupérer order par id et vérifier userId === user.id du token
 * - Sous-tâche 3: Détails complets (items avec product_id/quantity/price, total, status, dates)
 * - Sécurité: Vérifie que la commande appartient à l'utilisateur connecté
 * - Retourne HTTP 404 si commande non trouvée ou n'appartient pas à l'utilisateur
 */
router.get('/:orderId', verifyToken, OrderController.getOrderById);

/**
 * @route   GET /api/orders/:orderId/transitions
 * @desc    Obtenir les transitions possibles pour une commande spécifique
 * @access  Private (JWT required)
 * @headers Authorization: Bearer <accessToken>
 * @params  { orderId: string }
 * @returns {
 *            success: boolean,
 *            data: {
 *              orderId: string,
 *              currentStatus: string,
 *              availableTransitions: array,
 *              allStatuses: array,
 *              isModifiable: boolean,
 *              isCompleted: boolean
 *            }
 *          }
 * 
 * Utile pour des interfaces utilisateur dynamiques qui s'adaptent
 * aux actions possibles selon l'état actuel de la commande
 */
router.get('/:orderId/transitions', verifyToken, OrderController.getOrderTransitions);

/**
 * @route   PUT /api/orders/:orderId/cancel
 * @desc    Annuler une commande (FonctionnalitéMoyenne#1782)
 * @access  Private (JWT required)
 * @headers Authorization: Bearer <accessToken>
 * @params  { orderId: string }
 * @body    { reason?: string } (Raison d'annulation optionnelle)
 * @returns {
 *            success: boolean,
 *            message: string,
 *            data: {
 *              orderId: string,
 *              previousStatus: string,
 *              currentStatus: "cancelled",
 *              cancelledAt: datetime,
 *              reason?: string,
 *              updatedAt: datetime
 *            }
 *          }
 * 
 * Spécification FonctionnalitéMoyenne#1782:
 * - Sous-tâche 1: Vérifier que status=pending avant d'autoriser (rejette sinon avec 400)
 * - Sous-tâche 2: Créer champ cancelledAt et passer status à 'cancelled'
 * 
 * Comportement:
 * - Seules les commandes en statut "pending" peuvent être annulées
 * - Met automatiquement à jour cancelledAt avec la date/heure actuelle
 * - Ajoute une note d'annulation avec la date et raison (si fournie)
 * - Retourne erreur 400 si tentative d'annulation sur statut != pending
 * 
 * Erreurs Possibles:
 * - 400: Commande ne peut pas être annulée (status != pending)
 * - 404: Commande non trouvée ou n'appartient pas à l'utilisateur
 * - 401: Token manquant/invalide
 */
router.put('/:orderId/cancel', verifyToken, OrderController.cancelOrder);

/**
 * @route   GET /api/orders/:orderId/tracking
 * @desc    Obtenir le suivi d'une commande (FonctionnalitéMoyenne#1782)
 * @access  Private (JWT required)
 * @headers Authorization: Bearer <accessToken>
 * @params  { orderId: string }
 * @returns {
 *            success: boolean,
 *            message: string,
 *            data: {
 *              orderId: string,
 *              status: string,
 *              createdAt: datetime,
 *              confirmedAt?: datetime,
 *              shippedAt?: datetime,
 *              deliveredAt?: datetime,
 *              cancelledAt?: datetime,
 *              trackingNumber?: string,
 *              progress: {
 *                isCompleted: boolean,
 *                isCancelled: boolean,
 *                currentStep: string,
 *                timeline: array
 *              }
 *            }
 *          }
 * 
 * Spécification FonctionnalitéMoyenne#1782:
 * - Sous-tâche 3: Retourner état actuel simplifié (pending/confirmed/processing/shipped/delivered/cancelled)
 * - Format: { status, createdAt, confirmedAt, processingAt, shippedAt, deliveredAt, cancelledAt }
 * 
 * Fonctionnalités Optionnelles S6:
 * - Timeline visuelle avec progression étape par étape
 * - Informations de statut enrichies
 * - Support du statut "cancelled" avec cancelledAt
 * 
 * Utilisation:
 * - Interface de suivi client simplifié
 * - État en temps réel de la commande
 * - Historique des transitions avec dates
 */
router.get('/:orderId/tracking', verifyToken, OrderController.getOrderTracking);

/**
 * @route   PUT /api/orders/:orderId/status
 * @desc    Mettre à jour le statut d'une commande (machine à états)
 * @access  Admin only (JWT + verifyAdmin) - action de gestion réservée aux admins
 * @headers Authorization: Bearer <accessToken>
 * @params  { orderId: string }
 * @body    { newStatus: "pending"|"confirmed"|"processing"|"shipped"|"delivered"|"cancelled" }
 * @returns {
 *            success: boolean,
 *            message: string,
 *            data: {
 *              orderId: string,
 *              previousStatus: string,
 *              currentStatus: string,
 *              availableTransitions: array,
 *              trackingNumber?: string,
 *              updatedAt: datetime
 *            }
 *          }
 * 
 * Machine à États Mise à Jour (FonctionnalitéMoyenne#1782):
 * - pending → confirmed | cancelled
 * - confirmed → processing
 * - processing → shipped
 * - shipped → delivered
 * - delivered → [] (état final)
 * - cancelled → [] (état final)
 * 
 * Comportement:
 * - Valide que la transition est autorisée selon la machine à états
 * - Rejette avec erreur 400 les transitions invalides
 * - Génère automatiquement un trackingNumber si passage à "shipped"
 * - Met à jour les dates de transition (confirmedAt, processingAt, shippedAt, deliveredAt, cancelledAt)
 * - Ajoute des notes automatiques pour certains statuts
 * 
* Erreurs Possibles:
 * - 400: Statut invalide ou transition non autorisée
 * - 404: Commande non trouvée
 * - 401: Token manquant/invalide
 * - 403: Accès refusé (privilèges admin requis) - fix sécurité FonctionnalitéHaute#427
 */
router.put('/:orderId/status', verifyToken, verifyAdmin, OrderController.updateOrderStatus);

module.exports = router;