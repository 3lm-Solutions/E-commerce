import PropTypes from 'prop-types';

/**
 * Composants de skeleton loading pour améliorer l'UX pendant les chargements
 * Remplace les spinners par des placeholders réalistes
 */

// Skeleton de base réutilisable
const Skeleton = ({ className = '', width, height, circle = false }) => {
  const baseClasses = "loading-shimmer animate-pulse rounded";
  const shapeClasses = circle ? "rounded-full" : "rounded-lg";
  const sizeStyle = {
    ...(width && { width }),
    ...(height && { height })
  };

  return (
    <div 
      className={`${baseClasses} ${shapeClasses} ${className}`}
      style={sizeStyle}
    />
  );
};

// Skeleton pour carte produit
export const ProductCardSkeleton = () => (
  <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 p-4">
    {/* Image du produit */}
    <Skeleton className="w-full h-48 mb-4" />
    
    {/* Catégorie */}
    <Skeleton className="h-3 w-20 mb-2" />
    
    {/* Nom du produit */}
    <Skeleton className="h-4 w-full mb-1" />
    <Skeleton className="h-4 w-3/4 mb-4" />
    
    {/* Prix et rating */}
    <div className="flex justify-between items-center">
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-4 w-12" />
    </div>
  </div>
);

// Skeleton pour liste de produits
export const ProductGridSkeleton = ({ count = 8 }) => (
  <div className="product-grid">
    {Array.from({ length: count }, (_, i) => (
      <ProductCardSkeleton key={i} />
    ))}
  </div>
);

// Skeleton pour item du panier
export const CartItemSkeleton = () => (
  <div className="cart-item">
    {/* Image */}
    <Skeleton className="w-20 h-20" />
    
    {/* Détails produit */}
    <div className="flex-1 space-y-2">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-32" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
    
    {/* Quantité (desktop) */}
    <div className="hidden sm:flex items-center">
      <Skeleton className="h-12 w-32" />
    </div>
    
    {/* Prix total (desktop) */}
    <div className="hidden sm:block">
      <Skeleton className="h-5 w-16 mb-1" />
      <Skeleton className="h-3 w-20" />
    </div>
    
    {/* Bouton supprimer */}
    <Skeleton className="w-12 h-12" circle />
  </div>
);

// Skeleton pour page de commandes
export const OrderSkeleton = () => (
  <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
    <div className="flex justify-between items-start mb-4">
      <div>
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
    
    <div className="space-y-3">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="w-16 h-16" />
          <div className="flex-1">
            <Skeleton className="h-4 w-48 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
    
    <div className="flex justify-between items-center mt-4 pt-4 border-t">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-5 w-20" />
    </div>
  </div>
);

// Skeleton pour profil utilisateur
export const ProfileSkeleton = () => (
  <div className="bg-white rounded-2xl border border-gray-200 p-6">
    <div className="flex items-center gap-4 mb-6">
      <Skeleton className="w-20 h-20" circle />
      <div>
        <Skeleton className="h-5 w-32 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
    
    <div className="space-y-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i}>
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  </div>
);

// Skeleton pour détails produit
export const ProductDetailSkeleton = () => (
  <div className="max-w-7xl mx-auto px-6 py-10">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Images */}
      <div>
        <Skeleton className="w-full h-96 mb-4" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="w-20 h-20" />
          ))}
        </div>
      </div>
      
      {/* Détails */}
      <div className="space-y-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
        
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
        
        <div className="flex gap-4">
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-12 flex-1" />
        </div>
        
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  </div>
);

// Skeleton pour navbar
export const NavbarSkeleton = () => (
  <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <Skeleton className="h-6 w-32" />
      
      <div className="hidden md:flex items-center gap-8">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-16" />
        ))}
      </div>
      
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-8" circle />
      </div>
    </div>
  </nav>
);

// Hook pour gérer les états de chargement
export const useLoadingState = (initialState = false) => {
  const [isLoading, setIsLoading] = useState(initialState);
  
  const startLoading = () => setIsLoading(true);
  const stopLoading = () => setIsLoading(false);
  const toggleLoading = () => setIsLoading(prev => !prev);
  
  return {
    isLoading,
    startLoading,
    stopLoading,
    toggleLoading,
    setIsLoading
  };
};

Skeleton.propTypes = {
  className: PropTypes.string,
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  circle: PropTypes.bool
};

ProductGridSkeleton.propTypes = {
  count: PropTypes.number
};

export default Skeleton;