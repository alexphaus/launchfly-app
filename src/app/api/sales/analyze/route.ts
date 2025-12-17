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

    // 2. Analyze and Generate Email with OpenAI
    const resolvedBusinessName = businessName || scrapedData.title || 'Local Business';
    const resolvedNiche = niche || 'Service Business';
    
    const prompt = `
      You are a business consultant, NOT a marketing agency. You speak plain English, not "marketing jargon."

      CONTEXT:
      We build "Automated Quote/Capture Tools" ($97 one-time).
      We help local businesses capture the 95% of visitors who are just "price shopping" and aren't ready to call yet.

      TARGET BUSINESS:
      Name: ${resolvedBusinessName}
      URL: ${url || 'N/A'}
      Niche: ${resolvedNiche}
      
      PROVIDED CONTEXT (User Input):
      ${context || 'N/A'}

      WEBSITE DATA (Scraped):
      Title: ${scrapedData.title}
      Description: ${scrapedData.description}
      Headings: ${scrapedData.headings.join(', ')}
      Content Snippet: ${scrapedData.bodyText.slice(0, 500)}...

      TASK:
      1. CLEAN the business name. Remove "LLC", "Inc", "|", location suffixes (e.g. "in Kansas City"), and owner names (e.g. "by Dick Ray"). Keep it short and natural (e.g. "Dick Ray Plumbing").
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
      - CRITICAL: Do NOT repeat the full business name inside the asset name. Say "AC Cost Guide", NOT "Dick Ray Plumbing AC Cost Guide".

      LEAD MAGNET (ASSET) REQUIREMENTS:
      - Concept: It must be a "Self-Diagnostic Checklist" or a "Pricing/Buying Guide." NO GENERIC E-BOOKS.
      - Title: "${resolvedBusinessName} 2025 [Service] Checklist" or "Homeowner's Guide to [Service] Costs"
      - Headline: Address a fear or a desire (e.g., "Don't Overpay for [Service]" or "Is Your [System] Failing? 5 Warning Signs")
      - Preview Content: 3 specific "Red Flags" or "Buying Checks" a homeowner can do themselves. These should be DIAGNOSTIC (symptoms to look for), not generic advice.
      
      OUTPUT FORMAT (JSON):
      {
        "analysis": {
          "primary_service": "The main high-ticket service identified from their website or context",
          "pain_point": "The specific worry a customer has about this service",
          "opportunity": "Why this asset would help them capture more leads",
          "business_type": "e.g. Residential Service, B2B, Retail, etc.",
          "estimated_value": "Estimated value of a single customer for this service (e.g. $500 - $2,000)",
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

    // 3. Create a prospect business with the generated funnel (if enabled)
    let previewUrl = null;
    let businessId = null;
    
    if (createPreview && result.lead_magnet) {
      const subdomain = `preview-${nanoid(8)}`.toLowerCase();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + PROSPECT_EXPIRY_DAYS);
      
      // Build business_data for the funnel
      const businessData = {
        businessName: resolvedBusinessName,
        niche: resolvedNiche,
        websiteUrl: url || '',
        leadMagnet: {
          lead_magnet: {
            title: result.lead_magnet.title,
            type: 'checklist'
          },
          landing_page: {
            hero_headline: result.lead_magnet.headline,
            hero_subheadline: result.lead_magnet.subheadline,
            benefits: result.lead_magnet.benefits || [],
            cta_text: 'Get Your Free Guide'
          }
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
            name: resolvedBusinessName,
            subdomain,
            status: 'prospect',
            source: 'sales-prospector',
            business_data: businessData,
            form_data: {
              niche: resolvedNiche,
              websiteUrl: url || '',
              prospectEmail: result.scrapedData?.email || scrapedData.email,
              prospectPhone: result.scrapedData?.phone || scrapedData.phone,
              prospectAddress: scrapedData.address,
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

    // 4. Replace {{PREVIEW_LINK}} placeholder in email body
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
      scrapedData: {
        title: scrapedData.title || result.scrapedData?.businessName,
        email: scrapedData.email || result.scrapedData?.email,
        phone: scrapedData.phone || result.scrapedData?.phone,
        ownerName: result.scrapedData?.ownerName
      }
    });

  } catch (error) {
    console.error('Sales analysis error:', error);
    return Response.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
