'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const supabase = createClientComponentClient();

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided.');
      setLoading(false);
      return;
    }

    const verifySession = async () => {
      try {
        // This is a simplified verification. In a real app, you might want to
        // create an API route to verify the session on the server-side
        // to avoid exposing Stripe session details to the client.
        const { data, error } = await supabase
          .from('sales')
          .select('product_name, amount, customer_email')
          .eq('stripe_session_id', sessionId)
          .single();

        if (error || !data) {
          throw new Error('Purchase session not found or already processed.');
        }
        
        setSession(data);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-4">Verifying your purchase...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 text-red-700">
        <div className="text-4xl mb-4">😞</div>
        <h1 className="text-2xl font-bold mb-2">Verification Failed</h1>
        <p className="mb-6">{error}</p>
        <Link href={`/sites/${params.subdomain}`} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
          Return to site
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-green-50">
      <div className="text-center p-8 max-w-lg">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">
          Thank you for your order! A confirmation email has been sent to {session.customer_email}.
        </p>
        
        <div className="bg-white rounded-lg shadow-md p-6 text-left mb-8">
          <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
          <div className="flex justify-between items-center border-b pb-2 mb-2">
            <span className="text-gray-500">Product:</span>
            <span className="font-medium">{session.product_name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Amount Paid:</span>
            <span className="font-bold text-lg text-green-600">${session.amount.toFixed(2)}</span>
          </div>
        </div>

        <Link href={`/sites/${params.subdomain}`} className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
          ← Back to Site
        </Link>
      </div>
    </div>
  );
}
