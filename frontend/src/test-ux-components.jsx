/**
 * Page de test pour tous les composants UX/UI
 * Issue #8: Expérience Utilisateur et Accessibilité
 * 
 * Cette page permet de tester visuellement tous les composants
 * avant mise en production
 */

import React, { useState } from 'react';
import {
  LoadingButton,
  Toast,
  ToastProvider,
  AccessibleModal,
  SearchInput,
  LazyImage,
  ResponsiveImage,
  AccessibleForm,
  AccessibleInput,
  FieldGroup,
  AnimatedContainer,
  StaggeredContainer,
  ActionFeedback,
  useActionFeedback,
  useToast,
  ProductGridSkeleton,
  CartItemSkeleton,
  ErrorMessage
} from './components';

const TestUXComponents = () => {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [formErrors, setFormErrors] = useState({});
  
  const { success, error, warning, info } = useToast();
  const { feedback, showFeedback, hideFeedback } = useActionFeedback();

  // Test des toasts
  const testToasts = () => {
    success('Action réussie avec succès !');
    setTimeout(() => error('Une erreur de test est survenue'), 1000);
    setTimeout(() => warning('Attention, ceci est un avertissement'), 2000);
    setTimeout(() => info('Information importante à retenir'), 3000);
  };

  // Test du loading button
  const testLoadingButton = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setLoading(false);
    success('Test du bouton terminé !');
  };

  // Test de la recherche
  const handleSearch = async (query) => {
    // Simulation d'une recherche avec délai
    await new Promise(resolve => setTimeout(resolve, 500));
    const mockResults = [
      'iPhone 14 Pro',
      'Samsung Galaxy S23',
      'MacBook Air M2',
      'iPad Pro',
      'AirPods Pro'
    ].filter(item => 
      item.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(mockResults);
  };

  // Test du formulaire
  const handleFormSubmit = (e) => {
    e.preventDefault();
    
    // Validation simple
    const errors = {};
    if (!formData.email) errors.email = 'Email requis';
    if (!formData.password) errors.password = 'Mot de passe requis';
    if (!formData.name) errors.name = 'Nom requis';
    
    setFormErrors(errors);
    
    if (Object.keys(errors).length === 0) {
      success('Formulaire soumis avec succès !');
      setFormData({ email: '', password: '', name: '' });
    } else {
      error('Veuillez corriger les erreurs du formulaire');
    }
  };

  // Test des actions feedback
  const testActionFeedback = (action, event) => {
    showFeedback(action, event);
    success(`Action "${action}" testée`);
  };

  const testImages = [
    {
      src: 'https://via.placeholder.com/400x300/4F46E5/FFFFFF?text=Image+1',
      alt: 'Image de test 1',
      thumbnail: 'https://via.placeholder.com/64x64/4F46E5/FFFFFF?text=1'
    },
    {
      src: 'https://via.placeholder.com/400x300/059669/FFFFFF?text=Image+2',
      alt: 'Image de test 2', 
      thumbnail: 'https://via.placeholder.com/64x64/059669/FFFFFF?text=2'
    },
    {
      src: 'https://via.placeholder.com/400x300/DC2626/FFFFFF?text=Image+3',
      alt: 'Image de test 3',
      thumbnail: 'https://via.placeholder.com/64x64/DC2626/FFFFFF?text=3'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-12">
      {/* En-tête */}
      <AnimatedContainer animation="fadeIn">
        <div className="text-center py-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl text-white">
          <h1 className="text-4xl font-bold mb-4">🧪 Test des Composants UX/UI</h1>
          <p className="text-xl opacity-90">Issue #8: Expérience Utilisateur et Accessibilité</p>
        </div>
      </AnimatedContainer>

      {/* Section Boutons et Actions */}
      <AnimatedContainer animation="slideUp" delay={100}>
        <section className="bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">🔘 Boutons et Actions</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <LoadingButton
              loading={loading}
              onClick={testLoadingButton}
              variant="primary"
              size="md"
            >
              Test Loading Button
            </LoadingButton>
            
            <LoadingButton
              onClick={testToasts}
              variant="secondary"
              size="md"
            >
              Test Toasts
            </LoadingButton>
            
            <LoadingButton
              onClick={() => setShowModal(true)}
              variant="outline"
              size="md"
            >
              Ouvrir Modal
            </LoadingButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {['addToCart', 'addToWishlist', 'increase', 'success'].map(action => (
              <button
                key={action}
                onClick={(e) => testActionFeedback(action, e)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
              >
                Test {action}
              </button>
            ))}
          </div>
        </section>
      </AnimatedContainer>

      {/* Section Recherche */}
      <AnimatedContainer animation="slideUp" delay={200}>
        <section className="bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">🔍 Recherche</h2>
          
          <SearchInput
            placeholder="Rechercher un produit (iPhone, Samsung, etc.)"
            onSearch={handleSearch}
            suggestions={searchResults}
            showHistory={true}
            className="max-w-md"
          />
          
          {searchResults.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-2">Résultats:</h3>
              <ul className="space-y-1">
                {searchResults.map((result, index) => (
                  <li key={index} className="text-sm text-gray-600">• {result}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </AnimatedContainer>

      {/* Section Formulaire */}
      <AnimatedContainer animation="slideUp" delay={300}>
        <section className="bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">📝 Formulaire Accessible</h2>
          
          <AccessibleForm
            onSubmit={handleFormSubmit}
            errors={formErrors}
            className="max-w-md"
          >
            <FieldGroup title="Informations de test">
              <AccessibleInput
                label="Nom complet"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                error={formErrors.name}
                required={true}
                placeholder="Votre nom"
              />
              
              <AccessibleInput
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                error={formErrors.email}
                required={true}
                placeholder="votre@email.com"
                hint="Nous ne partagerons jamais votre email"
              />
              
              <AccessibleInput
                label="Mot de passe"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                error={formErrors.password}
                required={true}
                maxLength={50}
                showCharCount={true}
              />
              
              <LoadingButton type="submit" variant="primary" className="w-full">
                Tester le formulaire
              </LoadingButton>
            </FieldGroup>
          </AccessibleForm>
        </section>
      </AnimatedContainer>

      {/* Section Images */}
      <AnimatedContainer animation="slideUp" delay={400}>
        <section className="bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">🖼️ Images Responsives</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-4">LazyImage basique:</h3>
              <LazyImage
                src={testImages[0].src}
                alt={testImages[0].alt}
                className="w-full h-48 object-cover rounded-lg"
              />
            </div>
            
            <div>
              <h3 className="font-medium mb-4">ResponsiveImage:</h3>
              <ResponsiveImage
                src={testImages[1].src}
                alt={testImages[1].alt}
                className="w-full h-48 object-cover rounded-lg"
              />
            </div>
          </div>
        </section>
      </AnimatedContainer>

      {/* Section Animations */}
      <AnimatedContainer animation="slideUp" delay={500}>
        <section className="bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">🎭 Animations</h2>
          
          <StaggeredContainer staggerDelay={150} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['fadeIn', 'slideUp', 'scaleIn'].map((animation, index) => (
              <AnimatedContainer
                key={animation}
                animation={animation}
                className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl text-center"
              >
                <div className="text-2xl mb-2">✨</div>
                <h3 className="font-medium">{animation}</h3>
                <p className="text-sm text-gray-600 mt-1">Animation #{index + 1}</p>
              </AnimatedContainer>
            ))}
          </StaggeredContainer>
        </section>
      </AnimatedContainer>

      {/* Section Loading States */}
      <AnimatedContainer animation="slideUp" delay={600}>
        <section className="bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">💀 États de Chargement</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-3">Grille de produits (skeleton):</h3>
              <ProductGridSkeleton count={4} />
            </div>
            
            <div>
              <h3 className="font-medium mb-3">Items de panier (skeleton):</h3>
              <div className="space-y-3">
                <CartItemSkeleton />
                <CartItemSkeleton />
              </div>
            </div>
          </div>
        </section>
      </AnimatedContainer>

      {/* Section Gestion d'Erreurs */}
      <AnimatedContainer animation="slideUp" delay={700}>
        <section className="bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">⚠️ Gestion d'Erreurs</h2>
          
          <ErrorMessage
            title="Erreur de test"
            message="Ceci est un exemple de message d'erreur utilisateur-friendly"
            onRetry={() => info('Fonction de retry testée !')}
            showRetry={true}
          />
        </section>
      </AnimatedContainer>

      {/* Modal de test */}
      <AccessibleModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Modal de Test"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Cette modal teste l'accessibilité complète avec navigation clavier.
          </p>
          
          <div className="flex gap-3">
            <button 
              onClick={() => {
                success('Action confirmée !');
                setShowModal(false);
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Confirmer
            </button>
            
            <button 
              onClick={() => setShowModal(false)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </AccessibleModal>

      {/* Feedback d'action */}
      <ActionFeedback
        action={feedback.action}
        isVisible={feedback.isVisible}
        position={feedback.position}
        onComplete={hideFeedback}
      />

      {/* Footer */}
      <AnimatedContainer animation="fadeIn" delay={800}>
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">
            🎉 Tous les composants UX/UI de l'Issue #8 sont fonctionnels !
          </p>
          <p className="text-xs mt-2">
            Développé par l'équipe 3LM-Solutions Engineering Department
          </p>
        </div>
      </AnimatedContainer>
    </div>
  );
};

// Wrapper avec ToastProvider pour les tests
const TestPage = () => (
  <ToastProvider maxToasts={4}>
    <TestUXComponents />
  </ToastProvider>
);

export default TestPage;