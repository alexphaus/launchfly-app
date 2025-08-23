// src/components/PerformanceMonitor.js
'use client';

import { useEffect } from 'react';

/**
 * Performance Monitor - Tracks Core Web Vitals and page performance
 * Reports metrics to help identify performance issues
 */
export default function PerformanceMonitor({ businessId, enabled = true }) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Track Core Web Vitals
    const trackWebVitals = () => {
      // Largest Contentful Paint (LCP)
      if ('PerformanceObserver' in window) {
        try {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            
            // Report LCP
            reportMetric('LCP', lastEntry.startTime, {
              element: lastEntry.element?.tagName || 'unknown',
              url: lastEntry.url || window.location.href
            });
          });
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

          // First Input Delay (FID)
          const fidObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry) => {
              reportMetric('FID', entry.processingStart - entry.startTime, {
                eventType: entry.name
              });
            });
          });
          fidObserver.observe({ type: 'first-input', buffered: true });

          // Cumulative Layout Shift (CLS)
          let clsValue = 0;
          const clsObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry) => {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            });
          });
          clsObserver.observe({ type: 'layout-shift', buffered: true });

          // Report CLS when page visibility changes
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
              reportMetric('CLS', clsValue);
            }
          });

        } catch (error) {
          console.warn('Performance monitoring error:', error);
        }
      }

      // Navigation timing metrics
      if ('performance' in window && performance.timing) {
        const timing = performance.timing;
        const navigation = performance.navigation;
        
        const metrics = {
          // Page load metrics
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          loadComplete: timing.loadEventEnd - timing.navigationStart,
          
          // Network metrics
          dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
          tcpConnect: timing.connectEnd - timing.connectStart,
          serverResponse: timing.responseEnd - timing.requestStart,
          
          // Rendering metrics
          domProcessing: timing.domComplete - timing.domLoading,
          
          // Navigation type
          navigationType: navigation.type // 0=navigate, 1=reload, 2=back_forward
        };

        // Report navigation metrics
        Object.entries(metrics).forEach(([name, value]) => {
          if (value > 0) {
            reportMetric(name, value);
          }
        });
      }
    };

    // Track resource loading performance
    const trackResourcePerformance = () => {
      if ('performance' in window && performance.getEntriesByType) {
        const resources = performance.getEntriesByType('resource');
        
        const slowResources = resources
          .filter(resource => resource.duration > 1000) // Resources taking >1s
          .map(resource => ({
            name: resource.name.split('/').pop() || resource.name,
            duration: Math.round(resource.duration),
            size: resource.transferSize || 0,
            type: resource.initiatorType
          }));

        if (slowResources.length > 0) {
          reportMetric('slowResources', slowResources.length, {
            resources: slowResources.slice(0, 5) // Top 5 slowest
          });
        }
      }
    };

    // Report metric to analytics
    const reportMetric = (name, value, metadata = {}) => {
      // Use requestIdleCallback to avoid blocking main thread
      const report = () => {
        const data = {
          metric: name,
          value: Math.round(value),
          timestamp: Date.now(),
          businessId,
          url: window.location.href,
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          connection: navigator.connection ? {
            effectiveType: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink
          } : null,
          ...metadata
        };

        // Send to analytics endpoint
        if ('sendBeacon' in navigator) {
          navigator.sendBeacon('/api/analytics/performance', JSON.stringify(data));
        } else {
          fetch('/api/analytics/performance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            keepalive: true
          }).catch(() => {
            // Ignore errors in performance reporting
          });
        }
      };

      if ('requestIdleCallback' in window) {
        requestIdleCallback(report, { timeout: 5000 });
      } else {
        setTimeout(report, 100);
      }
    };

    // Initialize performance tracking
    if (document.readyState === 'complete') {
      trackWebVitals();
      trackResourcePerformance();
    } else {
      window.addEventListener('load', () => {
        // Delay to ensure all resources are loaded
        setTimeout(() => {
          trackWebVitals();
          trackResourcePerformance();
        }, 100);
      });
    }

    // Track page visibility for engagement metrics
    let pageVisibilityStart = Date.now();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const visibleTime = Date.now() - pageVisibilityStart;
        if (visibleTime > 1000) { // Only track if visible for >1s
          reportMetric('pageVisibleTime', visibleTime);
        }
      } else {
        pageVisibilityStart = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [businessId, enabled]);

  return null; // This component doesn't render anything
}

/**
 * Hook for manual performance tracking
 */
export function usePerformanceTracker(businessId) {
  const trackCustomMetric = (name, value, metadata = {}) => {
    if (typeof window === 'undefined') return;

    const data = {
      metric: name,
      value,
      timestamp: Date.now(),
      businessId,
      url: window.location.href,
      ...metadata
    };

    if ('sendBeacon' in navigator) {
      navigator.sendBeacon('/api/analytics/performance', JSON.stringify(data));
    } else {
      fetch('/api/analytics/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
      }).catch(() => {});
    }
  };

  return { trackCustomMetric };
}
