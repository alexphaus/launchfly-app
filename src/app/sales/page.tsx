'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for browser
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Prospect type matching database schema
interface Prospect {
  id: string;
  business_name: string;
  service_type: string;
  area: string | null;
  whatsapp_phone: string | null;
  email: string | null;
  owner_name: string | null;
  source: string;
  source_url: string | null;
  notes: string | null;
  scraped_data: any;
  status: 'new' | 'opener_sent' | 'replied' | 'interested' | 'not_interested' | 'converted' | 'no_response';
  opener_sent_at: string | null;
  last_followup_at: string | null;
  followup_count: number;
  preview_business_id: string | null;
  preview_generated_at: string | null;
  created_at: string;
}

// Tab types
type TabType = 'collect' | 'prospects' | 'analytics';

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    new: 'bg-slate-100 text-slate-700',
    opener_sent: 'bg-amber-100 text-amber-700',
    replied: 'bg-blue-100 text-blue-700',
    interested: 'bg-green-100 text-green-700',
    not_interested: 'bg-red-100 text-red-700',
    converted: 'bg-emerald-100 text-emerald-700',
    no_response: 'bg-slate-100 text-slate-500',
  };
  const labels: Record<string, string> = {
    new: '🆕 New',
    opener_sent: '📤 Opener Sent',
    replied: '💬 Replied',
    interested: '🔥 Interested',
    not_interested: '❌ Not Interested',
    converted: '✅ Converted',
    no_response: '😴 No Response',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.new}`}>
      {labels[status] || status}
    </span>
  );
};

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('collect');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Collection form state
  const [formData, setFormData] = useState({
    business_name: '',
    service_type: '',
    area: '',
    whatsapp_phone: '',
    email: '',
    owner_name: '',
    source: 'manual',
    source_url: '',
    notes: '',
  });
  
  // Optional scraping state
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  
  // Selected prospect for actions
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Fetch prospects
  const fetchProspects = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('sales_prospects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setProspects(data || []);
    } catch (err: any) {
      console.error('Error fetching prospects:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (activeTab === 'prospects' || activeTab === 'analytics') {
      fetchProspects();
    }
  }, [activeTab, statusFilter, fetchProspects]);

  // Quick scrape for auto-fill (doesn't generate preview)
  const handleQuickScrape = async () => {
    if (!scrapeUrl) return;
    
    setIsScraping(true);
    setError('');
    
    try {
      const response = await fetch('/api/sales/quick-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl }),
      });
      
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      // Auto-fill form with scraped data
      setFormData(prev => ({
        ...prev,
        business_name: data.businessName || prev.business_name,
        service_type: data.niche || prev.service_type,
        area: data.location || prev.area,
        whatsapp_phone: data.phone || prev.whatsapp_phone,
        email: data.email || prev.email,
        owner_name: data.ownerName || prev.owner_name,
        source_url: scrapeUrl,
        source: 'scraper',
      }));
      
      setSuccess('✓ Auto-filled from website!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsScraping(false);
    }
  };

  // Save prospect (Hunter phase)
  const handleSaveProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.business_name || !formData.service_type) {
      setError('Business name and service type are required');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const { error } = await supabase
        .from('sales_prospects')
        .insert([{
          ...formData,
          status: 'new',
        }]);
      
      if (error) throw error;
      
      setSuccess('✓ Prospect saved! Ready for outreach.');
      setFormData({
        business_name: '',
        service_type: '',
        area: '',
        whatsapp_phone: '',
        email: '',
        owner_name: '',
        source: 'manual',
        source_url: '',
        notes: '',
      });
      setScrapeUrl('');
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate opener message (doesn't create preview yet)
  const generateOpener = (prospect: Prospect): string => {
    const area = prospect.area || '';
    const isMalaysian = area.toLowerCase().includes('malaysia') || 
                        area.toLowerCase().includes('kl') || 
                        area.toLowerCase().includes('selangor') ||
                        area.toLowerCase().includes('johor') ||
                        area.toLowerCase().includes('penang');
    const greeting = isMalaysian ? 'Salam' : 'Hi';
    const service = prospect.service_type.toLowerCase();
    const displayArea = prospect.area || 'your area';
    
    return `${greeting} boss 👋 You still handling ${service} jobs around ${displayArea}?`;
  };

  // Copy opener and mark as sent
  const handleCopyOpener = async (prospect: Prospect) => {
    const opener = generateOpener(prospect);
    await navigator.clipboard.writeText(opener);
    
    // Update status
    await supabase
      .from('sales_prospects')
      .update({ 
        status: 'opener_sent',
        opener_sent_at: new Date().toISOString()
      })
      .eq('id', prospect.id);
    
    // Log message
    await supabase
      .from('outreach_messages')
      .insert([{
        prospect_id: prospect.id,
        message_type: 'opener',
        channel: 'whatsapp',
        message_content: opener,
      }]);
    
    setSuccess('✓ Opener copied! Status updated to "Opener Sent"');
    fetchProspects();
    setTimeout(() => setSuccess(''), 3000);
  };

  // Open WhatsApp with opener
  const handleOpenWhatsApp = async (prospect: Prospect) => {
    if (!prospect.whatsapp_phone) {
      setError('No WhatsApp number for this prospect');
      return;
    }
    
    const opener = generateOpener(prospect);
    const cleanPhone = prospect.whatsapp_phone.replace(/[^0-9]/g, '');
    const encodedMessage = encodeURIComponent(opener);
    
    // Update status
    await supabase
      .from('sales_prospects')
      .update({ 
        status: 'opener_sent',
        opener_sent_at: new Date().toISOString()
      })
      .eq('id', prospect.id);
    
    // Log message
    await supabase
      .from('outreach_messages')
      .insert([{
        prospect_id: prospect.id,
        message_type: 'opener',
        channel: 'whatsapp',
        message_content: opener,
      }]);
    
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`, '_blank');
    fetchProspects();
  };

  // Generate preview (only for interested prospects)
  const handleGeneratePreview = async (prospect: Prospect) => {
    if (!prospect) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // Call the existing analyze API but with prospect data
      const response = await fetch('/api/sales/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: prospect.business_name,
          niche: prospect.service_type,
          context: `Business: ${prospect.business_name}\nService: ${prospect.service_type}\nArea: ${prospect.area}\nOwner: ${prospect.owner_name || 'Unknown'}\nPhone: ${prospect.whatsapp_phone}`,
          url: prospect.source_url || undefined,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      // Update prospect with preview business ID
      await supabase
        .from('sales_prospects')
        .update({ 
          preview_business_id: data.businessId,
          preview_generated_at: new Date().toISOString(),
          status: 'interested',
          scraped_data: data.scrapedData || prospect.scraped_data,
        })
        .eq('id', prospect.id);
      
      setSuccess(`✓ Preview generated! Link: ${data.previewUrl}`);
      
      // Copy preview URL to clipboard
      await navigator.clipboard.writeText(data.previewUrl);
      
      setShowPreviewModal(false);
      setSelectedProspect(null);
      fetchProspects();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Update prospect status
  const handleStatusChange = async (prospect: Prospect, newStatus: string) => {
    try {
      const updates: any = { status: newStatus };
      
      if (newStatus === 'replied') {
        updates.last_followup_at = new Date().toISOString();
      }
      
      await supabase
        .from('sales_prospects')
        .update(updates)
        .eq('id', prospect.id);
      
      fetchProspects();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Filter prospects
  const filteredProspects = prospects.filter(p => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        p.business_name.toLowerCase().includes(query) ||
        p.service_type.toLowerCase().includes(query) ||
        p.area?.toLowerCase().includes(query) ||
        p.whatsapp_phone?.includes(query)
      );
    }
    return true;
  });

  // Analytics calculations
  const todayProspects = prospects.filter(p => 
    new Date(p.created_at).toDateString() === new Date().toDateString()
  );
  const todayOpenersSent = prospects.filter(p => 
    p.opener_sent_at && new Date(p.opener_sent_at).toDateString() === new Date().toDateString()
  );
  const repliedCount = prospects.filter(p => p.status === 'replied' || p.status === 'interested').length;
  const convertedCount = prospects.filter(p => p.status === 'converted').length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                🎯 Sales Cockpit
                <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded">FOS v1.0</span>
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Hunter → Closer → Builder
              </p>
            </div>
            
            {/* Quick Stats */}
            <div className="hidden md:flex gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-slate-900">{todayProspects.length}</div>
                <div className="text-xs text-slate-500">Added Today</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-600">{todayOpenersSent.length}</div>
                <div className="text-xs text-slate-500">Openers Sent</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{repliedCount}</div>
                <div className="text-xs text-slate-500">Replies</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">{convertedCount}</div>
                <div className="text-xs text-slate-500">Converted</div>
              </div>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {[
              { id: 'collect', label: '🎣 Collect Leads', desc: 'Hunter Mode' },
              { id: 'prospects', label: '📋 Prospects', desc: 'Closer Mode' },
              { id: 'analytics', label: '📊 Analytics', desc: 'Metrics' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-slate-50 text-slate-900 border-t border-x border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
                <span className="hidden sm:inline text-xs text-slate-400 ml-1">({tab.desc})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      {(error || success) && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex justify-between items-center">
              {error}
              <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">✕</button>
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">
              {success}
            </div>
          )}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Collect Tab - Hunter Mode */}
        {activeTab === 'collect' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Quick Scrape Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                🔍 Quick Scrape (Optional)
              </h2>
              <p className="text-sm text-slate-600 mb-4">
                Paste a URL to auto-fill business details. No preview generated yet.
              </p>
              
              <div className="flex gap-2">
                <input
                  type="url"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  placeholder="https://business-website.com"
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleQuickScrape}
                  disabled={isScraping || !scrapeUrl}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isScraping ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : '🔍'}
                  Scrape
                </button>
              </div>
              
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  <strong>💡 Cost Saver:</strong> This only extracts contact info. No AI generation until prospect shows interest.
                </p>
              </div>
            </div>

            {/* Manual Entry Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                ✏️ Add Prospect
              </h2>
              <p className="text-sm text-slate-600 mb-4">
                Minimum: Business Name + Service Type + WhatsApp
              </p>
              
              <form onSubmit={handleSaveProspect} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={formData.business_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
                    placeholder="Business Name *"
                    required
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={formData.service_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, service_type: e.target.value }))}
                    required
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Service Type *</option>
                    <option value="Pest Control">🐜 Pest Control</option>
                    <option value="Aircon Service">❄️ Aircon Service</option>
                    <option value="Plumbing">🔧 Plumbing</option>
                    <option value="Renovation">🏠 Renovation</option>
                    <option value="Cleaning">🧹 Cleaning</option>
                    <option value="Electrical">⚡ Electrical</option>
                    <option value="Roofing">🏗️ Roofing</option>
                    <option value="Other">📦 Other</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={formData.area}
                    onChange={(e) => setFormData(prev => ({ ...prev, area: e.target.value }))}
                    placeholder="Area (e.g. Ampang, KL)"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="tel"
                    value={formData.whatsapp_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_phone: e.target.value }))}
                    placeholder="WhatsApp Number *"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={formData.owner_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, owner_name: e.target.value }))}
                    placeholder="Owner Name (optional)"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Email (optional)"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <select
                  value={formData.source}
                  onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="manual">📝 Manual Entry</option>
                  <option value="google_maps">🗺️ Google Maps</option>
                  <option value="facebook">📘 Facebook</option>
                  <option value="instagram">📸 Instagram</option>
                  <option value="scraper">🔍 Web Scraper</option>
                </select>
                
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes (pain signals, observations...)"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : '💾'}
                  Save Prospect
                </button>
              </form>
            </div>

            {/* Daily Goal Card */}
            <div className="md:col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
              <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                🎯 Daily Hunter Goals
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-slate-900">{todayProspects.length}/20</div>
                  <div className="text-sm text-slate-600">Prospects Collected</div>
                  <div className={`text-xs mt-1 ${todayProspects.length >= 20 ? 'text-green-600' : 'text-slate-500'}`}>
                    {todayProspects.length >= 20 ? '✓ Goal Hit!' : `${20 - todayProspects.length} more to go`}
                  </div>
                </div>
                <div className="bg-white/50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-amber-600">{todayOpenersSent.length}/20</div>
                  <div className="text-sm text-slate-600">Openers Sent</div>
                  <div className="text-xs mt-1 text-slate-500">Switch to Closer mode →</div>
                </div>
                <div className="bg-white/50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-emerald-600">{convertedCount}</div>
                  <div className="text-sm text-slate-600">Total Conversions</div>
                  <div className="text-xs mt-1 text-slate-500">All-time</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Prospects Tab - Closer Mode */}
        {activeTab === 'prospects' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Search by name, service, area, phone..."
                  className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="new">🆕 New</option>
                  <option value="opener_sent">📤 Opener Sent</option>
                  <option value="replied">💬 Replied</option>
                  <option value="interested">🔥 Interested</option>
                  <option value="converted">✅ Converted</option>
                  <option value="no_response">😴 No Response</option>
                </select>
                
                <button
                  onClick={fetchProspects}
                  className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>

            {/* Prospects List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-600">Loading prospects...</p>
                </div>
              ) : filteredProspects.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-4">📭</div>
                  <p className="text-slate-600">No prospects found. Start collecting!</p>
                  <button
                    onClick={() => setActiveTab('collect')}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Go to Hunter Mode
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredProspects.map((prospect) => (
                    <div key={prospect.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-900">{prospect.business_name}</h3>
                            <StatusBadge status={prospect.status} />
                          </div>
                          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                            <span>🔧 {prospect.service_type}</span>
                            {prospect.area && <span>📍 {prospect.area}</span>}
                            {prospect.whatsapp_phone && <span>📱 {prospect.whatsapp_phone}</span>}
                            {prospect.owner_name && <span>👤 {prospect.owner_name}</span>}
                          </div>
                          {prospect.notes && (
                            <p className="text-xs text-slate-500 mt-1 italic">{prospect.notes}</p>
                          )}
                          <div className="text-xs text-slate-400 mt-2">
                            Added {new Date(prospect.created_at).toLocaleDateString()}
                            {prospect.source !== 'manual' && ` • via ${prospect.source}`}
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2">
                          {/* Status-based actions */}
                          {prospect.status === 'new' && (
                            <>
                              <button
                                onClick={() => handleOpenWhatsApp(prospect)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center gap-1"
                              >
                                💬 Send Opener
                              </button>
                              <button
                                onClick={() => handleCopyOpener(prospect)}
                                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
                              >
                                📋 Copy Opener
                              </button>
                            </>
                          )}
                          
                          {prospect.status === 'opener_sent' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(prospect, 'replied')}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                              >
                                ✓ They Replied
                              </button>
                              <button
                                onClick={() => handleStatusChange(prospect, 'no_response')}
                                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
                              >
                                ❌ No Response
                              </button>
                            </>
                          )}
                          
                          {prospect.status === 'replied' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedProspect(prospect);
                                  setShowPreviewModal(true);
                                }}
                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-1"
                              >
                                ✨ Generate Preview
                              </button>
                              <button
                                onClick={() => handleStatusChange(prospect, 'not_interested')}
                                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
                              >
                                Not Interested
                              </button>
                            </>
                          )}
                          
                          {prospect.status === 'interested' && prospect.preview_business_id && (
                            <>
                              <a
                                href={`/${prospect.preview_business_id}?preview=true`}
                                target="_blank"
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 text-center"
                              >
                                🔗 View Preview
                              </a>
                              <button
                                onClick={() => handleStatusChange(prospect, 'converted')}
                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                              >
                                💰 Mark Converted
                              </button>
                            </>
                          )}
                          
                          {(prospect.status === 'no_response' || prospect.status === 'not_interested') && (
                            <button
                              onClick={() => handleStatusChange(prospect, 'new')}
                              className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
                            >
                              🔄 Reset Status
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Daily Metrics */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">📊 Today's Performance</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-slate-900">{todayProspects.length}</div>
                  <div className="text-sm text-slate-600">Prospects Added</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-amber-600">{todayOpenersSent.length}</div>
                  <div className="text-sm text-slate-600">Openers Sent</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {prospects.filter(p => p.status === 'replied' || p.status === 'interested').length}
                  </div>
                  <div className="text-sm text-slate-600">Replies</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-emerald-600">
                    {prospects.filter(p => p.preview_business_id).length}
                  </div>
                  <div className="text-sm text-slate-600">Previews Generated</div>
                </div>
              </div>
            </div>

            {/* Funnel */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">🔄 Sales Funnel</h2>
              <div className="space-y-3">
                {[
                  { label: 'Total Prospects', count: prospects.length, color: 'bg-slate-500' },
                  { label: 'Opener Sent', count: prospects.filter(p => ['opener_sent', 'replied', 'interested', 'converted'].includes(p.status)).length, color: 'bg-amber-500' },
                  { label: 'Replied', count: prospects.filter(p => ['replied', 'interested', 'converted'].includes(p.status)).length, color: 'bg-blue-500' },
                  { label: 'Interested', count: prospects.filter(p => ['interested', 'converted'].includes(p.status)).length, color: 'bg-indigo-500' },
                  { label: 'Converted', count: prospects.filter(p => p.status === 'converted').length, color: 'bg-emerald-500' },
                ].map((stage) => (
                  <div key={stage.label} className="flex items-center gap-3">
                    <div className="w-32 text-sm text-slate-600">{stage.label}</div>
                    <div className="flex-1 bg-slate-100 rounded-full h-8 overflow-hidden">
                      <div 
                        className={`h-full ${stage.color} transition-all duration-500`}
                        style={{ width: `${prospects.length ? (stage.count / prospects.length) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="w-12 text-right font-semibold text-slate-900">{stage.count}</div>
                    <div className="w-16 text-right text-sm text-slate-500">
                      {prospects.length ? Math.round((stage.count / prospects.length) * 100) : 0}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cost Savings */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
              <h2 className="text-lg font-bold text-green-900 mb-3">💰 Cost Savings</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-700">
                    {prospects.length - prospects.filter(p => p.preview_business_id).length}
                  </div>
                  <div className="text-sm text-green-800">Prospects WITHOUT Preview</div>
                  <div className="text-xs text-green-600 mt-1">
                    ~${((prospects.length - prospects.filter(p => p.preview_business_id).length) * 0.05).toFixed(2)} saved in AI costs
                  </div>
                </div>
                <div className="bg-white/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-700">
                    {prospects.filter(p => p.preview_business_id).length}
                  </div>
                  <div className="text-sm text-green-800">Previews Generated</div>
                  <div className="text-xs text-green-600 mt-1">
                    Only for interested prospects
                  </div>
                </div>
                <div className="bg-white/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-700">
                    {prospects.length ? Math.round((prospects.filter(p => p.preview_business_id).length / prospects.length) * 100) : 0}%
                  </div>
                  <div className="text-sm text-green-800">Preview Rate</div>
                  <div className="text-xs text-green-600 mt-1">
                    vs 100% in old system
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview Generation Modal */}
      {showPreviewModal && selectedProspect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              ✨ Generate Preview for {selectedProspect.business_name}?
            </h3>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800">
                <strong>⚠️ Cost:</strong> This will use AI to generate a full preview funnel (~$0.05).
                Only do this for prospects who have shown interest.
              </p>
            </div>
            
            <div className="space-y-2 text-sm text-slate-600 mb-4">
              <p><strong>Service:</strong> {selectedProspect.service_type}</p>
              <p><strong>Area:</strong> {selectedProspect.area || 'Not specified'}</p>
              <p><strong>WhatsApp:</strong> {selectedProspect.whatsapp_phone}</p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setSelectedProspect(null);
                }}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleGeneratePreview(selectedProspect)}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : '✨'}
                Generate Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
