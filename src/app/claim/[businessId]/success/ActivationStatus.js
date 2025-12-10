'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

export default function ActivationStatus({ businessId, sessionId, initialBusiness }) {
  const [status, setStatus] = useState(initialBusiness?.status === 'ready' ? 'activated' : 'processing');
  const [business, setBusiness] = useState(initialBusiness);
  const [error, setError] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 10;

  const activateBusiness = useCallback(async () => {
    if (!sessionId || !businessId) return;
    
    try {
      const response = await fetch('/api/claim/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, sessionId })
      });

      const data = await response.json();

      if (data.success && data.status === 'activated') {
        setStatus('activated');
        setBusiness(data.business);
        return true;
      } else if (data.status === 'pending_payment') {
        setStatus('pending_payment');
        return false;
      } else {
        setError(data.error);
        return false;
      }
    } catch (err) {
      console.error('Activation error:', err);
      setError(err.message);
      return false;
    }
  }, [businessId, sessionId]);

  useEffect(() => {
    if (status === 'activated' || !sessionId) return;

    // Try to activate immediately
    activateBusiness().then(success => {
      if (success) return;

      // If not successful, poll every 2 seconds
      const interval = setInterval(async () => {
        setAttempts(prev => {
          if (prev >= maxAttempts) {
            clearInterval(interval);
            setStatus('timeout');
            return prev;
          }
          return prev + 1;
        });

        const success = await activateBusiness();
        if (success) {
          clearInterval(interval);
        }
      }, 2000);

      return () => clearInterval(interval);
    });
  }, [activateBusiness, sessionId, status]);

  const handleRetry = async () => {
    setError(null);
    setStatus('processing');
    setAttempts(0);
    await activateBusiness();
  };

  const businessName = business?.name || 'Your Business';
  const subdomain = business?.subdomain;
  const funnelUrl = subdomain ? `https://${subdomain}.launchfly.ai` : null;

  // Activated state
  if (status === 'activated') {
    return (
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          Funnel Activated!
        </h1>
        <p className="text-slate-600 mb-6">
          Your lead capture funnel for <strong>{businessName}</strong> is now live and ready to capture leads.
        </p>

        <div className="bg-slate-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-slate-500 mb-2">Your funnel URL:</p>
          {funnelUrl ? (
            <a 
              href={funnelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 font-mono text-sm hover:underline break-all"
            >
              {funnelUrl}
            </a>
          ) : (
            <span className="text-slate-400 text-sm">Setting up...</span>
          )}
        </div>

        <div className="space-y-3">
          {funnelUrl && (
            <a 
              href={funnelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-green-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-700 transition-colors"
            >
              View My Funnel →
            </a>
          )}
          <Link 
            href="/"
            className="block w-full bg-slate-100 text-slate-700 py-3 px-6 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>

        <p className="text-sm text-slate-500 mt-6">
          Check your email for next steps and tips to maximize your leads.
        </p>
      </div>
    );
  }

  // Error or timeout state
  if (status === 'timeout' || error) {
    return (
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          Activation Issue
        </h1>
        <p className="text-slate-600 mb-4">
          {error || 'We had trouble activating your funnel. Your payment was successful - let\'s try again.'}
        </p>
        
        <button
          onClick={handleRetry}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors mb-3"
        >
          Try Again
        </button>
        
        <p className="text-sm text-slate-500">
          If this continues, please contact{' '}
          <a href="mailto:support@launchfly.ai" className="text-blue-600 hover:underline">
            support@launchfly.ai
          </a>
          {' '}with your business ID: <code className="bg-slate-100 px-1 rounded text-xs">{businessId}</code>
        </p>
      </div>
    );
  }

  // Pending payment state
  if (status === 'pending_payment') {
    return (
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg text-center">
        <div className="text-6xl mb-4">💳</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          Payment Processing
        </h1>
        <p className="text-slate-600 mb-6">
          Your payment is still being processed. This usually takes just a moment.
        </p>
        <button
          onClick={handleRetry}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          Check Again
        </button>
      </div>
    );
  }

  // Processing state (default)
  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg text-center">
      <div className="text-6xl mb-4 animate-pulse">⏳</div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">
        Setting Up Your Funnel
      </h1>
      <p className="text-slate-600 mb-4">
        We're activating your funnel now. This usually takes just a few seconds...
      </p>
      
      {/* Progress indicator */}
      <div className="w-full bg-slate-200 rounded-full h-2 mb-4">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${Math.min((attempts / maxAttempts) * 100, 95)}%` }}
        />
      </div>
      
      <p className="text-sm text-slate-400">
        {attempts > 0 ? `Checking status... (${attempts}/${maxAttempts})` : 'Connecting...'}
      </p>
    </div>
  );
}
