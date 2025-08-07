// hooks/useConversion.js
// Smart conversion tracking - optimized for high conversions

import { useState, useEffect, useCallback } from 'react';

export function useConversion() {
  const [intent, setIntent] = useState(0);
  const [triggers, setTriggers] = useState({
    timeOnPage: 0,
    scrolledPricing: false,
    exitAttempts: 0,
    returning: false,
    cartAbandoned: false
  });

  useEffect(() => {
    // Check returning visitor
    const visited = localStorage.getItem('visited');
    const cartAbandoned = localStorage.getItem('cart_abandoned');
    
    if (visited) {
      setTriggers(prev => ({ ...prev, returning: true }));
      setIntent(prev => prev + 20); // Returning = higher intent
    }
    
    if (cartAbandoned) {
      setTriggers(prev => ({ ...prev, cartAbandoned: true }));
      setIntent(100); // Max intent for cart abandoners
    }
    
    localStorage.setItem('visited', 'true');

    // Track time on page
    const startTime = Date.now();
    const timeInterval = setInterval(() => {
      const seconds = Math.floor((Date.now() - startTime) / 1000);
      setTriggers(prev => ({ ...prev, timeOnPage: seconds }));
      
      // Progressive intent increase based on time
      if (seconds === 30) setIntent(prev => prev + 10);
      if (seconds === 60) setIntent(prev => prev + 15);
      if (seconds === 120) setIntent(prev => prev + 20);
      if (seconds === 300) setIntent(prev => prev + 25); // 5 minutes = very high intent
    }, 1000);

    // Exit intent detection
    const handleMouseLeave = (e) => {
      if (e.clientY <= 0) {
        setTriggers(prev => ({ ...prev, exitAttempts: prev.exitAttempts + 1 }));
        setIntent(100); // Max intent on exit attempt
      }
    };

    // Advanced scroll tracking
    const handleScroll = () => {
      const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
      
      // Different scroll milestones
      if (scrollPercent > 60 && !triggers.scrolledPricing) {
        setTriggers(prev => ({ ...prev, scrolledPricing: true }));
        setIntent(prev => prev + 30);
      }
      
      // Deep scroll = high interest
      if (scrollPercent > 90) {
        setIntent(prev => Math.min(100, prev + 20));
      }
    };

    // Tab visibility change (user switching tabs = potential exit)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIntent(prev => Math.min(100, prev + 15));
      }
    };

    // Cart abandonment detection
    const handleBeforeUnload = () => {
      if (localStorage.getItem('conversion_attempt')) {
        localStorage.setItem('cart_abandoned', 'true');
      }
    };

    // Rapid mouse movement = nervous/uncertain behavior
    let lastMouseMove = Date.now();
    const handleMouseMove = () => {
      const now = Date.now();
      if (now - lastMouseMove < 50) { // Rapid movement
        setIntent(prev => Math.min(100, prev + 5));
      }
      lastMouseMove = now;
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('scroll', handleScroll);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(timeInterval);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Helper to track custom conversion events
  const trackEvent = useCallback((eventName, value = 10) => {
    setIntent(prev => Math.min(100, prev + value));
    
    // Store high-value events for analytics
    const events = JSON.parse(localStorage.getItem('conversion_events') || '[]');
    events.push({ 
      event: eventName, 
      timestamp: Date.now(),
      intent: intent + value,
      value 
    });
    localStorage.setItem('conversion_events', JSON.stringify(events.slice(-50)));
    
    // Special high-value events
    if (eventName === 'pricing_viewed') {
      setIntent(prev => Math.min(100, prev + 25));
    }
    if (eventName === 'checkout_attempt') {
      localStorage.setItem('conversion_attempt', 'true');
      setIntent(100);
    }
  }, [intent]);

  return {
    intent: Math.min(100, intent),
    triggers,
    trackEvent,
    isHighIntent: intent > 70,
    isMediumIntent: intent > 40 && intent <= 70,
    isLowIntent: intent <= 40
  };
}
