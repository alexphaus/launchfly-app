// FAQ Handler for WhatsApp Bot
// Answers common questions from business profile data
// Uses AI to generate helpful responses but with strict guardrails

import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Known FAQ topics that we can answer
export type FAQTopic =
    | 'service_area'      // "Do you service Makati?"
    | 'hours'             // "What time do you work?"
    | 'payment'           // "Do you accept GCash?"
    | 'warranty'          // "Is there a warranty?"
    | 'pricing'           // Redirects to quote flow (no AI pricing)
    | 'services'          // "What services do you offer?"
    | 'booking'           // "How do I book?"
    | 'contact'           // "How can I reach you?"
    | 'unknown';          // Can't determine topic

// Business context for FAQ responses
export interface BusinessContext {
    name: string;
    niche: string;                    // e.g., 'Aircon Service'
    serviceAreas?: string[];          // e.g., ['Makati', 'Taguig', 'BGC']
    operatingHours?: string;          // e.g., '8am-6pm Mon-Sat'
    paymentMethods?: string[];        // e.g., ['Cash', 'GCash', 'Bank Transfer']
    warranty?: string;                // e.g., '30-day service warranty'
    services?: string[];              // e.g., ['Cleaning', 'Repair', 'Installation']
    ownerName?: string;
    phone?: string;
    notes?: string;                   // Rich context from FB extraction (services, reviews, etc)
}

// FAQ response result
export interface FAQResponse {
    canAnswer: boolean;               // Whether we can answer this
    answer: string;                   // The response text
    topic: FAQTopic;                  // Classified topic
    needsHuman: boolean;              // Should escalate to owner
}

/**
 * Handle FAQ questions using business context
 * SAFETY: Never generates prices or discounts
 */
export async function handleFAQ(
    question: string,
    business: BusinessContext
): Promise<FAQResponse> {

    // First, check for pricing questions - redirect to quote flow
    if (isPricingQuestion(question)) {
        return {
            canAnswer: true,
            answer: `For accurate pricing, please tell me what service you need and I'll get you a quote! 📋\n\nWhat can we help you with today?`,
            topic: 'pricing',
            needsHuman: false,
        };
    }

    // Try to answer from business data first
    const knownAnswer = getKnownAnswer(question, business);
    if (knownAnswer) {
        return knownAnswer;
    }

    // Use AI for complex questions
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: buildFAQSystemPrompt(business) },
                { role: 'user', content: question }
            ],
            temperature: 0.3,
            max_tokens: 200,
        });

        const answer = response.choices[0].message.content || '';

        // Safety check - if AI tried to mention prices, redirect
        if (containsPriceInfo(answer)) {
            return {
                canAnswer: true,
                answer: `I'd be happy to help with pricing! Let me connect you with ${business.ownerName || 'our team'} for an accurate quote. 📞`,
                topic: 'pricing',
                needsHuman: true,
            };
        }

        return {
            canAnswer: true,
            answer: answer,
            topic: 'unknown',
            needsHuman: false,
        };
    } catch (error) {
        console.error('❌ FAQ handler error:', error);
        return {
            canAnswer: false,
            answer: `Great question! Let me check with ${business.ownerName || 'the team'} and get back to you. 🙏`,
            topic: 'unknown',
            needsHuman: true,
        };
    }
}

/**
 * Check if question is about pricing
 */
function isPricingQuestion(question: string): boolean {
    const priceKeywords = [
        'how much', 'price', 'cost', 'rate', 'fee', 'charge',
        'magkano', 'hm po', 'presyo', 'bayad', 'discount', 'promo'
    ];
    const lower = question.toLowerCase();
    return priceKeywords.some(kw => lower.includes(kw));
}

/**
 * Check if AI response contains price information (safety check)
 */
function containsPriceInfo(text: string): boolean {
    // Check for currency symbols or words
    const pricePatterns = [
        /₱\s*\d+/,              // ₱500
        /php\s*\d+/i,           // PHP 500
        /rm\s*\d+/i,            // RM 500
        /\$\s*\d+/,             // $500
        /\d+\s*(pesos?|php)/i,  // 500 pesos
        /\d+\s*ringgit/i,       // 500 ringgit
    ];
    return pricePatterns.some(pattern => pattern.test(text));
}

/**
 * Get answer from known business data (no AI needed)
 */
function getKnownAnswer(question: string, business: BusinessContext): FAQResponse | null {
    const lower = question.toLowerCase();

    // Service area questions
    if (/where|area|location|service.*area|do you.*in|cavite|makati|manila|cebu/i.test(lower)) {
        if (business.serviceAreas?.length) {
            return {
                canAnswer: true,
                answer: `Yes! We service: ${business.serviceAreas.join(', ')} 📍\n\nIs your location in one of these areas?`,
                topic: 'service_area',
                needsHuman: false,
            };
        }
    }

    // Operating hours
    if (/what time|hours|open|schedule|available|working hours/i.test(lower)) {
        if (business.operatingHours) {
            return {
                canAnswer: true,
                answer: `We're available ${business.operatingHours} ⏰\n\nWould you like to book a slot?`,
                topic: 'hours',
                needsHuman: false,
            };
        }
    }

    // Payment methods
    if (/payment|pay|gcash|maya|cash|bank|credit|card/i.test(lower)) {
        if (business.paymentMethods?.length) {
            return {
                canAnswer: true,
                answer: `We accept: ${business.paymentMethods.join(', ')} 💳\n\nPayment is usually collected after service is completed.`,
                topic: 'payment',
                needsHuman: false,
            };
        }
    }

    // Warranty
    if (/warranty|guarantee|problem|issue|not working/i.test(lower)) {
        if (business.warranty) {
            return {
                canAnswer: true,
                answer: `${business.warranty} ✅\n\nIf you have any issues, just message us!`,
                topic: 'warranty',
                needsHuman: false,
            };
        }
    }

    // Services offered
    if (/what.*service|services|do you.*offer|can you/i.test(lower)) {
        if (business.services?.length) {
            return {
                canAnswer: true,
                answer: `We offer:\n${business.services.map(s => `• ${s}`).join('\n')}\n\nWhich service do you need?`,
                topic: 'services',
                needsHuman: false,
            };
        }
    }

    // How to book
    if (/how.*book|book|appointment|schedule.*service/i.test(lower)) {
        return {
            canAnswer: true,
            answer: `Booking is easy! 📅\n\n1. Tell me what service you need\n2. I'll show you available time slots\n3. Pick a slot and send your address\n\nWhat service would you like?`,
            topic: 'booking',
            needsHuman: false,
        };
    }

    return null; // No known answer
}

/**
 * Build system prompt for FAQ AI responses
 */
function buildFAQSystemPrompt(business: BusinessContext): string {
    const areas = business.serviceAreas?.join(', ') || 'various areas';
    const hours = business.operatingHours || 'regular business hours';
    const services = business.services?.join(', ') || 'various services';

    // Rich context from FB extraction (most valuable for answering questions)
    const notesContext = business.notes
        ? `\n\nADDITIONAL BUSINESS DETAILS (from their page):\n${business.notes}`
        : '';

    return `You are a helpful assistant for ${business.name}, a ${business.niche} business.

BUSINESS INFO:
- Service areas: ${areas}
- Operating hours: ${hours}  
- Services: ${services}
${notesContext}

RULES:
1. Be friendly and helpful
2. Keep responses SHORT (2-3 sentences max)
3. NEVER mention specific prices, costs, or discounts
4. If asked about pricing, say "I'll connect you with the team for accurate pricing"
5. End with a question to keep conversation going
6. Use emojis sparingly (1-2 max)
7. Match the user's language (English, Taglish, or Filipino)
8. Use local honorifics like 'Boss', 'Sir', 'Maam' naturally if the user uses them

CRITICAL - ONLY ANSWER FROM PROVIDED DATA:
9. If asked about services: ONLY say YES if the service is listed in ADDITIONAL BUSINESS DETAILS above
10. If asked about locations/areas: ONLY say YES if the area is mentioned in service_areas or notes
11. If the information is NOT in the data above, say "Let me check with the team and get back to you"
12. NEVER make up information or guess - stick strictly to what's provided

Respond naturally to the customer's question in their language style.`;
}

/**
 * Generate escalation message when human is needed
 */
export function generateEscalationMessage(business: BusinessContext): string {
    const owner = business.ownerName || 'our team';
    return `I want to make sure you get the best help! Let me connect you with ${owner} directly. They'll respond shortly. 🙏`;
}
