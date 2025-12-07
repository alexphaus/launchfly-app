import { inngest } from '../client';
import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Scrape website content for context
 * Extracts text, meta tags, and key information from a URL
 */
async function scrapeWebsiteContent(url) {
  if (!url) return null;
  
  try {
    // Normalize URL
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LaunchflyBot/1.0; +https://launchfly.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!response.ok) {
      console.log(`Website fetch failed: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Extract useful content from HTML
    const extracted = {
      title: '',
      description: '',
      headings: [],
      bodyText: '',
      phone: '',
      email: '',
      address: '',
      services: [],
    };
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) extracted.title = titleMatch[1].trim();
    
    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    if (descMatch) extracted.description = descMatch[1].trim();
    
    // Extract h1, h2, h3 headings
    const headingMatches = html.matchAll(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi);
    for (const match of headingMatches) {
      const heading = match[1].replace(/<[^>]+>/g, '').trim();
      if (heading && heading.length > 2 && heading.length < 200) {
        extracted.headings.push(heading);
      }
    }
    extracted.headings = extracted.headings.slice(0, 10); // Limit to 10
    
    // Extract phone numbers
    const phoneMatch = html.match(/(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
    if (phoneMatch) extracted.phone = phoneMatch[1];
    
    // Extract email
    const emailMatch = html.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) extracted.email = emailMatch[1];
    
    // Strip HTML tags and get body text (limited)
    let bodyText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit body text to ~2000 chars for context
    extracted.bodyText = bodyText.slice(0, 2000);
    
    // Look for common service-related keywords
    const servicePatterns = [
      /services?\s*(?:include|offered|we offer|our services)/gi,
      /we (?:specialize|provide|offer)/gi,
    ];
    
    console.log(`Website scraped successfully: ${extracted.title}`);
    return extracted;
    
  } catch (error) {
    console.error('Website scrape error:', error.message);
    return null;
  }
}

export const generateLeadMagnet = inngest.createFunction(
  { id: 'generate-lead-magnet', name: 'Generate Lead Magnet' },
  { event: 'lead-magnet/generation.requested' },
  async ({ event, step }) => {
    const { businessId, topic, audience, language = 'English', sessionId, websiteUrl, businessContext } = event.data;

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

    // Scrape website content if URL provided
    const websiteData = await step.run('scrape-website', async () => {
      if (!websiteUrl) return null;
      
      console.log(`Scraping website: ${websiteUrl}`);
      const scraped = await scrapeWebsiteContent(websiteUrl);
      
      if (scraped) {
        // Update progress
        if (sessionId) {
          await supabase
            .from('sessions')
            .update({ progress: 35 })
            .eq('id', sessionId);
        }
      }
      
      return scraped;
    });

    const content = await step.run('generate-content', async () => {
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
          ${websiteData.headings.length > 0 ? websiteData.headings.map(h => `- ${h}`).join('\n') : 'None extracted'}
          
          Website Content Summary:
          ${websiteData.bodyText || 'Could not extract'}
          
          IMPORTANT: Use the EXACT business name, phone, and details from above. 
          Match their tone and positioning. Reference specific services they mention.
          =====================================================================
          `;
        }

        const prompt = `
          You are a world-class direct response copywriter (like Dan Kennedy or Russell Brunson) for LOCAL SERVICE BUSINESSES. 
          Create a high-converting Lead Magnet Asset (Checklist, Price Guide, or Coupon) and Landing Page copy for a local business specializing in: "${topic}".
          
          Target Audience: ${audience || 'Local Homeowners'}
          Language: ${language}
          ${websiteContextBlock}
          ${businessContext ? `Additional Business Context from Owner: ${businessContext}` : ''}
          
          CRITICAL INSTRUCTIONS FOR EMAIL SEQUENCE:
          Write a 5-day "Soap Opera Sequence" that builds trust, agitates the problem, and sells the service.
          - Tone: Personal, empathetic, slightly informal but professional. Use "I" and "You".
          - Formatting: Short paragraphs. Punchy sentences.
          - Day 1 (The Delivery): Subject: Your [Asset Name] is inside! Body: Deliver the asset immediately. Then open a "loop" about a common mistake people make in this niche. Tease that you'll reveal it tomorrow.
          - Day 2 (The Problem/Drama): Subject: [Curiosity Hook about the mistake]. Body: Tell a quick story about a client who tried to DIY or ignored the problem and it cost them. Agitate the pain.
          - Day 3 (The Epiphany/Solution): Subject: The easy fix. Body: Explain that the solution isn't hard work, it's [Your Method/Service]. Soft pitch for a free quote/consultation.
          - Day 4 (Hidden Benefits): Subject: Imagine if... Body: Paint a picture of life AFTER the problem is solved. Focus on emotional benefits (peace of mind, pride, safety).
          - Day 5 (Urgency/Call to Action): Subject: Last chance? Body: Remind them that procrastination is the enemy. Direct call to action to book now before the schedule fills up.

          Also create a "conversion_offer" specifically for this niche to be used in Day 4 & 5.
          - For High Ticket (Real Estate, Law, Consulting): Offer a "Free Strategy Session", "Audit", or "Valuation". NO DISCOUNTS.
          - For Services (Cleaning, landscaping): Offer a "% Discount" or "Free Add-on".

          CRITICAL: Create rich content for a 8-page Premium PDF Guide.
          - diagnostic_questions: 3 "Yes/No" questions that help the user realize they have a problem.
          - common_mistakes: 5 mistakes people in this niche make (e.g. "Ignoring X", "Buying cheap Y").
          - quick_tips: 5 actionable tips they can do immediately.
          - case_study: A realistic success story (Problem -> Solution -> Result).
          - action_checklist: 2 immediate steps to take.
          - price_ranges: 5 typical service tiers in this niche (e.g. "Basic Inspection: $100-$200").
          
          Return a JSON object with this EXACT structure:
          {
            "business_name": "A professional business name for this ${topic} company (e.g. 'GreenScape Landscaping', 'ProClean Services')",
            "lead_magnet_title": "Catchy Title for the Asset",
            "conversion_offer": {
              "headline": "The main offer headline (e.g. Claim Your Free Home Valuation)",
              "subheadline": "Supporting text (e.g. Worth $500, yours free)",
              "cta_text": "Button Text (e.g. Book My Audit)",
              "offer_code": "Optional code (e.g. AUDIT25) or null if not needed"
            },
            "pdf_content": {
              "cover_tagline": "A powerful subtitle for the cover page",
              "intro": "A professional, empathetic introduction explaining why this guide exists and why the reader needs it.",
              "diagnostic_questions": [
                { "question": "...", "yes_action": "...", "no_action": "..." }
              ],
              "common_mistakes": [
                { "title": "...", "description": "..." }
              ],
              "quick_tips": [
                { "title": "...", "description": "..." }
              ],
              "case_study": {
                "customer_name": "...",
                "location": "...",
                "problem": "...",
                "solution": "...",
                "result": "..."
              },
              "action_checklist": ["Step 1...", "Step 2..."],
              "price_ranges": [
                { "service": "...", "range": "..." }
              ],
              "coupon_offer": "Same as conversion_offer.headline",
              "coupon_code": "Same as conversion_offer.offer_code",
              "coupon_expiry": "7 days from download"
            },
            "lead_magnet_content": [
              { "title": "Section 1", "body": "..." },
              { "title": "Section 2", "body": "..." },
              { "title": "Section 3", "body": "..." }
            ],
            "landing_page": {
              "hero_headline": "A compelling, niche-specific headline for ${topic} (e.g. 'Transform Your Lawn Into The Envy of The Neighborhood')",
              "hero_subheadline": "A benefit-focused subheadline specific to ${topic} (e.g. 'Download our free guide and discover the 5 secrets to a lush, maintenance-free lawn')",
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
        
        // Use AI-generated business_name or fallback to lead_magnet_title
        const businessName = content.business_name || content.lead_magnet_title || currentData.businessName || 'Local Business';
        
        const { error: updateError } = await supabase
          .from('businesses')
          .update({
            name: businessName,
            status: 'ready',
            business_data: {
              ...currentData,
              businessName: businessName,
              niche: currentData.niche || topic,
              leadMagnet: content,
              lead_magnet_title: content.lead_magnet_title,
              conversion_offer: content.conversion_offer,
              lead_magnet_pdf: content.pdf_content,
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
