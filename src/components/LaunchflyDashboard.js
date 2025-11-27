import React, { useState, useEffect } from 'react';
import { FileText, Globe, Mail, Share2, Users, Copy, ExternalLink, Download, CheckCircle, Clock, X, ChevronRight } from 'lucide-react';
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

  // Placeholder data if business data isn't fully ready
  const pdfUrl = business?.lead_magnet_url || '#';
  const landingPageUrl = business?.subdomain 
    ? `${window.location.origin}/sites/${business.subdomain}` 
    : (business?.website_url || '#');
  const emailCount = business?.business_data?.email_sequence?.length || 5;
  const leadCount = leads.length || business?.leads_count || 0;
  
  useEffect(() => {
    if (business?.id) {
      fetchLeads();
      loadChecklist();
    }
  }, [business?.id]);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', business.id)
        .eq('status', 'lead')
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (!error && data) {
        setLeads(data);
      } else {
        // Fallback if table doesn't exist yet
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
        
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {business?.business_name || 'Your Local Lead System'}
          </h1>
          <p className="text-slate-600">
            Your automated quote & lead generation system is live. Share your link to start getting inquiries.
          </p>
        </div>

        {/* Asset Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          
          {/* Offer Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Lead Offer</h3>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  Ready
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Your hook: "{business?.business_data?.lead_magnet_title || 'Special Offer / Checklist'}"
            </p>
            <button 
              onClick={() => setShowOfferModal(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
            >
              <FileText size={16} />
              View Offer Content
            </button>
          </div>

          {/* Landing Page Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                <Globe size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Landing Page</h3>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  Live
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Optimized conversion page to capture leads & calls.
            </p>
            <div className="flex gap-2">
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
            </div>
          </div>

          {/* Email Sequence Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Email Sequence</h3>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  Active
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              {emailCount}-day automated nurture sequence to get them to call.
            </p>
            <button 
              onClick={() => setShowEmailModal(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
            >
              <Users size={16} />
              View Emails
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
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.map((lead, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-4 font-medium text-slate-900">{lead.email}</td>
                        <td className="p-4 text-slate-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            New
                          </span>
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
