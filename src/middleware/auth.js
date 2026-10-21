const jwt = require('jsonwebtoken');
const handleAuthFailure = require('./authResponse');

/**
 * Middleware d'authentification JWT
 * Vérifie le token et injecte req.user = { id, email, role }
 */
const verifyToken = (req, res, next) => {
  try {
    // Récupérer le token depuis le header Authorization
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return handleAuthFailure(
        req,
        res,
        401,
        'Token d\'accès requis. Format: Authorization: Bearer <token>'
      );
    }

    const token = authHeader.substring(7); // Retirer "Bearer "

    if (!token) {
      return handleAuthFailure(req, res, 401, 'Token manquant');
    }

    // Vérifier la signature JWT avec la clé secrète
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');

    // Injecter les informations utilisateur dans req.user
    req.user = {
      id: decoded.userId,    // UUID récupéré du token
      email: decoded.email,
      role: decoded.role || 'client'
    };

    // Validation que l'ID utilisateur est bien un UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.user.id)) {
      return handleAuthFailure(req, res, 401, 'Token invalide - ID utilisateur malformé');
    }

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return handleAuthFailure(req, res, 401, 'Token invalide - signature incorrecte');
    }
    if (error.name === 'TokenExpiredError') {
      return handleAuthFailure(req, res, 401, 'Token expiré');
    }

    console.error('Erreur middleware auth:', error);
    return handleAuthFailure(req, res, 401, 'Erreur d\'authentification');
  }
};

/**
 * Middleware pour vérifier le rôle admin
 */
const verifyAdmin = (req, res, next) => {
  if (!req.user) {
    return handleAuthFailure(req, res, 401, 'Authentification requise');
  }

  if (req.user.role !== 'admin') {
    return handleAuthFailure(req, res, 403, 'Accès refusé - privilèges admin requis');
  }

  next();
};

module.exports = {
  verifyToken,
  verifyAdmin
};