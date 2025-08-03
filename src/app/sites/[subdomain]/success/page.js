'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

export default function SuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [businessData, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState(null);

  const supabase = createClientComponentClient();

  useEffect(() => {
    loadSuccessData();
  }, []);

  async function loadSuccessData() {
    try {
      const subdomain = await params.subdomain;
      const sessionId = searchParams.get('session_id');

      // Get business data
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('subdomain', subdomain)
        .eq('status', 'ready')
        .single();

      if (businessError || !business) {
        console.error('Business not found:', businessError);
        setLoading(false);
        return;
      }

      setBusiness(business);

      // If we have a session ID, we could fetch order details from Stripe
      // For now, we'll just show a generic success message
      if (sessionId) {
        setOrderDetails({
          sessionId,
          status: 'success'
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading success data:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const businessName = businessData?.business_data?.businessName || businessData?.name || 'Store';
  const theme = businessData?.business_data?.theme || {};
  const isEcommerce = businessData?.business_data?.businessModel === 'ecommerce' || 
                     businessData?.businessModel === 'ecommerce';

  return (
    <div 
      className="min-h-screen bg-gray-50"
      style={{
        '--primary': theme.colors?.primary || '#3b82f6',
        '--secondary': theme.colors?.secondary || '#1e40af',
        '--text-dark': theme.colors?.textDark || '#1f2937',
        '--text-gray': theme.colors?.textGray || '#6b7280',
      }}
    >
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link
              href={`/${params.subdomain}`}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to {businessName}
            </Link>
            <span className="font-semibold text-lg" style={{ color: 'var(--primary)' }}>
              {businessName}
            </span>
          </div>
        </div>
      </div>

      {/* Success Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Success Icon */}
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* Success Message */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {isEcommerce ? 'Order Confirmed!' : 'Payment Successful!'}
            </h1>
            <p className="text-lg text-gray-600 mb-2">
              Thank you for your {isEcommerce ? 'order' : 'purchase'}!
            </p>
            <p className="text-gray-500">
              {isEcommerce 
                ? 'Your order has been confirmed and will be processed shortly.'
                : 'Your payment has been processed successfully.'
              }
            </p>
          </div>

          {/* Order Details */}
          {orderDetails && (
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-3">Order Details</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Order ID: {orderDetails.sessionId?.slice(-8) || 'N/A'}</p>
                <p>Status: Confirmed</p>
                <p>Date: {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className="border-t pt-8">
            <h3 className="font-semibold text-gray-900 mb-4">What's Next?</h3>
            <div className="space-y-3 text-left">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                  <span className="text-xs font-bold text-blue-600">1</span>
                </div>
                <p className="text-gray-600">
                  {isEcommerce 
                    ? 'You\'ll receive an order confirmation email within the next few minutes.'
                    : 'You\'ll receive a receipt and confirmation email shortly.'
                  }
                </p>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                  <span className="text-xs font-bold text-blue-600">2</span>
                </div>
                <p className="text-gray-600">
                  {isEcommerce 
                    ? 'Your order will be prepared and shipped within 1-2 business days.'
                    : 'You now have access to your purchased service or product.'
                  }
                </p>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                  <span className="text-xs font-bold text-blue-600">3</span>
                </div>
                <p className="text-gray-600">
                  {isEcommerce 
                    ? 'Track your shipment with the tracking information we\'ll send you.'
                    : 'If you have any questions, feel free to contact our support team.'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <Link
              href={`/${params.subdomain}`}
              className="flex-1 py-3 px-6 rounded-lg font-semibold text-white transition-all hover:scale-105"
              style={{ background: 'var(--primary, #3b82f6)' }}
            >
              {isEcommerce ? 'Continue Shopping' : 'Back to Home'}
            </Link>
            <button
              onClick={() => window.print()}
              className="flex-1 py-3 px-6 rounded-lg font-semibold border-2 transition-all hover:scale-105"
              style={{
                borderColor: 'var(--primary, #3b82f6)',
                color: 'var(--primary, #3b82f6)'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'var(--primary, #3b82f6)';
                e.target.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.color = 'var(--primary, #3b82f6)';
              }}
            >
              Print Receipt
            </button>
          </div>

          {/* Contact Info */}
          <div className="mt-8 pt-6 border-t text-center">
            <p className="text-sm text-gray-500">
              Questions about your {isEcommerce ? 'order' : 'purchase'}? 
              <br />
              Contact us at{' '}
              <a 
                href={`mailto:support@${params.subdomain}.com`}
                className="font-medium hover:underline"
                style={{ color: 'var(--primary, #3b82f6)' }}
              >
                support@{params.subdomain}.com
              </a>
            </p>
          </div>
        </div>

        {/* Trust Signals */}
        <div className="flex justify-center items-center gap-6 mt-8 text-sm text-gray-500">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Secure Payment
          </div>
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            256-bit SSL
          </div>
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
            </svg>
            Powered by Stripe
          </div>
        </div>
      </div>
    </div>
  );
}
