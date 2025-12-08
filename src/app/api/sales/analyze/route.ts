import { OpenAI } from 'openai';
import { scrapeWebsiteContent } from '@/lib/scraper';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { url, businessName, niche } = await request.json();

    if (!url) {
      return Response.json({ error: 'URL is required' }, { status: 400 });
    }

    // 1. Scrape the website
    const scrapedData = await scrapeWebsiteContent(url);
    
    if (!scrapedData) {
      return Response.json({ error: 'Failed to scrape website' }, { status: 400 });
    }

    // 2. Analyze and Generate Email with OpenAI
    const prompt = `
      You are an expert sales copywriter specializing in cold outreach for local businesses.
      
      CONTEXT:
      We sell a "Done-For-You Lead Magnet Funnel" service ($97 one-time).
      It helps businesses capture leads who aren't ready to "Call Now" by offering a free PDF Guide/Checklist.
      
      TARGET BUSINESS:
      Name: ${businessName || scrapedData.title || 'Local Business'}
      URL: ${url}
      Niche: ${niche || 'Service Business'}
      
      WEBSITE DATA:
      Title: ${scrapedData.title}
      Description: ${scrapedData.description}
      Headings: ${scrapedData.headings.join(', ')}
      Content Snippet: ${scrapedData.bodyText.slice(0, 500)}...
      
      TASK:
      1. Analyze the website for "Lead Leaks" (e.g. only "Call Us" buttons, no email capture, generic contact form).
      2. Write a personalized cold email to the owner.
      
      EMAIL REQUIREMENTS:
      - Subject: Short, curiosity-inducing (e.g. "Question about [Business Name]", "Saw your site").
      - Opening: Reference something SPECIFIC from their site (a specific service, a review, their history, or location) to prove you looked.
      - The Problem: Gently point out they are losing leads who visit but aren't ready to call yet.
      - The Solution: Offer to send them a specific Lead Magnet idea (e.g. "I built a [Specific Niche] Checklist for you").
      - CTA: "Want me to send it over?" (Low friction, no link).
      - Tone: Helpful, casual, not "salesy".
      - Length: Under 150 words.
      
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
        "lead_magnet_idea": "..."
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4-turbo-preview',
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    return Response.json({ 
      ...result,
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
