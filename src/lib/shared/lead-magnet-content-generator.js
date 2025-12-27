// src/lib/shared/lead-magnet-content-generator.js
/**
 * SHARED LEAD MAGNET CONTENT GENERATOR
 * 
 * This module provides consistent lead magnet generation logic used by:
 * 1. /api/sales/analyze - For prospect preview creation
 * 2. /api/claim/activate - When prospect pays and activates
 * 3. Inngest generate-lead-magnet - For wizard/templates flow
 * 
 * By sharing this logic, we ensure:
 * - Consistent PDF content structure
 * - Same testimonial quality
 * - Uniform landing page data
 * - Identical email sequences
 */

import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============ CURRENCY DETECTION ============
export function detectCurrency(text) {
  if (!text) return { symbol: '$', code: 'USD', name: 'dollars' };
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('rm') || lowerText.includes('ringgit') || lowerText.includes('malaysia')) {
    return { symbol: 'RM', code: 'MYR', name: 'ringgit' };
  }
  if (lowerText.includes('sgd') || lowerText.includes('singapore')) {
    return { symbol: 'S$', code: 'SGD', name: 'Singapore dollars' };
  }
  if (lowerText.includes('php') || lowerText.includes('peso') || lowerText.includes('philippines')) {
    return { symbol: '₱', code: 'PHP', name: 'pesos' };
  }
  if (lowerText.includes('idr') || lowerText.includes('rupiah') || lowerText.includes('indonesia')) {
    return { symbol: 'Rp', code: 'IDR', name: 'rupiah' };
  }
  if (lowerText.includes('thb') || lowerText.includes('baht') || lowerText.includes('thailand')) {
    return { symbol: '฿', code: 'THB', name: 'baht' };
  }
  if (lowerText.includes('£') || lowerText.includes('gbp') || lowerText.includes('pound')) {
    return { symbol: '£', code: 'GBP', name: 'pounds' };
  }
  if (lowerText.includes('€') || lowerText.includes('eur') || lowerText.includes('euro')) {
    return { symbol: '€', code: 'EUR', name: 'euros' };
  }
  return { symbol: '$', code: 'USD', name: 'dollars' };
}

// ============ LANGUAGE DETECTION ============
export function detectLanguage(text) {
  const lowerText = (text || '').toLowerCase();

  // Philippines / Luzon / PHP indicators (English-first)
  const philippinesSignals = [
    'philippines', 'luzon', 'metro manila', 'manila', 'quezon', 'cavite',
    'laguna', 'bulacan', 'pampanga', 'batangas', '₱', 'php',
    'salamat', 'kumusta', 'kamusta', 'po', 'opo', 'pwede', 'pwedeng', 'tingin'
  ];
  if (philippinesSignals.some(s => lowerText.includes(s))) {
    return { code: 'en', name: 'English', greeting: 'Hi' };
  }

  // Malay indicators
  if (
    lowerText.includes('salam') || lowerText.includes('tuan') ||
    lowerText.includes('puan') || lowerText.includes('anda') ||
    lowerText.includes('perkhidmatan') || lowerText.includes('hubungi') ||
    lowerText.includes('paip') || lowerText.includes('bocor') ||
    lowerText.includes('tersumbat') || lowerText.includes('baiki')
  ) {
    return { code: 'ms', name: 'Bahasa Malaysia', greeting: 'Salam' };
  }

  // Spanish indicators
  if (
    lowerText.includes('hola') || lowerText.includes('servicios') ||
    lowerText.includes('página') || lowerText.includes('precio')
  ) {
    return { code: 'es', name: 'Spanish', greeting: 'Hola' };
  }

  // Indonesian indicators
  if (
    lowerText.includes('layanan') || lowerText.includes('jasa') ||
    lowerText.includes('harga') || lowerText.includes('kami menyediakan')
  ) {
    return { code: 'id', name: 'Bahasa Indonesia', greeting: 'Halo' };
  }

  return { code: 'en', name: 'English', greeting: 'Hi' };
}

// ============ BUSINESS TYPE DETECTION ============
export function detectBusinessType(topicText, contextText = '') {
  const combinedText = `${topicText || ''} ${contextText || ''}`.toLowerCase();
  
  // SERVICE keywords get highest priority (check FIRST)
  const serviceKeywords = [
    'plumb', 'plumber', 'plumbing', 'electrician', 'electric', 'hvac', 
    'repair', 'contractor', 'handyman', 'homefix', 'locksmith', 'roofing', 
    'cleaning', 'pest', 'moving', 'towing', 'emergency', 'paip', 'bocor',
    'aircon', 'ac service', 'air conditioning', 'maintenance'
  ];
  
  if (serviceKeywords.some(k => combinedText.includes(k))) {
    return 'local_service';
  }
  
  // EVENT keywords
  const eventKeywords = [
    'event', 'workshop', 'webinar', 'seminar', 'conference', 'summit',
    'ticket', 'zumba', 'yoga class', 'fitness class', 'master class',
    'masterclass', 'bootcamp', 'retreat', 'registration'
  ];
  
  const eventPatterns = [
    /\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
    /rm\s*\d+/i,
    /\$\s*\d+\s*(per|\/)\s*(person|pax|ticket)/i,
    /\d{1,2}:\d{2}\s*(am|pm)/i
  ];
  
  const hasEventKeyword = eventKeywords.some(k => combinedText.includes(k));
  const hasEventPattern = eventPatterns.some(p => p.test(combinedText));
  
  if (hasEventKeyword && hasEventPattern) {
    return 'event';
  }
  
  // COACHING keywords
  const coachingKeywords = [
    'coach', 'coaching', 'consultant', 'consulting', 'mentor', 
    'trainer', 'advisor', 'expert', 'strategist', 'therapist'
  ];
  
  if (coachingKeywords.some(k => combinedText.includes(k))) {
    return 'coaching';
  }
  
  return 'local_service'; // Default
}

// ============ EXTRACT BRAND SLOGAN ============
export function extractSlogan(text) {
  if (!text) return null;
  const patterns = [
    /cepat\s*[-–]\s*kemas\s*[&dan]*\s*(?:boleh\s*)?dipercayai/i,
    /fast\s*[-–]\s*reliable/i,
    /trusted\s*&\s*reliable/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

// ============ SHARED CONTENT GENERATION PROMPT ============
/**
 * Generate the full lead magnet content using GPT-4
 * This is the SINGLE SOURCE OF TRUTH for content generation
 */
export async function generateLeadMagnetContent({
  businessName,
  niche,
  websiteData = null,
  businessContext = '',
  language = 'English',
  currency = { symbol: '$', code: 'USD' },
  businessType = 'local_service',
  ownerName = ''
}) {
  // Build context from scraped website
  let websiteContextBlock = '';
  if (websiteData) {
    websiteContextBlock = `
    ===== EXISTING BUSINESS WEBSITE DATA (USE THIS TO PERSONALIZE) =====
    Business Name from Website: ${websiteData.title || 'Not found'}
    Website Meta Description: ${websiteData.description || 'Not found'}
    Phone Number: ${websiteData.phone || 'Not found'}
    Email: ${websiteData.email || 'Not found'}
    
    Key Headings from their site:
    ${websiteData.headings?.length > 0 ? websiteData.headings.map(h => `- ${h}`).join('\n') : 'None extracted'}
    
    Website Content Summary:
    ${websiteData.bodyText || 'Could not extract'}
    
    IMPORTANT: Use the EXACT business name, phone, and details from above. 
    Match their tone and positioning. Reference specific services they mention.
    =====================================================================
    `;
  }

  const prompt = `
    You are a world-class direct response copywriter specializing in local service businesses.
    
    CREATE A COMPLETE LEAD MAGNET FUNNEL for: "${businessName}" in the "${niche}" industry.
    
    ${websiteContextBlock}
    
    ${businessContext ? `ADDITIONAL CONTEXT: ${businessContext}` : ''}
    
    CRITICAL INSTRUCTIONS:
    - Business Name: ${businessName}
    - Niche: ${niche}
    - Language: ${language}
    - Currency: ${currency.symbol} (${currency.code})
    - Business Type: ${businessType}
    - Owner Name: ${ownerName || 'Not provided'}
    
    ALL PRICES MUST USE ${currency.symbol} - NOT USD unless that's the detected currency.
    
    ${businessType === 'event' ? `
    THIS IS AN EVENT - Focus on:
    - Event excitement and FOMO
    - Speaker/instructor credentials
    - What attendees will experience
    - NO diagnostic questions or price guides
    - CTA: "Reserve My Spot" NOT "Download Guide"
    ` : businessType === 'coaching' ? `
    THIS IS COACHING/CONSULTING - Focus on:
    - Authority and expertise
    - Transformation stories
    - Framework/methodology
    - NO coupons or discounts
    - CTA: "Book Your Strategy Call"
    ` : `
    THIS IS A LOCAL SERVICE - Focus on:
    - Trust and reliability
    - Price transparency
    - Problem diagnostics
    - Special offer/coupon
    - CTA: "Get Your Free Guide"
    `}
    
    TESTIMONIAL REQUIREMENTS:
    - Generate 3 realistic testimonials
    - Each MUST mention the specific service (e.g., "aircon", "plumbing", "AC repair")
    - At least ONE must mention the business name "${businessName}"
    - Names should be realistic (e.g., "Sarah L.", "Ahmad M.", "Mike T.")
    - Include specific results (e.g., "saved RM200", "fixed in 30 minutes", "no more leaks")
    
    PDF CONTENT REQUIREMENTS (in ${language}):
    - diagnostic_questions: 3 specific self-assessment questions
    - common_mistakes: 3 specific mistakes with titles and descriptions
    - quick_tips: 3 actionable tips with titles and descriptions
    - price_ranges: 3-5 service/price combinations using ${currency.symbol}
    - case_study: A realistic local success story
    - coupon_code: Simple code like "GUIDE15" or "SAVE15" (NOT business name + year)
    
    EMAIL SEQUENCE (5 emails):
    - Day 1: Deliver the guide + introduce business
    - Day 2: Quick tip + soft pitch
    - Day 3: Case study + credibility
    - Day 4: FAQ + overcome objections
    - Day 5: Final reminder + special offer
    
    Return a JSON object with this EXACT structure:
    {
      "design_preferences": {
        "layout_mode": "${businessType === 'event' ? 'event' : businessType === 'coaching' ? 'visual' : 'emergency'}",
        "primary_color": "hex code appropriate for industry",
        "font_style": "bold | elegant | modern",
        "language": "${language === 'Bahasa Malaysia' ? 'ms' : 'en'}",
        "brand_slogan": "Tagline if detected"
      },
      "analysis": {
        "primary_service": "Main service identified",
        "pain_point": "Customer worry",
        "opportunity": "Why this asset helps",
        "business_type": "${businessType}",
        "estimated_value": "${currency.symbol}XXX - ${currency.symbol}YYY",
        "customer_demographic": "Ideal customer profile"
      },
      "lead_magnet": {
        "title": "Full title in ${language}",
        "headline": "Fear/desire headline",
        "subheadline": "Benefit subtitle",
        "benefits": ["Benefit 1", "Benefit 2", "Benefit 3"],
        "preview_tips": [
          {"title": "Tip title", "description": "Description"}
        ],
        "cta_text": "CTA button text"
      },
      "testimonials": [
        {
          "name": "Realistic name",
          "role": "e.g., Homeowner in [City]",
          "content": "Specific praise mentioning service and result",
          "avatar": "👩",
          "rating": 5
        }
      ],
      "pdf_content": {
        "language": "${language === 'Bahasa Malaysia' ? 'ms' : 'en'}",
        "cover_tagline": "Powerful subtitle",
        "intro": "Professional intro paragraph",
        "diagnostic_questions": [
          {"question": "Question text", "yes_action": "If yes", "no_action": "If no"}
        ],
        "common_mistakes": [
          {"title": "Mistake title", "description": "Description"}
        ],
        "quick_tips": [
          {"title": "Tip title", "description": "Description"}
        ],
        "case_study": {
          "customer_name": "Name",
          "location": "Area",
          "problem": "Issue faced",
          "solution": "How solved",
          "result": "Outcome"
        },
        "action_checklist": ["Step 1", "Step 2"],
        "price_ranges": [
          {"service": "Service name", "range": "${currency.symbol}XX - ${currency.symbol}YY"}
        ],
        "coupon_offer": "Special offer text",
        "coupon_code": "GUIDE15",
        "coupon_expiry": "7 days from download"
      },
      "email_sequence": [
        {
          "day": 1,
          "subject": "Subject line",
          "preview": "Preview text",
          "body": "Email body with {{FIRST_NAME}} and {{BUSINESS_NAME}} placeholders"
        }
      ],
      "whatsapp_script": "Opening message for WhatsApp outreach",
      "whatsapp_followups": {
        "reply_interested": "Response when prospect asks how it works",
        "followup_1": "4-6 hour follow up",
        "followup_2": "Next day follow up",
        "followup_3": "Final follow up"
      }
    }
  `;

  const completion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'gpt-4-turbo-preview',
    response_format: { type: 'json_object' },
  });

  return JSON.parse(completion.choices[0].message.content || '{}');
}

// ============ MERGE EXISTING + REGENERATED CONTENT ============
/**
 * When a prospect pays, we may want to ENHANCE their preview content
 * rather than regenerate from scratch
 */
export function mergeProspectContent(existingBusinessData, newContent) {
  // Keep the good stuff from prospect preview
  const merged = {
    ...existingBusinessData,
    // Upgrade with any better content from regeneration
    testimonials: newContent.testimonials?.length > 0 
      ? newContent.testimonials 
      : existingBusinessData.testimonials,
    // Ensure we have full PDF content
    lead_magnet_pdf: {
      ...existingBusinessData.lead_magnet_pdf,
      ...newContent.pdf_content,
      // Keep original prices if they were good
      price_ranges: existingBusinessData.lead_magnet_pdf?.price_ranges?.length > 0
        ? existingBusinessData.lead_magnet_pdf.price_ranges
        : newContent.pdf_content?.price_ranges
    },
    // Add email sequence if missing
    email_sequence: newContent.email_sequence || existingBusinessData.email_sequence,
    // Keep design preferences
    design_preferences: existingBusinessData.design_preferences || newContent.design_preferences
  };
  
  return merged;
}

// ============ CHECK IF CONTENT IS COMPLETE ============
export function isContentComplete(businessData) {
  if (!businessData) return false;
  
  const hasLeadMagnet = businessData.leadMagnet?.lead_magnet?.title || businessData.lead_magnet_title;
  const hasPdfContent = businessData.lead_magnet_pdf?.diagnostic_questions?.length > 0 ||
                        businessData.lead_magnet_pdf?.common_mistakes?.length > 0;
  const hasTestimonials = businessData.testimonials?.length > 0;
  
  return hasLeadMagnet && hasPdfContent && hasTestimonials;
}

export default {
  detectCurrency,
  detectLanguage,
  detectBusinessType,
  extractSlogan,
  generateLeadMagnetContent,
  mergeProspectContent,
  isContentComplete
};
