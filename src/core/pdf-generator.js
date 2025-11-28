/**
 * PDF Generator for Lead Magnets
 * Following the "treasure chest" philosophy: small, sharp, immediately usable
 * 
 * Generates a premium 10-page PDF:
 * 1. Cover page
 * 2. Introduction
 * 3. Common mistakes
 * 4. Quick tips
 * 5. Case study
 * 6. Action checklist
 * 7. Pricing guide
 * 8. FAQ
 * 9. CTA + Contact
 */

export function generatePDF(data, PDFDocument, businessData = {}) {
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
      doc.rect(0, 0, 612, 350).fill(colors.primary);
      
      doc.fillColor('#ffffff')
         .fontSize(36)
         .font('Helvetica-Bold')
         .text(data.title || 'Your Expert Guide', 50, 120, { 
           width: 512, 
           align: 'center' 
         });
      
      doc.fontSize(16)
         .font('Helvetica')
         .text(pdfContent.cover_tagline || `Everything you need to know about ${niche.toLowerCase()} in ${city}`, 50, 180, { 
           width: 512, 
           align: 'center' 
         });

      doc.strokeColor('#ffffff').lineWidth(2)
         .moveTo(200, 220).lineTo(412, 220).stroke();

      doc.fillColor('#ffffff')
         .fontSize(14)
         .font('Helvetica-Oblique')
         .text(`Free Guide from ${businessName}`, 50, 250, { 
           width: 512, 
           align: 'center' 
         });

      doc.fontSize(12)
         .text(`${new Date().getFullYear()} Edition`, 50, 280, { 
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

      // ============ PAGE 2: INTRODUCTION ============
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

      // ============ PAGE 6: ACTION CHECKLIST ============
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

      // ============ PAGE 8: FAQ ============
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
      faqs.forEach((faq) => {
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

      // ============ PAGE 9: CTA + CONTACT ============
      doc.addPage();

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
