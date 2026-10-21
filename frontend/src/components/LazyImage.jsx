import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Composant d'image avec lazy loading et placeholder
 * Améliore les performances en chargeant les images uniquement quand nécessaire
 */
const LazyImage = ({
  src,
  alt,
  className = '',
  placeholderSrc,
  blurDataURL,
  onLoad,
  onError,
  threshold = 0.1,
  rootMargin = '50px',
  sizes,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  // Intersection Observer pour détecter quand l'image entre dans le viewport
  useEffect(() => {
    const currentImg = imgRef.current;
    
    if (!currentImg) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observerRef.current?.unobserve(currentImg);
        }
      },
      {
        threshold,
        rootMargin
      }
    );

    observerRef.current.observe(currentImg);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [threshold, rootMargin]);

  const handleLoad = (e) => {
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e) => {
    setHasError(true);
    onError?.(e);
  };

  // Placeholder pendant le chargement
  const PlaceholderComponent = () => (
    <div 
      className={`bg-gray-200 animate-pulse flex items-center justify-center ${className}`}
      style={{ aspectRatio: '4/3' }}
    >
      {blurDataURL ? (
        <img 
          src={blurDataURL} 
          alt=""
          className="w-full h-full object-cover filter blur-sm opacity-50"
        />
      ) : (
        <div className="text-gray-400 text-sm">
          <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
          Chargement...
        </div>
      )}
    </div>
  );

  // Image d'erreur
  if (hasError) {
    return (
      <div 
        className={`bg-gray-100 flex items-center justify-center ${className}`}
        style={{ aspectRatio: '4/3' }}
      >
        <div className="text-gray-400 text-center">
          <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-xs">Image indisponible</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={imgRef} className="relative overflow-hidden">
      {/* Placeholder/Blur avant chargement */}
      {!isLoaded && <PlaceholderComponent />}
      
      {/* Image réelle */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          sizes={sizes}
          className={`
            transition-opacity duration-300
            ${isLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}
            ${className}
          `}
          loading="lazy"
          {...props}
        />
      )}
    </div>
  );
};

/**
 * Hook pour précharger les images
 */
export const useImagePreload = (imageSources) => {
  const [loadedImages, setLoadedImages] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const preloadImages = async (sources) => {
    setIsLoading(true);
    
    const promises = sources.map((src) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          setLoadedImages(prev => new Set(prev).add(src));
          resolve(src);
        };
        img.onerror = reject;
        img.src = src;
      });
    });

    try {
      await Promise.all(promises);
    } catch (error) {
      console.warn('Some images failed to preload:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (imageSources?.length > 0) {
      preloadImages(imageSources);
    }
  }, [imageSources]);

  return {
    loadedImages,
    isLoading,
    preloadImages
  };
};

/**
 * Composant d'image responsive avec srcSet automatique
 */
export const ResponsiveImage = ({
  src,
  alt,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw',
  className = '',
  ...props
}) => {
  // Générer srcSet pour différentes tailles (si supporté par le backend)
  const generateSrcSet = (baseSrc) => {
    const widths = [320, 640, 768, 1024, 1280, 1920];
    return widths
      .map(width => `${baseSrc}?w=${width} ${width}w`)
      .join(', ');
  };

  return (
    <LazyImage
      src={src}
      alt={alt}
      sizes={sizes}
      srcSet={generateSrcSet(src)}
      className={className}
      {...props}
    />
  );
};

/**
 * Galerie d'images avec navigation
 */
export const ImageGallery = ({ 
  images, 
  selectedIndex = 0, 
  onImageSelect,
  className = ''
}) => {
  const [currentIndex, setCurrentIndex] = useState(selectedIndex);

  const handlePrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    setCurrentIndex(newIndex);
    onImageSelect?.(newIndex);
  };

  const handleNext = () => {
    const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    setCurrentIndex(newIndex);
    onImageSelect?.(newIndex);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'ArrowRight') handleNext();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Image principale */}
      <div 
        className="relative group focus:outline-none"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="img"
        aria-label={`Image ${currentIndex + 1} sur ${images.length}`}
      >
        <LazyImage
          src={images[currentIndex]?.src}
          alt={images[currentIndex]?.alt || `Image ${currentIndex + 1}`}
          className="w-full h-96 object-cover rounded-lg"
        />
        
        {/* Navigation */}
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Image précédente"
            >
              ←
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Image suivante"
            >
              →
            </button>
          </>
        )}
        
        {/* Indicateur */}
        <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index);
                onImageSelect?.(index);
              }}
              className={`
                flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors
                ${index === currentIndex ? 'border-indigo-500' : 'border-gray-200'}
              `}
              aria-label={`Voir l'image ${index + 1}`}
            >
              <LazyImage
                src={image.thumbnail || image.src}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

LazyImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  className: PropTypes.string,
  placeholderSrc: PropTypes.string,
  blurDataURL: PropTypes.string,
  onLoad: PropTypes.func,
  onError: PropTypes.func,
  threshold: PropTypes.number,
  rootMargin: PropTypes.string,
  sizes: PropTypes.string
};

ResponsiveImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  sizes: PropTypes.string,
  className: PropTypes.string
};

ImageGallery.propTypes = {
  images: PropTypes.arrayOf(PropTypes.shape({
    src: PropTypes.string.isRequired,
    alt: PropTypes.string,
    thumbnail: PropTypes.string
  })).isRequired,
  selectedIndex: PropTypes.number,
  onImageSelect: PropTypes.func,
  className: PropTypes.string
};

export default LazyImage;