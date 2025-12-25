// src/app/api/assets/flyer/route.js
// Generate a Van Sticker / Gate Flyer (A5 PDF) with QR code
// Perfect for leaving at customer sites or sticking on vehicles

import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('businessId');
  const format = searchParams.get('format') || 'a5'; // a5, a4, sticker

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
    const couponCode = businessData.lead_magnet_pdf?.coupon_code || 'GUIDE15';
    const landingPageUrl = business.subdomain 
      ? `https://launchfly.app/sites/${business.subdomain}`
      : `https://launchfly.app/preview/${businessId}`;

    // Import PDFKit dynamically
    const PDFDocument = (await import('pdfkit')).default;

    // Set page size based on format
    let pageSize = 'A5';
    if (format === 'a4') pageSize = 'A4';
    if (format === 'sticker') pageSize = [200, 200]; // Small square sticker

    const doc = new PDFDocument({
      size: pageSize,
      margin: 30,
      layout: format === 'sticker' ? 'portrait' : 'portrait'
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    // Generate QR code
    let qrBuffer = null;
    try {
      const qrDataUrl = await QRCode.toDataURL(landingPageUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#1e40af', light: '#ffffff' }
      });
      const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
      qrBuffer = Buffer.from(qrBase64, 'base64');
    } catch (qrError) {
      console.error('QR generation error:', qrError);
    }

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const centerX = pageWidth / 2;

    if (format === 'sticker') {
      // STICKER FORMAT - Simple QR with minimal text
      // Background
      doc.rect(0, 0, pageWidth, pageHeight).fill('#1e40af');
      
      // QR Code (centered, large)
      if (qrBuffer) {
        doc.image(qrBuffer, centerX - 70, 30, { width: 140 });
      }

      // Text below QR
      doc.fillColor('#ffffff')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('SCAN FOR', 0, 175, { width: pageWidth, align: 'center' })
         .text('FREE GUIDE', 0, 186, { width: pageWidth, align: 'center' });

    } else {
      // FLYER FORMAT (A5/A4)
      // Header background
      doc.rect(0, 0, pageWidth, 120).fill('#1e40af');

      // Business name
      doc.fillColor('#ffffff')
         .fontSize(format === 'a4' ? 28 : 22)
         .font('Helvetica-Bold')
         .text(businessName.toUpperCase(), 30, 30, { width: pageWidth - 60, align: 'center' });

      // Tagline
      doc.fontSize(format === 'a4' ? 14 : 11)
         .font('Helvetica')
         .text(`Your Trusted ${niche} Partner`, 30, format === 'a4' ? 70 : 60, { width: pageWidth - 60, align: 'center' });

      // Phone number in header
      if (phone) {
        doc.fontSize(format === 'a4' ? 16 : 13)
           .font('Helvetica-Bold')
           .text(`📞 ${phone}`, 30, format === 'a4' ? 95 : 82, { width: pageWidth - 60, align: 'center' });
      }

      // Main content area
      const contentY = 140;

      // "FREE GUIDE" banner
      doc.rect(30, contentY, pageWidth - 60, format === 'a4' ? 50 : 40)
         .fill('#fbbf24');
      
      doc.fillColor('#1f2937')
         .fontSize(format === 'a4' ? 20 : 16)
         .font('Helvetica-Bold')
         .text('📄 FREE GUIDE INSIDE!', 30, contentY + (format === 'a4' ? 15 : 12), { width: pageWidth - 60, align: 'center' });

      // Guide title
      doc.fillColor('#1f2937')
         .fontSize(format === 'a4' ? 24 : 18)
         .font('Helvetica-Bold')
         .text(leadMagnetTitle, 30, contentY + (format === 'a4' ? 70 : 55), { width: pageWidth - 60, align: 'center' });

      // QR Code section
      const qrY = contentY + (format === 'a4' ? 130 : 100);
      const qrSize = format === 'a4' ? 180 : 130;

      // QR background box
      doc.rect(centerX - (qrSize/2) - 20, qrY - 10, qrSize + 40, qrSize + 60)
         .fillAndStroke('#f8fafc', '#e2e8f0');

      // QR Code
      if (qrBuffer) {
        doc.image(qrBuffer, centerX - (qrSize/2), qrY, { width: qrSize });
      }

      // Scan instruction
      doc.fillColor('#3b82f6')
         .fontSize(format === 'a4' ? 14 : 11)
         .font('Helvetica-Bold')
         .text('👆 SCAN TO DOWNLOAD', 30, qrY + qrSize + 15, { width: pageWidth - 60, align: 'center' });

      // Offer box
      const offerY = qrY + qrSize + (format === 'a4' ? 70 : 50);
      doc.rect(30, offerY, pageWidth - 60, format === 'a4' ? 60 : 45)
         .fill('#10b981');

      doc.fillColor('#ffffff')
         .fontSize(format === 'a4' ? 18 : 14)
         .font('Helvetica-Bold')
         .text(`🎁 ${couponOffer}`, 30, offerY + (format === 'a4' ? 12 : 8), { width: pageWidth - 60, align: 'center' });
      
      if (couponCode) {
        doc.fontSize(format === 'a4' ? 14 : 11)
           .font('Helvetica')
           .text(`Use code: ${couponCode}`, 30, offerY + (format === 'a4' ? 38 : 28), { width: pageWidth - 60, align: 'center' });
      }

      // Benefits list
      const benefitsY = offerY + (format === 'a4' ? 90 : 65);
      const benefits = [
        '✅ Expert tips & advice',
        '✅ Fair pricing guide',
        '✅ Exclusive discount'
      ];

      doc.fillColor('#374151')
         .fontSize(format === 'a4' ? 13 : 10)
         .font('Helvetica');

      benefits.forEach((benefit, i) => {
        doc.text(benefit, 50, benefitsY + (i * (format === 'a4' ? 22 : 16)));
      });

      // Footer
      const footerY = pageHeight - 50;
      doc.fontSize(format === 'a4' ? 10 : 8)
         .fillColor('#9ca3af')
         .text(`© ${new Date().getFullYear()} ${businessName} • ${landingPageUrl}`, 30, footerY, { width: pageWidth - 60, align: 'center' });
    }

    doc.end();

    // Wait for PDF to be complete
    const pdfBuffer = await new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const filename = format === 'sticker' 
      ? `${businessName.replace(/[^a-z0-9]/gi, '_')}_qr_sticker.pdf`
      : `${businessName.replace(/[^a-z0-9]/gi, '_')}_flyer_${format}.pdf`;

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Flyer generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
