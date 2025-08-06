/**
 * @fileoverview Visitor behavior tracking implementation
 * Tracks user interactions and calculates intent signals
 */

import debounce from 'lodash.debounce';
import { 
  TRACKING_CONFIG, 
  TRACKABLE_ELEMENTS, 
  SIGNAL_EVENTS,
  getDeviceType,
  getBrowserInfo 
} from './signals';

/**
 * Main visitor tracking class
 */
export class VisitorTracker {
  constructor(options = {}) {
    this.options = {
      ...TRACKING_CONFIG,
      ...options
    };
    
    this.signals = {
      mouseVelocity: 0,
      scrollDepth: 0,
      timeOnPage: 0,
      ctaHovers: 0,
      pricingViews: 0,
      exitIntent: false,
      inactivityPeriods: 0,
      viewedProducts: [],
      deviceInfo: {},
      referrer: document.referrer || 'direct'
    };
    
    this.state = {
      sessionStartTime: Date.now(),
      lastActivity: Date.now(),
      lastMousePosition: { x: 0, y: 0 },
      lastScrollPosition: 0,
      mouseVelocities: [],
      isActive: true,
      observers: new Map(),
      eventListeners: new Map()
    };
    
    this.callbacks = new Map();
    this.isTracking = false;
    
    // Initialize device info
    this.signals.deviceInfo = {
      type: getDeviceType(),
      browser: getBrowserInfo(),
      screen: {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio || 1
      }
    };
  }

  /**
   * Start tracking visitor behavior
   */
  start() {
    if (this.isTracking) return;
    
    this.isTracking = true;
    this.setupEventListeners();
    this.setupIntersectionObservers();
    this.startPeriodicUpdates();
    
    this.emit(SIGNAL_EVENTS.SESSION_START, this.signals);
  }

  /**
   * Stop tracking
   */
  stop() {
    if (!this.isTracking) return;
    
    this.isTracking = false;
    this.removeEventListeners();
    this.disconnectObservers();
    this.stopPeriodicUpdates();
    
    this.emit(SIGNAL_EVENTS.SESSION_END, this.signals);
  }

  /**
   * Setup event listeners for tracking
   */
  setupEventListeners() {
    // Mouse movement tracking
    const mouseMove = (e) => this.trackMouseMovement(e);
    const debouncedMouseMove = debounce(mouseMove, this.options.mouse.sampleRate);
    this.addEventListener('mousemove', debouncedMouseMove);

    // Scroll tracking
    const scroll = () => this.trackScroll();
    const debouncedScroll = debounce(scroll, this.options.scroll.throttleDelay);
    this.addEventListener('scroll', debouncedScroll);

    // Exit intent detection
    if (this.options.exitIntent.enabled) {
      this.addEventListener('mouseleave', (e) => this.detectExitIntent(e));
    }

    // Activity tracking
    const activity = () => this.updateActivity();
    ['click', 'keydown', 'touchstart', 'mousemove'].forEach(event => {
      this.addEventListener(event, activity);
    });

    // Element interaction tracking
    this.setupElementTracking();
  }

  /**
   * Track mouse movement and calculate velocity
   */
  trackMouseMovement(event) {
    const now = Date.now();
    const { x, y } = this.state.lastMousePosition;
    const deltaX = event.clientX - x;
    const deltaY = event.clientY - y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const timeDelta = now - this.state.lastActivity;
    
    if (timeDelta > 0) {
      const velocity = distance / (timeDelta / 1000); // px/s
      this.state.mouseVelocities.push(velocity);
      
      // Keep only recent velocities (last 10 samples)
      if (this.state.mouseVelocities.length > 10) {
        this.state.mouseVelocities.shift();
      }
      
      // Calculate average velocity
      this.signals.mouseVelocity = this.state.mouseVelocities.reduce((a, b) => a + b, 0) / this.state.mouseVelocities.length;
    }
    
    this.state.lastMousePosition = { x: event.clientX, y: event.clientY };
    this.emit(SIGNAL_EVENTS.MOUSE_MOVE, { velocity: this.signals.mouseVelocity });
  }

  /**
   * Track scroll behavior
   */
  trackScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollDepth = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    
    this.signals.scrollDepth = Math.max(this.signals.scrollDepth, scrollDepth);
    this.state.lastScrollPosition = scrollTop;
    
    this.emit(SIGNAL_EVENTS.SCROLL, { 
      depth: this.signals.scrollDepth,
      position: scrollTop 
    });
  }

  /**
   * Detect exit intent
   */
  detectExitIntent(event) {
    const { exitIntent } = this.options;
    const timeOnPage = Date.now() - this.state.sessionStartTime;
    
    if (timeOnPage < exitIntent.minimumTimeOnPage) return;
    
    // Check if mouse is leaving from top of page
    if (event.clientY <= exitIntent.mouseLeaveThreshold) {
      this.signals.exitIntent = true;
      this.emit(SIGNAL_EVENTS.EXIT_INTENT, this.signals);
    }
  }

  /**
   * Setup tracking for specific elements
   */
  setupElementTracking() {
    Object.entries(TRACKABLE_ELEMENTS).forEach(([type, config]) => {
      config.selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          this.trackElement(element, type, config);
        });
      });
    });
  }

  /**
   * Track individual element interactions
   */
  trackElement(element, type, config) {
    // Hover tracking
    if (config.signals.hover) {
      let hoverTimer;
      
      const mouseEnter = () => {
        hoverTimer = setTimeout(() => {
          this.incrementSignal(config.signals.hover);
          this.emit(config.signals.hover, { element, type });
        }, this.options.interaction.hoverDelay);
      };
      
      const mouseLeave = () => {
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
      };
      
      element.addEventListener('mouseenter', mouseEnter);
      element.addEventListener('mouseleave', mouseLeave);
    }

    // Click tracking
    if (config.signals.click) {
      element.addEventListener('click', () => {
        this.incrementSignal(config.signals.click);
        this.emit(config.signals.click, { element, type });
      });
    }

    // View tracking with Intersection Observer
    if (config.signals.view) {
      this.observeElement(element, () => {
        this.incrementSignal(config.signals.view);
        this.emit(config.signals.view, { element, type });
      });
    }
  }

  /**
   * Setup intersection observers for view tracking
   */
  setupIntersectionObservers() {
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const callback = this.state.observers.get(entry.target);
          if (callback) {
            callback();
            // Remove one-time observers
            observer.unobserve(entry.target);
            this.state.observers.delete(entry.target);
          }
        }
      });
    }, {
      threshold: 0.5 // Element must be 50% visible
    });

    this.intersectionObserver = observer;
  }

  /**
   * Observe element for visibility
   */
  observeElement(element, callback) {
    if (this.intersectionObserver) {
      this.state.observers.set(element, callback);
      this.intersectionObserver.observe(element);
    }
  }

  /**
   * Increment a signal counter
   */
  incrementSignal(signalType) {
    const signalMap = {
      ctaHover: 'ctaHovers',
      pricingView: 'pricingViews',
      productView: 'viewedProducts'
    };
    
    const signalKey = signalMap[signalType];
    if (signalKey) {
      if (Array.isArray(this.signals[signalKey])) {
        // For arrays (like viewedProducts), add unique entries
        const productId = `product_${Date.now()}`;
        if (!this.signals[signalKey].includes(productId)) {
          this.signals[signalKey].push(productId);
        }
      } else {
        // For counters
        this.signals[signalKey]++;
      }
    }
  }

  /**
   * Update activity status
   */
  updateActivity() {
    const now = Date.now();
    const inactiveTime = now - this.state.lastActivity;
    
    if (inactiveTime > this.options.time.inactivityThreshold) {
      this.signals.inactivityPeriods++;
      this.emit(SIGNAL_EVENTS.INACTIVITY, { 
        duration: inactiveTime,
        periods: this.signals.inactivityPeriods 
      });
    }
    
    this.state.lastActivity = now;
    this.state.isActive = true;
  }

  /**
   * Start periodic updates
   */
  startPeriodicUpdates() {
    this.updateInterval = setInterval(() => {
      this.signals.timeOnPage = Math.floor((Date.now() - this.state.sessionStartTime) / 1000);
      this.checkInactivity();
      this.emit('update', this.signals);
    }, this.options.time.updateInterval);
  }

  /**
   * Check for inactivity
   */
  checkInactivity() {
    const now = Date.now();
    const inactiveTime = now - this.state.lastActivity;
    
    if (inactiveTime > this.options.time.inactivityThreshold && this.state.isActive) {
      this.state.isActive = false;
      this.signals.inactivityPeriods++;
      this.emit(SIGNAL_EVENTS.INACTIVITY, { duration: inactiveTime });
    }
  }

  /**
   * Stop periodic updates
   */
  stopPeriodicUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Add event listener and track it
   */
  addEventListener(event, handler) {
    document.addEventListener(event, handler);
    
    if (!this.state.eventListeners.has(event)) {
      this.state.eventListeners.set(event, []);
    }
    this.state.eventListeners.get(event).push(handler);
  }

  /**
   * Remove all event listeners
   */
  removeEventListeners() {
    this.state.eventListeners.forEach((handlers, event) => {
      handlers.forEach(handler => {
        document.removeEventListener(event, handler);
      });
    });
    this.state.eventListeners.clear();
  }

  /**
   * Disconnect all observers
   */
  disconnectObservers() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    this.state.observers.clear();
  }

  /**
   * Subscribe to signal events
   */
  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
  }

  /**
   * Unsubscribe from signal events
   */
  off(event, callback) {
    if (this.callbacks.has(event)) {
      const callbacks = this.callbacks.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit signal event
   */
  emit(event, data) {
    if (this.callbacks.has(event)) {
      this.callbacks.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Tracker callback error:', error);
        }
      });
    }
  }

  /**
   * Get current signals
   */
  getSignals() {
    return { ...this.signals };
  }

  /**
   * Reset signals (for testing)
   */
  reset() {
    this.signals = {
      mouseVelocity: 0,
      scrollDepth: 0,
      timeOnPage: 0,
      ctaHovers: 0,
      pricingViews: 0,
      exitIntent: false,
      inactivityPeriods: 0,
      viewedProducts: [],
      deviceInfo: this.signals.deviceInfo,
      referrer: this.signals.referrer
    };
    this.state.sessionStartTime = Date.now();
    this.state.lastActivity = Date.now();
  }
}