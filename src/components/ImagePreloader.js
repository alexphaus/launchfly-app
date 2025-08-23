// src/components/ImagePreloader.js
'use client';

import { useEffect, useCallback } from 'react';
import { extractProductImageUrls } from '@/lib/image-utils';

export default function ImagePreloader({ products = [], priority = 'low', maxImages = 4 }) {
  const preloadImages = useCallback((imageUrls) => {
    // Only preload critical images to avoid network congestion
    const criticalImages = imageUrls.slice(0, maxImages);
    const deferredImages = imageUrls.slice(maxImages);
    
    // Preload critical images immediately
    criticalImages.forEach((url, index) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      link.fetchPriority = priority === 'high' ? 'high' : 'low';
      document.head.appendChild(link);
    });
    
    // Defer non-critical images using requestIdleCallback
    if (deferredImages.length > 0 && 'requestIdleCallback' in window) {
      requestIdleCallback(() => {
        deferredImages.forEach((url) => {
          const img = new Image();
          img.loading = 'lazy';
          img.src = url;
        });
      }, { timeout: 3000 });
    }
    
    console.log(`✅ Optimized image preloading: ${criticalImages.length} critical, ${deferredImages.length} deferred`);
  }, [maxImages, priority]);

  useEffect(() => {
    if (products && products.length > 0) {
      const imageUrls = extractProductImageUrls(products);
      
      if (imageUrls.length > 0) {
        // Use requestIdleCallback to avoid blocking main thread
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => preloadImages(imageUrls), { timeout: 1000 });
        } else {
          // Fallback for browsers without requestIdleCallback
          setTimeout(() => preloadImages(imageUrls), 100);
        }
      }
    }
  }, [products, preloadImages]);

  return null; // This component doesn't render anything
}
