// src/components/PhysicalAssetPack.js
// "Blue Collar" focused asset downloads - flyers, stickers, WhatsApp assets
// Designed for tradesmen who work in the physical world

'use client';

import React, { useState, useEffect } from 'react';
import { Download, Copy, Check, X, FileText, Image, MessageCircle, Facebook, Phone, QrCode, Printer, Share2 } from 'lucide-react';
import QRCodeLib from 'qrcode';

export default function PhysicalAssetPack({ business, onClose }) {
  const [activeTab, setActiveTab] = useState('share');
  const [templates, setTemplates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, [business?.id]);

  const fetchTemplates = async () => {
    if (!business?.id) return;

    try {
      const response = await fetch(`/api/assets/share-templates?businessId=${business.id}`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (type) => {
    let url = '';
    switch (type) {
      case 'whatsapp-status':
        url = `/api/assets/whatsapp-status?businessId=${business.id}`;
        break;
      case 'flyer-a5':
        url = `/api/assets/flyer?businessId=${business.id}&format=a5`;
        break;
      case 'flyer-a4':
        url = `/api/assets/flyer?businessId=${business.id}&format=a4`;
        break;
      case 'sticker':
        url = `/api/assets/flyer?businessId=${business.id}&format=sticker`;
        break;
      default:
        return;
    }
    window.open(url, '_blank');
  };

  const generateVanSticker = async () => {
    // Construct quote URL
    const quoteUrl = business?.subdomain
      // Use window.location.origin to support any environment
      ? `${window.location.origin}/sites/${business.subdomain}/quote`
      : `${window.location.origin}/q/${business?.id}`;

    const canvas = document.createElement('canvas');
    const size = 2000; // High res for printing
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Colors
    const brandBlue = '#0F172A'; // Dark slate/blue
    const whatsappGreen = '#25D366';

    // 1. Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // 2. Thick Border (Inset)
    const borderWidth = 40;
    const margin = 60;
    ctx.strokeStyle = brandBlue;
    ctx.lineWidth = borderWidth;
    ctx.lineJoin = 'round';
    ctx.strokeRect(margin, margin, size - (margin * 2), size - (margin * 2));

    // 3. Headline: BOOK [SERVICE]
    // Handle undefined business data safely
    const niche = business?.business_data?.niche || 'SERVICE';
    let serviceHeadline = (niche || 'SERVICE').toUpperCase();
    if (!serviceHeadline.includes('SERVICE')) {
      serviceHeadline += ' SERVICE';
    }

    ctx.fillStyle = brandBlue;
    ctx.font = 'bold 160px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const headlineY = margin + 120;
    ctx.fillText(`BOOK ${serviceHeadline}`, size / 2, headlineY);

    // 4. Footer: Scan for Instant Price
    ctx.font = 'bold 90px "Inter", sans-serif';
    ctx.fillText('Scan for Instant Price', size / 2, size - margin - 280);

    // 5. QR Code
    const qrSize = 900;
    const qrX = (size - qrSize) / 2;
    const qrY = (size - qrSize) / 2 + 50;

    try {
      const qrDataUrl = await QRCodeLib.toDataURL(quoteUrl, {
        width: qrSize,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#ffffff' }
      });

      const qrImg = new Image();
      qrImg.src = qrDataUrl;
      await new Promise((resolve) => { qrImg.onload = resolve; });
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // 6. WhatsApp Icon Overlay
      const iconSize = qrSize * 0.22;
      const iconX = size / 2;
      const iconY = qrY + (qrSize / 2);

      // Green Circle
      ctx.beginPath();
      ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(iconX, iconY, (iconSize / 2) - 10, 0, Math.PI * 2);
      ctx.fillStyle = whatsappGreen;
      ctx.fill();

      // Phone Icon Path
      const s = iconSize * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.save();
      ctx.translate(iconX, iconY);
      ctx.scale(s / 24, s / 24);
      ctx.translate(-12, -12);
      const phonePath = new Path2D("M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z");
      ctx.fill(phonePath);
      ctx.restore();

      // Download
      const link = document.createElement('a');
      const safeName = (business?.name || 'Business').replace(/\s+/g, '_');
      link.download = `${safeName}_Van_Sticker.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error('Error creating van sticker:', err);
      alert('Failed to generate sticker. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Printer size={24} />
              Physical Asset Pack
            </h2>
            <p className="text-emerald-100 text-sm">Print-ready flyers, stickers & share templates</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6">
          <div className="flex gap-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('share')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'share'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              <MessageCircle size={16} className="inline mr-2" />
              Share Templates
            </button>
            <button
              onClick={() => setActiveTab('cash')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'cash'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              💰 Cash Script
            </button>
            <button
              onClick={() => setActiveTab('print')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'print'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              <Printer size={16} className="inline mr-2" />
              Print Assets
            </button>
            <button
              onClick={() => setActiveTab('van')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'van'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              🚐 Van Magnet
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
          {activeTab === 'share' && (
            <div className="space-y-6">
              <p className="text-slate-600 text-sm mb-4">
                Copy-paste ready messages to share your lead magnet. Just copy and send!
              </p>

              {loading ? (
                <div className="text-center py-8 text-slate-500">Loading templates...</div>
              ) : templates ? (
                <>
                  {/* WhatsApp Broadcast */}
                  <TemplateCard
                    icon={<MessageCircle className="text-green-600" size={20} />}
                    title={templates.whatsapp_broadcast.title}
                    description={templates.whatsapp_broadcast.description}
                    content={templates.whatsapp_broadcast.template}
                    onCopy={() => handleCopy('wa-broadcast', templates.whatsapp_broadcast.template)}
                    copied={copiedId === 'wa-broadcast'}
                    color="green"
                  />

                  {/* WhatsApp Status */}
                  <TemplateCard
                    icon={<Image className="text-green-600" size={20} />}
                    title={templates.whatsapp_status.title}
                    description={templates.whatsapp_status.description}
                    content={templates.whatsapp_status.template}
                    onCopy={() => handleCopy('wa-status', templates.whatsapp_status.template)}
                    copied={copiedId === 'wa-status'}
                    color="green"
                  />

                  {/* Facebook Group */}
                  <TemplateCard
                    icon={<Facebook className="text-blue-600" size={20} />}
                    title={templates.facebook_group.title}
                    description={templates.facebook_group.description}
                    content={templates.facebook_group.template}
                    onCopy={() => handleCopy('fb-group', templates.facebook_group.template)}
                    copied={copiedId === 'fb-group'}
                    color="blue"
                  />

                  {/* Voice Note Script */}
                  <TemplateCard
                    icon={<Phone className="text-purple-600" size={20} />}
                    title={templates.voice_note.title}
                    description={templates.voice_note.description}
                    content={templates.voice_note.template}
                    onCopy={() => handleCopy('voice', templates.voice_note.template)}
                    copied={copiedId === 'voice'}
                    color="purple"
                  />

                  {/* SMS */}
                  <TemplateCard
                    icon={<MessageCircle className="text-slate-600" size={20} />}
                    title={templates.sms.title}
                    description={templates.sms.description}
                    content={templates.sms.template}
                    onCopy={() => handleCopy('sms', templates.sms.template)}
                    copied={copiedId === 'sms'}
                    color="slate"
                  />
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">Failed to load templates</div>
              )}
            </div>
          )}

          {activeTab === 'print' && (
            <div className="space-y-6">
              <p className="text-slate-600 text-sm mb-4">
                Download print-ready assets to promote your business in the physical world.
              </p>

              {/* WhatsApp Status Image */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Image size={24} className="text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">WhatsApp Status Image</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        Vertical image (1080x1920) with QR code. Perfect for WhatsApp Status.
                      </p>
                      <p className="text-xs text-green-600 mt-2">📱 Optimized for mobile screens</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload('whatsapp-status')}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <Download size={18} />
                    PNG
                  </button>
                </div>
              </div>

              {/* Gate Flyer A5 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <FileText size={24} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">Gate Flyer (A5)</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        Leave at customer's gate after a job. QR code + offer inside.
                      </p>
                      <p className="text-xs text-blue-600 mt-2">🏠 Perfect for neighbors to see</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload('flyer-a5')}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <Download size={18} />
                    PDF
                  </button>
                </div>
              </div>

              {/* Full Page Flyer A4 */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <FileText size={24} className="text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">Full Flyer (A4)</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        Larger flyer for community boards or shop windows.
                      </p>
                      <p className="text-xs text-purple-600 mt-2">📋 Great for bulletin boards</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload('flyer-a4')}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <Download size={18} />
                    PDF
                  </button>
                </div>
              </div>

              {/* QR Sticker */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-100 rounded-lg">
                      <QrCode size={24} className="text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">QR Sticker (Small)</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        Small square sticker for van, toolbox, or business card.
                      </p>
                      <p className="text-xs text-amber-600 mt-2">🚐 Stick on your vehicle!</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload('sticker')}
                    className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <Download size={18} />
                    PDF
                  </button>
                </div>
              </div>

              {/* Print tip */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="font-medium text-slate-800 flex items-center gap-2">
                  <Printer size={16} />
                  Printing Tips
                </h4>
                <ul className="text-sm text-slate-600 mt-2 space-y-1">
                  <li>• Print flyers at your local print shop (RM 0.10-0.30 per copy)</li>
                  <li>• Use glossy paper for a more professional look</li>
                  <li>• Order stickers from Shopee/Lazada (search "custom QR stickers")</li>
                  <li>• Leave flyers at customer homes after completing jobs</li>
                </ul>
              </div>
            </div>
          )}

          {/* Cash Injection Script Tab */}
          {activeTab === 'cash' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-amber-100 rounded-lg">
                    <span className="text-2xl">💰</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">"Cash Injection" Script</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Copy this message and send it to your last 50 clients via WhatsApp.
                      Most users see 3-5 bookings within 24 hours.
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-slate-200 mb-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">
                    {`Hi {{name}}! 👋

Quick check - how's your ${business?.business_data?.niche || 'aircon'} doing?

We have a few slots available this week and I'm offering a special rate for returning customers:

✅ ${business?.business_data?.niche || 'General Service'} - 15% OFF
✅ Priority booking
✅ Same trusted technician

Reply "BOOK" if you want to grab a slot!

- ${business?.name || 'Your Local Pro'}`}
                  </pre>
                </div>

                <button
                  onClick={() => handleCopy('cash-script', `Hi {{name}}! 👋\n\nQuick check - how's your ${business?.business_data?.niche || 'aircon'} doing?\n\nWe have a few slots available this week and I'm offering a special rate for returning customers:\n\n✅ ${business?.business_data?.niche || 'General Service'} - 15% OFF\n✅ Priority booking\n✅ Same trusted technician\n\nReply "BOOK" if you want to grab a slot!\n\n- ${business?.name || 'Your Local Pro'}`)}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors ${copiedId === 'cash-script'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                    }`}
                >
                  {copiedId === 'cash-script' ? <Check size={18} /> : <Copy size={18} />}
                  {copiedId === 'cash-script' ? 'Copied!' : 'Copy Script'}
                </button>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="font-medium text-slate-800">💡 Pro Tips</h4>
                <ul className="text-sm text-slate-600 mt-2 space-y-1">
                  <li>• Send in the morning (9-11am) for best response</li>
                  <li>• Personalize the name placeholder with their actual name</li>
                  <li>• Follow up after 24 hours if no reply</li>
                  <li>• Works best with clients from last 6 months</li>
                </ul>
              </div>
            </div>
          )}

          {/* Van Magnet QR Tab */}
          {activeTab === 'van' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <span className="text-2xl">🚐</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">Van Magnet QR Code</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      This QR code links directly to your Instant Quote page.
                      Turn your work vehicle into a 24/7 lead capture machine!
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center bg-white rounded-xl p-8 border border-slate-200 mb-4">
                  {/* QR Code will be generated here - for now show the sticker download */}
                  <div className="w-48 h-48 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300 mb-4">
                    <QrCode size={80} className="text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-500 text-center mb-2">
                    Points to: <span className="font-mono text-blue-600">/quote</span>
                  </p>
                  <p className="text-xs text-slate-400 text-center">
                    Customers scan → Get instant quote → You get the lead
                  </p>
                </div>

                <button
                  onClick={generateVanSticker}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition-colors"
                >
                  <Download size={18} />
                  Download High-Res / Sticker
                </button>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="font-medium text-slate-800">🖨️ How to Get Your Magnet Printed</h4>
                <ul className="text-sm text-slate-600 mt-2 space-y-1">
                  <li>1. Download the PNG file above</li>
                  <li>2. Go to Shopee/Lazada → Search "custom car magnet sticker"</li>
                  <li>3. Upload the file → Choose "outdoor vinyl" material</li>
                  <li>4. Recommended size: 30cm x 30cm (High Visibility)</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Template Card Component
function TemplateCard({ icon, title, description, content, onCopy, copied, color }) {
  const colorClasses = {
    green: 'from-green-50 to-emerald-50 border-green-200',
    blue: 'from-blue-50 to-indigo-50 border-blue-200',
    purple: 'from-purple-50 to-pink-50 border-purple-200',
    slate: 'from-slate-50 to-gray-50 border-slate-200',
  };

  return (
    <div className={`bg-gradient-to-r ${colorClasses[color]} rounded-xl p-5 border`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">{icon}</div>
          <div>
            <h3 className="font-semibold text-slate-800">{title}</h3>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>
        <button
          onClick={onCopy}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${copied
            ? 'bg-green-100 text-green-700'
            : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
            }`}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="bg-white rounded-lg p-3 border border-slate-200 max-h-32 overflow-y-auto">
        <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans">{content}</pre>
      </div>
    </div>
  );
}
