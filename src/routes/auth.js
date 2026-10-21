const express = require('express');
const AuthController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Routes d'authentification selon CDC 01_Auth_Catalogue
 * 
 * Base URL: /api/auth
 */

/**
 * @route   POST /api/auth/register
 * @desc    Inscription d'un nouvel utilisateur
 * @access  Public
 * @body    { name: string, email: string, password: string } (un champ role est ignoré : toujours « client »)
 * @returns { user, accessToken, refreshToken }
 */
router.post('/register', 
  AuthController.validateRegister,
  AuthController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Connexion utilisateur
 * @access  Public
 * @body    { email: string, password: string }
 * @returns { user, accessToken, refreshToken }
 */
router.post('/login', 
  AuthController.validateLogin,
  AuthController.login
);

/**
 * @route   POST /api/auth/logout
 * @desc    Déconnexion utilisateur (invalidation refresh token)
 * @access  Public
 * @body    { refreshToken: string }
 * @returns { message }
 */
router.post('/logout', AuthController.logout);

/**
 * @route   POST /api/auth/refresh
 * @desc    Renouvellement de l'access token
 * @access  Public
 * @body    { refreshToken: string }
 * @returns { accessToken, refreshToken }
 */
router.post('/refresh', AuthController.refresh);

/**
 * @route   GET /api/auth/me
 * @desc    Récupération du profil utilisateur connecté
 * @access  Private (JWT required)
 * @headers Authorization: Bearer <accessToken>
 * @returns { user }
 */
router.get('/me', verifyToken, AuthController.me);

/**
 * @route   GET /api/auth/verify
 * @desc    Vérification de la validité du token (pour debug)
 * @access  Private (JWT required)
 * @returns { valid: true, user }
 */
router.get('/verify', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Token valide',
    data: {
      valid: true,
      user: {
        id: req.user.userId,
        email: req.user.email,
        role: req.user.role
      }
    }
  });
});

module.exports = router;