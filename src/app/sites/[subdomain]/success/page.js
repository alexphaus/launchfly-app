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
        // Try to find the sale record from the database using the Stripe session ID
        const { data, error } = await supabase
          .from('sales')
          .select('id, product_name, product_id, amount, customer_email, created_at, payment_status')
          .eq('stripe_session_id', sessionId)
          .single();

        if (error) {
          console.error('Error fetching sale:', error);
          
          // If we can't find the record, it might still be processing
          // Wait a few seconds and try again (webhook might be delayed)
          if (error.code === 'PGRST116') { // Record not found
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const retryResult = await supabase
              .from('sales')
              .select('id, product_name, product_id, amount, customer_email, created_at, payment_status')
              .eq('stripe_session_id', sessionId)
              .single();
              
            if (retryResult.data) {
              setSession(retryResult.data);
              setLoading(false);
              return;
            }
          }
          
          throw new Error('Unable to verify your purchase. It may still be processing.');
        }
        
        if (!data) {
          throw new Error('Purchase verification failed. Please contact support.');
        }
        
        setSession(data);
        
        // Update the business metrics in case webhook hasn't processed yet
        const { data: business } = await supabase
          .from('businesses')
          .select('id')
          .eq('subdomain', params.subdomain)
          .single();
          
        if (business) {
          // Trigger a metrics refresh silently
          await fetch(`/api/businesses/${business.id}/sales?refresh=true`, { method: 'GET' });
        }

      } catch (err) {
        console.error('Session verification error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, [sessionId, params.subdomain]);

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

  // Get primary color from the URL or use a default
  const primaryColor = searchParams.get('color') || '#4F46E5';
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-green-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full mx-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Thank You!</h1>
          <p className="text-gray-600 mb-8">
            Your payment was successful and your order has been confirmed.
          </p>
        </div>
        
        <div className="bg-gray-50 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Order Details</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <span className="text-gray-500">Order ID:</span>
              <span className="font-medium text-gray-800">{session.id.substring(0, 8)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <span className="text-gray-500">Product:</span>
              <span className="font-medium text-gray-800">{session.product_name}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <span className="text-gray-500">Date:</span>
              <span className="font-medium text-gray-800">{new Date(session.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Amount Paid:</span>
              <span className="font-bold text-lg" style={{ color: primaryColor }}>${parseFloat(session.amount).toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <div className="mb-8 p-6 bg-blue-50 rounded-xl border border-blue-100">
          <div className="flex">
            <div className="flex-shrink-0 mr-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-blue-800">Receipt Sent</h3>
              <p className="text-sm text-blue-600">
                We've sent a receipt to <strong>{session.customer_email}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <Link 
            href={`/sites/${params.subdomain}`} 
            className="px-8 py-3 rounded-lg font-semibold transition-all hover:shadow-md"
            style={{ backgroundColor: primaryColor, color: 'white' }}
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
