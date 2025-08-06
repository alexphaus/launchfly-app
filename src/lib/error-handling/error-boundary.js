/**
 * @fileoverview React error boundary for AI sales components
 * Catches and handles component errors gracefully
 */

import React from 'react';
import { AlertTriangle, RefreshCw, MessageSquare, Phone } from 'lucide-react';

/**
 * Error boundary class component
 */
export class AIErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to analytics
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('AI Component Error:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI based on component type
      const fallbackUI = this.props.fallbackComponent || (
        <DefaultErrorFallback
          error={this.state.error}
          componentType={this.props.componentType}
          onRetry={this.handleRetry}
          retryCount={this.state.retryCount}
          showContactForm={this.props.showContactForm}
        />
      );

      return fallbackUI;
    }

    return this.props.children;
  }
}

/**
 * Default error fallback component
 */
const DefaultErrorFallback = ({ 
  error, 
  componentType, 
  onRetry, 
  retryCount,
  showContactForm = true 
}) => {
  const getErrorMessage = () => {
    switch (componentType) {
      case 'chat':
        return {
          title: 'Chat Temporarily Unavailable',
          message: 'Our AI assistant is experiencing technical difficulties. You can still contact us directly.',
          icon: MessageSquare,
          color: 'blue'
        };
      case 'payment':
        return {
          title: 'Payment Processing Error',
          message: 'We encountered an issue processing payments. Please try again or contact support.',
          icon: AlertTriangle,
          color: 'red'
        };
      case 'analytics':
        return {
          title: 'Analytics Loading Error',
          message: 'Unable to load performance data. Please refresh the page.',
          icon: RefreshCw,
          color: 'yellow'
        };
      case 'config':
        return {
          title: 'Configuration Error',
          message: 'Unable to load configuration settings. Using default values.',
          icon: AlertTriangle,
          color: 'orange'
        };
      default:
        return {
          title: 'Something Went Wrong',
          message: 'We encountered an unexpected error. Please try refreshing the page.',
          icon: AlertTriangle,
          color: 'gray'
        };
    }
  };

  const errorConfig = getErrorMessage();
  const Icon = errorConfig.icon;

  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-800'
  };

  return (
    <div className={`p-6 rounded-lg border ${colorClasses[errorConfig.color]} max-w-md mx-auto`}>
      <div className="flex items-start space-x-3">
        <Icon className="w-6 h-6 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold mb-2">{errorConfig.title}</h3>
          <p className="text-sm mb-4">{errorConfig.message}</p>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            {retryCount < 3 && (
              <button
                onClick={onRetry}
                className="flex items-center justify-center px-4 py-2 bg-white border border-current rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </button>
            )}
            
            {showContactForm && (
              <ContactButton componentType={componentType} />
            )}
          </div>
          
          {/* Error Details (Development) */}
          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-4">
              <summary className="text-xs cursor-pointer text-gray-600">
                Error Details (Development)
              </summary>
              <pre className="text-xs mt-2 p-2 bg-gray-100 rounded overflow-auto">
                {error.toString()}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Contact button component
 */
const ContactButton = ({ componentType }) => {
  const handleContact = () => {
    // In production, this would open a contact form or support chat
    if (componentType === 'payment') {
      window.open('mailto:billing@yourcompany.com?subject=Payment Issue');
    } else {
      window.open('mailto:support@yourcompany.com?subject=Technical Issue');
    }
  };

  return (
    <button
      onClick={handleContact}
      className="flex items-center justify-center px-4 py-2 bg-current text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
    >
      <Phone className="w-4 h-4 mr-2" />
      Contact Support
    </button>
  );
};

/**
 * Higher-order component to wrap components with error boundary
 */
export const withErrorBoundary = (WrappedComponent, options = {}) => {
  const WithErrorBoundaryComponent = (props) => (
    <AIErrorBoundary {...options}>
      <WrappedComponent {...props} />
    </AIErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
};

/**
 * Hook for error handling in functional components
 */
export const useErrorHandler = () => {
  const [error, setError] = React.useState(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error) => {
    setError(error);
    
    // Log error
    console.error('Component error:', error);
    
    // In production, send to error tracking service
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: false
      });
    }
  }, []);

  // Throw error to be caught by error boundary
  if (error) {
    throw error;
  }

  return { handleError, resetError };
};

/**
 * Async error handler for promises
 */
export const handleAsyncError = (asyncFn) => {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      console.error('Async operation failed:', error);
      
      // Return error instead of throwing to allow graceful handling
      return {
        success: false,
        error: error.message,
        originalError: error
      };
    }
  };
};

/**
 * Network error handler
 */
export const handleNetworkError = (error, operation) => {
  const isNetworkError = 
    error.name === 'NetworkError' ||
    error.message.includes('fetch') ||
    error.message.includes('network') ||
    !navigator.onLine;

  if (isNetworkError) {
    return {
      type: 'network',
      message: 'Connection lost. Please check your internet connection.',
      retry: true,
      offline: !navigator.onLine
    };
  }

  const isTimeoutError = 
    error.name === 'TimeoutError' ||
    error.message.includes('timeout');

  if (isTimeoutError) {
    return {
      type: 'timeout',
      message: 'Request timed out. Please try again.',
      retry: true
    };
  }

  return {
    type: 'unknown',
    message: 'An unexpected error occurred.',
    retry: true
  };
};

export default AIErrorBoundary;