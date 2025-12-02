import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId, topic, audience, language = 'English' } = await request.json();

    if (!businessId || !topic) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`Genering lead magnet for business ${businessId} on topic: ${topic}`);

    const prompt = `
      You are an expert marketing strategist for LOCAL SERVICE BUSINESSES. Create a high-converting Lead Magnet Asset (Checklist, Price Guide, or Coupon) and Landing Page copy for a local business specializing in: "${topic}".
      
      Target Audience: ${audience || 'Local Homeowners'}
      Language: ${language}
      
      Return a JSON object with this EXACT structure:
      {
        "lead_magnet_title": "Catchy Title for the Asset",
        "lead_magnet_content": [
          { "title": "Section 1", "body": "..." },
          { "title": "Section 2", "body": "..." },
          { "title": "Section 3", "body": "..." }
        ],
        "landing_page": {
          "headline": "Main Headline for Landing Page",
          "subheadline": "Supporting subheadline",
          "cta_text": "Get My Free Quote / Guide",
          "benefits": ["Benefit 1", "Benefit 2", "Benefit 3"],
          "about_business": "Short professional bio for a local business in this niche (max 50 words)"
        },
        "email_sequence": [
          { "day": 1, "subject": "...", "body": "..." },
          { "day": 2, "subject": "...", "body": "..." },
          { "day": 3, "subject": "...", "body": "..." }
        ]
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4-turbo-preview', // Use a smart model
      response_format: { type: 'json_object' },
    });

    const content = JSON.parse(completion.choices[0].message.content);

    // Update business with this content
    // We'll store it in business_data json column
    
    const { data: business } = await supabase
        .from('businesses')
        .select('business_data')
        .eq('id', businessId)
        .single();

    const currentData = business?.business_data || {};
    
    // Store content in both old and new format for compatibility
    await supabase
      .from('businesses')
      .update({
        name: content.lead_magnet_title || 'Lead Magnet Funnel',
        status: 'active',
        business_data: {
          ...currentData,
          // New format
          leadMagnet: content,
          // Dashboard expected format
          lead_magnet_title: content.lead_magnet_title,
          lead_magnet_content: content.lead_magnet_content,
          landing_page: content.landing_page,
          email_sequence: content.email_sequence
        }
      })
      .eq('id', businessId);

    // Also update the session stage to complete
    await supabase
      .from('sessions')
      .update({ stage: 'complete', progress: 100 })
      .eq('business_id', businessId);

    console.log('Lead magnet generated successfully');

    return Response.json({ success: true });
  } catch (error) {
    console.error('Lead magnet generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}


