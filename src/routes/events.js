const express = require('express');
const EventController = require('../controllers/eventController');
const { validateLogView, validateLogPurchase } = require('../validators/eventValidator');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Authentification requise : l'utilisateur est lu depuis le token, pas depuis le body
router.post('/view', verifyToken, validateLogView, EventController.logView);

router.post('/purchase', verifyToken, validateLogPurchase, EventController.logPurchase);

module.exports = router;
