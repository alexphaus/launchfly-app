// app/sites/[subdomain]/success/page.js
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import * as LaunchflyUI from '@/components/launchfly-ui';

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const sessionId = searchParams.get('session_id');
  const subdomain = params.subdomain;
  
  const [paymentStatus, setPaymentStatus] = useState('loading');
  const [orderDetails, setOrderDetails] = useState(null);

  useEffect(() => {
    if (sessionId) {
      // You could verify the payment with Stripe here
      // For now, we'll assume success if we have a session_id
      setPaymentStatus('success');
      setOrderDetails({
        sessionId,
        subdomain
      });
    } else {
      setPaymentStatus('error');
    }
  }, [sessionId]);

  if (paymentStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-red-500 text-6xl mb-6">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Payment Error</h1>
          <p className="text-gray-600 mb-6">
            There was an issue processing your payment. Please try again or contact support.
          </p>
          <a
            href={`/sites/${subdomain}`}
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Store
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <LaunchflyUI.NavBar 
        businessName={subdomain}
        links={[
          { title: "Home", href: `/sites/${subdomain}` },
          { title: "About", href: `/sites/${subdomain}/about` },
          { title: "Contact", href: `/sites/${subdomain}/contact` }
        ]}
      />

      {/* Success Content */}
      <div className="pt-20 pb-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Success Icon */}
          <div className="text-green-500 text-8xl mb-8">✅</div>
          
          {/* Success Message */}
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            Payment Successful!
          </h1>
          
          <p className="text-xl text-gray-600 mb-8">
            Thank you for your purchase! Your order has been confirmed and you should receive a confirmation email shortly.
          </p>

          {/* Order Details */}
          {orderDetails && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-8 text-left">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Details</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div><strong>Order ID:</strong> {orderDetails.sessionId}</div>
                <div><strong>Store:</strong> {orderDetails.subdomain}</div>
                <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`/sites/${subdomain}`}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Continue Shopping
            </a>
            <a
              href={`/sites/${subdomain}/contact`}
              className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <LaunchflyUI.Footer businessName={subdomain} />
    </div>
  );
}
