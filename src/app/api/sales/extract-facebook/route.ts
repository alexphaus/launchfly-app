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
- phone: WhatsApp or phone number (format with country code if possible, e.g., +60123456789)
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
- notes: Any additional useful context (services offered, years in business, etc.)

Be thorough but only include information that's clearly present in the context.
For serviceType, use 'other' if you can't confidently match to the list.
For phone, try to extract the full number with country code.

Respond with valid JSON only.`,
        },
        {
          role: 'user',
          content: `Extract business information from this Facebook content:\n\n${context}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const extracted = JSON.parse(content);

    // Validate and clean the response
    const result = {
      businessName: extracted.businessName || '',
      ownerName: extracted.ownerName || '',
      phone: cleanPhoneNumber(extracted.phone || ''),
      area: extracted.area || '',
      website: extracted.website || '',
      serviceType: SERVICE_TYPES.includes(extracted.serviceType) ? extracted.serviceType : 'other',
      painSignals: Array.isArray(extracted.painSignals) 
        ? extracted.painSignals.filter((s: string) => PAIN_SIGNALS.includes(s))
        : [],
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

// Clean phone number to standardized format
function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Handle Malaysian numbers
  if (cleaned.startsWith('60')) {
    cleaned = '+' + cleaned;
  } else if (cleaned.startsWith('0')) {
    // Convert local format to international
    cleaned = '+60' + cleaned.substring(1);
  } else if (!cleaned.startsWith('+') && cleaned.length >= 9) {
    // Assume Malaysian if no country code
    cleaned = '+60' + cleaned;
  }
  
  return cleaned;
}
