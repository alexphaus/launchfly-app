// src/components/ResponsiveAIActivityPage.js
import React, { useState, useEffect } from 'react';
import AIActivityPage from './AIActivityPage';

/**
 * Responsive wrapper for AI Activity Page
 * Handles responsive breakpoints and mobile optimizations
 */
const ResponsiveAIActivityPage = (props) => {
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setIsMobile(window.innerWidth < 768);
    };

    if (typeof window !== 'undefined') {
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Add responsive context to props
  const responsiveProps = {
    ...props,
    isMobile,
    windowWidth
  };

  return <AIActivityPage {...responsiveProps} />;
};

export default ResponsiveAIActivityPage;