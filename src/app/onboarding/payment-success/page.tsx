'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      const sessionId = searchParams.get('session_id');
      const plan = searchParams.get('plan');
      const template = searchParams.get('template');
      const businessName = searchParams.get('businessName');
      const subdomain = searchParams.get('subdomain');

      if (!sessionId) {
        setError('Invalid payment session');
        setIsVerifying(false);
        return;
      }

      try {
        // Verify the payment session with Stripe
        const response = await fetch('/api/stripe/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });

        if (!response.ok) {
          throw new Error('Payment verification failed');
        }

        const { paid } = await response.json();

        if (paid) {
          // Redirect back to appropriate onboarding flow with payment confirmation
          const params = new URLSearchParams({
            plan: plan || 'professional',
            payment: 'success',
            session_id: sessionId
          });
          
          if (template) params.append('template', template);
          if (businessName) params.append('businessName', businessName);
          if (subdomain) params.append('subdomain', subdomain);

          // Determine which onboarding flow to return to
          const isCustomFlow = template === 'custom';
          const targetUrl = isCustomFlow 
            ? `/onboarding/custom?${params.toString()}`
            : `/onboarding/quick-start?${params.toString()}`;

          router.replace(targetUrl);
        } else {
          throw new Error('Payment not completed');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        setError('Payment verification failed. Please contact support.');
        setIsVerifying(false);
      }
    };

    verifyPayment();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/onboarding?plan=professional')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Verifying Payment...</h1>
        <p className="text-gray-600">Please wait while we confirm your payment.</p>
      </div>
    </div>
  );
}
