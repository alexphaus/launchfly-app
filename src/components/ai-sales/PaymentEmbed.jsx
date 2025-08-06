/**
 * @fileoverview Embedded Stripe payment component for AI Sales Chat
 * Handles payment processing directly within the chat interface
 */

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Lock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

/**
 * Payment embed wrapper component
 * @param {Object} props - Component props
 * @param {Object} props.paymentData - Payment session data
 * @param {Function} props.onSuccess - Success callback
 * @param {Function} props.onError - Error callback
 * @param {Function} props.onCancel - Cancel callback
 * @returns {JSX.Element}
 */
const PaymentEmbed = ({ paymentData, onSuccess, onError, onCancel }) => {
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create payment intent when component mounts
  useEffect(() => {
    createPaymentIntent();
  }, [paymentData]);

  const createPaymentIntent = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/stripe/ai-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'payment_intent',
          productId: paymentData.productId,
          productName: paymentData.productName,
          unitPrice: paymentData.unitPrice,
          finalPrice: paymentData.finalPrice,
          quantity: paymentData.quantity || 1,
          customerEmail: paymentData.customerEmail,
          customerName: paymentData.customerName,
          metadata: {
            conversationId: paymentData.conversationId,
            aiAssisted: 'true'
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment session');
      }

      const data = await response.json();
      setClientSecret(data.clientSecret);

    } catch (err) {
      console.error('Payment intent creation failed:', err);
      setError(err.message);
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PaymentLoading />;
  }

  if (error) {
    return <PaymentError error={error} onRetry={createPaymentIntent} onCancel={onCancel} />;
  }

  if (!clientSecret) {
    return <PaymentError error="Payment session not available" onCancel={onCancel} />;
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#2563eb',
        colorBackground: '#ffffff',
        colorText: '#374151',
        colorDanger: '#ef4444',
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '6px',
        borderRadius: '8px',
      },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg border border-gray-200 p-4 mt-3"
    >
      <Elements stripe={stripePromise} options={options}>
        <PaymentForm
          paymentData={paymentData}
          onSuccess={onSuccess}
          onError={onError}
          onCancel={onCancel}
        />
      </Elements>
    </motion.div>
  );
};

/**
 * Payment form component
 */
const PaymentForm = ({ paymentData, onSuccess, onError, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/success`,
        receipt_email: paymentData.customerEmail,
      },
      redirect: 'if_required'
    });

    if (error) {
      if (error.type === 'card_error' || error.type === 'validation_error') {
        setMessage(error.message);
      } else {
        setMessage('An unexpected error occurred.');
      }
      onError?.(error.message);
    } else {
      // Payment succeeded
      onSuccess?.({
        paymentIntentId: error?.payment_intent?.id,
        amount: paymentData.finalPrice,
        currency: 'usd'
      });
      setMessage('Payment successful!');
    }

    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Payment Summary */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            {paymentData.productName}
          </span>
          <span className="text-sm font-semibold text-gray-900">
            ${paymentData.finalPrice.toFixed(2)}
          </span>
        </div>
        
        {paymentData.finalPrice < paymentData.unitPrice && (
          <div className="flex items-center justify-between text-xs text-green-600">
            <span>AI Assistant Discount</span>
            <span>-${(paymentData.unitPrice - paymentData.finalPrice).toFixed(2)}</span>
          </div>
        )}
        
        <div className="flex items-center mt-2 pt-2 border-t border-gray-200">
          <Lock className="w-3 h-3 text-gray-500 mr-1" />
          <span className="text-xs text-gray-500">Secure payment powered by Stripe</span>
        </div>
      </div>

      {/* Payment Element */}
      <div className="space-y-3">
        <PaymentElement 
          options={{
            layout: 'tabs'
          }}
        />
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-lg text-sm ${
              message.includes('successful') 
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            <div className="flex items-center">
              {message.includes('successful') ? (
                <CheckCircle className="w-4 h-4 mr-2" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              {message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div className="flex space-x-2 pt-2">
        <motion.button
          type="button"
          onClick={onCancel}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
          disabled={processing}
        >
          Cancel
        </motion.button>
        
        <motion.button
          type="submit"
          disabled={!stripe || processing}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <div className="flex items-center justify-center">
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Pay ${paymentData.finalPrice.toFixed(2)}
              </>
            )}
          </div>
        </motion.button>
      </div>
    </form>
  );
};

/**
 * Loading state component
 */
const PaymentLoading = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="bg-white rounded-lg border border-gray-200 p-6 mt-3"
  >
    <div className="flex items-center justify-center space-x-3">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      <span className="text-gray-700">Setting up secure payment...</span>
    </div>
  </motion.div>
);

/**
 * Error state component
 */
const PaymentError = ({ error, onRetry, onCancel }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-lg border border-red-200 p-4 mt-3"
  >
    <div className="flex items-start space-x-3">
      <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
      <div className="flex-1">
        <h4 className="text-sm font-medium text-red-800">Payment Error</h4>
        <p className="text-sm text-red-700 mt-1">{error}</p>
        <div className="flex space-x-2 mt-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
            >
              Try Again
            </button>
          )}
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </motion.div>
);

export default PaymentEmbed;