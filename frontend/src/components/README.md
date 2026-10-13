# 🎨 Guide des composants UX/UI

Cette documentation présente tous les composants développés pour l'Issue #8 "Expérience Utilisateur et Accessibilité".

## 🚀 Installation et usage

```bash
# Tous les composants sont importables depuis le dossier components
import { LoadingButton, Toast, AccessibleModal } from './components';

# Ou imports individuels
import LoadingButton from './components/LoadingButton';
```

## 📚 Composants disponibles

### 🔘 LoadingButton

Bouton avec état de chargement intégré.

```jsx
import { LoadingButton } from './components';

<LoadingButton
  loading={isSubmitting}
  onClick={handleSubmit}
  variant="primary"
  size="md"
  loadingText="Envoi en cours..."
>
  Envoyer
</LoadingButton>
```

**Props:**
- `loading` (bool): État de chargement
- `variant` (string): 'primary', 'secondary', 'danger', 'success', 'outline'
- `size` (string): 'sm', 'md', 'lg'
- `loadingText` (string): Texte pendant le chargement

### 🔔 ToastProvider & useToast

Système de notifications global.

```jsx
// Dans App.jsx
import { ToastProvider } from './components';

<ToastProvider maxToasts={5}>
  <App />
</ToastProvider>

// Dans un composant
import { useToast } from './components';

const MyComponent = () => {
  const { success, error, warning, info } = useToast();
  
  const handleAction = () => {
    success('Action réussie !');
    error('Une erreur est survenue');
    warning('Attention à cela');
    info('Information utile');
  };
};
```

### 🪟 AccessibleModal

Modal accessible avec navigation clavier et focus trap.

```jsx
import { AccessibleModal } from './components';

<AccessibleModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Confirmer l'action"
  size="md"
  closeOnEscape={true}
  closeOnOverlayClick={true}
>
  <p>Contenu du modal...</p>
  <button onClick={handleConfirm}>Confirmer</button>
</AccessibleModal>
```

### 🔍 SearchInput

Recherche avec suggestions, historique et debouncing.

```jsx
import { SearchInput } from './components';

<SearchInput
  placeholder="Rechercher des produits..."
  onSearch={handleSearch}
  suggestions={searchSuggestions}
  isLoading={isSearching}
  showHistory={true}
  debounceMs={300}
  maxSuggestions={8}
/>
```

### 🖼️ LazyImage

Images avec lazy loading et responsive.

```jsx
import { LazyImage, ResponsiveImage } from './components';

// Image basique avec lazy loading
<LazyImage
  src="/path/to/image.jpg"
  alt="Description"
  className="w-full h-48 object-cover"
  onLoad={() => console.log('Image chargée')}
/>

// Image responsive avec srcSet automatique
<ResponsiveImage
  src="/path/to/image.jpg"
  alt="Description"
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

### 📝 AccessibleForm

Formulaires accessibles avec validation.

```jsx
import { AccessibleForm, AccessibleInput, FieldGroup } from './components';

<AccessibleForm
  onSubmit={handleSubmit}
  errors={formErrors}
  isSubmitting={loading}
>
  <FieldGroup title="Informations personnelles">
    <AccessibleInput
      label="Email"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      error={errors.email}
      required={true}
      hint="Nous ne partagerons jamais votre email"
    />
    
    <AccessibleInput
      label="Mot de passe"
      type="password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      maxLength={50}
      showCharCount={true}
    />
  </FieldGroup>
</AccessibleForm>
```

### 🎭 AnimatedContainer

Animations fluides et transitions.

```jsx
import { AnimatedContainer, StaggeredContainer } from './components';

// Animation simple
<AnimatedContainer animation="fadeIn" delay={200}>
  <div>Contenu animé</div>
</AnimatedContainer>

// Animations séquentielles
<StaggeredContainer staggerDelay={100} animation="slideUp">
  <div>Élément 1</div>
  <div>Élément 2</div>
  <div>Élément 3</div>
</StaggeredContainer>

// Animation au scroll
<AnimatedContainer 
  animation="slideUp" 
  trigger="scroll" 
  threshold={0.3}
>
  <div>Apparaît au scroll</div>
</AnimatedContainer>
```

**Animations disponibles:**
- `fadeIn`: Fondu d'apparition
- `slideUp/Down/Left/Right`: Glissement directionnel
- `scaleIn`: Zoom d'apparition
- `bounceIn`: Effet rebond

### ⚠️ ErrorBoundary

Gestion d'erreurs globale avec interface de récupération.

```jsx
import { ErrorBoundary } from './components';

// Usage global
<ErrorBoundary>
  <App />
</ErrorBoundary>

// Avec callback personnalisé
<ErrorBoundary 
  onError={(error, errorInfo) => {
    // Logger l'erreur
    console.error('Error caught:', error);
  }}
  fallback={(error, errorInfo, retry) => (
    <CustomErrorUI onRetry={retry} />
  )}
>
  <ComponentRisky />
</ErrorBoundary>
```

### 💫 ActionFeedback

Feedback visuel pour les actions utilisateur.

```jsx
import { ActionFeedback, useActionFeedback } from './components';

const ProductCard = () => {
  const { feedback, showFeedback, hideFeedback } = useActionFeedback();
  
  const handleAddToCart = (event) => {
    // Logique d'ajout au panier
    showFeedback('addToCart', event);
  };
  
  return (
    <>
      <button onClick={handleAddToCart}>
        Ajouter au panier
      </button>
      
      <ActionFeedback
        action={feedback.action}
        isVisible={feedback.isVisible}
        position={feedback.position}
        onComplete={hideFeedback}
      />
    </>
  );
};
```

### 💀 LoadingSkeleton

Placeholders pendant les chargements.

```jsx
import { 
  ProductGridSkeleton, 
  CartItemSkeleton, 
  ProfileSkeleton 
} from './components';

// Grille de produits
{isLoading ? (
  <ProductGridSkeleton count={8} />
) : (
  <ProductGrid products={products} />
)}

// Item de panier
{isLoading ? <CartItemSkeleton /> : <CartItem item={item} />}
```

## 🎨 Classes CSS utilitaires

### Animations
```css
.fade-in           /* Fondu d'apparition */
.slide-in-up       /* Glissement du bas */
.scale-in          /* Zoom d'apparition */
.bounce-in         /* Effet rebond */
.stagger-item      /* Animation séquentielle */
```

### Interactions
```css
.hover-lift        /* Élévation au survol */
.hover-scale       /* Zoom au survol */
.hover-glow        /* Lueur au survol */
.focus-ring        /* Indicateur de focus */
```

### Layout responsive
```css
.product-grid      /* Grille responsive produits */
.form-grid         /* Grille formulaire responsive */
.checkout-grid     /* Layout checkout responsive */
.mobile-only       /* Visible mobile uniquement */
.desktop-only      /* Visible desktop uniquement */
```

### États de chargement
```css
.skeleton-wave     /* Animation skeleton */
.loading-shimmer   /* Effet shimmer */
.typing-indicator  /* Indicateur de saisie */
```

## 🔧 Hooks utilitaires

### useSearchDebounce
```jsx
import { useSearchDebounce } from './components';

const { searchTerm, setSearchTerm, isSearching } = useSearchDebounce(
  async (term) => {
    const results = await searchAPI(term);
    setSuggestions(results);
  },
  300 // délai en ms
);
```

### useAnimation
```jsx
import { useAnimation } from './components';

const { isAnimating, startAnimation, stopAnimation } = useAnimation();

const handleClick = () => {
  startAnimation(1000); // Animation pendant 1s
};
```

### useImagePreload
```jsx
import { useImagePreload } from './components';

const images = ['/img1.jpg', '/img2.jpg', '/img3.jpg'];
const { loadedImages, isLoading, preloadImages } = useImagePreload(images);
```

## 🎯 Bonnes pratiques

### ♿ Accessibilité
- Toujours fournir des `alt` descriptifs pour les images
- Utiliser `aria-label` pour les boutons d'action
- Tester avec lecteurs d'écran (NVDA, JAWS)
- Navigation clavier sur tous les éléments interactifs

### 📱 Responsive
- Utiliser les classes CSS prédéfinies
- Tester sur tous les breakpoints (320px à 1920px+)
- Cibles tactiles minimum 44px

### ⚡ Performance
- Utiliser `LazyImage` pour toutes les images
- Implémenter le debouncing pour les recherches
- Préférer les animations CSS aux animations JS

### 🎨 Cohérence visuelle
- Utiliser les variants prédéfinis des composants
- Respecter les espacements du design system
- Animations subtiles (max 500ms)

## 🚨 Erreurs communes

❌ **À éviter:**
```jsx
// Pas de lazy loading
<img src="large-image.jpg" />

// Pas de debouncing
<input onChange={(e) => searchAPI(e.target.value)} />

// Modal non accessible
<div className="modal" onClick={close}>
```

✅ **Correct:**
```jsx
// Avec lazy loading
<LazyImage src="large-image.jpg" alt="Description" />

// Avec debouncing
<SearchInput onSearch={handleSearch} debounceMs={300} />

// Modal accessible
<AccessibleModal isOpen={true} onClose={close} title="Titre">
```

---

## 📞 Support

Pour toute question sur l'utilisation de ces composants :
- Consulter les PropTypes dans le code
- Vérifier les exemples dans cette documentation
- Tester avec les outils d'accessibilité du navigateur

*Guide rédigé par l'équipe 3LM-Solutions Engineering Department*