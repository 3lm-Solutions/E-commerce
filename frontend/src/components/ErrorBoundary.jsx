import React from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Error Boundary pour capturer et afficher les erreurs React
 * Améliore l'UX en cas de crash de l'application
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Met à jour le state pour afficher l'UI d'erreur
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log l'erreur pour le débogage
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Ici on pourrait envoyer l'erreur à un service de monitoring
    // comme Sentry, LogRocket, etc.
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  };

  render() {
    if (this.state.hasError) {
      // Interface d'erreur personnalisée
      if (this.props.fallback) {
        return this.props.fallback(
          this.state.error,
          this.state.errorInfo,
          this.handleRetry
        );
      }

      // Interface d'erreur par défaut
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8 text-center">
            {/* Icône d'erreur */}
            <div className="flex justify-center">
              <div className="bg-red-100 rounded-full p-6">
                <AlertTriangle className="w-16 h-16 text-red-600" />
              </div>
            </div>
            
            {/* Titre et message */}
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
                Oups ! Une erreur s'est produite
              </h2>
              <p className="text-gray-600 mb-6">
                Quelque chose s'est mal passé. Nous avons été notifiés et travaillons sur une solution.
              </p>
              
              {/* Détails de l'erreur en mode développement */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left bg-gray-100 rounded-lg p-4 mb-6">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                    Détails techniques (développement)
                  </summary>
                  <pre className="text-xs text-gray-600 overflow-auto">
                    {this.state.error.toString()}
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-4">
              <button
                onClick={this.handleRetry}
                className="w-full flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <RefreshCw size={20} className="mr-2" />
                Réessayer
              </button>
              
              <Link
                to="/"
                className="w-full flex items-center justify-center px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
              >
                <Home size={20} className="mr-2" />
                Retour à l'accueil
              </Link>
            </div>

            {/* Message de support */}
            <p className="text-sm text-gray-500">
              Si le problème persiste, contactez notre support à{' '}
              <a 
                href="mailto:support@3lm-solutions.com" 
                className="text-indigo-600 hover:underline"
              >
                support@3lm-solutions.com
              </a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook pour capturer les erreurs dans les composants fonctionnels
 */
export const useErrorHandler = () => {
  const handleError = React.useCallback((error, errorInfo) => {
    console.error('Error caught by useErrorHandler:', error, errorInfo);
    
    // Ici on pourrait intégrer avec un service de monitoring
    // ou afficher un toast d'erreur
  }, []);

  return handleError;
};

/**
 * Composant d'erreur simple pour les états d'erreur spécifiques
 */
export const ErrorMessage = ({ 
  title = "Une erreur s'est produite", 
  message, 
  onRetry, 
  showRetry = true,
  className = ""
}) => (
  <div className={`text-center py-12 px-4 ${className}`}>
    <div className="bg-red-50 rounded-lg p-8 max-w-md mx-auto">
      <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-red-800 mb-2">{title}</h3>
      {message && (
        <p className="text-red-700 mb-4">{message}</p>
      )}
      {showRetry && onRetry && (
        <button
          onClick={onRetry}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Réessayer
        </button>
      )}
    </div>
  </div>
);

/**
 * HOC pour wrapper des composants avec ErrorBoundary
 */
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  const WrappedComponent = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.func,
  onError: PropTypes.func
};

ErrorMessage.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
  onRetry: PropTypes.func,
  showRetry: PropTypes.bool,
  className: PropTypes.string
};

export default ErrorBoundary;