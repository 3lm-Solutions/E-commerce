'use strict';

const express = require('express');
const { getProductCatalogForChatbot } = require('../services/productCatalogService');
const { describeShopPolicy } = require('../config/shopPolicy');

const router = express.Router();

/**
 * Routes internes pour le chatbot IA (FonctionnalitéHaute #1671)
 *
 * Base URL: /api/internal
 *
 * ⚠️ SÉCURITÉ — Accès interne uniquement :
 * Ces routes ne sont PAS authentifiées (pas de JWT). Elles sont destinées à être
 * appelées uniquement en interne (backend Flask chatbot → backend Node, même
 * serveur/réseau local). Dans un contexte de production, il faudrait restreindre
 * l'accès, par exemple :
 *   - vérifier une clé interne partagée (header X-Internal-Key) ;
 *   - ou limiter par IP/réseau (allowlist) ;
 *   - ou exiger une authentification mutuelle (mTLS).
 */

/**
 * @route   GET /api/internal/chatbot-catalog
 * @desc    Expose le catalogue produits déjà formaté pour le chatbot IA
 * @access  Interne (Flask chatbot → Node)
 * @returns { catalogue: string, policy: string } Texte formaté du catalogue et
 *          politique de livraison et de retour (français)
 */
router.get('/chatbot-catalog', async (req, res) => {
  try {
    // Réutilise la logique déjà existante et testée (FonctionnalitéHaute #1670)
    const catalogue = await getProductCatalogForChatbot();
    // Même texte que GET /api/shop/policy : le chatbot ne peut pas contredire le site
    res.status(200).json({ catalogue, policy: describeShopPolicy() });
  } catch (error) {
    console.error('Erreur lors de la génération du catalogue chatbot:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du catalogue pour le chatbot',
      error: error.message
    });
  }
});

module.exports = router;

