// src/app/api/assets/whatsapp-status/route.js
// Generate a WhatsApp Status Image (1080x1920) for the business
// Uses SVG converted to PNG via sharp (more reliable than canvas)

import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('businessId');

  if (!businessId) {
    return Response.json({ error: 'Missing businessId' }, { status: 400 });
  }

  try {
    // Fetch business data
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (error || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    const businessData = business.business_data || {};
    const businessName = businessData.businessName || business.name || 'Local Business';
    const niche = businessData.niche || 'Service';
    const phone = business.phone_number || businessData.phone || '';
    const leadMagnetTitle = businessData.lead_magnet_title || `Free ${niche} Guide`;
    const couponOffer = businessData.lead_magnet_pdf?.coupon_offer || '15% Off First Service';
    // URL points to Quote Funnel - use subdomain format when available
    const landingPageUrl = business.subdomain
      ? `https://${business.subdomain}.launchfly.ai/quote`
      : `https://app.launchfly.ai/q/${businessId}`;

    // Generate QR code as data URL
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(landingPageUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#1e40af', light: '#ffffff' }
      });
    } catch (qrError) {
      console.error('QR generation error:', qrError);
    }

    // WhatsApp Status dimensions: 1080x1920
    const width = 1080;
    const height = 1920;

    // Escape text for SVG
    const escapeXml = (text) => text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    // Wrap long text
    const wrapTitle = (text, maxChars = 20) => {
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';

      words.forEach(word => {
        if ((currentLine + ' ' + word).trim().length <= maxChars) {
          currentLine = (currentLine + ' ' + word).trim();
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) lines.push(currentLine);

      return lines.slice(0, 3);
    };

    const titleLines = wrapTitle(leadMagnetTitle.toUpperCase(), 18);

    // Create SVG
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1e40af"/>
      <stop offset="50%" style="stop-color:#3b82f6"/>
      <stop offset="100%" style="stop-color:#7c3aed"/>
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  
  <!-- Top Badge -->
  <rect x="290" y="150" width="500" height="60" rx="30" fill="rgba(255,255,255,0.2)"/>
  <text x="${width / 2}" y="190" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">📄 FREE GUIDE ALERT</text>
  
  <!-- Main Title -->
  ${titleLines.map((line, i) =>
      `<text x="${width / 2}" y="${350 + (i * 90)}" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="white" text-anchor="middle">${escapeXml(line)}</text>`
    ).join('\n  ')}
  
  <!-- Subtitle -->
  <text x="${width / 2}" y="${350 + (titleLines.length * 90) + 50}" font-family="Arial, sans-serif" font-size="36" fill="rgba(255,255,255,0.9)" text-anchor="middle">From ${escapeXml(businessName)}</text>
  
  <!-- QR Code Background -->
  <rect x="${(width - 410) / 2}" y="750" width="410" height="480" rx="30" fill="white"/>
  
  <!-- QR Code Image -->
  ${qrDataUrl ? `<image x="${(width - 300) / 2}" y="780" width="300" height="300" href="${qrDataUrl}"/>` : ''}
  
  <!-- Scan Text -->
  <text x="${width / 2}" y="1150" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#1e40af" text-anchor="middle">👆 SCAN TO DOWNLOAD</text>
  
  <!-- Offer Box -->
  <rect x="100" y="1300" width="${width - 200}" height="100" rx="20" fill="#fbbf24"/>
  <text x="${width / 2}" y="1365" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="#1f2937" text-anchor="middle">🎁 ${escapeXml(couponOffer)}</text>
  
  <!-- Phone -->
  ${phone ? `
  <text x="${width / 2}" y="1520" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">📞 ${escapeXml(phone)}</text>
  <text x="${width / 2}" y="1580" font-family="Arial, sans-serif" font-size="28" fill="rgba(255,255,255,0.8)" text-anchor="middle">Call/WhatsApp us now!</text>
  ` : ''}
  
  <!-- Bottom CTA -->
  <text x="${width / 2}" y="1750" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle">Tap ⬆️ link in bio or scan QR code</text>
  
  <!-- Footer -->
  <text x="${width / 2}" y="1850" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.6)" text-anchor="middle">© ${new Date().getFullYear()} ${escapeXml(businessName)}</text>
</svg>`;

    // Try to convert to PNG using sharp if available, otherwise return SVG
    try {
      const sharp = (await import('sharp')).default;
      const pngBuffer = await sharp(Buffer.from(svg))
        .png()
        .toBuffer();

      return new Response(pngBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${businessName.replace(/[^a-z0-9]/gi, '_')}_whatsapp_status.png"`,
          'Cache-Control': 'no-cache',
        },
      });
    } catch (sharpError) {
      // If sharp is not available, return SVG
      console.log('Sharp not available, returning SVG:', sharpError.message);
      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Content-Disposition': `attachment; filename="${businessName.replace(/[^a-z0-9]/gi, '_')}_whatsapp_status.svg"`,
          'Cache-Control': 'no-cache',
        },
      });
    }

  } catch (error) {
    console.error('WhatsApp status generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
