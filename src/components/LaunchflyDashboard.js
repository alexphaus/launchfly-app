import React, { useState, useEffect } from 'react';
import { FileText, Globe, Mail, Share2, Users, Copy, ExternalLink, Download, CheckCircle, Clock, X, ChevronRight, Loader2, Phone, MessageCircle, Target, TrendingUp, Zap, Settings } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function LaunchflyDashboard({ session, business, onUpdateBusiness }) {
  const [copied, setCopied] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(business?.phone_number || '');
  const [savingSettings, setSavingSettings] = useState(false);
  const [leads, setLeads] = useState([]);

  // Sync phone number from business data if it loads after mount or changes
  useEffect(() => {
    if (business?.phone_number && !phoneNumber) {
      setPhoneNumber(business.phone_number);
    }
  }, [business?.phone_number]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [activeTab, setActiveTab] = useState('quickstart'); // quickstart, 30day, playbook
  const [checklist, setChecklist] = useState({
    google: false,
    facebook: false,
    outreach: false,
    // 30-day plan items
    week1_templates: false,
    week1_outreach: false,
    week1_firstclient: false,
    week2_deliver: false,
    week2_tracking: false,
    week2_proof: false,
    week3_casestudy: false,
    week3_ads: false,
    week4_retainer: false,
    week4_referral: false
  });
  
  const supabase = createClientComponentClient();

  // Check if content is ready
  const isGenerating = business?.status === 'pending' || business?.status === 'failed' || !business?.business_data?.lead_magnet_content;
  const hasLeadMagnet = !!business?.business_data?.lead_magnet_content;
  const hasLandingPage = !!business?.business_data?.landing_page;
  const hasEmailSequence = !!business?.business_data?.email_sequence;

  // Placeholder data if business data isn't fully ready
  const pdfUrl = business?.lead_magnet_url || '#';
  const landingPageUrl = business?.subdomain 
    ? `${window.location.origin}/sites/${business.subdomain}` 
    : (business?.website_url || '#');
  const emailCount = business?.business_data?.email_sequence?.length || 5;
  const leadCount = leads.length || business?.total_leads || business?.leads_count || 0;
  
  useEffect(() => {
    if (business?.id) {
      fetchLeads();
      loadChecklist();
      
      // Set up real-time subscription for new leads
      const channel = supabase
        .channel('leads-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'customers',
            filter: `business_id=eq.${business.id}`
          },
          (payload) => {
            console.log('New lead received:', payload.new);
            setLeads(prev => [payload.new, ...prev].slice(0, 10));
          }
        )
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [business?.id]);

  // Auto-refresh when content is still generating
  useEffect(() => {
    if (isGenerating) {
      const refreshInterval = setInterval(() => {
        window.location.reload();
      }, 10000); // Refresh every 10 seconds while generating
      
      return () => clearInterval(refreshInterval);
    }
  }, [isGenerating]);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*, email_sequence_day')
        .eq('business_id', business.id)
        // Temporarily removed source filter to see all customers
        // .eq('source', 'lead_magnet')
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (error) {
        console.error('❌ Error fetching leads:', error);
        setLeads([]);
      } else if (data) {
        console.log(`✅ Fetched ${data.length} leads:`, data.map(l => ({ email: l.email, source: l.source })));
        setLeads(data);
      } else {
        console.log('⚠️ No data returned from customers query');
        setLeads([]);
      }
    } catch (e) {
      console.error('Error fetching leads:', e);
    } finally {
      setLoadingLeads(false);
    }
  };

  const loadChecklist = () => {
    const saved = localStorage.getItem(`checklist_${business.id}`);
    if (saved) {
      setChecklist(JSON.parse(saved));
    }
  };

  const toggleChecklist = (key) => {
    const newChecklist = { ...checklist, [key]: !checklist[key] };
    setChecklist(newChecklist);
    localStorage.setItem(`checklist_${business.id}`, JSON.stringify(newChecklist));
  };
  
  const handleCopyLink = () => {
    if (landingPageUrl && landingPageUrl !== '#') {
      navigator.clipboard.writeText(landingPageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    if (onUpdateBusiness) {
      const result = await onUpdateBusiness({ phone_number: phoneNumber });
      if (result.success) {
        setShowSettingsModal(false);
      } else {
        alert('Failed to save settings');
      }
    }
    setSavingSettings(false);
  };

  const handleTestEmail = async (email) => {
    if (!confirm(`Send the next email in the sequence to ${email} immediately?`)) return;
    
    try {
      const res = await fetch('/api/email-sequence/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          testMode: true,
          targetEmail: email
        })
      });
      const data = await res.json();
      if (data.success && data.sent > 0) {
        alert(`✅ Email sent to ${email}! Check your inbox.`);
        fetchLeads();
      } else {
        alert('⚠️ ' + (data.message || data.error || 'No email sent (maybe sequence is complete?)'));
      }
    } catch (e) {
      console.error(e);
      alert('Error sending test email');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        
        {/* Generating Banner */}
        {isGenerating && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <div>
              <p className="font-medium text-blue-900">Your content is being generated...</p>
              <p className="text-sm text-blue-700">This usually takes 30-60 seconds. The page will refresh automatically.</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-10 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              {business?.name || business?.business_name || 'Your Local Lead System'}
            </h1>
            <p className="text-slate-600">
              {isGenerating 
                ? "We're building your automated lead generation system. Hang tight!" 
                : "Your automated quote & lead generation system is live. Share your link to start getting inquiries."}
            </p>
          </div>
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Settings size={18} />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>

        {/* Asset Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          
          {/* Offer Card */}
          <div className={`bg-white rounded-xl p-6 shadow-sm border ${hasLeadMagnet ? 'border-slate-100' : 'border-blue-200'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-lg ${hasLeadMagnet ? 'bg-blue-100 text-blue-600' : 'bg-blue-50 text-blue-400'}`}>
                <FileText size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Lead Offer</h3>
                {hasLeadMagnet ? (
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    Ready
                  </span>
                ) : (
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" /> Generating...
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              {hasLeadMagnet 
                ? `Your hook: "${business?.business_data?.lead_magnet_title || 'Special Offer / Checklist'}"`
                : 'Creating your lead magnet content...'}
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => hasLeadMagnet && setShowOfferModal(true)}
                disabled={!hasLeadMagnet}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-colors ${
                  hasLeadMagnet 
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer' 
                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                }`}
              >
                <FileText size={16} />
                View Offer Content
              </button>
              {hasLeadMagnet ? (
                <a
                  href={`/api/lead-magnet/download?businessId=${business?.id}`}
                  download
                  className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  title="Download PDF"
                >
                  <Download size={16} />
                </a>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 text-slate-300 rounded-lg cursor-not-allowed">
                  <Download size={16} />
                </div>
              )}
            </div>
          </div>

          {/* Landing Page Card */}
          <div className={`bg-white rounded-xl p-6 shadow-sm border ${hasLandingPage ? 'border-slate-100' : 'border-purple-200'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-lg ${hasLandingPage ? 'bg-purple-100 text-purple-600' : 'bg-purple-50 text-purple-400'}`}>
                <Globe size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Landing Page</h3>
                {hasLandingPage ? (
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    Live
                  </span>
                ) : (
                  <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" /> Building...
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              {hasLandingPage 
                ? 'Optimized conversion page to capture leads & calls.'
                : 'Building your landing page...'}
            </p>
            <div className="flex gap-2">
              {hasLandingPage ? (
                <>
                  <a 
                    href={landingPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <ExternalLink size={16} />
                    View Live
                  </a>
                  <button 
                    onClick={handleCopyLink}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                    title="Copy Link"
                  >
                    {copied ? <CheckCircle size={20} className="text-green-600" /> : <Copy size={20} />}
                  </button>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 text-slate-300 rounded-lg cursor-not-allowed">
                  <Loader2 size={16} className="animate-spin" />
                  Building...
                </div>
              )}
            </div>
          </div>

          {/* Email Sequence Card */}
          <div className={`bg-white rounded-xl p-6 shadow-sm border ${hasEmailSequence ? 'border-slate-100' : 'border-orange-200'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-lg ${hasEmailSequence ? 'bg-orange-100 text-orange-600' : 'bg-orange-50 text-orange-400'}`}>
                <Mail size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Email Sequence</h3>
                {hasEmailSequence ? (
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    Active
                  </span>
                ) : (
                  <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" /> Writing...
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              {hasEmailSequence 
                ? `${emailCount}-day automated nurture sequence to get them to call.`
                : 'Writing your email sequence...'}
            </p>
            <button 
              onClick={() => hasEmailSequence && setShowEmailModal(true)}
              disabled={!hasEmailSequence}
              className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg font-medium transition-colors ${
                hasEmailSequence 
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer' 
                  : 'bg-slate-50 text-slate-300 cursor-not-allowed'
              }`}
            >
              {hasEmailSequence ? <Users size={16} /> : <Loader2 size={16} className="animate-spin" />}
              {hasEmailSequence ? 'View Emails' : 'Generating...'}
            </button>
          </div>
        </div>

        {/* Leads & Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Leads Counter */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Funnel Performance</h2>
              <select className="bg-slate-50 border-none text-sm font-medium text-slate-600 rounded-lg px-3 py-1">
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
                <option>All Time</option>
              </select>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="text-sm text-slate-500 mb-1">Total Leads</div>
                <div className="text-3xl font-bold text-slate-900">{leadCount}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="text-sm text-slate-500 mb-1">Page Views</div>
                <div className="text-3xl font-bold text-slate-900">{business?.views || 0}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="text-sm text-slate-500 mb-1">Conversion Rate</div>
                <div className="text-3xl font-bold text-slate-900">
                  {business?.views ? ((leadCount / business.views) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>

            {leadCount === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <Users size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No leads yet</h3>
                <p className="text-slate-500 max-w-md mx-auto">
                  Share your landing page link on social media to start collecting email addresses.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-medium">
                    <tr>
                      <th className="p-4">Email</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">Email Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.map((lead, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-4 font-medium text-slate-900">{lead.email}</td>
                        <td className="p-4 text-slate-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-500 rounded-full transition-all"
                                    style={{ width: `${((lead.email_sequence_day || 1) / 5) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-slate-500 whitespace-nowrap">
                                  {lead.email_sequence_day || 1}/5
                                </span>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleTestEmail(lead.email)}
                              className="text-xs bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 px-2 py-1 rounded border border-slate-200 transition-colors"
                              title="Send next email immediately (Test Mode)"
                            >
                              Send Next
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Next Steps / Growth Checklist */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-white shadow-lg">
            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
              <button 
                onClick={() => setActiveTab('quickstart')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'quickstart' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10'}`}
              >
                Quick Start
              </button>
              <button 
                onClick={() => setActiveTab('30day')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === '30day' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10'}`}
              >
                30-Day Plan
              </button>
              <button 
                onClick={() => setActiveTab('playbook')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'playbook' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10'}`}
              >
                Lead Playbook
              </button>
            </div>

            {/* Quick Start Tab */}
            {activeTab === 'quickstart' && (
              <>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Zap size={20} />
                  Get Your First Leads
                </h2>
                
                <div className="space-y-4">
                  <div 
                    onClick={() => toggleChecklist('google')}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer ${checklist.google ? 'bg-green-500/20 border border-green-500/30' : 'bg-white/10 hover:bg-white/20'}`}
                  >
                    <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${checklist.google ? 'border-green-400 bg-green-400' : 'border-white/30'}`}>
                      {checklist.google && <CheckCircle size={14} className="text-slate-900" />}
                    </div>
                    <div>
                      <div className="font-medium">Add link to Google Business Profile</div>
                      <div className="text-xs text-slate-300 mt-1">Capture local search traffic</div>
                    </div>
                  </div>

                  <div 
                    onClick={() => toggleChecklist('facebook')}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer ${checklist.facebook ? 'bg-green-500/20 border border-green-500/30' : 'bg-white/10 hover:bg-white/20'}`}
                  >
                    <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${checklist.facebook ? 'border-green-400 bg-green-400' : 'border-white/30'}`}>
                      {checklist.facebook && <CheckCircle size={14} className="text-slate-900" />}
                    </div>
                    <div>
                      <div className="font-medium">Post on Facebook Community Groups</div>
                      <div className="text-xs text-slate-300 mt-1">Share your special offer</div>
                    </div>
                  </div>

                  <div 
                    onClick={() => toggleChecklist('outreach')}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer ${checklist.outreach ? 'bg-green-500/20 border border-green-500/30' : 'bg-white/10 hover:bg-white/20'}`}
                  >
                    <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${checklist.outreach ? 'border-green-400 bg-green-400' : 'border-white/30'}`}>
                      {checklist.outreach && <CheckCircle size={14} className="text-slate-900" />}
                    </div>
                    <div>
                      <div className="font-medium">Email/Text 5 past clients</div>
                      <div className="text-xs text-slate-300 mt-1">Ask for referrals with this link</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 30-Day Test Plan Tab */}
            {activeTab === '30day' && (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Target size={20} />
                  30-Day Customer Acquisition Plan
                </h2>
                <p className="text-slate-400 text-sm mb-6">Follow this proven plan to land your first 3 paying customers</p>
                
                <div className="space-y-6">
                  {/* Week 1 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-1 bg-blue-600 rounded text-xs font-bold">WEEK 1</span>
                      <span className="text-sm text-slate-400">Outreach Sprint</span>
                    </div>
                    <div className="space-y-2 pl-2 border-l-2 border-blue-600/30">
                      <div 
                        onClick={() => toggleChecklist('week1_outreach')}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer ${checklist.week1_outreach ? 'bg-green-500/20' : 'hover:bg-white/5'}`}
                      >
                        <div className={`w-4 h-4 rounded border ${checklist.week1_outreach ? 'bg-green-500 border-green-500' : 'border-white/30'}`}>
                          {checklist.week1_outreach && <CheckCircle size={14} className="text-white" />}
                        </div>
                        <span className="text-sm">Message 50 local businesses (Google Maps + FB)</span>
                      </div>
                      <div 
                        onClick={() => toggleChecklist('week1_firstclient')}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer ${checklist.week1_firstclient ? 'bg-green-500/20' : 'hover:bg-white/5'}`}
                      >
                        <div className={`w-4 h-4 rounded border ${checklist.week1_firstclient ? 'bg-green-500 border-green-500' : 'border-white/30'}`}>
                          {checklist.week1_firstclient && <CheckCircle size={14} className="text-white" />}
                        </div>
                        <span className="text-sm">Close 3 clients at $300 each = $900</span>
                      </div>
                    </div>
                  </div>

                  {/* Week 2 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-1 bg-purple-600 rounded text-xs font-bold">WEEK 2</span>
                      <span className="text-sm text-slate-400">Deliver & Document</span>
                    </div>
                    <div className="space-y-2 pl-2 border-l-2 border-purple-600/30">
                      <div 
                        onClick={() => toggleChecklist('week2_deliver')}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer ${checklist.week2_deliver ? 'bg-green-500/20' : 'hover:bg-white/5'}`}
                      >
                        <div className={`w-4 h-4 rounded border ${checklist.week2_deliver ? 'bg-green-500 border-green-500' : 'border-white/30'}`}>
                          {checklist.week2_deliver && <CheckCircle size={14} className="text-white" />}
                        </div>
                        <span className="text-sm">Deliver funnels & set up tracking</span>
                      </div>
                      <div 
                        onClick={() => toggleChecklist('week2_proof')}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer ${checklist.week2_proof ? 'bg-green-500/20' : 'hover:bg-white/5'}`}
                      >
                        <div className={`w-4 h-4 rounded border ${checklist.week2_proof ? 'bg-green-500 border-green-500' : 'border-white/30'}`}>
                          {checklist.week2_proof && <CheckCircle size={14} className="text-white" />}
                        </div>
                        <span className="text-sm">Run $5/day ad for one client to prove leads</span>
                      </div>
                    </div>
                  </div>

                  {/* Week 3 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-1 bg-orange-600 rounded text-xs font-bold">WEEK 3</span>
                      <span className="text-sm text-slate-400">Social Proof</span>
                    </div>
                    <div className="space-y-2 pl-2 border-l-2 border-orange-600/30">
                      <div 
                        onClick={() => toggleChecklist('week3_casestudy')}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer ${checklist.week3_casestudy ? 'bg-green-500/20' : 'hover:bg-white/5'}`}
                      >
                        <div className={`w-4 h-4 rounded border ${checklist.week3_casestudy ? 'bg-green-500 border-green-500' : 'border-white/30'}`}>
                          {checklist.week3_casestudy && <CheckCircle size={14} className="text-white" />}
                        </div>
                        <span className="text-sm">Publish case study with conversion metrics</span>
                      </div>
                      <div 
                        onClick={() => toggleChecklist('week3_ads')}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer ${checklist.week3_ads ? 'bg-green-500/20' : 'hover:bg-white/5'}`}
                      >
                        <div className={`w-4 h-4 rounded border ${checklist.week3_ads ? 'bg-green-500 border-green-500' : 'border-white/30'}`}>
                          {checklist.week3_ads && <CheckCircle size={14} className="text-white" />}
                        </div>
                        <span className="text-sm">Start lightweight ads with demo video</span>
                      </div>
                    </div>
                  </div>

                  {/* Week 4 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-1 bg-green-600 rounded text-xs font-bold">WEEK 4</span>
                      <span className="text-sm text-slate-400">Scale & Productize</span>
                    </div>
                    <div className="space-y-2 pl-2 border-l-2 border-green-600/30">
                      <div 
                        onClick={() => toggleChecklist('week4_retainer')}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer ${checklist.week4_retainer ? 'bg-green-500/20' : 'hover:bg-white/5'}`}
                      >
                        <div className={`w-4 h-4 rounded border ${checklist.week4_retainer ? 'bg-green-500 border-green-500' : 'border-white/30'}`}>
                          {checklist.week4_retainer && <CheckCircle size={14} className="text-white" />}
                        </div>
                        <span className="text-sm">Pitch clients on $99-199/mo retainer</span>
                      </div>
                      <div 
                        onClick={() => toggleChecklist('week4_referral')}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer ${checklist.week4_referral ? 'bg-green-500/20' : 'hover:bg-white/5'}`}
                      >
                        <div className={`w-4 h-4 rounded border ${checklist.week4_referral ? 'bg-green-500 border-green-500' : 'border-white/30'}`}>
                          {checklist.week4_referral && <CheckCircle size={14} className="text-white" />}
                        </div>
                        <span className="text-sm">Start referral incentive program</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Lead Playbook Tab */}
            {activeTab === 'playbook' && (
              <>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Phone size={20} />
                  Lead → Job Playbook
                </h2>
                <p className="text-slate-400 text-sm mb-6">What to do when a lead calls or messages</p>
                
                <div className="space-y-4">
                  {/* Step 1 */}
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                      <span className="font-medium">Answer Within 5 Minutes</span>
                    </div>
                    <p className="text-sm text-slate-300 ml-8">Speed wins. 78% of customers buy from the first responder.</p>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                      <span className="font-medium">Use This Script</span>
                    </div>
                    <div className="ml-8 bg-slate-900/50 rounded p-3 text-sm text-slate-200 font-mono">
                      "Hi [Name], thanks for reaching out! I saw you downloaded our guide. How can I help you today?"
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                      <span className="font-medium">Book the Appointment</span>
                    </div>
                    <p className="text-sm text-slate-300 ml-8">"I have availability [tomorrow/this week]. Would [TIME] work for a free inspection?"</p>
                  </div>

                  {/* Step 4 */}
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                      <span className="font-medium">Send Confirmation</span>
                    </div>
                    <p className="text-sm text-slate-300 ml-8">Text: "Confirmed! I'll see you [DATE] at [TIME]. Reply YES to confirm."</p>
                  </div>

                  <button 
                    onClick={() => setShowPlaybookModal(true)}
                    className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                  >
                    View Full Playbook & Templates
                  </button>
                </div>
              </>
            )}

            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="text-sm text-slate-400 mb-2">Your Funnel Link</div>
              <div className="flex items-center gap-2 bg-black/30 p-2 rounded-lg">
                <code className="text-xs text-blue-300 truncate flex-1">
                  {landingPageUrl}
                </code>
                <button 
                  onClick={handleCopyLink}
                  className="text-slate-400 hover:text-white"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Offer Content Modal */}
        {showOfferModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white">
                <h3 className="text-xl font-bold text-slate-900">Your Lead Offer Content</h3>
                <button onClick={() => setShowOfferModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6">
                {business?.business_data?.lead_magnet_content ? (
                  <div className="space-y-6">
                    {business.business_data.lead_magnet_content.map((section, i) => (
                      <div key={i} className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-slate-900 mb-2">{section.title}</h4>
                        <div className="text-slate-600 whitespace-pre-wrap">{section.body}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    Content is being generated...
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button 
                  onClick={() => setShowOfferModal(false)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email Sequence Modal */}
        {showEmailModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">5-Day Email Sequence</h3>
                <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                {business?.business_data?.email_sequence ? (
                  <div className="space-y-4">
                    {business.business_data.email_sequence.map((email, i) => (
                      <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded uppercase">
                            Day {email.day}
                          </span>
                          <span className="text-xs text-slate-400">Automated</span>
                        </div>
                        <h4 className="font-bold text-slate-900 mb-2">Subject: {email.subject}</h4>
                        <div className="text-slate-600 text-sm whitespace-pre-wrap border-t border-slate-100 pt-4 mt-4">
                          {email.body}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    Emails are being generated...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Full Lead Playbook Modal */}
        {showPlaybookModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">📞 Lead → Job Playbook</h3>
                <button onClick={() => setShowPlaybookModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                <div className="space-y-6">
                  {/* Call Script */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Phone size={18} className="text-blue-600" />
                      Phone Call Script
                    </h4>
                    <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm space-y-4">
                      <p><strong>Opening:</strong></p>
                      <p className="text-slate-700">"Hi [Name], this is [Your Name] from [Business]. I saw you downloaded our guide! How can I help you today?"</p>
                      
                      <p><strong>Qualifying Questions:</strong></p>
                      <ul className="list-disc pl-5 text-slate-700 space-y-1">
                        <li>"What's the main issue you're dealing with right now?"</li>
                        <li>"How long has this been going on?"</li>
                        <li>"Have you had anyone look at it before?"</li>
                      </ul>
                      
                      <p><strong>Booking:</strong></p>
                      <p className="text-slate-700">"I'd love to take a look at this for you. I have availability [tomorrow/this week]. Would [TIME] work for a free inspection?"</p>
                      
                      <p><strong>Handling Objections:</strong></p>
                      <p className="text-slate-700">"I'm just getting quotes" → "Perfect! Our inspection is completely free and you'll get an honest assessment with no pressure."</p>
                    </div>
                  </div>

                  {/* Text/WhatsApp Templates */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <MessageCircle size={18} className="text-green-600" />
                      Text/WhatsApp Templates
                    </h4>
                    <div className="space-y-4">
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-xs text-green-700 font-medium mb-2">Initial Response (send within 5 mins)</p>
                        <p className="text-sm text-slate-800">"Hi [Name]! Thanks for downloading our guide 📋 I'm [Your Name] - how can I help you today?"</p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-xs text-blue-700 font-medium mb-2">Booking Confirmation</p>
                        <p className="text-sm text-slate-800">"Great! I've got you down for [DATE] at [TIME]. I'll send a reminder the day before. Reply YES to confirm ✅"</p>
                      </div>
                      <div className="bg-amber-50 p-4 rounded-lg">
                        <p className="text-xs text-amber-700 font-medium mb-2">Day-Before Reminder</p>
                        <p className="text-sm text-slate-800">"Hi [Name]! Just a reminder about your appointment tomorrow at [TIME]. See you then! 👋"</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-xs text-purple-700 font-medium mb-2">Follow-Up (if no response after 24hrs)</p>
                        <p className="text-sm text-slate-800">"Hi [Name], just checking in! Did you get a chance to look at the guide? Let me know if you have any questions 😊"</p>
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics to Track */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <TrendingUp size={18} className="text-purple-600" />
                      Key Metrics to Track
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-slate-900">{"< 5 min"}</p>
                        <p className="text-xs text-slate-600">Response Time Goal</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-slate-900">50%+</p>
                        <p className="text-xs text-slate-600">Lead to Booking Rate</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-slate-900">80%+</p>
                        <p className="text-xs text-slate-600">Show-Up Rate</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-slate-900">30%+</p>
                        <p className="text-xs text-slate-600">Booking to Job Rate</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Reference Card */}
                  <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-xl text-white">
                    <h4 className="font-bold mb-4">⚡ Quick Reference: The 5-Minute Rule</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-200">1.</span>
                        <span>Lead comes in → Respond within 5 minutes</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-200">2.</span>
                        <span>Ask qualifying questions → Understand their need</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-200">3.</span>
                        <span>Offer specific time slot → "How about tomorrow at 2pm?"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-200">4.</span>
                        <span>Send confirmation text → Get them to reply YES</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-200">5.</span>
                        <span>Reminder day before → Reduce no-shows by 50%</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button 
                  onClick={() => setShowPlaybookModal(false)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettingsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">Business Settings</h3>
                <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 bg-slate-50">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Phone Number (for WhatsApp & Calls)
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      This number will be used for the "Call Now" and "WhatsApp" buttons in your emails and landing page.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {savingSettings && <Loader2 size={16} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
