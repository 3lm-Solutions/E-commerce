const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { UserEvent, Product, User } = require('../../models');

class EventController {

    static async logView(req, res) {
        try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
            success: false,
            message: 'Données invalides',
            errors: errors.array()
            });
        }

        // Utilisateur issu du token (verifyToken), jamais du body
        const user_id = req.user.id;
        const { product_id, session_id } = req.body;

        // Vérifier que l'utilisateur existe
        const user = await User.findByPk(user_id);
        if (!user) {
            return res.status(404).json({
            success: false,
            message: 'Utilisateur non trouvé'
            });
        }

        // Vérifier que le produit existe
        const product = await Product.findByPk(product_id);
        if (!product) {
            return res.status(404).json({
            success: false,
            message: 'Produit non trouvé'
            });
        }

        const event = await UserEvent.create({
            id: uuidv4(),
            userId: user_id,
            eventType: 'view',
            productId: product_id,
            sessionId: session_id || null
        });

        res.status(201).json({
            success: true,
            message: 'Consultation enregistrée',
            data: {
            event: {
                id: event.id,
                userId: event.userId,
                eventType: event.eventType,
                productId: event.productId,
                sessionId: event.sessionId,
                timestamp: event.createdAt
            }
            }
        });

        } catch (error) {
        console.error('Erreur lors de l\'enregistrement de la consultation:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de l\'enregistrement de l\'événement',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
        }
    }


    static async logPurchase(req, res) {
        try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
            success: false,
            message: 'Données invalides',
            errors: errors.array()
            });
        }

        // Utilisateur issu du token (verifyToken), jamais du body
        const user_id = req.user.id;
        const { product_ids, total_amount, session_id } = req.body;

        // Vérifier que l'utilisateur existe
        const user = await User.findByPk(user_id);
        if (!user) {
            return res.status(404).json({
            success: false,
            message: 'Utilisateur non trouvé'
            });
        }

        // Dédupliquer les product_ids et vérifier qu'ils existent tous
        const uniqueProductIds = [...new Set(product_ids)];
        const foundProducts = await Product.findAll({
            where: { id: uniqueProductIds }
        });

        if (foundProducts.length !== uniqueProductIds.length) {
            const foundIds = new Set(foundProducts.map((p) => p.id));
            const missingIds = uniqueProductIds.filter((id) => !foundIds.has(id));
            return res.status(404).json({
            success: false,
            message: 'Certains produits n\'existent pas',
            missingProductIds: missingIds
            });
        }

        const event = await UserEvent.create({
            id: uuidv4(),
            userId: user_id,
            eventType: 'purchase',
            productIds: uniqueProductIds,
            totalAmount: total_amount,
            sessionId: session_id || null
        });

        res.status(201).json({
            success: true,
            message: 'Achat enregistré',
            data: {
            event: {
                id: event.id,
                userId: event.userId,
                eventType: event.eventType,
                productIds: event.productIds,
                totalAmount: parseFloat(event.totalAmount),
                sessionId: event.sessionId,
                timestamp: event.createdAt
            }
            }
        });

        } catch (error) {
        console.error('Erreur lors de l\'enregistrement de l\'achat:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de l\'enregistrement de l\'événement',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
        }
    }
    }

    module.exports = EventController;