import { OpenAI } from 'openai';
import { scrapeWebsiteContent } from '@/lib/scraper';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Default expiry for prospect businesses (14 days)
const PROSPECT_EXPIRY_DAYS = 14;

export async function POST(request: Request) {
  try {
    const { url, businessName, niche, context, createPreview = true, images = [] } = await request.json();

    if (!url && !context) {
      return Response.json({ error: 'Either URL or Business Context is required' }, { status: 400 });
    }

    // 1. Scrape the website (if URL provided)
    let scrapedData: any = {
      title: '',
      description: '',
      headings: [],
      bodyText: '',
      email: '',
      phone: '',
      address: ''
    };

    if (url) {
      const scrapeResult = await scrapeWebsiteContent(url);
      if (scrapeResult) {
        scrapedData = scrapeResult;
      } else if (!context) {
         // If URL failed and no context, fail
         return Response.json({ error: 'Failed to scrape website and no context provided' }, { status: 400 });
      }
    }

    // 2. If context is provided but no URL/scraped data, first extract business info
    let extractedBusinessInfo: any = null;
    if (context && !scrapedData.title) {
      const extractionPrompt = `
        Extract the following business information from this text. Return ONLY a JSON object.
        
        TEXT:
        ${context}
        
        OUTPUT FORMAT (JSON):
        {
          "businessName": "The exact business name (e.g., 'Tip Top Aircon', 'ABC Plumbing')",
          "niche": "The business category (e.g., 'Aircon Service', 'Plumbing', 'Electrical')",
          "ownerName": "Owner name if mentioned, otherwise null",
          "email": "Email address if found, otherwise null",
          "phone": "ONLY THE FIRST/PRIMARY phone number found, in E.164 format (e.g. +60123456789). If multiple numbers exist, pick the FIRST one only. Do NOT concatenate multiple numbers.",
          "services": ["List of main services offered"],
          "location": "Service area or location if mentioned"
        }
      `;
      
      const extractionResult = await openai.chat.completions.create({
        messages: [{ role: 'user', content: extractionPrompt }],
        model: 'gpt-4-turbo-preview',
        response_format: { type: 'json_object' },
      });
      
      extractedBusinessInfo = JSON.parse(extractionResult.choices[0].message.content || '{}');
      console.log('📋 Extracted business info from context:', extractedBusinessInfo);
    }

    // 3. Resolve business name and niche - prioritize user input, then extracted, then scraped
    const resolvedBusinessName = businessName || extractedBusinessInfo?.businessName || scrapedData.title || 'Local Business';
    const resolvedNiche = niche || extractedBusinessInfo?.niche || 'Service Business';
    const resolvedEmail = extractedBusinessInfo?.email || scrapedData.email || '';
    // Safety: If multiple phone numbers were concatenated, take only the first one
    let rawPhone = extractedBusinessInfo?.phone || scrapedData.phone || '';
    // Match first valid phone number pattern (starts with + and digits, or just digits)
    const phoneMatch = String(rawPhone).match(/^\+?\d{10,15}/);
    const resolvedPhone = phoneMatch ? phoneMatch[0] : '';
    const resolvedOwnerName = extractedBusinessInfo?.ownerName || '';
    
    // 4. Detect currency from context
    const detectCurrency = (text: string) => {
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

    const detectedCurrency = detectCurrency(context || scrapedData.bodyText || '');
    
    // Language Detection (for cultural fit)
    // NOTE: Some tokens overlap across SEA languages (e.g. "kami" appears in both Malay and Filipino/Tagalog).
    // We bias toward ENGLISH for Philippines signals because many PH businesses operate in English.
    const detectLanguage = (text: string): { code: string; name: string; greeting: string } => {
      const lowerText = (text || '').toLowerCase();

      // Philippines / Luzon / PHP indicators (English-first)
      // Avoid misclassifying Filipino/Tagalog content as Malay due to shared words like "kami".
      const philippinesSignals = [
        'philippines',
        'luzon',
        'metro manila',
        'manila',
        'quezon',
        'cavite',
        'laguna',
        'bulacan',
        'pampanga',
        'batangas',
        '₱',
        'php',
        // common Tagalog/Filipino markers
        'salamat',
        'kumusta',
        'kamusta',
        'po',
        'opo',
        'pwede',
        'pwedeng',
        'tingin'
      ];
      if (philippinesSignals.some((s) => lowerText.includes(s))) {
        return { code: 'en', name: 'English', greeting: 'Hi' };
      }

      // Malay indicators
      if (
        lowerText.includes('salam') ||
        lowerText.includes('tuan') ||
        lowerText.includes('puan') ||
        lowerText.includes('anda') ||
        lowerText.includes('perkhidmatan') ||
        lowerText.includes('hubungi') ||
        lowerText.includes('paip') ||
        lowerText.includes('bocor') ||
        lowerText.includes('tersumbat') ||
        lowerText.includes('baiki') ||
        lowerText.includes('sedia') ||
        lowerText.includes('cepat') ||
        lowerText.includes('kemas') ||
        lowerText.includes('dipercayai')
      ) {
        return { code: 'ms', name: 'Bahasa Malaysia', greeting: 'Salam' };
      }

      // Spanish indicators
      if (
        lowerText.includes('hola') ||
        lowerText.includes('servicios') ||
        lowerText.includes('página') ||
        lowerText.includes('precio') ||
        lowerText.includes('contacto')
      ) {
        return { code: 'es', name: 'Spanish', greeting: 'Hola' };
      }

      // Indonesian indicators
      if (
        lowerText.includes('layanan') ||
        lowerText.includes('jasa') ||
        lowerText.includes('harga') ||
        lowerText.includes('kami menyediakan') ||
        lowerText.includes('hubungi kami')
      ) {
        return { code: 'id', name: 'Bahasa Indonesia', greeting: 'Halo' };
      }

      return { code: 'en', name: 'English', greeting: 'Hi' };
    };

    const detectedLanguage = detectLanguage(context || scrapedData.bodyText || '');
    
    // Extract brand slogan/tagline from context
    const extractSlogan = (text: string): string | null => {
      // Look for common slogan patterns
      const patterns = [
        /cepat\s*[-–]\s*kemas\s*[&dan]*\s*(?:boleh\s*)?dipercayai/i,
        /fast\s*[-–]\s*reliable/i,
        /trusted\s*&\s*reliable/i,
      ];
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[0];
      }
      return null;
    };

    const brandSlogan = extractSlogan(context || scrapedData.bodyText || '');

    // 5. Analyze and Generate Email with OpenAI
    const extractedServices = extractedBusinessInfo?.services?.join(', ') || '';
    const extractedLocation = extractedBusinessInfo?.location || '';
    
    const prompt = `
      You are a business consultant, NOT a marketing agency. You speak plain English, not "marketing jargon."

      CONTEXT:
      We build "Automated Quote/Capture Tools" ($97 one-time).
      We help local businesses capture the 95% of visitors who are just "price shopping" and aren't ready to call yet.

      TARGET BUSINESS:
      Name: ${resolvedBusinessName}
      URL: ${url || 'N/A'}
      Niche: ${resolvedNiche}
      Services Offered: ${extractedServices || 'N/A'}
      Service Area: ${extractedLocation || 'N/A'}
      Contact Email: ${resolvedEmail || 'N/A'}
      Contact Phone: ${resolvedPhone || 'N/A'}
      Owner Name: ${resolvedOwnerName || 'N/A'}
      Currency: ${detectedCurrency.symbol} (${detectedCurrency.code})
      Detected Language: ${detectedLanguage.name} (${detectedLanguage.code})
      Brand Slogan: ${brandSlogan || 'Not detected'}
      
      PROVIDED CONTEXT (User Input):
      ${context || 'N/A'}

      WEBSITE DATA (Scraped):
      Title: ${scrapedData.title}
      Description: ${scrapedData.description}
      Headings: ${scrapedData.headings.join(', ')}
      Content Snippet: ${scrapedData.bodyText.slice(0, 500)}...

      CRITICAL CURRENCY INSTRUCTION:
      - Use ${detectedCurrency.symbol} for ALL price mentions (not $ unless that's the detected currency)
      - Example: "${detectedCurrency.symbol}200 - ${detectedCurrency.symbol}400" for estimated values

      CRITICAL LANGUAGE INSTRUCTION:
      - Detected language: ${detectedLanguage.name} (${detectedLanguage.code})
      - If language is "Bahasa Malaysia" (ms), generate ALL PDF content (title, headlines, tips, mistakes, diagnostic questions) in MALAY
      - Keep the email/WhatsApp in English (for business owner) but PDF content should match customer language
      - If brand slogan detected: "${brandSlogan || 'None'}" - include it in the PDF footer
      - Example Malay PDF title: "Senarai Semak Paip 2025" instead of "2025 Plumbing Checklist"
      - Example Malay diagnostic: "Adakah air lambat turun?" instead of "Is water draining slowly?"

      TASK:
      1. CLEAN the business name. Remove "LLC", "Inc", "|", location suffixes (e.g. "in Kansas City"), and owner names (e.g. "by Dick Ray"). Keep it short and natural (e.g. "Tip Top Aircon").
      2. Identify a specific service they offer that is expensive or complex.
      3. Write a direct, short email to the owner using the CLEAN name.
      4. Generate a High-Value "Asset" preview.

      EMAIL REQUIREMENTS:
      - Structure: Use short paragraphs. MAX 2 sentences per paragraph.
      - Formatting: You MUST use double line breaks (\n\n) between sections.
      - Subject: "Question for [Clean Business Name]" or "Your business".
      - Salutation: "Hi Team," or "Hi [Owner Name]," (Use owner name if found in context or website).
      - Opening: State clearly what you saw. VARY PHRASING. e.g. "I saw you offer [Service] in [City]." or "I noticed you're doing [Service] in [City]."
      - The Problem: Explain they are losing visitors who aren't ready to buy yet. VARY YOUR PHRASING so it doesn't look automated.
        * Option A: "Your site is great for immediate buyers, but you're missing the 90% who are just price-shopping."
        * Option B: "I noticed you don't have a way to capture visitors who are just researching and not ready to call yet."
        * Option C: "You're likely losing a lot of leads who visit your site but leave because they aren't ready to book today."
      - The Solution: State you built a tool to fix this. VARY PHRASING.
        * Option A: "I built a [Short Asset Name] for [Clean Business Name] to capture these leads automatically."
        * Option B: "I created a [Short Asset Name] specifically for [Clean Business Name] to fix this."
        * Option C: "I went ahead and mocked up a [Short Asset Name] for [Clean Business Name] that grabs these emails."
      - The Link: "You can see the demo I made for you here:\n{{PREVIEW_LINK}}" (Link must be on its own line).
      - CTA: Low friction question. VARY PHRASING. e.g. "Worth a quick chat?" or "Mind if I send the file over?" or "Worth a look?"
      - Opt-Out: You MUST end with this exact P.S. line: "P.S. If you don't want me to follow up, just let me know and I'll cross you off the list."
      - Tone: Professional, direct, peer-to-peer. NO SLANG.
      - Length: Under 120 words.
      - CRITICAL: Do NOT repeat the full business name inside the asset name. Say "AC Cost Guide", NOT "Tip Top Aircon AC Cost Guide".

      WHATSAPP SCRIPT REQUIREMENTS:
      - Tone: Casual, helpful, "neighborly". NOT salesy. Like texting a friend.
      - Structure: Hook -> Pain -> Solution -> Link -> Soft Close.
      - Formatting: CRITICAL - Use double line breaks (\n\n) between every section. It must look like a chat message, not a paragraph.
      - If EVENT: Mention specific date/price if found (e.g. "Saw your event on Jan 17 for RM65"). Ask if they are handling registrations manually.
      - If SERVICE: Mention the specific service and location. Keep service name SHORT (e.g. "termite treatment" not "Prevention Subterranean / Soil Treatment (Termites)").
      - If COACH: Mention their recent content/topic.
      - Length: Short and punchy. MAX 6 lines of content.
      - Placeholder: Use {{PREVIEW_LINK}} for the link.
      
      THREE PSYCHOLOGICAL TRIGGERS (MUST HAVE ALL 3):
      1. RELEVANCE: Mention their specific service + location (short form)
      2. PAIN POINT: Add ONE line about their pain BEFORE the solution. Examples:
         * "Busy on job, miss WhatsApp leads?"
         * "Hard to reply fast when you're working on site?"
         * "Competitors reply faster and steal customers?"
         * "Ads bring inquiries but no time to follow up?"
      3. CURIOSITY: End with a soft binary question that forces opinion
      
      CALL-TO-ACTION (Use soft binary questions):
      - GOOD: "Want to test?", "Want a quick look?", "Mau tengok?", "Worth a try?"
      - BAD: "Boleh try?" (too passive), "Let me know" (no urgency)
      
      CULTURAL LANGUAGE FLAVOR (CRITICAL for SEA markets):
      - Detected Language: ${detectedLanguage.name} (${detectedLanguage.code})
      - Detected Currency: ${detectedCurrency.code}
      - Owner Name: ${resolvedOwnerName || 'Not found'}
      - PERSONALIZATION: If owner name is available, USE IT in the greeting!
        * With name: "Hi ${resolvedOwnerName ? resolvedOwnerName.split(' ')[0] : 'boss'} 👋" (preferred)
        * Without name: Fall back to "Hi boss 👋" (SEA-friendly)
      - IMPORTANT REGION OVERRIDE:
        * If Philippines/Luzon/PHP signals are present (currency PHP or mentions of Luzon/Philippines): keep the message ENGLISH-first.
        * Do NOT use Malay greetings like "Salam" in this case.
        * Optional Filipino/Tagalog flavor words (1-2 max): "boss", "pwede" (can), "tingin" (quick look), "salamat" (thanks).
      - If Malay (ms) detected (and NOT Philippines): Use English as main language but sprinkle 2-3 Malay "flavor words":
        * Soft words: "boleh" (can?), "tengok" (see/look?), "ok la?", "try?"
        * Example: "Want to tengok? 😄" or "Mau test?"
      - If Indonesian (id) detected: Use "Halo [Name/boss] 👋", "bisa" (can), "lihat" (see?)
      - If English: Keep it casual with "Hi boss 👋" or "Hey [Name]!"
      - AVOID corporate language. Sound like a helpful neighbor, not a salesperson.
      
      ROI/OUTCOME HOOK (CRITICAL - Contractors respond to numbers):
      - ALWAYS include a specific outcome number like "5-10 leads/week" or "2-3 extra jobs"
      - Place it after the solution line to show ROI
      - Examples:
        * "…so tak miss leads & senang dapat 5–10 inquiries weekly."
        * "…so you can capture 5-10 extra leads per week without lifting a finger."
        * "…2-3 extra jobs a week can cover your rent already."
      - This makes them SEE the value in numbers.
      
      WHATSAPP SCRIPT EXAMPLE FORMAT (SERVICE - BEST VERSION):
      "Salam ${resolvedOwnerName ? resolvedOwnerName.split(' ')[0] : 'boss'} 👋
      
      You still handling [short service name] jobs in [Area]?
      
      I made a WhatsApp booking page for [Business Name] that auto-replies & collects customer details while you're on the job — so tak miss leads & senang dapat 5-10 inquiries weekly.
      
      Want to see? 😄
      {{PREVIEW_LINK}}
      
      No monthly fees. You keep the tool. Mau test?"
      
      ALTERNATIVE OPENER (Yes/No operational question):
      "Salam [Name] 👋
      
      Still doing [service] around [Area]? Hard to reply fast when busy on job right?
      
      I built a simple tool for [Business] — auto-replies to WhatsApp leads so you don't miss customers. Most users get 5-10 extra inquiries weekly.
      
      Want a quick look?
      {{PREVIEW_LINK}}"

      LEAD MAGNET (ASSET) REQUIREMENTS:
      - Concept: 
        * If EVENT: "Event Ticket" or "Registration Pass"
        * If VISUAL/COACHING: "Expert Blueprint" or "Style Guide"
        * If SERVICE: "Self-Diagnostic Checklist" or "Pricing/Buying Guide"
      - Title: 
        * Event: "${resolvedBusinessName} [Event Name] Ticket"
        * Visual: "${resolvedBusinessName} 2025 Style Guide"
        * Service: "${resolvedBusinessName} 2025 [Service] Checklist"
      - Headline: Address a fear or a desire (e.g., "Don't Overpay for [Service]" or "Secure Your Spot Before It Sells Out")
      - Preview Content: 
        * Event: 3 reasons to attend (What you'll learn/experience)
        * Visual: 3 style tips or portfolio highlights
        * Service: 3 specific "Red Flags" or "Buying Checks"
      
      TESTIMONIAL GENERATION INSTRUCTIONS:
      - CRITICAL: Scan the PROVIDED CONTEXT for actual reviews/feedback. If found, use them.
      - If generating testimonials:
        * MUST mention the specific service (e.g. "termites", "leaky pipe", "wedding photos").
        * MUST mention the business name explicitly in at least one testimonial.
        * MUST sound like a real local customer, not a marketing bot.
        * BAD: "The service was excellent and professional."
        * GOOD: "${resolvedBusinessName} came out same-day to fix my AC. Saved me from the heat!"
      
      PDF CONTENT REQUIREMENTS:
      - Generate FULL PDF content for immediate download capability
      - CRITICAL: Generate REAL, SPECIFIC content for this business niche - NOT generic placeholders
      - common_mistakes: Write 3 SPECIFIC mistakes people make with ${resolvedNiche} (e.g., "Choosing the Cheapest Quote", "Skipping Annual Maintenance")
      - quick_tips: Write 3 SPECIFIC actionable tips for ${resolvedNiche} (e.g., "Check Your Filter Monthly", "Listen for Unusual Sounds")
      - price_ranges: Extract ACTUAL prices from the provided context if available. If context has prices like "RM90", "RM200", use THOSE EXACT values. If no prices in context, use realistic local market prices.
      - ALL prices MUST use ${detectedCurrency.symbol} currency symbol (e.g., "${detectedCurrency.symbol}90", "${detectedCurrency.symbol}200 - ${detectedCurrency.symbol}400")
      - DO NOT convert to USD. Keep original currency.
      - DO NOT use generic titles like "Mistake 1" or "Tip 1" - use DESCRIPTIVE titles
      - COUPON CODE: ALWAYS use clean, simple codes like "GUIDE15", "SAVE15", "DISKAUN15" (for Malay). NEVER create codes that look like "Ke" + businessName + year - just use standard discount codes.
      - event_details: If this is an EVENT, include date, time, venue, and pricing.
      - instructor_bio: If this is an EVENT or COACHING, include a bio for the instructor/coach.

      DESIGN & LAYOUT REQUIREMENTS:
      - Analyze the business type to determine the best layout mode:
        * "emergency": For urgent, trust-based services (e.g. Plumbers, Plumbing, HVAC, AC Repair, Electricians, Roofers, Locksmiths, Mechanics, Handyman, Cleaning, Pest Control). KEYWORDS: plumb, paip, bocor, repair, fix, service, contractor. Focus on speed, trust badges, and clear call-to-actions.
        * "visual": For aesthetic, portfolio-based businesses (e.g. Interior Design, Salons, Photography, Landscaping). Focus on high-quality imagery and elegance.
        * "event": For time-sensitive or class-based offerings (e.g. Yoga Classes, Zumba, Webinars, Workshops, Concerts). MUST have a specific DATE. Focus on countdowns, dates, and registration.
      - IMPORTANT: A plumbing service is ALWAYS "emergency", NOT "event". Only use "event" for businesses selling tickets to a specific date.
      - Select a "primary_color" that fits the industry (e.g. Blue/Red for emergency, Pastels/Black for visual, Vibrant colors for event).
      - Select a "font_style" (e.g. "bold" for emergency, "elegant" for visual, "modern" for event).
      
      OUTPUT FORMAT (JSON):
      {
        "design_preferences": {
          "layout_mode": "emergency | visual | event",
          "primary_color": "hex code",
          "font_style": "bold | elegant | modern",
          "language": "${detectedLanguage.code}",
          "brand_slogan": "The business's tagline/slogan if detected (e.g. 'Cepat - Kemas & Dipercayai')"
        },
        "analysis": {
          "primary_service": "The main high-ticket service identified from their website or context",
          "pain_point": "The specific worry a customer has about this service",
          "opportunity": "Why this asset would help them capture more leads",
          "business_type": "e.g. Residential Service, B2B, Retail, etc.",
          "estimated_value": "Estimated value using ${detectedCurrency.symbol} (e.g. ${detectedCurrency.symbol}200 - ${detectedCurrency.symbol}500)",
          "customer_demographic": "Who is their ideal customer? (e.g. Homeowners in [City], Small Business Owners)"
        },
        "email": {
          "subject": "...",
          "body": "..."
        },
        "whatsapp_script": "The generated WhatsApp opening message with cultural flavor",
        "whatsapp_followups": {
          "reply_interested": "Response when prospect asks 'How does it work?' - Explain value prop simply, mention one-time fee vs agency prices, end with soft close",
          "followup_1": "Send after 4-6 hours if seen but no reply. Re-open conversation with commitment question about their business.",
          "followup_2": "Send next day. Ask about their ideal number of leads/week (5? 10? 20?)",
          "followup_3": "Final follow-up. Low-risk offer: 'We test small first — if you get customers, good for you. If not, no pay.'"
        },
        "lead_magnet": {
          "title": "Title in ${detectedLanguage.name} (e.g. Malay: 'Senarai Semak Paip ${resolvedBusinessName} 2025', English: '${resolvedBusinessName}'s 2025 [Service] Checklist')",
          "headline": "Fear/desire headline in ${detectedLanguage.name} (e.g. Malay: 'Elak Paip Sumbat & Bau Busuk', English: 'Don't Overpay for Your Next [Service]')",
          "subheadline": "Benefit subtitle in ${detectedLanguage.name}",
          "benefits": ["Benefit 1 in ${detectedLanguage.name}", "Benefit 2", "Benefit 3"],
          "preview_tips": [
            {"title": "Warning Sign #1 in ${detectedLanguage.name}", "description": "Specific symptom to look for"},
            {"title": "Warning Sign #2", "description": "Another diagnostic check"},
            {"title": "Warning Sign #3", "description": "Third red flag"}
          ],
          "cta_text": "CTA in ${detectedLanguage.name} (e.g. Malay: 'Muat Turun Percuma', English: 'Get The Free Guide')"
        },
        "testimonials": [
          {
            "name": "Real Name if found, else Realistic Name (e.g. Sarah L.)",
            "role": "Relevant Role (e.g. Homeowner in [City])",
            "content": "Specific praise mentioning the SERVICE (e.g. 'termites', 'cleaning') and RESULT. If context has reviews, use them.",
            "avatar": "👩",
            "rating": 5
          },
          {
            "name": "Realistic Name (e.g. Mike T.)",
            "role": "Relevant Role",
            "content": "Another specific testimonial. Mention the BUSINESS NAME and a specific benefit (speed, price, honesty).",
            "avatar": "👨",
            "rating": 5
          },
          {
            "name": "Realistic Name (e.g. Emily R.)",
            "role": "Relevant Role",
            "content": "Third testimonial focusing on trust or expertise. Avoid generic phrases like 'highly recommended' without context.",
            "avatar": "👩‍🦰",
            "rating": 5
          }
        ],
        "pdf_content": {
          "language": "${detectedLanguage.code}",
          "cover_tagline": "A powerful subtitle for the cover page (IN ${detectedLanguage.name.toUpperCase()} if ms/id)",
          "intro": "A professional intro paragraph mentioning the business name (IN ${detectedLanguage.name.toUpperCase()} if ms/id).",
          
          // FOR EVENT layout_mode ONLY - extract from context:
          "event_name": "Name of the event (e.g. Zumba Master Class)",
          "event_details": {
            "date": "Extract exact date from context (e.g. 17 Jan 2025)",
            "time": "Extract time from context (e.g. 10:00 AM - 12:00 PM)",
            "venue": "Extract venue/location from context",
            "pricing": {
              "individual": "Extract individual price (e.g. RM65/pax)",
              "group": "Extract group price if available (e.g. RM55/pax for 3+)"
            }
          },
          "what_to_expect": [
            { "title": "Activity 1", "description": "What attendees will do/learn" },
            { "title": "Activity 2", "description": "Another activity" },
            { "title": "Activity 3", "description": "Third activity" }
          ],
          "instructor_bio": "Bio of the instructor/host. Extract from context if available.",
          "who_is_this_for": ["Target audience 1", "Target audience 2", "Target audience 3"],
          "faq": [
            { "question": "What should I bring?", "answer": "Relevant answer" },
            { "question": "Do I need experience?", "answer": "Relevant answer" },
            { "question": "Can I get a refund?", "answer": "Relevant answer" }
          ],
          "testimonials": [
            { "name": "Past attendee name", "quote": "Their feedback" }
          ],
          
          // FOR SERVICE/EMERGENCY layout_mode (IN ${detectedLanguage.name.toUpperCase()} if ms/id):
          "diagnostic_questions": [
            { "question": "Specific diagnostic in ${detectedLanguage.name} (e.g. Malay: 'Adakah air lambat turun atau berbau?')", "yes_action": "What to do if yes", "no_action": "What to do if no" },
            { "question": "Second diagnostic question in ${detectedLanguage.name}", "yes_action": "...", "no_action": "..." },
            { "question": "Third diagnostic question in ${detectedLanguage.name}", "yes_action": "...", "no_action": "..." }
          ],
          "common_mistakes": [
            { "title": "Mistake title in ${detectedLanguage.name}", "description": "Description in ${detectedLanguage.name}" },
            { "title": "Second mistake", "description": "..." },
            { "title": "Third mistake", "description": "..." }
          ],
          "quick_tips": [
            { "title": "Tip title in ${detectedLanguage.name}", "description": "Description in ${detectedLanguage.name}" },
            { "title": "Second tip", "description": "..." },
            { "title": "Third tip", "description": "..." }
          ],
          "case_study": {
            "customer_name": "Local customer name",
            "location": "Area/city",
            "problem": "What they faced",
            "solution": "How it was solved",
            "result": "The outcome"
          },
          "action_checklist": ["Step 1 to take", "Step 2 to take"],
          "price_ranges": [
            { "service": "Service name from context", "range": "${detectedCurrency.symbol}XX - ${detectedCurrency.symbol}YY" },
            { "service": "Another service", "range": "${detectedCurrency.symbol}XX - ${detectedCurrency.symbol}YY" },
            { "service": "Third service", "range": "${detectedCurrency.symbol}XX - ${detectedCurrency.symbol}YY" }
          ],
          "coupon_offer": "Special offer text",
          "coupon_code": "GUIDE15",
          "coupon_expiry": "7 days from download"
        },
        "lead_magnet_idea": "Short summary of the asset concept",
        "scrapedData": {
             "businessName": "Extracted Business Name",
             "email": "Extracted Email",
             "phone": "Extracted Phone",
             "ownerName": "Extracted Owner Name"
        }
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4-turbo-preview',
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    // 6. Create a prospect business with the generated funnel (if enabled)
    let previewUrl = null;
    let businessId = null;
    
    // Use the best available business name - already resolved above
    const finalBusinessName = resolvedBusinessName;
    const finalNiche = resolvedNiche;
    const finalEmail = resolvedEmail || result.scrapedData?.email || '';
    const finalPhone = resolvedPhone || result.scrapedData?.phone || '';
    const finalOwnerName = resolvedOwnerName || result.scrapedData?.ownerName || '';
    
    if (createPreview && result.lead_magnet) {
      const subdomain = `preview-${nanoid(8)}`.toLowerCase();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + PROSPECT_EXPIRY_DAYS);
      
      // Build business_data for the funnel - use finalBusinessName throughout
      const businessData = {
        businessName: finalBusinessName,
        niche: finalNiche,
        websiteUrl: url || '',
        email: finalEmail,
        phone: finalPhone,
        ownerName: finalOwnerName,
        currency: detectedCurrency.symbol,
        currencyCode: detectedCurrency.code,
        testimonials: result.testimonials || [],
        // Store uploaded images for PDF and landing page
        prospectImages: images || [],
        // Store the full PDF content for immediate PDF generation
        lead_magnet_title: result.lead_magnet.title,
        lead_magnet_pdf: result.pdf_content || {},
        leadMagnet: {
          lead_magnet: {
            title: result.lead_magnet.title,
            type: 'checklist',
            preview_tips: result.lead_magnet.preview_tips || []
          },
          landing_page: {
            hero_headline: result.lead_magnet.headline,
            hero_subheadline: result.lead_magnet.subheadline,
            benefits: result.lead_magnet.benefits || [],
            cta_text: 'Get Your Free Guide'
          },
          lead_magnet_pdf: result.pdf_content || {},
          // Pass images to landing page config
          images: images || []
        }
      };

      // Use a system user ID for prospect businesses (or create one)
      // First, try to get or create a system user for prospects
      let systemUserId = process.env.SYSTEM_USER_ID;
      
      if (!systemUserId) {
        // Fallback: get any existing user to own prospect businesses
        const { data: anyUser } = await supabase
          .from('profiles')
          .select('id')
          .limit(1)
          .single();
        
        systemUserId = anyUser?.id;
      }

      if (!systemUserId) {
        console.error('No system user available for prospect businesses');
      } else {
        const { data: business, error: bizErr } = await supabase
          .from('businesses')
          .insert({
            user_id: systemUserId,
            name: finalBusinessName,
            subdomain,
            status: 'prospect',
            source: 'sales-prospector',
            business_data: businessData,
            form_data: {
              niche: finalNiche,
              websiteUrl: url || '',
              prospectEmail: finalEmail,
              prospectPhone: finalPhone,
              prospectOwnerName: finalOwnerName,
              prospectAddress: scrapedData.address || extractedBusinessInfo?.location || '',
              context: context || ''
            },
            expires_at: expiresAt.toISOString()
          })
          .select()
          .single();

        if (!bizErr && business) {
          businessId = business.id;
          // Use www.launchfly.ai for preview links (not app.launchfly.ai)
          const baseUrl = process.env.PREVIEW_BASE_URL || 'https://www.launchfly.ai';
          previewUrl = `${baseUrl}/preview/${business.id}`;
          
          console.log(`✅ Created prospect business: ${businessId} (expires: ${expiresAt.toISOString()})`);
        } else {
          console.error('Failed to create prospect business:', bizErr);
        }
      }
    }

    // 6. Replace {{PREVIEW_LINK}} placeholder in email body and whatsapp script
    let finalEmailBody = result.email?.body || '';
    let finalWhatsappScript = result.whatsapp_script || '';
    
    if (previewUrl) {
      finalEmailBody = finalEmailBody.replace(/\{\{PREVIEW_LINK\}\}/g, previewUrl);
      finalWhatsappScript = finalWhatsappScript.replace(/\{\{PREVIEW_LINK\}\}/g, previewUrl);
    } else {
      // Remove P.S. line if no preview was created
      finalEmailBody = finalEmailBody.replace(/\n*P\.S\..*\{\{PREVIEW_LINK\}\}.*$/gim, '');
      finalWhatsappScript = finalWhatsappScript.replace(/\{\{PREVIEW_LINK\}\}/g, '[Link]');
    }

    return Response.json({ 
      ...result,
      email: {
        ...result.email,
        body: finalEmailBody
      },
      whatsapp_script: finalWhatsappScript,
      previewUrl,
      businessId,
      // Return the best resolved values for display
      scrapedData: {
        title: finalBusinessName,
        businessName: finalBusinessName,
        email: finalEmail,
        phone: finalPhone,
        ownerName: finalOwnerName,
        niche: finalNiche,
        location: extractedBusinessInfo?.location || scrapedData.address || ''
      }
    });

  } catch (error) {
    console.error('Sales analysis error:', error);
    return Response.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
