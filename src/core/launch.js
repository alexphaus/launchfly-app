// src/core/launch.js
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Creates the business presence (website, etc.).
 * This is the "Launch" layer.
 * @param {object} opportunity - The business opportunity from the analyze step.
 * @param {string} sessionId - The current session ID.
 * @returns {Promise<object>} - A promise that resolves to the launched business data.
 */
export async function launchBusiness(opportunity, sessionId) {
  console.log('Launching business for session:', sessionId);

  // 1. Generate Website Content using AI
  const contentPrompt = `
    Generate the complete content for a modern, professional website for a business with the following details:
    Niche: ${opportunity.niche}
    Target Audience: ${opportunity.targetAudience}
    Unique Selling Proposition: ${opportunity.uniqueSellingProposition}
    Services: ${opportunity.potentialServices.join(', ')}

    Provide a JSON object with keys for:
    - heroTitle
    - heroSubtitle
    - featureGrid (an array of {icon, title, description})
    - pricingTable (an array of {name, price, period, features, ctaText})
    - aboutSection
    - contactEmail
  `;

  const contentResponse = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [{ role: "system", content: contentPrompt }],
    response_format: { type: "json_object" },
  });

  const websiteContent = JSON.parse(contentResponse.choices[0].message.content);

  // 2. Create a subdomain
  const subdomain = opportunity.niche.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // 3. Store the business data in Supabase
  const { data, error } = await supabase
    .from('businesses')
    .update({
      name: opportunity.niche,
      subdomain: subdomain,
      business_data: websiteContent,
      status: 'ready'
    })
    .eq('session_id', sessionId)
    .select()
    .single();

  if (error) {
    console.error('Error saving business data:', error);
    throw new Error('Failed to save business data.');
  }

  console.log('Business launched successfully:', data);
  return data;
}
