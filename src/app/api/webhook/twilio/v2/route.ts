// src/app/api/webhook/twilio/v2/route.ts
// V2 AI Receptionist - Agentic Architecture
// The "Brain" that orchestrates tools based on conversation context
// ~150 lines vs 2000+ in V1

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

import { receptionistTools } from '../../../../../lib/ai-receptionist/tools';
import { generateSystemPrompt, type BusinessContext, type CustomerContext } from '../../../../../lib/ai-receptionist/system-prompt';
import { getConversationHistory, saveMessage, getLastBusinessId } from '../../../../../lib/ai-receptionist/history';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

// ============================================================
// THE SIMPLIFIED WEBHOOK HANDLER
// ============================================================

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    
    try {
        // 1. Parse incoming WhatsApp message
        const formData = await request.formData();
        const from = formData.get('From') as string;
        const body = formData.get('Body') as string;
        const latitude = formData.get('Latitude') as string | null;
        const longitude = formData.get('Longitude') as string | null;

        const customerPhone = from.replace('whatsapp:', '');
        let messageText = body?.trim() || '';

        // Handle location pins
        if (latitude && longitude) {
            messageText = messageText || `📍 Location: ${latitude}, ${longitude}`;
        }

        console.log(`\n🤖 V2 Incoming: ${customerPhone}`);
        console.log(`   Message: ${messageText.substring(0, 100)}...`);

        // 2. Extract business ID from [BIZ:uuid] if present
        const bizMatch = messageText.match(/\[BIZ:([a-f0-9-]+)\]/i);
        let businessId = bizMatch ? bizMatch[1] : null;

        // If no business ID in message, try to get from recent history
        if (!businessId) {
            businessId = await getLastBusinessId(customerPhone);
        }

        // 3. Build context for the AI
        let businessContext: BusinessContext | null = null;
        let customerContext: CustomerContext | null = null;

        if (businessId) {
            // Fetch business config
            const { data: business } = await supabase
                .from('businesses')
                .select('*')
                .eq('id', businessId)
                .single();

            if (business) {
                const config = business.business_data || {};
                businessContext = {
                    id: business.id,
                    name: business.name,
                    niche: config.niche || 'Aircon Service',
                    currency: config.currency || 'RM',
                    cleaningPrice: config.cleaningPrice || 120,
                    repairInspectionFee: config.repairInspectionFee || 80,
                    warrantyDays: config.warrantyDays || 30,
                    serviceInterval: config.serviceInterval || 90,
                    ownerName: config.ownerName,
                    operatingHours: config.operatingHours || '9am - 5pm',
                };
            }

            // Fetch customer context
            const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
            const phoneWithoutPlus = customerPhone.replace(/^\+/, '');

            const { data: customer } = await supabase
                .from('customers')
                .select('*')
                .eq('business_id', businessId)
                .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`)
                .single();

            if (customer) {
                const warrantyActive = customer.warranty_end_date && 
                    new Date(customer.warranty_end_date) > new Date();
                
                customerContext = {
                    id: customer.id,
                    name: customer.name || customer.first_name,
                    isReturning: true,
                    warrantyActive,
                    warrantyEndDate: customer.warranty_end_date,
                    lastServiceDate: customer.last_service_date,
                    lastServiceType: customer.service_type,
                    address: customer.address,
                };
            } else {
                customerContext = { isReturning: false, warrantyActive: false };
            }
        }

        // 4. Get conversation history
        const history = await getConversationHistory(customerPhone, businessId || undefined);

        // 5. Save incoming message to history
        await saveMessage(customerPhone, 'user', messageText, businessId || undefined);

        // 6. Generate system prompt with context
        const systemPrompt = businessContext 
            ? generateSystemPrompt(businessContext, customerContext || undefined)
            : `You are a helpful assistant. A customer has messaged but we couldn't identify which business they're contacting. Ask them to scan their service sticker or provide more details.`;


        // 7. THE MAGIC: Call the AI with tools
        // Using built-in maxSteps for automatic tool execution
        console.log(`   🧠 Calling AI with ${history.length} history messages...`);
        
        const result = await generateText({
            model: openai('gpt-4o-mini'),
            system: systemPrompt,
            messages: [
                ...history,
                { role: 'user', content: messageText },
            ],
            tools: receptionistTools,
            // @ts-ignore - maxSteps is available in AI SDK 3.1+ but type def might be lagging
            maxSteps: 5, // Automatically execute tools and recurse up to 5 steps
            onStepFinish: async ({ toolCalls }) => {
                // Log tool usage
                if (toolCalls && toolCalls.length > 0) {
                   console.log(`   🔧 Tool calls:`, toolCalls.map(t => t.toolName).join(', '));
                }
            },
        });

        let aiResponse = result.text;
        // Collect all tool calls from all steps
        const allToolCalls = result.steps.flatMap(step => step.toolCalls || []);
        
        // IMPORTANT: If AI used tools but didn't generate text, we need to 
        // force a continuation call to get the actual response
        if (!aiResponse && allToolCalls.length > 0) {
            // Check if any step has text content
            for (const step of result.steps) {
                if (step.text && step.text.trim()) {
                    aiResponse = step.text;
                    break;
                }
            }
            
            // If still no response, make a continuation call with tool results as context
            if (!aiResponse) {
                console.log(`   ⚠️ AI called tools but generated no response, forcing continuation...`);
                
                // Summarize tool results for a clean follow-up
                const toolResultsSummary = result.steps
                    .flatMap(step => step.toolResults || [])
                    .map(tr => {
                        // Tool results have toolName and result properties
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const toolResult = tr as any;
                        return `Tool ${toolResult.toolName}: ${JSON.stringify(toolResult.result)}`;
                    })
                    .join('\n');
                
                // Make a simple follow-up call asking for a response
                const continuationResult = await generateText({
                    model: openai('gpt-4o-mini'),
                    system: systemPrompt + `\n\nYou already called tools and received results. Now compose your response to the customer.`,
                    messages: [
                        ...history,
                        { role: 'user', content: messageText },
                        { 
                            role: 'assistant', 
                            content: `I gathered the following information:\n${toolResultsSummary}\n\nNow I will respond to the customer:` 
                        },
                    ],
                    // No tools this time - force text response
                });
                
                aiResponse = continuationResult.text || "Hi! How can I help you today?";
            }
        }
        
        console.log(`   ✅ AI Response (${Date.now() - startTime}ms): ${aiResponse.substring(0, 100)}...`);
        if (allToolCalls.length > 0) {
            console.log(`   🔧 Total tools used: ${allToolCalls.map(t => t.toolName).join(', ')}`);
        }

        // 8. Handle any owner notifications from tool calls
        // extracted from the full execution trace
        for (const step of result.steps) {
            for (const toolResult of step.toolResults || []) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const res = (toolResult as any).result;
                if (res?.action === 'notify_owner' && res?.phone) {
                    if (twilioClient && fromNumber) {
                        try {
                            await twilioClient.messages.create({
                                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                                to: `whatsapp:${res.phone}`,
                                body: res.message || 'Notification from AI Receptionist',
                            });
                            console.log(`   📤 Notified owner: ${res.phone}`);
                        } catch (e) {
                            console.error(`   ❌ Failed to notify owner:`, e);
                        }
                    }
                }
            }
        }

        // 9. Send response back to WhatsApp
        if (aiResponse && twilioClient && fromNumber) {
            await twilioClient.messages.create({
                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                to: from,
                body: aiResponse,
            });
            console.log(`   📤 Sent response to customer`);
        }

        // 10. Save AI response to history
        await saveMessage(
            customerPhone, 
            'assistant', 
            aiResponse, 
            businessId || undefined,
            allToolCalls.length > 0 ? allToolCalls : undefined
        );

        // 11. Return empty TwiML (we already sent the message)
        return new NextResponse(
            '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
            { headers: { 'Content-Type': 'text/xml' } }
        );

    } catch (error) {
        console.error('❌ V2 Webhook Error:', error);
        
        // Try to send a friendly error message
        try {
            const formData = await request.formData();
            const from = formData.get('From') as string;
            
            if (twilioClient && fromNumber && from) {
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: from,
                    body: `Sorry, I'm having a moment! 🙈 Please try again in a few seconds, or reply "HUMAN" to speak with someone.`,
                });
            }
        } catch (e) {
            // Silent fail
        }

        return new NextResponse(
            '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
            { headers: { 'Content-Type': 'text/xml' } }
        );
    }
}

// Health check endpoint
export async function GET() {
    return NextResponse.json({ 
        status: 'ok', 
        version: 'v2-agentic',
        description: 'AI Receptionist with LLM Function Calling',
    });
}
