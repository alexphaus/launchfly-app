// src/lib/analytics-tracker.js
/**
 * Lightweight Analytics Tracker for Launchfly
 * 
 * Non-blocking event collection using requestIdleCallback
 * Tracks clicks, scroll depth, time on page, and conversions
 */

export const ANALYTICS_SCRIPT = `
(function() {
  // Initialize tracker
  const LaunchflyTracker = {
    sessionId: null,
    visitorId: null,
    businessId: null,
    experimentId: null,
    variantId: null,
    startTime: Date.now(),
    maxScrollDepth: 0,
    events: [],
    
    // Initialize with page data
    init: function(config) {
      this.sessionId = config.sessionId || this.generateId();
      this.visitorId = config.visitorId || this.getOrCreateVisitorId();
      this.businessId = config.businessId;
      this.experimentId = config.experimentId;
      this.variantId = config.variantId;
      
      // Set up listeners
      this.setupListeners();
      
      // Track page view
      this.track('pageview', {
        url: window.location.href,
        referrer: document.referrer,
        title: document.title
      });
    },
    
    // Get or create visitor ID cookie
    getOrCreateVisitorId: function() {
      const cookieName = 'launchfly_visitor_id';
      
      // Try to get existing cookie
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === cookieName) {
          return value;
        }
      }
      
      // Create new visitor ID
      const visitorId = this.generateId();
      
      // Set cookie for 1 year
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1);
      document.cookie = cookieName + '=' + visitorId + ';expires=' + expires.toUTCString() + ';path=/;SameSite=Lax';
      
      return visitorId;
    },
    
    // Generate unique ID
    generateId: function() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    // Set up event listeners
    setupListeners: function() {
      // Click tracking
      document.addEventListener('click', (e) => {
        const target = e.target.closest('a, button, [data-track]');
        if (target) {
          const trackData = {
            element: target.tagName.toLowerCase(),
            text: target.textContent?.substring(0, 50),
            href: target.href,
            dataTrack: target.dataset.track
          };
          
          // Special handling for CTA buttons
          if (target.classList.contains('cta') || 
              target.textContent?.toLowerCase().includes('get started') ||
              target.textContent?.toLowerCase().includes('buy now') ||
              target.dataset.track === 'conversion') {
            this.track('conversion', trackData);
          } else {
            this.track('click', trackData);
          }
        }
      });
      
      // Scroll depth tracking
      let scrollTimer;
      window.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          const scrollPercent = Math.round(
            (window.scrollY + window.innerHeight) / document.body.scrollHeight * 100
          );
          if (scrollPercent > this.maxScrollDepth) {
            this.maxScrollDepth = scrollPercent;
            if (scrollPercent % 25 === 0) { // Track at 25%, 50%, 75%, 100%
              this.track('scroll', { depth: scrollPercent });
            }
          }
        }, 100);
      });
      
      // Time on page tracking
      window.addEventListener('beforeunload', () => {
        this.track('engagement', {
          timeOnPage: Math.round((Date.now() - this.startTime) / 1000),
          maxScrollDepth: this.maxScrollDepth
        });
        this.flush(); // Send any remaining events
      });
      
      // Visibility change tracking
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.track('visibility', { hidden: true });
        } else {
          this.track('visibility', { hidden: false });
        }
      });
    },
    
    // Track an event
    track: function(eventType, eventData = {}) {
      const event = {
        type: eventType,
        data: eventData,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        visitorId: this.visitorId,
        businessId: this.businessId,
        experimentId: this.experimentId,
        variantId: this.variantId,
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
      
      this.events.push(event);
      
      // Batch events and send when idle
      if (this.events.length >= 10 || eventType === 'conversion') {
        this.flush();
      } else {
        this.scheduleFlush();
      }
    },
    
    // Schedule flush using requestIdleCallback
    scheduleFlush: function() {
      if (this.flushScheduled) return;
      
      this.flushScheduled = true;
      
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          this.flush();
          this.flushScheduled = false;
        }, { timeout: 5000 });
      } else {
        setTimeout(() => {
          this.flush();
          this.flushScheduled = false;
        }, 1000);
      }
    },
    
    // Send events to server
    flush: function() {
      if (this.events.length === 0) return;
      
      const eventsToSend = [...this.events];
      this.events = [];
      
      // Use sendBeacon for reliability
      if ('sendBeacon' in navigator) {
        navigator.sendBeacon('/api/analytics/track', JSON.stringify({
          events: eventsToSend
        }));
      } else {
        // Fallback to fetch
        fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: eventsToSend }),
          keepalive: true
        }).catch(() => {
          // Restore events on failure
          this.events = eventsToSend.concat(this.events);
        });
      }
    }
  };
  
  // Expose tracker globally
  window.LaunchflyTracker = LaunchflyTracker;
})();
`;

/**
 * Get tracking configuration for a page
 */
export function getTrackingConfig(visitorId, businessId, experimentData = null) {
  return {
    visitorId,
    businessId,
    experimentId: experimentData?.experimentId || null,
    variantId: experimentData?.variantId || null,
    sessionId: null // Will be generated client-side
  };
}

/**
 * Generate tracking script with configuration
 */
export function generateTrackingScript(config) {
  return `
    ${ANALYTICS_SCRIPT}
    // Initialize tracker with configuration
    window.addEventListener('DOMContentLoaded', function() {
      if (window.LaunchflyTracker) {
        window.LaunchflyTracker.init(${JSON.stringify(config)});
      }
    });
  `;
}

/**
 * Component to inject tracking script
 */
export function TrackingScript({ config }) {
  const script = generateTrackingScript(config);
  
  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      defer
    />
  );
}