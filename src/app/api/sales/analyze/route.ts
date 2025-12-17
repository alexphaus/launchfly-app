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
    const { url, businessName, niche, context, createPreview = true } = await request.json();

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
          "phone": "Phone number if found, otherwise null",
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
    const resolvedPhone = extractedBusinessInfo?.phone || scrapedData.phone || '';
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
      - Tone: Professional, direct, peer-to-peer. NO SLANG.
      - Length: Under 120 words.
      - CRITICAL: Do NOT repeat the full business name inside the asset name. Say "AC Cost Guide", NOT "Tip Top Aircon AC Cost Guide".

      LEAD MAGNET (ASSET) REQUIREMENTS:
      - Concept: It must be a "Self-Diagnostic Checklist" or a "Pricing/Buying Guide." NO GENERIC E-BOOKS.
      - Title: "${resolvedBusinessName} 2025 [Service] Checklist" or "Homeowner's Guide to [Service] Costs"
      - Headline: Address a fear or a desire (e.g., "Don't Overpay for [Service]" or "Is Your [System] Failing? 5 Warning Signs")
      - Preview Content: 3 specific "Red Flags" or "Buying Checks" a homeowner can do themselves. These should be DIAGNOSTIC (symptoms to look for), not generic advice.
      
      PDF CONTENT REQUIREMENTS:
      - Generate FULL PDF content for immediate download capability
      - CRITICAL: Generate REAL, SPECIFIC content for this business niche - NOT generic placeholders
      - common_mistakes: Write 3 SPECIFIC mistakes people make with ${resolvedNiche} (e.g., "Choosing the Cheapest Quote", "Skipping Annual Maintenance")
      - quick_tips: Write 3 SPECIFIC actionable tips for ${resolvedNiche} (e.g., "Check Your Filter Monthly", "Listen for Unusual Sounds")
      - price_ranges: Extract ACTUAL prices from the provided context if available. If context has prices like "RM90", "RM200", use THOSE EXACT values. If no prices in context, use realistic local market prices.
      - ALL prices MUST use ${detectedCurrency.symbol} currency symbol (e.g., "${detectedCurrency.symbol}90", "${detectedCurrency.symbol}200 - ${detectedCurrency.symbol}400")
      - DO NOT convert to USD. Keep original currency.
      - DO NOT use generic titles like "Mistake 1" or "Tip 1" - use DESCRIPTIVE titles
      
      OUTPUT FORMAT (JSON):
      {
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
        "lead_magnet": {
          "title": "Specific title using their business name (e.g. ${resolvedBusinessName}'s 2025 [Service] Checklist)",
          "headline": "Fear or desire headline (e.g. Don't Overpay for Your Next [Service])",
          "subheadline": "Benefit-focused subtitle specific to their services",
          "benefits": ["Specific benefit 1", "Specific benefit 2", "Specific benefit 3"],
          "preview_tips": [
            {"title": "Warning Sign #1", "description": "Specific symptom to look for (e.g. 'Is your AC making a buzzing sound?')"},
            {"title": "Warning Sign #2", "description": "Another diagnostic check"},
            {"title": "Warning Sign #3", "description": "Third red flag to watch for"}
          ],
          "cta_text": "Get The Free Guide"
        },
        "pdf_content": {
          "cover_tagline": "A powerful subtitle for the cover page",
          "intro": "A professional intro paragraph mentioning the business name.",
          "diagnostic_questions": [
            { "question": "Do you notice X symptom?", "yes_action": "What to do if yes", "no_action": "What to do if no" },
            { "question": "Has it been X months since Y?", "yes_action": "...", "no_action": "..." },
            { "question": "Are you experiencing Z?", "yes_action": "...", "no_action": "..." }
          ],
          "common_mistakes": [
            { "title": "Choosing the Cheapest Quote", "description": "Low prices often mean shortcuts. Always verify what's included." },
            { "title": "Skipping Regular Maintenance", "description": "Small issues become expensive repairs when ignored." },
            { "title": "Ignoring Warning Signs", "description": "Strange noises or smells mean something needs attention." }
          ],
          "quick_tips": [
            { "title": "Check Your Filter Monthly", "description": "A dirty filter reduces efficiency by up to 15%." },
            { "title": "Listen for Unusual Sounds", "description": "Buzzing or clicking often indicates loose parts." },
            { "title": "Monitor Your Bills", "description": "Sudden increases may signal inefficiency." }
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
          lead_magnet_pdf: result.pdf_content || {}
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

    // 6. Replace {{PREVIEW_LINK}} placeholder in email body
    let finalEmailBody = result.email?.body || '';
    if (previewUrl) {
      finalEmailBody = finalEmailBody.replace(/\{\{PREVIEW_LINK\}\}/g, previewUrl);
    } else {
      // Remove P.S. line if no preview was created
      finalEmailBody = finalEmailBody.replace(/\n*P\.S\..*\{\{PREVIEW_LINK\}\}.*$/gim, '');
    }

    return Response.json({ 
      ...result,
      email: {
        ...result.email,
        body: finalEmailBody
      },
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
