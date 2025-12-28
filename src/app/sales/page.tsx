'use client';

import { useState, useEffect, useCallback } from 'react';

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
  opener_sent_at?: string;
  replied_at?: string;
  preview_sent_at?: string;
  preview_url?: string;
  preview_business_id?: string;
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

const STATUS_CONFIG: Record<string, { color: string; label: string; emoji: string }> = {
  new: { color: 'bg-gray-100 text-gray-800', label: 'New', emoji: '🆕' },
  opener_sent: { color: 'bg-blue-100 text-blue-800', label: 'Opener Sent', emoji: '📤' },
  replied: { color: 'bg-green-100 text-green-800', label: 'Replied!', emoji: '💬' },
  interested: { color: 'bg-emerald-100 text-emerald-800', label: 'Interested', emoji: '🔥' },
  preview_sent: { color: 'bg-purple-100 text-purple-800', label: 'Preview Sent', emoji: '🔗' },
  follow_up_1: { color: 'bg-yellow-100 text-yellow-800', label: 'Follow-up 1', emoji: '1️⃣' },
  follow_up_2: { color: 'bg-orange-100 text-orange-800', label: 'Follow-up 2', emoji: '2️⃣' },
  follow_up_3: { color: 'bg-red-100 text-red-800', label: 'Follow-up 3', emoji: '3️⃣' },
  closed_won: { color: 'bg-emerald-500 text-white', label: 'WON!', emoji: '🎉' },
  closed_lost: { color: 'bg-gray-200 text-gray-500', label: 'Lost', emoji: '❌' },
};

export default function SalesPage() {
  // Tabs
  const [activeTab, setActiveTab] = useState<'pipeline' | 'add'>('pipeline');
  
  // Prospects
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add form
  const [formData, setFormData] = useState({
    business_name: '',
    service_type: 'pest_control',
    area: '',
    whatsapp_number: '',
    owner_name: '',
    website_url: '',
    source: 'facebook',
    pain_signals: [] as string[],
    notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  
  // Scrape form
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  
  // Facebook context form
  const [fbContext, setFbContext] = useState('');
  const [isFbExtracting, setIsFbExtracting] = useState(false);
  
  // Modals
  const [showOpenerModal, setShowOpenerModal] = useState(false);
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  
  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // Load prospects from API
  const loadProspects = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      
      const res = await fetch(`/api/hunter/prospects?${params}`, {
        // Use cache for better performance
        next: { revalidate: 10 }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      setProspects(data.prospects || []);
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadProspects();
  }, [loadProspects]);

  // Filter prospects by search
  const filteredProspects = prospects.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.business_name.toLowerCase().includes(query) ||
      p.area.toLowerCase().includes(query) ||
      p.whatsapp_number.includes(query) ||
      (p.owner_name && p.owner_name.toLowerCase().includes(query))
    );
  });

  // Stats
  const stats = {
    total: prospects.length,
    pipeline: prospects.filter(p => !['closed_won', 'closed_lost'].includes(p.status)).length,
    replied: prospects.filter(p => ['replied', 'interested', 'preview_sent'].includes(p.status)).length,
    won: prospects.filter(p => p.status === 'closed_won').length,
    todaySent: prospects.filter(p => {
      if (!p.opener_sent_at) return false;
      return new Date(p.opener_sent_at).toDateString() === new Date().toDateString();
    }).length,
  };

  // Generate opener message
  const generateOpener = (prospect: Prospect): string => {
    const service = SERVICE_TYPES.find(t => t.value === prospect.service_type)?.service || prospect.service_type;
    return `Hi boss 👋 You still handling ${service} jobs around ${prospect.area}?`;
  };

  // Generate pitch message (after they say yes)
  const generatePitch = (prospect: Prospect): string => {
    return `Cun. 👍 (Sorry boss, I'm not a customer 😅)

I actually built a simple WhatsApp booking page for ${prospect.business_name} that helps catch enquiries when you're busy.

Want to see the draft I made?`;
  };

  // Open WhatsApp
  const openWhatsApp = (prospect: Prospect, message: string) => {
    const phone = prospect.whatsapp_number.replace(/[^0-9]/g, '');
    // Use api.whatsapp.com instead of wa.me to avoid ISP blocks (e.g. in Philippines)
    const waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  // Update prospect status
  const updateStatus = async (id: string, newStatus: string, extraData?: Record<string, any>) => {
    // Optimistic update - update UI immediately
    setProspects(prev => prev.map(p => 
      p.id === id 
        ? { 
            ...p, 
            status: newStatus,
            ...extraData,
            ...(newStatus === 'opener_sent' ? { opener_sent_at: new Date().toISOString() } : {}),
            ...(newStatus === 'replied' ? { replied_at: new Date().toISOString() } : {}),
            ...(newStatus === 'preview_sent' ? { preview_sent_at: new Date().toISOString() } : {}),
          } 
        : p
    ));
    showToast('success', `Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);

    try {
      const res = await fetch(`/api/hunter/prospects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...extraData }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      // No need to reload - we already updated optimistically
    } catch (err: any) {
      // Revert on error - reload prospects
      showToast('error', err.message);
      loadProspects();
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
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast('success', '✅ Prospect added!');
      
      // Optimistic add - add to local state immediately
      const newProspect: Prospect = {
        id: data.prospect?.id || Date.now().toString(),
        business_name: formData.business_name,
        service_type: formData.service_type,
        area: formData.area,
        whatsapp_number: formData.whatsapp_number,
        owner_name: formData.owner_name,
        website_url: formData.website_url,
        source: formData.source,
        pain_signals: formData.pain_signals,
        status: 'new',
        notes: formData.notes,
        created_at: new Date().toISOString(),
      };
      setProspects(prev => [newProspect, ...prev]);
      
      setFormData({
        business_name: '',
        service_type: 'pest_control',
        area: '',
        whatsapp_number: '',
        owner_name: '',
        website_url: '',
        source: 'facebook',
        pain_signals: [],
        notes: '',
      });
      setFbContext('');
      setScrapeUrl('');
      setActiveTab('pipeline');
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
    // setScrapeResult(null); // No longer needed

    try {
      const res = await fetch('/api/sales/scrape-light', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // setScrapeResult(data); // No longer needed
      
      // Fill form data
      setFormData(prev => ({
        ...prev,
        business_name: data.businessName || prev.business_name,
        service_type: data.serviceType || prev.service_type,
        area: data.area || prev.area,
        whatsapp_number: data.phone || prev.whatsapp_number,
        owner_name: data.ownerName || prev.owner_name,
        website_url: scrapeUrl,
        source: 'other',
        pain_signals: data.painSignals || prev.pain_signals,
        notes: data.notes || prev.notes,
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
    // setFbResult(null); // No longer needed

    try {
      const res = await fetch('/api/sales/extract-facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: fbContext }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // setFbResult(data); // No longer needed

      // Fill form data
      setFormData(prev => ({
        ...prev,
        business_name: data.businessName || prev.business_name,
        service_type: data.serviceType || prev.service_type,
        area: data.area || prev.area,
        whatsapp_number: data.phone || prev.whatsapp_number,
        owner_name: data.ownerName || prev.owner_name,
        website_url: data.website || prev.website_url,
        source: 'facebook',
        pain_signals: data.painSignals || prev.pain_signals,
        notes: data.notes || prev.notes,
      }));

      showToast('success', '✅ Business info extracted from Facebook to form!');
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsFbExtracting(false);
    }
  };

  // Generate preview for replied prospect
  const generatePreview = async (prospect: Prospect) => {
    setIsGeneratingPreview(true);
    
    try {
      // Build rich context from all prospect data
      const painSignalLabels = prospect.pain_signals
        ?.map(s => PAIN_SIGNALS.find(p => p.value === s)?.label || s)
        .join(', ') || '';
      
      const richContext = [
        `Business Name: ${prospect.business_name}`,
        `Service Type: ${SERVICE_TYPES.find(t => t.value === prospect.service_type)?.service || prospect.service_type}`,
        `Area/Location: ${prospect.area}`,
        prospect.owner_name ? `Owner Name: ${prospect.owner_name}` : '',
        prospect.whatsapp_number ? `Phone/WhatsApp: ${prospect.whatsapp_number}` : '',
        painSignalLabels ? `Pain Signals: ${painSignalLabels}` : '',
        prospect.notes ? `Additional Notes: ${prospect.notes}` : '',
      ].filter(Boolean).join('\n');

      const res = await fetch('/api/sales/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: prospect.website_url || '',
          businessName: prospect.business_name,
          niche: prospect.service_type,
          context: richContext,
          prospectId: prospect.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update prospect with preview URL
      await updateStatus(prospect.id, 'preview_sent', {
        preview_url: data.previewUrl,
        preview_business_id: data.businessId,
      });

      showToast('success', '🚀 Preview generated!');
      setShowPitchModal(false);
      loadProspects();
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsGeneratingPreview(false);
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">🎯 Sales Pipeline</h1>
              <p className="text-sm text-slate-500">Hunter → Closer → Builder</p>
            </div>
            
            {/* Quick Stats */}
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="text-xl font-bold text-slate-900">{stats.todaySent}</div>
                <div className="text-slate-500">Sent Today</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">{stats.replied}</div>
                <div className="text-slate-500">Hot Leads</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-600">{stats.won}</div>
                <div className="text-slate-500">Won</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${
                activeTab === 'pipeline'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              📋 Pipeline ({stats.pipeline})
            </button>
            <button
              onClick={() => setActiveTab('add')}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${
                activeTab === 'add'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              ➕ Quick Add
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* PIPELINE TAB */}
        {activeTab === 'pipeline' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                placeholder="🔍 Search by name, area, or phone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg text-sm"
              />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                <option value="all">All Status</option>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.emoji} {config.label}</option>
                ))}
              </select>
              <button
                onClick={loadProspects}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                🔄 Refresh
              </button>
            </div>

            {/* Prospect Cards */}
            <div className="grid gap-3">
              {isLoading ? (
                <div className="text-center py-12 text-slate-500">Loading...</div>
              ) : filteredProspects.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-4xl mb-2">🎯</p>
                  <p className="text-slate-500">No prospects yet. Start hunting!</p>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
                  >
                    ➕ Add First Prospect
                  </button>
                </div>
              ) : (
                filteredProspects.map(prospect => (
                  <ProspectCard
                    key={prospect.id}
                    prospect={prospect}
                    onSendOpener={() => {
                      setSelectedProspect(prospect);
                      setShowOpenerModal(true);
                    }}
                    onShowPitch={() => {
                      setSelectedProspect(prospect);
                      setShowPitchModal(true);
                    }}
                    onUpdateStatus={updateStatus}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* ADD TAB */}
        {activeTab === 'add' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Extractors */}
            <div className="space-y-6">
              {/* Facebook Extractor */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold mb-4">📘 Extract from Facebook</h2>
                <p className="text-sm text-slate-500 mb-4">
                  Copy-paste content from Facebook pages, posts, or comments.
                  <br />
                  AI will extract business info automatically.
                </p>

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
                      className="w-full px-3 py-2 border rounded-lg h-48 text-sm font-mono"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      The more context you paste, the better the extraction.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isFbExtracting || !fbContext.trim()}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {isFbExtracting ? '🔍 Extracting...' : '🔍 Extract to Form'}
                  </button>
                </form>
              </div>

              {/* Scrape Extractor */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold mb-4">🔍 Scrape Business Website</h2>
                <p className="text-sm text-slate-500 mb-4">
                  Extract business info using AI (gpt-4o-mini). Fast & cheap.
                </p>

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
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isScraping}
                    className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 transition"
                  >
                    {isScraping ? '🔍 Extracting...' : '🔍 Extract to Form'}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Form */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold mb-4">➕ Add Prospect Manually</h2>
                <p className="text-sm text-slate-500 mb-4">
                  Review extracted data and save to pipeline.
                </p>

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
                        className="w-full px-3 py-2 border rounded-lg"
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
                        className="w-full px-3 py-2 border rounded-lg"
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
                        className="w-full px-3 py-2 border rounded-lg"
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
                        className="w-full px-3 py-2 border rounded-lg"
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
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Source
                      </label>
                      <select
                        value={formData.source}
                        onChange={e => setFormData(prev => ({ ...prev, source: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
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
                        className="w-full px-3 py-2 border rounded-lg"
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
                          className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                            formData.pain_signals.includes(signal.value)
                              ? 'bg-orange-100 text-orange-700 border-2 border-orange-400'
                              : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
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
                      className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Include services, prices, reviews, and unique selling points for better previews.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {isSaving ? 'Saving...' : '➕ Add to Pipeline'}
                  </button>
                </form>
              </div>

              {/* Tips */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="font-semibold text-amber-800 mb-2">🎯 Hunter Rules</h3>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• Only collect info, don't sell yet</li>
                  <li>• Look for pain signals ("PM us", slow replies)</li>
                  <li>• Target: 20 prospects per session</li>
                  <li>• Best sources: Facebook groups, Google Maps</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* OPENER MODAL */}
      {showOpenerModal && selectedProspect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 relative">
            <h3 className="text-lg font-semibold mb-4">📤 Send Opener</h3>
            
            <div className="bg-slate-100 rounded-lg p-4 mb-4">
              <p className="text-slate-800 whitespace-pre-wrap font-medium">
                {generateOpener(selectedProspect)}
              </p>
            </div>

            <div className="text-sm text-slate-500 mb-4">
              <p><strong>To:</strong> {selectedProspect.business_name}</p>
              <p><strong>WhatsApp:</strong> {selectedProspect.whatsapp_number}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(generateOpener(selectedProspect));
                  showToast('success', '📋 Copied!');
                }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50"
              >
                📋 Copy
              </button>
              <button
                onClick={() => {
                  openWhatsApp(selectedProspect, generateOpener(selectedProspect));
                  updateStatus(selectedProspect.id, 'opener_sent');
                  setShowOpenerModal(false);
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                💬 WhatsApp
              </button>
            </div>

            <button
              onClick={() => {
                updateStatus(selectedProspect.id, 'opener_sent');
                setShowOpenerModal(false);
              }}
              className="w-full mt-3 px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
            >
              Mark as sent & close
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

      {/* PITCH MODAL (After they reply) */}
      {showPitchModal && selectedProspect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 relative">
            <h3 className="text-lg font-semibold mb-2">🔥 They Replied!</h3>
            <p className="text-sm text-slate-500 mb-4">
              Now reveal what you do and offer the preview.
            </p>
            
            {/* Pitch Message */}
            <div className="bg-slate-100 rounded-lg p-4 mb-4">
              <p className="text-slate-800 whitespace-pre-wrap text-sm">
                {generatePitch(selectedProspect)}
              </p>
            </div>

            <div className="flex gap-3 mb-4">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(generatePitch(selectedProspect));
                  showToast('success', '📋 Copied!');
                }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50 text-sm"
              >
                📋 Copy Pitch
              </button>
              <button
                onClick={() => openWhatsApp(selectedProspect, generatePitch(selectedProspect))}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                💬 Send via WA
              </button>
            </div>

            <hr className="my-4" />

            {/* Generate Preview */}
            {selectedProspect.preview_url ? (
              <div className="text-center">
                <p className="text-sm text-slate-500 mb-3">Preview already generated!</p>
                <a
                  href={selectedProspect.preview_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                >
                  🔗 View Preview
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedProspect.preview_url!);
                    showToast('success', '🔗 Link copied!');
                  }}
                  className="ml-2 px-4 py-2 border rounded-lg hover:bg-slate-50 text-sm"
                >
                  Copy Link
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-600 mb-3">
                  <strong>If they want to see</strong>, generate the preview:
                </p>
                <button
                  onClick={() => generatePreview(selectedProspect)}
                  disabled={isGeneratingPreview}
                  className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                >
                  {isGeneratingPreview ? '🔄 Generating Preview...' : '🚀 Generate Preview (~$0.05)'}
                </button>
              </div>
            )}

            <button
              onClick={() => setShowPitchModal(false)}
              className="w-full mt-3 px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
            >
              Close
            </button>

            <button
              onClick={() => setShowPitchModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

// Prospect Card Component
function ProspectCard({
  prospect,
  onSendOpener,
  onShowPitch,
  onUpdateStatus,
}: {
  prospect: Prospect;
  onSendOpener: () => void;
  onShowPitch: () => void;
  onUpdateStatus: (id: string, status: string, extra?: Record<string, any>) => void;
}) {
  const statusConfig = STATUS_CONFIG[prospect.status] || STATUS_CONFIG.new;
  const service = SERVICE_TYPES.find(t => t.value === prospect.service_type);

  // Calculate days since last activity
  const lastActivity = prospect.replied_at || prospect.opener_sent_at || prospect.created_at;
  const daysSince = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="bg-white rounded-lg border p-4 hover:shadow-sm transition">
      <div className="flex items-start justify-between gap-4">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{service?.label.split(' ')[0] || '🔨'}</span>
            <h3 className="font-semibold text-slate-900 truncate">
              {prospect.business_name}
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
              {statusConfig.emoji} {statusConfig.label}
            </span>
            {daysSince > 2 && prospect.status !== 'new' && !['closed_won', 'closed_lost'].includes(prospect.status) && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                ⏰ {daysSince}d ago
              </span>
            )}
          </div>
          <div className="text-sm text-slate-500">
            <span>📍 {prospect.area}</span>
            <span className="mx-2">•</span>
            <span>📱 {prospect.whatsapp_number}</span>
            {prospect.owner_name && (
              <>
                <span className="mx-2">•</span>
                <span>👤 {prospect.owner_name}</span>
              </>
            )}
          </div>
          {prospect.pain_signals && prospect.pain_signals.length > 0 && (
            <div className="flex gap-1 mt-2">
              {prospect.pain_signals.slice(0, 3).map(signal => (
                <span key={signal} className="px-2 py-0.5 bg-orange-50 text-orange-600 text-xs rounded-full">
                  {PAIN_SIGNALS.find(p => p.value === signal)?.label || signal}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          {prospect.status === 'new' && (
            <button
              onClick={onSendOpener}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              📤 Send Opener
            </button>
          )}

          {prospect.status === 'opener_sent' && (
            <>
              <button
                onClick={() => onUpdateStatus(prospect.id, 'replied')}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                ✅ They Replied
              </button>
              <button
                onClick={() => onUpdateStatus(prospect.id, 'follow_up_1')}
                className="px-3 py-1.5 border text-slate-600 text-sm rounded-lg hover:bg-slate-50"
              >
                ⏰ Follow Up
              </button>
            </>
          )}

          {(prospect.status === 'replied' || prospect.status === 'interested') && (
            <button
              onClick={onShowPitch}
              className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
            >
              🚀 Send Pitch
            </button>
          )}

          {prospect.status === 'preview_sent' && (
            <>
              <button
                onClick={() => onUpdateStatus(prospect.id, 'closed_won')}
                className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
              >
                🎉 They Paid!
              </button>
              {prospect.preview_url && (
                <button
                  onClick={() => navigator.clipboard.writeText(prospect.preview_url!)}
                  className="px-3 py-1.5 border text-slate-600 text-sm rounded-lg hover:bg-slate-50"
                >
                  🔗 Copy Link
                </button>
              )}
              <button
                onClick={() => onUpdateStatus(prospect.id, 'closed_lost')}
                className="px-3 py-1.5 text-slate-400 text-sm rounded-lg hover:bg-slate-50"
              >
                ❌ Not Interested
              </button>
            </>
          )}

          {['follow_up_1', 'follow_up_2', 'follow_up_3'].includes(prospect.status) && (
            <>
              <button
                onClick={() => onUpdateStatus(prospect.id, 'replied')}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                ✅ They Replied
              </button>
              {prospect.status !== 'follow_up_3' && (
                <button
                  onClick={() => onUpdateStatus(prospect.id, prospect.status === 'follow_up_1' ? 'follow_up_2' : 'follow_up_3')}
                  className="px-3 py-1.5 border text-slate-600 text-sm rounded-lg hover:bg-slate-50"
                >
                  📤 Next Follow Up
                </button>
              )}
              <button
                onClick={() => onUpdateStatus(prospect.id, 'closed_lost')}
                className="px-3 py-1.5 text-slate-400 text-sm rounded-lg hover:bg-slate-50"
              >
                ❌ No Response
              </button>
            </>
          )}

          {prospect.status === 'closed_won' && (
            <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-sm rounded-lg text-center">
              🎉 Won!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
