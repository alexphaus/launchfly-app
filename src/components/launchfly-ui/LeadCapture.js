'use client';
import { useState } from 'react';

export default function LeadCapture({ title, subtitle, ctaText, businessId, privacyText = "We respect your privacy. Unsubscribe at any time." }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    setStatus('loading');
    try {
      const res = await fetch('/api/lead-magnet/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, businessId })
      });
      
      if (!res.ok) throw new Error('Failed to subscribe');
      
      setStatus('success');
      setEmail('');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <section className="py-20 px-4 bg-white">
        <div className="max-w-md mx-auto text-center p-8 bg-green-50 rounded-2xl border border-green-100 shadow-sm">
          <div className="text-4xl mb-4">✨</div>
          <h3 className="text-2xl font-bold text-green-800 mb-2">Check Your Inbox!</h3>
          <p className="text-green-700">We've sent your free guide to {email}. It should arrive in a few minutes.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 px-4 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-3xl mx-auto text-center">
        {title && <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{title}</h2>}
        {subtitle && <p className="text-xl text-gray-600 mb-8">{subtitle}</p>}
        
        <form onSubmit={handleSubmit} className="max-w-md mx-auto">
          <div className="flex flex-col gap-4">
            <input
              type="email"
              required
              placeholder="Enter your best email address"
              className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg shadow-sm transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {status === 'loading' ? 'Sending...' : (ctaText || 'Get Instant Access')}
            </button>
          </div>
          {status === 'error' && <p className="text-red-500 mt-2">Something went wrong. Please try again.</p>}
          <p className="text-sm text-gray-500 mt-4">{privacyText}</p>
        </form>
      </div>
    </section>
  );
}


