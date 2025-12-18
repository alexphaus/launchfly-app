import { inngest } from '../client';
import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

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

    console.log(`🚀 [generate-lead-magnet] Starting for business: ${businessId}, session: ${sessionId}`);
    console.log(`📝 Topic: ${topic}, Audience: ${audience}`);

    if (!businessId || !topic) {
      console.error('❌ [generate-lead-magnet] Missing required fields');
      throw new Error('Missing required fields');
    }

    // Update stage to generating
    await step.run('update-stage-generating', async () => {
      console.log('📊 [generate-lead-magnet] Step: update-stage-generating');
       if (sessionId) {
         await supabase
          .from('sessions')
          .update({ stage: 'generating', progress: 20 })
          .eq('id', sessionId);
       }
    });

    // Scrape website content if URL provided
    const websiteData = await step.run('scrape-website', async () => {
      if (!websiteUrl) {
        // Still update progress even if no website to scrape
        if (sessionId) {
          await supabase
            .from('sessions')
            .update({ progress: 35 })
            .eq('id', sessionId);
        }
        return null;
      }
      
      console.log(`Scraping website: ${websiteUrl}`);
      const scraped = await scrapeWebsiteContent(websiteUrl);
      
      // Update progress
      if (sessionId) {
        await supabase
          .from('sessions')
          .update({ progress: 35 })
          .eq('id', sessionId);
      }
      
      return scraped;
    });

    // Update progress before content generation
    await step.run('update-progress-content-gen', async () => {
      if (sessionId) {
        await supabase
          .from('sessions')
          .update({ progress: 50 })
          .eq('id', sessionId);
      }
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

        // Detect currency from business context
        const detectCurrency = (text) => {
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
        };

        const detectedCurrency = detectCurrency(businessContext || websiteData?.bodyText || '');

        // Detect business type from topic/niche
        const detectBusinessType = (topicText) => {
          if (!topicText) return 'local_service';
          const coachingKeywords = [
            'coach', 'coaching', 'consultant', 'consulting', 'mentor', 'mentoring',
            'trainer', 'training', 'advisor', 'advisory', 'expert', 'strategist',
            'therapist', 'counselor', 'counseling', 'speaker', 'author', 'creator',
            'influencer', 'educator', 'teacher', 'tutor', 'course', 'program',
            'mastermind', 'agency', 'freelancer', 'designer', 'developer', 'writer',
            'fitness coach', 'life coach', 'business coach', 'health coach',
            'career coach', 'executive coach', 'relationship coach', 'mindset',
            'transformation', 'personal development', 'self-help', 'wellness'
          ];
          const lower = topicText.toLowerCase();
          return coachingKeywords.some(k => lower.includes(k)) ? 'coaching' : 'local_service';
        };

        const businessType = detectBusinessType(topic);
        console.log(`🎯 [generate-lead-magnet] Detected business type: ${businessType} for topic: ${topic}`);

        // Build the appropriate prompt based on business type
        let prompt;
        
        if (businessType === 'coaching') {
          // ============ COACHING/CONSULTING PROMPT ============
          prompt = `
          You are a world-class direct response copywriter (like Russell Brunson or Amy Porterfield) for COACHES, CONSULTANTS, and ONLINE EXPERTS.
          Create a high-converting Lead Magnet Asset (Expert Guide, Framework, or Blueprint) and Landing Page copy for: "${topic}".
          
          Target Audience: ${audience || 'Aspiring professionals looking to transform their results'}
          Language: ${language}
          ${websiteContextBlock}
          ${businessContext ? `
          ============= CRITICAL: BUSINESS CONTEXT PROVIDED BY OWNER =============
          ${businessContext}
          
          INSTRUCTIONS FOR USING THIS CONTEXT:
          1. Extract the EXACT coach/expert name or brand from this context
          2. Use their EXACT methodology, framework, or approach names
          3. Reference their specific credentials and experience
          4. Include their contact details and social links
          5. Match their tone (professional, casual, inspirational, etc.)
          ========================================================================
          ` : ''}
          
          CRITICAL COACHING-SPECIFIC INSTRUCTIONS:
          - NO COUPONS OR DISCOUNTS (high-ticket positioning)
          - Focus on TRANSFORMATION, not transactions
          - Position as AUTHORITY, not service provider
          - CTA should be "Book a Strategy Call" or "Apply Now", NOT "Get a Quote"
          - Use aspirational language about achieving goals and overcoming struggles
          
          CRITICAL INSTRUCTIONS FOR EMAIL SEQUENCE:
          Write a 5-day nurture sequence that builds authority and guides toward booking a strategy call.
          - Tone: Expert but approachable. Empathetic to their struggles. Inspiring about their potential.
          - Formatting: Short paragraphs. Story-driven. Personal stories work well.
          - Day 1 (The Welcome): Subject: Here's your [Guide Name]. Body: Deliver warmly. Share why you created this. Hint at your transformation story.
          - Day 2 (The Story): Subject: How I [achieved result]. Body: Your personal transformation story. What you struggled with, what changed, where you are now.
          - Day 3 (The Framework): Subject: The #1 thing holding [audience] back. Body: Teach a key concept from your methodology. Give real value. Position yourself as the guide.
          - Day 4 (The Proof): Subject: How [client name] went from X to Y. Body: Client success story with specific results. Show the transformation is possible.
          - Day 5 (The Invitation): Subject: Is this you? Body: Describe their current struggle. Paint the vision of where they could be. Invite to a strategy call (no pressure, just exploration).

          Create a "conversion_offer" for coaches (NO DISCOUNTS):
          - Use: "Free Strategy Session", "Clarity Call", "Discovery Call", "Breakthrough Session"
          - Focus on VALUE of the call, not price

          CRITICAL: Create rich content for a 8-page Premium Expert Guide PDF.
          - framework_name: Name your signature methodology (e.g., "The 5-Step Transformation Method")
          - framework_steps: 5 steps in your methodology with descriptions
          - authority_bio: Compelling expert bio with credentials, results, and story
          - client_results: 3 specific client transformation stories
          - common_struggles: 5 struggles your audience faces (not "mistakes", use empathetic language)
          - quick_wins: 5 actionable tips they can implement today
          - case_study: A detailed client transformation story (Before -> Breakthrough -> After)
          - action_checklist: 2 immediate mindset/action steps
          - NO price_ranges (not relevant for coaching)
          - NO coupon_code or coupon_offer (high-ticket doesn't discount)
          
          Return a JSON object with this EXACT structure:
          {
            "business_name": "The coach/expert name or brand",
            "business_type": "coaching",
            "lead_magnet_title": "Catchy Title for the Expert Guide (e.g., 'The 5-Step Blueprint to [Result]')",
            "conversion_offer": {
              "headline": "Book Your Free Strategy Call",
              "subheadline": "Discover exactly how to [achieve result] in just [timeframe]",
              "cta_text": "Book My Free Call",
              "offer_code": null
            },
            "pdf_content": {
              "cover_tagline": "A powerful promise about transformation",
              "intro": "An inspiring introduction about why you created this guide and who it's for",
              "framework_name": "Your Signature Methodology Name",
              "framework_steps": [
                { "step": 1, "title": "Step name", "description": "What this step involves and why it matters" }
              ],
              "authority_bio": "Your compelling expert bio (credentials, story, results)",
              "common_struggles": [
                { "title": "Struggle name", "description": "Empathetic description of this challenge" }
              ],
              "quick_wins": [
                { "title": "Quick win", "description": "Actionable tip they can do today" }
              ],
              "client_results": [
                { "name": "Client name", "before": "Where they started", "after": "Their transformation", "quote": "Testimonial" }
              ],
              "case_study": {
                "customer_name": "Client name",
                "before": "Their situation before working with you",
                "breakthrough": "The key moment of change",
                "after": "Their results and transformation",
                "quote": "Their testimonial"
              },
              "action_checklist": ["Mindset shift or action step 1", "Mindset shift or action step 2"]
            },
            "lead_magnet_content": [
              { "title": "Section 1", "body": "..." },
              { "title": "Section 2", "body": "..." },
              { "title": "Section 3", "body": "..." }
            ],
            "landing_page": {
              "hero_headline": "A compelling transformation promise (e.g., 'Finally [Achieve Result] Without [Pain Point]')",
              "hero_subheadline": "For [audience] who want to [outcome] but struggle with [obstacle]",
              "cta_text": "Get My Free Blueprint",
              "benefits": ["Transformation benefit 1", "Transformation benefit 2", "Transformation benefit 3"],
              "about_coach": "Short inspiring bio positioning you as the trusted guide (max 60 words)",
              "trust_badges": ["As seen in X", "10,000+ clients helped", "Featured in Y"]
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
        } else {
          // ============ LOCAL SERVICE PROMPT (ORIGINAL) ============
          prompt = `
          You are a world-class direct response copywriter (like Dan Kennedy or Russell Brunson) for LOCAL SERVICE BUSINESSES. 
          Create a high-converting Lead Magnet Asset (Checklist, Price Guide, or Coupon) and Landing Page copy for a local business specializing in: "${topic}".
          
          Target Audience: ${audience || 'Local Homeowners'}
          Language: ${language}
          ${websiteContextBlock}
          ${businessContext ? `
          ============= CRITICAL: BUSINESS CONTEXT PROVIDED BY OWNER =============
          ${businessContext}
          
          INSTRUCTIONS FOR USING THIS CONTEXT:
          1. Extract the EXACT business name from this context
          2. Use the EXACT pricing/rates mentioned (DO NOT convert or change currency!)
          3. Use the EXACT services they list
          4. Use the service areas/locations they mention
          5. Include their contact details (phone, email, WhatsApp) in the guide
          6. Match their tone (professional, casual, bilingual, etc.)
          ========================================================================
          ` : ''}
          
          CRITICAL CURRENCY INSTRUCTIONS:
          - Detected Currency: ${detectedCurrency.symbol} (${detectedCurrency.code})
          - ALL prices in the PDF must use: ${detectedCurrency.symbol}
          - If pricing is provided in the context, use THOSE EXACT prices
          - Do NOT convert prices to USD or any other currency
          - Example format: "${detectedCurrency.symbol}200" or "${detectedCurrency.symbol}200-${detectedCurrency.symbol}400"
          
          CRITICAL INSTRUCTIONS FOR EMAIL SEQUENCE:
          Write a 5-day nurture sequence that builds trust and gently guides toward booking.
          - Tone: Personal, warm, conversational. Like a helpful neighbor, not a salesperson. Use "I" and "You".
          - Formatting: Short paragraphs. Natural sentences. NO ALL CAPS. Maximum 1 emoji per email.
          - AVOID spam triggers: No "limited time", "act now", "expires", "last chance", "urgent", "free" in subject lines.
          - Day 1 (The Welcome): Subject: Here's your [Asset Name]. Body: Deliver the asset warmly. Share a quick tip from the guide. Mention you'll share more helpful tips this week.
          - Day 2 (The Story): Subject: A quick story about [topic]. Body: Share a brief client story about a common problem and how it was resolved. Keep it educational, not salesy.
          - Day 3 (The Tip): Subject: Something most people miss. Body: Share a valuable insight or tip. Position yourself as the helpful expert. Soft mention that you're available if they have questions.
          - Day 4 (The Vision): Subject: What would it feel like if... Body: Paint a picture of life with the problem solved. Focus on peace of mind. Mention you offer free consultations.
          - Day 5 (The Invitation): Subject: Quick question for you. Body: Ask if they've had a chance to review the guide. Offer to answer any questions. Friendly invitation to schedule a call when they're ready.

          Also create a "conversion_offer" specifically for this niche to be used in Day 4 & 5.
          - For High Ticket (Real Estate, Law, Consulting): Offer a "Free Strategy Session", "Audit", or "Valuation". NO DISCOUNTS.
          - For Services (Cleaning, Aircon, landscaping): Offer a "% Discount" or "Free Add-on" related to their actual services.

          CRITICAL: Create rich content for a 8-page Premium PDF Guide.
          - diagnostic_questions: 3 "Yes/No" questions that help the user realize they have a problem (specific to ${topic}).
          - common_mistakes: 5 mistakes people in this niche make (e.g. "Ignoring X", "Buying cheap Y"). Make these SPECIFIC to ${topic}.
          - quick_tips: 5 actionable tips they can do immediately. Make these SPECIFIC to ${topic}.
          - case_study: A realistic success story (Problem -> Solution -> Result). Use local context if available.
          - action_checklist: 2 immediate steps to take.
          - price_ranges: Extract ACTUAL prices from the business context if provided. If not, use realistic local market prices in ${detectedCurrency.symbol} currency. Format: "${detectedCurrency.symbol}XX - ${detectedCurrency.symbol}YY"
          
          Return a JSON object with this EXACT structure:
          {
            "business_name": "Use the EXACT business name from context (e.g., 'Tip Top Aircon', not a made-up name)",
            "lead_magnet_title": "Catchy Title for the Asset using the actual business name",
            "currency": "${detectedCurrency.symbol}",
            "conversion_offer": {
              "headline": "The main offer headline (use actual services from context)",
              "subheadline": "Supporting text with pricing in ${detectedCurrency.symbol}",
              "cta_text": "Button Text (e.g. Book My Service)",
              "offer_code": "Optional code (e.g. GUIDE15) or null if not needed"
            },
            "pdf_content": {
              "cover_tagline": "A powerful subtitle for the cover page",
              "intro": "A professional, empathetic introduction explaining why this guide exists. Mention the business name and location.",
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
                "customer_name": "Local name appropriate for the region",
                "location": "Use actual service area from context if available",
                "problem": "...",
                "solution": "...",
                "result": "..."
              },
              "action_checklist": ["Step 1...", "Step 2..."],
              "price_ranges": [
                { "service": "Actual service from context", "range": "${detectedCurrency.symbol}XX - ${detectedCurrency.symbol}YY" }
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
              "hero_headline": "A compelling, niche-specific headline for ${topic} (e.g. 'Don't Overpay for Your Next Aircon Installation')",
              "hero_subheadline": "A benefit-focused subheadline specific to ${topic}",
              "cta_text": "Get My Free Guide",
              "benefits": ["Benefit 1", "Benefit 2", "Benefit 3"],
              "about_business": "Short professional bio using actual business details from context (max 50 words)"
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
        } // End of else block for local_service prompt

        console.log(`🤖 [generate-lead-magnet] Calling OpenAI for business: ${businessId}`);
        console.log(`💱 Detected currency: ${detectedCurrency.symbol} (${detectedCurrency.code})`);
        console.log(`🎯 Using ${businessType} prompt template`);
        
        const completion = await openai.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'gpt-4-turbo-preview',
          response_format: { type: 'json_object' },
        });

        console.log(`✅ [generate-lead-magnet] OpenAI response received for business: ${businessId}`);
        
        return JSON.parse(completion.choices[0].message.content);
    });

    // Update progress after content generated
    await step.run('update-progress-saving', async () => {
      if (sessionId) {
        await supabase
          .from('sessions')
          .update({ progress: 85 })
          .eq('id', sessionId);
      }
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
        
        // Detect business type for saving
        const businessType = content.business_type || (topic && (() => {
          const coachingKeywords = ['coach', 'consultant', 'mentor', 'trainer', 'advisor', 'expert', 'strategist', 'therapist', 'counselor', 'speaker', 'author', 'creator'];
          const lower = topic.toLowerCase();
          return coachingKeywords.some(k => lower.includes(k)) ? 'coaching' : 'local_service';
        })()) || 'local_service';
        
        const { error: updateError } = await supabase
          .from('businesses')
          .update({
            name: businessName,
            status: 'ready',
            business_data: {
              ...currentData,
              businessName: businessName,
              businessType: businessType,
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
            .eq('id', sessionId);
            
          if (sessionError) {
             console.error('Error updating session:', sessionError);
             // Don't throw here, as business is already updated
          }
        }
        
        console.log(`✅ [generate-lead-magnet] Complete for business: ${businessId}`);
    });

    // Send welcome email with dashboard and funnel links
    await step.run('send-welcome-email', async () => {
      // Fetch business with customer email
      const { data: business } = await supabase
        .from('businesses')
        .select('id, name, subdomain, business_data, session_id')
        .eq('id', businessId)
        .single();
      
      if (!business) {
        console.log('⚠️ [generate-lead-magnet] Business not found for welcome email');
        return;
      }
      
      // Get customer email from Stripe session stored in source field
      const { data: businessFull } = await supabase
        .from('businesses')
        .select('source')
        .eq('id', businessId)
        .single();
      
      let customerEmail = null;
      
      // Try to get email from Stripe session
      if (businessFull?.source?.startsWith('claimed-prospect:')) {
        const stripeSessionId = businessFull.source.replace('claimed-prospect:', '');
        try {
          const Stripe = (await import('stripe')).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
          const stripeSession = await stripe.checkout.sessions.retrieve(stripeSessionId);
          customerEmail = stripeSession.customer_details?.email || stripeSession.customer_email;
        } catch (e) {
          console.error('Failed to fetch Stripe session for email:', e.message);
        }
      }
      
      // Fallback: check if there's a user_id linked
      if (!customerEmail && business.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', business.user_id)
          .single();
        customerEmail = profile?.email;
      }
      
      if (!customerEmail) {
        console.log('⚠️ [generate-lead-magnet] No customer email found for welcome email');
        return;
      }
      
      const businessName = business.business_data?.businessName || business.name || 'Your Business';
      const dashboardUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || 'https://www.launchfly.ai'}/dashboard/${sessionId || business.session_id}`;
      const funnelUrl = `https://${business.subdomain}.launchfly.ai`;
      
      console.log(`📧 [generate-lead-magnet] Sending welcome email to: ${customerEmail}`);
      
      try {
        await resend.emails.send({
          from: 'Launchfly <hello@launchfly.ai>',
          to: customerEmail,
          subject: `🚀 Your Funnel is Ready: ${businessName}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #7c3aed; margin: 0;">🎉 Your Funnel is Live!</h1>
              </div>
              
              <p>Hey there!</p>
              
              <p>Great news – your <strong>${businessName}</strong> lead generation funnel is now fully set up and ready to start capturing leads!</p>
              
              <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
                <p style="color: white; margin: 0 0 15px 0; font-size: 16px;">Your Dashboard</p>
                <a href="${dashboardUrl}" style="display: inline-block; background: white; color: #7c3aed; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Go to Dashboard →</a>
              </div>
              
              <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #333;">🔗 Your Links</h3>
                <p style="margin: 8px 0;"><strong>Dashboard:</strong><br><a href="${dashboardUrl}" style="color: #7c3aed;">${dashboardUrl}</a></p>
                <p style="margin: 8px 0;"><strong>Your Funnel:</strong><br><a href="${funnelUrl}" style="color: #7c3aed;">${funnelUrl}</a></p>
              </div>
              
              <h3 style="color: #333;">📋 Quick Start Checklist</h3>
              <ul style="padding-left: 20px;">
                <li>✅ Share your funnel link on social media</li>
                <li>✅ Add it to your email signature</li>
                <li>✅ Connect your Stripe to accept payments</li>
                <li>✅ Set up your phone notifications in the dashboard</li>
              </ul>
              
              <p>Save this email – you can use these links anytime to access your dashboard and funnel.</p>
              
              <p>Questions? Just reply to this email!</p>
              
              <p style="margin-top: 30px;">
                Let's get you some leads! 🚀<br>
                <strong>The Launchfly Team</strong>
              </p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #888; font-size: 12px; text-align: center;">
                Launchfly - AI-Powered Lead Generation<br>
                <a href="https://www.launchfly.ai" style="color: #888;">www.launchfly.ai</a>
              </p>
            </body>
            </html>
          `
        });
        console.log(`✅ [generate-lead-magnet] Welcome email sent to: ${customerEmail}`);
      } catch (emailError) {
        console.error('❌ [generate-lead-magnet] Failed to send welcome email:', emailError.message);
        // Don't throw - email is nice to have but not critical
      }
    });

    return { success: true, businessId };
  }
);
