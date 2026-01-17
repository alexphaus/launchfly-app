import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Service type mapping
const SERVICE_TYPES = [
  'pest_control',
  'aircon',
  'plumbing',
  'renovation',
  'cleaning',
  'electrical',
  'roofing',
  'landscaping',
  'moving',
  'auto_repair',
  'locksmith',
  'other',
];

// Pain signals we track
const PAIN_SIGNALS = [
  'pm_comments',    // "PM us" comments
  'slow_replies',   // Slow replies
  'no_booking',     // No booking system
  'whatsapp_only',  // WhatsApp only
  'bad_reviews',    // Bad reviews
  'missed_calls',   // Missed calls
  'no_website',     // No website
  'manual_quotes',  // Manual quoting
  'messy_schedule', // Messy schedule
  'broken_links',   // Broken links
];

export async function POST(req: NextRequest) {
  try {
    const { context } = await req.json();

    if (!context || context.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please provide more context to extract from' },
        { status: 400 }
      );
    }

    // Use gpt-4o-mini for cost-effective extraction
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at extracting business information from Facebook page content, posts, and comments. Return your response as a JSON object.

Extract the following fields from the provided context:
- businessName: The official business name
- ownerName: Owner/operator name if mentioned (look for "owner", "founder", or personal names responding to comments)
- phone: All found WhatsApp or phone numbers, comma separated (e.g. +60123456789, +60198765432). Format with country code if possible.
- email: Email address if found
- area: Service area/location (city, district, or region)
- website: Any website URL mentioned
- serviceType: Match to one of: ${SERVICE_TYPES.join(', ')}
- painSignals: Array of identified pain signals from: ${PAIN_SIGNALS.join(', ')}
  - pm_comments: If they say "PM us", "inbox", "DM for price"
  - slow_replies: If there are complaints about slow response or late replies
  - no_booking: If there's no mention of online booking/scheduling
  - whatsapp_only: If they only use WhatsApp for inquiries
  - bad_reviews: If there are negative reviews or complaints
  - missed_calls: If they mention being busy, missing calls, or "call back later"
  - no_website: If they don't have a website or only use Facebook/Instagram
  - manual_quotes: If they ask for details to "quote manually" or "check price"
  - messy_schedule: If they mention double booking, forgetting appointments, or "full schedule"
  - broken_links: If users complain about links not working
- reviews: Array of objects [{ author: string, rating: number, text: string, date: string }] trying to find positive feedback/testimonials in the text. Infer rating 5 if positive but not explicit.
- notes: Generate a RICH context summary for the AI preview generator. Include:
  * Services offered (with specific names, e.g., "termite treatment", "aircon servicing")
  * Years in business if mentioned
  * Pricing info if found (e.g., "RM90 for basic service")
  * Positive reviews or testimonials (quote them!)
  * Any unique selling points ("same day service", "24/7 available")
  * Operating hours if mentioned
  * Any complaints or negative feedback (helps identify pain points)
  Format this as structured bullet points for easy parsing.

Be thorough but only include information that's clearly present in the context.
For serviceType, use 'other' if you can't confidently match to the list.
For phone, try to extract all numbers, separated by commas.

Respond with valid JSON only.`,
        },
        {
          role: 'user',
          content: `Extract business information from this Facebook content:\n\n${context}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 800,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const extracted = JSON.parse(content);

    // Get location context for phone number formatting
    const locationContext = extracted.area || extracted.notes || context;

    // Validate and clean the response
    const result = {
      businessName: extracted.businessName || '',
      ownerName: extracted.ownerName || '',
      phone: cleanPhoneNumber(extracted.phone || '', locationContext),
      email: extracted.email || '',
      area: extracted.area || '',
      website: cleanWebsiteUrl(extracted.website || ''),
      serviceType: SERVICE_TYPES.includes(extracted.serviceType) ? extracted.serviceType : 'other',
      painSignals: Array.isArray(extracted.painSignals)
        ? extracted.painSignals.filter((s: string) => PAIN_SIGNALS.includes(s))
        : [],
      reviews: Array.isArray(extracted.reviews) ? extracted.reviews : [],
      notes: extracted.notes || '',
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Facebook extract error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract business info' },
      { status: 500 }
    );
  }
}

// Country code mapping based on location keywords
const COUNTRY_CODES: { [key: string]: string } = {
  'philippines': '+63',
  'manila': '+63',
  'makati': '+63',
  'cebu': '+63',
  'davao': '+63',
  'cagayan': '+63',
  'quezon': '+63',
  'pasig': '+63',
  'taguig': '+63',
  'ph': '+63',
  'malaysia': '+60',
  'kuala lumpur': '+60',
  'kl': '+60',
  'selangor': '+60',
  'johor': '+60',
  'penang': '+60',
  'my': '+60',
  'singapore': '+65',
  'sg': '+65',
  'indonesia': '+62',
  'jakarta': '+62',
  'id': '+62',
  'thailand': '+66',
  'bangkok': '+66',
  'th': '+66',
  'vietnam': '+84',
  'hanoi': '+84',
  'vn': '+84',
};

// Detect country code from location string
function detectCountryCode(location: any): string {
  if (!location || typeof location !== 'string') return '+60';

  const lower = location.toLowerCase();
  for (const [keyword, code] of Object.entries(COUNTRY_CODES)) {
    if (lower.includes(keyword)) {
      return code;
    }
  }
  // Default to Malaysia if no match
  return '+60';
}

// Clean phone number to standardized format
function cleanPhoneNumber(phone: any, location: any = ''): string {
  if (!phone || typeof phone !== 'string') return '';

  // Detect country code from location
  const countryCode = detectCountryCode(location);
  const countryDigits = countryCode.replace('+', '');

  // Split by comma if multiple numbers
  const numbers = phone.split(',').map(p => p.trim()).filter(Boolean);

  const cleanedNumbers = numbers.map(num => {
    // Remove all non-numeric characters except +
    let cleaned = num.replace(/[^\d+]/g, '');

    // If already has the correct country code, use it
    if (cleaned.startsWith(countryDigits)) {
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('0')) {
      // Convert local format (09xx) to international (+639xx)
      cleaned = countryCode + cleaned.substring(1);
    } else if (!cleaned.startsWith('+') && cleaned.length >= 9) {
      // No country code - use detected one
      cleaned = countryCode + cleaned;
    }

    return cleaned;
  });

  return cleanedNumbers.join(', ');
}

// Ensure website URL starts with https://
function cleanWebsiteUrl(url: any): string {
  if (!url || typeof url !== 'string') return '';
  let cleaned = url.trim();
  if (!cleaned.match(/^https?:\/\//i)) {
    cleaned = 'https://' + cleaned;
  }
  return cleaned;
}
