import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Check, X, Heart, ShoppingCart, Plus, Minus } from 'lucide-react';

/**
 * Composant de feedback visuel pour les actions utilisateur
 * Affiche des micro-animations pour confirmer les actions
 */
const ActionFeedback = ({ 
  action, 
  isVisible, 
  onComplete,
  position = { x: 0, y: 0 },
  duration = 1500 
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onComplete]);

  const actionConfig = {
    addToCart: {
      icon: ShoppingCart,
      color: 'text-green-600',
      bg: 'bg-green-100',
      text: 'Ajouté au panier'
    },
    removeFromCart: {
      icon: Minus,
      color: 'text-red-600', 
      bg: 'bg-red-100',
      text: 'Retiré du panier'
    },
    addToWishlist: {
      icon: Heart,
      color: 'text-pink-600',
      bg: 'bg-pink-100',
      text: 'Ajouté aux favoris'
    },
    removeFromWishlist: {
      icon: X,
      color: 'text-gray-600',
      bg: 'bg-gray-100',
      text: 'Retiré des favoris'
    },
    increase: {
      icon: Plus,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      text: 'Quantité augmentée'
    },
    decrease: {
      icon: Minus,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
      text: 'Quantité diminuée'
    },
    success: {
      icon: Check,
      color: 'text-green-600',
      bg: 'bg-green-100',
      text: 'Action réussie'
    }
  };

  const config = actionConfig[action] || actionConfig.success;
  const IconComponent = config.icon;

  if (!isVisible && !isAnimating) return null;

  return (
    <div
      className={`
        fixed z-50 pointer-events-none select-none
        ${isAnimating ? 'animate-bounce-in' : 'animate-fade-out'}
      `}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <div className={`
        flex items-center gap-2 px-3 py-2 rounded-full shadow-lg
        ${config.bg} ${config.color}
        backdrop-blur-sm border border-white/20
      `}>
        <IconComponent size={16} />
        <span className="text-sm font-medium whitespace-nowrap">
          {config.text}
        </span>
      </div>
    </div>
  );
};

/**
 * Hook pour gérer le feedback d'actions
 */
export const useActionFeedback = () => {
  const [feedback, setFeedback] = useState({
    isVisible: false,
    action: null,
    position: { x: 0, y: 0 }
  });

  const showFeedback = (action, event) => {
    // Récupérer la position de l'événement (clic, hover, etc.)
    const x = event?.clientX || window.innerWidth / 2;
    const y = event?.clientY || window.innerHeight / 2;

    setFeedback({
      isVisible: true,
      action,
      position: { x, y }
    });
  };

  const hideFeedback = () => {
    setFeedback(prev => ({ ...prev, isVisible: false }));
  };

  return {
    feedback,
    showFeedback,
    hideFeedback
  };
};

/**
 * Composant de notification floating pour les ajouts panier
 */
export const CartNotification = ({ 
  isVisible, 
  product, 
  onClose,
  onViewCart 
}) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-20 right-4 z-50 animate-slide-in-right">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="bg-green-100 rounded-full p-2 flex-shrink-0">
            <Check size={16} className="text-green-600" />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              Produit ajouté au panier
            </p>
            {product && (
              <p className="text-sm text-gray-600 mt-1 truncate">
                {product.name}
              </p>
            )}
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        
        <div className="flex gap-2 mt-3">
          <button
            onClick={onViewCart}
            className="flex-1 bg-indigo-600 text-white text-sm py-2 px-3 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Voir le panier
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
};

ActionFeedback.propTypes = {
  action: PropTypes.oneOf(['addToCart', 'removeFromCart', 'addToWishlist', 'removeFromWishlist', 'increase', 'decrease', 'success']).isRequired,
  isVisible: PropTypes.bool.isRequired,
  onComplete: PropTypes.func,
  position: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number
  }),
  duration: PropTypes.number
};

CartNotification.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  product: PropTypes.shape({
    name: PropTypes.string
  }),
  onClose: PropTypes.func.isRequired,
  onViewCart: PropTypes.func.isRequired
};

export default ActionFeedback;