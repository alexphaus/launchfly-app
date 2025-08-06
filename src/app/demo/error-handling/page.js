/**
 * @fileoverview Demo page for AI Sales Error Handling & Fallbacks
 * Demonstrates error recovery and graceful degradation
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Shield,
  RefreshCw,
  Wifi,
  Zap,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Network
} from 'lucide-react';
import ErrorMonitor from '../../../components/ai-sales/ErrorMonitor';
import { useErrorRecovery } from '../../../hooks/useErrorRecovery';
import { useNetworkMonitor } from '../../../hooks/useNetworkMonitor';

export default function ErrorHandlingDemo() {
  const [simulatedError, setSimulatedError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    error,
    isRecovering,
    retryCount,
    fallbackActive,
    hasError,
    executeWithRecovery,
    clearError,
    forceRecovery,
    getRecoveryStats
  } = useErrorRecovery({
    component: 'error-demo',
    enableRetry: true,
    maxRetries: 3
  });

  const {
    isOnline,
    latency,
    networkQuality,
    checkConnectivity,
    executeWithNetworkRetry
  } = useNetworkMonitor();

  const errorTypes = [
    {
      id: 'ai_timeout',
      name: 'AI Timeout',
      description: 'Simulate AI service timeout',
      color: 'red',
      icon: Clock
    },
    {
      id: 'network_error',
      name: 'Network Error',
      description: 'Simulate network connectivity issues',
      color: 'orange',
      icon: Wifi
    },
    {
      id: 'payment_failed',
      name: 'Payment Error',
      description: 'Simulate payment processing failure',
      color: 'purple',
      icon: XCircle
    },
    {
      id: 'rate_limit',
      name: 'Rate Limit',
      description: 'Simulate API rate limiting',
      color: 'yellow',
      icon: Zap
    },
    {
      id: 'config_error',
      name: 'Config Error',
      description: 'Simulate configuration problems',
      color: 'blue',
      icon: AlertTriangle
    }
  ];

  const features = [
    {
      icon: Shield,
      title: 'Graceful Degradation',
      description: 'System continues functioning when components fail',
      color: 'green'
    },
    {
      icon: RefreshCw,
      title: 'Automatic Retry',
      description: 'Smart retry logic with exponential backoff',
      color: 'blue'
    },
    {
      icon: Activity,
      title: 'Real-time Monitoring',
      description: 'Live system health and error tracking',
      color: 'purple'
    },
    {
      icon: Network,
      title: 'Network Resilience',
      description: 'Offline queue and connectivity recovery',
      color: 'orange'
    }
  ];

  // Simulate different types of errors
  const simulateError = async (errorType) => {
    setIsLoading(true);
    setSimulatedError(errorType);

    const operation = async () => {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      switch (errorType) {
        case 'ai_timeout':
          throw new Error('AI service timeout - response took too long');
        case 'network_error':
          throw new Error('Network error - failed to fetch');
        case 'payment_failed':
          throw new Error('Payment processing failed - card declined');
        case 'rate_limit':
          const rateLimitError = new Error('Too many requests');
          rateLimitError.status = 429;
          throw rateLimitError;
        case 'config_error':
          throw new Error('Configuration error - invalid API key');
        default:
          throw new Error('Unknown error occurred');
      }
    };

    try {
      await executeWithRecovery(operation, {
        context: { errorType, demo: true }
      });
    } catch (err) {
      console.log('Error handled by recovery system:', err);
    } finally {
      setIsLoading(false);
      setSimulatedError(null);
    }
  };

  // Test network resilience
  const testNetworkResilience = async () => {
    setIsLoading(true);

    const operation = async () => {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('Health check failed');
      return response.json();
    };

    try {
      const result = await executeWithNetworkRetry(operation, {
        maxRetries: 3,
        retryDelay: 1000,
        queueWhenOffline: true
      });
      console.log('Network test result:', result);
    } catch (err) {
      console.log('Network test failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getColorClasses = (color) => {
    const colors = {
      red: 'bg-red-100 text-red-600 border-red-200',
      orange: 'bg-orange-100 text-orange-600 border-orange-200',
      yellow: 'bg-yellow-100 text-yellow-600 border-yellow-200',
      green: 'bg-green-100 text-green-600 border-green-200',
      blue: 'bg-blue-100 text-blue-600 border-blue-200',
      purple: 'bg-purple-100 text-purple-600 border-purple-200'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Error Handling & Fallbacks Demo
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive error recovery system with graceful degradation, 
              automatic retries, and real-time monitoring for uninterrupted AI sales operations.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const colorClasses = getColorClasses(feature.color);
              
              return (
                <div key={index} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 border ${colorClasses}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* System Status */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            <Activity className="w-6 h-6 mr-2 text-blue-600" />
            Live System Status
          </h2>
          
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <StatusCard
              title="Network Status"
              value={isOnline ? 'Online' : 'Offline'}
              status={isOnline ? 'good' : 'error'}
              icon={isOnline ? CheckCircle : XCircle}
            />
            <StatusCard
              title="Connection Quality"
              value={networkQuality.quality}
              status={networkQuality.quality === 'excellent' ? 'good' : 'warning'}
              icon={Activity}
            />
            <StatusCard
              title="Latency"
              value={latency ? `${latency}ms` : 'Unknown'}
              status={latency < 300 ? 'good' : 'warning'}
              icon={Zap}
            />
            <StatusCard
              title="Error Recovery"
              value={hasError ? 'Active' : 'Standby'}
              status={hasError ? 'warning' : 'good'}
              icon={Shield}
            />
          </div>

          {/* Current Error Display */}
          {hasError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-red-800">Current Error</h4>
                  <p className="text-red-700 text-sm mt-1">{error?.message}</p>
                  <div className="flex items-center space-x-4 mt-3">
                    <span className="text-xs text-red-600">
                      Retry attempts: {retryCount}/3
                    </span>
                    {isRecovering && (
                      <span className="text-xs text-blue-600 flex items-center">
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        Recovering...
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2 mt-3">
                    <button
                      onClick={() => forceRecovery('retry')}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                    >
                      Force Retry
                    </button>
                    <button
                      onClick={clearError}
                      className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                    >
                      Clear Error
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Simulation */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            <AlertTriangle className="w-6 h-6 mr-2 text-orange-600" />
            Error Simulation Testing
          </h2>
          
          <p className="text-gray-600 mb-6">
            Test different error scenarios to see how the system handles failures gracefully.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {errorTypes.map((errorType) => {
              const Icon = errorType.icon;
              const isActive = simulatedError === errorType.id;
              
              return (
                <motion.button
                  key={errorType.id}
                  onClick={() => simulateError(errorType.id)}
                  disabled={isLoading}
                  className={`p-4 border-2 rounded-lg text-left transition-all hover:shadow-md disabled:opacity-50 ${
                    isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg border ${getColorClasses(errorType.color)}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{errorType.name}</h3>
                      <p className="text-sm text-gray-600">{errorType.description}</p>
                    </div>
                    {isActive && (
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Network Testing */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            <Network className="w-6 h-6 mr-2 text-green-600" />
            Network Resilience Testing
          </h2>
          
          <p className="text-gray-600 mb-6">
            Test network connectivity and offline queue functionality.
          </p>

          <div className="flex space-x-4">
            <button
              onClick={testNetworkResilience}
              disabled={isLoading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Network className="w-4 h-4 mr-2" />
              )}
              Test Network Resilience
            </button>
            
            <button
              onClick={checkConnectivity}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              <Wifi className="w-4 h-4 mr-2" />
              Check Connectivity
            </button>
          </div>
        </div>

        {/* Recovery Statistics */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            <Activity className="w-6 h-6 mr-2 text-purple-600" />
            Recovery Statistics
          </h2>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap">
              {JSON.stringify(getRecoveryStats(), null, 2)}
            </pre>
          </div>
        </div>
      </div>

      {/* Error Monitor */}
      <ErrorMonitor visible={true} position="bottom-right" />
    </div>
  );
}

/**
 * Status card component
 */
const StatusCard = ({ title, value, status, icon: Icon }) => {
  const statusColors = {
    good: 'text-green-600 bg-green-100 border-green-200',
    warning: 'text-yellow-600 bg-yellow-100 border-yellow-200',
    error: 'text-red-600 bg-red-100 border-red-200'
  };

  return (
    <div className="text-center">
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg border mb-2 ${statusColors[status]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-semibold text-gray-900">{value}</h3>
      <p className="text-sm text-gray-600">{title}</p>
    </div>
  );
};