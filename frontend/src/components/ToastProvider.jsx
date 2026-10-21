import React, { createContext, useContext, useReducer, useCallback } from 'react';
import PropTypes from 'prop-types';
import Toast from './Toast';

// Context pour les toasts
const ToastContext = createContext();

// Types d'actions pour le reducer
const TOAST_ACTIONS = {
  ADD_TOAST: 'ADD_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
  CLEAR_ALL: 'CLEAR_ALL'
};

// Reducer pour gérer l'état des toasts
const toastReducer = (state, action) => {
  switch (action.type) {
    case TOAST_ACTIONS.ADD_TOAST:
      return [...state, { ...action.payload, id: Date.now() + Math.random() }];
    
    case TOAST_ACTIONS.REMOVE_TOAST:
      return state.filter(toast => toast.id !== action.payload);
    
    case TOAST_ACTIONS.CLEAR_ALL:
      return [];
    
    default:
      return state;
  }
};

/**
 * Provider pour gérer les toasts globalement dans l'application
 */
export const ToastProvider = ({ children, maxToasts = 5 }) => {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  // Ajouter un nouveau toast
  const addToast = useCallback((message, type = 'info', options = {}) => {
    const toast = {
      message,
      type,
      duration: 5000,
      position: 'top-right',
      showIcon: true,
      showCloseButton: true,
      ...options
    };

    dispatch({ type: TOAST_ACTIONS.ADD_TOAST, payload: toast });

    // Limiter le nombre de toasts affichés
    if (toasts.length >= maxToasts) {
      setTimeout(() => {
        dispatch({ type: TOAST_ACTIONS.REMOVE_TOAST, payload: toasts[0].id });
      }, 100);
    }
  }, [toasts.length, maxToasts]);

  // Supprimer un toast spécifique
  const removeToast = useCallback((id) => {
    dispatch({ type: TOAST_ACTIONS.REMOVE_TOAST, payload: id });
  }, []);

  // Supprimer tous les toasts
  const clearAllToasts = useCallback(() => {
    dispatch({ type: TOAST_ACTIONS.CLEAR_ALL });
  }, []);

  // Méthodes de commodité pour différents types
  const success = useCallback((message, options) => 
    addToast(message, 'success', options), [addToast]);
  
  const error = useCallback((message, options) => 
    addToast(message, 'error', options), [addToast]);
  
  const warning = useCallback((message, options) => 
    addToast(message, 'warning', options), [addToast]);
  
  const info = useCallback((message, options) => 
    addToast(message, 'info', options), [addToast]);

  const value = {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    success,
    error,
    warning,
    info
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      
      {/* Rendu des toasts */}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
          duration={toast.duration}
          position={toast.position}
          showIcon={toast.showIcon}
          showCloseButton={toast.showCloseButton}
        />
      ))}
    </ToastContext.Provider>
  );
};

/**
 * Hook pour utiliser les toasts dans les composants
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  return context;
};

/**
 * HOC pour wrapper des composants avec le provider de toasts
 */
export const withToast = (Component) => {
  const WrappedComponent = (props) => (
    <ToastProvider>
      <Component {...props} />
    </ToastProvider>
  );
  
  WrappedComponent.displayName = `withToast(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired,
  maxToasts: PropTypes.number
};

export default ToastProvider;