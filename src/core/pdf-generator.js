/**
 * PDF Generator for Lead Magnets
 * Following the "treasure chest" philosophy: small, sharp, immediately usable
 * 
 * SUPPORTS THREE BUSINESS TYPES:
 * 1. LOCAL SERVICE (Plumbers, HVAC, Cleaners) - Diagnostic PDF with price guide & coupons
 * 2. COACHING (Coaches, Consultants, Experts) - Authority PDF with frameworks & transformation stories
 * 3. EVENT (Workshops, Classes, Seminars) - Event details PDF with registration info
 * 
 * LOCAL SERVICE PDF (8 pages):
 * 1. Cover page (outcome-first headline)
 * 2. Quick Diagnostic (3-question self-assessment)
 * 3. Introduction + What You'll Learn
 * 4. Common mistakes (educational)
 * 5. Quick tips (actionable)
 * 6. Local Case Study (proof)
 * 7. Action checklist + Coupon/Voucher
 * 8. CTA + Contact + QR Code
 * 
 * COACHING PDF (8 pages):
 * 1. Cover page (transformation promise)
 * 2. The Big Promise + Who This Is For
 * 3. About the Expert (Authority bio)
 * 4. The Framework/Methodology (5 steps)
 * 5. Quick Wins (actionable tips)
 * 6. Client Transformation Story
 * 7. Action Checklist (no coupon)
 * 8. CTA + Book a Call + QR Code
 * 
 * EVENT PDF (6 pages):
 * 1. Cover page (Event name, date, pricing)
 * 2. Event Details (What, When, Where, Price)
 * 3. Meet the Instructor/Speaker
 * 4. What You'll Experience
 * 5. FAQ + Registration Info
 * 6. CTA + Contact + QR Code
 * 
 * Mobile-first design: Large buttons, ≤2MB, readable on phone
 */

import QRCode from 'qrcode';

/**
 * Main export - routes to appropriate generator based on businessType
 */
export async function generatePDF(data, PDFDocument, businessData = {}) {
  const designPrefs = businessData.design_preferences || {};
  let layoutMode = designPrefs.layout_mode;
  
  // Fallback logic if layout_mode is missing
  if (!layoutMode) {
      const businessType = businessData.businessType || 'local_service';
      if (businessType === 'event') layoutMode = 'event';
      else if (businessType === 'coaching') layoutMode = 'visual';
      else layoutMode = 'emergency';
  }
  
  console.log(`📄 [PDF Generator] Layout Mode: ${layoutMode}`);
  
  if (layoutMode === 'event') {
    return generateEventPDF(data, PDFDocument, businessData);
  }
  if (layoutMode === 'visual') {
    // Use Coaching PDF generator for Visual/Portfolio mode (similar structure)
    return generateCoachingPDF(data, PDFDocument, businessData);
  }
  // Default to Emergency (Local Service)
  return generateLocalServicePDF(data, PDFDocument, businessData);
}

/**
 * Generate PDF for Coaches, Consultants, and Online Experts
 * Focus: Authority positioning, transformation stories, NO discounts
 */
async function generateCoachingPDF(data, PDFDocument, businessData = {}) {
  // Generate QR code first (for booking calendar)
  const qrUrl = businessData.bookingUrl || businessData.calendarUrl || businessData.landingPageUrl || `https://${businessData.subdomain || 'booking'}.launchfly.app`;
  let qrBuffer = null;
  
  try {
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 90,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' }
    });
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    qrBuffer = Buffer.from(qrBase64, 'base64');
  } catch (qrError) {
    console.error('QR code generation failed:', qrError);
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'letter',
        bufferPages: true,
        compress: true
      });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Color scheme (Purple/Violet - premium coaching feel)
      const colors = {
        primary: '#7c3aed',    // Violet
        secondary: '#a855f7',  // Purple
        accent: '#c084fc',     // Light purple
        dark: '#1e1b4b',       // Dark indigo
        gray: '#64748b',
        light: '#f5f3ff',      // Light violet
        success: '#10b981',
        gold: '#f59e0b'        // For testimonials
      };

      const pdfContent = data.pdfContent || {};
      const coachName = businessData.businessName || businessData.coachName || 'Expert Coach';
      const niche = businessData.niche || 'Coaching';
      const phone = businessData.phone || '';
      const email = businessData.email || '';
      const calendarUrl = businessData.calendarUrl || businessData.bookingUrl || '';

      // Helper to add footer to every page
      const addFooter = () => {
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.fontSize(9)
           .fillColor(colors.gray)
           .text(`© ${new Date().getFullYear()} ${coachName} • All Rights Reserved`, 50, doc.page.height - 40, {
             width: doc.page.width - 100,
             align: 'center'
           });
        doc.page.margins.bottom = bottom;
      };

      // ============ PAGE 1: COVER PAGE ============
      doc.rect(0, 0, 612, 350).fill(colors.primary);
      
      doc.fillColor('#ffffff')
         .fontSize(32)
         .font('Helvetica-Bold')
         .text(data.title || 'Your Expert Blueprint', 50, 80, { 
           width: 512, 
           align: 'center' 
         });
      
      doc.fontSize(14)
         .font('Helvetica')
         .text(pdfContent.cover_tagline || `The proven framework to transform your ${niche.toLowerCase()} results`, 50, 160, { 
           width: 512, 
           align: 'center' 
         });

      doc.strokeColor('#ffffff').lineWidth(2)
         .moveTo(200, 200).lineTo(412, 200).stroke();

      doc.fillColor('#ffffff')
         .fontSize(14)
         .font('Helvetica-Oblique')
         .text(`By ${coachName}`, 50, 230, { 
           width: 512, 
           align: 'center' 
         });

      doc.fontSize(12)
         .text(`${new Date().getFullYear()} Edition`, 50, 260, { 
           width: 512, 
           align: 'center' 
         });

      doc.fillColor(colors.dark)
         .fontSize(11)
         .font('Helvetica')
         .text('Your step-by-step guide to achieving breakthrough results', 50, 400, { 
           width: 512, 
           align: 'center' 
         });
      
      addFooter();

      // ============ PAGE 2: THE BIG PROMISE + WHO THIS IS FOR ============
      doc.addPage();
      addFooter();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('What You Will Discover', 50, 50);
      
      doc.strokeColor(colors.accent).lineWidth(3)
         .moveTo(50, 85).lineTo(280, 85).stroke();

      const introText = pdfContent.intro || 
        `This guide was created for ambitious individuals who are ready to take their ${niche.toLowerCase()} to the next level. ` +
        `Inside, you'll discover the exact framework I've used to help hundreds of clients achieve transformational results.`;

      doc.fillColor(colors.dark)
         .fontSize(13)
         .font('Helvetica')
         .text(introText, 50, 110, { 
           width: 512, 
           align: 'left',
           lineGap: 6
         });

      // "This Guide Is For You If..." box
      doc.rect(50, 200, 512, 180).fillAndStroke(colors.light, colors.secondary);
      
      doc.fillColor(colors.primary)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('This Guide Is Perfect For You If...', 70, 220);

      const forYouItems = pdfContent.for_you_if || [
        `You're ready to accelerate your ${niche.toLowerCase()} journey`,
        'You want a proven framework instead of guessing',
        'You value transformation over quick fixes',
        `You're committed to taking action on what you learn`
      ];

      forYouItems.forEach((item, i) => {
        doc.fillColor(colors.success).fontSize(14).text('✓', 70, 255 + (i * 25));
        doc.fillColor(colors.dark)
           .fontSize(12)
           .font('Helvetica')
           .text(item, 90, 255 + (i * 25));
      });

      doc.fillColor(colors.gray)
         .fontSize(10)
         .font('Helvetica-Oblique')
         .text('Let\'s dive in and start your transformation...', 50, 400, {
           width: 512,
           align: 'center'
         });

      // ============ PAGE 3: ABOUT THE EXPERT ============
      doc.addPage();
      addFooter();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('Meet Your Guide', 50, 50);
      
      doc.strokeColor(colors.accent).lineWidth(3)
         .moveTo(50, 85).lineTo(200, 85).stroke();

      const authorityBio = pdfContent.authority_bio || 
        `${coachName} is a recognized expert in ${niche.toLowerCase()} with years of experience helping clients achieve breakthrough results. ` +
        `Through a unique combination of proven strategies and personalized guidance, ${coachName.split(' ')[0]} has helped hundreds of clients transform their lives.`;

      doc.fillColor(colors.dark)
         .fontSize(13)
         .font('Helvetica')
         .text(authorityBio, 50, 110, { 
           width: 512, 
           align: 'left',
           lineGap: 6
         });

      // Credentials/Results box
      doc.rect(50, 250, 512, 120).fillAndStroke(colors.light, colors.secondary);
      
      doc.fillColor(colors.primary)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('Track Record:', 70, 270);

      const credentials = pdfContent.credentials || [
        'Helped 500+ clients achieve their goals',
        'Featured in industry publications',
        'Certified and experienced professional',
        'Proven methodology with real results'
      ];

      credentials.slice(0, 4).forEach((cred, i) => {
        doc.fillColor(colors.gold).fontSize(12).text('★', 70, 300 + (i * 20));
        doc.fillColor(colors.dark)
           .fontSize(11)
           .font('Helvetica')
           .text(cred, 90, 300 + (i * 20));
      });

      // ============ PAGE 4: THE FRAMEWORK ============
      doc.addPage();
      addFooter();
      
      const frameworkName = pdfContent.framework_name || `The ${niche} Transformation Framework`;
      
      doc.fillColor(colors.primary)
         .fontSize(22)
         .font('Helvetica-Bold')
         .text(frameworkName, 50, 50);
      
      doc.strokeColor(colors.accent).lineWidth(3)
         .moveTo(50, 85).lineTo(350, 85).stroke();

      doc.fillColor(colors.gray)
         .fontSize(11)
         .font('Helvetica-Oblique')
         .text('The proven step-by-step process for achieving results', 50, 100);

      const frameworkSteps = pdfContent.framework_steps || [
        { step: 1, title: 'Assess', description: 'Understand where you are now and clarify your goals' },
        { step: 2, title: 'Plan', description: 'Create a customized roadmap for your transformation' },
        { step: 3, title: 'Execute', description: 'Take consistent action with expert guidance' },
        { step: 4, title: 'Optimize', description: 'Refine your approach based on results' },
        { step: 5, title: 'Scale', description: 'Amplify your success and maintain momentum' }
      ];

      let yPos = 130;
      frameworkSteps.slice(0, 5).forEach((step, i) => {
        // Step number circle
        doc.circle(75, yPos + 20, 20).fill(colors.primary);
        doc.fillColor('#ffffff')
           .fontSize(16)
           .font('Helvetica-Bold')
           .text(`${step.step || i + 1}`, 68, yPos + 13);

        doc.fillColor(colors.dark)
           .fontSize(14)
           .font('Helvetica-Bold')
           .text(step.title, 110, yPos + 5);
        
        doc.fillColor(colors.gray)
           .fontSize(11)
           .font('Helvetica')
           .text(step.description, 110, yPos + 25, { width: 440 });

        yPos += 70;
      });

      // ============ PAGE 5: QUICK WINS ============
      doc.addPage();
      addFooter();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('Quick Wins You Can Implement Today', 50, 50);
      
      doc.strokeColor(colors.success).lineWidth(3)
         .moveTo(50, 85).lineTo(350, 85).stroke();

      doc.fillColor(colors.gray)
         .fontSize(11)
         .font('Helvetica-Oblique')
         .text('Start seeing results immediately with these actionable strategies', 50, 100);

      const quickWins = pdfContent.quick_wins || pdfContent.quick_tips || [
        { title: 'Set Clear Intentions', description: 'Define exactly what success looks like for you in the next 90 days' },
        { title: 'Identify Your Blocks', description: 'Recognize the patterns holding you back from your goals' },
        { title: 'Take Imperfect Action', description: 'Start before you feel ready - progress beats perfection' },
        { title: 'Build Your Environment', description: 'Surround yourself with people and resources that support your goals' },
        { title: 'Track Your Progress', description: 'What gets measured gets improved - journal your wins daily' }
      ];

      yPos = 130;
      quickWins.slice(0, 5).forEach((tip, i) => {
        doc.rect(50, yPos - 5, 25, 25).fill(colors.success);
        doc.fillColor('#ffffff')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('✓', 57, yPos);

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

      // ============ PAGE 6: CLIENT TRANSFORMATION STORY ============
      doc.addPage();
      addFooter();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('Client Success Story', 50, 50);
      
      doc.strokeColor(colors.gold).lineWidth(3)
         .moveTo(50, 85).lineTo(230, 85).stroke();

      const caseStudy = pdfContent.case_study || {
        customer_name: 'Sarah',
        before: 'Struggling to find direction and felt stuck in her career',
        breakthrough: 'Discovered her unique strengths and created a clear action plan',
        after: 'Landed her dream role with a 40% salary increase within 6 months',
        quote: 'This program completely changed my perspective. I finally have clarity and confidence.'
      };

      doc.rect(50, 100, 512, 280).fillAndStroke(colors.light, colors.secondary);

      doc.fillColor(colors.dark)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text(`${caseStudy.customer_name}'s Transformation`, 70, 120);

      // Before
      doc.fillColor(colors.gray)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('BEFORE:', 70, 155);
      doc.fillColor(colors.dark)
         .fontSize(11)
         .font('Helvetica')
         .text(caseStudy.before || caseStudy.problem, 70, 170, { width: 470 });

      // Breakthrough/Solution
      doc.fillColor(colors.primary)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('THE BREAKTHROUGH:', 70, 210);
      doc.fillColor(colors.dark)
         .fontSize(11)
         .font('Helvetica')
         .text(caseStudy.breakthrough || caseStudy.solution, 70, 225, { width: 470 });

      // After/Result
      doc.fillColor(colors.success)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('THE RESULT:', 70, 270);
      doc.fillColor(colors.dark)
         .fontSize(11)
         .font('Helvetica')
         .text(caseStudy.after || caseStudy.result, 70, 285, { width: 470 });

      // Quote
      doc.fillColor(colors.primary)
         .fontSize(13)
         .font('Helvetica-Oblique')
         .text(`"${caseStudy.quote || 'Working with ' + coachName + ' was the best investment I ever made.'}"`, 70, 330, {
           width: 470
         });
      doc.fillColor(colors.gray)
         .fontSize(11)
         .text(`- ${caseStudy.customer_name}, Verified Client`, 70, 360);

      // ============ PAGE 7: ACTION CHECKLIST (NO COUPON) ============
      doc.addPage();
      addFooter();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('Your Next Steps', 50, 50);
      
      doc.strokeColor(colors.success).lineWidth(3)
         .moveTo(50, 85).lineTo(200, 85).stroke();

      doc.fillColor(colors.gray)
         .fontSize(11)
         .font('Helvetica-Oblique')
         .text('Take action today to start your transformation', 50, 100);

      const checklist = pdfContent.action_checklist || [
        'Review this guide and highlight the strategies that resonate most with you',
        'Schedule your free strategy call to create your personalized action plan'
      ];

      checklist.slice(0, 3).forEach((item, i) => {
        doc.rect(50, 130 + (i * 90), 512, 75).fillAndStroke(colors.light, colors.secondary);
        doc.rect(70, 145 + (i * 90), 25, 25).stroke(colors.primary);
        
        doc.fillColor(colors.primary)
           .fontSize(14)
           .font('Helvetica-Bold')
           .text(`Action ${i + 1}`, 110, 140 + (i * 90));
        
        doc.fillColor(colors.dark)
           .fontSize(12)
           .font('Helvetica')
           .text(item, 110, 162 + (i * 90), { width: 430 });
      });

      // "Ready to Go Deeper?" box (instead of coupon)
      doc.rect(50, 350, 512, 120).fillAndStroke(colors.primary, colors.dark);
      
      doc.fillColor('#ffffff')
         .fontSize(18)
         .font('Helvetica-Bold')
         .text('Ready to Accelerate Your Results?', 70, 375, { width: 470, align: 'center' });

      doc.fillColor('#ffffff')
         .fontSize(12)
         .font('Helvetica')
         .text('Book a free strategy call to discover how we can work together', 70, 405, { width: 470, align: 'center' });

      doc.fillColor(colors.gold)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('→ Limited spots available each week', 70, 435, { width: 470, align: 'center' });

      // ============ PAGE 8: CTA + BOOK A CALL + QR CODE ============
      doc.addPage();

      doc.rect(0, 0, 612, 240).fill(colors.primary);
      
      doc.fillColor('#ffffff')
         .fontSize(28)
         .font('Helvetica-Bold')
         .text('Let\'s Work Together', 50, 60, { width: 512, align: 'center' });
      
      doc.fontSize(14)
         .font('Helvetica')
         .text('Your transformation is just one conversation away', 50, 100, { width: 512, align: 'center' });

      doc.fontSize(20)
         .font('Helvetica-Bold')
         .text('Book Your Free Strategy Call', 50, 150, { width: 512, align: 'center' });

      if (calendarUrl) {
        doc.fontSize(12)
           .font('Helvetica')
           .text(calendarUrl, 50, 185, { width: 512, align: 'center' });
      }

      // Contact info
      doc.fillColor(colors.dark)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('Connect With Me', 50, 270);

      doc.strokeColor(colors.accent).lineWidth(2)
         .moveTo(50, 295).lineTo(200, 295).stroke();

      const contactDetails = [
        `Coach: ${coachName}`,
        email ? `Email: ${email}` : null,
        phone ? `Phone: ${phone}` : null,
        businessData.website ? `Website: ${businessData.website}` : null,
        businessData.instagram ? `Instagram: ${businessData.instagram}` : null,
        businessData.linkedin ? `LinkedIn: ${businessData.linkedin}` : null
      ].filter(Boolean);

      yPos = 315;
      contactDetails.forEach(detail => {
        doc.fillColor(colors.dark)
           .fontSize(11)
           .font('Helvetica')
           .text(detail, 50, yPos);
        yPos += 22;
      });

      // QR Code for booking
      doc.rect(380, 270, 170, 170).fillAndStroke(colors.light, colors.secondary);
      doc.fillColor(colors.primary)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('SCAN TO BOOK', 385, 285, { width: 160, align: 'center' });
      
      if (qrBuffer) {
        doc.image(qrBuffer, 420, 310, { width: 90, height: 90 });
      } else {
        doc.rect(420, 310, 90, 90).fillAndStroke('#ffffff', colors.dark);
        doc.fillColor(colors.gray)
           .fontSize(8)
           .text('Visit:', 425, 340, { width: 80, align: 'center' })
           .text(qrUrl.substring(0, 30), 425, 355, { width: 80, align: 'center' });
      }
      
      doc.fillColor(colors.gray)
         .fontSize(9)
         .font('Helvetica')
         .text(qrUrl.length > 35 ? qrUrl.substring(0, 35) + '...' : qrUrl, 385, 410, { width: 160, align: 'center' });
      
      doc.fillColor(colors.gray)
         .fontSize(8)
         .text('Scan with your phone camera', 385, 425, { width: 160, align: 'center' });

      // Testimonial snippet
      doc.rect(50, 460, 250, 80).fillAndStroke(colors.light, colors.secondary);
      doc.fillColor(colors.gold)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('★★★★★', 70, 475);
      doc.fillColor(colors.dark)
         .fontSize(10)
         .font('Helvetica-Oblique')
         .text(`"${coachName} helped me achieve results I never thought possible. Highly recommend!"`, 70, 495, { width: 210 });
      doc.fillColor(colors.gray)
         .fontSize(9)
         .text('- Happy Client', 70, 525);

      // Final CTA
      doc.rect(320, 460, 230, 80).fillAndStroke(colors.primary, colors.dark);
      doc.fillColor('#ffffff')
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('>>> YOUR NEXT STEP', 335, 475);
      doc.fillColor('#ffffff')
         .fontSize(10)
         .font('Helvetica')
         .text('Book your free strategy call', 335, 495, { width: 195 });
      doc.fillColor(colors.gold)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('Start Your Transformation', 335, 515, { width: 195 });

      doc.fillColor(colors.gray)
         .fontSize(9)
         .font('Helvetica')
         .text(`© ${new Date().getFullYear()} ${coachName}. All rights reserved.`, 50, 560, { width: 512, align: 'center' });
      
      doc.fontSize(8)
         .text('Generated with Launchfly', 50, 575, { width: 512, align: 'center' });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Generate PDF for Events, Workshops, Classes, Seminars
 * Focus: Event details, pricing, registration info - NO diagnostic questions or "mistakes"
 */
async function generateEventPDF(data, PDFDocument, businessData = {}) {
  // Generate QR code for registration
  const qrUrl = businessData.registrationUrl || businessData.landingPageUrl || `https://${businessData.subdomain || 'register'}.launchfly.app`;
  let qrBuffer = null;
  
  try {
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 90,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' }
    });
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    qrBuffer = Buffer.from(qrBase64, 'base64');
  } catch (qrError) {
    console.error('QR code generation failed:', qrError);
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'letter',
        bufferPages: true,
        compress: true
      });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Color scheme (Red/Orange - energetic event feel)
      const colors = {
        primary: '#ef4444',    // Red
        secondary: '#f97316',  // Orange
        accent: '#fbbf24',     // Amber
        dark: '#1f2937',       // Dark gray
        gray: '#64748b',
        light: '#fef3c7',      // Light amber
        success: '#10b981',
        white: '#ffffff'
      };

      const pdfContent = data.pdfContent || {};
      const eventDetails = pdfContent.event_details || {};
      const hostName = businessData.businessName || businessData.hostName || 'Event Host';
      const eventName = data.event_name || pdfContent.event_name || businessData.eventName || 'Special Event';
      const eventDate = data.event_date || eventDetails.date || businessData.eventDate || 'Coming Soon';
      const eventTime = data.event_time || eventDetails.time || businessData.eventTime || '';
      const venue = data.venue || eventDetails.venue || businessData.venue || '';
      const pricing = eventDetails.pricing || {};
      const phone = businessData.phone || '';
      const email = businessData.email || '';

      // ============ PAGE 1: COVER PAGE ============
      doc.rect(0, 0, 612, 792).fill(colors.primary);
      
      // White content area
      doc.rect(30, 30, 552, 732).fill(colors.white);
      
      // Event date badge (top)
      doc.rect(50, 50, 512, 60).fill(colors.secondary);
      doc.fillColor(colors.white)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text(`📅 ${eventDate}`, 50, 68, { width: 512, align: 'center' });
      
      // Event name
      doc.fillColor(colors.dark)
         .fontSize(32)
         .font('Helvetica-Bold')
         .text(eventName, 50, 140, { width: 512, align: 'center' });
      
      // Time and Venue
      if (eventTime || venue) {
        doc.fillColor(colors.gray)
           .fontSize(16)
           .font('Helvetica')
           .text(`⏰ ${eventTime}${venue ? `  📍 ${venue}` : ''}`, 50, 200, { width: 512, align: 'center' });
      }
      
      // Pricing box
      doc.rect(150, 250, 312, 100).fillAndStroke(colors.light, colors.secondary);
      doc.fillColor(colors.dark)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('REGISTRATION', 150, 265, { width: 312, align: 'center' });
      
      const individualPrice = pricing.individual || data.conversion_offer?.headline || 'Register Now';
      const groupPrice = pricing.group || data.conversion_offer?.subheadline || '';
      
      doc.fillColor(colors.primary)
         .fontSize(28)
         .font('Helvetica-Bold')
         .text(individualPrice, 150, 290, { width: 312, align: 'center' });
      
      if (groupPrice) {
        doc.fillColor(colors.gray)
           .fontSize(12)
           .font('Helvetica')
           .text(groupPrice, 150, 325, { width: 312, align: 'center' });
      }
      
      // Tagline
      doc.fillColor(colors.gray)
         .fontSize(14)
         .font('Helvetica')
         .text(pdfContent.cover_tagline || `Join us for an unforgettable experience!`, 50, 380, { width: 512, align: 'center' });
      
      // Hosted by
      doc.fillColor(colors.dark)
         .fontSize(12)
         .font('Helvetica')
         .text(`Hosted by ${hostName}`, 50, 420, { width: 512, align: 'center' });
      
      // QR Code (bottom right)
      if (qrBuffer) {
        doc.image(qrBuffer, 470, 650, { width: 90 });
        doc.fillColor(colors.gray)
           .fontSize(8)
           .text('Scan to Register', 470, 745, { width: 90, align: 'center' });
      }

      // ============ PAGE 2: WHAT YOU'LL EXPERIENCE ============
      doc.addPage();
      doc.rect(0, 0, 612, 80).fill(colors.secondary);
      doc.fillColor(colors.white)
         .fontSize(20)
         .font('Helvetica-Bold')
         .text('What You\'ll Experience', 50, 35, { width: 512, align: 'center' });
      
      const whatToExpect = pdfContent.what_to_expect || [];
      let yPos = 110;
      
      if (whatToExpect.length > 0) {
        whatToExpect.forEach((item, index) => {
          doc.rect(50, yPos, 512, 60).fillAndStroke(colors.light, colors.secondary);
          doc.fillColor(colors.primary)
             .fontSize(14)
             .font('Helvetica-Bold')
             .text(`${index + 1}. ${item.title}`, 65, yPos + 12);
          doc.fillColor(colors.gray)
             .fontSize(11)
             .font('Helvetica')
             .text(item.description || '', 65, yPos + 32, { width: 480 });
          yPos += 70;
        });
      } else {
        // Fallback content
        const defaultExperiences = [
          { title: 'Expert Instruction', description: 'Learn from professionals with years of experience' },
          { title: 'Hands-On Practice', description: 'Apply what you learn in a supportive environment' },
          { title: 'Community Connection', description: 'Meet like-minded people and grow your network' },
          { title: 'Fun & Engagement', description: 'Enjoy an energetic, memorable experience' }
        ];
        defaultExperiences.forEach((item, index) => {
          doc.rect(50, yPos, 512, 60).fillAndStroke(colors.light, colors.secondary);
          doc.fillColor(colors.primary)
             .fontSize(14)
             .font('Helvetica-Bold')
             .text(`${index + 1}. ${item.title}`, 65, yPos + 12);
          doc.fillColor(colors.gray)
             .fontSize(11)
             .font('Helvetica')
             .text(item.description, 65, yPos + 32, { width: 480 });
          yPos += 70;
        });
      }
      
      // Who is this for section
      const whoIsFor = pdfContent.who_is_this_for || [];
      if (whoIsFor.length > 0) {
        yPos += 20;
        doc.fillColor(colors.dark)
           .fontSize(16)
           .font('Helvetica-Bold')
           .text('This Event Is Perfect For:', 50, yPos);
        yPos += 25;
        
        whoIsFor.forEach(item => {
          doc.fillColor(colors.success)
             .fontSize(12)
             .text(`✓ ${typeof item === 'string' ? item : item.description || item}`, 70, yPos);
          yPos += 20;
        });
      }

      // ============ PAGE 3: MEET THE INSTRUCTOR ============
      doc.addPage();
      doc.rect(0, 0, 612, 80).fill(colors.primary);
      doc.fillColor(colors.white)
         .fontSize(20)
         .font('Helvetica-Bold')
         .text('Meet Your Instructor', 50, 35, { width: 512, align: 'center' });
      
      const instructorBio = pdfContent.instructor_bio || `Join us for this special event hosted by ${hostName}. Our instructors bring passion and expertise to every session.`;
      
      doc.rect(50, 100, 512, 200).fillAndStroke(colors.light, colors.secondary);
      doc.fillColor(colors.dark)
         .fontSize(12)
         .font('Helvetica')
         .text(instructorBio, 70, 120, { width: 470 });
      
      // Testimonials from past events
      const testimonials = pdfContent.testimonials || [];
      if (testimonials.length > 0) {
        doc.fillColor(colors.dark)
           .fontSize(16)
           .font('Helvetica-Bold')
           .text('What Past Attendees Say', 50, 330);
        
        let testY = 360;
        testimonials.slice(0, 3).forEach(t => {
          doc.rect(50, testY, 512, 70).fillAndStroke(colors.white, colors.gray);
          doc.fillColor(colors.dark)
             .fontSize(11)
             .font('Helvetica')
             .text(`"${t.quote}"`, 70, testY + 15, { width: 470 });
          doc.fillColor(colors.gray)
             .fontSize(10)
             .font('Helvetica-Bold')
             .text(`- ${t.name}`, 70, testY + 50);
          testY += 80;
        });
      }

      // ============ PAGE 4: FAQ & REGISTRATION ============
      doc.addPage();
      doc.rect(0, 0, 612, 80).fill(colors.secondary);
      doc.fillColor(colors.white)
         .fontSize(20)
         .font('Helvetica-Bold')
         .text('Frequently Asked Questions', 50, 35, { width: 512, align: 'center' });
      
      const faq = pdfContent.faq || [];
      yPos = 110;
      
      const defaultFaq = [
        { question: 'What should I bring?', answer: 'Just yourself and a positive attitude! Wear comfortable clothes.' },
        { question: 'Do I need prior experience?', answer: 'No experience needed. All levels are welcome!' },
        { question: 'Can I bring a friend?', answer: 'Absolutely! Check our group pricing for discounts.' },
        { question: 'What if I need to cancel?', answer: 'Contact us at least 24 hours before for a full refund.' }
      ];
      
      (faq.length > 0 ? faq : defaultFaq).slice(0, 5).forEach(item => {
        doc.fillColor(colors.primary)
           .fontSize(13)
           .font('Helvetica-Bold')
           .text(`Q: ${item.question}`, 50, yPos);
        yPos += 18;
        doc.fillColor(colors.gray)
           .fontSize(11)
           .font('Helvetica')
           .text(`A: ${item.answer}`, 70, yPos, { width: 490 });
        yPos += 35;
      });
      
      // Registration info box
      const regInfo = pdfContent.registration_info || {};
      doc.rect(50, 480, 512, 150).fillAndStroke(colors.primary, colors.dark);
      doc.fillColor(colors.white)
         .fontSize(18)
         .font('Helvetica-Bold')
         .text('🎟️ SECURE YOUR SPOT NOW', 50, 500, { width: 512, align: 'center' });
      
      doc.fillColor(colors.white)
         .fontSize(12)
         .font('Helvetica')
         .text(`📅 Date: ${eventDate}`, 100, 540);
      doc.text(`⏰ Time: ${eventTime}`, 100, 560);
      doc.text(`📍 Venue: ${venue}`, 100, 580);
      doc.text(`💰 Price: ${individualPrice}${groupPrice ? ` | ${groupPrice}` : ''}`, 100, 600);
      
      // Contact info
      if (phone || email) {
        doc.fillColor(colors.accent)
           .fontSize(11)
           .font('Helvetica-Bold');
        if (phone) doc.text(`📞 WhatsApp: ${phone}`, 350, 560);
        if (email) doc.text(`✉️ Email: ${email}`, 350, 580);
      }
      
      // QR code on last page
      if (qrBuffer) {
        doc.image(qrBuffer, 470, 680, { width: 80 });
        doc.fillColor(colors.gray)
           .fontSize(8)
           .text('Scan to Register', 470, 765, { width: 80, align: 'center' });
      }
      
      doc.fillColor(colors.gray)
         .fontSize(9)
         .font('Helvetica')
         .text(`© ${new Date().getFullYear()} ${hostName}. All rights reserved.`, 50, 680, { width: 400, align: 'left' });
      
      doc.fontSize(8)
         .text('Generated with Launchfly', 50, 695);

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Generate PDF for Local Service Businesses (Plumbers, HVAC, Cleaners, etc.)
 * Focus: Diagnostic checklist, price guides, coupons
 */
async function generateLocalServicePDF(data, PDFDocument, businessData = {}) {
  // Generate QR code first (before entering Promise)
  const qrUrl = businessData.bookingUrl || businessData.landingPageUrl || `https://${businessData.subdomain || 'booking'}.launchfly.app`;
  let qrBuffer = null;
  
  try {
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 90,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    qrBuffer = Buffer.from(qrBase64, 'base64');
  } catch (qrError) {
    console.error('QR code generation failed:', qrError);
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'letter',
        bufferPages: true,
        compress: true // Keep file size under 2MB for mobile
      });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Color scheme (professional blue - trust-building for local businesses)
      const colors = {
        primary: '#1e40af',
        secondary: '#3b82f6', 
        accent: '#0ea5e9',
        dark: '#0f172a',
        gray: '#64748b',
        light: '#f1f5f9',
        success: '#10b981',
        warning: '#f59e0b',
        coupon: '#dc2626' // Red for urgency/offers
      };

      const pdfContent = data.pdfContent || {};
      const niche = businessData.niche || 'Service';
      const businessName = businessData.businessName || 'Local Business';
      const phone = businessData.phone || '';
      const city = businessData.city || 'your area';
      const whatsapp = businessData.whatsapp || phone;
      const landingPageUrl = businessData.landingPageUrl || '';
      const currency = businessData.currency || '$'; // Support RM, S$, etc.

      // Helper to add footer to every page
      const addFooter = () => {
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.fontSize(9)
           .fillColor(colors.gray)
           .text(`Presented by ${businessName} • ${phone || city}`, 50, doc.page.height - 40, {
             width: doc.page.width - 100,
             align: 'center'
           });
        doc.page.margins.bottom = bottom;
      };

      // ============ PAGE 1: COVER PAGE ============
      doc.rect(0, 0, 612, 350).fill(colors.primary);
      
      doc.fillColor('#ffffff')
         .fontSize(32)
         .font('Helvetica-Bold')
         .text(data.title || 'Your Expert Guide', 50, 80, { 
           width: 512, 
           align: 'center' 
         });
      
      doc.fontSize(14)
         .font('Helvetica')
         .text(pdfContent.cover_tagline || `Everything you need to know about ${niche.toLowerCase()} in ${city}`, 50, 160, { 
           width: 512, 
           align: 'center' 
         });

      doc.strokeColor('#ffffff').lineWidth(2)
         .moveTo(200, 200).lineTo(412, 200).stroke();

      doc.fillColor('#ffffff')
         .fontSize(14)
         .font('Helvetica-Oblique')
         .text(`Free Guide from ${businessName}`, 50, 230, { 
           width: 512, 
           align: 'center' 
         });

      doc.fontSize(12)
         .text(`${new Date().getFullYear()} Edition`, 50, 260, { 
           width: 512, 
           align: 'center' 
         });

      doc.fillColor(colors.dark)
         .fontSize(11)
         .font('Helvetica')
         .text('5-minute read | Actionable tips | Money-saving advice', 50, 400, { 
           width: 512, 
           align: 'center' 
         });
      
      addFooter();

      // ============ PAGE 2: QUICK DIAGNOSTIC (3-Question Self-Assessment) ============
      doc.addPage();
      addFooter();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('Quick Self-Assessment', 50, 50);
      
      doc.strokeColor(colors.accent).lineWidth(3)
         .moveTo(50, 85).lineTo(230, 85).stroke();

      doc.fillColor(colors.gray)
         .fontSize(12)
         .font('Helvetica-Oblique')
         .text('Answer these 3 questions to know if you need professional help:', 50, 100);

      // Diagnostic questions with checkboxes
      const diagnosticQuestions = pdfContent.diagnostic_questions || [
        { 
          question: `Have you noticed any unusual signs with your ${niche.toLowerCase()} system in the last month?`,
          yes_action: 'Schedule an inspection soon',
          no_action: 'Keep monitoring regularly'
        },
        { 
          question: `Has it been more than 12 months since your last professional ${niche.toLowerCase()} check-up?`,
          yes_action: 'Consider a maintenance visit',
          no_action: 'You\'re on track!'
        },
        { 
          question: `Are you experiencing any performance issues or higher-than-normal costs?`,
          yes_action: 'Call us for a free consultation',
          no_action: 'Great! Keep these tips handy'
        }
      ];

      let diagY = 140;
      diagnosticQuestions.forEach((dq, i) => {
        // Question box
        doc.rect(50, diagY, 512, 85).fillAndStroke(i % 2 === 0 ? colors.light : '#ffffff', colors.secondary);
        
        doc.fillColor(colors.primary)
           .fontSize(14)
           .font('Helvetica-Bold')
           .text(`Question ${i + 1}:`, 70, diagY + 15);
        
        doc.fillColor(colors.dark)
           .fontSize(12)
           .font('Helvetica')
           .text(dq.question, 70, diagY + 35, { width: 470 });
        
        // Yes/No checkboxes
        doc.rect(70, diagY + 60, 12, 12).stroke(colors.gray);
        doc.fillColor(colors.success).fontSize(10).text('YES → ' + dq.yes_action, 90, diagY + 62);
        
        doc.rect(300, diagY + 60, 12, 12).stroke(colors.gray);
        doc.fillColor(colors.gray).fontSize(10).text('NO → ' + dq.no_action, 320, diagY + 62);
        
        diagY += 95;
      });

      // Result box
      doc.rect(50, diagY + 20, 512, 80).fillAndStroke('#fef3c7', colors.warning);
      doc.fillColor(colors.warning)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('[CHECK] YOUR RESULT', 70, diagY + 35);
      doc.fillColor(colors.dark)
         .fontSize(11)
         .font('Helvetica')
         .text(`If you answered YES to any question, you may benefit from a free ${niche.toLowerCase()} inspection.`, 70, diagY + 55, { width: 470 });
      doc.fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text(`Call ${businessName}: ${phone || 'See last page for contact'}`, 70, diagY + 75);

      // ============ PAGE 3: INTRODUCTION ============
      doc.addPage();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('Why This Guide Exists', 50, 50);
      
      doc.strokeColor(colors.accent).lineWidth(3)
         .moveTo(50, 85).lineTo(200, 85).stroke();

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
        doc.circle(65, yPos + 12, 12).fill(colors.warning);
        doc.fillColor('#ffffff')
           .fontSize(12)
           .font('Helvetica-Bold')
           .text(`${i + 1}`, 60, yPos + 6);

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

      // ============ PAGE 4: QUICK TIPS ============
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
        doc.rect(50, yPos - 5, 25, 25).fill(colors.success);
        doc.fillColor('#ffffff')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('>', 57, yPos);

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

      doc.rect(50, yPos + 20, 512, 60).fillAndStroke('#fef3c7', colors.warning);
      doc.fillColor(colors.warning)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('PRO TIP', 70, yPos + 35);
      doc.fillColor(colors.dark)
         .fontSize(11)
         .font('Helvetica')
         .text(`When in doubt, call a professional. A quick inspection is much cheaper than fixing DIY mistakes. At ${businessName}, we offer free estimates.`, 70, yPos + 52, { width: 470 });

      // ============ PAGE 5: CASE STUDY ============
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

      doc.fillColor(colors.primary)
         .fontSize(13)
         .font('Helvetica-Oblique')
         .text(`"I wish I had found ${businessName} sooner. They saved me time and money!"`, 70, 330, {
           width: 470
         });
      doc.fillColor(colors.gray)
         .fontSize(11)
         .text(`- ${caseStudy.customer_name}, Verified Customer`, 70, 360);

      // ============ PAGE 6: ACTION CHECKLIST + COUPON ============
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
        doc.rect(50, 130 + (i * 80), 35, 35).stroke(colors.primary);
        
        doc.fillColor(colors.dark)
           .fontSize(14)
           .font('Helvetica-Bold')
           .text(`Step ${i + 1}`, 100, 135 + (i * 80));
        
        doc.fillColor(colors.dark)
           .fontSize(11)
           .font('Helvetica')
           .text(item, 100, 155 + (i * 80), { width: 450 });
      });

      // ===== COUPON / VOUCHER SECTION =====
      const couponCode = pdfContent.coupon_code || 'GUIDE15';
      const couponOffer = pdfContent.coupon_offer || '15% OFF Your First Service';
      const couponExpiry = pdfContent.coupon_expiry || '7 days from download';
      
      // Coupon border with dashed line effect
      doc.rect(50, 320, 512, 140).fillAndStroke('#fef2f2', colors.coupon);
      
      // Dashed inner border for "cut here" effect
      doc.save()
         .strokeColor(colors.coupon)
         .lineWidth(1)
         .dash(5, { space: 3 })
         .rect(60, 330, 492, 120)
         .stroke()
         .restore();

      // Dashed cut line
      doc.fillColor(colors.coupon)
         .fontSize(10)
         .text('- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -', 70, 315, { width: 470, align: 'center' });

      doc.fillColor(colors.coupon)
         .fontSize(20)
         .font('Helvetica-Bold')
         .text('*** EXCLUSIVE OFFER ***', 70, 350, { width: 470, align: 'center' });

      doc.fillColor(colors.dark)
         .fontSize(18)
         .font('Helvetica-Bold')
         .text(couponOffer, 70, 380, { width: 470, align: 'center' });

      // Coupon code box
      doc.rect(200, 405, 212, 35).fillAndStroke('#ffffff', colors.primary);
      doc.fillColor(colors.primary)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text(`CODE: ${couponCode}`, 206, 413, { width: 200, align: 'center' });

      doc.fillColor(colors.gray)
         .fontSize(10)
         .font('Helvetica-Oblique')
         .text(`Valid for ${couponExpiry} | Show this page or mention code when calling`, 70, 445, { width: 470, align: 'center' });

      // Quick contact box
      doc.rect(50, 480, 512, 60).fillAndStroke(colors.light, colors.secondary);
      doc.fillColor(colors.primary)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('>> Ready to claim your discount?', 70, 495);
      doc.fillColor(colors.dark)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(phone ? `Call now: ${phone}` : `Visit: ${landingPageUrl || 'our website'}`, 70, 515);
      
      if (whatsapp) {
        doc.fillColor(colors.success)
           .fontSize(11)
           .text(`WhatsApp: ${whatsapp}`, 350, 515);
      }

      // ============ PAGE 7: PRICING GUIDE ============
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
        { service: 'Basic inspection', range: `${currency}50 - ${currency}150` },
        { service: 'Minor repairs', range: `${currency}100 - ${currency}300` },
        { service: 'Medium repairs', range: `${currency}300 - ${currency}800` },
        { service: 'Major repairs', range: `${currency}800 - ${currency}2,000+` },
        { service: 'Full replacement', range: `${currency}2,000 - ${currency}10,000+` }
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

      // ============ PAGE 8: CTA + CONTACT + QR CODE ============
      doc.addPage();

      doc.rect(0, 0, 612, 240).fill(colors.primary);
      
      doc.fillColor('#ffffff')
         .fontSize(28)
         .font('Helvetica-Bold')
         .text('Ready to Get Started?', 50, 60, { width: 512, align: 'center' });
      
      doc.fontSize(14)
         .font('Helvetica')
         .text(`Contact ${businessName} today for a free consultation`, 50, 100, { width: 512, align: 'center' });

      if (phone) {
        doc.fontSize(28)
           .font('Helvetica-Bold')
           .text(`CALL: ${phone}`, 50, 140, { width: 512, align: 'center' });
      }

      // WhatsApp CTA if available
      if (whatsapp) {
        doc.fontSize(16)
           .font('Helvetica')
           .text(`WhatsApp: ${whatsapp}`, 50, 185, { width: 512, align: 'center' });
      }

      // Two-column layout: Contact info + QR Code placeholder
      doc.fillColor(colors.dark)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('Contact Information', 50, 270);

      doc.strokeColor(colors.accent).lineWidth(2)
         .moveTo(50, 295).lineTo(200, 295).stroke();

      const contactDetails = [
        `Business: ${businessName}`,
        phone ? `Phone: ${phone}` : null,
        whatsapp && whatsapp !== phone ? `WhatsApp: ${whatsapp}` : null,
        businessData.email ? `Email: ${businessData.email}` : null,
        businessData.address ? `Address: ${businessData.address}` : `Service Area: ${city}`,
        businessData.hours ? `Hours: ${businessData.hours}` : 'Hours: Mon-Fri 8am-6pm, Sat 9am-2pm'
      ].filter(Boolean);

      yPos = 315;
      contactDetails.forEach(detail => {
        doc.fillColor(colors.dark)
           .fontSize(11)
           .font('Helvetica')
           .text(detail, 50, yPos);
        yPos += 22;
      });

      // QR Code placeholder box (for scanning to landing page)
      doc.rect(380, 270, 170, 170).fillAndStroke(colors.light, colors.secondary);
      doc.fillColor(colors.primary)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('SCAN TO BOOK', 385, 285, { width: 160, align: 'center' });
      
      // Use pre-generated QR code buffer
      if (qrBuffer) {
        doc.image(qrBuffer, 420, 310, { width: 90, height: 90 });
      } else {
        // Fallback: show URL text if QR generation failed
        doc.rect(420, 310, 90, 90).fillAndStroke('#ffffff', colors.dark);
        doc.fillColor(colors.gray)
           .fontSize(8)
           .text('Visit:', 425, 340, { width: 80, align: 'center' })
           .text(qrUrl.substring(0, 30), 425, 355, { width: 80, align: 'center' });
      }
      
      doc.fillColor(colors.gray)
         .fontSize(9)
         .font('Helvetica')
         .text(qrUrl.length > 35 ? qrUrl.substring(0, 35) + '...' : qrUrl, 385, 410, { width: 160, align: 'center' });
      
      doc.fillColor(colors.gray)
         .fontSize(8)
         .text('Scan with your phone camera', 385, 425, { width: 160, align: 'center' });

      // Testimonial box
      doc.rect(50, 460, 250, 80).fillAndStroke(colors.light, colors.secondary);
      doc.fillColor(colors.warning)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('*****', 70, 475);
      doc.fillColor(colors.dark)
         .fontSize(10)
         .font('Helvetica-Oblique')
         .text(`"${businessName} saved us so much hassle. Professional, honest, and affordable!"`, 70, 495, { width: 210 });
      doc.fillColor(colors.gray)
         .fontSize(9)
         .text('- Happy Customer', 70, 525);

      // Reminder coupon code
      doc.rect(320, 460, 230, 80).fillAndStroke('#fef2f2', colors.coupon);
      doc.fillColor(colors.coupon)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('>>> DON\'T FORGET!', 335, 475);
      doc.fillColor(colors.dark)
         .fontSize(10)
         .font('Helvetica')
         .text(`Use code ${pdfContent.coupon_code || 'GUIDE15'} for`, 335, 495, { width: 195 });
      doc.fillColor(colors.coupon)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(pdfContent.coupon_offer || '15% OFF', 335, 510, { width: 195 });
      doc.fillColor(colors.gray)
         .fontSize(9)
         .text(`Expires: ${pdfContent.coupon_expiry || '7 days'}`, 335, 528);

      doc.fillColor(colors.gray)
         .fontSize(9)
         .font('Helvetica')
         .text(`© ${new Date().getFullYear()} ${businessName}. All rights reserved.`, 50, 560, { width: 512, align: 'center' });
      
      doc.fontSize(8)
         .text('Generated with care by Launchfly', 50, 575, { width: 512, align: 'center' });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
