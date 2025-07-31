'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function PaymentSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentDetails, setPaymentDetails] = useState(null);
  
  const supabase = createClientComponentClient();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    loadSuccessData();
  }, []);

  async function loadSuccessData() {
    try {
      // Load business data
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('subdomain', params.subdomain)
        .single();

      if (businessError) throw businessError;
      setBusiness(businessData);

      // If we have a session ID, get payment details
      if (sessionId) {
        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .select('*')
          .eq('stripe_session_id', sessionId)
          .single();

        if (!saleError && sale) {
          setPaymentDetails(sale);
        }
      }

    } catch (error) {
      console.error('Error loading success data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Business Not Found</h1>
          <p className="text-gray-600">Unable to load business information.</p>
        </div>
      </div>
    );
  }

  const theme = business.business_data?.theme || {};
  const primaryColor = theme.colors?.primary || '#10b981';

  return (
    <div className="min-h-screen bg-gray-50" style={{ '--primary': primaryColor }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full mb-6" style={{ backgroundColor: primaryColor + '20' }}>
            <svg className="h-12 w-12" style={{ color: primaryColor }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Payment Successful! 🎉</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Thank you for your purchase from <strong>{business.name}</strong>. 
            Your order has been confirmed and you'll receive an email confirmation shortly.
          </p>
        </div>

        {/* Payment Details */}
        {paymentDetails && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Order Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3">Order Details</h3>
                <div className="space-y-2 text-gray-600">
                  <p><strong>Order ID:</strong> {paymentDetails.stripe_session_id?.slice(-10)}</p>
                  <p><strong>Product:</strong> {paymentDetails.product_id}</p>
                  <p><strong>Amount:</strong> ${paymentDetails.amount}</p>
                  <p><strong>Date:</strong> {new Date(paymentDetails.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3">Customer Information</h3>
                <div className="space-y-2 text-gray-600">
                  <p><strong>Name:</strong> {paymentDetails.customer_name || 'N/A'}</p>
                  <p><strong>Email:</strong> {paymentDetails.customer_email || 'N/A'}</p>
                  <p><strong>Status:</strong> 
                    <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                      Completed
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">What's Next?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-4">📧</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Check Your Email</h3>
              <p className="text-gray-600 text-sm">
                You'll receive a confirmation email with all the details and next steps.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Get Started</h3>
              <p className="text-gray-600 text-sm">
                Follow the instructions in your email to begin using your purchase.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Need Help?</h3>
              <p className="text-gray-600 text-sm">
                Contact us if you have any questions about your order.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => router.push(`/sites/${params.subdomain}`)}
            className="px-8 py-3 rounded-lg font-semibold text-white transition-all hover:shadow-lg transform hover:-translate-y-0.5"
            style={{ backgroundColor: primaryColor }}
          >
            Back to {business.name}
          </button>
          
          {business.business_data?.contactEmail && (
            <a
              href={`mailto:${business.business_data.contactEmail}`}
              className="px-8 py-3 rounded-lg font-semibold border-2 transition-all hover:shadow-lg"
              style={{ 
                borderColor: primaryColor,
                color: primaryColor
              }}
            >
              Contact Support
            </a>
          )}
        </div>

        {/* Trust Signals */}
        <div className="text-center mt-12 pt-8 border-t border-gray-200">
          <div className="flex justify-center items-center space-x-8 text-gray-500">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">Secure Payment</span>
            </div>
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">30-Day Guarantee</span>
            </div>
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              <span className="text-sm">Email Support</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
