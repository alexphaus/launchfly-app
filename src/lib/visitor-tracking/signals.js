/**
 * @fileoverview Visitor behavior signal definitions and tracking
 * Defines what signals to track and how to interpret them
 */

/**
 * Signal weight configuration
 * Higher weights = more important for intent calculation
 */
export const SIGNAL_WEIGHTS = {
  mouseVelocity: 0.1,
  scrollDepth: 0.15,
  timeOnPage: 0.2,
  ctaHovers: 0.25,
  pricingViews: 0.3,
  exitIntent: 0.4,
  inactivityPeriods: -0.1, // Negative weight for inactivity
  viewedProducts: 0.2,
  returnVisitor: 0.15
};

/**
 * Intent thresholds for different actions
 */
export const INTENT_THRESHOLDS = {
  showChat: 45,
  proactiveMessage: 60,
  urgentIntervention: 80,
  exitIntent: 90
};

/**
 * Signal tracking configurations
 */
export const TRACKING_CONFIG = {
  // Mouse tracking
  mouse: {
    velocityThreshold: 50, // px/s for "active" movement
    idleThreshold: 3000, // ms before considering mouse idle
    sampleRate: 100 // ms between samples
  },
  
  // Scroll tracking
  scroll: {
    throttleDelay: 200, // ms
    significantScroll: 25, // % for meaningful scroll
    fastScrollThreshold: 500 // px/s for fast scrolling
  },
  
  // Element interaction tracking
  interaction: {
    hoverDelay: 500, // ms before counting as meaningful hover
    clickTracking: true,
    formInteraction: true
  },
  
  // Time-based tracking
  time: {
    sessionTimeout: 1800000, // 30 minutes
    inactivityThreshold: 30000, // 30 seconds
    updateInterval: 5000 // 5 seconds
  },
  
  // Exit intent detection
  exitIntent: {
    enabled: true,
    mouseLeaveThreshold: 10, // px from top
    rapidMovementThreshold: 300, // px/s upward
    minimumTimeOnPage: 10000 // 10 seconds
  }
};

/**
 * Define trackable elements and their signal values
 */
export const TRACKABLE_ELEMENTS = {
  // Call-to-action elements
  cta: {
    selectors: [
      '[data-track="cta"]',
      '.cta-button',
      'button[type="submit"]',
      '.btn-primary',
      '.get-started',
      '.sign-up',
      '.buy-now'
    ],
    signals: {
      hover: 'ctaHover',
      click: 'ctaClick'
    },
    weight: 3
  },
  
  // Pricing elements
  pricing: {
    selectors: [
      '[data-track="pricing"]',
      '.pricing-table',
      '.price',
      '.plan-card',
      '.subscription-plan'
    ],
    signals: {
      view: 'pricingView',
      hover: 'pricingHover',
      click: 'pricingClick'
    },
    weight: 4
  },
  
  // Product elements
  product: {
    selectors: [
      '[data-track="product"]',
      '.product-card',
      '.feature-card',
      '.service-item'
    ],
    signals: {
      view: 'productView',
      hover: 'productHover',
      click: 'productClick'
    },
    weight: 2
  },
  
  // Contact/support elements
  contact: {
    selectors: [
      '[data-track="contact"]',
      '.contact-form',
      '.support-link',
      '.help-button'
    ],
    signals: {
      hover: 'contactHover',
      click: 'contactClick'
    },
    weight: 3
  },
  
  // Navigation elements
  navigation: {
    selectors: [
      'nav a',
      '.menu-item',
      '.nav-link'
    ],
    signals: {
      click: 'navigationClick'
    },
    weight: 1
  }
};

/**
 * Device-specific signal adjustments
 */
export const DEVICE_ADJUSTMENTS = {
  mobile: {
    mouseVelocity: 0, // No mouse on mobile
    touchTracking: true,
    scrollDepthMultiplier: 1.2, // Mobile users scroll more
    ctaHoverWeight: 0.5 // Hover less meaningful on mobile
  },
  
  tablet: {
    mouseVelocity: 0.5, // Some tablets have mouse
    touchTracking: true,
    scrollDepthMultiplier: 1.1
  },
  
  desktop: {
    mouseVelocity: 1,
    touchTracking: false,
    scrollDepthMultiplier: 1,
    ctaHoverWeight: 1
  }
};

/**
 * Calculate device type from user agent and screen size
 * @param {string} userAgent - User agent string
 * @param {number} screenWidth - Screen width in pixels
 * @returns {string} Device type
 */
export function getDeviceType(userAgent = navigator.userAgent, screenWidth = window.innerWidth) {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent);
  
  if (isMobile && !isTablet) {
    return 'mobile';
  } else if (isTablet || (screenWidth >= 768 && screenWidth <= 1024)) {
    return 'tablet';
  } else {
    return 'desktop';
  }
}

/**
 * Get browser information
 * @param {string} userAgent - User agent string
 * @returns {Object} Browser info
 */
export function getBrowserInfo(userAgent = navigator.userAgent) {
  const browsers = [
    { name: 'chrome', pattern: /chrome/i },
    { name: 'firefox', pattern: /firefox/i },
    { name: 'safari', pattern: /safari/i },
    { name: 'edge', pattern: /edge/i },
    { name: 'opera', pattern: /opera/i }
  ];
  
  const browser = browsers.find(b => b.pattern.test(userAgent));
  
  return {
    name: browser?.name || 'unknown',
    userAgent,
    language: navigator.language || 'en',
    platform: navigator.platform || 'unknown'
  };
}

/**
 * Validate signal data
 * @param {Object} signals - Signal data to validate
 * @returns {Object} Validated and normalized signals
 */
export function validateSignals(signals) {
  const validated = {
    mouseVelocity: Math.max(0, Math.min(1000, signals.mouseVelocity || 0)),
    scrollDepth: Math.max(0, Math.min(100, signals.scrollDepth || 0)),
    timeOnPage: Math.max(0, signals.timeOnPage || 0),
    ctaHovers: Math.max(0, signals.ctaHovers || 0),
    pricingViews: Math.max(0, signals.pricingViews || 0),
    exitIntent: Boolean(signals.exitIntent),
    inactivityPeriods: Math.max(0, signals.inactivityPeriods || 0),
    viewedProducts: Array.isArray(signals.viewedProducts) ? signals.viewedProducts : [],
    deviceInfo: signals.deviceInfo || {},
    referrer: signals.referrer || 'direct'
  };
  
  return validated;
}

/**
 * Signal event types for analytics
 */
export const SIGNAL_EVENTS = {
  MOUSE_MOVE: 'mouse_move',
  SCROLL: 'scroll',
  CTA_HOVER: 'cta_hover',
  CTA_CLICK: 'cta_click',
  PRICING_VIEW: 'pricing_view',
  PRODUCT_VIEW: 'product_view',
  EXIT_INTENT: 'exit_intent',
  INACTIVITY: 'inactivity',
  SESSION_START: 'session_start',
  SESSION_END: 'session_end'
};