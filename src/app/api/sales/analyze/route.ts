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
      You are an expert sales copywriter specializing in cold outreach for local businesses.
      
      CONTEXT:
      We sell a "Done-For-You Lead Magnet Funnel" service ($97 one-time).
      It helps businesses capture leads who aren't ready to "Call Now" by offering a free PDF Guide/Checklist.
      
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
      1. Analyze the website for "Lead Leaks" (e.g. only "Call Us" buttons, no email capture, generic contact form).
      2. Write a personalized cold email to the owner.
      3. Generate a COMPELLING lead_magnet preview that shows real value.
      
      EMAIL REQUIREMENTS:
      - Subject: Short, curiosity-inducing (e.g. "Question about [Business Name]", "Saw your site").
      - Opening: Reference something SPECIFIC from their site (a specific service, a review, their history, or location) to prove you looked.
      - The Problem: Gently point out they are losing leads who visit but aren't ready to call yet.
      - The Solution: Mention you've already built a specific Lead Magnet for them (VALUE FIRST approach).
      - P.S.: Include a P.S. at the end with text like "P.S. I already mocked up what this could look like for you: {{PREVIEW_LINK}}"
      - CTA: Invite them to check the link or reply.
      - Tone: Helpful, casual, not "salesy".
      - Length: Under 180 words (including P.S.).
      
      LEAD MAGNET REQUIREMENTS (this is what shows in the preview - make it SPECIFIC to their business):
      - Title: Must reference their actual business name or specific service (e.g. "${resolvedBusinessName} Customer's Guide to...")
      - Headline: Speak directly to their ideal customer's #1 problem
      - Benefits: Be specific to services they actually offer (reference their website headings)
      - Preview content: Give 3 genuinely useful tips their customers would value - this proves the quality
      
      OUTPUT FORMAT (JSON):
      {
        "analysis": {
          "strengths": ["..."],
          "weaknesses": ["..."],
          "opportunity": "..."
        },
        "email": {
          "subject": "...",
          "body": "..."
        },
        "lead_magnet": {
          "title": "Specific title using their business name (e.g. ${resolvedBusinessName}'s Guide to [Topic])",
          "headline": "Catchy landing page headline addressing their customer's main problem",
          "subheadline": "Benefit-focused subtitle specific to their services",
          "benefits": ["Specific benefit 1", "Specific benefit 2", "Specific benefit 3"],
          "preview_tips": [
            {"title": "Tip 1 title", "description": "Actionable tip specific to ${resolvedNiche}"},
            {"title": "Tip 2 title", "description": "Another valuable insight"},
            {"title": "Tip 3 title", "description": "Third helpful tip"}
          ],
          "cta_text": "Download Your Free Guide"
        },
        "lead_magnet_idea": "Short summary of the lead magnet concept"
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
