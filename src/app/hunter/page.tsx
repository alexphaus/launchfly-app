'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { generateOpenerMessage, openWhatsAppWithMessage } from '@/lib/opener-utils';
// Types
interface ProspectImage {
  url: string;
  type: 'before' | 'after' | 'team' | 'work' | 'general';
  name: string;
}

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

  // Send Opener Modal
  const [showOpenerModal, setShowOpenerModal] = useState(false);
  const [savedProspect, setSavedProspect] = useState<{
    id: string;
    business_name: string;
    service_type: string;
    area: string;
    whatsapp_number: string;
    owner_name?: string;
  } | null>(null);
  const [selectedOpenerArea, setSelectedOpenerArea] = useState('');
  const [selectedOpenerPhone, setSelectedOpenerPhone] = useState('');

  // CSV Import
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvData, setCsvData] = useState('');
  const [defaultArea, setDefaultArea] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: number;
    details?: { skipped: string[]; errors: string[] };
  } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // Android back gesture handling for modals
  useEffect(() => {
    const isAnyModalOpen = showOpenerModal || showCsvModal;

    const handlePopState = (event: PopStateEvent) => {
      if (isAnyModalOpen) {
        setShowOpenerModal(false);
        setShowCsvModal(false);
      }
    };

    if (isAnyModalOpen) {
      window.history.pushState({ modalOpen: true }, '');
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showOpenerModal, showCsvModal]);

  // Use shared opener generator
  const generateOpener = (prospect: { service_type: string; area: string }, customArea?: string): string => {
    return generateOpenerMessage(prospect.service_type, prospect.area, customArea);
  };

  // Use shared WhatsApp opener
  const openWhatsApp = (message: string, phone?: string) => {
    const phoneToUse = phone || savedProspect?.whatsapp_number || '';
    openWhatsAppWithMessage(phoneToUse, message);
  };

  // Image upload for prospects
  const [uploadedImages, setUploadedImages] = useState<ProspectImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image upload handlers
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/sales/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');

      setUploadedImages(prev => [...prev, ...data.images]);
      showToast('success', `📸 ${data.images.length} image(s) uploaded!`);
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const updateImageType = (index: number, type: ProspectImage['type']) => {
    setUploadedImages(prev => prev.map((img, i) =>
      i === index ? { ...img, type } : img
    ));
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

  // CSV Import handler
  const handleCsvImport = async () => {
    if (!csvData.trim()) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const res = await fetch('/api/hunter/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData, defaultArea: defaultArea.trim() || undefined }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setImportResult({
        imported: data.imported,
        skipped: data.skipped,
        errors: data.errors,
        details: data.details,
      });

      if (data.imported > 0) {
        setAddedCount(prev => prev + data.imported);
        showToast('success', `✅ Imported ${data.imported} prospects!`);
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Add prospect (manual)
  const handleAddProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch('/api/hunter/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, images: uploadedImages }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Save prospect data for opener modal (including ID for status update)
      setSavedProspect({
        id: data.prospect?.id || data.id || '',
        business_name: formData.business_name,
        service_type: formData.service_type,
        area: formData.area,
        whatsapp_number: formData.whatsapp_number,
        owner_name: formData.owner_name,
      });
      setSelectedOpenerArea(formData.area.split(/[,/]+/)[0]?.trim() || formData.area);
      setSelectedOpenerPhone(formData.whatsapp_number.match(/\+?\d{8,}/)?.[0] || formData.whatsapp_number);
      setShowOpenerModal(true);
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
      setUploadedImages([]); // Clear uploaded images
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
          <button
            onClick={() => { setShowCsvModal(true); setImportResult(null); setCsvData(''); setDefaultArea(''); }}
            className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg text-sm font-medium hover:from-green-700 hover:to-green-800 shadow-sm hover:shadow hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer whitespace-nowrap"
          >
            📥 Import CSV
          </button>
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
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        value={formData.whatsapp_number}
                        onChange={e => setFormData(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                        placeholder="+60123456789"
                        className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      />
                      <button
                        type="button"
                        disabled={!formData.whatsapp_number}
                        onClick={() => {
                          // Handle multiple numbers (take the first one)
                          const firstNum = formData.whatsapp_number.split(',')[0];
                          const num = firstNum.replace(/[^0-9]/g, '');
                          window.open(`https://api.whatsapp.com/send?phone=${num}`, '_blank');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Test number on WhatsApp (uses first number if multiple)"
                      >
                        🔍
                      </button>
                    </div>
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

                {/* Raw Context (FB Copy-Paste) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    📋 Raw Context
                    <span className="text-xs font-normal text-slate-500 ml-2">
                      (Copy-paste from Facebook post)
                    </span>
                  </label>
                  <textarea
                    value={formData.raw_context}
                    onChange={e => setFormData(prev => ({ ...prev, raw_context: e.target.value }))}
                    placeholder="Paste the Facebook post content here...

Example:
JF HighCool Air Conditioning Services
📍 Lagonoy, Camarines Sur
📞 0934-673-2126
Services: Aircon cleaning, repair, installation
Promo: RM80 per unit this week only!
Reviews: 'Very fast service, same day!'"
                    rows={5}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    The more detail you paste, the better the preview will be.
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

      {/* Send Opener Modal */}
      {showOpenerModal && savedProspect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 relative">
            <h3 className="text-lg font-semibold mb-4">📤 Send Opener</h3>

            {/* Area Selection Chips */}
            {savedProspect.area.match(/[,/]+/) && (
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Select Area</label>
                <div className="flex flex-wrap gap-2">
                  {savedProspect.area.split(/[,/]+/).map(s => s.trim()).filter(Boolean).map((area, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedOpenerArea(area)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedOpenerArea === area
                        ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      {area}
                    </button>
                  ))}
                  <button
                    onClick={() => setSelectedOpenerArea(savedProspect.area)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedOpenerArea === savedProspect.area
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    All Areas
                  </button>
                </div>
              </div>
            )}

            {/* Phone Selection Chips */}
            {(savedProspect.whatsapp_number.match(/\+?\d{8,}/g)?.length || 0) > 1 && (
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Select Phone</label>
                <div className="flex flex-wrap gap-2">
                  {(savedProspect.whatsapp_number.match(/\+?\d{8,}/g) || []).map((phone, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedOpenerPhone(phone)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedOpenerPhone === phone
                        ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      {phone}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message Preview */}
            <div className="bg-slate-100 rounded-lg p-4 mb-4">
              <p className="text-slate-800 whitespace-pre-wrap font-medium">
                {generateOpener(savedProspect, selectedOpenerArea)}
              </p>
            </div>

            <div className="text-sm text-slate-500 mb-4">
              <p><strong>To:</strong> {savedProspect.business_name}</p>
              <p><strong>WhatsApp:</strong> {selectedOpenerPhone || savedProspect.whatsapp_number}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(generateOpener(savedProspect, selectedOpenerArea));
                  showToast('success', '📋 Copied!');
                }}
                className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium shadow-sm hover:shadow hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                📋 Copy Text
              </button>
              <button
                onClick={() => {
                  openWhatsApp(generateOpener(savedProspect, selectedOpenerArea), selectedOpenerPhone || undefined);
                }}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium shadow hover:shadow-lg hover:from-green-600 hover:to-green-700 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                💬 WhatsApp
              </button>
            </div>

            <button
              onClick={async () => {
                // Update prospect status to opener_sent in database
                if (savedProspect?.id) {
                  try {
                    await fetch(`/api/hunter/prospects/${savedProspect.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'opener_sent' }),
                    });
                  } catch (err) {
                    console.error('Failed to update status:', err);
                  }
                }
                setShowOpenerModal(false);
                showToast('success', '✅ Opener sent! Prospect moved to pipeline.');
              }}
              className="w-full mt-4 px-4 py-3 bg-slate-900 text-white rounded-lg font-medium shadow hover:shadow-lg hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
            >
              ✅ Mark as sent & close
            </button>

            <button
              onClick={() => setShowOpenerModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">📥 Import Google Maps CSV</h3>

            <p className="text-sm text-slate-600 mb-4">
              Paste your Google Maps export data below. The importer will automatically extract business names, phone numbers, and service types.
            </p>

            <textarea
              value={csvData}
              onChange={e => setCsvData(e.target.value)}
              placeholder="Paste your Google Maps CSV data here (tab-separated)...

Example row:
https://www.google.com/maps/place/...	Business Name	5,0	(25)	Servicio de reparación de aire acondicionado	·	Address Here	...	0927 588 6236	..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg h-64 text-xs font-mono focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />

            <div className="text-xs text-slate-500 mt-2 mb-4">
              Rows: ~{csvData.split('\n').filter(l => l.includes('google.com/maps')).length} detected
            </div>

            {/* Default Area Input */}
            <div className="mb-4">
              <label className="text-sm font-medium text-slate-700 block mb-1">
                📍 Default Area <span className="text-slate-400 font-normal">(city you searched for)</span>
              </label>
              <input
                type="text"
                value={defaultArea}
                onChange={e => setDefaultArea(e.target.value)}
                placeholder="e.g., Manila, Paranaque, Las Piñas"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              />
              <p className="text-xs text-slate-400 mt-1">This will override the auto-extracted area for all imports</p>
            </div>

            {/* Import Results */}
            {importResult && (
              <div className="bg-slate-50 rounded-lg p-4 mb-4 text-sm">
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{importResult.imported}</div>
                    <div className="text-xs text-slate-500">Imported</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{importResult.skipped}</div>
                    <div className="text-xs text-slate-500">Skipped (Duplicates)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{importResult.errors}</div>
                    <div className="text-xs text-slate-500">Errors</div>
                  </div>
                </div>

                {importResult.details?.skipped && importResult.details.skipped.length > 0 && (
                  <details className="text-xs text-slate-600">
                    <summary className="cursor-pointer font-medium">Skipped items</summary>
                    <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                      {importResult.details.skipped.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowCsvModal(false)}
                className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleCsvImport}
                disabled={isImporting || !csvData.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium shadow hover:shadow-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isImporting ? '⏳ Importing...' : '📥 Import to Pipeline'}
              </button>
            </div>

            <button
              onClick={() => setShowCsvModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
