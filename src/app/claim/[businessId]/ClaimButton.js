'use client';

import { useState } from 'react';
import { CreditCard } from 'lucide-react';

export default function ClaimButton({ businessId, email }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClaim = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/stripe/claim-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          email,
          plan: 'launchpad'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClaim}
      disabled={isLoading}
      className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Processing...
        </span>
      ) : (
        <>
          <CreditCard size={20} />
          Activate Now →
        </>
      )}
    </button>
  );
}
