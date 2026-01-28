// src/lib/ai-receptionist/guardrails.ts
// Safety nets for AI behavior - Detect hallucinations and classify intent

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { ToolCall, ConversationMessage } from './types';

/**
 * Guardrails provide safety checks for the AI Receptionist
 * 
 * 1. Hallucination Detection - Catch when AI claims success without calling tools
 * 2. Intent Classification - Understand user intent (works in any language)
 * 3. Slot Selection Detection - Know when user is confirming a booking slot
 */
export class Guardrails {
    
    /**
     * Detect if AI claimed to perform an action without calling the tool
     */
    static detectHallucination(
        response: string, 
        toolCalls: ToolCall[]
    ): { isHallucinating: boolean; type?: 'booking' | 'reschedule' | 'cancel' } {
        
        // If booking tools were called, not hallucinating
        const bookingTools = ['createBooking', 'rescheduleBooking', 'cancelBooking'];
        if (toolCalls.some(tc => bookingTools.includes(tc.toolName))) {
            return { isHallucinating: false };
        }
        
        const lower = response.toLowerCase();
        
        // Check for booking confirmation language
        const claimsBooked = (
            (lower.includes('booking') && (
                lower.includes('confirmed') ||
                lower.includes('received') ||
                lower.includes('created') ||
                lower.includes('scheduled')
            )) ||
            (lower.includes("i've") && (
                lower.includes('booked') ||
                lower.includes('scheduled') ||
                lower.includes('reserved')
            )) ||
            (lower.includes('done') && lower.includes('booking'))
        );
        
        if (claimsBooked) {
            return { isHallucinating: true, type: 'booking' };
        }
        
        // Check for reschedule confirmation language
        const claimsRescheduled = (
            lower.includes('rescheduled') ||
            lower.includes('moved your') ||
            lower.includes('changed your') ||
            (lower.includes('new time') && lower.includes('set'))
        );
        
        if (claimsRescheduled) {
            return { isHallucinating: true, type: 'reschedule' };
        }
        
        return { isHallucinating: false };
    }
    
    /**
     * Fast check if message looks like a reschedule request (English patterns)
     */
    static looksLikeReschedule(message: string): boolean {
        const lower = message.toLowerCase().trim();
        
        // Direct keywords
        if (lower.includes('reschedule')) return true;
        if (lower.includes('instead')) return true;
        if (lower.startsWith('actually')) return true;
        
        // Change/move verbs with targets
        if ((lower.includes('change') || lower.includes('move') || lower.includes('switch')) && 
            (lower.includes('to') || lower.includes('time') || lower.includes('date') || lower.includes('it'))) {
            return true;
        }
        
        // Polite requests
        if (lower.startsWith('can it be') || lower.startsWith('could it be')) {
            return true;
        }
        
        // Negatives about current slot
        if (lower.includes("can't make") || lower.includes("cannot make") || lower.includes("won't be able")) {
            return true;
        }
        
        if (lower.includes("doesn't work") || lower.includes("does not work")) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Check if message looks like a slot selection
     */
    static looksLikeSlotSelection(message: string, lastBotMessage: string): boolean {
        const lower = message.toLowerCase().trim();
        const botLower = lastBotMessage.toLowerCase();
        
        // Context: Did bot just show slots?
        const showedSlots = (
            botLower.includes('available') ||
            botLower.includes('1️⃣') ||
            botLower.includes('slot') ||
            (botLower.includes('morning') && botLower.includes('afternoon'))
        );
        
        if (!showedSlots) return false;
        
        // Pattern matching for selection
        return (
            /^[1-4]$/.test(lower) ||
            /^option\s*[1-4]$/i.test(lower) ||
            lower === 'morning' || lower === 'afternoon' ||
            lower === 'tomorrow' || lower === 'today' ||
            lower.startsWith('first') || lower.startsWith('second') ||
            lower === 'yes' || lower === 'ok' || lower === 'sure' || lower === 'okay'
        );
    }
    
    /**
     * AI-powered intent classifier (handles any language)
     * Use sparingly - adds latency
     */
    static async validateIntent(
        message: string, 
        history: ConversationMessage[]
    ): Promise<'reschedule' | 'booking' | 'cancel' | 'other'> {
        try {
            const result = await generateText({
                model: openai('gpt-4o-mini'),
                system: `Classify the user's intent into ONE category:
                
reschedule - User wants to change/move an existing booking date or time
booking - User is selecting a slot or confirming a new booking  
cancel - User wants to cancel/delete their booking
other - Anything else

Output ONLY the category name, nothing else.`,
                messages: [
                    ...history.slice(-3),
                    { role: 'user', content: message }
                ],
            });
            
            const intent = result.text.trim().toLowerCase();
            
            if (intent.includes('reschedule')) return 'reschedule';
            if (intent.includes('booking')) return 'booking';
            if (intent.includes('cancel')) return 'cancel';
            return 'other';
            
        } catch (e) {
            console.error('Guardrails intent check failed:', e);
            return 'other';
        }
    }
}
