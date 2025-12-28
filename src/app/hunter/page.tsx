'use client';

import { useState, useEffect, useCallback } from 'react';

// Types
interface HunterProspect {
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
}

const SERVICE_TYPES = [
  { value: 'pest_control', label: '🐜 Pest Control', emoji: '🐜' },
  { value: 'aircon', label: '❄️ Aircon Service', emoji: '❄️' },
  { value: 'plumbing', label: '🔧 Plumbing', emoji: '🔧' },
  { value: 'renovation', label: '🏠 Renovation', emoji: '🏠' },
  { value: 'cleaning', label: '🧹 Cleaning', emoji: '🧹' },
  { value: 'electrical', label: '⚡ Electrical', emoji: '⚡' },
  { value: 'roofing', label: '🏗️ Roofing', emoji: '🏗️' },
  { value: 'landscaping', label: '🌳 Landscaping', emoji: '🌳' },
  { value: 'moving', label: '📦 Moving', emoji: '📦' },
  { value: 'other', label: '🔨 Other', emoji: '🔨' },
];

const PAIN_SIGNALS = [
  { value: 'pm_comments', label: '"PM us" in comments' },
  { value: 'slow_replies', label: 'Slow/manual replies' },
  { value: 'broken_links', label: 'Broken links' },
  { value: 'no_booking', label: 'No booking system' },
  { value: 'whatsapp_only', label: 'Only WhatsApp posted' },
  { value: 'no_website', label: 'No website' },
  { value: 'bad_reviews', label: 'Bad reviews (slow response)' },
];

const SOURCES = [
  { value: 'facebook', label: '📘 Facebook' },
  { value: 'google_maps', label: '📍 Google Maps' },
  { value: 'instagram', label: '📸 Instagram' },
  { value: 'referral', label: '🤝 Referral' },
  { value: 'manual', label: '✏️ Manual' },
  { value: 'other', label: '🔗 Other' },
];

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-800',
  opener_sent: 'bg-blue-100 text-blue-800',
  replied: 'bg-green-100 text-green-800',
  interested: 'bg-emerald-100 text-emerald-800',
  preview_sent: 'bg-purple-100 text-purple-800',
  follow_up_1: 'bg-yellow-100 text-yellow-800',
  follow_up_2: 'bg-orange-100 text-orange-800',
  follow_up_3: 'bg-red-100 text-red-800',
  closed_won: 'bg-emerald-100 text-emerald-800',
  closed_lost: 'bg-gray-200 text-gray-500',
  archived: 'bg-gray-50 text-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  new: '🆕 New',
  opener_sent: '📤 Opener Sent',
  replied: '💬 Replied!',
  interested: '🔥 Interested',
  preview_sent: '🔗 Preview Sent',
  follow_up_1: '1️⃣ Follow-up 1',
  follow_up_2: '2️⃣ Follow-up 2',
  follow_up_3: '3️⃣ Follow-up 3',
  closed_won: '🎉 WON!',
  closed_lost: '❌ Lost',
  archived: '📁 Archived',
};

export default function HunterPage() {
  // Form state
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

  // Prospects list
  const [prospects, setProspects] = useState<HunterProspect[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  
  // Opener modal
  const [showOpenerModal, setShowOpenerModal] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<HunterProspect | null>(null);
  const [openerCopied, setOpenerCopied] = useState(false);

  // Load prospects
  const loadProspects = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (serviceFilter !== 'all') params.set('service_type', serviceFilter);
      
      const res = await fetch(`/api/hunter/prospects?${params}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      setProspects(data.prospects || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, serviceFilter]);

  useEffect(() => {
    loadProspects();
  }, [loadProspects]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/hunter/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess('✅ Prospect added! Ready to send opener.');
      setTimeout(() => setSuccess(''), 5000); // Auto-clear after 5s
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
      loadProspects();
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 5000); // Auto-clear after 5s
    } finally {
      setIsSaving(false);
    }
  };

  // Update prospect status
  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/hunter/prospects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      loadProspects();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Generate opener message
  const generateOpener = (prospect: HunterProspect): string => {
    const serviceLabels: Record<string, string> = {
      pest_control: 'pest control',
      aircon: 'aircon',
      plumbing: 'plumbing',
      renovation: 'renovation',
      cleaning: 'cleaning',
      electrical: 'electrical',
      roofing: 'roofing',
      landscaping: 'landscaping',
      moving: 'moving',
      other: 'service',
    };
    
    const service = serviceLabels[prospect.service_type] || prospect.service_type;
    return `Salam boss 👋 You still handling ${service} jobs around ${prospect.area}?`;
  };

  // Copy opener to clipboard
  const copyOpener = async (prospect: HunterProspect) => {
    const opener = generateOpener(prospect);
    await navigator.clipboard.writeText(opener);
    setOpenerCopied(true);
    setTimeout(() => setOpenerCopied(false), 2000);
  };

  // Open WhatsApp with opener
  const openWhatsApp = (prospect: HunterProspect) => {
    const opener = generateOpener(prospect);
    const phone = prospect.whatsapp_number.replace(/[^0-9]/g, '');
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(opener)}`;
    window.open(waUrl, '_blank');
  };

  // Show opener modal
  const showOpener = (prospect: HunterProspect) => {
    setSelectedProspect(prospect);
    setShowOpenerModal(true);
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

  // Stats
  const stats = {
    total: prospects.length,
    new: prospects.filter(p => p.status === 'new').length,
    openerSent: prospects.filter(p => p.status === 'opener_sent').length,
    replied: prospects.filter(p => p.status === 'replied').length,
    closed: prospects.filter(p => p.status === 'closed_won').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🎯 Hunter Mode</h1>
              <p className="text-gray-500 mt-1">Find prospects, log them, send openers. Don't sell yet!</p>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-gray-500">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.openerSent}</div>
                <div className="text-gray-500">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.replied}</div>
                <div className="text-gray-500">Replied</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">{stats.closed}</div>
                <div className="text-gray-500">Won</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Add Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4">➕ Add Prospect</h2>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Business Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.business_name}
                    onChange={e => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
                    placeholder="e.g., Ahmad Pest Control"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Service Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Type *
                  </label>
                  <select
                    required
                    value={formData.service_type}
                    onChange={e => setFormData(prev => ({ ...prev, service_type: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {SERVICE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                {/* Area */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Area/Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.area}
                    onChange={e => setFormData(prev => ({ ...prev, area: e.target.value }))}
                    placeholder="e.g., Ampang, Klang Valley"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    WhatsApp Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.whatsapp_number}
                    onChange={e => setFormData(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                    placeholder="e.g., +60123456789"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Owner Name (optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Owner Name <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.owner_name}
                    onChange={e => setFormData(prev => ({ ...prev, owner_name: e.target.value }))}
                    placeholder="e.g., Boss Ahmad"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Source */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source
                  </label>
                  <select
                    value={formData.source}
                    onChange={e => setFormData(prev => ({ ...prev, source: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {SOURCES.map(source => (
                      <option key={source.value} value={source.value}>{source.label}</option>
                    ))}
                  </select>
                </div>

                {/* Pain Signals */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pain Signals Observed
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PAIN_SIGNALS.map(signal => (
                      <button
                        key={signal.value}
                        type="button"
                        onClick={() => togglePainSignal(signal.value)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                          formData.pain_signals.includes(signal.value)
                            ? 'bg-blue-100 text-blue-700 border-2 border-blue-400'
                            : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                        }`}
                      >
                        {signal.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any observations..."
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isSaving ? 'Saving...' : '➕ Add to List'}
                </button>
              </form>
            </div>

            {/* Quick Tips */}
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="font-semibold text-amber-800 mb-2">🎯 Hunter Rules</h3>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• Only collect info, don't sell yet</li>
                <li>• Look for pain signals (slow replies, "PM us")</li>
                <li>• Target: 20 prospects per session</li>
                <li>• Best sources: Facebook groups, Google Maps</li>
              </ul>
            </div>
          </div>

          {/* Right: Prospects List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border">
              {/* Filters */}
              <div className="p-4 border-b flex flex-wrap gap-3 items-center">
                <span className="text-sm text-gray-500">Filter:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="new">🆕 New</option>
                  <option value="opener_sent">📤 Opener Sent</option>
                  <option value="replied">💬 Replied</option>
                  <option value="preview_sent">🔗 Preview Sent</option>
                  <option value="closed_won">🎉 Won</option>
                  <option value="closed_lost">❌ Lost</option>
                </select>
                <select
                  value={serviceFilter}
                  onChange={e => setServiceFilter(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                >
                  <option value="all">All Services</option>
                  {SERVICE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <button
                  onClick={loadProspects}
                  className="ml-auto px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  🔄 Refresh
                </button>
              </div>

              {/* List */}
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {isLoading ? (
                  <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : prospects.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p className="text-4xl mb-2">🎯</p>
                    <p>No prospects yet. Start hunting!</p>
                  </div>
                ) : (
                  prospects.map(prospect => (
                    <div key={prospect.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">
                              {SERVICE_TYPES.find(t => t.value === prospect.service_type)?.emoji || '🔨'}
                            </span>
                            <h3 className="font-semibold text-gray-900 truncate">
                              {prospect.business_name}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[prospect.status]}`}>
                              {STATUS_LABELS[prospect.status]}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 space-y-0.5">
                            <p>📍 {prospect.area} • 📱 {prospect.whatsapp_number}</p>
                            {prospect.owner_name && <p>👤 {prospect.owner_name}</p>}
                            {prospect.pain_signals.length > 0 && (
                              <p className="text-xs text-orange-600">
                                ⚠️ {prospect.pain_signals.map(s => 
                                  PAIN_SIGNALS.find(p => p.value === s)?.label
                                ).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          {prospect.status === 'new' && (
                            <>
                              <button
                                onClick={() => showOpener(prospect)}
                                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                              >
                                📤 Send Opener
                              </button>
                            </>
                          )}
                          {prospect.status === 'opener_sent' && (
                            <>
                              <button
                                onClick={() => updateStatus(prospect.id, 'replied')}
                                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                              >
                                ✅ They Replied!
                              </button>
                              <button
                                onClick={() => updateStatus(prospect.id, 'follow_up_1')}
                                className="px-3 py-1.5 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600"
                              >
                                ⏰ Follow Up
                              </button>
                            </>
                          )}
                          {prospect.status === 'replied' && (
                            <a
                              href={`/sales?business=${encodeURIComponent(prospect.business_name)}&niche=${encodeURIComponent(prospect.service_type)}&phone=${encodeURIComponent(prospect.whatsapp_number)}&area=${encodeURIComponent(prospect.area)}&prospect_id=${prospect.id}`}
                              className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 text-center"
                            >
                              🚀 Generate Preview
                            </a>
                          )}
                          {['follow_up_1', 'follow_up_2', 'follow_up_3'].includes(prospect.status) && (
                            <>
                              <button
                                onClick={() => updateStatus(prospect.id, 'replied')}
                                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                              >
                                ✅ They Replied!
                              </button>
                              {prospect.status !== 'follow_up_3' && (
                                <button
                                  onClick={() => updateStatus(prospect.id, prospect.status === 'follow_up_1' ? 'follow_up_2' : 'follow_up_3')}
                                  className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600"
                                >
                                  📤 Next Follow Up
                                </button>
                              )}
                              <button
                                onClick={() => updateStatus(prospect.id, 'closed_lost')}
                                className="px-3 py-1.5 bg-gray-400 text-white text-sm rounded-lg hover:bg-gray-500"
                              >
                                ❌ No Response
                              </button>
                            </>
                          )}
                          {prospect.status === 'preview_sent' && (
                            <>
                              <button
                                onClick={() => updateStatus(prospect.id, 'closed_won')}
                                className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
                              >
                                🎉 They Paid!
                              </button>
                              <button
                                onClick={() => updateStatus(prospect.id, 'closed_lost')}
                                className="px-3 py-1.5 bg-gray-400 text-white text-sm rounded-lg hover:bg-gray-500"
                              >
                                ❌ Not Interested
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Opener Modal */}
      {showOpenerModal && selectedProspect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowOpenerModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>
            <h3 className="text-lg font-semibold mb-4">📤 Send Opener Message</h3>
            
            <div className="bg-gray-100 rounded-lg p-4 mb-4">
              <p className="text-gray-800 whitespace-pre-wrap">
                {generateOpener(selectedProspect)}
              </p>
            </div>

            <div className="text-sm text-gray-500 mb-4">
              <p><strong>To:</strong> {selectedProspect.business_name}</p>
              <p><strong>WhatsApp:</strong> {selectedProspect.whatsapp_number}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  copyOpener(selectedProspect);
                }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                {openerCopied ? '✅ Copied!' : '📋 Copy'}
              </button>
              <button
                onClick={() => {
                  openWhatsApp(selectedProspect);
                  updateStatus(selectedProspect.id, 'opener_sent');
                  setShowOpenerModal(false);
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                💬 Open WhatsApp
              </button>
            </div>

            <button
              onClick={() => {
                updateStatus(selectedProspect.id, 'opener_sent');
                setShowOpenerModal(false);
              }}
              className="w-full mt-3 px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Mark as sent & close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
