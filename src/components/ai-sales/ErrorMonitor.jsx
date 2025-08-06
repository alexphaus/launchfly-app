/**
 * @fileoverview Error monitoring component for AI sales system
 * Provides real-time error tracking and system status monitoring
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  Wifi,
  WifiOff,
  Clock,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Activity,
  Zap,
  Shield
} from 'lucide-react';
import { useErrorRecovery } from '../../hooks/useErrorRecovery';
import { useNetworkMonitor } from '../../hooks/useNetworkMonitor';

/**
 * Error monitoring component
 * @param {Object} props - Component props
 * @param {Object} props.analytics - Analytics client
 * @param {boolean} props.visible - Whether to show the monitor
 * @param {string} props.position - Position on screen
 * @returns {JSX.Element}
 */
const ErrorMonitor = ({ 
  analytics, 
  visible = process.env.NODE_ENV === 'development',
  position = 'bottom-left' 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [systemHealth, setSystemHealth] = useState('good');
  const [alerts, setAlerts] = useState([]);
  const [showDetails, setShowDetails] = useState(false);

  // Error recovery hook
  const {
    error,
    isRecovering,
    retryCount,
    fallbackActive,
    hasError,
    canRetry,
    getRecoveryStats,
    clearError,
    forceRecovery
  } = useErrorRecovery({
    component: 'ai-sales-system',
    analytics,
    enableRetry: true,
    maxRetries: 3
  });

  // Network monitoring hook
  const {
    isOnline,
    connectionType,
    latency,
    downtime,
    networkQuality,
    checkConnectivity,
    refreshNetworkStatus,
    queuedOperations,
    isSlowConnection
  } = useNetworkMonitor({
    onOnline: () => {
      addAlert('info', 'Connection restored', 'Back online');
      setSystemHealth('good');
    },
    onOffline: () => {
      addAlert('error', 'Connection lost', 'Working offline');
      setSystemHealth('degraded');
    },
    pingInterval: 30000
  });

  // Position classes
  const positionClasses = {
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4'
  };

  // Add alert to queue
  const addAlert = (type, title, message) => {
    const alert = {
      id: Date.now(),
      type,
      title,
      message,
      timestamp: Date.now()
    };

    setAlerts(prev => [...prev.slice(-4), alert]); // Keep last 5 alerts

    // Auto-remove info alerts after 5 seconds
    if (type === 'info') {
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== alert.id));
      }, 5000);
    }
  };

  // Remove alert
  const removeAlert = (alertId) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  // Update system health based on various factors
  useEffect(() => {
    if (!isOnline) {
      setSystemHealth('offline');
    } else if (hasError || fallbackActive) {
      setSystemHealth('degraded');
    } else if (isSlowConnection) {
      setSystemHealth('slow');
    } else {
      setSystemHealth('good');
    }
  }, [isOnline, hasError, fallbackActive, isSlowConnection]);

  // Monitor for new errors
  useEffect(() => {
    if (hasError) {
      addAlert('error', 'System Error', error?.message || 'Unknown error occurred');
    }
  }, [hasError, error]);

  // Get system status
  const getSystemStatus = () => {
    const status = {
      good: { color: 'green', icon: CheckCircle, label: 'All Systems Operational' },
      degraded: { color: 'yellow', icon: AlertTriangle, label: 'Degraded Performance' },
      slow: { color: 'orange', icon: Clock, label: 'Slow Connection' },
      offline: { color: 'red', icon: WifiOff, label: 'Offline' }
    };

    return status[systemHealth] || status.good;
  };

  const status = getSystemStatus();
  const StatusIcon = status.icon;

  if (!visible) return null;

  return (
    <div className={`fixed ${positionClasses[position]} z-50 font-mono text-xs`}>
      {/* Alerts */}
      <AnimatePresence>
        {alerts.map((alert) => (
          <Alert
            key={alert.id}
            alert={alert}
            onClose={() => removeAlert(alert.id)}
          />
        ))}
      </AnimatePresence>

      {/* Main Monitor */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`mt-2 rounded-lg border-2 bg-white shadow-lg cursor-pointer ${
          isExpanded ? 'rounded-b-none border-b-0' : ''
        } ${
          systemHealth === 'good' ? 'border-green-300' :
          systemHealth === 'degraded' ? 'border-yellow-300' :
          systemHealth === 'slow' ? 'border-orange-300' :
          'border-red-300'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="p-3 flex items-center space-x-3">
          <div className={`rounded-full p-1 ${
            systemHealth === 'good' ? 'bg-green-100 text-green-600' :
            systemHealth === 'degraded' ? 'bg-yellow-100 text-yellow-600' :
            systemHealth === 'slow' ? 'bg-orange-100 text-orange-600' :
            'bg-red-100 text-red-600'
          }`}>
            <StatusIcon className="w-4 h-4" />
          </div>
          
          <div className="flex-1">
            <div className="font-semibold">{status.label}</div>
            <div className="text-gray-500 flex items-center space-x-2">
              {isOnline ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              <span>{networkQuality.description}</span>
              {latency && <span>({latency}ms)</span>}
            </div>
          </div>

          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </motion.div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border-2 border-t-0 border-gray-300 rounded-b-lg shadow-lg"
          >
            <div className="p-4 space-y-4 max-w-sm">
              {/* System Status */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center">
                  <Activity className="w-4 h-4 mr-1" />
                  System Status
                </h4>
                <div className="space-y-1 text-xs">
                  <StatusRow label="Network" value={isOnline ? 'Online' : 'Offline'} status={isOnline ? 'good' : 'error'} />
                  <StatusRow label="Connection" value={connectionType} status="neutral" />
                  <StatusRow label="Latency" value={latency ? `${latency}ms` : 'Unknown'} status={latency < 500 ? 'good' : 'warning'} />
                  <StatusRow label="AI Service" value={hasError ? 'Error' : 'Operational'} status={hasError ? 'error' : 'good'} />
                  <StatusRow label="Fallback" value={fallbackActive ? 'Active' : 'Inactive'} status={fallbackActive ? 'warning' : 'good'} />
                </div>
              </div>

              {/* Error Details */}
              {hasError && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center text-red-600">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Current Error
                  </h4>
                  <div className="bg-red-50 border border-red-200 rounded p-2 text-xs">
                    <div className="font-medium">{error?.message || 'Unknown error'}</div>
                    <div className="text-red-600 mt-1">
                      Retry attempts: {retryCount}/3
                    </div>
                    {canRetry && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          forceRecovery('retry');
                        }}
                        className="mt-2 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                      >
                        Retry Now
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Recovery Status */}
              {isRecovering && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center text-blue-600">
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                    Recovery in Progress
                  </h4>
                  <div className="text-xs text-blue-600">
                    Attempting to recover from error...
                  </div>
                </div>
              )}

              {/* Queue Status */}
              {queuedOperations > 0 && (
                <div>
                  <h4 className="font-semibold mb-1 flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    Queued Operations
                  </h4>
                  <div className="text-xs text-gray-600">
                    {queuedOperations} operations waiting for connection
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    refreshNetworkStatus();
                  }}
                  className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                >
                  <RefreshCw className="w-3 h-3 inline mr-1" />
                  Refresh
                </button>
                
                {hasError && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearError();
                    }}
                    className="flex-1 px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                  >
                    Clear Error
                  </button>
                )}
              </div>

              {/* Detailed Stats Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetails(!showDetails);
                }}
                className="w-full text-xs text-gray-500 hover:text-gray-700"
              >
                {showDetails ? 'Hide' : 'Show'} Detailed Stats
              </button>

              {/* Detailed Statistics */}
              {showDetails && (
                <div className="border-t pt-2">
                  <div className="space-y-1 text-xs">
                    <div>Downtime: {downtime > 0 ? `${Math.round(downtime / 1000)}s` : 'None'}</div>
                    <div>Recovery Stats: {JSON.stringify(getRecoveryStats())}</div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Status row component
 */
const StatusRow = ({ label, value, status }) => {
  const statusColors = {
    good: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600',
    neutral: 'text-gray-600'
  };

  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}:</span>
      <span className={statusColors[status]}>{value}</span>
    </div>
  );
};

/**
 * Alert component
 */
const Alert = ({ alert, onClose }) => {
  const alertColors = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800'
  };

  const AlertIcon = alert.type === 'error' ? AlertTriangle : 
                   alert.type === 'success' ? CheckCircle :
                   Activity;

  return (
    <motion.div
      initial={{ opacity: 0, x: -100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={`mb-2 p-3 rounded-lg border ${alertColors[alert.type]} max-w-sm`}
    >
      <div className="flex items-start space-x-2">
        <AlertIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-xs">{alert.title}</div>
          <div className="text-xs opacity-90">{alert.message}</div>
          <div className="text-xs opacity-70 mt-1">
            {new Date(alert.timestamp).toLocaleTimeString()}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-current opacity-70 hover:opacity-100"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
};

export default ErrorMonitor;