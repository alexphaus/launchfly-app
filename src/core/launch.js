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
  const { niche, targetAudience, problem, leadMagnet } = opportunity;
  const title = leadMagnet?.title || "The Ultimate Guide";
  
  console.log(`📝 Generating Funnel Content for: "${title}"...`);
  
  const prompt = `
    You are an expert marketing copywriter for LOCAL SERVICE BUSINESSES. 
    Create a complete "Lead Gen Funnel" for a ${niche} business targeting:
    - Niche: ${niche}
    - Audience: ${targetAudience}
    - Main Problem: ${problem}
    - Offer Title: ${title}

    IMPORTANT: The PDF should be a "10-minute treasure chest" - small, sharp, immediately usable.
    NOT a long report. NOT a boring brochure. A practical assistant that gives quick wins.
    
    Think of it as: "A friendly guide that whispers: You can fix small things alone… but if it gets serious, call us."

    CONVERSION FOCUS (2025 Best Practices):
    - Include a 3-question diagnostic that leads to a recommended action (book inspection, call now)
    - Add a coupon/voucher with urgency (limited time, limited slots)
    - Local proof with neighborhood-specific case study
    - Clear CTA that maps to booking/calling

    You must generate SIX things:
    
    1. **RICH PDF CONTENT** (8 pages worth of content):
       - Cover tagline (one powerful promise with outcome focus)
       - 3 Diagnostic questions (yes/no that lead to action recommendation)
       - Intro paragraph (why this guide exists, who made it)
       - 5 Common Mistakes people make (real problems, 2-3 sentences each)
       - 5 Quick Tips / Solutions (actionable advice anyone can do)
       - One Case Study (before/after story with SPECIFIC neighborhood/location and numbers)
       - 2-Item Action Checklist ("Do these 2 things NOW")
       - Coupon/Voucher details (code, offer, expiry)
       - Price ranges (general ballpark costs for common services)
       
    2. **LANDING PAGE COPY** (High converting, persuasive with urgency)
    
    3. **5-DAY EMAIL SEQUENCE** (To build trust and get them to CALL or BOOK, with scarcity in later emails)
    
    4. **3 CUSTOMER TESTIMONIALS** (Realistic, specific to this niche with local details)
    
    5. **COUPON/VOUCHER** (e.g., "15% off first service - Code GUIDE15 - Expires in 7 days")
    
    6. **WHATSAPP MESSAGE** (Prefilled message for click-to-chat)

    Return a VALID JSON object with this EXACT structure:
    {
      "lead_magnet_title": "[THE GUIDE TITLE]",
      "lead_magnet_pdf": {
        "cover_tagline": "One powerful promise line for the cover (outcome-focused)",
        "diagnostic_questions": [
          { 
            "question": "Yes/no question about their situation",
            "yes_action": "What to do if YES",
            "no_action": "What to do if NO"
          }
        ],
        "intro": "2-3 sentences about why this guide exists and who created it",
        "common_mistakes": [
          { "title": "Mistake name", "description": "2-3 sentences explaining this mistake and its cost" }
        ],
        "quick_tips": [
          { "title": "Tip name", "description": "Simple, actionable advice anyone can do" }
        ],
        "case_study": {
          "customer_name": "First name only",
          "location": "Specific neighborhood or street area (e.g., 'Oak Park', 'Downtown', 'Riverside District')",
          "problem": "What happened (be specific with details)",
          "solution": "How it was fixed (mention timeframe)",
          "result": "The outcome with specific numbers (e.g., 'saved $847', 'completed in 4 hours')"
        },
        "action_checklist": [
          "First thing to do right now",
          "Second thing to do right now"
        ],
        "coupon_code": "GUIDE15",
        "coupon_offer": "15% OFF Your First Service",
        "coupon_expiry": "7 days from download",
        "price_ranges": [
          { "service": "Service name", "range": "$XX - $XXX" }
        ]
      },
      "lead_magnet_content": [
        { "title": "The Offer / Checklist", "body": "..." },
        { "title": "Why Choose Us", "body": "..." },
        { "title": "How to Redeem / Next Steps", "body": "..." }
      ],
      "landing_page": {
        "headline": "Catchy headline focused on the result",
        "subheadline": "Persuasive subheadline with urgency",
        "hero_headline": "Main hero headline",
        "hero_subheadline": "Supporting subheadline",
        "benefits": ["benefit 1", "benefit 2", "benefit 3", "benefit 4"],
        "cta_text": "Get Your Free Guide",
        "urgency_text": "Limited spots available this week",
        "about_business": "2-3 sentences about the business expertise"
      },
      "testimonials": [
        { "name": "First Name L.", "role": "Local Resident, [Neighborhood]", "content": "Specific praise with local detail...", "rating": 5, "avatar": "emoji" }
      ],
      "whatsapp_message": "Hi! I just downloaded your [GUIDE NAME] and I'd like to schedule a free inspection. When is your earliest availability?",
      "email_sequence": [
        { 
          "day": 1, 
          "subject": "Your [GUIDE TITLE] is ready - here's what's inside", 
          "body": "Write a warm, personal welcome email (150-200 words). Start with 'Hey there!' Thank them for downloading. List 3 specific things they'll learn from the guide. Add a personal note like 'I created this guide because I've seen too many people get overcharged...' End with 'Reply to this email if you have any questions - I read every message.' Sign off with a name."
        },
        { 
          "day": 2, 
          "subject": "The 3 questions you MUST ask before hiring a [NICHE] professional", 
          "body": "Write an educational email (200-250 words). Start with a hook like 'Before you hire anyone for this type of work, read this...' Share 3 specific questions they should ask any provider (with explanations why each matters). Include a brief story about a customer who didn't ask these questions and what happened. End with 'We're happy to answer these questions for you - just give us a call for a free, no-pressure consultation.'"
        },
        { 
          "day": 3, 
          "subject": "[Case Study] How we helped a local customer save money", 
          "body": "Write a story-driven email (200-250 words). Create a realistic case study with: Customer first name and neighborhood, The problem they faced, What we did to help, The specific result (use numbers like 'saved $X' or 'completed in X days'). Include a short quote from the customer. End with 'Want results like this? We'd love to help you too. Reply to this email to get started.'"
        },
        { 
          "day": 4, 
          "subject": "Special offer: 15% off (expires in 72 hours)", 
          "body": "Write an urgency-driven email (200-250 words). Start with 'I wanted to reach out with something special...' Introduce the coupon code and offer. Explain WHY you're offering this deal (e.g., 'We have availability this week' or 'It's our way of saying thanks'). Create urgency: 'This offer expires in 72 hours.' Mention limited slots: 'We can only take 5 new clients this week.' Make the CTA crystal clear: 'Call us at [PHONE] and mention code GUIDE15 to claim your discount.' Add P.S. with reminder of the deadline."
        },
        { 
          "day": 5, 
          "subject": "Final notice: Your 15% discount expires tonight", 
          "body": "Write a final urgency email (150-200 words). Start with 'This is it...' Remind them this is the LAST chance for the discount. Quick recap: what they get (service) + the discount + the deadline. Add social proof: 'Several other guide readers have already claimed this offer.' Mention the coupon code again. Make it easy: 'One quick call or reply is all it takes.' P.S. 'After midnight tonight, this offer is gone. Don't miss out.'"
        }
      ]
    }
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
