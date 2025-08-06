// src/components/launchfly-ui/OptimizedHero.js
'use client';

import { useEffect } from 'react';
import Hero from './Hero';

/**
 * Optimized Hero Component with A/B Testing Support
 * 
 * This wrapper extends the existing Hero component with:
 * - A/B test variant support
 * - Personalization based on visitor segments
 * - Conversion tracking
 */
export default function OptimizedHero({ 
  // Default props from original Hero
  title,
  subtitle,
  ctaText,
  ctaLink,
  secondaryCtaText,
  secondaryCtaLink,
  backgroundImage,
  backgroundOverlay,
  
  // Optimization props
  variant = null,
  segments = null,
  onImpression = null,
  onConversion = null
}) {
  // Apply variant props if provided
  const variantProps = variant?.props || {};
  
  // Merge props with variant overrides
  const finalProps = {
    title: variantProps.title || title,
    subtitle: variantProps.subtitle || subtitle,
    ctaText: variantProps.ctaText || ctaText,
    ctaLink: variantProps.ctaLink || ctaLink,
    secondaryCtaText: variantProps.secondaryCtaText || secondaryCtaText,
    secondaryCtaLink: variantProps.secondaryCtaLink || secondaryCtaLink,
    backgroundImage: variantProps.backgroundImage || backgroundImage,
    backgroundOverlay: variantProps.backgroundOverlay || backgroundOverlay
  };
  
  // Track impression on mount
  useEffect(() => {
    if (onImpression) {
      onImpression({
        component: 'Hero',
        variantId: variant?.variantId || 'control',
        segments
      });
    }
  }, []);
  
  // Handle CTA click tracking
  const handleCtaClick = (e) => {
    if (onConversion) {
      onConversion({
        component: 'Hero',
        variantId: variant?.variantId || 'control',
        ctaType: 'primary',
        segments
      });
    }
    // Don't prevent default - let the link work normally
  };
  
  const handleSecondaryCtaClick = (e) => {
    if (onConversion) {
      onConversion({
        component: 'Hero',
        variantId: variant?.variantId || 'control',
        ctaType: 'secondary',
        segments
      });
    }
  };
  
  // Clone the Hero component with tracking handlers
  return (
    <div onClick={(e) => {
      // Track CTA clicks
      const target = e.target.closest('a');
      if (target && target.href) {
        if (target.textContent === finalProps.ctaText) {
          handleCtaClick(e);
        } else if (target.textContent === finalProps.secondaryCtaText) {
          handleSecondaryCtaClick(e);
        }
      }
    }}>
      <Hero {...finalProps} />
    </div>
  );
}