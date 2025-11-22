import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId, topic, language = 'English' } = await request.json();

    if (!businessId || !topic) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`Genering lead magnet for business ${businessId} on topic: ${topic}`);

    const prompt = `
      You are an expert marketing coach. Create a high-converting Lead Magnet (PDF Guide) and Landing Page copy for a coach specializing in: "${topic}".
      The content must be in ${language}.

      Return a VALID JSON object with this structure:
      {
        "landing_page": {
          "hero_headline": "Catchy headline (max 10 words)",
          "hero_subheadline": "Compelling subheadline addressing pain points (max 20 words)",
          "cta_text": "Action oriented button text",
          "benefits": ["benefit 1", "benefit 2", "benefit 3"],
          "about_coach": "Short professional bio for a coach in this niche (max 50 words)"
        },
        "lead_magnet": {
          "title": "Title of the guide",
          "description": "Short description",
          "content": [
            {"title": "Chapter 1: [Name]", "body": "Detailed content (approx 150 words)..."},
            {"title": "Chapter 2: [Name]", "body": "Detailed content (approx 150 words)..."},
            {"title": "Chapter 3: [Name]", "body": "Detailed content (approx 150 words)..."}
          ]
        },
        "email": {
          "subject": "Your Free Guide: [Title]",
          "body": "Email body delivering the guide. Use placeholders like {{name}} if needed. Keep it warm and professional."
        }
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
    
    await supabase
      .from('businesses')
      .update({
        business_data: {
          ...currentData,
          leadMagnet: content
        }
      })
      .eq('id', businessId);

    console.log('Lead magnet generated successfully');

    return Response.json({ success: true });
  } catch (error) {
    console.error('Lead magnet generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

