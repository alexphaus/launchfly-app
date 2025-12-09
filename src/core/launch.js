// src/core/launch.js
/**
 * launch.js - Generate the Lead Magnet Funnel
 * 
 * This module generates the actual content for the user's funnel:
 * 1. PDF Guide Content
 * 2. Landing Page Copy
 * 3. Email Sequence
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 60 second timeout for long generation
  maxRetries: 2
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Generates all funnel content in one go
 */
async function generateFunnelContent(opportunity) {
  const { niche, targetAudience, problem, leadMagnet, city } = opportunity;
  const location = city || "your area";
  const title = leadMagnet?.title || `The ${location} Homeowner's Guide`;
  
  console.log(`📝 Generating Funnel Content for: "${title}" in ${location}...`);
  
  const prompt = `
    You are an expert marketing copywriter for LOCAL SERVICE BUSINESSES. 
    Create a complete "Lead Gen Funnel" for a ${niche} business targeting:
    - Niche: ${niche}
    - Audience: ${targetAudience}
    - Location: ${location}
    - Main Problem: ${problem}
    - Offer Title: ${title}

    CRITICAL: ALL CONTENT MUST BE 100% SPECIFIC TO ${niche.toUpperCase()} AND LOCALIZED FOR ${location.toUpperCase()}.
    - Do NOT use generic phrases like "your system" or "the issue"
    - USE industry-specific terminology (e.g., for Plumbing: "P-trap", "water heater anode rod", "main shutoff valve")
    - Include REAL ${niche} scenarios, not vague descriptions
    - Price ranges must reflect ACTUAL ${niche} market rates
    - Tips must be things a ${niche} professional would actually recommend
    - MENTION "${location}" in the copy to build local trust.

    The PDF should be a "10-minute treasure chest" - small, sharp, immediately usable.
    NOT a long report. NOT a boring brochure. A practical assistant that gives quick wins.
    
    Think of it as: "A friendly ${niche} expert guide that says: Here's what you can check yourself... and when you need to call a pro."

    CONVERSION FOCUS (2025 Best Practices):
    - Include a 3-question diagnostic with ${niche}-specific symptoms
    - Add a coupon/voucher with urgency (limited time, limited slots)
    - Local proof with neighborhood-specific case study (mention a neighborhood in or near ${location})
    - Clear CTA that maps to booking/calling

    You must generate SIX things:
    
    1. **RICH PDF CONTENT** (8 pages worth of content):
       - Cover tagline (one powerful promise specific to ${niche} outcomes in ${location})
       - 3 Diagnostic questions (${niche}-specific symptoms/issues that signal problems)
       - Intro paragraph (why this ${niche} guide exists, establish credibility in ${location})
       - 5 Common ${niche} Mistakes (REAL mistakes with specific ${niche} examples and costs)
       - 5 Quick ${niche} Tips (actionable advice with specific tools/methods)
       - One Case Study (${niche} job with SPECIFIC details - what was wrong, how it was fixed, exact savings)
       - 2-Item Action Checklist (specific ${niche} checks anyone can do at home)
       - Coupon/Voucher details (code, offer, expiry)
       - Price ranges (REALISTIC ${niche} costs in the current market)
       
    2. **LANDING PAGE COPY** (High converting, persuasive with urgency)
    
    3. **5-DAY EMAIL SEQUENCE** (To build trust and get them to CALL or BOOK, with ${niche}-specific advice)
    
    4. **3 CUSTOMER TESTIMONIALS** (Realistic ${niche} scenarios with local details)
    
    5. **COUPON/VOUCHER** (e.g., "15% off first ${niche} service - Code GUIDE15 - Expires in 7 days")
    
    6. **WHATSAPP MESSAGE** (Prefilled message for click-to-chat about ${niche})

    Return a VALID JSON object with this EXACT structure:
    {
      "lead_magnet_title": "[THE GUIDE TITLE - must include ${niche} and ${location}]",
      "lead_magnet_pdf": {
        "cover_tagline": "One powerful promise line specific to ${niche} outcomes (e.g., 'Never overpay for plumbing again in ${location}')",
        "diagnostic_questions": [
          { 
            "question": "${niche}-specific yes/no question (e.g., 'Do you hear gurgling sounds when you flush?')",
            "yes_action": "Specific action if YES",
            "no_action": "Specific action if NO"
          }
        ],
        "intro": "2-3 sentences about why this ${niche} guide exists and your expertise in ${location}",
        "common_mistakes": [
          { "title": "${niche}-specific mistake", "description": "2-3 sentences with specific ${niche} examples and typical cost of this mistake" }
        ],
        "quick_tips": [
          { "title": "${niche}-specific tip", "description": "Actionable advice with specific tools/methods a homeowner can use" }
        ],
        "case_study": {
          "customer_name": "First name only",
          "location": "Specific neighborhood in ${location} (e.g., 'North Side', 'Downtown')",
          "problem": "SPECIFIC ${niche} problem with details (e.g., 'Kitchen sink backed up, water pooling under cabinet for 2 days')",
          "solution": "Exactly what was done to fix it (e.g., 'Cleared 15-foot clog in main line, replaced corroded P-trap')",
          "result": "Specific outcome with numbers (e.g., 'Fixed in 2 hours, saved $1,200 vs competitor quote')"
        },
        "action_checklist": [
          "Specific ${niche} check #1 (e.g., 'Check under all sinks for moisture or drips')",
          "Specific ${niche} check #2 (e.g., 'Test water pressure at your outdoor spigot')"
        ],
        "coupon_code": "GUIDE15",
        "coupon_offer": "15% OFF Your First ${niche} Service",
        "coupon_expiry": "7 days from download",
        "price_ranges": [
          { "service": "Common ${niche} service", "range": "Realistic price range for this market" }
        ]
      },
      "lead_magnet_content": [
        { "title": "The Offer / Checklist", "body": "..." },
        { "title": "Why Choose Us", "body": "..." },
        { "title": "How to Redeem / Next Steps", "body": "..." }
      ],
      "landing_page": {
        "headline": "Catchy headline specific to ${niche} results in ${location}",
        "subheadline": "Persuasive subheadline with urgency",
        "hero_headline": "Main hero headline mentioning ${niche}",
        "hero_subheadline": "Supporting subheadline",
        "benefits": ["${niche}-specific benefit 1", "${niche}-specific benefit 2", "benefit 3", "benefit 4"],
        "cta_text": "Get Your Free ${niche} Guide",
        "urgency_text": "Limited spots available this week",
        "about_business": "2-3 sentences about your ${niche} expertise in ${location}"
      },
      "testimonials": [
        { "name": "First Name L.", "role": "Local Resident, ${location}", "content": "Specific praise about the ${niche} work with details...", "rating": 5, "avatar": "emoji" }
      ],
      "whatsapp_message": "Hi! I just downloaded your ${title} and I'd like to schedule a free ${niche.toLowerCase()} inspection in ${location}. When is your earliest availability?",
      "email_sequence": [
        { 
          "day": 1, 
          "subject": "Your ${title} is ready - here's what's inside", 
          "body": "Write a warm, personal welcome email (150-200 words). Start with 'Hey there!' Thank them for downloading. List 3 specific ${niche}-related things they'll learn from the guide. Add a personal note about your ${niche} experience in ${location}. End with 'Reply to this email if you have any questions - I read every message.' Sign off with a name."
        },
        { 
          "day": 2, 
          "subject": "The 3 questions you MUST ask before hiring a ${niche} professional in ${location}", 
          "body": "Write an educational email (200-250 words). Start with a hook. Share 3 ${niche}-specific questions they should ask any ${niche} provider (with explanations why each matters for ${niche} work). Include a brief story about a ${niche} job gone wrong. End with a CTA for free consultation."
        },
        { 
          "day": 3, 
          "subject": "[Case Study] How we solved a ${niche} emergency in ${location}", 
          "body": "Write a story-driven email (200-250 words). Create a realistic ${niche} case study with: Customer first name and neighborhood, The specific ${niche} problem, What you did to fix it (${niche}-specific details), The result with numbers. Include a short quote. End with CTA."
        },
        { 
          "day": 4, 
          "subject": "Special offer: 15% off ${niche} services (expires in 72 hours)", 
          "body": "Write an urgency-driven email (200-250 words). Introduce the coupon code and ${niche} offer. Create urgency with deadline and limited slots. Make the CTA crystal clear with phone number and code."
        },
        { 
          "day": 5, 
          "subject": "Final notice: Your ${niche} discount expires tonight", 
          "body": "Write a final urgency email (150-200 words). Last chance for the ${niche} service discount. Quick recap of offer. Social proof about other guide readers. P.S. with final deadline."
        }
      ]
    }
    
    REMEMBER: Every single piece of content must be obviously written for a ${niche} business in ${location}. 
    If someone reads this PDF, they should immediately know it's about ${niche} in ${location}, not generic services.
  `;

  const completion = await openai.chat.completions.create({
    messages: [
      { role: 'system', content: `You are a world-class copywriter for local businesses like ${niche}.` },
      { role: 'user', content: prompt }
    ],
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    temperature: 0.7
  });

  return JSON.parse(completion.choices[0].message.content);
}

/**
 * Main function to launch the business (generate assets)
 */
export async function launchBusiness(opportunity, sessionId, businessId) {
  console.log('🚀 Starting Launch Business...');
  
  try {
    // Update status
    await supabase.from('sessions').update({ stage: 'building', progress: 50 }).eq('id', sessionId);
    
    // Generate Content
    const funnelContent = await generateFunnelContent(opportunity);
    
    // Construct final business data
    const businessData = {
      ...opportunity,
      ...funnelContent,
      lead_magnet_url: "#", // Placeholder, would be a real PDF link in production
      website_url: `https://${opportunity.businessName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.launchfly.app`,
      leads_count: 0,
      views: 0
    };

    // Save to Database
    await supabase
      .from('businesses')
      .update({
        name: opportunity.businessName,
        business_data: businessData,
        status: 'ready'
      })
      .eq('id', businessId);

    // Complete Session
    await supabase.from('sessions').update({ stage: 'complete', progress: 100 }).eq('id', sessionId);
    
    console.log('✅ Business Launch Complete!');
    return businessData;

  } catch (error) {
    console.error("❌ Error launching business:", error);
    await supabase.from('sessions').update({ stage: 'error', error_message: error.message }).eq('id', sessionId);
    throw error;
  }
}
