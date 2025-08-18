// src/components/ImagePreloader.js
'use client';

import { useEffect } from 'react';
import { extractProductImageUrls } from '@/lib/image-utils';

export default function ImagePreloader({ products = [] }) {
  useEffect(() => {
    if (products && products.length > 0) {
      const imageUrls = extractProductImageUrls(products);
      
      if (imageUrls.length > 0) {
        console.log('🚀 Super-aggressive image preloading started:', imageUrls.length, 'images');
        
        // Create preload links for immediate caching
        imageUrls.forEach((url, index) => {
          // Method 1: Preload link tags (highest priority)
          const link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'image';
          link.href = url;
          link.fetchPriority = 'high';
          document.head.appendChild(link);
          
          // Method 2: Image objects for immediate download
          const img = new Image();
          img.fetchPriority = 'high';
          img.loading = 'eager';
          img.src = url;
          
          // Method 3: Force browser to prioritize first few images
          if (index < 6) {
            setTimeout(() => {
              fetch(url, { 
                mode: 'no-cors',
                priority: 'high',
                cache: 'force-cache'
              }).catch(() => {
                // Ignore errors, just trying to cache
              });
            }, index * 5);
          }
        });
        
        console.log('✅ Image preloading initiated for optimal performance');
      }
    }
  }, [products]);

  return null; // This component doesn't render anything
}
