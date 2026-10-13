/**
 * Messages d'erreur utilisateur-friendly pour remplacer les erreurs techniques
 * @param {Object} error - Objet d'erreur avec code et message
 * @returns {string} Message d'erreur compréhensible pour l'utilisateur
 */
export const getErrorMessage = (error) => {
  // Si l'erreur a un code spécifique, utiliser le mapping
  if (error?.code) {
    const messages = {
      'NETWORK_ERROR': 'Problème de connexion. Vérifiez votre connexion internet.',
      'INVALID_CREDENTIALS': 'Email ou mot de passe incorrect.',
      'USER_NOT_FOUND': 'Aucun compte trouvé avec cette adresse email.',
      'EMAIL_ALREADY_EXISTS': 'Cette adresse email est déjà utilisée.',
      'PRODUCT_OUT_OF_STOCK': 'Ce produit n\'est plus disponible en stock.',
      'PRODUCT_NOT_FOUND': 'Produit introuvable.',
      'CART_EMPTY': 'Votre panier est vide.',
      'CART_ITEM_NOT_FOUND': 'Article introuvable dans votre panier.',
      'INSUFFICIENT_STOCK': 'Stock insuffisant pour ce produit.',
      'PAYMENT_FAILED': 'Le paiement a échoué. Vérifiez vos informations de carte.',
      'PAYMENT_DECLINED': 'Votre paiement a été refusé. Contactez votre banque.',
      'ORDER_NOT_FOUND': 'Commande introuvable.',
      'UNAUTHORIZED': 'Vous devez être connecté pour effectuer cette action.',
      'FORBIDDEN': 'Vous n\'avez pas les permissions nécessaires.',
      'VALIDATION_ERROR': 'Certaines informations sont incorrectes.',
      'SERVER_ERROR': 'Erreur serveur temporaire. Réessayez dans quelques instants.',
      'TIMEOUT': 'La requête a pris trop de temps. Vérifiez votre connexion.',
      'RATE_LIMIT': 'Trop de tentatives. Patientez quelques minutes.',
      'FILE_TOO_LARGE': 'Le fichier est trop volumineux.',
      'INVALID_FILE_TYPE': 'Type de fichier non supporté.',
      'TOKEN_EXPIRED': 'Votre session a expiré. Reconnectez-vous.'
    };
    
    return messages[error.code] || 'Une erreur s\'est produite. Réessayez.';
  }
  
  // Si l'erreur a un message HTTP standard
  if (error?.status) {
    const httpMessages = {
      400: 'Requête invalide. Vérifiez les informations saisies.',
      401: 'Vous devez être connecté pour continuer.',
      403: 'Accès refusé. Permissions insuffisantes.',
      404: 'Élément introuvable.',
      408: 'Délai d\'attente dépassé. Réessayez.',
      409: 'Cette action entre en conflit avec des données existantes.',
      413: 'Fichier trop volumineux.',
      422: 'Données invalides. Vérifiez vos saisies.',
      429: 'Trop de tentatives. Patientez quelques minutes.',
      500: 'Erreur serveur. Réessayez plus tard.',
      502: 'Service temporairement indisponible.',
      503: 'Service en maintenance. Revenez plus tard.',
      504: 'Délai de réponse dépassé.'
    };
    
    return httpMessages[error.status] || 'Erreur réseau. Vérifiez votre connexion.';
  }
  
  // Si l'erreur a un message personnalisé lisible
  if (error?.message && typeof error.message === 'string') {
    // Éviter les messages techniques comme "fetch failed" 
    const technicalMessages = ['fetch failed', 'network error', 'cors', 'failed to fetch'];
    const isTechnical = technicalMessages.some(tech => 
      error.message.toLowerCase().includes(tech)
    );
    
    if (!isTechnical && error.message.length < 100) {
      return error.message;
    }
  }
  
  // Message par défaut
  return 'Une erreur s\'est produite. Réessayez dans quelques instants.';
};

/**
 * Messages de succès pour les actions utilisateur
 * @param {string} action - Type d'action effectuée
 * @returns {string} Message de succès approprié
 */
export const getSuccessMessage = (action) => {
  const messages = {
    'login': 'Connexion réussie ! Bon retour.',
    'register': 'Compte créé avec succès ! Bienvenue.',
    'logout': 'Déconnexion réussie. À bientôt !',
    'cart_add': 'Produit ajouté au panier.',
    'cart_remove': 'Produit retiré du panier.',
    'cart_update': 'Panier mis à jour.',
    'cart_clear': 'Panier vidé.',
    'wishlist_add': 'Produit ajouté à votre liste de souhaits.',
    'wishlist_remove': 'Produit retiré de votre liste de souhaits.',
    'order_created': 'Commande passée avec succès !',
    'payment_success': 'Paiement effectué avec succès.',
    'profile_updated': 'Profil mis à jour.',
    'password_changed': 'Mot de passe modifié avec succès.',
    'review_added': 'Avis ajouté avec succès.',
    'contact_sent': 'Message envoyé. Nous vous recontacterons bientôt.'
  };
  
  return messages[action] || 'Action effectuée avec succès.';
};

/**
 * Valide si une erreur nécessite une reconnexion
 * @param {Object} error - Objet d'erreur
 * @returns {boolean} True si l'utilisateur doit se reconnecter
 */
export const requiresReauth = (error) => {
  const reAuthCodes = ['TOKEN_EXPIRED', 'UNAUTHORIZED', 'INVALID_TOKEN'];
  const reAuthStatuses = [401];
  
  return reAuthCodes.includes(error?.code) || 
         reAuthStatuses.includes(error?.status) ||
         (typeof error?.message === 'string' && error.message.toLowerCase().includes('token'));
};