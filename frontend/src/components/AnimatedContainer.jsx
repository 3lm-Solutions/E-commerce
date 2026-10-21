import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Conteneur avec animations d'entrée et transitions fluides
 * Améliore l'UX avec des animations subtiles et performantes
 */
const AnimatedContainer = ({ 
  children, 
  animation = 'fadeIn',
  duration = 300,
  delay = 0,
  trigger = 'mount',
  threshold = 0.1,
  className = '',
  ...props 
}) => {
  const [isVisible, setIsVisible] = useState(trigger === 'mount');
  const [hasAnimated, setHasAnimated] = useState(false);
  const containerRef = useRef(null);

  // Animations disponibles
  const animations = {
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: `opacity ${duration}ms ease-out`
    },
    slideUp: {
      initial: { opacity: 0, transform: 'translateY(20px)' },
      animate: { opacity: 1, transform: 'translateY(0)' },
      transition: `all ${duration}ms ease-out`
    },
    slideDown: {
      initial: { opacity: 0, transform: 'translateY(-20px)' },
      animate: { opacity: 1, transform: 'translateY(0)' },
      transition: `all ${duration}ms ease-out`
    },
    slideLeft: {
      initial: { opacity: 0, transform: 'translateX(20px)' },
      animate: { opacity: 1, transform: 'translateX(0)' },
      transition: `all ${duration}ms ease-out`
    },
    slideRight: {
      initial: { opacity: 0, transform: 'translateX(-20px)' },
      animate: { opacity: 1, transform: 'translateX(0)' },
      transition: `all ${duration}ms ease-out`
    },
    scaleIn: {
      initial: { opacity: 0, transform: 'scale(0.95)' },
      animate: { opacity: 1, transform: 'scale(1)' },
      transition: `all ${duration}ms ease-out`
    },
    bounceIn: {
      initial: { opacity: 0, transform: 'scale(0.3)' },
      animate: { opacity: 1, transform: 'scale(1)' },
      transition: `all ${duration}ms cubic-bezier(0.68, -0.55, 0.265, 1.55)`
    }
  };

  const currentAnimation = animations[animation] || animations.fadeIn;

  // Intersection Observer pour les animations au scroll
  useEffect(() => {
    if (trigger !== 'scroll' || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setIsVisible(true);
            setHasAnimated(true);
          }
        });
      },
      { threshold }
    );

    observer.observe(containerRef.current);

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [trigger, threshold, hasAnimated]);

  // Animation au montage
  useEffect(() => {
    if (trigger === 'mount') {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [trigger, delay]);

  const style = {
    ...currentAnimation.initial,
    ...(isVisible ? currentAnimation.animate : {}),
    transition: currentAnimation.transition,
    transitionDelay: delay ? `${delay}ms` : '0ms'
  };

  return (
    <div
      ref={containerRef}
      style={style}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * Composant pour animations d'apparition séquentielle
 */
export const StaggeredContainer = ({ 
  children, 
  staggerDelay = 100,
  animation = 'slideUp',
  className = ''
}) => {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <AnimatedContainer
          key={index}
          animation={animation}
          delay={index * staggerDelay}
          trigger="mount"
        >
          {child}
        </AnimatedContainer>
      ))}
    </div>
  );
};

/**
 * Hook pour animations programmées
 */
export const useAnimation = (initialState = false) => {
  const [isAnimating, setIsAnimating] = useState(initialState);
  const timeoutRef = useRef(null);

  const startAnimation = (duration = 0) => {
    setIsAnimating(true);
    
    if (duration > 0) {
      timeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
      }, duration);
    }
  };

  const stopAnimation = () => {
    setIsAnimating(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isAnimating,
    startAnimation,
    stopAnimation
  };
};

/**
 * Composant de transition pour les changements de page
 */
export const PageTransition = ({ children, isVisible = true, className = '' }) => {
  const [shouldRender, setShouldRender] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!shouldRender) return null;

  return (
    <div 
      className={`transition-all duration-300 ${
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-4'
      } ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * Composant pour les micro-interactions (hover, focus, etc.)
 */
export const InteractiveElement = ({ 
  children, 
  hoverScale = 1.02,
  tapScale = 0.98,
  className = '',
  ...props 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsPressed(false);
  };
  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);

  const scale = isPressed ? tapScale : (isHovered ? hoverScale : 1);

  return (
    <div
      className={`transition-transform duration-150 ease-out cursor-pointer ${className}`}
      style={{ transform: `scale(${scale})` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      {...props}
    >
      {children}
    </div>
  );
};

AnimatedContainer.propTypes = {
  children: PropTypes.node.isRequired,
  animation: PropTypes.oneOf(['fadeIn', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'scaleIn', 'bounceIn']),
  duration: PropTypes.number,
  delay: PropTypes.number,
  trigger: PropTypes.oneOf(['mount', 'scroll']),
  threshold: PropTypes.number,
  className: PropTypes.string
};

StaggeredContainer.propTypes = {
  children: PropTypes.node.isRequired,
  staggerDelay: PropTypes.number,
  animation: PropTypes.string,
  className: PropTypes.string
};

PageTransition.propTypes = {
  children: PropTypes.node.isRequired,
  isVisible: PropTypes.bool,
  className: PropTypes.string
};

InteractiveElement.propTypes = {
  children: PropTypes.node.isRequired,
  hoverScale: PropTypes.number,
  tapScale: PropTypes.number,
  className: PropTypes.string
};

export default AnimatedContainer;