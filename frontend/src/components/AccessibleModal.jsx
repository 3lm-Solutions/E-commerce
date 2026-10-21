import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';

/**
 * Modal accessible avec gestion du focus et navigation clavier
 * Conforme aux standards ARIA et WCAG 2.1
 */
const AccessibleModal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className = ''
}) => {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);
  const firstFocusableRef = useRef(null);
  const lastFocusableRef = useRef(null);

  // Tailles prédéfinies
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4'
  };

  useEffect(() => {
    if (!isOpen) return;

    // Sauvegarder l'élément qui avait le focus
    previousFocusRef.current = document.activeElement;

    // Empêcher le scroll du body
    document.body.style.overflow = 'hidden';

    // Gestion de la touche Escape
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.preventDefault();
        onClose();
        return;
      }

      // Piège à focus (focus trap)
      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements?.length) {
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          // Tab + Shift (navigation arrière)
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } 
          // Tab simple (navigation avant)
          else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus sur le premier élément focusable après un court délai
    setTimeout(() => {
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements?.length) {
        focusableElements[0].focus();
      } else {
        // Si aucun élément focusable, focus sur le modal lui-même
        modalRef.current?.focus();
      }
    }, 100);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      
      // Restaurer le focus sur l'élément précédent
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, onClose, closeOnEscape]);

  // Gestion du clic sur l'overlay
  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  // Ne rien rendre si fermé
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
      role="dialog" 
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      onClick={handleOverlayClick}
    >
      <div 
        ref={modalRef}
        className={`bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} ${className}`}
        tabIndex="-1"
        role="document"
      >
        {/* En-tête avec titre et bouton fermer */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            {title && (
              <h2 id="modal-title" className="text-xl font-bold text-gray-900">
                {title}
              </h2>
            )}
            
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Fermer le modal"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}
        
        {/* Contenu du modal */}
        <div className={`p-6 ${title || showCloseButton ? '' : 'pt-8'}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

AccessibleModal.propTypes = {
  /** État d'ouverture du modal */
  isOpen: PropTypes.bool.isRequired,
  /** Fonction de fermeture du modal */
  onClose: PropTypes.func.isRequired,
  /** Titre du modal (optionnel) */
  title: PropTypes.string,
  /** Contenu du modal */
  children: PropTypes.node.isRequired,
  /** Taille du modal */
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', 'full']),
  /** Fermer en cliquant sur l'overlay */
  closeOnOverlayClick: PropTypes.bool,
  /** Fermer avec la touche Escape */
  closeOnEscape: PropTypes.bool,
  /** Afficher le bouton de fermeture */
  showCloseButton: PropTypes.bool,
  /** Classes CSS personnalisées */
  className: PropTypes.string
};

export default AccessibleModal;