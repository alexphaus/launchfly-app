// src/lib/ai-receptionist/handlers/ai-brain.ts
// The main AI conversation handler with single-retry guardrail

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import { receptionistTools } from '../tools';
import { generateSystemPrompt } from '../system-prompt';
import { Guardrails } from '../guardrails';
import { CONFIG, normalizePhone, parseRelativeDate, parseTimeWindow, formatDateLabel } from '../utils';
import type { WebhookContext, AIResponse, ToolResult, ConversationMessage } from '../types';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Main AI conversation handler
 * Returns the AI response after processing with tools
 */
export async function processWithAI(ctx: WebhookContext): Promise<AIResponse> {
    const { businessContext, customerContext, messageText, customerPhone, businessId, history } = ctx;
    
    if (!businessContext || !businessId) {
        return {
            text: "Hi! To help you, please scan the service sticker on your appliance. This connects me to your technician's system. 📱",
            toolCalls: [],
            success: true,
        };
    }
    
    // Build system prompt
    const systemPrompt = generateSystemPrompt(businessContext, customerContext || undefined);
    const contextMessage = buildContextMessage(ctx);
    
    console.log(`   🧠 Calling AI with ${history.length} history messages...`);
    
    // Main AI call
    const result = await generateText({
        model: openai(CONFIG.AI_MODEL),
        system: systemPrompt + '\n\n' + contextMessage,
        messages: [
            ...history.slice(-CONFIG.MAX_HISTORY),
            { role: 'user', content: messageText },
        ],
        tools: receptionistTools,
        // @ts-ignore - maxSteps is available in AI SDK 3.1+ but type def might be lagging
        maxSteps: CONFIG.MAX_STEPS,
        toolChoice: 'auto',
    });
    
    let aiResponse = result.text || '';
    const allToolCalls = result.steps.flatMap(step => step.toolCalls || []);
    const allToolResults = result.steps.flatMap(step => 
        (step.toolResults || []).map(tr => ({
            toolName: (tr as any).toolName,
            output: (tr as any).output ?? (tr as any).result,
        }))
    ) as ToolResult[];
    
    console.log(`   ✅ AI Response: ${aiResponse.substring(0, 80)}...`);
    if (allToolCalls.length > 0) {
        console.log(`   🔧 Tools used: ${allToolCalls.map(t => t.toolName).join(', ')}`);
    }
    
    // Check for failed tool calls
    const failedBooking = allToolResults.find(tr => 
        (tr.toolName === 'createBooking' || tr.toolName === 'rescheduleBooking') &&
        (tr.output as any)?.success === false
    );
    
    if (failedBooking) {
        const error = (failedBooking.output as any)?.error || 'Unknown error';
        console.log(`   ⚠️ Booking tool failed: ${error}`);
        return {
            text: `I had trouble with your booking: ${error}. Please try again or reply "HUMAN" to speak with someone.`,
            toolCalls: allToolCalls,
            success: false,
            error,
        };
    }
    
    // GUARDRAIL: Detect hallucination
    const { isHallucinating, type } = Guardrails.detectHallucination(aiResponse, allToolCalls);
    
    if (isHallucinating && CONFIG.RETRY_ENABLED) {
        console.log(`   ⚠️ Hallucination detected (${type}), attempting retry...`);
        const retryResult = await handleRetry(ctx, type || 'booking', history);
        
        if (retryResult.success) {
            return retryResult;
        }
        // If retry failed, return error instead of hallucinated response
        return {
            text: "I apologize, I'm having trouble completing that request. Please try again or reply 'HUMAN' to speak with the owner.",
            toolCalls: [],
            success: false,
            error: 'Retry failed',
        };
    }
    
    // GUARDRAIL: Detect missed reschedule
    const calledReschedule = allToolCalls.some(tc => tc.toolName === 'rescheduleBooking');
    if (!calledReschedule && customerContext?.id) {
        const looksLikeReschedule = Guardrails.looksLikeReschedule(messageText);
        
        // Smart check for non-English
        let isRescheduleIntent = looksLikeReschedule;
        if (!isRescheduleIntent && allToolCalls.length === 0 && messageText.length < 100) {
            const intent = await Guardrails.validateIntent(messageText, history);
            isRescheduleIntent = intent === 'reschedule';
        }
        
        if (isRescheduleIntent && CONFIG.RETRY_ENABLED) {
            console.log(`   ⚠️ Reschedule intent detected but tool not called, forcing...`);
            const retryResult = await forceReschedule(ctx);
            if (retryResult.success) {
                return retryResult;
            }
        }
    }
    
    // Handle empty or filler responses
    if (!aiResponse || aiResponse.length < 10) {
        aiResponse = handleEmptyResponse(allToolResults) || "How can I help you today?";
    }
    
    return {
        text: aiResponse,
        toolCalls: allToolCalls,
        success: true,
        toolResults: allToolResults,
    } as AIResponse & { toolResults: ToolResult[] };
}

/**
 * Build the context message with tool parameters
 */
function buildContextMessage(ctx: WebhookContext): string {
    const { businessId, customerPhone, customerContext, businessContext } = ctx;
    
    return `[SYSTEM CONTEXT]
Customer Phone: ${customerPhone}
Business ID: ${businessId}
Customer ID: ${customerContext?.id || 'new'}
Customer Name: ${customerContext?.name || 'unknown'}

TOOL PARAMETERS:
• activateWarranty: businessId="${businessId}", phone="${customerPhone}"
• getAvailableSlots: businessId="${businessId}"
• createBooking: businessId="${businessId}", customerPhone="${customerPhone}", customerId="${customerContext?.id || ''}"
• rescheduleBooking: businessId="${businessId}", customerPhone="${customerPhone}"
• cancelBooking: businessId="${businessId}", customerPhone="${customerPhone}"

CRITICAL RULES:
1. When customer selects a slot (1, 2, morning, afternoon, tomorrow) → Call createBooking IMMEDIATELY
2. When customer wants to change date/time → Call rescheduleBooking (NOT cancelBooking!)
3. NEVER say "Booking confirmed" without calling createBooking first
4. NEVER say "Moved your booking" without calling rescheduleBooking first`;
}

/**
 * Handle retry after hallucination detection
 */
async function handleRetry(
    ctx: WebhookContext,
    type: 'booking' | 'reschedule' | 'cancel',
    history: ConversationMessage[]
): Promise<AIResponse> {
    const { businessId, customerPhone, customerContext, businessContext, messageText } = ctx;
    
    const tool = type === 'reschedule' ? 'rescheduleBooking' : 'createBooking';
    
    const retryResult = await generateText({
        model: openai(CONFIG.AI_MODEL),
        system: `You MUST call ${tool} with the booking details from the conversation. Do NOT respond without calling the tool.`,
        messages: [
            ...history.slice(-10),
            { role: 'user', content: messageText },
        ],
        tools: receptionistTools,
        toolChoice: 'required',
    });
    
    const toolCalls = retryResult.steps.flatMap(step => step.toolCalls || []);
    const toolResults = retryResult.steps.flatMap(step => 
        (step.toolResults || []).map(tr => ({
            toolName: (tr as any).toolName,
            output: (tr as any).output ?? (tr as any).result,
        }))
    );
    
    if (toolCalls.length > 0) {
        console.log(`   ✅ Retry successful: ${toolCalls.map(t => t.toolName).join(', ')}`);
        return {
            text: retryResult.text || generateSuccessMessage(toolResults),
            toolCalls,
            success: true,
            toolResults,
        } as AIResponse & { toolResults: ToolResult[] };
    }
    
    return { text: '', toolCalls: [], success: false };
}

/**
 * Force a reschedule when we detect intent but AI didn't call tool
 */
async function forceReschedule(ctx: WebhookContext): Promise<AIResponse> {
    const { businessId, customerPhone, messageText } = ctx;
    const { withPlus, withoutPlus } = normalizePhone(customerPhone);
    
    // Find current booking
    const today = new Date().toISOString().split('T')[0];
    const { data: currentBooking } = await supabase
        .from('bookings')
        .select('id, slot_date, slot_time')
        .eq('business_id', businessId)
        .or(`customer_phone.eq.${withPlus},customer_phone.eq.${withoutPlus}`)
        .in('status', ['pending', 'confirmed'])
        .gte('slot_date', today)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
    
    if (!currentBooking) {
        return { text: '', toolCalls: [], success: false };
    }
    
    // Parse new date/time from message
    const lower = messageText.toLowerCase();
    const specifiedDay = lower.includes('tomorrow') || lower.includes('today') || 
        /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(lower);
    
    const targetDate = specifiedDay 
        ? parseRelativeDate(messageText) 
        : currentBooking.slot_date;
    
    let targetWindow = parseTimeWindow(messageText, currentBooking.slot_time as any);
    
    // "X instead" means flip the window
    if (lower.includes('instead') && !lower.includes('morning') && !lower.includes('afternoon')) {
        targetWindow = currentBooking.slot_time === 'morning' ? 'afternoon' : 'morning';
    }
    
    console.log(`   🎯 Force reschedule to: ${targetDate} ${targetWindow}`);
    
    // Call reschedule directly
    const rescheduleResult = await generateText({
        model: openai(CONFIG.AI_MODEL),
        system: `Call rescheduleBooking with: customerPhone="${customerPhone}", businessId="${businessId}", newDate="${targetDate}", newWindow="${targetWindow}"`,
        messages: [{ role: 'user', content: 'Reschedule now' }],
        tools: { rescheduleBooking: receptionistTools.rescheduleBooking },
        toolChoice: { type: 'tool', toolName: 'rescheduleBooking' },
    });
    
    const toolCalls = rescheduleResult.steps.flatMap(step => step.toolCalls || []);
    const toolResults = rescheduleResult.steps.flatMap(step => 
        (step.toolResults || []).map(tr => ({
            toolName: (tr as any).toolName,
            output: (tr as any).output ?? (tr as any).result,
        }))
    );
    
    const result = toolResults[0]?.output as any;
    
    if (result?.success) {
        return {
            text: `Done! ✅ Your booking has been rescheduled to **${result.newSlotLabel || formatDateLabel(targetDate, targetWindow)}**.\n\nThe technician will WhatsApp you 30 minutes before arrival.`,
            toolCalls,
            success: true,
            toolResults,
        } as AIResponse & { toolResults: ToolResult[] };
    }
    
    return { text: '', toolCalls: [], success: false };
}

/**
 * Generate success message from tool results
 */
function generateSuccessMessage(toolResults: ToolResult[]): string {
    const booking = toolResults.find(tr => tr.toolName === 'createBooking');
    if (booking?.output) {
        const b = booking.output as any;
        if (b.success) {
            return `Done! ✅ Booking confirmed!\n\n📅 ${b.slotLabel || 'Your selected time'}\n📍 ${b.address || 'Your address'}\n💰 ${b.estimate || 'Quoted price'}\n\nThe technician will WhatsApp you 30 minutes before arrival. 🔧`;
        }
    }
    
    const reschedule = toolResults.find(tr => tr.toolName === 'rescheduleBooking');
    if (reschedule?.output) {
        const r = reschedule.output as any;
        if (r.success) {
            return `Done! ✅ Your booking has been rescheduled to **${r.newSlotLabel}**.\n\nThe technician will WhatsApp you 30 minutes before arrival.`;
        }
    }
    
    return "Done! Is there anything else I can help with?";
}

/**
 * Handle empty AI response by summarizing tool results
 */
function handleEmptyResponse(toolResults: ToolResult[]): string | null {
    if (toolResults.length === 0) return null;
    
    const slots = toolResults.find(tr => tr.toolName === 'getAvailableSlots');
    if (slots?.output) {
        const s = slots.output as any;
        if (s.slots?.length > 0) {
            return `Here are the available slots:\n\n${s.slots.map((slot: any, i: number) => 
                `${i + 1}️⃣ ${slot.label || slot}`
            ).join('\n')}\n\nWhich one works for you?`;
        }
    }
    
    return generateSuccessMessage(toolResults);
}
