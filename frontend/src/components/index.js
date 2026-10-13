/**
 * Index des composants UX/UI améliorés
 * Issue #8: Expérience Utilisateur et Accessibilité
 */

// Composants de base
export { default as LoadingButton } from './LoadingButton';
export { default as Toast, useToast } from './Toast';
export { default as ToastProvider } from './ToastProvider';

// Modals et overlays
export { default as AccessibleModal } from './AccessibleModal';
export { default as ErrorBoundary, ErrorMessage, withErrorBoundary, useErrorHandler } from './ErrorBoundary';

// Loading et états
export { 
  default as LoadingSkeleton,
  ProductCardSkeleton,
  ProductGridSkeleton,
  CartItemSkeleton,
  OrderSkeleton,
  ProfileSkeleton,
  ProductDetailSkeleton,
  NavbarSkeleton,
  useLoadingState
} from './LoadingSkeleton';

// Animations et transitions
export { 
  default as AnimatedContainer,
  StaggeredContainer,
  PageTransition,
  InteractiveElement,
  useAnimation
} from './AnimatedContainer';

// Feedback et notifications
export { 
  default as ActionFeedback,
  CartNotification,
  useActionFeedback
} from './ActionFeedback';

// Formulaires accessibles
export { 
  default as AccessibleForm,
  AccessibleInput,
  FieldGroup,
  AccessibleSwitch
} from './AccessibleForm';

// Images et médias
export { 
  default as LazyImage,
  ResponsiveImage,
  ImageGallery,
  useImagePreload
} from './LazyImage';

// Recherche et navigation
export { 
  default as SearchInput,
  useSearchDebounce
} from './SearchInput';

// Utilitaires
export * from '../utils/errorMessages';