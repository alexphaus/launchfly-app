'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// Types
interface Prospect {
  id: string;
  business_name: string;
  service_type: string;
  area: string;
  whatsapp_number: string;
  email?: string;
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
  last_follow_up_at?: string;
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
  // Prospects
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [morningActionFilter, setMorningActionFilter] = useState(false);

  // Modals
  const [showOpenerModal, setShowOpenerModal] = useState(false);
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [prospectViewed, setProspectViewed] = useState(false);

  // Opener Selection State
  const [selectedOpenerArea, setSelectedOpenerArea] = useState('');
  const [selectedOpenerPhone, setSelectedOpenerPhone] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

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
        // Ensure fresh data
        cache: 'no-store'
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

  // Check if prospect needs follow-up based on time (for Morning Action filter)
  const needsFollowUp = (prospect: Prospect): boolean => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    if (prospect.status === 'opener_sent' && prospect.opener_sent_at) {
      const hoursSince = (now - new Date(prospect.opener_sent_at).getTime()) / (60 * 60 * 1000);
      return hoursSince >= 24;
    }

    if (prospect.status === 'follow_up_1' && prospect.last_follow_up_at) {
      const hoursSince = (now - new Date(prospect.last_follow_up_at).getTime()) / (60 * 60 * 1000);
      return hoursSince >= 48;
    }

    if (prospect.status === 'follow_up_2' && prospect.last_follow_up_at) {
      const daysSince = (now - new Date(prospect.last_follow_up_at).getTime()) / DAY;
      return daysSince >= 5;
    }

    // Mid-chat ghosting: Replied status > 2 days ago
    if (prospect.status === 'replied' && prospect.replied_at) {
      const daysSince = (now - new Date(prospect.replied_at).getTime()) / DAY;
      return daysSince >= 2;
    }

    // Preview sent but no response after 24 hours
    if (prospect.status === 'preview_sent' && prospect.preview_sent_at) {
      const hoursSince = (now - new Date(prospect.preview_sent_at).getTime()) / (60 * 60 * 1000);
      return hoursSince >= 24;
    }

    return false;
  };

  // Filter prospects by search and morning action
  const filteredProspects = prospects.filter(p => {
    // Morning action filter - show only prospects needing follow-up
    if (morningActionFilter) {
      if (!needsFollowUp(p)) return false;
    }

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
    morningAction: prospects.filter(p => needsFollowUp(p)).length,
  };

  // Generate opener message
  const generateOpener = (prospect: Prospect, customArea?: string): string => {
    const service = SERVICE_TYPES.find(t => t.value === prospect.service_type)?.service || prospect.service_type;
    const area = customArea || prospect.area;
    return `Hi boss 👋 You still handling ${service} jobs around ${area}?
    
I made a simple WhatsApp booking page for ${prospect.business_name} that auto-collects customer details while you’re on the job — so you don’t miss enquiries.

Want to see? 😄`;
  };

  // Generate Email Opener
  const generateEmailOpener = (prospect: Prospect, customArea?: string) => {
    const service = SERVICE_TYPES.find(t => t.value === prospect.service_type)?.service || prospect.service_type;
    const area = customArea || prospect.area;
    const name = prospect.owner_name ? prospect.owner_name.split(' ')[0] : 'there';

    return {
      subject: `Question about ${prospect.business_name}`,
      body: `Hi ${name},

I’m a local developer here in ${area.split(',')[0].trim()}. I saw your ${service} listing online.

Quick question — are you currently taking new jobs in ${area} this week?

I ask because I built a small tool to help manage inquiries for local pros, and I wanted to see if it might be useful for you.

Best,
Alex`
    };
  };

  // Generate pitch message (after they say yes)
  const generatePitch = (prospect: Prospect): string => {
    return `Nice 👍  Here is the preview I made for you.

👉 ${prospect.preview_url || '[PREVIEW LINK]'}

Just scroll & imagine customers clicking this while you’re busy on-site.`;
  };

  // Generate follow-up message based on status (Day 1/3/5 strategy + Behavior)
  const generateFollowUp = (prospect: Prospect, viewed: boolean = false): { message: string; nextStatus: string; label: string } => {
    switch (prospect.status) {
      case 'opener_sent':
        return {
          message: `Hi boss 👋 Just checking — did you see my message yesterday?\n\nNo rush, just want to know if this is relevant for you 👍`,
          nextStatus: 'follow_up_1',
          label: 'Day 1 - Soft Nudge'
        };
      case 'follow_up_1':
        return {
          message: `Quick one boss 🙂\n\nMost service owners I spoke to miss enquiries when they're on site / busy.\nThat's why I built this — auto-reply + capture details so leads don't disappear.\n\nIf this isn't for you, just tell me "not now" 👍`,
          nextStatus: 'follow_up_2',
          label: 'Day 3 - Value Reminder'
        };
      case 'follow_up_2':
        return {
          message: `Last message from me boss 👍\n\nShould I send you the quick preview, or is this something you want to skip for now?`,
          nextStatus: 'follow_up_3',
          label: 'Day 5 - Breakup'
        };
      case 'preview_sent':
        if (viewed) {
          return {
            message: `Hey boss 👋\nSaw you checked the preview — any thoughts?\n\nHappy to adjust it to your business if you want 👍`,
            nextStatus: 'follow_up_1', // Re-enter funnel or specific loop
            label: 'Viewed Preview Follow-up'
          };
        } else {
          return {
            message: `Hi boss 👋\n\nJust checking if you managed to open the preview link I sent?\n\nLet me know if it didn't work 👍`,
            nextStatus: 'follow_up_1',
            label: 'Preview Follow-up'
          };
        }
      case 'replied':
        // Mid-chat ghosting
        return {
          message: `All good boss 👍\nJust let me know if you want to continue later.`,
          nextStatus: 'closed_lost', // Or keep as replied/follow_up
          label: 'Ghosting / Soft Close'
        };
      default:
        // Generic or if they are in follow_up_3 etc
        if (viewed && prospect.status !== 'closed_won') {
          return {
            message: `Hey boss 👋\nSaw you checked the preview — any thoughts?\n\nHappy to adjust it to your business if you want 👍`,
            nextStatus: 'follow_up_1',
            label: 'Viewed Preview Follow-up'
          };
        }
        return {
          message: `Hi boss 👋 Just checking in — any updates?`,
          nextStatus: 'follow_up_1',
          label: 'Follow-up'
        };
    }
  };



  // Open WhatsApp
  const openWhatsApp = (prospect: Prospect, message: string, customPhone?: string) => {
    const targetPhone = customPhone || prospect.whatsapp_number;
    const phone = targetPhone.replace(/[^0-9]/g, '');
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

      // Update selected prospect so modal reflects changes immediately
      if (selectedProspect && selectedProspect.id === prospect.id) {
        setSelectedProspect(prev => prev ? ({
          ...prev,
          status: 'preview_sent',
          preview_url: data.previewUrl,
          preview_business_id: data.businessId
        }) : null);
      }

      showToast('success', '🚀 Preview generated!');
      // Keep modal open so user can copy the updated pitch
      loadProspects();
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              Sales Pipeline
              <span className="text-sm font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {stats.total}
              </span>
            </h1>
            <div className="mt-2 flex gap-4 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-slate-500 text-sm">Sent Today:</span>
                <strong className="text-slate-900 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-sm">{stats.todaySent}</strong>
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-slate-500 text-sm">Hot Leads:</span>
                <strong className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 text-sm">{stats.replied}</strong>
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-slate-500 text-sm">Won:</span>
                <strong className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 text-sm">{stats.won}</strong>
              </div>
            </div>
          </div>
          <Link
            href="/hunter"
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 shadow hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <span>➕</span> Quick Add
          </Link>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Filters Header */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input
                  type="text"
                  placeholder="Search by name, area, or phone..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.emoji} {config.label}</option>
                ))}
              </select>
              <button
                onClick={() => setMorningActionFilter(!morningActionFilter)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer flex items-center gap-2 ${morningActionFilter
                  ? 'bg-amber-500 text-white shadow hover:bg-amber-600'
                  : 'border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
                  }`}
              >
                ☀️ Morning Action
                {stats.morningAction > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${morningActionFilter ? 'bg-white/20' : 'bg-amber-200'
                    }`}>
                    {stats.morningAction}
                  </span>
                )}
              </button>
              <button
                onClick={loadProspects}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 rounded-lg transition-all cursor-pointer"
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {/* Prospect List */}
          <div className="divide-y divide-slate-100">
            {isLoading ? (
              <div className="text-center py-12 text-slate-500">Loading...</div>
            ) : filteredProspects.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-2">🎯</p>
                <p className="text-slate-500">No prospects yet. Start hunting!</p>
                <Link
                  href="/hunter"
                  className="mt-4 inline-block px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium shadow hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
                >
                  ➕ Add First Prospect
                </Link>
              </div>
            ) : (
              filteredProspects.map(prospect => (
                <ProspectCard
                  key={prospect.id}
                  prospect={prospect}
                  onSendOpener={() => {
                    setSelectedProspect(prospect);
                    // Initialize selection state
                    setSelectedOpenerArea(prospect.area.split(/[,/]+/).map(s => s.trim())[0]); // Default to first area if split

                    const phones = prospect.whatsapp_number.match(/\+?\d{8,}/g) || [prospect.whatsapp_number];
                    setSelectedOpenerPhone(phones[0]);

                    setShowOpenerModal(true);
                  }}
                  onShowPitch={() => {
                    setSelectedProspect(prospect);
                    setShowPitchModal(true);
                  }}
                  onShowDetails={() => {
                    setSelectedProspect(prospect);
                    setShowDetailsModal(true);
                  }}
                  onFollowUp={() => {
                    setSelectedProspect(prospect);
                    const phones = prospect.whatsapp_number.match(/\+?\d{8,}/g) || [prospect.whatsapp_number];
                    setSelectedOpenerPhone(phones[0]);

                    // Reset view status first
                    setProspectViewed(false);

                    // If preview sent, check if they viewed
                    if (prospect.status === 'preview_sent' || prospect.preview_business_id) {
                      // We can optimistically check or just load
                      // For now, let's fetch
                      const checkView = async () => {
                        try {
                          if (!prospect.preview_business_id) return;
                          const res = await fetch(`/api/sales/check-view?business_id=${prospect.preview_business_id}`);
                          const data = await res.json();
                          if (data.viewed) setProspectViewed(true);
                        } catch (e) {
                          console.error(e);
                        }
                      };
                      checkView();
                    }

                    setShowFollowUpModal(true);
                  }}
                  onUpdateStatus={updateStatus}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* OPENER MODAL */}
      {showOpenerModal && selectedProspect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 relative">
            <h3 className="text-lg font-semibold mb-4">📤 Send Opener</h3>

            {/* Area Selection Chips */}
            {selectedProspect.area.match(/[,/]+/) && (
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Select Area</label>
                <div className="flex flex-wrap gap-2">
                  {selectedProspect.area.split(/[,/]+/).map(s => s.trim()).filter(Boolean).map((area, i) => (
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
                    onClick={() => setSelectedOpenerArea(selectedProspect.area)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedOpenerArea === selectedProspect.area
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
            {(selectedProspect.whatsapp_number.match(/\+?\d{8,}/g)?.length || 0) > 1 && (
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Select Phone</label>
                <div className="flex flex-wrap gap-2">
                  {(selectedProspect.whatsapp_number.match(/\+?\d{8,}/g) || []).map((phone, i) => (
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

            <div className="bg-slate-100 rounded-lg p-4 mb-4">
              <p className="text-slate-800 whitespace-pre-wrap font-medium">
                {generateOpener(selectedProspect, selectedOpenerArea)}
              </p>
            </div>

            <div className="text-sm text-slate-500 mb-4">
              <p><strong>To:</strong> {selectedProspect.business_name}</p>
              <p><strong>WhatsApp:</strong> {selectedOpenerPhone || selectedProspect.whatsapp_number}</p>
            </div>

            <div className="flex gap-3">
              {selectedProspect.email ? (
                <button
                  onClick={async () => {
                    setIsSendingEmail(true);
                    try {
                      const emailContent = generateEmailOpener(selectedProspect, selectedOpenerArea);
                      const res = await fetch('/api/sales/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          to: selectedProspect.email,
                          subject: emailContent.subject,
                          body: emailContent.body,
                        }),
                      });

                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error);

                      showToast('success', '📧 Email sent!');
                      updateStatus(selectedProspect.id, 'opener_sent');
                      setShowOpenerModal(false);
                    } catch (err: any) {
                      showToast('error', err.message);
                    } finally {
                      setIsSendingEmail(false);
                    }
                  }}
                  disabled={isSendingEmail}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium shadow-sm hover:shadow hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSendingEmail ? '📧 Sending...' : '📧 Send Email'}
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(generateOpener(selectedProspect, selectedOpenerArea));
                    showToast('success', '📋 Copied!');
                  }}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium shadow-sm hover:shadow hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  📋 Copy Text
                </button>
              )}
              <button
                onClick={() => {
                  openWhatsApp(selectedProspect, generateOpener(selectedProspect, selectedOpenerArea), selectedOpenerPhone || undefined);
                  // Don't close or update status automatically
                }}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium shadow hover:shadow-lg hover:from-green-600 hover:to-green-700 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                💬 WhatsApp
              </button>
            </div>

            <button
              onClick={() => {
                updateStatus(selectedProspect.id, 'opener_sent');
                setShowOpenerModal(false);
              }}
              className="w-full mt-4 px-4 py-3 bg-slate-900 text-white rounded-lg font-medium shadow hover:shadow-lg hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
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
              onClick={() => {
                // Set to 'preview_sent' so it queues up for later follow-up in Morning Action
                updateStatus(selectedProspect.id, 'preview_sent');
                setShowPitchModal(false);
              }}
              className="w-full mt-3 px-4 py-3 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
              ⏰ Follow-Up for Later
              <span className="text-xs font-normal text-slate-500">(Adds to Morning Action)</span>
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

      {/* FOLLOW-UP MODAL */}
      {showFollowUpModal && selectedProspect && (() => {
        const followUp = generateFollowUp(selectedProspect, prospectViewed);

        const phones = selectedProspect.whatsapp_number.match(/\+?\d{8,}/g) || [selectedProspect.whatsapp_number];

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 relative">
              <h3 className="text-lg font-semibold mb-2">📞 {followUp.label}</h3>
              <p className="text-sm text-slate-500 mb-4">
                Send this follow-up to keep the conversation going.
              </p>

              {/* Phone Selection (if multiple) */}
              {phones.length > 1 && (
                <div className="mb-4">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Select Phone</label>
                  <div className="flex flex-wrap gap-2">
                    {phones.map((phone, i) => (
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

              <div className="bg-slate-100 rounded-lg p-4 mb-4">
                <p className="text-slate-800 whitespace-pre-wrap text-sm">
                  {followUp.message}
                </p>
              </div>

              <div className="text-sm text-slate-500 mb-4">
                <p><strong>To:</strong> {selectedProspect.business_name}</p>
                <p><strong>WhatsApp:</strong> {selectedOpenerPhone || phones[0]}</p>
                <p><strong>Next status:</strong> {STATUS_CONFIG[followUp.nextStatus]?.label || followUp.nextStatus}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(followUp.message);
                    showToast('success', '📋 Copied!');
                  }}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium shadow-sm hover:shadow hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  📋 Copy Text
                </button>
                <button
                  onClick={() => {
                    const phone = selectedOpenerPhone || phones[0];
                    openWhatsApp(selectedProspect, followUp.message, phone);
                  }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium shadow hover:shadow-lg hover:from-green-600 hover:to-green-700 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  💬 WhatsApp
                </button>
              </div>

              <button
                onClick={() => {
                  updateStatus(selectedProspect.id, followUp.nextStatus);
                  setShowFollowUpModal(false);
                }}
                className="w-full mt-4 px-4 py-3 bg-slate-900 text-white rounded-lg font-medium shadow hover:shadow-lg hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
              >
                ✅ Mark as sent & close
              </button>

              <button
                onClick={() => setShowFollowUpModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })()}

      {/* DETAILS MODAL */}
      {showDetailsModal && selectedProspect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetailsModal(false)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{selectedProspect.business_name}</h2>
                <div className="flex gap-2 items-center">
                  <span className={`px-2.5 py-0.5 rounded-full text-sm font-medium ${STATUS_CONFIG[selectedProspect.status]?.color}`}>
                    {STATUS_CONFIG[selectedProspect.status]?.emoji} {STATUS_CONFIG[selectedProspect.status]?.label}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-sm font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    {SERVICE_TYPES.find(t => t.value === selectedProspect.service_type)?.label || selectedProspect.service_type}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl">✕</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</label>
                  <div className="mt-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">📱</span>
                      <a href={`https://wa.me/${selectedProspect.whatsapp_number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {selectedProspect.whatsapp_number}
                      </a>
                    </div>
                    {selectedProspect.email && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">📧</span>
                        <a href={`mailto:${selectedProspect.email}`} className="text-blue-600 hover:underline">
                          {selectedProspect.email}
                        </a>
                      </div>
                    )}
                    {selectedProspect.owner_name && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">👤</span>
                        <span className="text-slate-900">{selectedProspect.owner_name}</span>
                      </div>
                    )}
                    {selectedProspect.website_url ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">🌐</span>
                        <a href={selectedProspect.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                          {selectedProspect.website_url}
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400">
                        <span>🌐</span>
                        <span>No website</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Location & Info</label>
                  <div className="mt-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">📍</span>
                      <span className="text-slate-900">{selectedProspect.area}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">🔍</span>
                      <span className="text-slate-900 capitalize">{selectedProspect.source}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">📅</span>
                      <span className="text-slate-900">Added {new Date(selectedProspect.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {selectedProspect.pain_signals && selectedProspect.pain_signals.length > 0 && (
              <div className="mb-6">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Pain Signals</label>
                <div className="flex flex-wrap gap-2">
                  {selectedProspect.pain_signals.map(signal => (
                    <span key={signal} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm border border-red-100">
                      {PAIN_SIGNALS.find(p => p.value === signal)?.label || signal}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedProspect.notes && (
              <div className="mb-6">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Notes</label>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-slate-700 whitespace-pre-wrap">
                  {selectedProspect.notes}
                </div>
              </div>
            )}

            {selectedProspect.preview_url && (
              <div className="mb-6">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Preview Link</label>
                <div className="flex items-center gap-3 bg-purple-50 p-4 rounded-lg border border-purple-100">
                  <span className="text-purple-500 text-lg">🔗</span>
                  <a
                    href={selectedProspect.preview_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:underline flex-1 truncate"
                  >
                    {selectedProspect.preview_url}
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedProspect.preview_url!);
                      showToast('success', '🔗 Link copied!');
                    }}
                    className="px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                Close
              </button>
            </div>
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

// Prospect Card Component
function ProspectCard({
  prospect,
  onSendOpener,
  onShowPitch,
  onShowDetails,
  onFollowUp,
  onUpdateStatus,
}: {
  prospect: Prospect;
  onSendOpener: () => void;
  onShowPitch: () => void;
  onShowDetails: () => void;
  onFollowUp: () => void;
  onUpdateStatus: (id: string, status: string, extra?: Record<string, any>) => void;
}) {
  const statusConfig = STATUS_CONFIG[prospect.status] || STATUS_CONFIG.new;
  const service = SERVICE_TYPES.find(t => t.value === prospect.service_type);

  // Calculate days since last activity
  const lastActivity = prospect.replied_at || prospect.opener_sent_at || prospect.created_at;
  const daysSince = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));

  // Calculate if follow-up is available based on timing rules
  const getFollowUpAvailability = (): { canFollowUp: boolean; hoursRemaining: number; label: string } => {
    const now = Date.now();
    const HOUR = 60 * 60 * 1000;
    const DAY = 24 * HOUR;

    if (prospect.status === 'opener_sent' && prospect.opener_sent_at) {
      const hoursSince = (now - new Date(prospect.opener_sent_at).getTime()) / HOUR;
      if (hoursSince < 24) {
        return { canFollowUp: false, hoursRemaining: Math.ceil(24 - hoursSince), label: 'Wait 24h' };
      }
    }

    if (prospect.status === 'follow_up_1' && prospect.last_follow_up_at) {
      const hoursSince = (now - new Date(prospect.last_follow_up_at).getTime()) / HOUR;
      if (hoursSince < 48) {
        return { canFollowUp: false, hoursRemaining: Math.ceil(48 - hoursSince), label: 'Wait 48h' };
      }
    }

    if (prospect.status === 'follow_up_2' && prospect.last_follow_up_at) {
      const daysSinceFollow = (now - new Date(prospect.last_follow_up_at).getTime()) / DAY;
      if (daysSinceFollow < 5) {
        const hoursRemaining = Math.ceil((5 - daysSinceFollow) * 24);
        return { canFollowUp: false, hoursRemaining, label: 'Wait 5d' };
      }
    }

    if (prospect.status === 'preview_sent' && prospect.preview_sent_at) {
      const hoursSince = (now - new Date(prospect.preview_sent_at).getTime()) / HOUR;
      if (hoursSince < 24) {
        return { canFollowUp: false, hoursRemaining: Math.ceil(24 - hoursSince), label: 'Wait 24h' };
      }
    }

    return { canFollowUp: true, hoursRemaining: 0, label: '' };
  };

  const followUpStatus = getFollowUpAvailability();

  return (
    <div className="p-6 hover:bg-slate-50 transition">
      <div className="flex items-start justify-between gap-4">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{service?.label.split(' ')[0] || '🔨'}</span>
            <h3
              onClick={onShowDetails}
              className="font-semibold text-slate-900 truncate cursor-pointer hover:text-blue-600 transition-colors"
            >
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
              className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-lg shadow hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
            >
              📤 Send Opener
            </button>
          )}

          {prospect.status === 'opener_sent' && (
            <>
              <button
                onClick={() => onUpdateStatus(prospect.id, 'replied')}
                className="px-3 py-1.5 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm font-medium rounded-lg shadow hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
              >
                ✅ They Replied
              </button>
              <button
                onClick={followUpStatus.canFollowUp ? onFollowUp : undefined}
                disabled={!followUpStatus.canFollowUp}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${followUpStatus.canFollowUp
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
              >
                {followUpStatus.canFollowUp ? '📞 Send Follow-Up' : `⏰ ${followUpStatus.hoursRemaining}h`}
              </button>
            </>
          )}

          {(prospect.status === 'replied' || prospect.status === 'interested') && (
            <button
              onClick={onShowPitch}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-sm font-medium rounded-lg shadow hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
            >
              🚀 Send Pitch
            </button>
          )}

          {prospect.status === 'preview_sent' && (
            <>
              <button
                onClick={() => onUpdateStatus(prospect.id, 'closed_won')}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-sm font-medium rounded-lg shadow hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
              >
                🎉 They Paid!
              </button>
              <button
                onClick={followUpStatus.canFollowUp ? onFollowUp : undefined}
                disabled={!followUpStatus.canFollowUp}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${followUpStatus.canFollowUp
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
              >
                {followUpStatus.canFollowUp ? '📞 Follow Up' : `⏰ ${followUpStatus.hoursRemaining}h`}
              </button>
              <button
                onClick={() => onUpdateStatus(prospect.id, 'closed_lost')}
                className="px-3 py-1.5 text-slate-400 text-sm font-medium rounded-lg hover:text-slate-600 hover:bg-slate-50 transition-all duration-200 cursor-pointer"
              >
                ❌ Not Interested
              </button>
            </>
          )}

          {['follow_up_1', 'follow_up_2', 'follow_up_3'].includes(prospect.status) && (
            <>
              <button
                onClick={() => onUpdateStatus(prospect.id, 'replied')}
                className="px-3 py-1.5 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm font-medium rounded-lg shadow hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
              >
                ✅ They Replied
              </button>
              {prospect.status !== 'follow_up_3' && (
                <button
                  onClick={followUpStatus.canFollowUp ? onFollowUp : undefined}
                  disabled={!followUpStatus.canFollowUp}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${followUpStatus.canFollowUp
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                >
                  {followUpStatus.canFollowUp ? '📞 Next Follow-Up' : `⏰ ${followUpStatus.hoursRemaining}h`}
                </button>
              )}
              <button
                onClick={() => onUpdateStatus(prospect.id, 'closed_lost')}
                className="px-3 py-1.5 text-slate-400 text-sm font-medium rounded-lg hover:text-slate-600 hover:bg-slate-50 transition-all duration-200 cursor-pointer"
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
