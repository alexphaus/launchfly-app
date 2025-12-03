import { inngest } from '../client';
import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const generateLeadMagnet = inngest.createFunction(
  { id: 'generate-lead-magnet', name: 'Generate Lead Magnet' },
  { event: 'lead-magnet/generation.requested' },
  async ({ event, step }) => {
    const { businessId, topic, audience, language = 'English', sessionId } = event.data;

    if (!businessId || !topic) {
      throw new Error('Missing required fields');
    }

    // Update stage to generating
    await step.run('update-stage-generating', async () => {
       if (sessionId) {
         await supabase
          .from('sessions')
          .update({ stage: 'generating', progress: 20 })
          .eq('id', sessionId);
       }
    });

    const content = await step.run('generate-content', async () => {
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
              { "day": 3, "subject": "...", "body": "..." },
              { "day": 4, "subject": "...", "body": "..." },
              { "day": 5, "subject": "...", "body": "..." }
            ]
          }
        `;

        const completion = await openai.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'gpt-4-turbo-preview',
          response_format: { type: 'json_object' },
        });

        return JSON.parse(completion.choices[0].message.content);
    });

    await step.run('save-content', async () => {
        const { data: business, error: fetchError } = await supabase
            .from('businesses')
            .select('business_data')
            .eq('id', businessId)
            .single();
            
        if (fetchError) {
            console.error('Error fetching business:', fetchError);
            throw new Error('Failed to fetch business data');
        }

        const currentData = business?.business_data || {};
        
        const { error: updateError } = await supabase
          .from('businesses')
          .update({
            name: content.lead_magnet_title || 'Lead Magnet Funnel',
            status: 'ready',
            business_data: {
              ...currentData,
              leadMagnet: content,
              lead_magnet_title: content.lead_magnet_title,
              lead_magnet_content: content.lead_magnet_content,
              landing_page: content.landing_page,
              email_sequence: content.email_sequence
            }
          })
          .eq('id', businessId);
          
        if (updateError) {
            console.error('Error updating business:', updateError);
            throw new Error('Failed to update business: ' + updateError.message);
        }

        if (sessionId) {
          const { error: sessionError } = await supabase
            .from('sessions')
            .update({ stage: 'complete', progress: 100 })
            .eq('business_id', businessId);
            
          if (sessionError) {
             console.error('Error updating session:', sessionError);
             // Don't throw here, as business is already updated
          }
        }
    });

    return { success: true };
  }
);
