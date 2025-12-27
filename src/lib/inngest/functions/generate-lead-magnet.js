import { inngest } from '../client';
import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import {
  detectCurrency,
  detectLanguage,
  detectBusinessType,
  isContentComplete
} from '@/lib/shared/lead-magnet-content-generator';

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
    const { businessId, topic, audience, language = 'English', sessionId, websiteUrl, businessContext, existingContent } = event.data;

    console.log(`🚀 [generate-lead-magnet] Starting for business: ${businessId}, session: ${sessionId}`);
    console.log(`📝 Topic: ${topic}, Audience: ${audience}`);

    if (!businessId || !topic) {
      console.error('❌ [generate-lead-magnet] Missing required fields');
      throw new Error('Missing required fields');
    }

    // FAST PATH: Check if existing content is already complete (from /sales/analyze)
    if (existingContent && isContentComplete(existingContent)) {
      console.log(`✅ [generate-lead-magnet] FAST PATH: Content already complete, skipping generation`);
      
      // Just set business to ready and session to complete
      await step.run('fast-path-activate', async () => {
        await supabase
          .from('businesses')
          .update({ status: 'ready' })
          .eq('id', businessId);
        
        if (sessionId) {
          await supabase
            .from('sessions')
            .update({ stage: 'complete', progress: 100 })
            .eq('id', sessionId);
        }
      });
      
      return { success: true, businessId, fastPath: true };
    }

    // SLOW PATH: Need to generate content
    console.log(`📝 [generate-lead-magnet] SLOW PATH: Generating new content`);

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

        // Use shared utility functions for currency and business type detection
        const detectedCurrency = detectCurrency(businessContext || websiteData?.bodyText || '');
        const businessType = detectBusinessType(topic, businessContext);
        const detectedLanguage = detectLanguage(businessContext || websiteData?.bodyText || '');

        // Extract event details from context (keep this inline since it's specific)
        const extractEventDetails = (context) => {
          if (!context) return null;
          const details = {};
          
          // Extract date
          const dateMatch = context.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{4})?/i);
          if (dateMatch) details.eventDate = `${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3] || '2026'}`;
          
          // Extract time
          const timeMatch = context.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)(?:\s*[–-]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))?)/i);
          if (timeMatch) details.eventTime = timeMatch[1];
          
          // Extract price
          const priceMatch = context.match(/(?:rm|usd|\$|€|£)\s*(\d+(?:\.\d{2})?)/i);
          if (priceMatch) {
            const currency = context.match(/(rm|usd|\$|€|£)/i)?.[1]?.toUpperCase() || '$';
            details.price = `${currency === 'RM' ? 'RM' : currency}${priceMatch[1]}`;
          }
          
          // Extract group price
          const groupMatch = context.match(/(?:rm|usd|\$|€|£)\s*(\d+)(?:\s*(?:for|per)\s*)?(?:\s*group|\d+\s*pax)/i);
          if (groupMatch) {
            const currency = context.match(/(rm|usd|\$|€|£)/i)?.[1]?.toUpperCase() || '$';
            details.groupPrice = `${currency === 'RM' ? 'RM' : currency}${groupMatch[1]}`;
          }
          
          // Extract group size
          const paxMatch = context.match(/(\d+)\s*pax/i);
          if (paxMatch) details.groupSize = paxMatch[1];
          
          // Extract venue
          const venueMatch = context.match(/(?:at|📍|venue:|location:)\s*([^,\n]+)/i);
          if (venueMatch) details.venue = venueMatch[1].trim();
          
          // Extract instructor/speaker
          const speakerMatch = context.match(/(?:with|featuring|by|instructor:)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
          if (speakerMatch) details.instructor = speakerMatch[1];
          
          return Object.keys(details).length > 0 ? details : null;
        };

        const eventDetails = businessType === 'event' ? extractEventDetails(businessContext) : null;
        console.log(`🎯 [generate-lead-magnet] Detected business type: ${businessType} for topic: ${topic}`);
        if (eventDetails) console.log(`📅 [generate-lead-magnet] Event details:`, eventDetails);

        // Build the appropriate prompt based on business type
        let prompt;
        
        if (businessType === 'event') {
          // ============ EVENT/WORKSHOP PROMPT ============
          prompt = `
          You are a world-class event marketing copywriter. Create a high-converting EVENT REGISTRATION page and promotional materials for: "${topic}".
          
          Target Audience: ${audience || 'People interested in this type of event'}
          Language: ${language}
          ${websiteContextBlock}
          ${businessContext ? `
          ============= CRITICAL: EVENT DETAILS FROM ORGANIZER =============
          ${businessContext}
          
          EXTRACT AND USE THESE EXACTLY:
          1. Event name/title (e.g., "Zumba Master Class")
          2. Exact date (e.g., "17 Jan 2026")
          3. Exact time (e.g., "6:00pm - 7:30pm")
          4. Exact pricing (e.g., "RM65 per person", "RM250 for group of 5")
          5. Venue/location
          6. Host/organizer name
          7. Guest instructor/speaker (if any)
          8. Registration method (PM, WhatsApp, link)
          
          DETECTED EVENT DETAILS:
          ${eventDetails ? JSON.stringify(eventDetails, null, 2) : 'No specific details extracted - infer from context'}
          ===================================================================
          ` : ''}
          
          CRITICAL EVENT-SPECIFIC INSTRUCTIONS:
          - This is an EVENT with a specific date, NOT an ongoing service
          - NO diagnostic questions or checklists (this isn't a service evaluation)
          - NO "common mistakes" section (irrelevant for events)
          - NO price comparison or "getting quotes" language
          - NO repair/maintenance/contractor language
          - CTA must be: "Reserve My Spot", "Register Now", "Book My Ticket" - NOT "Download Guide"
          - Focus on: Event excitement, what attendees will experience, FOMO, speaker/instructor credentials
          - Landing page IS the registration page (lead capture = event registration)
          
          CRITICAL CURRENCY INSTRUCTIONS:
          - Detected Currency: ${detectedCurrency.symbol} (${detectedCurrency.code})
          - Use EXACT prices from context (e.g., "${eventDetails?.price || 'RM65'}")
          - If group pricing exists, include it (e.g., "${eventDetails?.groupPrice || 'RM250'} for ${eventDetails?.groupSize || '5'} pax")
          
          CREATE FOR EVENT:
          - event_name: The exact event name/title
          - event_date: The exact date (e.g., "17 January 2026")
          - event_time: The exact time (e.g., "6:00pm - 7:30pm")
          - venue: Location/venue name
          - pricing_tiers: Individual and group pricing options
          - host_info: About the organizer/host
          - instructor_bio: About the guest instructor/speaker (if applicable)
          - what_to_expect: 4-5 bullet points about the event experience
          - who_is_this_for: 3-4 bullet points describing ideal attendees
          - faq: 4-5 common questions about the event
          - urgency_message: Limited spots/early bird messaging
          
          EMAIL SEQUENCE for EVENT (5 emails):
          - Day 1: Event announcement + registration link (deliver excitement, not a guide)
          - Day 2: About the instructor/host + why this event is special
          - Day 3: What to expect + testimonials from past events
          - Day 4: "Spots filling up" + FAQ answers
          - Day 5: Final reminder + last chance to register
          
          Return a JSON object with this EXACT structure:
          {
            "business_name": "The organizer/host name or brand",
            "business_type": "event",
            "event_name": "Exact event title (e.g., 'Zumba Master Class with Gerald Tay')",
            "event_date": "Exact date (e.g., '17 January 2026')",
            "event_time": "Exact time (e.g., '6:00pm - 7:30pm')",
            "venue": "Event location",
            "lead_magnet_title": "EVENT REGISTRATION: [Event Name]",
            "conversion_offer": {
              "headline": "${eventDetails?.price || 'RM65'} per person",
              "subheadline": "Group of ${eventDetails?.groupSize || '5'} pax: ${eventDetails?.groupPrice || 'RM250'}",
              "cta_text": "Reserve My Spot",
              "offer_code": null
            },
            "pdf_content": {
              "cover_tagline": "Exciting event tagline",
              "intro": "Brief description of the event and why it's special",
              "event_details": {
                "date": "Exact date",
                "time": "Exact time",
                "venue": "Location",
                "pricing": { "individual": "RM65", "group": "RM250 for 5 pax" }
              },
              "instructor_bio": "About the guest instructor/speaker with credentials",
              "what_to_expect": [
                { "title": "Experience point 1", "description": "What attendees will do/learn" }
              ],
              "who_is_this_for": [
                "Ideal attendee description 1",
                "Ideal attendee description 2"
              ],
              "testimonials": [
                { "name": "Past attendee", "quote": "Their experience" }
              ],
              "faq": [
                { "question": "Common question", "answer": "Helpful answer" }
              ],
              "registration_info": {
                "how_to_register": "PM us on WhatsApp / Click link",
                "payment_methods": "Online transfer, cash",
                "cancellation_policy": "Refund policy if any"
              },
              "action_checklist": ["Register today", "Save the date: ${eventDetails?.eventDate || '[Date]'}"]
            },
            "lead_magnet_content": [
              { "title": "Event Overview", "body": "..." },
              { "title": "What You'll Experience", "body": "..." },
              { "title": "Meet Your Instructor", "body": "..." }
            ],
            "landing_page": {
              "hero_headline": "Join Us for [Event Name] – [Date]!",
              "hero_subheadline": "Experience [benefit] with [instructor] at [venue]",
              "cta_text": "Reserve My Spot – ${eventDetails?.price || 'RM65'}",
              "event_date": "Exact date for prominent display",
              "event_time": "Exact time",
              "venue": "Location name",
              "pricing": {
                "individual": "${eventDetails?.price || 'RM65'} per person",
                "group": "${eventDetails?.groupPrice || 'RM250'} for group of ${eventDetails?.groupSize || '5'}"
              },
              "benefits": ["What you'll experience 1", "What you'll experience 2", "What you'll experience 3", "What you'll experience 4"],
              "instructor_name": "Guest instructor name",
              "instructor_bio": "Short compelling bio (max 60 words)",
              "about_host": "About the organizing business (max 40 words)",
              "trust_badges": ["X successful events", "Y happy attendees", "Z years experience"]
            },
            "email_sequence": [
              { "day": 1, "subject": "You're In! [Event Name] Registration Confirmed", "body": "Welcome email with event details" },
              { "day": 2, "subject": "Meet [Instructor Name]", "body": "About the instructor and why this event is special" },
              { "day": 3, "subject": "What to expect on [Date]", "body": "Preview of the experience + past testimonials" },
              { "day": 4, "subject": "Only [X] spots left!", "body": "FOMO + FAQ + encourage bringing friends" },
              { "day": 5, "subject": "See you tomorrow!", "body": "Final reminder with logistics (what to bring, parking, etc.)" }
            ]
          }
        `;
        } else if (businessType === 'coaching') {
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
        
        // Detect business type for saving (use AI response first, then detect from context)
        const savedBusinessType = content.business_type || (() => {
          const combinedText = `${topic || ''} ${businessContext || ''}`.toLowerCase();
          
          // Event detection
          const eventKeywords = ['event', 'workshop', 'webinar', 'seminar', 'master class', 'masterclass',
            'ticket', 'registration', 'zumba', 'yoga class', 'dance class', 'fitness class', 'jam session'];
          const eventPatterns = [/\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, /rm\s*\d+/i];
          const hasEventKeyword = eventKeywords.some(k => combinedText.includes(k));
          const hasEventPattern = eventPatterns.some(p => p.test(combinedText));
          if (hasEventKeyword && hasEventPattern) return 'event';
          
          // Coaching detection
          const coachingKeywords = ['coach', 'consultant', 'mentor', 'trainer', 'advisor', 'expert', 
            'strategist', 'therapist', 'counselor', 'speaker', 'author', 'creator'];
          if (coachingKeywords.some(k => combinedText.includes(k))) return 'coaching';
          
          return 'local_service';
        })();
        
        const { error: updateError } = await supabase
          .from('businesses')
          .update({
            name: businessName,
            status: 'ready',
            business_data: {
              ...currentData,
              businessName: businessName,
              businessType: savedBusinessType,
              // Save event-specific fields if this is an event
              eventName: content.event_name || null,
              eventDate: content.event_date || null,
              eventTime: content.event_time || null,
              venue: content.venue || null,
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
