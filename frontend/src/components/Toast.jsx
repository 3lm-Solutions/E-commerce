import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

/**
 * Composant Toast pour les notifications système
 * Remplace avantageusement react-hot-toast avec plus de contrôle
 */
const Toast = ({ 
  message, 
  type = 'info', 
  onClose, 
  duration = 5000,
  position = 'top-right',
  showIcon = true,
  showCloseButton = true,
  className = ''
}) => {
  
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [onClose, duration]);

  const styles = {
    success: {
      bg: 'bg-green-500',
      text: 'text-white',
      icon: CheckCircle,
      iconColor: 'text-green-100'
    },
    error: {
      bg: 'bg-red-500',
      text: 'text-white', 
      icon: XCircle,
      iconColor: 'text-red-100'
    },
    warning: {
      bg: 'bg-yellow-500',
      text: 'text-white',
      icon: AlertCircle,
      iconColor: 'text-yellow-100'
    },
    info: {
      bg: 'bg-blue-500',
      text: 'text-white',
      icon: Info,
      iconColor: 'text-blue-100'
    }
  };

  const positions = {
    'top-left': 'top-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4'
  };

  const currentStyle = styles[type];
  const IconComponent = currentStyle.icon;

  return (
    <div 
      className={`
        fixed ${positions[position]} z-50 max-w-sm w-full mx-4
        ${currentStyle.bg} ${currentStyle.text}
        p-4 rounded-lg shadow-lg
        animate-in slide-in-from-top-2 fade-in duration-300
        ${className}
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {/* Icône */}
        {showIcon && IconComponent && (
          <IconComponent 
            size={20} 
            className={`flex-shrink-0 mt-0.5 ${currentStyle.iconColor}`}
          />
        )}
        
        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-relaxed break-words">
            {message}
          </p>
        </div>
        
        {/* Bouton fermer */}
        {showCloseButton && (
          <button
            onClick={onClose}
            className={`
              flex-shrink-0 p-1 rounded-md transition-colors
              hover:bg-white hover:bg-opacity-20
              focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-40
              ${currentStyle.iconColor}
            `}
            aria-label="Fermer la notification"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

Toast.propTypes = {
  /** Message à afficher */
  message: PropTypes.string.isRequired,
  /** Type de toast qui détermine couleur et icône */
  type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
  /** Fonction appelée pour fermer le toast */
  onClose: PropTypes.func.isRequired,
  /** Durée d'affichage en ms (0 = pas de fermeture auto) */
  duration: PropTypes.number,
  /** Position du toast sur l'écran */
  position: PropTypes.oneOf([
    'top-left', 'top-center', 'top-right',
    'bottom-left', 'bottom-center', 'bottom-right'
  ]),
  /** Afficher l'icône correspondant au type */
  showIcon: PropTypes.bool,
  /** Afficher le bouton de fermeture */
  showCloseButton: PropTypes.bool,
  /** Classes CSS personnalisées */
  className: PropTypes.string
};

/**
 * Hook pour gérer les toasts facilement
 */
export const useToast = () => {
  const showToast = (message, type = 'info', options = {}) => {
    // Cette fonction peut être étendue pour gérer un système global de toasts
    // Pour l'instant, elle sert de placeholder pour une implémentation future
    console.log(`Toast: ${message} (${type})`, options);
  };

  return {
    success: (message, options) => showToast(message, 'success', options),
    error: (message, options) => showToast(message, 'error', options), 
    warning: (message, options) => showToast(message, 'warning', options),
    info: (message, options) => showToast(message, 'info', options)
  };
};

export default Toast;