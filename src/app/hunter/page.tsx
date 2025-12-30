'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Types
interface Prospect {
  id: string;
  business_name: string;
  service_type: string;
  area: string;
  whatsapp_number: string;
  owner_name?: string;
  website_url?: string;
  source: string;
  pain_signals: string[];
  status: string;
  notes?: string;
  created_at: string;
}

// Service types for blue collar businesses
const SERVICE_TYPES = [
  { value: 'pest_control', label: '🐜 Pest Control', service: 'pest control' },
  { value: 'aircon', label: '❄️ Aircon Service', service: 'aircon' },
  { value: 'plumbing', label: '🔧 Plumbing', service: 'plumbing' },
  { value: 'renovation', label: '🏠 Renovation', service: 'renovation' },
  { value: 'cleaning', label: '🧹 Cleaning', service: 'cleaning' },
  { value: 'electrical', label: '⚡ Electrical', service: 'electrical' },
  { value: 'roofing', label: '🏗️ Roofing', service: 'roofing' },
  { value: 'landscaping', label: '🌳 Landscaping', service: 'landscaping' },
  { value: 'moving', label: '📦 Moving', service: 'moving' },
  { value: 'auto_repair', label: '🚗 Auto Repair', service: 'auto repair' },
  { value: 'locksmith', label: '🔐 Locksmith', service: 'locksmith' },
  { value: 'other', label: '🔨 Other', service: 'service' },
];

const PAIN_SIGNALS = [
  { value: 'pm_comments', label: '"PM us" comments' },
  { value: 'slow_replies', label: 'Slow replies' },
  { value: 'no_booking', label: 'No booking system' },
  { value: 'whatsapp_only', label: 'WhatsApp only' },
  { value: 'bad_reviews', label: 'Bad reviews' },
  { value: 'broken_links', label: 'Broken links' },
  { value: 'no_website', label: 'No website' },
];

const SOURCES = [
  { value: 'facebook', label: '📘 Facebook' },
  { value: 'google_maps', label: '📍 Google Maps' },
  { value: 'instagram', label: '📸 Instagram' },
  { value: 'referral', label: '🤝 Referral' },
  { value: 'manual', label: '✏️ Manual' },
  { value: 'other', label: '🌐 Other/Website' },
];

export default function HunterPage() {
  // Add form
  const [formData, setFormData] = useState({
    business_name: '',
    service_type: 'pest_control',
    area: '',
    whatsapp_number: '',
    email: '',
    owner_name: '',
    website_url: '',
    source: 'facebook',
    pain_signals: [] as string[],
    notes: '',
    raw_context: '', // Original Facebook/context data for richer preview generation
  });
  const [isSaving, setIsSaving] = useState(false);

  // Scrape form
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);

  // Facebook context form
  const [fbContext, setFbContext] = useState('');
  const [isFbExtracting, setIsFbExtracting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // Counter for today's finds
  const [addedCount, setAddedCount] = useState(0);

  useEffect(() => {
    const fetchTodayCount = async () => {
      try {
        const res = await fetch('/api/hunter/prospects', { cache: 'no-store' });
        const data = await res.json();
        if (data.prospects) {
          const today = new Date().toDateString();
          const count = data.prospects.filter((p: Prospect) =>
            new Date(p.created_at).toDateString() === today
          ).length;
          setAddedCount(count);
        }
      } catch (err) {
        console.error('Failed to load prospects count', err);
      }
    };
    fetchTodayCount();
  }, []);

  // Add prospect (manual)
  const handleAddProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch('/api/hunter/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast('success', '✅ Prospect added!');
      setAddedCount(prev => prev + 1);

      setFormData({
        business_name: '',
        service_type: 'pest_control',
        area: '',
        whatsapp_number: '',
        email: '',
        owner_name: '',
        website_url: '',
        source: 'facebook',
        pain_signals: [],
        notes: '',
        raw_context: '',
      });
      setFbContext('');
      setScrapeUrl('');
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Scrape website (lightweight, no preview generation)
  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapeUrl) return;

    setIsScraping(true);

    try {
      const res = await fetch('/api/sales/scrape-light', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Fill form data - also preserve raw scraped content
      setFormData(prev => ({
        ...prev,
        business_name: data.businessName || prev.business_name,
        service_type: data.serviceType || prev.service_type,
        area: data.area || prev.area,
        whatsapp_number: data.phone || prev.whatsapp_number,
        email: data.email || prev.email,
        owner_name: data.ownerName || prev.owner_name,
        website_url: scrapeUrl,
        source: 'other',
        pain_signals: data.painSignals || prev.pain_signals,
        notes: data.notes || prev.notes,
        raw_context: data.rawContent || prev.raw_context, // Preserve scraped content for preview generation
      }));

      showToast('success', '✅ Business info extracted to form!');
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsScraping(false);
    }
  };

  // Extract from Facebook context (copy-paste)
  const handleFbExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbContext.trim()) return;

    setIsFbExtracting(true);

    try {
      const res = await fetch('/api/sales/extract-facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: fbContext }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Fill form data - also preserve raw_context
      setFormData(prev => ({
        ...prev,
        business_name: data.businessName || prev.business_name,
        service_type: data.serviceType || prev.service_type,
        area: data.area || prev.area,
        whatsapp_number: data.phone || prev.whatsapp_number,
        email: data.email || prev.email,
        owner_name: data.ownerName || prev.owner_name,
        website_url: data.website || prev.website_url,
        source: 'facebook',
        pain_signals: data.painSignals || prev.pain_signals,
        notes: data.notes || prev.notes,
        raw_context: fbContext, // Preserve original Facebook context for preview generation
      }));

      showToast('success', '✅ Business info extracted from Facebook to form!');
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsFbExtracting(false);
    }
  };

  // Toggle pain signal
  const togglePainSignal = (signal: string) => {
    setFormData(prev => ({
      ...prev,
      pain_signals: prev.pain_signals.includes(signal)
        ? prev.pain_signals.filter(s => s !== signal)
        : [...prev.pain_signals, signal],
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              Hunter Mode
              <span className="text-sm font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {addedCount}
              </span>
            </h1>
            <p className="text-slate-600 mt-2 text-sm">Quickly add prospects to the pipeline</p>
          </div>
          <Link
            href="/sales"
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-300 shadow-sm hover:shadow hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer whitespace-nowrap"
          >
            📋 View Pipeline
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Extractors */}
          <div className="space-y-8">
            {/* Facebook Extractor */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <span className="text-xl">📘</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Extract from Facebook</h2>
                  <p className="text-sm text-slate-500">Copy-paste content from pages or posts</p>
                </div>
              </div>

              <form onSubmit={handleFbExtract} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Facebook Context
                  </label>
                  <textarea
                    required
                    value={fbContext}
                    onChange={e => setFbContext(e.target.value)}
                    placeholder={`Paste here:\n• About section from Facebook page\n• Posts with "PM us for price"\n• Comments from service groups\n• Business page info\n\nExample:\n"Ahmad Pest Control - Professional pest control services in Ampang area. Call/WhatsApp 012-3456789 for free quotation. Operating since 2015."`}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg h-48 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    The more context you paste, the better the extraction.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isFbExtracting || !fbContext.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-medium shadow hover:shadow-lg hover:from-blue-700 hover:to-blue-800 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                >
                  {isFbExtracting ? '🔍 Extracting...' : '🔍 Extract to Form'}
                </button>
              </form>
            </div>

            {/* Scrape Extractor */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <span className="text-xl">🔍</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Scrape Website</h2>
                  <p className="text-sm text-slate-500">Extract info from business URL</p>
                </div>
              </div>

              <form onSubmit={handleScrape} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Website URL
                  </label>
                  <input
                    type="url"
                    required
                    value={scrapeUrl}
                    onChange={e => setScrapeUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isScraping}
                  className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium shadow hover:shadow-lg hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                >
                  {isScraping ? '🔍 Extracting...' : '🔍 Extract to Form'}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Form */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-50 rounded-lg">
                  <span className="text-xl">➕</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Add Prospect</h2>
                  <p className="text-sm text-slate-500">Review and save to pipeline</p>
                </div>
              </div>

              <form onSubmit={handleAddProspect} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Business Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.business_name}
                      onChange={e => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
                      placeholder="e.g., Ahmad Pest Control"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Service Type *
                    </label>
                    <select
                      required
                      value={formData.service_type}
                      onChange={e => setFormData(prev => ({ ...prev, service_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    >
                      {SERVICE_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Area *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.area}
                      onChange={e => setFormData(prev => ({ ...prev, area: e.target.value }))}
                      placeholder="e.g., Ampang"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.whatsapp_number}
                      onChange={e => setFormData(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                      placeholder="+60123456789"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="hello@example.com"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Owner Name
                    </label>
                    <input
                      type="text"
                      value={formData.owner_name}
                      onChange={e => setFormData(prev => ({ ...prev, owner_name: e.target.value }))}
                      placeholder="Boss Ahmad"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Source
                    </label>
                    <select
                      value={formData.source}
                      onChange={e => setFormData(prev => ({ ...prev, source: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    >
                      {SOURCES.map(source => (
                        <option key={source.value} value={source.value}>{source.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Website URL
                    </label>
                    <input
                      type="url"
                      value={formData.website_url}
                      onChange={e => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>

                {/* Pain Signals */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Pain Signals
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PAIN_SIGNALS.map(signal => (
                      <button
                        key={signal.value}
                        type="button"
                        onClick={() => togglePainSignal(signal.value)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 ${formData.pain_signals.includes(signal.value)
                          ? 'bg-orange-100 text-orange-700 border-2 border-orange-400 shadow-sm'
                          : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200 hover:shadow-sm'
                          }`}
                      >
                        {signal.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes / Context */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Notes / Context
                    <span className="text-xs font-normal text-slate-500 ml-2">
                      (AI uses this for preview generation)
                    </span>
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="• Services: termite treatment, general pest control\n• Pricing: RM90 basic, RM200 full house\n• Reviews: 'Fast response, came same day'\n• USP: 24/7 available, 10 years experience"
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Include services, prices, reviews, and unique selling points for better previews.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-medium shadow hover:shadow-lg hover:from-blue-700 hover:to-blue-800 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                >
                  {isSaving ? 'Saving...' : '➕ Add to Pipeline'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
