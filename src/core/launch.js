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

    Instead of a generic "guide", generate a "High-Value Local Offer" (e.g., "Free Inspection Checklist", "$50 Off Voucher", "Price Calculator", "Seasonal Maintenance Guide").

    You must generate FOUR things:
    1. The Asset/Offer Content (The actual coupon text, checklist items, or calculator logic description.)
    2. The Landing Page Copy (High converting, persuasive, focused on getting a QUOTE or CALL)
    3. A 5-Day Email Nurture Sequence (To build trust and get them to CALL or BOOK)
    4. 3 Realistic Customer Testimonials (Specific to this niche and offer)

    Return a VALID JSON object with this EXACT structure:
    {
      "lead_magnet_title": "${title}",
      "lead_magnet_content": [
        { "title": "The Offer / Checklist", "body": "..." },
        { "title": "Why Choose Us", "body": "..." },
        { "title": "How to Redeem / Next Steps", "body": "..." }
      ],
      "landing_page": {
        "headline": "Catchy headline focused on the result (e.g. 'Get Your Roof Fixed Today')",
        "subheadline": "Persuasive subheadline",
        "benefits": ["benefit 1", "benefit 2", "benefit 3"],
        "cta_text": "Get Quote Now"
      },
      "testimonials": [
        { "name": "Name", "role": "Local Resident / Homeowner", "content": "Specific praise about the ${niche} service...", "rating": 5 }
      ],
      "email_sequence": [
        { "day": 1, "subject": "Here is your ${title}", "body": "..." },
        { "day": 2, "subject": "Before you hire a ${niche}...", "body": "..." },
        { "day": 3, "subject": "See our recent work / Case Study", "body": "..." },
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
