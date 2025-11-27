import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// We use dynamic import for pdfkit inside the handler to avoid build issues
// import PDFDocument from 'pdfkit'; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { email, businessId } = await request.json();

    if (!email || !businessId) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }

    // 1. Get Business Data
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (bizError || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    // 2. Add to Customers
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('business_id', businessId)
      .eq('email', email)
      .single();

    let customerId = existingCustomer?.id;

    if (!customerId) {
      const { data: newCustomer, error: custError } = await supabase
        .from('customers')
        .insert({
          business_id: businessId,
          email: email,
          name: email.split('@')[0], // Fallback name
          status: 'lead',
          source: 'lead_magnet'
        })
        .select()
        .single();
      
      if (custError && custError.code !== '23505') { 
         console.error('Customer insert error:', custError);
      } else if (newCustomer) {
        customerId = newCustomer.id;
      }
    }

    // 3. Log Activity
    await supabase
      .from('ai_activities')
      .insert({
        business_id: businessId,
        type: 'lead_magnet',
        icon: '🧲',
        message: 'New Lead Magnet Signup',
        details: `${email} signed up to download the guide.`,
        metadata: { 
          recipientEmail: email, 
          recipientName: email.split('@')[0],
          customerId 
        }
      });

    // 4. Send Email with PDF Attachment
    // Handle both nested 'leadMagnet' structure and flat structure from launch.js
    const flatData = business.business_data;
    const nestedData = business.business_data?.leadMagnet;
    
    // Normalize data
    const title = flatData.lead_magnet_title || nestedData?.lead_magnet?.title || 'Expert Guide';
    const content = flatData.lead_magnet_content || nestedData?.lead_magnet?.content || [];
    const emailSequence = flatData.email_sequence || nestedData?.email_sequence || [];
    const firstEmail = emailSequence.find(e => e.day === 1) || { subject: 'Your Guide', body: 'Here is your guide.' };
    
    if (title) {
      let attachments = [];
      
      // Generate PDF using dynamic import for safety
      try {
        const PDFDocument = (await import('pdfkit')).default;
        
        // Prepare rich context for the PDF generator
        const pdfData = {
          title,
          content,
          businessName: business.business_data.businessName || business.business_data.name || 'Local Business',
          niche: business.business_data.niche || 'Service',
          city: business.business_data.city || 'Your City',
          phone: business.phone_number || business.business_data.phone || '',
          website: `https://${business.subdomain}.launchfly.app`,
          email: business.email || business.business_data.email || ''
        };

        const pdfBuffer = await generatePDF(pdfData, PDFDocument);
        const fileName = title 
          ? `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`
          : 'expert-guide.pdf';
          
        attachments.push({
          content: pdfBuffer,
          filename: fileName,
        });
      } catch (pdfError) {
        console.error('PDF Generation failed:', pdfError);
        // Continue without PDF
      }

      const html = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; color: #333;">
          <div style="text-align: center; padding: 20px 0;">
             <h1 style="color: #1e40af; margin-bottom: 10px;">${title}</h1>
          </div>
          
          <div style="background: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              ${firstEmail.body.replace(/\n/g, '<br>')}
            </p>
            
            <div style="text-align: center; padding: 20px; background: #f0f9ff; border-radius: 8px; margin: 20px 0;">
              <p style="font-weight: bold; color: #0369a1; margin-bottom: 10px;">📎 Your guide is attached to this email.</p>
              <p style="font-size: 14px; color: #0c4a6e;">Can't see the attachment? Scroll down to read it inline.</p>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
            
            <!-- Inline backup -->
            <div style="background: #f8fafc; padding: 30px; border-radius: 12px;">
              <h2 style="margin-top: 0; text-align: center; color: #0f172a;">Your Guide (Web View)</h2>
              ${(content || []).map(c => `
                <div style="margin-bottom: 20px;">
                  <h3 style="color: #2563eb; margin-bottom: 10px;">${c.title}</h3>
                  <div style="line-height: 1.6; color: #374151;">${c.body}</div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
             <p>© ${new Date().getFullYear()} ${business.business_data.businessName || 'Launchfly Business'}</p>
             <p>You received this email because you signed up for our guide.</p>
          </div>
        </div>
      `;

      await resend.emails.send({
        from: 'Launchfly <hello@launchfly.ai>', 
        to: email,
        subject: firstEmail.subject,
        html: html,
        attachments: attachments
      });
    }
    
    // 5. Increment Lead Count
    // Use direct update instead of RPC to ensure it works without custom SQL functions
    const { data: currentBiz } = await supabase
      .from('businesses')
      .select('total_leads')
      .eq('id', businessId)
      .single();
      
    await supabase
      .from('businesses')
      .update({ total_leads: (currentBiz?.total_leads || 0) + 1 })
      .eq('id', businessId);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Capture error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Generates a high-value, trust-building PDF guide
 */
function generatePDF(data, PDFDocument) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { title, content, businessName, niche, city, phone, website } = data;
      const primaryColor = '#2563eb'; // Blue-600
      const secondaryColor = '#1e40af'; // Blue-800
      const accentColor = '#f59e0b'; // Amber-500

      // --- Page 1: The "Handshake" Cover ---
      
      // Top Branding
      doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
         .text(`A Free Resource from ${businessName}`, { align: 'center' });
      doc.moveDown(4);

      // Icon/Visual Anchor
      doc.fontSize(60).text('📘', { align: 'center' });
      doc.moveDown();

      // Main Title (The Promise)
      doc.fontSize(26).font('Helvetica-Bold').fillColor('#111827')
         .text(title, { align: 'center' });
      doc.moveDown();

      // Subtitle (The Context)
      doc.fontSize(16).font('Helvetica').fillColor('#4b5563')
         .text(`Essential advice for ${niche} needs in ${city}`, { align: 'center' });
      
      doc.moveDown(4);
      
      // The "Whisper" (Trust Builder)
      doc.fontSize(14).font('Helvetica-Oblique').fillColor('#374151')
         .text('"You can fix small things alone... but if it gets serious, we are here to help."', { align: 'center' });

      // Bottom Branding
      const bottomY = doc.page.height - 100;
      doc.text('', 50, bottomY); 
      doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor)
         .text(businessName, { align: 'center' });
      doc.fontSize(10).font('Helvetica').fillColor('#9ca3af')
         .text(`Serving ${city} homeowners with pride`, { align: 'center' });

      doc.addPage();

      // --- Page 2: Quick Intro (Human Connection) ---
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#111827').text('Introduction');
      doc.moveDown();
      
      doc.fontSize(12).font('Helvetica').fillColor('#374151')
         .text(`Dear Neighbor,`, { align: 'left' });
      doc.moveDown();
      
      doc.text(`We created this guide because we see too many people in ${city} struggle with simple ${niche} issues that could have been prevented with a little bit of insider knowledge.`, { align: 'justify', lineGap: 4 });
      doc.moveDown();
      
      doc.text(`This isn't a textbook. It's a collection of "quick wins" and practical tips we've gathered over years of service. Use this guide to save money, avoid common mistakes, and keep your home running smoothly.`, { align: 'justify', lineGap: 4 });
      doc.moveDown(2);
      
      doc.font('Helvetica-Bold').text(`- The Team at ${businessName}`);
      
      doc.moveDown(2);
      doc.lineWidth(1).strokeColor('#e5e7eb').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(2);

      // --- Pages 3+: Actionable Advice (The "Meat") ---
      
      if (content && content.length > 0) {
        content.forEach((chapter, index) => {
          // Check for space, add page if needed
          if (doc.y > 650) doc.addPage();

          // Chapter Title
          doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryColor)
             .text(`${index + 1}. ${chapter.title}`);
          doc.moveDown(0.5);
          
          // Chapter Body
          doc.fontSize(12).font('Helvetica').fillColor('#374151')
             .text(chapter.body, { align: 'justify', lineGap: 3 });
          doc.moveDown(1.5);
        });
      } else {
        // Fallback content if empty
        doc.fontSize(14).text('Top Tips for Success');
        doc.moveDown();
        doc.fontSize(12).text('1. Regular Maintenance: The key to longevity is checking your systems every 6 months.');
        doc.moveDown();
        doc.text('2. Professional Inspection: Catch problems early before they become expensive repairs.');
      }

      doc.addPage();

      // --- Page X: The "Do This Now" Checklist ---
      // Light background box for checklist
      doc.rect(50, 50, 495, 740).fill('#f8fafc'); 
      doc.fillColor('#111827');
      
      doc.y = 100;
      doc.fontSize(24).font('Helvetica-Bold').text('✅ Your Action Checklist', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).font('Helvetica').fillColor('#6b7280').text('Simple steps to take immediately:', { align: 'center' });
      doc.moveDown(2);

      const checklistItems = [
        'Review the tips in this guide',
        `Check your home for early warning signs of ${niche} issues`,
        `Save ${businessName}'s number in your phone: ${phone || 'See below'}`,
        'Share this guide with a neighbor who might need it',
        'Schedule a preventative inspection if you are unsure'
      ];

      checklistItems.forEach(item => {
        doc.fontSize(14).font('Helvetica').fillColor('#374151')
           .text(`[   ]  ${item}`, { indent: 70 });
        doc.moveDown(1.5);
      });

      doc.moveDown(2);
      
      // --- Page X: Strong CTA & Offer ---
      // Blue box for CTA
      const ctaY = doc.y;
      doc.rect(70, ctaY, 455, 200).fill('#eff6ff'); 
      doc.fillColor(secondaryColor); 
      doc.y = ctaY + 30; 
      
      doc.fontSize(18).font('Helvetica-Bold').text('Need a Professional Hand?', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).font('Helvetica').text('We are just a phone call away.', { align: 'center' });
      doc.moveDown();
      
      if (phone) {
        doc.fontSize(22).font('Helvetica-Bold').fillColor(primaryColor).text(phone, { align: 'center' });
        doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text('(Tap to call on mobile)', { align: 'center' });
      } else {
        doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryColor).text('Contact us on our website', { align: 'center' });
      }
      
      doc.moveDown();
      
      // Mini Offer / "Magic Element"
      doc.fontSize(12).font('Helvetica-Bold').fillColor(accentColor)
         .text('🎁 BONUS: Mention this guide for a priority booking!', { align: 'center' });

      doc.moveDown(2);
      if (website) {
        doc.fontSize(12).font('Helvetica').fillColor('#2563eb')
           .text(website, { align: 'center', link: website, underline: true });
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
