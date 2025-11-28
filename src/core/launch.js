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

    You must generate FIVE things:
    
    1. **RICH PDF CONTENT** (8-12 pages worth of content):
       - Cover tagline (one powerful promise)
       - Intro paragraph (why this guide exists, who made it)
       - 5-7 Common Mistakes people make (real problems, 2-3 sentences each)
       - 5-7 Quick Tips / Solutions (actionable advice anyone can do)
       - One Case Study (before/after story with specific details)
       - 2-Item Action Checklist ("Do these 2 things NOW")
       - Price ranges (general ballpark costs for common services)
       - FAQ (3-4 common questions answered)
       
    2. **LANDING PAGE COPY** (High converting, persuasive)
    
    3. **5-DAY EMAIL SEQUENCE** (To build trust and get them to CALL or BOOK)
    
    4. **3 CUSTOMER TESTIMONIALS** (Realistic, specific to this niche)
    
    5. **BONUS OFFER** (e.g., "Show this PDF for 10% off your first service")

    Return a VALID JSON object with this EXACT structure:
    {
      "lead_magnet_title": "${title}",
      "lead_magnet_pdf": {
        "cover_tagline": "One powerful promise line for the cover",
        "intro": "2-3 sentences about why this guide exists and who created it",
        "common_mistakes": [
          { "title": "Mistake name", "description": "2-3 sentences explaining this mistake and its cost" }
        ],
        "quick_tips": [
          { "title": "Tip name", "description": "Simple, actionable advice anyone can do" }
        ],
        "case_study": {
          "customer_name": "First name only",
          "location": "Neighborhood or city area",
          "problem": "What happened",
          "solution": "How it was fixed",
          "result": "The outcome with specific numbers if possible"
        },
        "action_checklist": [
          "First thing to do right now",
          "Second thing to do right now"
        ],
        "price_ranges": [
          { "service": "Service name", "range": "$XX - $XXX" }
        ],
        "faq": [
          { "question": "Common question?", "answer": "Clear, helpful answer" }
        ],
        "bonus_offer": "Special offer text (e.g., 'Show this PDF and get 10% off your first service')" 
      },
      "lead_magnet_content": [
        { "title": "The Offer / Checklist", "body": "..." },
        { "title": "Why Choose Us", "body": "..." },
        { "title": "How to Redeem / Next Steps", "body": "..." }
      ],
      "landing_page": {
        "headline": "Catchy headline focused on the result",
        "subheadline": "Persuasive subheadline",
        "hero_headline": "Main hero headline",
        "hero_subheadline": "Supporting subheadline",
        "benefits": ["benefit 1", "benefit 2", "benefit 3", "benefit 4"],
        "cta_text": "Get Your Free Guide",
        "about_business": "2-3 sentences about the business expertise"
      },
      "testimonials": [
        { "name": "First Name L.", "role": "Local Resident", "content": "Specific praise...", "rating": 5, "avatar": "emoji" }
      ],
      "email_sequence": [
        { "day": 1, "subject": "Here is your ${title}", "body": "..." },
        { "day": 2, "subject": "Before you hire a ${niche}...", "body": "..." },
        { "day": 3, "subject": "See our recent work", "body": "..." },
        { "day": 4, "subject": "Common mistakes to avoid", "body": "..." },
        { "day": 5, "subject": "Ready to schedule?", "body": "..." }
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
