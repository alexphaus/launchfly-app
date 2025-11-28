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

    console.log('📧 Lead capture request:', { email, businessId });

    if (!email || !businessId) {
      console.error('❌ Missing required fields:', { email, businessId });
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

    // 2. Add to Customers (or get existing)
    let customerId = null;
    let isNewLead = false;
    
    // Check if customer already exists
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, email_sequence_day')
      .eq('business_id', businessId)
      .eq('email', email)
      .single();

    if (existingCustomer?.id) {
      customerId = existingCustomer.id;
      console.log(`📧 Existing customer found: ${email}`);
    } else {
      // Create new customer with email sequence tracking
      const customerData = {
        business_id: businessId,
        email: email,
        status: 'lead',
        source: 'lead_magnet',
        email_sequence_day: 1,
        email_sequence_started_at: new Date().toISOString(),
        next_email_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      
      const { data: newCustomer, error: custError } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single();
      
      if (custError) {
        // Handle duplicate key error gracefully
        if (custError.code === '23505') {
          console.log(`📧 Customer already exists (race condition): ${email}`);
          const { data: retry } = await supabase
            .from('customers')
            .select('id')
            .eq('business_id', businessId)
            .eq('email', email)
            .single();
          customerId = retry?.id;
        } else {
          console.error('Customer insert error:', custError);
        }
      } else if (newCustomer) {
        customerId = newCustomer.id;
        isNewLead = true;
        console.log(`✅ New lead created:`, {
          email,
          customerId,
          businessId,
          source: 'lead_magnet',
          status: 'lead'
        });
      } else {
        console.error('❌ Customer creation failed but no error returned');
      }
    }

    // 3. Log Activity
    if (isNewLead) {
      await supabase
        .from('ai_activities')
        .insert({
          business_id: businessId,
          type: 'lead_magnet',
          icon: 'M',
          message: 'New Lead Magnet Signup',
          details: `${email} signed up to download the guide.`,
          metadata: { 
            email,
            customer_id: customerId 
          }
        });
    }

    // 4. Send Email with PDF Attachment
    // Handle both nested 'leadMagnet' structure and flat structure from launch.js
    const flatData = business.business_data;
    const nestedData = business.business_data?.leadMagnet;
    
    // Normalize data
    const title = flatData.lead_magnet_title || nestedData?.lead_magnet?.title || 'Expert Guide';
    const content = flatData.lead_magnet_content || nestedData?.lead_magnet?.content || [];
    const pdfContent = flatData.lead_magnet_pdf || nestedData?.lead_magnet_pdf || {};
    const emailSequence = flatData.email_sequence || nestedData?.email_sequence || [];
    const firstEmail = emailSequence.find(e => e.day === 1) || { subject: 'Your Guide', body: 'Here is your guide.' };
    
    // Prepare business data for PDF
    const businessDataForPdf = {
      businessName: flatData.businessName || business.name || 'Local Business',
      niche: flatData.niche || 'Service',
      phone: business.phone_number || flatData.phone || '',
      email: business.email || flatData.email || '',
      city: flatData.city || flatData.location || 'your area',
      address: flatData.address || '',
      hours: flatData.hours || ''
    };
    
    if (title) {
      let attachments = [];
      
      // Generate PDF using dynamic import for safety
      try {
        const PDFDocument = (await import('pdfkit')).default;
        const pdfBuffer = await generatePDF({ title, content, pdfContent }, PDFDocument, businessDataForPdf);
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
                     <p style="font-weight: bold; color: #0369a1; margin-bottom: 10px;">Attachment: Your guide is included with this email.</p>
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
             <p>&copy; ${new Date().getFullYear()} ${business.business_data.businessName || 'Launchfly Business'}</p>
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
    
    // 5. Increment Lead Count (only for new leads)
    if (isNewLead) {
      const { data: currentBiz, error: bizReadError } = await supabase
        .from('businesses')
        .select('total_leads')
        .eq('id', businessId)
        .single();
      
      if (!bizReadError) {
        const newCount = (currentBiz?.total_leads || 0) + 1;
        const { error: updateError } = await supabase
          .from('businesses')
          .update({ total_leads: newCount })
          .eq('id', businessId);
        
        if (updateError) {
          console.error('Failed to update lead count:', updateError);
        } else {
          console.log(`📊 Lead count updated to ${newCount} for business ${businessId}`);
        }
      }
    }

    return Response.json({ 
      success: true, 
      customerId,
      isNewLead,
      message: isNewLead ? 'Lead captured successfully!' : 'Welcome back!'
    });
  } catch (error) {
    console.error('Capture error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Generates a premium multi-page PDF from the lead magnet content
 * Following the "treasure chest" philosophy: small, sharp, immediately usable
 */
function generatePDF(data, PDFDocument, businessData = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'letter',
        bufferPages: true
      });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Color scheme (professional blue)
      const colors = {
        primary: '#1e40af',
        secondary: '#3b82f6', 
        accent: '#0ea5e9',
        dark: '#0f172a',
        gray: '#64748b',
        light: '#f1f5f9',
        success: '#10b981',
        warning: '#f59e0b'
      };

      const pdfContent = data.pdfContent || {};
      const niche = businessData.niche || 'Service';
      const businessName = businessData.businessName || 'Local Business';
      const phone = businessData.phone || '';
      const city = businessData.city || 'your area';

      // ============ PAGE 1: COVER PAGE ============
      // Background color block
      doc.rect(0, 0, 612, 350).fill(colors.primary);
      
      // Title
      doc.fillColor('#ffffff')
         .fontSize(36)
         .font('Helvetica-Bold')
         .text(data.title || 'Your Expert Guide', 50, 120, { 
           width: 512, 
           align: 'center' 
         });
      
      // Tagline
      doc.fontSize(16)
         .font('Helvetica')
         .text(pdfContent.cover_tagline || `Everything you need to know about ${niche.toLowerCase()} in ${city}`, 50, 180, { 
           width: 512, 
           align: 'center' 
         });

      // Decorative line
      doc.strokeColor('#ffffff').lineWidth(2)
         .moveTo(200, 220).lineTo(412, 220).stroke();

      // Business name badge
      doc.fillColor('#ffffff')
         .fontSize(14)
         .font('Helvetica-Oblique')
         .text(`Free Guide from ${businessName}`, 50, 250, { 
           width: 512, 
           align: 'center' 
         });

      // Year badge
      doc.fontSize(12)
         .text(`${new Date().getFullYear()} Edition`, 50, 280, { 
           width: 512, 
           align: 'center' 
         });

      // Bottom section
      doc.fillColor(colors.dark)
         .fontSize(11)
         .font('Helvetica')
         .text('5-minute read | Actionable tips | Money-saving advice', 50, 400, { 
           width: 512, 
           align: 'center' 
         });

      // ============ PAGE 2: INTRODUCTION ============
      doc.addPage();
      
      // Header
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('Why This Guide Exists', 50, 50);
      
      doc.strokeColor(colors.accent).lineWidth(3)
         .moveTo(50, 85).lineTo(200, 85).stroke();

      // Intro text
      const introText = pdfContent.intro || 
        `We created this guide because we believe every homeowner deserves to make informed decisions about their ${niche.toLowerCase()} needs. ` +
        `At ${businessName}, we've been serving ${city} for years, and we've seen too many people overpay or get scammed. ` +
        `This guide gives you the insider knowledge to protect yourself and your home.`;

      doc.fillColor(colors.dark)
         .fontSize(13)
         .font('Helvetica')
         .text(introText, 50, 110, { 
           width: 512, 
           align: 'left',
           lineGap: 6
         });

      // What you'll learn box
      doc.rect(50, 200, 512, 120).fillAndStroke(colors.light, colors.secondary);
      
      doc.fillColor(colors.primary)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('What You Will Learn:', 70, 220);

      const learnItems = [
        `Common ${niche.toLowerCase()} mistakes that cost homeowners money`,
        'Simple tips you can do yourself today',
        'When to call a professional (and when not to)',
        'Real pricing ranges so you never overpay'
      ];

      learnItems.forEach((item, i) => {
        doc.fillColor(colors.dark)
           .fontSize(11)
           .font('Helvetica')
           .text(`- ${item}`, 80, 250 + (i * 20));
      });

      // Trust badge
      doc.fillColor(colors.gray)
         .fontSize(10)
         .font('Helvetica-Oblique')
         .text(`Created by ${businessName} - Trusted ${niche} Experts in ${city}`, 50, 350, {
           width: 512,
           align: 'center'
         });

      // ============ PAGE 3: COMMON MISTAKES ============
      doc.addPage();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text(`Common ${niche} Mistakes`, 50, 50);
      
      doc.strokeColor(colors.warning).lineWidth(3)
         .moveTo(50, 85).lineTo(250, 85).stroke();

      doc.fillColor(colors.gray)
         .fontSize(11)
         .font('Helvetica-Oblique')
         .text('Avoid these costly errors that we see homeowners make every day', 50, 100);

      const mistakes = pdfContent.common_mistakes || [
        { title: 'Ignoring small problems', description: 'A small leak today becomes a major repair tomorrow. Early detection saves thousands.' },
        { title: 'Hiring the cheapest option', description: 'Low prices often mean low quality. Check reviews and ask for references.' },
        { title: 'DIY gone wrong', description: 'Some jobs need professionals. Incorrect repairs can void warranties and cause more damage.' },
        { title: 'Not getting multiple quotes', description: 'Always get 2-3 quotes to ensure fair pricing and quality work.' },
        { title: 'Skipping regular maintenance', description: 'Prevention is cheaper than repair. Schedule annual check-ups.' }
      ];

      let yPos = 130;
      mistakes.slice(0, 5).forEach((mistake, i) => {
        // Mistake number circle
        doc.circle(65, yPos + 12, 12).fill(colors.warning);
        doc.fillColor('#ffffff')
           .fontSize(12)
           .font('Helvetica-Bold')
           .text(`${i + 1}`, 60, yPos + 6);

        // Mistake content
        doc.fillColor(colors.dark)
           .fontSize(13)
           .font('Helvetica-Bold')
           .text(mistake.title, 90, yPos);
        
        doc.fillColor(colors.gray)
           .fontSize(11)
           .font('Helvetica')
           .text(mistake.description, 90, yPos + 18, { width: 460 });

        yPos += 70;
      });

      // ============ PAGE 4-5: QUICK TIPS ============
      doc.addPage();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('Quick Tips You Can Use Today', 50, 50);
      
      doc.strokeColor(colors.success).lineWidth(3)
         .moveTo(50, 85).lineTo(280, 85).stroke();

      doc.fillColor(colors.gray)
         .fontSize(11)
         .font('Helvetica-Oblique')
         .text('Simple, safe actions that save money and prevent problems', 50, 100);

      const tips = pdfContent.quick_tips || [
        { title: 'Regular inspections', description: 'Check for visible issues monthly. Look for leaks, damage, or unusual signs.' },
        { title: 'Keep records', description: 'Document all services and repairs. This helps with warranties and resale value.' },
        { title: 'Know your shutoffs', description: 'Learn where main shutoffs are located. This can prevent major damage in emergencies.' },
        { title: 'Clean and maintain', description: 'Regular cleaning prevents buildup and extends equipment life.' },
        { title: 'Ask questions', description: 'Never hesitate to ask your service provider to explain what they are doing.' }
      ];

      yPos = 130;
      tips.slice(0, 5).forEach((tip, i) => {
        // Green checkmark box
        doc.rect(50, yPos - 5, 25, 25).fill(colors.success);
        doc.fillColor('#ffffff')
           .fontSize(16)
           .text('X', 57, yPos);

        doc.fillColor(colors.dark)
           .fontSize(13)
           .font('Helvetica-Bold')
           .text(tip.title, 90, yPos);
        
        doc.fillColor(colors.gray)
           .fontSize(11)
           .font('Helvetica')
           .text(tip.description, 90, yPos + 18, { width: 460 });

        yPos += 65;
      });

      // Pro tip box
      doc.rect(50, yPos + 20, 512, 60).fillAndStroke('#fef3c7', colors.warning);
      doc.fillColor(colors.warning)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('PRO TIP', 70, yPos + 35);
      doc.fillColor(colors.dark)
         .fontSize(11)
         .font('Helvetica')
         .text(`When in doubt, call a professional. A quick inspection is much cheaper than fixing DIY mistakes. At ${businessName}, we offer free estimates.`, 70, yPos + 52, { width: 470 });

      // ============ PAGE 6: CASE STUDY ============
      doc.addPage();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('Real Customer Story', 50, 50);
      
      doc.strokeColor(colors.accent).lineWidth(3)
         .moveTo(50, 85).lineTo(220, 85).stroke();

      const caseStudy = pdfContent.case_study || {
        customer_name: 'Maria',
        location: 'Downtown',
        problem: `had a small issue that seemed minor at first, but it quickly escalated into a bigger problem.`,
        solution: `Our team arrived within 24 hours, diagnosed the root cause, and fixed it properly.`,
        result: 'The repair cost was 60% less than what another company quoted, and it has been working perfectly ever since.'
      };

      // Story box
      doc.rect(50, 100, 512, 200).fillAndStroke(colors.light, colors.secondary);

      doc.fillColor(colors.dark)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(`${caseStudy.customer_name} from ${caseStudy.location}`, 70, 120);

      doc.fillColor(colors.gray)
         .fontSize(11)
         .font('Helvetica')
         .text('THE PROBLEM:', 70, 150);
      doc.fillColor(colors.dark)
         .text(caseStudy.problem, 70, 165, { width: 470 });

      doc.fillColor(colors.gray)
         .text('OUR SOLUTION:', 70, 210);
      doc.fillColor(colors.dark)
         .text(caseStudy.solution, 70, 225, { width: 470 });

      doc.fillColor(colors.success)
         .font('Helvetica-Bold')
         .text('THE RESULT:', 70, 260);
      doc.fillColor(colors.dark)
         .font('Helvetica')
         .text(caseStudy.result, 70, 275, { width: 470 });

      // Quote
      doc.fillColor(colors.primary)
         .fontSize(13)
         .font('Helvetica-Oblique')
         .text(`"I wish I had found ${businessName} sooner. They saved me time and money!"`, 70, 330, {
           width: 470
         });
      doc.fillColor(colors.gray)
         .fontSize(11)
         .text(`- ${caseStudy.customer_name}, Verified Customer`, 70, 360);

      // ============ PAGE 7: ACTION CHECKLIST ============
      doc.addPage();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('Do These 2 Things Now', 50, 50);
      
      doc.strokeColor(colors.success).lineWidth(3)
         .moveTo(50, 85).lineTo(250, 85).stroke();

      doc.fillColor(colors.gray)
         .fontSize(11)
         .font('Helvetica-Oblique')
         .text('Quick wins you can accomplish in the next 10 minutes', 50, 100);

      const checklist = pdfContent.action_checklist || [
        `Do a quick visual inspection of your ${niche.toLowerCase()} system`,
        `Save our number for when you need professional help: ${phone || 'Call us!'}`
      ];

      checklist.slice(0, 2).forEach((item, i) => {
        // Big checkbox
        doc.rect(50, 140 + (i * 100), 40, 40).stroke(colors.primary);
        
        doc.fillColor(colors.dark)
           .fontSize(14)
           .font('Helvetica-Bold')
           .text(`Step ${i + 1}`, 110, 145 + (i * 100));
        
        doc.fillColor(colors.dark)
           .fontSize(12)
           .font('Helvetica')
           .text(item, 110, 165 + (i * 100), { width: 440 });
      });

      // Bonus offer box
      const bonusOffer = pdfContent.bonus_offer || `Show this PDF and get 10% off your first ${niche.toLowerCase()} service!`;
      
      doc.rect(50, 370, 512, 80).fillAndStroke('#dcfce7', colors.success);
      doc.fillColor(colors.success)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('Special Offer for Guide Readers', 70, 390);
      doc.fillColor(colors.dark)
         .fontSize(12)
         .font('Helvetica')
         .text(bonusOffer, 70, 415, { width: 470 });

      // ============ PAGE 8: PRICING GUIDE ============
      doc.addPage();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('Typical Price Ranges', 50, 50);
      
      doc.strokeColor(colors.accent).lineWidth(3)
         .moveTo(50, 85).lineTo(230, 85).stroke();

      doc.fillColor(colors.gray)
         .fontSize(11)
         .font('Helvetica-Oblique')
         .text('So you know what to expect (prices vary by location and complexity)', 50, 100);

      const priceRanges = pdfContent.price_ranges || [
        { service: 'Basic inspection', range: '$50 - $150' },
        { service: 'Minor repairs', range: '$100 - $300' },
        { service: 'Medium repairs', range: '$300 - $800' },
        { service: 'Major repairs', range: '$800 - $2,000+' },
        { service: 'Full replacement', range: '$2,000 - $10,000+' }
      ];

      yPos = 130;
      priceRanges.forEach((item, i) => {
        const bgColor = i % 2 === 0 ? colors.light : '#ffffff';
        doc.rect(50, yPos - 5, 512, 35).fill(bgColor);
        
        doc.fillColor(colors.dark)
           .fontSize(12)
           .font('Helvetica')
           .text(item.service, 70, yPos + 5);
        
        doc.fillColor(colors.primary)
           .fontSize(12)
           .font('Helvetica-Bold')
           .text(item.range, 400, yPos + 5, { width: 140, align: 'right' });
        
        yPos += 35;
      });

      doc.fillColor(colors.warning)
         .fontSize(10)
         .font('Helvetica-Oblique')
         .text('Note: These are general estimates. Always get a written quote before work begins.', 50, yPos + 20, { width: 512 });

      // ============ PAGE 9: FAQ ============
      doc.addPage();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('Frequently Asked Questions', 50, 50);
      
      doc.strokeColor(colors.secondary).lineWidth(3)
         .moveTo(50, 85).lineTo(300, 85).stroke();

      const faqs = pdfContent.faq || [
        { question: 'How quickly can you respond?', answer: 'We offer same-day service for most calls received before noon.' },
        { question: 'Do you offer warranties?', answer: 'Yes, all our work comes with a satisfaction guarantee.' },
        { question: 'Are you licensed and insured?', answer: 'Absolutely. We are fully licensed, bonded, and insured for your protection.' },
        { question: 'Do you offer free estimates?', answer: 'Yes, we provide free estimates for most jobs.' }
      ];

      yPos = 110;
      faqs.forEach((faq, i) => {
        doc.fillColor(colors.primary)
           .fontSize(13)
           .font('Helvetica-Bold')
           .text(`Q: ${faq.question}`, 50, yPos);
        
        doc.fillColor(colors.dark)
           .fontSize(11)
           .font('Helvetica')
           .text(`A: ${faq.answer}`, 50, yPos + 20, { width: 512 });
        
        yPos += 60;
      });

      // ============ PAGE 10: CTA + CONTACT ============
      doc.addPage();

      // Top section with CTA
      doc.rect(0, 0, 612, 280).fill(colors.primary);
      
      doc.fillColor('#ffffff')
         .fontSize(28)
         .font('Helvetica-Bold')
         .text('Ready to Get Started?', 50, 80, { width: 512, align: 'center' });
      
      doc.fontSize(14)
         .font('Helvetica')
         .text(`Contact ${businessName} today for a free consultation`, 50, 130, { width: 512, align: 'center' });

         if (phone) {
            doc.fontSize(32)
                .font('Helvetica-Bold')
                .text(`Call: ${phone}`, 50, 180, { width: 512, align: 'center' });
      }

      // Contact details section
      doc.fillColor(colors.dark)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('Contact Information', 50, 320);

      doc.strokeColor(colors.accent).lineWidth(2)
         .moveTo(50, 345).lineTo(200, 345).stroke();

         const contactDetails = [
            `Business: ${businessName}`,
            phone ? `Phone: ${phone}` : null,
            businessData.email ? `Email: ${businessData.email}` : null,
            businessData.address ? `Address: ${businessData.address}` : `Service Area: ${city}`,
            businessData.hours ? `Hours: ${businessData.hours}` : 'Hours: Mon-Fri 8am-6pm, Sat 9am-2pm'
         ].filter(Boolean);

      yPos = 365;
      contactDetails.forEach(detail => {
        doc.fillColor(colors.dark)
           .fontSize(12)
           .font('Helvetica')
           .text(detail, 50, yPos);
        yPos += 25;
      });

      // Social proof
      doc.rect(300, 360, 250, 100).fillAndStroke(colors.light, colors.secondary);
      doc.fillColor(colors.primary)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('*****', 320, 375);
      doc.fillColor(colors.dark)
         .fontSize(10)
         .font('Helvetica-Oblique')
         .text(`"${businessName} saved us so much hassle. Professional, honest, and affordable. Highly recommend!"`, 320, 395, { width: 210 });
      doc.fillColor(colors.gray)
         .fontSize(9)
         .text('- Happy Customer', 320, 440);

      // Footer
      doc.fillColor(colors.gray)
         .fontSize(9)
         .font('Helvetica')
         .text(`(c) ${new Date().getFullYear()} ${businessName}. All rights reserved.`, 50, 520, { width: 512, align: 'center' });
      
      doc.fontSize(8)
         .text('Generated with care by Launchfly', 50, 540, { width: 512, align: 'center' });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
