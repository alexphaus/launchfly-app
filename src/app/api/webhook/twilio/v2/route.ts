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

        // Prepare phone formats for customer lookup
        const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
        const phoneWithoutPlus = customerPhone.replace(/^\+/, '');

        // If STILL no business ID, check if customer exists and get their business_id
        // This is crucial for Smart Nag - customer replies "YES" without [BIZ:] tag
        if (!businessId) {
            const { data: existingCustomer } = await supabase
                .from('customers')
                .select('business_id, status')
                .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            
            if (existingCustomer?.business_id) {
                businessId = existingCustomer.business_id;
                console.log(`   📱 Found customer's business_id from DB: ${businessId}`);
            }
        }

        // 3. Build context for the AI - PARALLEL FETCHING for speed (Gap 3 fix)
        let businessContext: BusinessContext | null = null;
        let customerContext: CustomerContext | null = null;

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
                
                // ============================================================
                // 🔔 SMART NAG: Handle "YES" response to 6-month reminder
                // ============================================================
                // When customer replies "yes/ok/book/etc" after receiving reminder
                const customerStatus = customer.status;
                const isReminderResponse = customerStatus === 'reminder_sent' || customerStatus === 'reengaged';
                const isConfirmation = /^(yes|ok|okay|yep|yeah|book|sure|hi|hello|interested|1)$/i.test(messageText.trim());
                
                if (isReminderResponse && isConfirmation) {
                    console.log('🔔 Hot lead! Customer responding to Smart Nag reminder');
                    
                    const customerName = customer.first_name || customer.name?.split(' ')[0] || 'Boss';
                    const businessName = business?.name || 'Business';
                    const niche = (business?.business_data as { niche?: string })?.niche || 'Service';
                    
                    // Get their last service for context
                    const { data: lastService } = await supabase
                        .from('service_records')
                        .select('service_name, appliance_type, next_service_due_at')
                        .eq('customer_id', customer.id)
                        .order('service_date', { ascending: false })
                        .limit(1)
                        .single();
                    
                    const serviceName = lastService?.service_name || niche;
                    
                    // Send warm booking prompt
                    if (twilioClient && fromNumber) {
                        await twilioClient.messages.create({
                            from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                            to: `whatsapp:${customerPhone}`,
                            body: `Great ${customerName}! 🎉 Welcome back!\n\nLet's book your ${serviceName.toLowerCase()} service.\n\nHow many units need servicing?`
                        });
                    }
                    
                    // Update status to booking flow
                    await supabase.from('customers').update({
                        status: 'sticker_units',
                        notes: (customer.notes || '') + `\n[REMINDER_CONVERTED: ${new Date().toISOString()}]`
                    }).eq('id', customer.id);
                    
                    // 🔔 NOTIFY OWNER - Customer converting from reminder!
                    const ownerPhone = business?.whatsapp_number || business?.phone_number;
                    if (ownerPhone && twilioClient && fromNumber) {
                        const cleanOwnerPhone = ownerPhone.replace(/[^\d+]/g, '');
                        try {
                            await twilioClient.messages.create({
                                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                                to: `whatsapp:${cleanOwnerPhone}`,
                                body: `🔔 *HOT LEAD!*\n\n${customerName} (${customerPhone}) responded to your reminder and wants to book!\n\nThey're in the booking flow now. 🎯`
                            });
                            console.log(`📢 Notified owner ${cleanOwnerPhone} about hot lead`);
                        } catch (notifyErr) {
                            console.error('Failed to notify owner:', notifyErr);
                        }
                    }
                    
                    console.log(`   ⏱️ V2 processed in ${Date.now() - startTime}ms (reminder conversion)`);
                    return new NextResponse(
                        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                        { headers: { 'Content-Type': 'text/xml' } }
                    );
                }
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
- Customer ID: ${customerContext?.id || ''}
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

⚠️ SLOT SELECTION TRIGGERS:
The customer has CONFIRMED when they reply with ANY of these:
- "1", "2", "3", "4" (number selection)
- "tomorrow", "today", "Wednesday", "Friday" etc (day name)
- "morning", "afternoon" (time window)
- "first one", "second one", "the first", "option 1"
- "yes", "ok", "sounds good" (after you showed slots)
When you see these replies AFTER showing available slots → CALL createBooking!

⚠️ CANCELLATION (PERMANENT DELETE - use sparingly):
When customer wants to CANCEL entirely (not reschedule), call cancelBooking:
  customerPhone: "${customerPhone}"
  businessId: "${businessId}"
  reason: (reason for cancellation)
⚠️ DO NOT use cancelBooking for date changes! It will DELETE the job!

⚠️ RESCHEDULING (PREFERRED for date/time changes):
When customer has an existing booking and wants to CHANGE the date/time:
  1. If they specify the new time (e.g., "afternoon instead", "make it Friday"), IMMEDIATELY call rescheduleBooking!
  2. If they just say "reschedule" without specifying when, show available slots first.
  3. When calling rescheduleBooking, use:
     customerPhone: "${customerPhone}"
     businessId: "${businessId}"
     newDate: (YYYY-MM-DD of the new slot)
     newWindow: "morning" or "afternoon"
  
  IMPORTANT RESCHEDULE TRIGGERS - Call rescheduleBooking IMMEDIATELY when customer says:
  - "afternoon instead" / "morning instead" → same date, different window
  - "tomorrow" / "Friday" / "next week" → different date
  - "change to..." / "move to..." / "make it..." + any time reference
  
  rescheduleBooking is ATOMIC - it updates the existing booking directly. 
  ❌ NEVER create a new booking when rescheduling!
  ❌ NEVER call cancelBooking for date changes!

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
            
            // Special handling for notifyOwner - AI often forgets to respond after calling it
            const calledNotifyOwner = allToolCalls.some(tc => tc.toolName === 'notifyOwner');
            if (calledNotifyOwner && (!aiResponse || aiResponse.length < 20)) {
                console.log(`   ⚠️ AI called notifyOwner but didn't respond, adding acknowledgment...`);
                const ownerName = businessContext?.ownerName || 'the owner';
                aiResponse = `I've notified ${ownerName} about your request - they'll reach out to you shortly. 🙏 Is there anything else I can help with in the meantime?`;
            }
            
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
            
            // SAFETY CHECK 1: Check if any booking/reschedule tool FAILED
            let bookingToolFailed = false;
            let bookingToolError = '';
            for (const step of result.steps) {
                for (const toolResult of step.toolResults || []) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const tr = toolResult as any;
                    const res = tr.output ?? tr.result;
                    const toolName = tr.toolName;
                    
                    if ((toolName === 'createBooking' || toolName === 'rescheduleBooking') && res?.success === false) {
                        bookingToolFailed = true;
                        bookingToolError = res.error || 'Unknown error';
                        console.log(`   ⚠️ BOOKING TOOL FAILED: ${toolName} - ${bookingToolError}`);
                    }
                }
            }
            
            // SAFETY CHECK 2: Detect if AI claims to have booked without actually calling createBooking or rescheduleBooking
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
                // Pattern 3: "done" + specific booking language
                (responseLower.includes('done') && (
                    responseLower.includes('scheduled') ||
                    responseLower.includes('rescheduled') ||
                    responseLower.includes('moved') ||
                    responseLower.includes('your booking') ||
                    responseLower.includes('your cleaning')
                ))
            );
            
            // If booking tool was called but FAILED, and AI claims success, override response
            if (bookingToolFailed && claimsBooking) {
                console.error(`   ⚠️⚠️⚠️ CRITICAL: AI claimed success but booking tool FAILED!`);
                console.error(`   ⚠️ Error was: ${bookingToolError}`);
                console.error(`   ⚠️ AI response was: ${aiResponse.substring(0, 300)}`);
                
                // Override with honest error message
                aiResponse = `It seems there was an issue while trying to ${
                    allToolCalls.some(tc => tc.toolName === 'rescheduleBooking') ? 'reschedule' : 'complete'
                } your booking. ${bookingToolError.includes('not found') ? 
                    'Would you like me to create a new booking for you instead?' : 
                    'Please try again or reply "HUMAN" to speak with the owner.'}`;
            }
            
            const actuallyCalledBookingTool = allToolCalls.some(tc => 
                tc.toolName === 'createBooking' || tc.toolName === 'rescheduleBooking'
            );
            
            // ALSO check if customer appears to have selected a slot but no booking was made
            const messageLower = messageText.toLowerCase().trim();
            const looksLikeSlotSelection = (
                /^[1-4]$/.test(messageLower) || // Just "1", "2", "3", "4"
                messageLower === 'tomorrow' ||
                messageLower === 'today' ||
                messageLower.includes('morning') ||
                messageLower.includes('afternoon') ||
                messageLower === 'yes' ||
                messageLower === 'ok' ||
                messageLower === 'sure' ||
                messageLower === 'sounds good' ||
                messageLower.startsWith('first') ||
                messageLower.startsWith('second') ||
                /^option\s*[1-4]$/i.test(messageLower)
            );
            
            // Check if previous response (from history) showed available slots
            const lastAssistantMsg = history.filter(h => h.role === 'assistant').pop()?.content?.toLowerCase() || '';
            const wasShowingSlots = lastAssistantMsg.includes('available') || 
                                   lastAssistantMsg.includes('1️⃣') ||
                                   lastAssistantMsg.includes('9am') ||
                                   lastAssistantMsg.includes('morning') ||
                                   lastAssistantMsg.includes('afternoon');
            
            // If customer selected a slot but we didn't book, force retry
            if (looksLikeSlotSelection && wasShowingSlots && !actuallyCalledBookingTool && !claimsBooking) {
                console.log(`   ⚠️ SLOT SELECTION DETECTED but no createBooking called! Message: "${messageText}"`);
                console.log(`   🔄 Forcing createBooking retry...`);
                
                const slotRetryResult = await generateText({
                    model: openai('gpt-4o-mini'),
                    system: systemPrompt + `\n\nSYSTEM ALERT: The customer just selected a time slot by replying "${messageText}". 
                    You MUST call createBooking NOW. Do not ask for confirmation - they already confirmed by selecting.
                    Extract the slot details from the conversation and call createBooking IMMEDIATELY.`,
                    messages: [
                        ...history.slice(-10),
                        { role: 'user', content: messageText },
                    ],
                    tools: receptionistTools,
                    toolChoice: 'required',
                });
                
                const slotRetryToolCalls = slotRetryResult.steps.flatMap(step => step.toolCalls || []);
                if (slotRetryToolCalls.some(tc => tc.toolName === 'createBooking')) {
                    console.log(`   ✅ Slot selection retry successful! createBooking called.`);
                    aiResponse = slotRetryResult.text || aiResponse;
                    allToolCalls.push(...slotRetryToolCalls);
                    slotRetryResult.steps.forEach(step => result.steps.push(step));
                }
            }
            
            // SAFETY CHECK 4: Detect reschedule request that didn't call rescheduleBooking
            const looksLikeRescheduleRequest = (
                // Pattern: "X instead" (afternoon instead, morning instead)
                (messageLower.includes('instead')) ||
                // Pattern: "change to/my X"
                (messageLower.includes('change') && (messageLower.includes('to') || messageLower.includes('time') || messageLower.includes('date') || messageLower.includes('my'))) ||
                // Pattern: "move to/it"
                (messageLower.includes('move') && (messageLower.includes('to') || messageLower.includes('it'))) ||
                // Pattern: "switch to"
                (messageLower.includes('switch')) ||
                // Pattern: "make it X"
                (messageLower.includes('make it')) ||
                // Pattern: "reschedule" (not as question)
                (messageLower.includes('reschedule') && !messageLower.includes('?')) ||
                // Pattern: "can't make morning/afternoon"
                (messageLower.includes("can't make") || messageLower.includes("cant make")) ||
                // Pattern: "X doesn't work"
                (messageLower.includes("doesn't work") || messageLower.includes("doesnt work")) ||
                // Pattern: just "afternoon please" or "morning please" (after showing booking)
                ((messageLower.includes('afternoon') || messageLower.includes('morning')) && messageLower.includes('please'))
            );
            const calledRescheduleBooking = allToolCalls.some(tc => tc.toolName === 'rescheduleBooking');
            const hasExistingBooking = customerContext?.id || lastAssistantMsg.includes('booking') || lastAssistantMsg.includes('scheduled') || lastAssistantMsg.includes('appointment');
            
            if (looksLikeRescheduleRequest && hasExistingBooking && !calledRescheduleBooking) {
                console.log(`   ⚠️ RESCHEDULE REQUEST DETECTED but rescheduleBooking not called! Message: "${messageText}"`);
                console.log(`   🔄 Forcing rescheduleBooking retry...`);
                
                // FIRST: Get the current booking to preserve its date if user only changes window
                const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
                const phoneWithoutPlus = customerPhone.replace(/^\+/, '');
                const todayDate = new Date().toISOString().split('T')[0];
                
                const { data: currentBooking } = await supabase
                    .from('bookings')
                    .select('id, slot_date, slot_time')
                    .eq('business_id', businessId)
                    .or(`customer_phone.eq.${phoneWithPlus},customer_phone.eq.${phoneWithoutPlus}`)
                    .in('status', ['pending', 'confirmed'])
                    .gte('slot_date', todayDate)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .single();
                
                console.log(`   📋 Current booking found:`, currentBooking ? `${currentBooking.slot_date} ${currentBooking.slot_time}` : 'none');
                
                // Determine the new window from the message
                const wantsAfternoon = messageLower.includes('afternoon');
                const wantsMorning = messageLower.includes('morning') && !messageLower.includes("can't") && !messageLower.includes("cant");
                
                // Use the CURRENT booking date unless user specifies a different day
                // This fixes the bug where "morning instead" would incorrectly use tomorrow
                let targetDate = currentBooking?.slot_date || todayDate;
                const specifiedDayInMessage = messageLower.includes('tomorrow') || messageLower.includes('today') || 
                    /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(messageLower);
                
                if (specifiedDayInMessage || !currentBooking) {
                    // User specified a day, or no booking found - default to tomorrow
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    targetDate = tomorrow.toISOString().split('T')[0];
                }
                
                // If user says "X instead", they want to flip the current window
                // Otherwise use what they specified or default to afternoon
                let targetWindow: string;
                if (messageLower.includes('instead') && currentBooking) {
                    // User wants to flip window
                    if (wantsAfternoon) targetWindow = 'afternoon';
                    else if (wantsMorning) targetWindow = 'morning';
                    else targetWindow = currentBooking.slot_time === 'morning' ? 'afternoon' : 'morning';
                } else {
                    targetWindow = wantsAfternoon ? 'afternoon' : (wantsMorning ? 'morning' : 'afternoon');
                }
                
                console.log(`   🎯 Reschedule target: ${targetDate} ${targetWindow}`);
                
                const rescheduleRetryResult = await generateText({
                    model: openai('gpt-4o-mini'),
                    system: `You are a booking assistant. Your ONLY job right now is to call rescheduleBooking.

CALL rescheduleBooking with EXACTLY these values:
- customerPhone: "${customerPhone}"
- businessId: "${businessId}"  
- newDate: "${targetDate}"
- newWindow: "${targetWindow}"

Do NOT use bookingId - leave it empty and the system will find it.
Do NOT call any other tool. ONLY call rescheduleBooking.`,
                    messages: [
                        { role: 'user', content: `Reschedule booking to ${targetWindow}` },
                    ],
                    tools: {
                        rescheduleBooking: receptionistTools.rescheduleBooking,
                    },
                    toolChoice: { type: 'tool', toolName: 'rescheduleBooking' },
                });
                
                const rescheduleRetryToolCalls = rescheduleRetryResult.steps.flatMap(step => step.toolCalls || []);
                const rescheduleRetryResults = rescheduleRetryResult.steps.flatMap(step => step.toolResults || []);
                
                if (rescheduleRetryToolCalls.some(tc => tc.toolName === 'rescheduleBooking')) {
                    console.log(`   ✅ Reschedule retry successful! rescheduleBooking called.`);
                    
                    // Check if it actually succeeded
                    const rescheduleResult = rescheduleRetryResults.find(tr => (tr as any).toolName === 'rescheduleBooking');
                    const rescheduleOutput = (rescheduleResult as any)?.output ?? (rescheduleResult as any)?.result;
                    
                    if (rescheduleOutput?.success) {
                        aiResponse = `Done! ✅ Your booking has been rescheduled to **${rescheduleOutput.newSlotLabel || targetWindow}**.\n\nThe technician will WhatsApp you 30 minutes before arrival. Anything else I can help with?`;
                    } else {
                        aiResponse = `I apologize, I had trouble rescheduling your booking. ${rescheduleOutput?.error || 'Please try again or reply "HUMAN" to speak with the owner.'}`;
                    }
                    
                    allToolCalls.push(...rescheduleRetryToolCalls);
                    // Don't push steps since they have different tool types
                    // The tool results are still captured in allToolCalls
                }
            }
            
            if (claimsBooking && !actuallyCalledBookingTool) {
                console.error(`   ⚠️⚠️⚠️ CRITICAL: AI claimed booking/reschedule but did NOT call tools!`);
                console.error(`   ⚠️ Response was: ${aiResponse.substring(0, 300)}`);

                // Check if this looks like a new booking (has address info) or a reschedule
                const historyText = history.map(h => h.content).join(' ').toLowerCase();
                const hasAddressInConversation = historyText.includes('makati') || historyText.includes('manila') || 
                    historyText.includes('ave') || historyText.includes('street') || historyText.includes('unit') ||
                    historyText.includes('blk') || historyText.includes('lot') || /\d+\s+\w+\s+(?:street|st|ave|avenue)/i.test(historyText);
                const hasDateInConversation = historyText.includes('friday') || historyText.includes('morning') || 
                    historyText.includes('afternoon') || historyText.includes('tomorrow') || historyText.includes('today');

                // RETRY MECHANISM: Force the AI to call the correct tool
                console.log(`   🔄 Retrying with strict tool enforcement...`);
                console.log(`   📍 Has address: ${hasAddressInConversation}, Has date: ${hasDateInConversation}`);
                
                // If we have both address and date info, this is likely a new booking that should be forced
                if (hasAddressInConversation && hasDateInConversation) {
                    console.log(`   🎯 Forcing createBooking with specific tool choice...`);
                    
                    const bookingRetryResult = await generateText({
                        model: openai('gpt-4o-mini'),
                        system: `You are a booking assistant. Your ONLY job is to call createBooking NOW.

Extract from the conversation:
- Customer name: "${customerContext?.name || 'Customer'}"
- Customer phone: "${customerPhone}"
- Business ID: "${businessId}"
- Customer ID: "${customerContext?.id || ''}"
- Address: (find in conversation - look for street/ave/makati etc)
- Date: (find in conversation - Friday = 2026-01-31, etc)
- Window: "morning" or "afternoon" (from conversation)
- Service type: "Aircon Cleaning (1 unit)" or similar
- Estimate: 120 or the amount from conversation

CALL createBooking NOW with these parameters. Do NOT ask questions.`,
                        messages: [
                            ...history.slice(-15),
                            { role: 'user', content: messageText },
                        ],
                        tools: {
                            createBooking: receptionistTools.createBooking,
                        },
                        toolChoice: { type: 'tool', toolName: 'createBooking' },
                    });
                    
                    const bookingRetryToolCalls = bookingRetryResult.steps.flatMap(step => step.toolCalls || []);
                    const bookingRetryResults = bookingRetryResult.steps.flatMap(step => step.toolResults || []);
                    
                    if (bookingRetryToolCalls.some(tc => tc.toolName === 'createBooking')) {
                        console.log(`   ✅ Booking retry called createBooking!`);
                        
                        const bookingResult = bookingRetryResults.find(tr => (tr as any).toolName === 'createBooking');
                        const bookingOutput = (bookingResult as any)?.output ?? (bookingResult as any)?.result;
                        
                        if (bookingOutput?.success) {
                            console.log(`   ✅ createBooking SUCCESS in retry!`);
                            aiResponse = bookingRetryResult.text || `Your booking has been confirmed! ✅\n\n📅 ${bookingOutput.slotLabel || 'Your selected slot'}\n📍 ${bookingOutput.address || 'Address confirmed'}\n💰 ${bookingOutput.estimate || 'Price confirmed'}\n\nThe technician will WhatsApp you 30 minutes before arrival. Anything else I can help with?`;
                            allToolCalls.push(...bookingRetryToolCalls);
                            bookingRetryResult.steps.forEach(step => result.steps.push(step));
                        } else {
                            console.log(`   ❌ createBooking FAILED in retry: ${bookingOutput?.error}`);
                            aiResponse = `I apologize, I had trouble completing your booking. ${bookingOutput?.error || 'Please try again or reply "HUMAN" to speak with the owner.'}`;
                        }
                    }
                } else {
                    // Generic retry with all tools
                    const retryResult = await generateText({
                        model: openai('gpt-4o-mini'),
                        system: systemPrompt + `\n\nSYSTEM ALERT: You just claimed to have booked/rescheduled an appointment but YOU DID NOT CALL THE DATABASE TOOL. 
                        You are HALLUCINATING. 
                        STOP LYING. 
                        Call createBooking or rescheduleBooking IMMEDIATELY with the details from the conversation.`,
                        messages: [
                            ...history.slice(-20),
                            { role: 'user', content: messageText },
                        ],
                        tools: receptionistTools,
                        toolChoice: 'required',
                    });
                    
                    const retryToolCalls = retryResult.steps.flatMap(step => step.toolCalls || []);
                    if (retryToolCalls.length > 0) {
                        console.log(`   ✅ Retry successful! Tools called: ${retryToolCalls.map(t => t.toolName).join(', ')}`);
                        aiResponse = retryResult.text || aiResponse;
                        allToolCalls.push(...retryToolCalls);
                        retryResult.steps.forEach(step => {
                            result.steps.push(step);
                        });
                    } else {
                        console.error(`   ❌ Retry failed to call tool. Converting response to error.`);
                        aiResponse = "I apologize, I'm having trouble accessing the booking calendar right now. Please try again or reply 'HUMAN' to speak with the owner.";
                    }
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
