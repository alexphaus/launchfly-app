/**
 * @fileoverview Network monitoring hook for AI sales system
 * Detects connectivity issues and manages offline/online states
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Network monitoring hook
 * @param {Object} options - Configuration options
 * @param {Function} options.onOnline - Callback when coming online
 * @param {Function} options.onOffline - Callback when going offline
 * @param {number} options.pingInterval - Ping interval in milliseconds
 * @param {string} options.pingUrl - URL to ping for connectivity check
 * @returns {Object} Network state and utilities
 */
export const useNetworkMonitor = (options = {}) => {
  const {
    onOnline,
    onOffline,
    pingInterval = 30000, // 30 seconds
    pingUrl = '/api/health'
  } = options;

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [connectionType, setConnectionType] = useState('unknown');
  const [latency, setLatency] = useState(null);
  const [downtime, setDowntime] = useState(0);
  const [lastOnlineTime, setLastOnlineTime] = useState(Date.now());
  
  const pingIntervalRef = useRef(null);
  const downtimeIntervalRef = useRef(null);
  const offlineStartRef = useRef(null);
  const retryQueueRef = useRef([]);

  // Monitor connection type if available
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = navigator.connection;
      setConnectionType(connection.effectiveType || 'unknown');

      const handleConnectionChange = () => {
        setConnectionType(connection.effectiveType || 'unknown');
      };

      connection.addEventListener('change', handleConnectionChange);
      return () => connection.removeEventListener('change', handleConnectionChange);
    }
  }, []);

  /**
   * Ping server to check connectivity
   * @returns {Promise<Object>} Ping result
   */
  const pingServer = useCallback(async () => {
    const startTime = performance.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(pingUrl, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const endTime = performance.now();
      const responseLatency = Math.round(endTime - startTime);

      setLatency(responseLatency);

      return {
        success: response.ok,
        latency: responseLatency,
        status: response.status
      };

    } catch (error) {
      const endTime = performance.now();
      const responseLatency = Math.round(endTime - startTime);

      return {
        success: false,
        latency: responseLatency,
        error: error.name === 'AbortError' ? 'timeout' : error.message
      };
    }
  }, [pingUrl]);

  /**
   * Handle online state change
   * @param {boolean} online - Whether online
   */
  const handleNetworkChange = useCallback((online) => {
    const wasOnline = isOnline;
    setIsOnline(online);

    if (online && !wasOnline) {
      // Coming back online
      setLastOnlineTime(Date.now());
      
      if (offlineStartRef.current) {
        const totalDowntime = Date.now() - offlineStartRef.current;
        setDowntime(totalDowntime);
        offlineStartRef.current = null;
      }

      // Clear downtime interval
      if (downtimeIntervalRef.current) {
        clearInterval(downtimeIntervalRef.current);
        downtimeIntervalRef.current = null;
      }

      // Process retry queue
      processRetryQueue();
      
      onOnline?.();
      
    } else if (!online && wasOnline) {
      // Going offline
      offlineStartRef.current = Date.now();
      
      // Start downtime counter
      downtimeIntervalRef.current = setInterval(() => {
        if (offlineStartRef.current) {
          setDowntime(Date.now() - offlineStartRef.current);
        }
      }, 1000);

      onOffline?.();
    }
  }, [isOnline, onOnline, onOffline]);

  /**
   * Process queued operations when coming back online
   */
  const processRetryQueue = useCallback(async () => {
    const queue = [...retryQueueRef.current];
    retryQueueRef.current = [];

    for (const queuedOperation of queue) {
      try {
        await queuedOperation.operation();
        queuedOperation.resolve?.();
      } catch (error) {
        queuedOperation.reject?.(error);
      }
    }
  }, []);

  /**
   * Add operation to retry queue
   * @param {Function} operation - Operation to retry when online
   * @returns {Promise} Promise that resolves when operation completes
   */
  const queueForRetry = useCallback((operation) => {
    return new Promise((resolve, reject) => {
      retryQueueRef.current.push({
        operation,
        resolve,
        reject,
        timestamp: Date.now()
      });
    });
  }, []);

  /**
   * Perform connectivity check
   * @returns {Promise<boolean>} Whether online
   */
  const checkConnectivity = useCallback(async () => {
    if (typeof navigator === 'undefined') return true;

    // Quick check using navigator.onLine
    if (!navigator.onLine) {
      handleNetworkChange(false);
      return false;
    }

    // Detailed check using server ping
    const pingResult = await pingServer();
    const online = pingResult.success;
    
    handleNetworkChange(online);
    return online;
  }, [handleNetworkChange, pingServer]);

  /**
   * Force network status refresh
   */
  const refreshNetworkStatus = useCallback(async () => {
    await checkConnectivity();
  }, [checkConnectivity]);

  /**
   * Get network quality assessment
   * @returns {Object} Network quality info
   */
  const getNetworkQuality = useCallback(() => {
    if (!isOnline) {
      return { quality: 'offline', description: 'No connection' };
    }

    if (latency === null) {
      return { quality: 'unknown', description: 'Checking...' };
    }

    if (latency < 100) {
      return { quality: 'excellent', description: 'Excellent connection' };
    } else if (latency < 300) {
      return { quality: 'good', description: 'Good connection' };
    } else if (latency < 1000) {
      return { quality: 'fair', description: 'Fair connection' };
    } else {
      return { quality: 'poor', description: 'Poor connection' };
    }
  }, [isOnline, latency]);

  /**
   * Execute operation with network retry logic
   * @param {Function} operation - Operation to execute
   * @param {Object} options - Execution options
   * @returns {Promise} Operation result
   */
  const executeWithNetworkRetry = useCallback(async (operation, executeOptions = {}) => {
    const { 
      maxRetries = 3, 
      retryDelay = 1000,
      queueWhenOffline = true 
    } = executeOptions;

    if (!isOnline && queueWhenOffline) {
      return queueForRetry(operation);
    }

    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Check if it's a network error
        const isNetworkError = 
          error.name === 'NetworkError' ||
          error.message.includes('fetch') ||
          !isOnline;

        if (isNetworkError && attempt < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
          
          // Check connectivity before retry
          await checkConnectivity();
          
          if (!isOnline && queueWhenOffline) {
            return queueForRetry(operation);
          }
        } else if (attempt >= maxRetries) {
          break;
        }
      }
    }

    throw lastError;
  }, [isOnline, queueForRetry, checkConnectivity]);

  // Set up network event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => checkConnectivity();
    const handleOffline = () => handleNetworkChange(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkConnectivity, handleNetworkChange]);

  // Set up periodic connectivity checks
  useEffect(() => {
    if (pingInterval > 0) {
      pingIntervalRef.current = setInterval(checkConnectivity, pingInterval);
      
      return () => {
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
      };
    }
  }, [checkConnectivity, pingInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (downtimeIntervalRef.current) {
        clearInterval(downtimeIntervalRef.current);
      }
    };
  }, []);

  return {
    // Network state
    isOnline,
    connectionType,
    latency,
    downtime,
    lastOnlineTime,
    queuedOperations: retryQueueRef.current.length,

    // Network quality
    networkQuality: getNetworkQuality(),

    // Methods
    checkConnectivity,
    refreshNetworkStatus,
    pingServer,
    queueForRetry,
    executeWithNetworkRetry,

    // Utilities
    isSlowConnection: latency > 1000,
    hasRecentDowntime: downtime > 0 && Date.now() - lastOnlineTime < 300000, // 5 minutes
    connectionStable: isOnline && latency !== null && latency < 1000
  };
};

export default useNetworkMonitor;