'use client';

import { useState, useEffect, useRef } from 'react';

// Image type for uploaded prospect images
interface ProspectImage {
  url: string;
  type: 'before' | 'after' | 'team' | 'work' | 'general';
  name: string;
}

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
  
  // Image upload state
  const [uploadedImages, setUploadedImages] = useState<ProspectImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable fields
  const [editableSubject, setEditableSubject] = useState('');
  const [editableBody, setEditableBody] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [whatsappContext, setWhatsappContext] = useState('');
  const [replyTo, setReplyTo] = useState('alex@launchfly.ai');
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
    },
    // ============ COACH OUTREACH TEMPLATES ============
    'coach-instagram-dm': {
      label: '📱 Coach: Instagram DM (Free Draft)',
      subject: () => '', // DMs don't have subjects
      body: () => `Hey ${ownerName || 'there'}!\n\nLoved your recent post about [TOPIC]. Your content really resonates.\n\nI'm testing an AI workflow that creates lead magnets for coaches - basically a 20-page expert guide your audience can download in exchange for their email.\n\nI'd love to create one for you completely free - just looking for a testimonial if you like it.\n\nWant me to send you a draft?`,
      sms: () => `Hey ${ownerName || 'there'}! Loved your content. I create lead magnets for coaches and would love to make one for you free (just want a testimonial). Can I send a draft? - Alex`
    },
    'coach-no-lead-magnet': {
      label: '🔗 Coach: No Lead Magnet Detected',
      subject: () => 'Quick idea for your link in bio',
      body: () => `Hi ${ownerName || 'there'},\n\nI noticed you're putting out great content but don't have a lead magnet capturing emails on your profile.\n\nWith your audience, you're probably leaving serious money on the table!\n\nI build "24-Hour Lead Magnet Funnels" for coaches - I write the expert guide AND build the landing page. One-time fee, no monthly subscriptions.\n\nWant to see a sample I made for someone in your niche?\n\nBest,\nAlex`,
      sms: () => `Hey ${ownerName || 'there'}! Noticed you don't have a lead magnet on your profile. I build them for coaches - guide + landing page in 24hrs. Want to see a sample? - Alex`
    },
    'coach-free-value-dm': {
      label: '💎 Coach: Free Value DM',
      subject: () => '',
      body: () => `Hey ${ownerName || 'there'}!\n\nI've been following your content and noticed you're doing amazing work in ${niche || 'your space'}.\n\nI just finished building an AI tool that creates high-converting lead magnets for coaches. I'm giving away a few free ones this week to build my portfolio.\n\nI'd love to create a "Blueprint" or "Framework" guide for your audience - something like "The 5-Step [Result] System" that positions you as THE expert.\n\nNo catch, just want permission to use it as a case study.\n\nInterested?`,
      sms: () => `Hey ${ownerName || 'there'}! I create lead magnets for coaches. Making a few free ones this week - want one for your audience? No strings attached. - Alex`
    },
    'coach-linkedin-connection': {
      label: '💼 Coach: LinkedIn Connection',
      subject: () => 'Loved your post about [topic]',
      body: () => `Hi ${ownerName || 'there'},\n\nJust came across your content about [TOPIC] - really insightful stuff.\n\nI help coaches like you build lead magnets that convert followers into email subscribers. Basically, I create the expert guide AND the landing page so you can focus on what you do best.\n\nWould love to connect and share some ideas that might help you grow your list.\n\nBest,\nAlex`,
      sms: () => `Hi ${ownerName || 'there'}! I help coaches turn followers into email subscribers with lead magnets. Would love to share some ideas. Open to a quick chat? - Alex`
    },
    'coach-testimonial-offer': {
      label: '⭐ Coach: Testimonial Exchange',
      subject: () => 'Free lead magnet in exchange for feedback',
      body: () => `Hi ${ownerName || 'there'},\n\nI'm building case studies for my lead magnet service and looking for 3 coaches to work with for free.\n\nHere's the deal:\n• I create a premium 20-page expert guide for your niche\n• I build the landing page to capture emails\n• You give me honest feedback and a testimonial (if you like it)\n\nThis normally costs $297 but I'm doing a few free to build my portfolio.\n\nInterested in being one of the 3?\n\nBest,\nAlex`,
      sms: () => `Hey ${ownerName || 'there'}! Offering 3 free lead magnets to coaches in exchange for testimonials. Normally $297. Want in? - Alex`
    },
    'coach-existing-content': {
      label: '📚 Coach: Leverage Their Content',
      subject: () => 'Idea to repurpose your best content',
      body: () => `Hi ${ownerName || 'there'},\n\nI've been enjoying your content about [TOPIC]. You clearly know your stuff.\n\nQuick idea: what if we turned your best posts into a downloadable "blueprint" that captures emails for you 24/7?\n\nI do this for coaches - take their existing wisdom and package it into a professional lead magnet with a landing page.\n\nWould you be open to a quick call to see if it makes sense?\n\nBest,\nAlex`,
      sms: () => `Hey ${ownerName || 'there'}! Your content would make an amazing lead magnet. I help coaches package their expertise into downloadable guides. Quick chat? - Alex`
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

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError('');

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

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadedImages(prev => [...prev, ...data.images]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove uploaded image
  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Update image type
  const updateImageType = (index: number, type: ProspectImage['type']) => {
    setUploadedImages(prev => prev.map((img, i) => 
      i === index ? { ...img, type } : img
    ));
  };

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
        body: JSON.stringify({ 
          url, 
          businessName, 
          niche, 
          context,
          images: uploadedImages // Pass uploaded images to API
        }),
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
      // Construct minimal HTML for better deliverability (Plain Text feel)
      let htmlBody = editableBody;
      
      // Mask the preview URL if present to avoid "Ugly Link Penalty"
      if (previewUrl) {
        const linkText = `demo for ${businessName || result?.scrapedData?.businessName || 'your business'}`;
        htmlBody = htmlBody.replace(
          previewUrl, 
          `<a href="${previewUrl}">${linkText}</a>`
        );
      }
      
      // Convert newlines to paragraphs for clean HTML structure
      // Split by double newline to get paragraphs
      const paragraphs = htmlBody.split(/\n\s*\n/);
      htmlBody = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

      const response = await fetch('/api/sales/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          replyTo: replyTo,
          subject: editableSubject,
          body: editableBody,
          html: htmlBody
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

  // Generate WhatsApp Social Selling message based on analysis
  const generateWhatsappMessage = () => {
    if (result?.whatsapp_script) {
      return result.whatsapp_script;
    }

    // Fallback if no script generated
    const name = businessName || result?.scrapedData?.businessName || 'Business Owner';
    const asset = result?.lead_magnet?.title || 'Price List & Booking Page';
    const link = previewUrl || '[Link]';
    
    return `Hi ${name}! 👋 Found you on Google Maps.\n\n` +
      `You have great reviews but I noticed there's no link for customers to book you directly.\n\n` +
      `I went ahead and built a digital "${asset}" for you. It acts like a mini-website to capture leads from Maps.\n\n` +
      `👇 Preview it here:\n${link}\n\n` +
      `If you want to keep this link, let me know. It's a simple one-time setup.`;
  };

  // Update WhatsApp message when result changes
  useEffect(() => {
    if (result) {
      setWhatsappMessage(generateWhatsappMessage());
    }
  }, [result, previewUrl]);

  const openWhatsApp = () => {
    if (!recipientPhone) {
      alert('Please enter a phone number first');
      return;
    }
    const cleanPhone = String(recipientPhone).replace(/[^0-9]/g, '');
    const encodedMessage = encodeURIComponent(whatsappMessage);
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-900">
            🎯 AI Sales Prospector
          </h1>
          <p className="text-slate-600 mt-2">
            Turn any website URL or business context into a personalized cold email in seconds.
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

            {/* Image Upload Section */}
            <div className="border-t border-slate-200 pt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                📸 Business Images (Optional)
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Upload images from Facebook/Google Maps showing: technicians at work, before/after results, team photos, or service examples. These will appear in the PDF and landing page.
              </p>
              
              <div className="flex flex-wrap gap-3 mb-3">
                {uploadedImages.map((img, index) => (
                  <div key={index} className="relative group">
                    <img 
                      src={img.url} 
                      alt={img.name}
                      className="w-24 h-24 object-cover rounded-lg border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                    <select
                      value={img.type}
                      onChange={(e) => updateImageType(index, e.target.value as ProspectImage['type'])}
                      className="absolute bottom-0 left-0 right-0 text-xs bg-black/70 text-white px-1 py-0.5 rounded-b-lg"
                    >
                      <option value="general">General</option>
                      <option value="before">Before/Problem</option>
                      <option value="after">After/Solution</option>
                      <option value="team">Team/Technician</option>
                      <option value="work">Work in Progress</option>
                    </select>
                  </div>
                ))}
                
                {/* Upload Button */}
                <label className={`w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  {isUploading ? (
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span className="text-2xl text-slate-400">+</span>
                      <span className="text-xs text-slate-500">Add Image</span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              </div>
              
              {uploadedImages.length > 0 && (
                <p className="text-xs text-green-600">
                  ✓ {uploadedImages.length} image{uploadedImages.length > 1 ? 's' : ''} ready for PDF & landing page
                </p>
              )}
            </div>
            
            <button
              type="submit"
              disabled={isLoading || (!url && !context)}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {url ? 'Analyzing Website...' : 'Analyzing Context...'}
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
              
              {/* Extracted Business Info Banner */}
              {result.scrapedData?.businessName && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <span className="text-lg">🏢</span>
                    <span className="font-semibold">{result.scrapedData.businessName}</span>
                    {result.scrapedData.niche && (
                      <span className="text-green-600 text-sm">• {result.scrapedData.niche}</span>
                    )}
                  </div>
                  {result.scrapedData.ownerName && (
                    <div className="text-sm text-green-700 mt-1">
                      👤 Owner: {result.scrapedData.ownerName}
                    </div>
                  )}
                  {result.scrapedData.location && (
                    <div className="text-sm text-green-700">
                      📍 {result.scrapedData.location}
                    </div>
                  )}
                </div>
              )}
              
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

            {/* WhatsApp Social Selling Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 border-l-4 border-l-green-500">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  💬 WhatsApp Social Selling
                </h2>
                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded font-medium">
                  Best Response Rate
                </span>
              </div>

              <p className="text-sm text-slate-600 mb-4">
                Conversational outreach script generated based on the business context.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Message Preview
                  </label>
                  <div className="relative">
                    <textarea
                      value={whatsappMessage}
                      onChange={(e) => setWhatsappMessage(e.target.value)}
                      rows={10}
                      className="w-full bg-green-50 border border-green-200 rounded px-3 py-2 text-slate-800 text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono leading-relaxed"
                      placeholder="Message will be generated..."
                    />
                    <button
                      onClick={() => copyToClipboard(whatsappMessage)}
                      className="absolute top-2 right-2 p-2 text-green-600 hover:text-green-800 bg-white rounded shadow-sm border border-green-200"
                      title="Copy Message"
                    >
                      📋
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Edit as needed. The formula: Hook → Problem → Solution → Link → Soft Close.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => copyToClipboard(whatsappMessage)}
                    className="bg-slate-100 text-slate-700 py-3 px-4 rounded-lg font-semibold hover:bg-slate-200 transition-colors flex justify-center items-center gap-2"
                  >
                    📋 Copy Message
                  </button>
                  <button
                    onClick={openWhatsApp}
                    disabled={!recipientPhone}
                    className="bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Open WhatsApp
                  </button>
                </div>

                <div className="mt-3 p-2 bg-green-50 text-green-800 text-xs rounded border border-green-200">
                  <strong>🔥 Pro Tip:</strong> Don't just send text! Paste a <u>screenshot</u> of their site/preview first, then paste this script as the <strong>Image Caption</strong>. Increases open rate by 40%.
                </div>

                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">
                    <strong>💡 More Tips:</strong> Send from a personal number, not a business account. 
                    Best times: 10am-12pm or 2pm-4pm local time. Follow up once after 2 days if no response.
                  </p>
                </div>

                {/* Follow-up Scripts Section */}
                {result?.whatsapp_followups && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                      🔥 Follow-Up Scripts
                      <span className="text-xs font-normal text-slate-500">(Increases close rate 3x)</span>
                    </h3>
                    
                    <div className="space-y-3">
                      {/* When they ask how it works */}
                      {result.whatsapp_followups.reply_interested && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-semibold text-blue-700">💬 If they ask "How does it work?"</span>
                            <button
                              onClick={() => copyToClipboard(result.whatsapp_followups.reply_interested)}
                              className="text-blue-600 hover:text-blue-800 text-xs"
                            >
                              📋 Copy
                            </button>
                          </div>
                          <p className="text-xs text-blue-800 whitespace-pre-wrap">{result.whatsapp_followups.reply_interested}</p>
                        </div>
                      )}
                      
                      {/* Follow-up 1 */}
                      {result.whatsapp_followups.followup_1 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-semibold text-amber-700">⏰ Follow-up #1 (4-6 hours later)</span>
                            <button
                              onClick={() => copyToClipboard(result.whatsapp_followups.followup_1)}
                              className="text-amber-600 hover:text-amber-800 text-xs"
                            >
                              📋 Copy
                            </button>
                          </div>
                          <p className="text-xs text-amber-800 whitespace-pre-wrap">{result.whatsapp_followups.followup_1}</p>
                        </div>
                      )}
                      
                      {/* Follow-up 2 */}
                      {result.whatsapp_followups.followup_2 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-semibold text-orange-700">📅 Follow-up #2 (Next day)</span>
                            <button
                              onClick={() => copyToClipboard(result.whatsapp_followups.followup_2)}
                              className="text-orange-600 hover:text-orange-800 text-xs"
                            >
                              📋 Copy
                            </button>
                          </div>
                          <p className="text-xs text-orange-800 whitespace-pre-wrap">{result.whatsapp_followups.followup_2}</p>
                        </div>
                      )}
                      
                      {/* Follow-up 3 */}
                      {result.whatsapp_followups.followup_3 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-semibold text-red-700">🦈 Final Follow-up (Low-risk offer)</span>
                            <button
                              onClick={() => copyToClipboard(result.whatsapp_followups.followup_3)}
                              className="text-red-600 hover:text-red-800 text-xs"
                            >
                              📋 Copy
                            </button>
                          </div>
                          <p className="text-xs text-red-800 whitespace-pre-wrap">{result.whatsapp_followups.followup_3}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 p-2 bg-slate-100 rounded text-xs text-slate-600">
                      <strong>🎙️ Voice Note Tip:</strong> A 10-12 second voice note increases close rate 3× in SEA markets. 
                      Example: <em>"Boss, two extra jobs/day can settle your rent already. Let's start small first."</em>
                    </div>
                  </div>
                )}
              </div>
            </div>

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
                    Sent from alex@launchfly.ai
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
