const { body } = require('express-validator');

/**
 * Validations pour le système de logging d'événements
 */

/**
 * Validation pour POST /events/view
 * Body attendu: { product_id, session_id? } (utilisateur lu depuis le token)
 */
const validateLogView = [
  body('product_id')
    .exists({ checkFalsy: true })
    .withMessage('product_id est obligatoire')
    .bail()
    .isUUID(4)
    .withMessage('product_id doit être un UUID valide'),

  body('session_id')
    .optional()
    .isString()
    .isLength({ max: 255 })
    .withMessage('session_id ne peut pas dépasser 255 caractères')
];

/**
 * Validation pour POST /events/purchase
 * Body attendu: { product_ids: [], total_amount, session_id? } (utilisateur lu depuis le token)
 */
const validateLogPurchase = [
  body('product_ids')
    .exists()
    .withMessage('product_ids est obligatoire')
    .bail()
    .isArray({ min: 1 })
    .withMessage('product_ids doit être un tableau non vide'),

  body('product_ids.*')
    .isUUID(4)
    .withMessage('Chaque élément de product_ids doit être un UUID valide'),

  body('total_amount')
    .exists({ checkFalsy: false })
    .withMessage('total_amount est obligatoire')
    .bail()
    .isFloat({ min: 0 })
    .withMessage('total_amount doit être un nombre positif')
    .toFloat(),

  body('session_id')
    .optional()
    .isString()
    .isLength({ max: 255 })
    .withMessage('session_id ne peut pas dépasser 255 caractères')
];

module.exports = {
  validateLogView,
  validateLogPurchase
};