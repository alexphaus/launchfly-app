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
  
  // Fallback logic if layout_mode is missing (Robust Keyword Detection)
  if (!layoutMode) {
      // 1. Check explicit businessType
      const businessType = businessData.businessType;
      if (businessType === 'event') layoutMode = 'event';
      else if (businessType === 'coaching') layoutMode = 'visual';
      
      // 2. If still unknown, check keywords in Niche and Title
      if (!layoutMode) {
          const combinedText = `${businessData.niche || ''} ${data.title || ''} ${JSON.stringify(data.pdfContent || {})}`.toLowerCase();
          
          // SERVICE keywords get highest priority (check FIRST)
          const serviceKeywords = ['plumb', 'plumber', 'plumbing', 'electrician', 'electric', 'hvac', 'repair', 'contractor', 'handyman', 'homefix', 'locksmith', 'roofing', 'cleaning', 'pest', 'moving', 'towing', 'emergency', 'paip', 'bocor'];
          
          if (serviceKeywords.some(k => combinedText.includes(k))) {
              layoutMode = 'emergency'; // Service businesses get blue layout
          } else {
              // EVENT keywords (only if NOT a service business)
              const eventKeywords = ['event', 'workshop', 'webinar', 'seminar', 'conference', 'summit', 'ticket', 'zumba', 'yoga class', 'fitness class', 'master class', 'masterclass', 'bootcamp', 'retreat'];
              const visualKeywords = ['design', 'decor', 'art', 'photo', 'salon', 'beauty', 'style', 'fashion', 'architect', 'coach', 'consult'];
              
              if (eventKeywords.some(k => combinedText.includes(k))) {
                  layoutMode = 'event';
              } else if (visualKeywords.some(k => combinedText.includes(k))) {
                  layoutMode = 'visual';
              } else {
                  layoutMode = 'emergency'; // Default to Service/Emergency
              }
          }
      }
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
      
      // Extract event details from multiple possible paths
      const eventDetails = pdfContent.event_details || {};
      const hostName = businessData.businessName || businessData.hostName || 'Event Host';
      const eventName = pdfContent.event_name || data.event_name || data.title || businessData.eventName || 'Special Event';
      const eventDate = eventDetails.date || pdfContent.event_date || data.event_date || businessData.eventDate || 'Coming Soon';
      const eventTime = eventDetails.time || pdfContent.event_time || data.event_time || businessData.eventTime || '';
      const venue = eventDetails.venue || pdfContent.venue || data.venue || businessData.venue || '';
      const pricing = eventDetails.pricing || pdfContent.pricing || {};
      const phone = businessData.phone || '';
      const email = businessData.email || '';
      
      console.log(`📄 [Event PDF] Event: ${eventName}, Date: ${eventDate}, Venue: ${venue}`);

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
      const designPrefs = businessData.design_preferences || {};
      const niche = businessData.niche || 'Service';
      const businessName = businessData.businessName || 'Local Business';
      const phone = businessData.phone || '';
      const city = businessData.city || 'your area';
      const whatsapp = businessData.whatsapp || phone;
      const landingPageUrl = businessData.landingPageUrl || '';
      const currency = businessData.currency || '$'; // Support RM, S$, etc.
      
      // Language and brand slogan support
      const language = pdfContent.language || designPrefs.language || 'en';
      const brandSlogan = designPrefs.brand_slogan || pdfContent.brand_slogan || '';
      const isMalay = language === 'ms';
      
      // Localized strings
      const strings = {
        presentedBy: isMalay ? 'Disediakan oleh' : 'Presented by',
        freeGuide: isMalay ? 'Panduan Percuma' : 'Free Guide',
        edition: isMalay ? 'Edisi' : 'Edition',
        quickRead: isMalay ? 'Bacaan 5 minit | Tips praktikal | Nasihat jimat wang' : '5-minute read | Actionable tips | Money-saving advice',
        selfAssessment: isMalay ? 'Semakan Kendiri Pantas' : 'Quick Self-Assessment',
        assessmentIntro: isMalay ? 'Jawab 3 soalan ini untuk tahu jika anda perlukan bantuan profesional:' : 'Answer these 3 questions to know if you need professional help:',
        yes: isMalay ? 'YA' : 'YES',
        no: isMalay ? 'TIDAK' : 'NO',
        checkResult: isMalay ? '[SEMAK] KEPUTUSAN ANDA' : '[CHECK] YOUR RESULT',
        resultText: isMalay ? `Jika anda jawab YA untuk mana-mana soalan, anda mungkin perlu pemeriksaan percuma.` : `If you answered YES to any question, you may benefit from a free inspection.`,
        callUs: isMalay ? `Hubungi ${businessName}:` : `Call ${businessName}:`,
        commonMistakes: isMalay ? 'Kesilapan Biasa' : 'Common Mistakes',
        mistakesIntro: isMalay ? 'Elak kesilapan mahal ini yang kami lihat setiap hari' : 'Avoid these costly errors that we see homeowners make every day',
        quickTips: isMalay ? 'Tips Pantas Untuk Anda' : 'Quick Tips You Can Use Today',
        tipsIntro: isMalay ? 'Tindakan mudah yang jimat wang dan elak masalah' : 'Simple, safe actions that save money and prevent problems',
        proTip: isMalay ? 'TIP PRO' : 'PRO TIP',
        proTipText: isMalay ? `Jika ragu, hubungi profesional. Pemeriksaan pantas lebih murah dari membaiki kesilapan DIY. Di ${businessName}, kami tawarkan anggaran percuma.` : `When in doubt, call a professional. A quick inspection is much cheaper than fixing DIY mistakes. At ${businessName}, we offer free estimates.`,
        readyToStart: isMalay ? 'Sedia Untuk Bermula?' : 'Ready to Get Started?',
        contactToday: isMalay ? `Hubungi ${businessName} hari ini untuk konsultasi percuma` : `Contact ${businessName} today for a free consultation`,
        exclusiveOffer: isMalay ? '*** TAWARAN EKSKLUSIF ***' : '*** EXCLUSIVE OFFER ***',
        offDiscount: isMalay ? 'Diskaun' : 'Off Your Next Service Call',
        validFor: isMalay ? 'Sah 7 hari dari muat turun | Tunjuk halaman ini atau sebut kod semasa menelefon' : 'Valid for 7 days from download | Show this page or mention code when calling'
      };

      // Helper to add footer to every page (with brand slogan if available)
      const addFooter = () => {
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        const footerText = brandSlogan 
          ? `${businessName} • "${brandSlogan}" • ${phone || city}`
          : `${strings.presentedBy} ${businessName} • ${phone || city}`;
        doc.fontSize(9)
           .fillColor(colors.gray)
           .text(footerText, 50, doc.page.height - 40, {
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
         .text(pdfContent.cover_tagline || (isMalay ? `Semua yang anda perlu tahu tentang ${niche.toLowerCase()} di ${city}` : `Everything you need to know about ${niche.toLowerCase()} in ${city}`), 50, 160, { 
           width: 512, 
           align: 'center' 
         });

      doc.strokeColor('#ffffff').lineWidth(2)
         .moveTo(200, 200).lineTo(412, 200).stroke();

      doc.fillColor('#ffffff')
         .fontSize(14)
         .font('Helvetica-Oblique')
         .text(`${strings.freeGuide} ${isMalay ? 'dari' : 'from'} ${businessName}`, 50, 230, { 
           width: 512, 
           align: 'center' 
         });

      doc.fontSize(12)
         .text(`${strings.edition} ${new Date().getFullYear()}`, 50, 260, { 
           width: 512, 
           align: 'center' 
         });

      doc.fillColor(colors.dark)
         .fontSize(11)
         .font('Helvetica')
         .text(strings.quickRead, 50, 400, { 
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
         .text(strings.selfAssessment, 50, 50);
      
      doc.strokeColor(colors.accent).lineWidth(3)
         .moveTo(50, 85).lineTo(280, 85).stroke();

      doc.fillColor(colors.gray)
         .fontSize(12)
         .font('Helvetica-Oblique')
         .text(strings.assessmentIntro, 50, 100);

      // Diagnostic questions with checkboxes - use AI-generated ones if available
      const diagnosticQuestions = pdfContent.diagnostic_questions || [
        { 
          question: isMalay 
            ? `Adakah anda perasan sebarang tanda luar biasa dengan sistem ${niche.toLowerCase()} anda dalam bulan lepas?`
            : `Have you noticed any unusual signs with your ${niche.toLowerCase()} system in the last month?`,
          yes_action: isMalay ? 'Jadualkan pemeriksaan' : 'Schedule an inspection soon',
          no_action: isMalay ? 'Terus memantau' : 'Keep monitoring regularly'
        },
        { 
          question: isMalay
            ? `Adakah sudah lebih 12 bulan sejak pemeriksaan profesional ${niche.toLowerCase()} terakhir anda?`
            : `Has it been more than 12 months since your last professional ${niche.toLowerCase()} check-up?`,
          yes_action: isMalay ? 'Pertimbangkan lawatan penyelenggaraan' : 'Consider a maintenance visit',
          no_action: isMalay ? 'Anda di landasan yang betul!' : 'You\'re on track!'
        },
        { 
          question: isMalay
            ? `Adakah anda mengalami masalah prestasi atau kos yang lebih tinggi dari biasa?`
            : `Are you experiencing any performance issues or higher-than-normal costs?`,
          yes_action: isMalay ? 'Hubungi kami untuk konsultasi percuma' : 'Call us for a free consultation',
          no_action: isMalay ? 'Bagus! Simpan tips ini' : 'Great! Keep these tips handy'
        }
      ];

      let diagY = 140;
      diagnosticQuestions.forEach((dq, i) => {
        // Question box
        doc.rect(50, diagY, 512, 85).fillAndStroke(i % 2 === 0 ? colors.light : '#ffffff', colors.secondary);
        
        doc.fillColor(colors.primary)
           .fontSize(14)
           .font('Helvetica-Bold')
           .text(`${isMalay ? 'Soalan' : 'Question'} ${i + 1}:`, 70, diagY + 15);
        
        doc.fillColor(colors.dark)
           .fontSize(12)
           .font('Helvetica')
           .text(dq.question, 70, diagY + 35, { width: 470 });
        
        // Yes/No checkboxes
        doc.rect(70, diagY + 60, 12, 12).stroke(colors.gray);
        doc.fillColor(colors.success).fontSize(10).text(`${strings.yes} → ` + dq.yes_action, 90, diagY + 62);
        
        doc.rect(300, diagY + 60, 12, 12).stroke(colors.gray);
        doc.fillColor(colors.gray).fontSize(10).text(`${strings.no} → ` + dq.no_action, 320, diagY + 62);
        
        diagY += 95;
      });

      // Result box
      doc.rect(50, diagY + 20, 512, 80).fillAndStroke('#fef3c7', colors.warning);
      doc.fillColor(colors.warning)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(strings.checkResult, 70, diagY + 35);
      doc.fillColor(colors.dark)
         .fontSize(11)
         .font('Helvetica')
         .text(strings.resultText, 70, diagY + 55, { width: 470 });
      doc.fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text(`${strings.callUs} ${phone || (isMalay ? 'Lihat halaman terakhir' : 'See last page for contact')}`, 70, diagY + 75);

      // ============ PAGE 3: INTRODUCTION ============
      doc.addPage();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text(isMalay ? 'Kenapa Panduan Ini Wujud' : 'Why This Guide Exists', 50, 50);
      
      doc.strokeColor(colors.accent).lineWidth(3)
         .moveTo(50, 85).lineTo(250, 85).stroke();

      const introText = pdfContent.intro || (isMalay
        ? `Navigasi perkhidmatan ${niche.toLowerCase()} boleh jadi rumit. Tetapi dengan ${businessName}, ia tidak perlu begitu.`
        : `Navigating ${niche.toLowerCase()} services can be a maze. But with ${businessName}, it doesn't have to be.`);

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
         .text(isMalay ? 'Apa Yang Anda Akan Pelajari:' : 'What You Will Learn:', 70, 220);

      const learnItems = isMalay ? [
        `Kesilapan ${niche.toLowerCase()} biasa yang merugikan pemilik rumah`,
        'Tips mudah yang anda boleh buat sendiri hari ini',
        'Bila perlu panggil profesional (dan bila tidak perlu)',
        'Julat harga sebenar supaya anda tidak terlebih bayar'
      ] : [
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
         .text(isMalay 
           ? `Disediakan oleh ${businessName} - Pakar ${niche} Dipercayai di ${city}`
           : `Created by ${businessName} - Trusted ${niche} Experts in ${city}`, 50, 350, {
           width: 512,
           align: 'center'
         });

      // ============ PAGE 3: COMMON MISTAKES ============
      doc.addPage();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text(isMalay ? `Kesilapan ${niche} Biasa` : `Common ${niche} Mistakes`, 50, 50);
      
      doc.strokeColor(colors.warning).lineWidth(3)
         .moveTo(50, 85).lineTo(280, 85).stroke();

      doc.fillColor(colors.gray)
         .fontSize(11)
         .font('Helvetica-Oblique')
         .text(strings.mistakesIntro, 50, 100);

      const mistakes = pdfContent.common_mistakes || [
        { 
          title: isMalay ? 'Pilih Sebutharga Paling Murah' : 'Choosing the Cheapest Quote', 
          description: isMalay ? 'Harga murah sering bermakna jalan pintas. Sentiasa sahkan apa yang termasuk.' : 'Low prices often mean shortcuts. Always verify what\'s included.' 
        },
        { 
          title: isMalay ? 'Abaikan Penyelenggaraan Berkala' : 'Skipping Regular Maintenance', 
          description: isMalay ? 'Masalah kecil menjadi pembaikan mahal apabila diabaikan.' : 'Small issues become expensive repairs when ignored.' 
        },
        { 
          title: isMalay ? 'Abaikan Tanda Amaran' : 'Ignoring Warning Signs', 
          description: isMalay ? 'Bunyi atau bau pelik bermakna sesuatu perlu perhatian.' : 'Strange noises or smells mean something needs attention.' 
        }
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
         .text(strings.quickTips, 50, 50);
      
      doc.strokeColor(colors.success).lineWidth(3)
         .moveTo(50, 85).lineTo(330, 85).stroke();

      doc.fillColor(colors.gray)
         .fontSize(11)
         .font('Helvetica-Oblique')
         .text(strings.tipsIntro, 50, 100);

      const tips = pdfContent.quick_tips || [
        { 
          title: isMalay ? 'Periksa Penapis Anda Setiap Bulan' : 'Check Your Filter Monthly', 
          description: isMalay ? 'Penapis kotor mengurangkan kecekapan sehingga 15%.' : 'A dirty filter reduces efficiency by up to 15%.' 
        },
        { 
          title: isMalay ? 'Dengar Bunyi Luar Biasa' : 'Listen for Unusual Sounds', 
          description: isMalay ? 'Bunyi berdengung atau klik sering menunjukkan bahagian longgar.' : 'Buzzing or clicking often indicates loose parts.' 
        },
        { 
          title: isMalay ? 'Pantau Bil Anda' : 'Monitor Your Bills', 
          description: isMalay ? 'Kenaikan mendadak mungkin menandakan ketidakcekapan.' : 'Sudden increases may signal inefficiency.' 
        }
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
         .text(strings.proTip, 70, yPos + 35);
      doc.fillColor(colors.dark)
         .fontSize(11)
         .font('Helvetica')
         .text(strings.proTipText, 70, yPos + 52, { width: 470 });

      // ============ PAGE 5: CASE STUDY ============
      doc.addPage();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text(isMalay ? 'Kisah Pelanggan Sebenar' : 'Real Customer Story', 50, 50);
      
      doc.strokeColor(colors.accent).lineWidth(3)
         .moveTo(50, 85).lineTo(280, 85).stroke();

      const caseStudy = pdfContent.case_study || {
        customer_name: isMalay ? 'Puan Siti' : 'Maria',
        location: isMalay ? 'Puchong' : 'Downtown',
        problem: isMalay 
          ? `ada masalah kecil yang nampak biasa pada mulanya, tetapi ia cepat menjadi masalah besar.`
          : `had a small issue that seemed minor at first, but it quickly escalated into a bigger problem.`,
        solution: isMalay
          ? `Pasukan kami tiba dalam masa 24 jam, kenal pasti punca masalah, dan baiki dengan betul.`
          : `Our team arrived within 24 hours, diagnosed the root cause, and fixed it properly.`,
        result: isMalay
          ? `Kos pembaikan 60% lebih murah berbanding syarikat lain, dan ia berfungsi dengan baik sejak itu.`
          : 'The repair cost was 60% less than what another company quoted, and it has been working perfectly ever since.'
      };

      doc.rect(50, 100, 512, 200).fillAndStroke(colors.light, colors.secondary);

      doc.fillColor(colors.dark)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(`${caseStudy.customer_name} ${isMalay ? 'dari' : 'from'} ${caseStudy.location}`, 70, 120);

      doc.fillColor(colors.gray)
         .fontSize(11)
         .font('Helvetica')
         .text(isMalay ? 'MASALAH:' : 'THE PROBLEM:', 70, 150);
      doc.fillColor(colors.dark)
         .text(caseStudy.problem, 70, 165, { width: 470 });

      doc.fillColor(colors.gray)
         .text(isMalay ? 'PENYELESAIAN KAMI:' : 'OUR SOLUTION:', 70, 210);
      doc.fillColor(colors.dark)
         .text(caseStudy.solution, 70, 225, { width: 470 });

      doc.fillColor(colors.success)
         .font('Helvetica-Bold')
         .text(isMalay ? 'HASILNYA:' : 'THE RESULT:', 70, 260);
      doc.fillColor(colors.dark)
         .font('Helvetica')
         .text(caseStudy.result, 70, 275, { width: 470 });

      doc.fillColor(colors.primary)
         .fontSize(13)
         .font('Helvetica-Oblique')
         .text(isMalay 
           ? `"Saya harap saya jumpa ${businessName} lebih awal. Mereka jimatkan masa dan wang saya!"`
           : `"I wish I had found ${businessName} sooner. They saved me time and money!"`, 70, 330, {
           width: 470
         });
      doc.fillColor(colors.gray)
         .fontSize(11)
         .text(`- ${caseStudy.customer_name}, ${isMalay ? 'Pelanggan Sah' : 'Verified Customer'}`, 70, 360);

      // ============ PAGE 6: ACTION CHECKLIST + COUPON ============
      doc.addPage();
      
      doc.fillColor(colors.primary)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text(isMalay ? 'Buat 2 Perkara Ini Sekarang' : 'Do These 2 Things Now', 50, 50);
      
      doc.strokeColor(colors.success).lineWidth(3)
         .moveTo(50, 85).lineTo(isMalay ? 320 : 250, 85).stroke();

      doc.fillColor(colors.gray)
         .fontSize(11)
         .font('Helvetica-Oblique')
         .text(isMalay ? 'Langkah pantas yang boleh anda selesaikan dalam 10 minit' : 'Quick wins you can accomplish in the next 10 minutes', 50, 100);

      const checklist = pdfContent.action_checklist || [
        isMalay 
          ? `Buat pemeriksaan visual pantas sistem ${niche.toLowerCase()} anda`
          : `Do a quick visual inspection of your ${niche.toLowerCase()} system`,
        isMalay
          ? `Simpan nombor kami untuk bila anda perlu bantuan profesional: ${phone || 'Hubungi kami!'}`
          : `Save our number for when you need professional help: ${phone || 'Call us!'}`
      ];

      checklist.slice(0, 2).forEach((item, i) => {
        doc.rect(50, 130 + (i * 80), 35, 35).stroke(colors.primary);
        
        doc.fillColor(colors.dark)
           .fontSize(14)
           .font('Helvetica-Bold')
           .text(`${isMalay ? 'Langkah' : 'Step'} ${i + 1}`, 100, 135 + (i * 80));
        
        doc.fillColor(colors.dark)
           .fontSize(11)
           .font('Helvetica')
           .text(item, 100, 155 + (i * 80), { width: 450 });
      });

      // ===== COUPON / VOUCHER SECTION =====
      const couponCode = pdfContent.coupon_code || (isMalay ? 'DISKAUN15' : 'GUIDE15');
      const couponOffer = pdfContent.coupon_offer || (isMalay ? 'Diskaun 15% Servis Pertama Anda' : '15% OFF Your First Service');
      const couponExpiry = pdfContent.coupon_expiry || (isMalay ? '7 hari dari muat turun' : '7 days from download');
      
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
         .text(isMalay ? '*** TAWARAN EKSKLUSIF ***' : '*** EXCLUSIVE OFFER ***', 70, 350, { width: 470, align: 'center' });

      doc.fillColor(colors.dark)
         .fontSize(18)
         .font('Helvetica-Bold')
         .text(couponOffer, 70, 380, { width: 470, align: 'center' });

      // Coupon code box
      doc.rect(200, 405, 212, 35).fillAndStroke('#ffffff', colors.primary);
      doc.fillColor(colors.primary)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text(`${isMalay ? 'KOD' : 'CODE'}: ${couponCode}`, 206, 413, { width: 200, align: 'center' });

      doc.fillColor(colors.gray)
         .fontSize(10)
         .font('Helvetica-Oblique')
         .text(isMalay 
           ? `Sah ${couponExpiry} | Tunjuk halaman ini atau sebut kod semasa menelefon`
           : `Valid for ${couponExpiry} | Show this page or mention code when calling`, 70, 445, { width: 470, align: 'center' });

      // Quick contact box
      doc.rect(50, 480, 512, 60).fillAndStroke(colors.light, colors.secondary);
      doc.fillColor(colors.primary)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(isMalay ? '>> Sedia untuk tebus diskaun anda?' : '>> Ready to claim your discount?', 70, 495);
      doc.fillColor(colors.dark)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(phone ? `${isMalay ? 'Hubungi sekarang' : 'Call now'}: ${phone}` : `${isMalay ? 'Lawati' : 'Visit'}: ${landingPageUrl || 'our website'}`, 70, 515);
      
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
         .text(isMalay ? 'Julat Harga Biasa' : 'Typical Price Ranges', 50, 50);
      
      doc.strokeColor(colors.accent).lineWidth(3)
         .moveTo(50, 85).lineTo(230, 85).stroke();

      doc.fillColor(colors.gray)
         .fontSize(11)
         .font('Helvetica-Oblique')
         .text(isMalay 
           ? 'Supaya anda tahu apa yang dijangkakan (harga berbeza mengikut lokasi dan kerumitan)'
           : 'So you know what to expect (prices vary by location and complexity)', 50, 100);

      const priceRanges = pdfContent.price_ranges || [
        { service: isMalay ? 'Pemeriksaan asas' : 'Basic inspection', range: `${currency}50 - ${currency}150` },
        { service: isMalay ? 'Pembaikan kecil' : 'Minor repairs', range: `${currency}100 - ${currency}300` },
        { service: isMalay ? 'Pembaikan sederhana' : 'Medium repairs', range: `${currency}300 - ${currency}800` },
        { service: isMalay ? 'Pembaikan besar' : 'Major repairs', range: `${currency}800 - ${currency}2,000+` },
        { service: isMalay ? 'Penggantian penuh' : 'Full replacement', range: `${currency}2,000 - ${currency}10,000+` }
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
         .text(isMalay 
           ? 'Nota: Ini adalah anggaran umum. Sentiasa dapatkan sebut harga bertulis sebelum kerja bermula.'
           : 'Note: These are general estimates. Always get a written quote before work begins.', 50, yPos + 20, { width: 512 });

      // ============ PAGE 8: CTA + CONTACT + QR CODE ============
      doc.addPage();

      doc.rect(0, 0, 612, 240).fill(colors.primary);
      
      doc.fillColor('#ffffff')
         .fontSize(28)
         .font('Helvetica-Bold')
         .text(strings.readyToStart, 50, 60, { width: 512, align: 'center' });
      
      doc.fontSize(14)
         .font('Helvetica')
         .text(strings.contactToday, 50, 100, { width: 512, align: 'center' });

      if (phone) {
        doc.fontSize(28)
           .font('Helvetica-Bold')
           .text(`${isMalay ? 'HUBUNGI' : 'CALL'}: ${phone}`, 50, 140, { width: 512, align: 'center' });
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
         .text(isMalay ? 'Maklumat Hubungan' : 'Contact Information', 50, 270);

      doc.strokeColor(colors.accent).lineWidth(2)
         .moveTo(50, 295).lineTo(200, 295).stroke();

      const contactDetails = [
        `${isMalay ? 'Perniagaan' : 'Business'}: ${businessName}`,
        phone ? `${isMalay ? 'Telefon' : 'Phone'}: ${phone}` : null,
        whatsapp && whatsapp !== phone ? `WhatsApp: ${whatsapp}` : null,
        businessData.email ? `${isMalay ? 'Emel' : 'Email'}: ${businessData.email}` : null,
        businessData.address ? `${isMalay ? 'Alamat' : 'Address'}: ${businessData.address}` : `${isMalay ? 'Kawasan Liputan' : 'Service Area'}: ${city}`,
        businessData.hours ? `${isMalay ? 'Waktu' : 'Hours'}: ${businessData.hours}` : `${isMalay ? 'Waktu' : 'Hours'}: ${isMalay ? 'Isn-Jum 8pg-6ptg, Sab 9pg-2ptg' : 'Mon-Fri 8am-6pm, Sat 9am-2pm'}`
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
         .text(isMalay ? 'IMBAS UNTUK TEMPAH' : 'SCAN TO BOOK', 385, 285, { width: 160, align: 'center' });
      
      // Use pre-generated QR code buffer
      if (qrBuffer) {
        doc.image(qrBuffer, 420, 310, { width: 90, height: 90 });
      } else {
        // Fallback: show URL text if QR generation failed
        doc.rect(420, 310, 90, 90).fillAndStroke('#ffffff', colors.dark);
        doc.fillColor(colors.gray)
           .fontSize(8)
           .text(isMalay ? 'Lawati:' : 'Visit:', 425, 340, { width: 80, align: 'center' })
           .text(qrUrl.substring(0, 30), 425, 355, { width: 80, align: 'center' });
      }
      
      doc.fillColor(colors.gray)
         .fontSize(9)
         .font('Helvetica')
         .text(qrUrl.length > 35 ? qrUrl.substring(0, 35) + '...' : qrUrl, 385, 410, { width: 160, align: 'center' });
      
      doc.fillColor(colors.gray)
         .fontSize(8)
         .text(isMalay ? 'Imbas dengan kamera telefon anda' : 'Scan with your phone camera', 385, 425, { width: 160, align: 'center' });

      // Testimonial box
      doc.rect(50, 460, 250, 80).fillAndStroke(colors.light, colors.secondary);
      doc.fillColor(colors.warning)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('*****', 70, 475);
      doc.fillColor(colors.dark)
         .fontSize(10)
         .font('Helvetica-Oblique')
         .text(isMalay 
           ? `"${businessName} memang terbaik. Profesional, jujur, dan harga berpatutan!"`
           : `"${businessName} saved us so much hassle. Professional, honest, and affordable!"`, 70, 495, { width: 210 });
      doc.fillColor(colors.gray)
         .fontSize(9)
         .text(isMalay ? '- Pelanggan Gembira' : '- Happy Customer', 70, 525);

      // Reminder coupon code
      doc.rect(320, 460, 230, 80).fillAndStroke('#fef2f2', colors.coupon);
      doc.fillColor(colors.coupon)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text(isMalay ? '>>> JANGAN LUPA!' : '>>> DON\'T FORGET!', 335, 475);
      doc.fillColor(colors.dark)
         .fontSize(10)
         .font('Helvetica')
         .text(isMalay 
           ? `Guna kod ${pdfContent.coupon_code || couponCode} untuk`
           : `Use code ${pdfContent.coupon_code || couponCode} for`, 335, 495, { width: 195 });
      doc.fillColor(colors.coupon)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(pdfContent.coupon_offer || couponOffer, 335, 510, { width: 195 });
      doc.fillColor(colors.gray)
         .fontSize(9)
         .text(`${isMalay ? 'Tamat tempoh' : 'Expires'}: ${pdfContent.coupon_expiry || couponExpiry}`, 335, 528);

      doc.fillColor(colors.gray)
         .fontSize(9)
         .font('Helvetica')
         .text(`© ${new Date().getFullYear()} ${businessName}. ${isMalay ? 'Hak cipta terpelihara.' : 'All rights reserved.'}`, 50, 560, { width: 512, align: 'center' });
      
      doc.fontSize(8)
         .text(isMalay ? 'Dijana dengan teliti oleh Launchfly' : 'Generated with care by Launchfly', 50, 575, { width: 512, align: 'center' });
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
