import React, { useState } from 'react';
import { FileText, Globe, Mail, Share2, Users, Copy, ExternalLink, Download, CheckCircle, Clock } from 'lucide-react';

export default function LaunchflyDashboard({ session, business }) {
  const [copied, setCopied] = useState(false);

  // Placeholder data if business data isn't fully ready
  const pdfUrl = business?.lead_magnet_url || '#';
  const landingPageUrl = business?.website_url || '#';
  const emailCount = business?.email_sequence?.length || 5;
  const leadCount = business?.leads_count || 0;
  
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
            {business?.business_name || 'Your Lead Magnet Funnel'}
          </h1>
          <p className="text-slate-600">
            Your automated lead generation funnel is ready. Share your link to start collecting leads.
          </p>
        </div>

        {/* Asset Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          
          {/* PDF Guide Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Lead Magnet Asset</h3>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  Ready
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Your high-value asset: "{business?.lead_magnet_title || 'The Ultimate Guide'}"
            </p>
            <a 
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
            >
              <Download size={16} />
              Download Asset
            </a>
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
            <button className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors">
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
                    {/* Placeholder for leads list */}
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={3}>Loading leads...</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Next Steps / Growth Checklist */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-white shadow-lg">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Share2 size={20} />
              Growth Checklist
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors cursor-pointer">
                <div className="mt-1 w-5 h-5 rounded-full border-2 border-white/30 flex items-center justify-center">
                  {/* Checkmark when done */}
                </div>
                <div>
                  <div className="font-medium">Add link to LinkedIn Bio</div>
                  <div className="text-xs text-slate-300 mt-1">Drive professional traffic</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors cursor-pointer">
                <div className="mt-1 w-5 h-5 rounded-full border-2 border-white/30 flex items-center justify-center">
                </div>
                <div>
                  <div className="font-medium">Post on Instagram/Twitter</div>
                  <div className="text-xs text-slate-300 mt-1">Announce your new guide</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors cursor-pointer">
                <div className="mt-1 w-5 h-5 rounded-full border-2 border-white/30 flex items-center justify-center">
                </div>
                <div>
                  <div className="font-medium">Email 5 potential clients</div>
                  <div className="text-xs text-slate-300 mt-1">Direct outreach works best</div>
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
      </div>
    </div>
  );
}
