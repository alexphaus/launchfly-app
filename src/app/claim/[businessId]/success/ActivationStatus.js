'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function ActivationStatus({ businessId, sessionId, initialBusiness }) {
  const supabase = createClientComponentClient();

  // State management
  const [status, setStatus] = useState('activating'); // activating | building | ready | error
  const [business, setBusiness] = useState(initialBusiness);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [dashboardSessionId, setDashboardSessionId] = useState(initialBusiness?.sessionId || null);

  // Activate the business (payment verification + setup)
  const activateBusiness = useCallback(async () => {
    if (!sessionId || !businessId) return null;

    try {
      const response = await fetch('/api/claim/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, sessionId })
      });

      const data = await response.json();

      if (data.success && data.status === 'activated') {
        setBusiness(data.business);
        setDashboardSessionId(data.business?.sessionId);
        return data.business?.sessionId;
      } else if (data.status === 'pending_payment') {
        setError('Payment is still processing. Please wait a moment and refresh.');
        return null;
      } else {
        setError(data.error || 'Activation failed');
        return null;
      }
    } catch (err) {
      console.error('Activation error:', err);
      setError(err.message);
      return null;
    }
  }, [businessId, sessionId]);

  // Poll for generation progress
  const pollProgress = useCallback((dashSessionId) => {
    if (!dashSessionId) return () => { };

    let pollCount = 0;
    const MAX_POLLS = 60; // 2 minutes max (60 * 2 seconds)

    const pollInterval = setInterval(async () => {
      pollCount++;

      // Timeout fallback - if still stuck after 2 minutes, force ready
      if (pollCount >= MAX_POLLS) {
        console.log('⚠️ Polling timeout reached - forcing ready state');
        clearInterval(pollInterval);
        setStatus('ready');
        return;
      }

      try {
        const { data: session, error: sessErr } = await supabase
          .from('sessions')
          .select('stage, progress')
          .eq('id', dashSessionId)
          .single();

        if (sessErr) {
          console.error('Poll error:', sessErr);
          return;
        }

        if (session) {
          setProgress(session.progress || 0);

          if (session.stage === 'complete' || session.progress >= 100) {
            clearInterval(pollInterval);
            setStatus('ready');
          }
        }
      } catch (err) {
        console.error('Poll exception:', err);
      }
    }, 2000);

    // Return cleanup function
    return () => clearInterval(pollInterval);
  }, [supabase]);

  // Main effect: activate then poll
  useEffect(() => {
    let cleanupFn = () => { };
    let retryInterval = null;

    const init = async () => {
      // If already has sessionId and is ready, skip activation
      if (initialBusiness?.sessionId && initialBusiness?.status === 'ready') {
        setDashboardSessionId(initialBusiness.sessionId);
        setStatus('ready');
        return;
      }

      // If already has sessionId and is generating, go straight to building
      if (initialBusiness?.sessionId && initialBusiness?.status === 'generating') {
        setDashboardSessionId(initialBusiness.sessionId);
        setStatus('building');
        cleanupFn = pollProgress(initialBusiness.sessionId);
        return;
      }

      // Otherwise, activate first
      setStatus('activating');
      const newSessionId = await activateBusiness();

      if (newSessionId) {
        setStatus('building');
        setProgress(30); // Initial progress after activation
        cleanupFn = pollProgress(newSessionId);
      } else {
        // Retry activation a few times
        let retries = 0;
        retryInterval = setInterval(async () => {
          retries++;
          if (retries >= 5) {
            clearInterval(retryInterval);
            setStatus('error');
            if (!error) setError('Unable to activate your funnel. Please contact support.');
            return;
          }

          const retrySessionId = await activateBusiness();
          if (retrySessionId) {
            clearInterval(retryInterval);
            setStatus('building');
            setProgress(30);
            cleanupFn = pollProgress(retrySessionId);
          }
        }, 3000);
      }
    };

    init();

    return () => {
      cleanupFn();
      if (retryInterval) clearInterval(retryInterval);
    };
  }, []);

  const handleRetry = async () => {
    setError(null);
    setStatus('activating');
    setProgress(0);
    const newSessionId = await activateBusiness();
    if (newSessionId) {
      setStatus('building');
      setProgress(30);
      pollProgress(newSessionId);
    }
  };

  const businessName = business?.name || initialBusiness?.name || 'Your Business';
  const businessIdForLinks = business?.id || initialBusiness?.id || businessId;
  // New WhatsApp-focused deliverables
  const quoteUrl = `/q/${businessIdForLinks}`;
  const commandUrl = `/command/${businessIdForLinks}`;
  const dashboardUrl = dashboardSessionId ? `/dashboard/${dashboardSessionId}` : '/';

  // ==================== RENDER STATES ====================

  // READY STATE - Funnel is fully activated and ready
  if (status === 'ready') {
    return (
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          System Activated!
        </h1>
        <p className="text-slate-600 mb-6">
          Your lead capture system for <strong>{businessName}</strong> is now live and ready to capture leads.
        </p>

        <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-3">
          <div>
            <p className="text-xs text-slate-500 mb-1">Quote Funnel (share with customers):</p>
            <a
              href={quoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 font-mono text-sm hover:underline break-all"
            >
              app.launchfly.ai{quoteUrl}
            </a>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Command Center (your mobile dashboard):</p>
            <a
              href={commandUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 font-mono text-sm hover:underline break-all"
            >
              app.launchfly.ai{commandUrl}
            </a>
          </div>
        </div>

        <div className="space-y-3">
          <a
            href={commandUrl}
            className="block w-full bg-green-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-700 transition-colors"
          >
            📱 Open Command Center →
          </a>
          <a
            href={quoteUrl}
            target="_blank"
            className="block w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            ⚡ View Quote Funnel →
          </a>
          <Link
            href={dashboardUrl}
            className="block w-full bg-slate-100 text-slate-700 py-3 px-6 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
          >
            Go to Full Dashboard
          </Link>
        </div>

        <p className="text-sm text-slate-500 mt-6">
          Share the Quote Funnel link to start capturing leads. Use Command Center to manage jobs!
        </p>
      </div>
    );
  }

  // ERROR STATE
  if (status === 'error' || error) {
    return (
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          Activation Issue
        </h1>
        <p className="text-slate-600 mb-4">
          {error || "We had trouble activating your funnel. Your payment was successful - let's try again."}
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

  // BUILDING STATE - Progressive generation screen (same as onboarding)
  if (status === 'building') {
    return (
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg text-center">
        {/* Spinner */}
        <div
          className="mx-auto mb-6 animate-spin"
          style={{
            width: '64px',
            height: '64px',
            border: '4px solid #e5e7eb',
            borderTopColor: '#2563eb',
            borderRadius: '50%'
          }}
        />

        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          Building Your Business System
        </h1>
        <p className="text-slate-600 mb-6">
          AI is generating your assets. This usually takes about 30-60 seconds.
        </p>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-2 text-sm font-medium text-slate-600">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Progress steps */}
        <div className="text-left space-y-3">
          <div className={`flex items-center gap-3 ${progress > 10 ? 'text-green-600' : 'text-slate-400'}`}>
            <span>{progress > 10 ? '✓' : '○'}</span>
            <span>Analyzing Market & Audience</span>
          </div>
          <div className={`flex items-center gap-3 ${progress > 40 ? 'text-green-600' : 'text-slate-400'}`}>
            <span>{progress > 40 ? '✓' : '○'}</span>
            <span>Writing Lead Magnet Content</span>
          </div>
          <div className={`flex items-center gap-3 ${progress > 70 ? 'text-green-600' : 'text-slate-400'}`}>
            <span>{progress > 70 ? '✓' : '○'}</span>
            <span>Building Landing Page</span>
          </div>
          <div className={`flex items-center gap-3 ${progress > 90 ? 'text-green-600' : 'text-slate-400'}`}>
            <span>{progress > 90 ? '✓' : '○'}</span>
            <span>Drafting Email Sequence</span>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVATING STATE - Initial activation (payment verification)
  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg text-center">
      <div
        className="mx-auto mb-6 animate-spin"
        style={{
          width: '48px',
          height: '48px',
          border: '4px solid #e5e7eb',
          borderTopColor: '#2563eb',
          borderRadius: '50%'
        }}
      />

      <h1 className="text-2xl font-bold text-slate-800 mb-2">
        Activating Your Funnel
      </h1>
      <p className="text-slate-600">
        Verifying your payment and setting up your account...
      </p>
    </div>
  );
}
