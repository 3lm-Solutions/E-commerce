import PropTypes from 'prop-types';
import { Loader2 } from 'lucide-react';

/**
 * Bouton avec état de chargement intégré
 * Affiche un spinner pendant le chargement et désactive les interactions
 */
const LoadingButton = ({ 
  loading = false, 
  children, 
  className = "", 
  disabled = false,
  loadingText,
  variant = "primary",
  size = "md",
  ...props 
}) => {
  const baseClasses = "relative font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500 disabled:bg-indigo-400",
    secondary: "bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-500 disabled:bg-gray-100",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 disabled:bg-red-400",
    success: "bg-green-600 hover:bg-green-700 text-white focus:ring-green-500 disabled:bg-green-400",
    outline: "border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 focus:ring-indigo-500 disabled:border-indigo-300 disabled:text-indigo-300"
  };
  
  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-sm",
    lg: "px-6 py-4 text-base"
  };

  const isDisabled = disabled || loading;
  const buttonClasses = `${baseClasses} ${variants[variant]} ${sizes[size]} ${isDisabled ? 'opacity-75' : ''} ${className}`;

  return (
    <button 
      {...props} 
      disabled={isDisabled}
      className={buttonClasses}
      aria-busy={loading}
      aria-disabled={isDisabled}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={16} className="animate-spin" />
        </div>
      )}
      <span className={loading ? 'invisible' : 'visible'}>
        {loading && loadingText ? loadingText : children}
      </span>
    </button>
  );
};

LoadingButton.propTypes = {
  /** État de chargement qui affiche le spinner */
  loading: PropTypes.bool,
  /** Contenu du bouton */
  children: PropTypes.node.isRequired,
  /** Classes CSS personnalisées */
  className: PropTypes.string,
  /** État désactivé du bouton */
  disabled: PropTypes.bool,
  /** Texte alternatif à afficher pendant le chargement */
  loadingText: PropTypes.string,
  /** Style du bouton */
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'success', 'outline']),
  /** Taille du bouton */
  size: PropTypes.oneOf(['sm', 'md', 'lg'])
};

export default LoadingButton;