'use client';

import { useState } from 'react';

export default function DebugPage() {
  const [businessId, setBusinessId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const testSale = async () => {
    if (!businessId.trim()) {
      alert('Please enter a business ID');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/test-sale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ businessId: businessId.trim() }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: 'Network error', details: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Stripe Webhook Debug</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Sale Creation</h2>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business ID
              </label>
              <input
                type="text"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                placeholder="Enter business UUID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={testSale}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Sale'}
            </button>
          </div>
        </div>

        {result && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">
              Result: {result.success ? '✅ Success' : '❌ Error'}
            </h3>
            <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Debug Checklist</h3>
          <ul className="text-yellow-700 space-y-2">
            <li>1. Make sure your Stripe webhook endpoint is configured correctly</li>
            <li>2. Check that the webhook URL ends with <code>/api/webhook/stripe</code></li>
            <li>3. Verify the webhook secret is set in your environment variables</li>
            <li>4. Check your Supabase database schema matches the code</li>
            <li>5. Look at the server logs for detailed error messages</li>
          </ul>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">How to Find Business ID</h3>
          <p className="text-blue-700">
            Go to your Supabase dashboard → businesses table → copy the UUID from the id column
          </p>
        </div>
      </div>
    </div>
  );
}
