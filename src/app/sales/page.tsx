'use client';

import { useState, useEffect } from 'react';

export default function SalesPage() {
  const [url, setUrl] = useState('');
  const [context, setContext] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [niche, setNiche] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  // Editable fields
  const [editableSubject, setEditableSubject] = useState('');
  const [editableBody, setEditableBody] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [replyTo, setReplyTo] = useState('hello@launchfly.ai');
  const [selectedTemplate, setSelectedTemplate] = useState('ai-audit');
  const [ownerName, setOwnerName] = useState('');

  const TEMPLATES = {
    'ai-audit': {
      label: '🤖 AI Website Audit (Default)',
      subject: (data: any) => data?.email?.subject || '',
      body: (data: any) => {
        let body = data?.email?.body || '';
        if (ownerName) {
          // Try to replace "Hi there" or similar with "Hi [Name]"
          body = body.replace(/^Hi (there|Team|Business Owner),/m, `Hi ${ownerName},`);
        }
        return body;
      },
      sms: (data: any) => {
        const name = businessName || data?.scrapedData?.businessName || 'your business';
        return `Hi ${ownerName ? ownerName + ' ' : ''}! I found ${name} online and have a quick question about helping you get more leads. Mind if I share a 2-min idea? - Alex from Launchfly`;
      }
    },
    'maps-missing-appt': {
      label: '📍 Maps: Missing Appointment Link',
      subject: () => 'Quick question about your Google Maps profile',
      body: (data: any) => `Hi ${ownerName || 'there'},\n\nI found you on Google Maps and noticed your 'Appointments' link is missing.\n\nI built a specific '2025 Price Guide' landing page that fits perfectly there to capture leads who find you on Maps.\n\nWant to see the preview?\n\nBest,\nAlex`,
      sms: () => `Hi ${ownerName ? ownerName + ', ' : ''}I noticed your Google Maps profile is missing the 'Appointments' link. I built a demo page that fits there perfectly. Want to see it? - Alex`
    },
    'maps-bad-review': {
      label: '⭐ Maps: Bad Review / No Answer',
      subject: () => 'Saw a review on your Google profile',
      body: (data: any) => `Hi ${ownerName || 'there'},\n\nI noticed a review on Google where a customer complained about not getting a quote fast enough.\n\nMy system automatically sends a 'Pricing Guide' to those people instantly so they don't leave bad reviews.\n\nWant to see how it works?\n\nBest,\nAlex`,
      sms: () => `Hi ${ownerName ? ownerName + ', ' : ''}saw a review on your Google profile about slow replies. I have a tool that auto-replies with a price guide instantly. Want a demo? - Alex`
    },
    'maps-chat': {
      label: '💬 Maps: Chat Button Message',
      subject: () => 'Question from Google Maps',
      body: () => `(This script is best for the Google Maps Chat feature)\n\nHi ${ownerName ? ownerName + ', ' : ''}I'm a local dev. I noticed your profile gets traffic but doesn't have a link for 'price shoppers' to download a quote guide. I built a demo checklist for you. Mind if I paste the link here?`,
      sms: () => `Hi ${ownerName ? ownerName + ', ' : ''}I'm a local dev. I noticed your profile gets traffic but doesn't have a link for 'price shoppers' to download a quote guide. I built a demo checklist for you. Mind if I paste the link here?`
    }
  };

  const handleTemplateChange = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    const template = TEMPLATES[templateKey as keyof typeof TEMPLATES];
    if (template && result) {
      setEditableSubject(template.subject(result));
      setEditableBody(template.body(result));
      setSmsMessage(template.sms(result));
    }
  };

  // Update editable fields when result changes
  useEffect(() => {
    if (result) {
      handleTemplateChange('ai-audit');
      setRecipientEmail(result.scrapedData.email || '');
      setRecipientPhone(result.scrapedData.phone || '');
      setPreviewUrl(result.previewUrl || '');
      if (result.scrapedData.ownerName) {
        setOwnerName(result.scrapedData.ownerName);
      }
    }
  }, [result]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url && !context) {
      setError('Please provide either a Website URL or Business Context.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSendSuccess('');
    setResult(null);

    try {
      const response = await fetch('/api/sales/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, businessName, niche, context }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!recipientEmail) {
      alert('Please enter a recipient email address');
      return;
    }

    setIsSending(true);
    setSendSuccess('');
    setError('');

    try {
      const response = await fetch('/api/sales/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          replyTo: replyTo,
          subject: editableSubject,
          body: editableBody
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      setSendSuccess('Email sent successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendSms = async () => {
    if (!recipientPhone) {
      alert('Please enter a phone number');
      return;
    }

    if (!smsMessage) {
      alert('Please enter an SMS message');
      return;
    }

    setIsSendingSms(true);
    setSendSuccess('');
    setError('');

    try {
      const response = await fetch('/api/sales/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientPhone,
          message: smsMessage,
          businessName: businessName || result?.scrapedData?.businessName || 'Unknown'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send SMS');
      }

      setSendSuccess(`SMS sent successfully to ${recipientPhone}!`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSendingSms(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-900">
            🎯 AI Sales Prospector
          </h1>
          <p className="text-slate-600 mt-2">
            Turn any website URL into a personalized cold email in seconds.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Website URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://example.com"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Business Context (Paste content here if no URL)
              </label>
              <textarea
                placeholder="Paste business details, niche, owner name, phone, or any other context here..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32"
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1">
                Provide either a URL or Business Context (or both).
              </p>
            </div>
            
            <button
              type="submit"
              disabled={isLoading || (!url && !context)}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Analyzing Website...
                </>
              ) : (
                'Analyze & Generate Pitch'
              )}
            </button>
          </form>
          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          {sendSuccess && (
            <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-lg text-sm">
              {sendSuccess}
            </div>
          )}
        </div>

        {result && (
          <div className="space-y-6 animate-fade-in">
            {/* Analysis Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                📊 Website Analysis
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Primary Service
                  </h3>
                  <p className="text-slate-900 font-semibold mb-4 text-lg">
                    {result.analysis.primary_service}
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Est. Customer Value
                      </h3>
                      <p className="text-green-700 font-mono font-medium">
                        {result.analysis.estimated_value || 'High Ticket'}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Target Audience
                      </h3>
                      <p className="text-slate-700 text-sm">
                        {result.analysis.customer_demographic || 'Local Residents'}
                      </p>
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Customer Pain Point
                  </h3>
                  <p className="text-slate-600 text-sm italic border-l-2 border-red-200 pl-3">
                    "{result.analysis.pain_point}"
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    The Opportunity
                  </h3>
                  <p className="text-slate-600 text-sm mb-4">
                    {result.analysis.opportunity}
                  </p>

                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                    <span className="text-xs font-bold text-blue-600 uppercase block mb-2 flex items-center gap-1">
                      ✨ Recommended Asset Strategy
                    </span>
                    <p className="text-blue-900 font-medium text-sm leading-relaxed">
                      {result.lead_magnet_idea}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap gap-4 text-sm text-slate-500 items-center justify-between">
                <div className="flex gap-4">
                  {result.scrapedData.email && (
                    <span className="flex items-center gap-1">
                      📧 {result.scrapedData.email}
                    </span>
                  )}
                  {result.scrapedData.phone && (
                    <span className="flex items-center gap-1">
                      📞 {result.scrapedData.phone}
                    </span>
                  )}
                </div>
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((businessName || result.scrapedData.businessName || '') + ' ' + (niche || ''))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  🗺️ Open in Google Maps
                </a>
              </div>
            </div>

            {/* Preview Funnel Card */}
            {previewUrl && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl shadow-sm border border-emerald-200 p-6">
                <h2 className="text-xl font-bold text-emerald-900 mb-3 flex items-center gap-2">
                  🎁 Value-First Preview Created
                </h2>
                <p className="text-emerald-700 text-sm mb-4">
                  A personalized funnel has been generated for this prospect. The link is included in the email below.
                </p>
                <div className="flex items-center gap-3">
                  <a 
                    href={previewUrl ? `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}preview=true` : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-white border border-emerald-300 rounded-lg px-4 py-2 text-emerald-800 font-mono text-sm hover:bg-emerald-50 transition-colors truncate"
                  >
                    {previewUrl}
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(previewUrl);
                      alert('Preview link copied!');
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                  >
                    Copy
                  </button>
                  <a
                    href={previewUrl ? `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}preview=true` : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors font-medium"
                  >
                    Preview ↗
                  </a>
                </div>
                <p className="text-xs text-emerald-600 mt-3">
                  ⏰ This preview expires in 14 days if not claimed.
                </p>
              </div>
            )}

            {/* Email Draft Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 border-l-4 border-l-blue-500">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  ✉️ Generated Cold Email
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(`Subject: ${editableSubject}\n\n${editableBody}`)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Copy All
                  </button>
                </div>
              </div>

              <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Owner Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Mike"
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Found in Google Maps Q&A or 'About' section. Select a strategy below to apply.
                  </p>
                </div>

                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
                  Outreach Strategy
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(TEMPLATES).map(([key, template]) => (
                    <button
                      key={key}
                      onClick={() => handleTemplateChange(key)}
                      className={`text-left px-3 py-2 rounded text-sm font-medium transition-colors ${
                        selectedTemplate === key
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Reply-To Email
                  </label>
                  <input
                    type="email"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    placeholder="your-email@example.com"
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Replies will be sent to this address.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Subject Line
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={editableSubject}
                      onChange={(e) => setEditableSubject(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={() => copyToClipboard(editableSubject)}
                      className="p-2 text-slate-400 hover:text-blue-600"
                      title="Copy Subject"
                    >
                      📋
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Email Body
                  </label>
                  <div className="relative">
                    <textarea
                      value={editableBody}
                      onChange={(e) => setEditableBody(e.target.value)}
                      rows={12}
                      className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 text-sm font-mono leading-relaxed resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={() => copyToClipboard(editableBody)}
                      className="absolute top-2 right-2 p-2 text-slate-400 hover:text-blue-600 bg-white rounded shadow-sm border border-slate-200"
                      title="Copy Body"
                    >
                      📋
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={handleSendEmail}
                    disabled={isSending || !recipientEmail}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                  >
                    {isSending ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        🚀 Send Email via Resend
                      </>
                    )}
                  </button>
                  <p className="text-xs text-center text-slate-500 mt-2">
                    Sent from hello@launchfly.ai
                  </p>
                </div>
              </div>
            </div>

            {/* SMS Alternative Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 border-l-4 border-l-purple-500">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  📱 SMS Alternative
                </h2>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                  {smsMessage.length}/160 chars
                </span>
              </div>

              <p className="text-sm text-slate-600 mb-4">
                No email found? Send a quick SMS instead.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  {result?.scrapedData?.phone && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Scraped from website: {result.scrapedData.phone}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    SMS Message
                  </label>
                  <div className="relative">
                    <textarea
                      value={smsMessage}
                      onChange={(e) => setSmsMessage(e.target.value)}
                      rows={3}
                      maxLength={160}
                      className={`w-full bg-white border rounded px-3 py-2 text-slate-800 text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                        smsMessage.length > 160 ? 'border-red-500' : 'border-slate-300'
                      }`}
                      placeholder="Keep it short and friendly..."
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Keep under 160 characters to avoid message splitting.
                  </p>
                </div>

                <button
                  onClick={handleSendSms}
                  disabled={isSendingSms || !recipientPhone || !smsMessage}
                  className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {isSendingSms ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      📱 Send SMS via Twilio
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
