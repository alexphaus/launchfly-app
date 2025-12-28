import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Service type mapping for detection
const SERVICE_KEYWORDS: Record<string, string[]> = {
  pest_control: ['pest', 'termite', 'roach', 'ant', 'rodent', 'fumigation', 'disinfection', 'serangga', 'anai-anai', 'tikus'],
  aircon: ['aircon', 'air-con', 'air con', 'ac service', 'hvac', 'cooling', 'aircond', 'pendingin'],
  plumbing: ['plumb', 'pipe', 'drain', 'leak', 'toilet', 'paip', 'bocor', 'tersumbat', 'tandas'],
  renovation: ['renovation', 'remodel', 'contractor', 'kitchen cabinet', 'interior', 'ubahsuai', 'kabinet'],
  cleaning: ['cleaning', 'cleaner', 'housekeep', 'maid', 'pembersihan', 'cuci'],
  electrical: ['electric', 'wiring', 'socket', 'fuse', 'elektrik', 'pendawaian'],
  roofing: ['roof', 'gutter', 'atap', 'bumbung'],
  landscaping: ['landscape', 'garden', 'lawn', 'tree', 'landskap', 'taman'],
  moving: ['moving', 'mover', 'relocation', 'pindah', 'lori'],
  auto_repair: ['auto', 'car', 'mechanic', 'workshop', 'kereta', 'bengkel'],
  locksmith: ['lock', 'key', 'kunci'],
};

/**
 * Lightweight website scraper - extracts business info only
 * Uses gpt-4o-mini for cost efficiency (~$0.001 per request vs ~$0.05 for full analysis)
 * NO preview generation - just collects data for outreach
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // 1. Scrape the website (simple fetch)
    let pageContent = '';
    let pageTitle = '';
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Launchfly/1.0)',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      const html = await response.text();
      
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      pageTitle = titleMatch ? titleMatch[1].trim() : '';
      
      // Extract text content (strip HTML tags)
      pageContent = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000); // Limit to ~8k chars to keep costs down
        
    } catch (fetchErr: any) {
      return NextResponse.json({ 
        error: `Failed to fetch website: ${fetchErr.message}` 
      }, { status: 400 });
    }

    // 2. Use GPT-4o-mini to extract structured info (FAST & CHEAP)
    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are extracting business info from a website. Return ONLY valid JSON with these fields:
{
  "businessName": "string - the business name",
  "ownerName": "string or null - owner/contact name if found",
  "phone": "string or null - phone/WhatsApp number with country code",
  "area": "string or null - service area/location",
  "services": ["array of services offered"],
  "painSignals": ["array of pain signals: 'no_booking', 'whatsapp_only', 'slow_replies' etc"]
}

Focus on finding the phone number - look for WhatsApp links, tel: links, or phone patterns.
For Malaysian numbers, format as +60xxxxxxxxx.
For area, look for "cover area", "service area", location mentions.`
        },
        {
          role: 'user',
          content: `Website: ${url}\nTitle: ${pageTitle}\n\nContent:\n${pageContent}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 500,
    });

    const extracted = JSON.parse(extraction.choices[0].message.content || '{}');
    
    // 3. Detect service type from content
    const combinedText = `${pageTitle} ${pageContent} ${extracted.services?.join(' ') || ''}`.toLowerCase();
    let detectedServiceType = 'other';
    
    for (const [serviceType, keywords] of Object.entries(SERVICE_KEYWORDS)) {
      if (keywords.some(kw => combinedText.includes(kw))) {
        detectedServiceType = serviceType;
        break;
      }
    }

    // 4. Clean up phone number
    let phone = extracted.phone || '';
    if (phone) {
      // Remove non-digits except +
      phone = phone.replace(/[^\d+]/g, '');
      // Add +60 if Malaysian number without country code
      if (phone.match(/^0[1-9]\d{8,9}$/)) {
        phone = '+6' + phone;
      }
    }

    // 5. Detect pain signals
    const painSignals: string[] = extracted.painSignals || [];
    if (combinedText.includes('whatsapp') && !combinedText.includes('booking') && !combinedText.includes('form')) {
      if (!painSignals.includes('whatsapp_only')) painSignals.push('whatsapp_only');
    }
    if (!combinedText.includes('book') && !combinedText.includes('appointment') && !combinedText.includes('schedule')) {
      if (!painSignals.includes('no_booking')) painSignals.push('no_booking');
    }

    return NextResponse.json({
      businessName: extracted.businessName || pageTitle || 'Unknown Business',
      ownerName: extracted.ownerName || null,
      phone: phone || null,
      area: extracted.area || null,
      serviceType: detectedServiceType,
      services: extracted.services || [],
      painSignals,
      sourceUrl: url,
      notes: `Scraped from ${url}`,
    });

  } catch (err: any) {
    console.error('[scrape-light] Error:', err);
    return NextResponse.json({ 
      error: err.message || 'Failed to scrape website' 
    }, { status: 500 });
  }
}
