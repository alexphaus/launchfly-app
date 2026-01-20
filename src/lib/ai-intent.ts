// AI Intent Classifier for WhatsApp Bot
// Uses gpt-4o-mini for cost-effective intent detection
// AI = Read-only (classifies intent). Backend = Controller (executes logic).

import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Intent types that the AI can classify
export type Intent =
    | 'SLOT_SELECTION'    // User selecting a time slot (1, 2, 3, or natural language)
    | 'ADDRESS'           // User providing their address
    | 'QUOTE_REQUEST'     // User asking for price/quote
    | 'FAQ'               // General questions about services
    | 'PRICE_OBJECTION'   // User thinks price is too high
    | 'CONFIRMATION'      // User confirming something (yes, ok, sure)
    | 'CANCELLATION'      // User wants to cancel
    | 'RESCHEDULE'        // User wants to change time/date
    | 'HUMAN_NEEDED'      // User is angry, confused, or needs escalation
    | 'GREETING'          // Simple hello/hi
    | 'STICKER_SCAN'      // Customer scanned QR sticker (trigger phrase)
    | 'STICKER_MENU'      // Customer selecting from sticker menu (1/2/3)
    | 'UNKNOWN';          // Can't determine intent


// Entities extracted from the message
export interface IntentEntities {
    slot_number?: number;           // 1, 2, or 3 if selecting a slot
    address_text?: string;          // Extracted address if providing location
    service_type?: string;          // Type of service mentioned
    question_topic?: string;        // FAQ topic (hours, location, warranty, etc.)
}

// Full classification result
export interface IntentClassification {
    intent: Intent;
    confidence: number;             // 0-1 confidence score
    entities: IntentEntities;
    reasoning?: string;             // Why this intent was chosen
}

// Context about the conversation state
export interface ConversationContext {
    customerStatus?: string;        // e.g., 'awaiting_slot', 'awaiting_address'
    hasQuote?: boolean;             // Whether quote was already sent
    availableSlots?: string[];      // Available slot options
    businessName?: string;          // Business name for context
    businessNiche?: string;         // e.g., 'aircon', 'pest_control'
}

/**
 * Classify user intent using GPT-4o-mini
 * This is READ-ONLY - it never generates user-facing responses
 */
export async function classifyIntent(
    message: string,
    context: ConversationContext = {}
): Promise<IntentClassification> {

    // Quick pattern matching for obvious cases (saves API calls)
    const quickMatch = quickPatternMatch(message, context);
    if (quickMatch) {
        console.log(`⚡ Quick match: ${quickMatch.intent}`);
        return quickMatch;
    }

    // Use AI for ambiguous messages
    try {
        const systemPrompt = buildSystemPrompt(context);

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1, // Low temp for consistent classification
            max_tokens: 200,
        });

        const content = response.choices[0].message.content;
        if (!content) {
            return { intent: 'UNKNOWN', confidence: 0, entities: {} };
        }

        const parsed = JSON.parse(content);

        console.log(`🤖 AI Intent: ${parsed.intent} (${parsed.confidence})`);

        return {
            intent: parsed.intent || 'UNKNOWN',
            confidence: parsed.confidence || 0.5,
            entities: parsed.entities || {},
            reasoning: parsed.reasoning,
        };
    } catch (error) {
        console.error('❌ Intent classification error:', error);
        return { intent: 'UNKNOWN', confidence: 0, entities: {} };
    }
}

/**
 * Quick pattern matching for obvious intents (saves API calls)
 */
function quickPatternMatch(
    message: string,
    context: ConversationContext
): IntentClassification | null {
    const text = message.toLowerCase().trim();

    // Button text - ignore these
    const buttonTexts = ['accept job', 'decline', 'view details', 'call customer', 'view dashboard'];
    if (buttonTexts.includes(text)) {
        return { intent: 'UNKNOWN', confidence: 1.0, entities: {} };
    }

    // STICKER SCAN - Customer scanned QR sticker (high priority check)
    // Also matches messages with [BIZ:id] tag
    if (/sticker|scanned.*sticker|service sticker|i scanned|\[biz:/i.test(text)) {
        return { intent: 'STICKER_SCAN', confidence: 1.0, entities: {} };
    }

    // STICKER MENU - When in sticker flow, 1/2/3 means menu selection, not slot
    // This must be checked BEFORE generic slot selection
    if (context.customerStatus === 'sticker_menu' && /^[123]$/.test(text)) {
        return {
            intent: 'STICKER_MENU',
            confidence: 1.0,
            entities: { slot_number: parseInt(text) }
        };
    }

    // Slot selection - aggressively match 1, 2, 3
    // We let the webhook handler decide if it's valid based on customer state
    if (/^[123]$/.test(text)) {
        return {
            intent: 'SLOT_SELECTION',
            confidence: 1.0,
            entities: { slot_number: parseInt(text) }
        };
    }

    // Simple greetings
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)[\s!]*$/i.test(text)) {
        return { intent: 'GREETING', confidence: 0.9, entities: {} };
    }

    // Price objection keywords
    if (/mahal|expensive|too much|discount|cheaper|less/i.test(text)) {
        return { intent: 'PRICE_OBJECTION', confidence: 0.8, entities: {} };
    }

    // Quote request patterns (Filipino + English)
    if (/hm po|how much|price|quote|estimate|magkano/i.test(text)) {
        return { intent: 'QUOTE_REQUEST', confidence: 0.9, entities: {} };
    }

    // Confirmation (includes "BOOK" for discount claims)
    // Only trigger if NOT awaiting address - "ok" when awaiting_address should ask for address
    if (/^(yes|ok|okay|sure|confirm|go|sige|oo|book|claim)[\\s!]*$/i.test(text)) {
        // If awaiting address, don't treat short confirmations as CONFIRMATION intent
        if (context.customerStatus === 'awaiting_address') {
            return null; // Let AI handle it or fall through to ADDRESS check
        }
        return { intent: 'CONFIRMATION', confidence: 0.9, entities: {} };
    }

    // Cancellation - must be explicit, not just "no"
    if (/^(cancel|nevermind|never mind|no need|hindi na|cancel na|don't need|ayaw ko na)[\\s!.]*$/i.test(text)) {
        return { intent: 'CANCELLATION', confidence: 0.8, entities: {} };
    }

    // Rescheduling patterns - be specific to avoid false positives
    if (/reschedule|rebook|move.*date|change.*date|change.*time|lipat|ibang araw|not available|busy.*that day|can't make it/i.test(text)) {
        return { intent: 'RESCHEDULE', confidence: 0.8, entities: {} };
    }

    // Address detection - if awaiting address and message is long enough
    if (context.customerStatus === 'awaiting_address' && text.length >= 10) {
        return {
            intent: 'ADDRESS',
            confidence: 0.7,
            entities: { address_text: message }
        };
    }

    return null; // No quick match, use AI
}

/**
 * Build system prompt for intent classification
 */
function buildSystemPrompt(context: ConversationContext): string {
    const statusContext = context.customerStatus
        ? `Current status: ${context.customerStatus}. `
        : '';

    const slotContext = context.availableSlots?.length
        ? `Available slots: ${context.availableSlots.join(', ')}. `
        : '';

    return `You are an intent classifier for a ${context.businessNiche || 'service'} business WhatsApp bot.

${statusContext}${slotContext}

Classify the user's message into ONE of these intents:
- SLOT_SELECTION: User is selecting a time slot (responds to slot options)
- ADDRESS: User is providing their address or location
- QUOTE_REQUEST: User is asking for price or quote
- FAQ: User has a question about services, hours, location, warranty, OR mentions a specific service (e.g., "repair", "cleaning")
- PRICE_OBJECTION: User thinks price is too expensive, asking for discount
- CONFIRMATION: User is confirming/agreeing to something
- CANCELLATION: User wants to cancel or stop
- RESCHEDULE: User wants to change time/date or says they are not available
- HUMAN_NEEDED: User is angry, confused, or request is complex
- GREETING: Simple hello/hi ONLY (no other content)
- UNKNOWN: Cannot determine intent

IMPORTANT CONTEXT:
- Match the user's language (English, Taglish, or Filipino)
- Look for Filipino keywords (magkano, mahal, saan, kailan, hindi pwede)

Return JSON only:
{
  "intent": "INTENT_NAME",
  "confidence": 0.0-1.0,
  "entities": {
    "slot_number": null or 1-3,
    "address_text": null or extracted address,
    "question_topic": null or faq topic
  },
  "reasoning": "brief explanation"
}

IMPORTANT: Never suggest prices or discounts. Only classify intent.`;
}

/**
 * Check if the intent requires human escalation
 */
export function shouldEscalate(classification: IntentClassification): boolean {
    return classification.intent === 'HUMAN_NEEDED' ||
        (classification.intent === 'UNKNOWN' && classification.confidence < 0.3);
}

/**
 * Check if intent is price-related (for discount logic)
 */
export function isPriceObjection(classification: IntentClassification): boolean {
    return classification.intent === 'PRICE_OBJECTION';
}
