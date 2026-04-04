import { generateText } from 'ai';
import { deepseek, MINI_MODEL } from '@/lib/ai-provider';

/**
 * AI Receptionist Guardrails
 * 
 * This module provides "Safety Nets" to catch cases where the main AI 
 * fails to call tools despite obvious user intent.
 * 
 * Strategies:
 * 1. Regex Patterns: Fast, zero-cost, handles common English phrasing
 * 2. AI Classifier: Robust, handles all languages, slightly slower (fallback)
 * 3. Hallucination Detection: Checks if AI says "Done" without doing anything
 */

export interface StartGuardrailInput {
    message: string;
    history: any[];
    businessId: string;
    customerPhone: string;
}

export class Guardrails {
    
    /**
     * Detect if the main AI claimed to perform an action but didn't call the tool.
     * @param response The text response from the AI
     * @param toolCalls The list of tool calls actually made
     */
    static detectHallucination(response: string, toolCalls: any[]): { isHallucinating: boolean; type?: 'booking' | 'reschedule' | 'cancel' } {
        const responseLower = response.toLowerCase();
        const hasBookingTools = toolCalls.some(tc => 
            ['createBooking', 'rescheduleBooking', 'cancelBooking'].includes(tc.toolName)
        );

        if (hasBookingTools) return { isHallucinating: false };

        // Check for "Action Confirmed" language without tools
        const claimsBooking = (
            // "I have booked..."
            (responseLower.includes("i've") || responseLower.includes("i have")) && 
            (responseLower.includes('booked') || responseLower.includes('scheduled') || responseLower.includes('reserved'))
        ) || (
            // "Booking confirmed..."
            responseLower.includes('confirmed') && 
            (responseLower.includes('booking') || responseLower.includes('appointment'))
        ) || (
            // "Done! Your booking..."
            responseLower.includes('done') && 
            (responseLower.includes('booking') || responseLower.includes('appointment') || responseLower.includes('time'))
        );

        if (claimsBooking) return { isHallucinating: true, type: 'booking' };

        const claimsReschedule = (
            responseLower.includes('moved') || 
            responseLower.includes('rescheduled') || 
            responseLower.includes('changed your') ||
            (responseLower.includes('new time') && responseLower.includes('is set'))
        );

        if (claimsReschedule) return { isHallucinating: true, type: 'reschedule' };

        return { isHallucinating: false };
    }

    /**
     * Check if a message looks like a reschedule request using patterns.
     * This is the "Fast Path" for common English phrasing.
     */
    static looksLikeReschedule(message: string): boolean {
        const lower = message.toLowerCase().trim();
        
        // 1. Direct keywords
        if (lower.includes('reschedule')) return true;
        
        // 2. "Instead" pattern (strong signal)
        if (lower.includes('instead')) return true;
        
        // 3. Change/Move verbs
        if ((lower.includes('change') || lower.includes('move') || lower.includes('switch')) && 
            (lower.includes('time') || lower.includes('date') || lower.includes('to') || lower.includes('it') || lower.includes('slot'))) {
            return true;
        }

        // 4. "Can it be X?" (Polite request)
        if (lower.startsWith('can it be') || lower.startsWith('could it be')) {
            return true;
        }
        
        // 5. "Actually X" (Correction)
        if (lower.startsWith('actually')) return true;

        // 6. Negatives about current slot
        if (lower.includes("can't make") || lower.includes("cannot make") || lower.includes("won't be able")) {
            return true;
        }
        
        // 7. "Doesn't work"
        if (lower.includes("doesn't work") || lower.includes("does not work")) {
            return true;
        }

        return false;
    }

    /**
     * Check if a message looks like a slot selection (1, 2, "morning").
     */
    static looksLikeSlotSelection(message: string, lastBotMessage: string): boolean {
        const lower = message.toLowerCase().trim();
        
        // Context check: Did we just show slots?
        const showedSlots = lastBotMessage.toLowerCase().includes('available') || 
                           lastBotMessage.includes('1️⃣') || 
                           lastBotMessage.includes('morning') || 
                           lastBotMessage.includes('afternoon');

        if (!showedSlots) return false;

        // Pattern matching
        return (
            /^[1-4]$/.test(lower) || // "1", "2"
            /^option\s*[1-4]$/.test(lower) ||
            lower === 'morning' || lower === 'afternoon' ||
            lower === 'tomorrow' || lower === 'today' ||
            lower.startsWith('first') || lower.startsWith('second') ||
            lower === 'yes' || lower === 'ok' || lower === 'sure' // Often users just say "ok" to the first date shown
        );
    }

    /**
     * The "Smart Check": Uses a lightweight AI call to classify intent.
     * Use this when no tools were called but we suspect the user wanted something.
     * Handles ALL languages.
     */
    static async validateIntent(message: string, history: any[]): Promise<'reschedule' | 'booking' | 'other'> {
        try {
            // Take the last few messages for context
            const recentHistory = history.slice(-3);
            
            const result = await generateText({
                model: deepseek(MINI_MODEL),
                system: `You are an Intent Classifier for a service business bot.
                Analyze the USER MESSAGE and classify their intent into exactly one category:
                
                1. "reschedule": User wants to move/change an existing booking. (e.g. "Can we do tomorrow?", "Change to 2pm", "Tukar tarikh", "Mover la fecha")
                2. "booking": User is selecting a time slot or confirming a new booking. (e.g. "Morning", "1", "Yes", "Slot 2")
                3. "other": Anything else (questions, greetings, cancellations, complaints).
                
                Output ONLY the category name.`,
                messages: [
                    ...recentHistory,
                    { role: 'user', content: message }
                ],
            });

            const intent = result.text.trim().toLowerCase();
            if (intent.includes('reschedule')) return 'reschedule';
            if (intent.includes('booking')) return 'booking';
            return 'other';

        } catch (e) {
            console.error('Guardrails AI check failed:', e);
            return 'other'; // Fail safe
        }
    }
}
