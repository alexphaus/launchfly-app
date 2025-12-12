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
    const { url, businessName, niche, createPreview = true } = await request.json();

    if (!url) {
      return Response.json({ error: 'URL is required' }, { status: 400 });
    }

    // 1. Scrape the website
    const scrapedData = await scrapeWebsiteContent(url);
    
    if (!scrapedData) {
      return Response.json({ error: 'Failed to scrape website' }, { status: 400 });
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
      URL: ${url}
      Niche: ${resolvedNiche}

      WEBSITE DATA:
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
      - Subject: "Question for [Clean Business Name]" or "Your website".
      - Salutation: "Hi Team," or "Hi [Owner Name],"
      - Opening: "I saw you offer [Specific Service] in [City]." (Prove you looked).
      - The Problem: "Your site is great for people ready to call *now*, but you're missing the 90% who are just price-shopping and leave without contacting you."
      - The Solution: "I built a [Short Asset Name] (e.g. 'AC Cost Guide') for [Clean Business Name] to capture these leads automatically."
      - The Link: "You can see the demo I made for you here:\n{{PREVIEW_LINK}}" (Link must be on its own line).
      - CTA: "Worth a quick chat to see how it works?"
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
          "primary_service": "The main high-ticket service identified from their website",
          "pain_point": "The specific worry a customer has about this service",
          "opportunity": "Why this asset would help them capture more leads"
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
        "lead_magnet_idea": "Short summary of the asset concept"
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
        websiteUrl: url,
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
              websiteUrl: url,
              prospectEmail: scrapedData.email,
              prospectPhone: scrapedData.phone
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
        title: scrapedData.title,
        email: scrapedData.email,
        phone: scrapedData.phone
      }
    });

  } catch (error) {
    console.error('Sales analysis error:', error);
    return Response.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
