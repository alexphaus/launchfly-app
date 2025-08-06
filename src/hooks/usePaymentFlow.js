/**
 * @fileoverview Hook for managing payment flow in AI Sales Chat
 * Handles payment processing, status tracking, and error recovery
 */

import { useState, useCallback, useRef } from 'react';
import useAIChatStore from '../stores/ai-chat-store';

/**
 * Hook for payment flow management
 * @param {Object} options - Configuration options
 * @param {string} options.businessId - Business ID
 * @param {string} options.sessionId - Session ID
 * @param {Function} options.onPaymentSuccess - Success callback
 * @param {Function} options.onPaymentError - Error callback
 * @returns {Object} Payment utilities
 */
export const usePaymentFlow = (options = {}) => {
  const { businessId, sessionId, onPaymentSuccess, onPaymentError } = options;
  const [currentPaymentSession, setCurrentPaymentSession] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle, processing, success, error
  const [paymentError, setPaymentError] = useState(null);
  const paymentAttempts = useRef(0);
  
  const { addMessage } = useAIChatStore();

  /**
   * Process payment from AI function call
   * @param {Object} paymentData - Payment data from AI
   * @returns {Promise} Payment processing promise
   */
  const processAIPayment = useCallback(async (paymentData) => {
    try {
      setPaymentStatus('processing');
      setPaymentError(null);
      paymentAttempts.current += 1;

      // Validate payment data
      if (!paymentData.customerEmail || !paymentData.productId) {
        throw new Error('Missing required payment information');
      }

      // Create checkout session
      const response = await fetch('/api/stripe/ai-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'checkout', // Use hosted checkout for AI payments
          productId: paymentData.productId,
          productName: paymentData.productName,
          unitPrice: paymentData.unitPrice,
          finalPrice: paymentData.finalPrice,
          quantity: paymentData.quantity || 1,
          customerEmail: paymentData.customerEmail,
          customerName: paymentData.customerName,
          metadata: {
            conversationId: sessionId,
            businessId,
            aiAssisted: 'true',
            attempt: paymentAttempts.current
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Payment processing failed');
      }

      const checkoutData = await response.json();
      setCurrentPaymentSession(checkoutData);

      // Add payment message to chat
      addMessage({
        role: 'assistant',
        content: `Perfect! I've prepared your secure checkout. Click the button below to complete your purchase.`,
        metadata: {
          isPaymentRequest: true,
          paymentData: {
            ...paymentData,
            checkoutUrl: checkoutData.url,
            sessionId: checkoutData.sessionId
          }
        }
      });

      setPaymentStatus('success');
      onPaymentSuccess?.(checkoutData);

      return checkoutData;

    } catch (error) {
      console.error('Payment processing error:', error);
      setPaymentError(error.message);
      setPaymentStatus('error');
      
      // Add error message to chat
      addMessage({
        role: 'assistant',
        content: `I apologize, but there was an issue setting up your payment. ${getPaymentErrorMessage(error.message)}`,
        metadata: {
          isError: true
        }
      });

      onPaymentError?.(error.message);
      throw error;
    }
  }, [businessId, sessionId, addMessage, onPaymentSuccess, onPaymentError]);

  /**
   * Handle embedded payment completion
   * @param {Object} paymentResult - Payment result from Stripe
   */
  const handleEmbeddedPayment = useCallback(async (paymentResult) => {
    try {
      setPaymentStatus('processing');

      // Verify payment with backend
      const verification = await verifyPayment(paymentResult.paymentIntentId);
      
      if (verification.success) {
        setPaymentStatus('success');
        
        addMessage({
          role: 'assistant',
          content: `🎉 Payment successful! Thank you for your purchase. You'll receive a confirmation email shortly.`,
          metadata: {
            isSuccess: true,
            paymentId: paymentResult.paymentIntentId
          }
        });

        onPaymentSuccess?.(paymentResult);
      } else {
        throw new Error('Payment verification failed');
      }

    } catch (error) {
      setPaymentStatus('error');
      setPaymentError(error.message);
      
      addMessage({
        role: 'assistant',
        content: `There was an issue confirming your payment. Please contact support if you've been charged.`,
        metadata: {
          isError: true
        }
      });

      onPaymentError?.(error.message);
    }
  }, [addMessage, onPaymentSuccess, onPaymentError]);

  /**
   * Cancel current payment
   */
  const cancelPayment = useCallback(() => {
    setCurrentPaymentSession(null);
    setPaymentStatus('idle');
    setPaymentError(null);

    addMessage({
      role: 'assistant',
      content: `No problem! If you change your mind, just let me know and I can help you complete your purchase.`
    });
  }, [addMessage]);

  /**
   * Retry failed payment
   */
  const retryPayment = useCallback(async () => {
    if (currentPaymentSession?.paymentData) {
      await processAIPayment(currentPaymentSession.paymentData);
    }
  }, [currentPaymentSession, processAIPayment]);

  /**
   * Get payment session status
   * @param {string} sessionId - Checkout session ID
   * @returns {Object} Session status
   */
  const getPaymentStatus = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`/api/stripe/ai-checkout?sessionId=${sessionId}`);
      if (!response.ok) {
        throw new Error('Failed to get payment status');
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get payment status:', error);
      return null;
    }
  }, []);

  return {
    // State
    currentPaymentSession,
    paymentStatus,
    paymentError,
    paymentAttempts: paymentAttempts.current,

    // Actions
    processAIPayment,
    handleEmbeddedPayment,
    cancelPayment,
    retryPayment,
    getPaymentStatus
  };
};

/**
 * Verify payment completion
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Object} Verification result
 */
async function verifyPayment(paymentIntentId) {
  try {
    // In production, this would verify with your backend
    console.log('Verifying payment:', paymentIntentId);
    
    // Simulate verification
    return {
      success: true,
      paymentId: paymentIntentId,
      status: 'completed'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get user-friendly error message
 * @param {string} error - Error message
 * @returns {string} User-friendly message
 */
function getPaymentErrorMessage(error) {
  if (error.includes('email')) {
    return 'Please provide a valid email address.';
  }
  if (error.includes('price')) {
    return 'There was an issue with the pricing. Let me recalculate that for you.';
  }
  if (error.includes('API key')) {
    return 'Our payment system is temporarily unavailable. Please try again later.';
  }
  return 'Please try again or contact support if the issue persists.';
}