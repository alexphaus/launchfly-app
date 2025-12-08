'use client';

import { useState } from 'react';

export default function SalesPage() {
  const [url, setUrl] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [niche, setNiche] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/sales/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, businessName, niche }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-900">
            🎯 AI Sales Prospector
          </h1>
          <p className="text-slate-600 mt-2">
            Turn any website URL into a personalized cold email in seconds.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Website URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Business Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Joe's Plumbing"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Analyzing Website...
                </>
              ) : (
                'Analyze & Generate Pitch'
              )}
            </button>
          </form>
          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {result && (
          <div className="space-y-6 animate-fade-in">
            {/* Analysis Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                📊 Website Analysis
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-2">
                    Weak Points (Lead Leaks)
                  </h3>
                  <ul className="space-y-2">
                    {result.analysis.weaknesses.map((point: string, i: number) => (
                      <li key={i} className="text-slate-600 text-sm flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">✗</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-green-600 uppercase tracking-wide mb-2">
                    Opportunity
                  </h3>
                  <p className="text-slate-600 text-sm">
                    {result.analysis.opportunity}
                  </p>
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <span className="text-xs font-bold text-blue-600 uppercase block mb-1">
                      Recommended Lead Magnet
                    </span>
                    <span className="text-blue-900 font-medium">
                      {result.lead_magnet_idea}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-slate-100 flex gap-4 text-sm text-slate-500">
                {result.scrapedData.email && (
                  <span className="flex items-center gap-1">
                    📧 {result.scrapedData.email}
                  </span>
                )}
                {result.scrapedData.phone && (
                  <span className="flex items-center gap-1">
                    📞 {result.scrapedData.phone}
                  </span>
                )}
              </div>
            </div>

            {/* Email Draft Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 border-l-4 border-l-blue-500">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  ✉️ Generated Cold Email
                </h2>
                <button
                  onClick={() => copyToClipboard(`Subject: ${result.email.subject}\n\n${result.email.body}`)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Copy All
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Subject Line
                  </label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={result.email.subject}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(result.email.subject)}
                      className="p-2 text-slate-400 hover:text-blue-600"
                      title="Copy Subject"
                    >
                      📋
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Email Body
                  </label>
                  <div className="relative">
                    <textarea
                      readOnly
                      value={result.email.body}
                      rows={12}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 text-sm font-mono leading-relaxed resize-none"
                    />
                    <button
                      onClick={() => copyToClipboard(result.email.body)}
                      className="absolute top-2 right-2 p-2 text-slate-400 hover:text-blue-600 bg-white rounded shadow-sm border border-slate-200"
                      title="Copy Body"
                    >
                      📋
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
