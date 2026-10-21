const express = require('express');
const { SHOP_POLICY, describeShopPolicy } = require('../config/shopPolicy');

const router = express.Router();

/**
 * @route   GET /api/shop/policy
 * @desc    Politique de livraison et de retour (frais de port, seuil de gratuité, délais, retours)
 * @access  Public
 * @returns { currency, shipping: { zone, fee, freeThreshold, dispatchDelay, deliveryDelay }, returns: { days, free }, text }
 */
router.get('/policy', (req, res) => {
  res.json({
    success: true,
    data: { ...SHOP_POLICY, text: describeShopPolicy() }
  });
});

module.exports = router;
