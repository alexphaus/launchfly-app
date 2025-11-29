import React, { useState, useEffect } from 'react';
import { FileText, Globe, Mail, Share2, Users, Copy, ExternalLink, Download, CheckCircle, Clock, X, ChevronRight, Loader2 } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function LaunchflyDashboard({ session, business }) {
  const [copied, setCopied] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [leads, setLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [checklist, setChecklist] = useState({
    google: false,
    facebook: false,
    outreach: false
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
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {business?.name || business?.business_name || 'Your Local Lead System'}
          </h1>
          <p className="text-slate-600">
            {isGenerating 
              ? "We're building your automated lead generation system. Hang tight!" 
              : "Your automated quote & lead generation system is live. Share your link to start getting inquiries."}
          </p>
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
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${((lead.email_sequence_day || 1) / 5) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 whitespace-nowrap">
                              {lead.email_sequence_day || 1}/5 emails
                            </span>
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
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Share2 size={20} />
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

      </div>
    </div>
  );
}
