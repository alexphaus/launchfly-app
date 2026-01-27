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
import { sendTypingIndicator, sendJobConfirmed, sendJobCard } from '../../../../../lib/whatsapp-push';

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
        const messageSid = formData.get('MessageSid') as string; // For typing indicator
        const latitude = formData.get('Latitude') as string | null;
        const longitude = formData.get('Longitude') as string | null;

        const customerPhone = from.replace('whatsapp:', '');
        
        // 🚀 Send typing indicator IMMEDIATELY to show bot is responding
        // This makes the customer see "typing..." while AI processes
        console.log(`   💬 Sending typing indicator for MessageSid: ${messageSid}`);
        sendTypingIndicator(messageSid).catch((e) => console.warn('Typing indicator error:', e));
        
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
                    ownerPhone: business.whatsapp_number || business.phone_number,
                    operatingHours: config.operatingHours || '9am - 5pm',
                    googleReviewLink: config.googleReviewLink,
                };
            }

            if (customer) {
                // Note: warranty is stored in next_reminder_due field (schema doesn't have warranty_end_date)
                const warrantyEndDate = customer.next_reminder_due;
                const warrantyActive = warrantyEndDate && 
                    new Date(warrantyEndDate) > new Date();
                
                customerContext = {
                    id: customer.id,
                    name: customer.name || customer.first_name,
                    isReturning: true,
                    warrantyActive,
                    warrantyEndDate: warrantyEndDate ? new Date(warrantyEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined,
                    lastServiceDate: customer.last_service_date,
                    lastServiceType: customer.notes?.includes('Service:') ? customer.notes.split('Service:')[1]?.split('.')[0]?.trim() : undefined,
                    address: customer.address,
                };
            } else {
                customerContext = { isReturning: false, warrantyActive: false };
            }

            // Save incoming message to history (can run after parallel fetch)
            await saveMessage(customerPhone, 'user', messageText, businessId);

            // Now build the prompt and call AI with history from parallel fetch
            const systemPrompt = generateSystemPrompt(businessContext!, customerContext || undefined);
            
            // Add context about current customer phone for tools - be very explicit!
            const contextMessage = `
[SYSTEM CONTEXT - USE THESE VALUES WHEN CALLING TOOLS]
- Customer Phone: ${customerPhone}
- Business ID: ${businessId}
- Customer ID: ${customerContext?.id || 'unknown (will be created)'}
- Customer Name: ${customerContext?.name || 'unknown'}

When calling activateWarranty, use:
  businessId: "${businessId}"
  phone: "${customerPhone}"
  name: (the name the customer provided)
  serviceType: "cleaning"

When calling getAvailableSlots, use:
  businessId: "${businessId}"

When calling notifyOwner (for complaints/human request/escalation), use:
  ownerPhone: "${businessContext?.ownerPhone || ''}"
  message: (summary of the issue and customer phone)

⚠️ CRITICAL: When customer selects a time slot, call createBooking IMMEDIATELY with:
  businessId: "${businessId}"
  customerId: "${customerContext?.id || ''}"
  customerPhone: "${customerPhone}"
  customerName: "${customerContext?.name || '(name from conversation)'}"
  address: (the address they provided in conversation)
  date: (YYYY-MM-DD from the selected slot)
  window: "morning" or "afternoon"
  serviceType: (e.g., "Aircon Cleaning (1 unit)")
  estimateAmount: (the price as a number, e.g., 120)
  currency: "RM"

⚠️ CANCELLATION (PERMANENT DELETE - use sparingly):
When customer wants to CANCEL entirely (not reschedule), call cancelBooking:
  customerPhone: "${customerPhone}"
  businessId: "${businessId}"
  reason: (reason for cancellation)
⚠️ DO NOT use cancelBooking for date changes! It will DELETE the job!

⚠️ RESCHEDULING (PREFERRED for date/time changes):
When customer has an existing booking and wants to CHANGE the date/time:
  1. Check availability for the new date/time.
  2. When they SELECT a new slot (reply "1", "2", "Friday", etc.), IMMEDIATELY call rescheduleBooking:
     customerPhone: "${customerPhone}"
     businessId: "${businessId}"
     newDate: (YYYY-MM-DD of the new slot)
     newWindow: "morning" or "afternoon"
  3. rescheduleBooking is ATOMIC - it updates the booking directly without cancelling!
  4. NEVER call cancelBooking when the customer just wants to move the appointment!

⚠️ VERIFICATION RULE: Before saying "Done", "Moved", "Confirmed", or "Received":
  - For NEW bookings: Did I call createBooking?
  - For DATE CHANGES: Did I call rescheduleBooking?
  - For CANCELLATIONS: Did I call cancelBooking?
  If NO tool was called, you are about to LIE. Call the tool FIRST!

❌ NEVER say "Booking Request Received" without calling createBooking first!
❌ NEVER say "I've moved your booking" without calling rescheduleBooking first!
❌ Do NOT ask "Shall I book it?" - when they select a slot, JUST BOOK IT!
`;
            
            console.log(`   🧠 Calling AI with ${history.length} history messages...`);
            console.log(`   📋 Business ID for tools: ${businessId}`);
            
            const result = await generateText({
                model: openai('gpt-4o-mini'),
                system: systemPrompt + `\n\n${contextMessage}`,
                messages: [
                    ...history,
                    { role: 'user', content: messageText },
                ],
                tools: receptionistTools,
                // @ts-ignore - maxSteps is available in AI SDK 3.1+ but type def might be lagging
                maxSteps: 5,
                toolChoice: 'auto', // Ensure tools can be called
                onStepFinish: async ({ toolCalls, toolResults }) => {
                    if (toolCalls && toolCalls.length > 0) {
                       console.log(`   🔧 Tool calls:`, toolCalls.map(t => t.toolName).join(', '));
                       // Log the arguments being passed
                       toolCalls.forEach(tc => {
                           // eslint-disable-next-line @typescript-eslint/no-explicit-any
                           console.log(`   📥 ${tc.toolName} args:`, JSON.stringify((tc as any).args || {}));
                       });
                    }
                    if (toolResults && toolResults.length > 0) {
                       console.log(`   📤 Tool results received:`, toolResults.length);
                    }
                },
            });

            let aiResponse = result.text || '';
            const allToolCalls = result.steps.flatMap(step => step.toolCalls || []);
            
            // Check if response is just a filler message (e.g. "I'll check that...")
            // We look for phrases indicating a pause or future action without results
            const isFiller = aiResponse && aiResponse.length < 200 && (
                aiResponse.toLowerCase().includes('moment') || 
                aiResponse.toLowerCase().includes('checking') ||
                aiResponse.toLowerCase().includes('bear with me') ||
                aiResponse.toLowerCase().includes('hold on')
            );
            
            // Handle empty response OR filler response after tool calls
            // This ensures we don't just send "I'll check..." and stop, but actually send the slots
            if ((!aiResponse || isFiller) && allToolCalls.length > 0) {
                console.log(`   ⚠️ AI called tools but response was empty or filler ("${aiResponse || ''}"), forcing continuation...`);
                
                // Extract tool results from steps - Vercel AI SDK structure
                const toolResultsSummary = result.steps
                    .flatMap(step => step.toolResults || [])
                    .map(tr => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const toolResult = tr as any;
                        // In Vercel AI SDK, the result is directly in the toolResult object
                        // Try multiple possible property names
                        const actualResult = toolResult.result ?? toolResult.output ?? toolResult;
                        const resultStr = JSON.stringify(actualResult);
                        console.log(`   📊 Tool ${toolResult.toolName || 'unknown'} full object keys:`, Object.keys(toolResult));
                        console.log(`   📊 Tool result for continuation:`, resultStr.substring(0, 200));
                        return `Tool ${toolResult.toolName || 'tool'}: ${resultStr}`;
                    })
                    .join('\n');
                
                console.log(`   📋 Full toolResultsSummary:`, toolResultsSummary.substring(0, 300));
                
                // If we found tool results, generate the real answer
                if (toolResultsSummary && !toolResultsSummary.includes('{}')) {
                    const continuationResult = await generateText({
                        model: openai('gpt-4o-mini'),
                        system: systemPrompt + `\n\nSYSTEM UPDATE: You just called a tool and got results. DO NOT say "I'll check". The check is DONE. Respond with the data now.`,
                        messages: [
                            ...history,
                            { role: 'user', content: messageText },
                            { 
                                role: 'assistant', 
                                content: `I have executed the tools. Here are the results:\n${toolResultsSummary}\n\nBased on this, the final response to the customer is:` 
                            },
                        ],
                    });
                    
                    if (continuationResult.text && continuationResult.text.trim()) {
                         aiResponse = continuationResult.text;
                         console.log(`   🔄 Continuation response generated: ${aiResponse.substring(0, 50)}...`);
                    } else {
                         // Fallback if continuation also fails
                         aiResponse = "Hi! How can I help you today?";
                         console.log(`   ⚠️ Continuation failed, using fallback response`);
                    }
                } else {
                    // No tool results found, use fallback
                    aiResponse = "Hi! How can I help you today?";
                    console.log(`   ⚠️ No tool results found, using fallback response`);
                }
            }
            
            // Final safety check before logging
            if (!aiResponse) {
                aiResponse = "Hi! How can I help you today?";
            }
            
            console.log(`   ✅ AI Response (${Date.now() - startTime}ms): ${aiResponse.substring(0, 100)}...`);
            if (allToolCalls.length > 0) {
                console.log(`   🔧 Total tools used: ${allToolCalls.map(t => t.toolName).join(', ')}`);
            }
            
            // SAFETY CHECK: Detect if AI claims to have booked without actually calling createBooking or rescheduleBooking
            const responseLower = aiResponse.toLowerCase();
            const claimsBooking = (
                // Pattern 1: "booking" + action word
                (responseLower.includes('booking') && (
                    responseLower.includes('received') || 
                    responseLower.includes('confirmed') ||
                    responseLower.includes('booked') ||
                    responseLower.includes('set for') ||
                    responseLower.includes('moved') ||
                    responseLower.includes('rescheduled') ||
                    responseLower.includes('scheduled') ||
                    responseLower.includes('created')
                )) ||
                // Pattern 2: "i've scheduled/booked/moved"
                (responseLower.includes("i've") && (
                    responseLower.includes('scheduled') ||
                    responseLower.includes('booked') ||
                    responseLower.includes('moved') ||
                    responseLower.includes('rescheduled')
                )) ||
                // Pattern 3: "done" + booking details (date, address, estimate all present)
                (responseLower.includes('done') && 
                 responseLower.includes('date') && 
                 responseLower.includes('address') &&
                 (responseLower.includes('estimate') || responseLower.includes('rm ')))
            );
            const actuallyCalledBookingTool = allToolCalls.some(tc => 
                tc.toolName === 'createBooking' || tc.toolName === 'rescheduleBooking'
            );
            
            if (claimsBooking && !actuallyCalledBookingTool) {
                console.error(`   ⚠️⚠️⚠️ CRITICAL: AI claimed booking/reschedule but did NOT call tools!`);
                console.error(`   ⚠️ Response was: ${aiResponse.substring(0, 300)}`);

                // RETRY MECHANISM: Force the AI to call the tool
                console.log(`   🔄 Retrying with strict tool enforcement...`);
                
                const retryResult = await generateText({
                    model: openai('gpt-4o-mini'),
                    system: systemPrompt + `\n\nSYSTEM ALERT: You just claimed to have booked/rescheduled an appointment but YOU DID NOT CALL THE DATABASE TOOL. 
                    You are HALLUCINATING. 
                    STOP LYING. 
                    Call createBooking or rescheduleBooking IMMEDIATELY with the details from the conversation.`,
                    messages: [
                        ...history.slice(-20), // Reduce context to focus on immediate task
                        { role: 'user', content: messageText },
                    ],
                    tools: receptionistTools,
                    toolChoice: 'required', // FORCE tool usage
                });
                
                // If retry succeeded in calling tool, use its response instead
                const retryToolCalls = retryResult.steps.flatMap(step => step.toolCalls || []);
                if (retryToolCalls.length > 0) {
                    console.log(`   ✅ Retry successful! Tools called: ${retryToolCalls.map(t => t.toolName).join(', ')}`);
                    aiResponse = retryResult.text || aiResponse;
                    // Merge tool calls for notification handling below
                    allToolCalls.push(...retryToolCalls);
                    // Also merge tool results for the notification logic
                    retryResult.steps.forEach(step => {
                        result.steps.push(step);
                    });
                } else {
                    console.error(`   ❌ Retry failed to call tool. Converting response to error.`);
                    aiResponse = "I apologize, I'm having trouble accessing the booking calendar right now. Please try again or reply 'HUMAN' to speak with the owner.";
                }
            }

            // Handle tool results for notifications
            for (const step of result.steps) {
                for (const toolResult of step.toolResults || []) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const tr = toolResult as any;
                    // Vercel AI SDK uses 'output' not 'result'
                    const res = tr.output ?? tr.result;
                    const toolName = tr.toolName;
                    
                    console.log(`   🔔 Checking tool result for notifications: ${toolName}`, res?.success ? 'success' : res?.error || 'no status');
                    
                    // 1. Handle notifyOwner (plain text alerts for complaints/escalations)
                    if (res?.action === 'notify_owner' && res?.phone) {
                        if (twilioClient && fromNumber) {
                            try {
                                await twilioClient.messages.create({
                                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                                    to: `whatsapp:${res.phone}`,
                                    body: res.message || 'Notification from AI Receptionist',
                                });
                                console.log(`   📤 Notified owner (plain): ${res.phone}`);
                            } catch (e) {
                                console.error(`   ❌ Failed to notify owner:`, e);
                            }
                        }
                    }
                    
                    // 2. Handle createBooking → Send JOB CONFIRMED template to owner
                    if (toolName === 'createBooking' && res?.success) {
                        const ownerPhone = res.ownerPhone;
                        
                        if (ownerPhone) {
                            try {
                                await sendJobConfirmed(ownerPhone, {
                                    id: res.bookingId?.substring(0, 8).toUpperCase() || 'NEW',
                                    serviceName: res.serviceType || businessContext?.niche || 'Service',
                                    serviceEmoji: '🔧',
                                    timeSlot: res.slotLabel || 'As scheduled',
                                    address: res.address || 'Address provided',
                                    customerName: res.customerName || customerContext?.name || 'Customer',
                                    customerPhone: res.customerPhone || customerPhone,
                                    estimate: res.estimate
                                });
                                console.log(`   📤 Sent JOB CONFIRMED template to owner: ${ownerPhone}`);
                            } catch (e) {
                                console.error(`   ❌ Failed to send job confirmed:`, e);
                            }
                        } else {
                            console.log(`   ⚠️ No owner phone found for job notification`);
                        }
                    }

                    // 3. Handle cancelBooking → Send ALERT to owner
                    if (toolName === 'cancelBooking' && res?.success) {
                        const ownerPhone = businessContext?.ownerPhone;
                        if (ownerPhone && fromNumber && twilioClient) {
                            try {
                                await twilioClient.messages.create({
                                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                                    to: `whatsapp:${ownerPhone}`,
                                    body: `🔴 *JOB CANCELLED*\n\n` +
                                          `👤 ${res.customerName || 'Customer'}\n` +
                                          `🗓️ Slot: ${res.slotLabel || 'Unknown slot'}\n` +
                                          `⚠️ Please check dashboard.`
                                });
                                console.log(`   📤 Notified owner of CANCELLATION: ${ownerPhone}`);
                            } catch (e) {
                                console.error(`   ❌ Failed to notify owner of cancellation:`, e);
                            }
                        }
                    }

                    // 4. Handle rescheduleBooking → Send ALERT to owner
                    if (toolName === 'rescheduleBooking' && res?.success) {
                        const ownerPhone = businessContext?.ownerPhone;
                        if (ownerPhone && fromNumber && twilioClient) {
                            try {
                                await twilioClient.messages.create({
                                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                                    to: `whatsapp:${ownerPhone}`,
                                    body: `🔄 *JOB RESCHEDULED*\n\n` +
                                          `👤 ${res.customerName || 'Customer'}\n` +
                                          `🗓️ NEW: ${res.newSlotLabel || 'New slot'}\n` +
                                          `⚠️ Please check dashboard.`
                                });
                                console.log(`   📤 Notified owner of RESCHEDULE: ${ownerPhone}`);
                            } catch (e) {
                                console.error(`   ❌ Failed to notify owner of reschedule:`, e);
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
