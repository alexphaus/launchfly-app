import { NextResponse } from 'next/server';

// Quick scrape endpoint - extracts basic info WITHOUT AI generation
// Used by Hunter mode to auto-fill prospect form
export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Scrape the website
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LaunchflyBot/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();

    // Extract basic info using regex (no AI needed)
    const extractedData = {
      businessName: extractBusinessName(html, url),
      niche: extractNiche(html),
      location: extractLocation(html),
      phone: extractPhone(html),
      email: extractEmail(html),
      ownerName: extractOwnerName(html),
    };

    return NextResponse.json(extractedData);
  } catch (error: any) {
    console.error('Quick scrape error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to scrape website' },
      { status: 500 }
    );
  }
}

// Helper functions for extraction
function extractBusinessName(html: string, url: string): string {
  // Try title tag first
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    // Clean up common suffixes
    let title = titleMatch[1]
      .replace(/\s*[-|–]\s*Home.*$/i, '')
      .replace(/\s*[-|–]\s*About.*$/i, '')
      .replace(/\s*[-|–]\s*Welcome.*$/i, '')
      .trim();
    if (title.length > 3 && title.length < 100) {
      return title;
    }
  }

  // Try og:site_name
  const ogNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
  if (ogNameMatch?.[1]) {
    return ogNameMatch[1].trim();
  }

  // Fallback to domain name
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '').split('.')[0];
  } catch {
    return '';
  }
}

function extractNiche(html: string): string {
  const lowerHtml = html.toLowerCase();
  
  const niches = [
    { keywords: ['pest control', 'termite', 'anai-anai', 'kawalan serangga'], niche: 'Pest Control' },
    { keywords: ['aircon', 'air cond', 'aircond', 'penyaman udara', 'ac service'], niche: 'Aircon Service' },
    { keywords: ['plumb', 'paip', 'leak', 'bocor', 'pipe'], niche: 'Plumbing' },
    { keywords: ['renovation', 'remodel', 'ubahsuai', 'contractor'], niche: 'Renovation' },
    { keywords: ['cleaning', 'cleaner', 'pembersihan', 'cuci'], niche: 'Cleaning' },
    { keywords: ['electric', 'wiring', 'pendawaian', 'elektrik'], niche: 'Electrical' },
    { keywords: ['roof', 'bumbung', 'atap'], niche: 'Roofing' },
  ];

  for (const { keywords, niche } of niches) {
    if (keywords.some(k => lowerHtml.includes(k))) {
      return niche;
    }
  }

  return '';
}

function extractLocation(html: string): string {
  // Look for common location patterns
  const patterns = [
    // Malaysian states/cities
    /(?:selangor|kuala\s*lumpur|kl|johor|penang|perak|kedah|kelantan|melaka|negeri\s*sembilan|pahang|perlis|sabah|sarawak|terengganu)/gi,
    // Areas
    /(?:ampang|cheras|puchong|shah\s*alam|petaling\s*jaya|pj|subang|klang|kajang|bangi|cyberjaya|putrajaya)/gi,
    // Generic address patterns
    /(?:located\s+(?:in|at)\s+)([^,.]+)/i,
    /(?:serving\s+)([^,.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[0] || match?.[1]) {
      return (match[1] || match[0]).trim();
    }
  }

  return '';
}

function extractPhone(html: string): string {
  // Malaysian phone patterns
  const patterns = [
    /\+?60\s*[-.]?\s*1\d[-.\s]?\d{3,4}[-.\s]?\d{4}/g, // +60 1X-XXXX-XXXX
    /01\d[-.\s]?\d{3,4}[-.\s]?\d{4}/g, // 01X-XXXX-XXXX
    /\+?1[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, // US format
  ];

  for (const pattern of patterns) {
    const matches = html.match(pattern);
    if (matches?.length) {
      // Return first valid match, cleaned up
      return matches[0].replace(/[-.\s]/g, '').replace(/^0/, '+60');
    }
  }

  return '';
}

function extractEmail(html: string): string {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(emailPattern);
  
  if (matches?.length) {
    // Filter out common non-business emails
    const businessEmails = matches.filter(email => 
      !email.includes('example.com') &&
      !email.includes('wix.com') &&
      !email.includes('wordpress.com') &&
      !email.includes('sentry.io')
    );
    return businessEmails[0] || '';
  }

  return '';
}

function extractOwnerName(html: string): string {
  // Look for owner/founder patterns
  const patterns = [
    /(?:owner|founder|ceo|director)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:by|contact)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return '';
}
