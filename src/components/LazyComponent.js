// src/components/LazyComponent.js
'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * LazyComponent - Renders children only when they come into viewport
 * Improves initial page load by deferring non-critical components
 */
export default function LazyComponent({ 
  children, 
  fallback = null, 
  rootMargin = '100px',
  threshold = 0.1,
  triggerOnce = true 
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Skip intersection observer if component should always render
    if (!triggerOnce && isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) {
            setHasTriggered(true);
            observer.unobserve(element);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      {
        rootMargin,
        threshold
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [rootMargin, threshold, triggerOnce, isVisible]);

  const shouldRender = isVisible || hasTriggered;

  return (
    <div ref={elementRef}>
      {shouldRender ? children : fallback}
    </div>
  );
}

/**
 * LazySection - Wrapper for lazy-loading entire sections
 */
export function LazySection({ children, className = '', ...props }) {
  return (
    <LazyComponent 
      fallback={
        <div className={`min-h-[200px] bg-gray-50 animate-pulse ${className}`} />
      }
      {...props}
    >
      {children}
    </LazyComponent>
  );
}
