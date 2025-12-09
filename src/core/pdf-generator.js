/**
 * PDF Generator for Lead Magnets
 * Following the "treasure chest" philosophy: small, sharp, immediately usable
 * 
 * OPTIMIZED FOR LOCAL BUSINESS CONVERSION (Market Analysis 2025)
 * 
 * Generates a premium 8-page PDF:
 * 1. Cover page (outcome-first headline)
 * 2. Quick Diagnostic (3-question self-assessment)
 * 3. Introduction + What You'll Learn
 * 4. Common mistakes (educational)
 * 5. Quick tips (actionable)
 * 6. Local Case Study (proof)
 * 7. Action checklist + Coupon/Voucher
 * 8. CTA + Contact + QR Code
 * 
 * Mobile-first design: Large buttons, ≤2MB, readable on phone
 */

import QRCode from 'qrcode';

export async function generatePDF(data, PDFDocument, businessData = {}) {
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
