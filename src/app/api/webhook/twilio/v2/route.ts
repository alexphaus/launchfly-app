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

        // 3. Build context for the AI - PARALLEL FETCHING for speed (Gap 3 fix)
        let businessContext: BusinessContext | null = null;
        let customerContext: CustomerContext | null = null;

        // Prepare phone formats for customer lookup
        const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
        const phoneWithoutPlus = customerPhone.replace(/^\+/, '');

        if (businessId) {
            // Run business, customer, and history queries in PARALLEL
            const [businessResult, customerResult, history] = await Promise.all([
                // Fetch business config
                supabase
                    .from('businesses')
                    .select('*')
                    .eq('id', businessId)
                    .single(),
                // Fetch customer context
                supabase
                    .from('customers')
                    .select('*')
                    .eq('business_id', businessId)
                    .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`)
                    .single(),
                // Get conversation history
                getConversationHistory(customerPhone, businessId),
            ]);

            const business = businessResult.data;
            const customer = customerResult.data;

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

            // Save incoming message to history (can run after parallel fetch)
            await saveMessage(customerPhone, 'user', messageText, businessId);

            // Now build the prompt and call AI with history from parallel fetch
            const systemPrompt = generateSystemPrompt(businessContext!, customerContext || undefined);
            
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
                maxSteps: 5,
                onStepFinish: async ({ toolCalls }) => {
                    if (toolCalls && toolCalls.length > 0) {
                       console.log(`   🔧 Tool calls:`, toolCalls.map(t => t.toolName).join(', '));
                    }
                },
            });

            let aiResponse = result.text;
            const allToolCalls = result.steps.flatMap(step => step.toolCalls || []);
            
            // Handle empty response after tool calls
            if (!aiResponse && allToolCalls.length > 0) {
                for (const step of result.steps) {
                    if (step.text && step.text.trim()) {
                        aiResponse = step.text;
                        break;
                    }
                }
                
                if (!aiResponse) {
                    console.log(`   ⚠️ AI called tools but generated no response, forcing continuation...`);
                    
                    const toolResultsSummary = result.steps
                        .flatMap(step => step.toolResults || [])
                        .map(tr => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const toolResult = tr as any;
                            return `Tool ${toolResult.toolName}: ${JSON.stringify(toolResult.result)}`;
                        })
                        .join('\n');
                    
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
                    });
                    
                    aiResponse = continuationResult.text || "Hi! How can I help you today?";
                }
            }
            
            console.log(`   ✅ AI Response (${Date.now() - startTime}ms): ${aiResponse.substring(0, 100)}...`);
            if (allToolCalls.length > 0) {
                console.log(`   🔧 Total tools used: ${allToolCalls.map(t => t.toolName).join(', ')}`);
            }

            // Handle owner notifications
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

            // Send response to customer
            if (aiResponse && twilioClient && fromNumber) {
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: from,
                    body: aiResponse,
                });
                console.log(`   📤 Sent response to customer`);
            }

            // Save AI response to history
            await saveMessage(
                customerPhone, 
                'assistant', 
                aiResponse, 
                businessId,
                allToolCalls.length > 0 ? allToolCalls : undefined
            );

            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // No business ID found - simplified flow (ask to scan sticker)
        const history = await getConversationHistory(customerPhone);
        await saveMessage(customerPhone, 'user', messageText);
        
        const fallbackPrompt = `You are a helpful assistant. A customer has messaged but we couldn't identify which business they're contacting. Ask them to scan their service sticker or provide more details about which business they're trying to reach.`;

        console.log(`   🧠 No business ID - calling AI with fallback prompt...`);
        
        const result = await generateText({
            model: openai('gpt-4o-mini'),
            system: fallbackPrompt,
            messages: [
                ...history,
                { role: 'user', content: messageText },
            ],
        });

        const aiResponse = result.text || "Hi! To help you, please scan the service sticker on your aircon unit. This will connect me to your technician's system. 📱";
        
        console.log(`   ✅ Fallback Response (${Date.now() - startTime}ms): ${aiResponse.substring(0, 100)}...`);

        // Send response to customer
        if (twilioClient && fromNumber) {
            await twilioClient.messages.create({
                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                to: from,
                body: aiResponse,
            });
            console.log(`   📤 Sent fallback response to customer`);
        }

        // Save AI response to history
        await saveMessage(customerPhone, 'assistant', aiResponse);

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
