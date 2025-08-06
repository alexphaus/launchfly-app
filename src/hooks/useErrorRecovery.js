/**
 * @fileoverview Error recovery hook for AI sales components
 * Provides error handling, retry logic, and fallback strategies
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import FallbackManager, { FALLBACK_STRATEGIES } from '../lib/error-handling/fallback-manager';
import { handleNetworkError, handleAsyncError } from '../lib/error-handling/error-boundary';

/**
 * Hook for error recovery and fallback management
 * @param {Object} options - Configuration options
 * @param {string} options.component - Component name for error tracking
 * @param {Function} options.onError - Error callback
 * @param {Function} options.analytics - Analytics client
 * @param {boolean} options.enableRetry - Enable automatic retry
 * @param {number} options.maxRetries - Maximum retry attempts
 * @returns {Object} Error recovery utilities
 */
export const useErrorRecovery = (options = {}) => {
  const {
    component = 'unknown',
    onError,
    analytics,
    enableRetry = true,
    maxRetries = 3
  } = options;

  const [error, setError] = useState(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [fallbackActive, setFallbackActive] = useState(false);
  
  const fallbackManagerRef = useRef(null);
  const lastErrorRef = useRef(null);
  const recoveryTimeoutRef = useRef(null);

  // Initialize fallback manager
  useEffect(() => {
    fallbackManagerRef.current = new FallbackManager({
      enableFallbacks: true,
      logErrors: true,
      retryAttempts: maxRetries,
      humanHandoffEnabled: true
    });

    if (analytics) {
      fallbackManagerRef.current.setAnalytics(analytics);
    }
  }, [analytics, maxRetries]);

  /**
   * Handle error with appropriate recovery strategy
   * @param {Error} error - Error to handle
   * @param {Object} context - Error context
   * @returns {Object} Recovery strategy
   */
  const handleError = useCallback(async (error, context = {}) => {
    const errorContext = {
      component,
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      ...context
    };

    setError(error);
    lastErrorRef.current = { error, context: errorContext };

    // Call external error handler
    onError?.(error, errorContext);

    // Determine error type and get fallback strategy
    const errorType = classifyError(error);
    const fallbackStrategy = await getFallbackStrategy(errorType, errorContext);

    return fallbackStrategy;
  }, [component, onError]);

  /**
   * Retry failed operation
   * @param {Function} operation - Operation to retry
   * @param {Object} context - Retry context
   * @returns {Promise} Operation result
   */
  const retryOperation = useCallback(async (operation, context = {}) => {
    if (retryCount >= maxRetries) {
      const fallbackStrategy = await getFallbackStrategy(
        FALLBACK_STRATEGIES.AI_UNAVAILABLE,
        { ...context, maxRetriesReached: true }
      );
      return fallbackStrategy;
    }

    setIsRecovering(true);
    setRetryCount(prev => prev + 1);

    try {
      // Calculate backoff delay
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));

      const result = await operation();
      
      // Success - reset error state
      clearError();
      return { success: true, data: result };

    } catch (retryError) {
      const strategy = await handleError(retryError, {
        ...context,
        isRetry: true,
        attempt: retryCount + 1
      });
      
      return strategy;
    } finally {
      setIsRecovering(false);
    }
  }, [retryCount, maxRetries, handleError]);

  /**
   * Execute operation with error handling
   * @param {Function} operation - Async operation to execute
   * @param {Object} options - Execution options
   * @returns {Promise} Operation result with error handling
   */
  const executeWithRecovery = useCallback(async (operation, executionOptions = {}) => {
    const { 
      fallbackValue = null, 
      retryOnFailure = enableRetry,
      context = {} 
    } = executionOptions;

    try {
      clearError();
      const result = await operation();
      return { success: true, data: result };

    } catch (error) {
      const strategy = await handleError(error, context);

      if (strategy.action === 'retry' && retryOnFailure) {
        return retryOperation(operation, context);
      }

      if (strategy.action === 'fallback_response') {
        setFallbackActive(true);
        return { 
          success: true, 
          data: fallbackValue || strategy.response,
          isFallback: true,
          strategy 
        };
      }

      return { 
        success: false, 
        error: error.message,
        strategy 
      };
    }
  }, [enableRetry, handleError, retryOperation]);

  /**
   * Get fallback strategy for error type
   * @param {string} errorType - Type of error
   * @param {Object} context - Error context
   * @returns {Object} Fallback strategy
   */
  const getFallbackStrategy = useCallback(async (errorType, context) => {
    if (!fallbackManagerRef.current) {
      return { action: 'default_error', message: 'Error handling unavailable' };
    }

    switch (errorType) {
      case FALLBACK_STRATEGIES.AI_UNAVAILABLE:
        return fallbackManagerRef.current.handleAIFailure(context);
      
      case FALLBACK_STRATEGIES.PAYMENT_FAILED:
        return fallbackManagerRef.current.handlePaymentFailure(context);
      
      case FALLBACK_STRATEGIES.NETWORK_ERROR:
        return fallbackManagerRef.current.handleNetworkError(context);
      
      case FALLBACK_STRATEGIES.RATE_LIMITED:
        return fallbackManagerRef.current.handleRateLimit(context);
      
      case FALLBACK_STRATEGIES.INTENT_DETECTION_FAILED:
        return fallbackManagerRef.current.handleIntentFailure(context);
      
      default:
        return {
          action: 'generic_error',
          message: 'An unexpected error occurred. Please try again.',
          showContactForm: true
        };
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setIsRecovering(false);
    setFallbackActive(false);
    lastErrorRef.current = null;

    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }
  }, []);

  /**
   * Force error recovery
   * @param {string} strategy - Recovery strategy to use
   */
  const forceRecovery = useCallback((strategy = 'clear') => {
    switch (strategy) {
      case 'clear':
        clearError();
        break;
      case 'retry':
        if (lastErrorRef.current) {
          retryOperation(() => {
            throw lastErrorRef.current.error;
          }, lastErrorRef.current.context);
        }
        break;
      case 'fallback':
        setFallbackActive(true);
        break;
    }
  }, [clearError, retryOperation]);

  /**
   * Get error recovery statistics
   * @returns {Object} Recovery statistics
   */
  const getRecoveryStats = useCallback(() => {
    return {
      currentError: error?.message || null,
      retryCount,
      isRecovering,
      fallbackActive,
      hasError: !!error,
      canRetry: retryCount < maxRetries,
      failureStats: fallbackManagerRef.current?.getFailureStats() || {}
    };
  }, [error, retryCount, isRecovering, fallbackActive, maxRetries]);

  /**
   * Set up auto-recovery timeout
   * @param {number} timeout - Timeout in milliseconds
   */
  const setAutoRecovery = useCallback((timeout = 30000) => {
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
    }

    recoveryTimeoutRef.current = setTimeout(() => {
      if (error && !isRecovering) {
        forceRecovery('clear');
      }
    }, timeout);
  }, [error, isRecovering, forceRecovery]);

  return {
    // State
    error,
    isRecovering,
    retryCount,
    fallbackActive,
    hasError: !!error,
    canRetry: retryCount < maxRetries,

    // Methods
    handleError,
    retryOperation,
    executeWithRecovery,
    clearError,
    forceRecovery,
    setAutoRecovery,
    getRecoveryStats,

    // Utilities
    fallbackManager: fallbackManagerRef.current
  };
};

/**
 * Classify error type for appropriate handling
 * @param {Error} error - Error to classify
 * @returns {string} Error type
 */
function classifyError(error) {
  const message = error.message?.toLowerCase() || '';
  const name = error.name?.toLowerCase() || '';

  // Network errors
  if (name.includes('networkerror') || 
      message.includes('network') || 
      message.includes('fetch') ||
      !navigator.onLine) {
    return FALLBACK_STRATEGIES.NETWORK_ERROR;
  }

  // Rate limiting
  if (message.includes('rate limit') || 
      message.includes('too many requests') ||
      error.status === 429) {
    return FALLBACK_STRATEGIES.RATE_LIMITED;
  }

  // Payment errors
  if (message.includes('payment') || 
      message.includes('stripe') ||
      message.includes('card')) {
    return FALLBACK_STRATEGIES.PAYMENT_FAILED;
  }

  // AI/OpenAI errors
  if (message.includes('openai') || 
      message.includes('ai') ||
      message.includes('completion') ||
      error.status === 503) {
    return FALLBACK_STRATEGIES.AI_UNAVAILABLE;
  }

  // Configuration errors
  if (message.includes('config') || 
      message.includes('configuration') ||
      name.includes('referenceerror')) {
    return FALLBACK_STRATEGIES.CONFIGURATION_ERROR;
  }

  // Intent detection errors
  if (message.includes('intent') || 
      message.includes('tracking')) {
    return FALLBACK_STRATEGIES.INTENT_DETECTION_FAILED;
  }

  // Analytics errors
  if (message.includes('analytics') || 
      message.includes('posthog')) {
    return FALLBACK_STRATEGIES.ANALYTICS_FAILED;
  }

  // Default to AI unavailable for unknown errors
  return FALLBACK_STRATEGIES.AI_UNAVAILABLE;
}

export default useErrorRecovery;