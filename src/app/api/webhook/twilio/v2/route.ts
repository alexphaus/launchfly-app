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
import { Guardrails } from '@/lib/ai-receptionist/guardrails';

export const maxDuration = 60; // Allow up to 60s processing (prevents timeouts on cold starts)
export const dynamic = 'force-dynamic'; // Ensure dynamic execution

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

        // 🎯 BRANDED DEMO - "DEMO: BusinessName" format for sales presentations
        // Shows prospects the sticker scan experience with their brand name
        const brandedDemoMatch = messageText.match(/^DEMO:\s*(.+)$/i);
        if (brandedDemoMatch && twilioClient && fromNumber) {
            const brandName = brandedDemoMatch[1].trim();
            console.log(`   🎯 BRANDED DEMO activated for: ${customerPhone}, Brand: "${brandName}"`);
            
            // Use DANS as backend but display custom brand name
            const DEMO_BUSINESS_ID = '525b6e62-efb4-4c85-aee0-da47eedbdcc4'; // DANS. AIRCON TEAM
            
            // Fire and forget: Alert Alex (don't wait for it)
            const alexPhone = '+639627459049';
            twilioClient.messages.create({
                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                to: `whatsapp:${alexPhone}`,
                body: `🎯 BRANDED DEMO!\n\nProspect trying: "${brandName}"\n📱 ${customerPhone}\n⏰ ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`
            }).catch((e: Error) => console.log('Demo alert failed:', e.message));
            
            // Simulate sticker scan welcome - this is what their customers would see!
            const brandedWelcome = `Welcome to *${brandName}*! 👋

To activate your *30-Day Service Warranty*, please reply with your *Full Name*.

_(This is what your customer sees after scanning the sticker. Their phone number is already captured automatically! 📱)_`;

            await twilioClient.messages.create({
                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                to: from,
                body: brandedWelcome,
            });
            
            // Save to history with demo context so AI knows this is branded demo mode
            await saveMessage(customerPhone, 'user', `[BRANDED_DEMO:${brandName}] Customer scanning sticker`, DEMO_BUSINESS_ID);
            await saveMessage(customerPhone, 'assistant', brandedWelcome, DEMO_BUSINESS_ID);
            
            console.log(`   ⚡ BRANDED DEMO response sent in ${Date.now() - startTime}ms`);
            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // 🎯 DEMO FAST-PATH - Optimized experience for prospects
        // Skips all DB lookups and sends instant response
        const isDemoTrigger = messageText.trim().toUpperCase() === 'DEMO';
        if (isDemoTrigger && twilioClient && fromNumber) {
            console.log(`   🎯 DEMO FAST-PATH activated for: ${customerPhone}`);
            
            // Use a real demo business for full functionality
            const DEMO_BUSINESS_ID = 'e8fc5a62-19df-473f-b275-d159e563050e'; // Relano Airconditioning
            
            // Fire and forget: Alert Alex (don't wait for it)
            const alexPhone = '+639627459049';
            twilioClient.messages.create({
                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                to: `whatsapp:${alexPhone}`,
                body: `🎯 DEMO Alert!\n\nA prospect is trying your bot!\n📱 ${customerPhone}\n⏰ ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`
            }).catch((e: Error) => console.log('Demo alert failed:', e.message));
            
            // INSTANT response - no AI call, no DB lookup
            const demoWelcome = `Hey! 👋 Welcome to the AI Receptionist demo!

I'm an AI that handles customer inquiries 24/7 for service businesses.

*Try me out - pretend you're a customer:*
• "I need a service"
• "How much for 2 units?"
• "Book me for tomorrow morning"
• "I have a complaint" (I handle complaints too!)

Or ask me anything! I can check availability, give quotes, and book jobs automatically. 🤖`;

            await twilioClient.messages.create({
                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                to: from,
                body: demoWelcome,
            });
            
            // Save to history with demo business ID so follow-up messages have context
            await saveMessage(customerPhone, 'user', messageText, DEMO_BUSINESS_ID);
            await saveMessage(customerPhone, 'assistant', demoWelcome, DEMO_BUSINESS_ID);
            
            console.log(`   ⚡ DEMO response sent in ${Date.now() - startTime}ms (fast-path)`);
            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // 2. Extract business ID from [BIZ:uuid] or (Ref: uuid/subdomain) if present
        const bizMatch = messageText.match(/\[BIZ:([a-f0-9-]+)\]/i);
        const refMatch = messageText.match(/\(Ref:\s*([a-zA-Z0-9-]+)\)/i);
        let businessId = bizMatch ? bizMatch[1] : null;
        let businessSubdomain = (!businessId && refMatch) ? refMatch[1] : null;
        
        // 🏷️ STICKER SCAN DETECTION - Track when someone scans the warranty QR sticker
        const isStickerScan = messageText.toLowerCase().includes('activate') && 
                             messageText.toLowerCase().includes('warranty') &&
                             refMatch !== null;
        
        // If ref is a subdomain (not UUID format), look up the business ID
        if (businessSubdomain && !/^[a-f0-9-]{36}$/i.test(businessSubdomain)) {
            const { data: bizBySubdomain } = await supabase
                .from('businesses')
                .select('id, name, whatsapp_number, phone_number')
                .eq('subdomain', businessSubdomain.toLowerCase())
                .single();
            if (bizBySubdomain) {
                businessId = bizBySubdomain.id;
                console.log(`   🔗 Resolved subdomain '${businessSubdomain}' to business ID: ${businessId}`);
                
                // 📊 LOG STICKER SCAN for analytics
                if (isStickerScan) {
                    console.log(`   🏷️ STICKER SCAN DETECTED! Business: ${bizBySubdomain.name}, Customer: ${customerPhone}`);
                    
                    // Log to database for tracking
                    try {
                        const { error: scanError } = await supabase.from('sticker_scans').insert({
                            business_id: businessId,
                            customer_phone: customerPhone,
                            source: 'warranty_sticker',
                            scanned_at: new Date().toISOString()
                        });
                        if (scanError) {
                            console.log(`   ⚠️ Could not log sticker scan (table may not exist): ${scanError.message}`);
                        } else {
                            console.log(`   📊 Sticker scan logged to database`);
                        }
                    } catch (err) {
                        console.log(`   ⚠️ Sticker scan logging error: ${err}`);
                    }
                    
                    // 🔔 NOTIFY OWNER - Someone scanned their sticker!
                    // DISABLED: Too noisy for owners, AI handles it automatically
                    // const ownerPhone = bizBySubdomain.whatsapp_number || bizBySubdomain.phone_number;
                    // if (ownerPhone && twilioClient && fromNumber) {
                    //     const cleanOwnerPhone = ownerPhone.replace(/[^\d+]/g, '');
                    //     try {
                    //         await twilioClient.messages.create({
                    //             from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    //             to: `whatsapp:${cleanOwnerPhone}`,
                    //             body: `🏷️ Sticker Scan Alert!\n\nSomeone just scanned your warranty sticker!\n📱 ${customerPhone}\n\nThey're activating their warranty now. The AI will handle it automatically.`
                    //         });
                    //         console.log(`   📢 Notified owner ${cleanOwnerPhone} about sticker scan`);
                    //     } catch (notifyErr) {
                    //         console.error('Failed to notify owner about sticker scan:', notifyErr);
                    //     }
                    // }
                }
            }
        } else if (refMatch && !businessId) {
            // Ref contains a UUID directly
            businessId = refMatch[1];
        }

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
                    niche: config.niche || 'General Service',
                    currency: config.currency || 'RM',
                    cleaningPrice: config.cleaningPrice || 120,
                    repairInspectionFee: config.repairInspectionFee || 80,
                    warrantyDays: config.warrantyDays || 30,
                    serviceInterval: config.serviceInterval || 90,
                    ownerName: config.ownerName,
                    ownerPhone: business.whatsapp_number || business.phone_number,
                    operatingHours: config.operatingHours || '9am - 5pm',
                    googleReviewLink: config.googleReviewLink,
                    serviceLabels: config.serviceLabels || undefined,  // Per-niche vocabulary (falls back to niche defaults)
                    customRules: config.customRules || undefined,      // Business-specific rules
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
                    status: customer.status, // Pass status so system prompt knows if mid-booking
                    lastInteractionContext: customer.last_interaction_context,
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
                    
                    // Update status to booking flow AND save context to history
                    await supabase.from('customers').update({
                        status: 'booking_in_progress', // Use clear status that V2 won't override
                        notes: (customer.notes || '') + `\n[REMINDER_CONVERTED: ${new Date().toISOString()}]`
                    }).eq('id', customer.id);
                    
                    // Save the AI response to history so next message has context
                    await saveMessage(customerPhone, 'assistant', `Great ${customerName}! 🎉 Welcome back!\n\nLet's book your ${serviceName.toLowerCase()} service.\n\nHow many units need servicing?`, businessId);
                    
                    // 🔔 NOTIFY OWNER - Customer converting from reminder!
                    // Uses WhatsApp Utility Template (outside 24h window safe)
                    const ownerPhone = business?.whatsapp_number || business?.phone_number;
                    if (ownerPhone && twilioClient && fromNumber) {
                        const cleanOwnerPhone = ownerPhone.replace(/[^\d+]/g, '');
                        const HOT_LEAD_TEMPLATE_SID = process.env.TWILIO_TEMPLATE_HOT_LEAD || 'HX065c2eed9f9dd38b6aaa60ef5e06bd41';
                        
                        try {
                            await twilioClient.messages.create({
                                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                                to: `whatsapp:${cleanOwnerPhone}`,
                                contentSid: HOT_LEAD_TEMPLATE_SID,
                                contentVariables: JSON.stringify({
                                    '1': customerName,
                                    '2': customerPhone,
                                }),
                            });
                            console.log(`📢 Notified owner ${cleanOwnerPhone} about hot lead (template)`);
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

            // ============================================================
            // 💰 QUOTE FOLLOW-UP ROUTING
            // If this phone has an active quote lead in an active sequence
            // status, route to the negotiation engine instead of the receptionist.
            // Implements: Stop on Reply, Snooze, Breakup Choice, Handoff Protocol.
            // ============================================================
            try {
                const { data: activeQuoteLead } = await supabase
                    .from('quote_leads')
                    .select('id, name, phone, quote_amount, job_type, status, business_id, currency, contractor_id, stripe_payment_link, sequence_step, sequence_paused, sequence_completed')
                    .eq('phone', phoneWithPlus)
                    .not('status', 'in', '("Booked","Lost","Archived")')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (activeQuoteLead) {
                    console.log(`   💰 Quote lead detected: ${activeQuoteLead.id} (status: ${activeQuoteLead.status}, step: ${activeQuoteLead.sequence_step}) — routing to negotiation engine`);

                    // Lazy imports
                    const { negotiate } = await import('@/lib/quote-followup/openai');
                    const { sendWhatsApp } = await import('@/lib/quote-followup/whatsapp');
                    const {
                        pauseSequenceOnReply,
                        snoozeSequence,
                        parseSnoozeDuration,
                        detectBreakupChoice,
                        INTENT_PATTERNS,
                    } = await import('@/lib/quote-followup/sequence');

                    // ── STOP ON REPLY: Pause the automated sequence immediately ──
                    if (!activeQuoteLead.sequence_paused && !activeQuoteLead.sequence_completed) {
                        await pauseSequenceOnReply(activeQuoteLead.id);
                        console.log(`   ⏸️ Sequence paused for lead ${activeQuoteLead.id} — prospect replied`);
                    }

                    // Load business context
                    let qBizName: string | undefined;
                    let qOwnerName: string | undefined;
                    let qOwnerPhone: string | undefined;
                    let qNiche: string | undefined;
                    const qCurrency = activeQuoteLead.currency || 'USD';

                    if (activeQuoteLead.business_id) {
                        const { data: qBiz } = await supabase
                            .from('businesses')
                            .select('name, whatsapp_number, phone_number, business_data')
                            .eq('id', activeQuoteLead.business_id)
                            .single();
                        if (qBiz) {
                            qBizName = qBiz.name;
                            qOwnerPhone = qBiz.whatsapp_number || qBiz.phone_number;
                            const cfg = (qBiz.business_data || {}) as Record<string, unknown>;
                            qOwnerName = cfg.ownerName as string | undefined;
                            qNiche = cfg.niche as string | undefined;
                        }
                    }

                    // ── Check for STOP/opt-out triggers ──────────────────────
                    if (INTENT_PATTERNS.stop.test(messageText)) {
                        await supabase.from('quote_leads').update({
                            status: 'Lost',
                            sequence_completed: true,
                            sequence_paused: true,
                        }).eq('id', activeQuoteLead.id);

                        const stopReply = `No problem at all, ${activeQuoteLead.name.split(' ')[0]}. I've removed you from our follow-up list. If you ever need us in the future, just reach out. Take care! 👋`;
                        await sendWhatsApp(phoneWithPlus, stopReply);
                        console.log(`   🛑 Prospect opted out, lead marked Lost`);

                        return new NextResponse(
                            '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                            { headers: { 'Content-Type': 'text/xml' } }
                        );
                    }

                    // ── Check for Day 14 breakup A/B/C reply ─────────────────
                    const breakupChoice = detectBreakupChoice(messageText);
                    if (breakupChoice && activeQuoteLead.sequence_step >= 6) {
                        await supabase.from('quote_leads').update({
                            breakup_reply: breakupChoice,
                        }).eq('id', activeQuoteLead.id);

                        let breakupReply = '';
                        if (breakupChoice === 'A') {
                            // Timing isn't right → snooze for 30 days
                            await snoozeSequence(activeQuoteLead.id, 30);
                            breakupReply = `Totally understand, ${activeQuoteLead.name.split(' ')[0]}! Timing is everything. I'll check back in about a month to see if things have changed. Just reply here anytime if you want to pick it back up sooner. 👍`;
                        } else if (breakupChoice === 'B') {
                            // Went with someone else → mark lost
                            await supabase.from('quote_leads').update({ status: 'Lost' }).eq('id', activeQuoteLead.id);
                            breakupReply = `Appreciate you letting us know! Hope the project turns out great. If you ever need anything in the future, this thread is always open. 🙏`;
                        } else if (breakupChoice === 'C') {
                            // Still thinking → snooze for 7 days
                            await snoozeSequence(activeQuoteLead.id, 7);
                            breakupReply = `No rush at all! I'll check back in about a week. In the meantime, reply here anytime with questions. 😊`;
                        }

                        await sendWhatsApp(phoneWithPlus, breakupReply);
                        await supabase.from('quote_chat_history').insert([
                            { lead_id: activeQuoteLead.id, role: 'user', content: messageText },
                            { lead_id: activeQuoteLead.id, role: 'assistant', content: breakupReply },
                        ]);

                        // Notify contractor about the feedback
                        if (qOwnerPhone && twilioClient && fromNumber) {
                            const feedbackMap: Record<string, string> = {
                                A: 'timing not right yet',
                                B: 'went with someone else',
                                C: 'still thinking about it',
                            };
                            const cleanOwner = qOwnerPhone.replace(/[^\d+]/g, '');
                            twilioClient.messages.create({
                                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                                to: `whatsapp:${cleanOwner}`,
                                body: `📊 Quote Follow-Up Update\n\n${activeQuoteLead.name} replied to the break-up message:\n→ "${feedbackMap[breakupChoice]}"\n\nJob: ${activeQuoteLead.job_type} (${qCurrency}${activeQuoteLead.quote_amount.toLocaleString()})`,
                            }).catch((e: Error) => console.warn('Breakup notification failed:', e.message));
                        }

                        console.log(`   📊 Breakup choice: ${breakupChoice} for lead ${activeQuoteLead.id}`);
                        return new NextResponse(
                            '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                            { headers: { 'Content-Type': 'text/xml' } }
                        );
                    }

                    // ── Check for HIGH INTENT triggers → Handoff Protocol ───
                    if (INTENT_PATTERNS.highIntent.test(messageText)) {
                        console.log(`   🔥 HIGH INTENT detected! Alerting contractor.`);

                        // Alert contractor immediately
                        if (qOwnerPhone && twilioClient && fromNumber) {
                            const cleanOwner = qOwnerPhone.replace(/[^\d+]/g, '');
                            twilioClient.messages.create({
                                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                                to: `whatsapp:${cleanOwner}`,
                                body: `🔥 HOT LEAD!\n\n${activeQuoteLead.name} (${activeQuoteLead.phone}) just said: "${messageText.substring(0, 100)}"\n\nJob: ${activeQuoteLead.job_type} (${qCurrency}${activeQuoteLead.quote_amount.toLocaleString()})\n\n⚡ Reply to them NOW or they'll go cold!`,
                            }).catch((e: Error) => console.warn('Hot lead notification failed:', e.message));
                        }

                        // Still let the AI respond with deposit link
                        // (falls through to negotiation below)
                    }

                    // ── Check for COMPETITOR triggers ────────────────────────
                    if (INTENT_PATTERNS.competitor.test(messageText)) {
                        await supabase.from('quote_leads').update({ status: 'Lost' }).eq('id', activeQuoteLead.id);

                        const compReply = `Appreciate you letting us know! We hope the project turns out great. If you ever need us for a future project, just reply to this thread — we're always here. Take care! 🙏`;
                        await sendWhatsApp(phoneWithPlus, compReply);
                        await supabase.from('quote_chat_history').insert([
                            { lead_id: activeQuoteLead.id, role: 'user', content: messageText },
                            { lead_id: activeQuoteLead.id, role: 'assistant', content: compReply },
                        ]);

                        if (qOwnerPhone && twilioClient && fromNumber) {
                            const cleanOwner = qOwnerPhone.replace(/[^\d+]/g, '');
                            twilioClient.messages.create({
                                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                                to: `whatsapp:${cleanOwner}`,
                                body: `📉 Lost to Competitor\n\n${activeQuoteLead.name} went with someone else.\nJob: ${activeQuoteLead.job_type} (${qCurrency}${activeQuoteLead.quote_amount.toLocaleString()})`,
                            }).catch((e: Error) => console.warn('Competitor notification failed:', e.message));
                        }

                        console.log(`   📉 Competitor trigger — lead marked Lost`);
                        return new NextResponse(
                            '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                            { headers: { 'Content-Type': 'text/xml' } }
                        );
                    }

                    // ── Check for SNOOZE triggers → "Not Ready Yet" ─────────
                    if (INTENT_PATTERNS.snooze.test(messageText)) {
                        const snoozeDays = parseSnoozeDuration(messageText);
                        await snoozeSequence(activeQuoteLead.id, snoozeDays);

                        const snoozeReply = `No problem at all, ${activeQuoteLead.name.split(' ')[0]}! I'll check back in about ${snoozeDays === 7 ? 'a week' : snoozeDays === 14 ? 'two weeks' : snoozeDays === 30 ? 'a month' : `${snoozeDays} days`}. ` +
                            `In the meantime, this thread is always open if anything comes up. 👍`;
                        await sendWhatsApp(phoneWithPlus, snoozeReply);
                        await supabase.from('quote_chat_history').insert([
                            { lead_id: activeQuoteLead.id, role: 'user', content: messageText },
                            { lead_id: activeQuoteLead.id, role: 'assistant', content: snoozeReply },
                        ]);

                        console.log(`   💤 Snooze triggered: ${snoozeDays} days for lead ${activeQuoteLead.id}`);
                        return new NextResponse(
                            '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                            { headers: { 'Content-Type': 'text/xml' } }
                        );
                    }

                    // ── Standard negotiation flow ────────────────────────────

                    // Load chat history
                    const { data: historyRows } = await supabase
                        .from('quote_chat_history')
                        .select('*')
                        .eq('lead_id', activeQuoteLead.id)
                        .order('created_at', { ascending: true })
                        .limit(30);

                    // Save user message
                    await supabase.from('quote_chat_history').insert({
                        lead_id: activeQuoteLead.id,
                        role: 'user',
                        content: messageText,
                    });

                    // Run negotiation
                    const result = await negotiate({
                        customerName: activeQuoteLead.name,
                        quoteAmount: activeQuoteLead.quote_amount,
                        jobType: activeQuoteLead.job_type,
                        history: (historyRows ?? []) as import('@/lib/quote-followup/types').ChatMessage[],
                        latestMessage: messageText,
                        contractorName: qOwnerName,
                        businessName: qBizName,
                        niche: qNiche,
                        currency: qCurrency,
                    });

                    let replyText = result.reply;

                    // Handle intents from AI
                    if (result.intent === 'deposit') {
                        const { createDepositLink } = await import('@/lib/quote-followup/stripe-link');
                        const depositLink =
                            activeQuoteLead.stripe_payment_link ||
                            await createDepositLink({
                                leadId: activeQuoteLead.id,
                                customerName: activeQuoteLead.name,
                                amountCents: Math.round(activeQuoteLead.quote_amount * 0.1 * 100),
                                jobType: activeQuoteLead.job_type,
                                currency: qCurrency,
                            });

                        replyText += `\n\nHere's your secure deposit link:\n${depositLink}`;

                        await supabase.from('quote_leads').update({
                            status: 'Booked',
                            stripe_payment_link: depositLink,
                            sequence_completed: true,
                        }).eq('id', activeQuoteLead.id);

                        // Alert contractor
                        if (qOwnerPhone && twilioClient && fromNumber) {
                            const cleanOwner = qOwnerPhone.replace(/[^\d+]/g, '');
                            twilioClient.messages.create({
                                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                                to: `whatsapp:${cleanOwner}`,
                                body: `🎉 BOOKED!\n\n${activeQuoteLead.name} just accepted the ${activeQuoteLead.job_type} quote (${qCurrency}${activeQuoteLead.quote_amount.toLocaleString()})!\n\nDeposit link sent. 💰`,
                            }).catch((e: Error) => console.warn('Booking notification failed:', e.message));
                        }
                    } else if (result.intent === 'escalate') {
                        // Notify contractor
                        if (qOwnerPhone && twilioClient && fromNumber) {
                            const cleanOwner = qOwnerPhone.replace(/[^\d+]/g, '');
                            twilioClient.messages.create({
                                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                                to: `whatsapp:${cleanOwner}`,
                                body: `🚨 Quote Escalation!\n\n${activeQuoteLead.name} (${activeQuoteLead.phone}) wants to talk to you about their ${activeQuoteLead.job_type} quote (${qCurrency}${activeQuoteLead.quote_amount.toLocaleString()}).`,
                            }).catch((e: Error) => console.warn('Contractor escalation notify failed:', e.message));
                        }
                        replyText += "\n\nI've flagged this — someone from the team will call you shortly.";
                    } else if (result.intent === 'lost') {
                        await supabase.from('quote_leads').update({
                            status: 'Lost',
                            sequence_completed: true,
                        }).eq('id', activeQuoteLead.id);
                    } else if (result.intent === 'snooze') {
                        const days = result.snoozeDays || 7;
                        await snoozeSequence(activeQuoteLead.id, days);
                    }

                    // Save assistant reply
                    await supabase.from('quote_chat_history').insert({
                        lead_id: activeQuoteLead.id,
                        role: 'assistant',
                        content: replyText,
                    });

                    // Send WhatsApp reply
                    await sendWhatsApp(phoneWithPlus, replyText);

                    console.log(`   💰 Quote negotiation reply sent (intent: ${result.intent}) in ${Date.now() - startTime}ms`);
                    return new NextResponse(
                        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                        { headers: { 'Content-Type': 'text/xml' } }
                    );
                }
            } catch (quoteRouteErr) {
                // Non-fatal — fall through to normal receptionist flow
                console.warn('[v2] Quote-lead routing error (falling through):', quoteRouteErr);
            }

            // Save incoming message to history (Fire and forget, but track the promise)
            // We don't need to await this before calling AI, as we pass messageText explicitly
            const saveMessagePromise = saveMessage(customerPhone, 'user', messageText, businessId)
                .catch(err => console.error('Error saving user message:', err));

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
  serviceType: (e.g., "${businessContext?.niche || 'Service'} (1 ${(businessContext as any)?.serviceLabels?.unitLabel || 'unit'})")
  estimateAmount: (the price as a number, e.g., 120)
  currency: "${businessContext?.currency || 'RM'}"

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

⚠️ FEEDBACK TOOLS (7-Day Follow-Up):
When "Context Tag: FEEDBACK_7D" is present and customer gives feedback:
  - POSITIVE feedback ("great", "cold", "good", "yes", "👍"):
    Call saveFeedback with:
      customerId: "${customerContext?.id || ''}"
      businessId: "${businessId}"
      score: 1 (excellent) or 2 (good)
    Then ask for referral!
    
  - NEGATIVE feedback ("not cold", "problem", "bad", "no", "👎"):
    Call saveFeedback with:
      customerId: "${customerContext?.id || ''}"
      businessId: "${businessId}"
      score: 3 (not good)
    Then call notifyOwner and offer warranty repair.

⚠️ REFERRAL TOOL:
When customer provides a friend's name AND phone (e.g., "Ahmad 0123456789"):
  Call saveReferral with:
    businessId: "${businessId}"
    referrerId: "${customerContext?.id || ''}"
    refereeName: (the friend's name)
    refereePhone: (the friend's phone)

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
            const { isHallucinating: claimsBooking } = Guardrails.detectHallucination(aiResponse, allToolCalls);
            
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
            
            // Check if previous response (from history) showed available slots
            const lastAssistantMsg = history.filter(h => h.role === 'assistant').pop()?.content?.toLowerCase() || '';
            
            // Use Guardrails for detection
            const looksLikeSlotSelection = Guardrails.looksLikeSlotSelection(messageText, lastAssistantMsg);
            let looksLikeRescheduleRequest = Guardrails.looksLikeReschedule(messageText);

            const calledRescheduleBooking = allToolCalls.some(tc => tc.toolName === 'rescheduleBooking');
            const hasExistingBooking = customerContext?.id || lastAssistantMsg.includes('booking') || lastAssistantMsg.includes('scheduled') || lastAssistantMsg.includes('appointment');
            
            // Helper for retry logic
            const messageLower = messageText.toLowerCase().trim();

            // "Smart" Check: If regex missed it but context suggests it (e.g. other languages), verify intent
            if (!looksLikeRescheduleRequest && hasExistingBooking && allToolCalls.length === 0 && messageText.length < 100) {
                // Only run smart check if we think we might have missed something
                const intent = await Guardrails.validateIntent(messageText, history);
                if (intent === 'reschedule') {
                    console.log(`   🧠 Guardrails Smart Check detected reschedule intent!`);
                    looksLikeRescheduleRequest = true;
                }
            }

            // RESCHEDULE CHECK - Run BEFORE slot selection!
            // If customer wants to reschedule and we didn't call rescheduleBooking, handle it first
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
                let targetDate = currentBooking?.slot_date || todayDate;
                const specifiedDayInMessage = messageLower.includes('tomorrow') || messageLower.includes('today') || 
                    /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(messageLower);
                
                if (specifiedDayInMessage || !currentBooking) {
                    // User specified a day, or no booking found - calculate the target date
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    targetDate = tomorrow.toISOString().split('T')[0];
                    
                    // Check for specific day names
                    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    for (const day of dayNames) {
                        if (messageLower.includes(day)) {
                            const todayObj = new Date();
                            const todayDay = todayObj.getDay();
                            const targetDay = dayNames.indexOf(day);
                            let daysUntil = targetDay - todayDay;
                            if (daysUntil <= 0) daysUntil += 7;
                            todayObj.setDate(todayObj.getDate() + daysUntil);
                            targetDate = todayObj.toISOString().split('T')[0];
                            break;
                        }
                    }
                }
                
                // If user says "X instead", they want to flip the current window
                let targetWindow: string;
                if (messageLower.includes('instead') && currentBooking) {
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
                }
            }
            
            // If customer selected a slot but we didn't book (and this ISN'T a reschedule request), force booking retry
            else if (looksLikeSlotSelection && !actuallyCalledBookingTool && !claimsBooking) {
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
            
            if (claimsBooking && !actuallyCalledBookingTool) {
                console.error(`   ⚠️⚠️⚠️ CRITICAL: AI claimed booking/reschedule but did NOT call tools!`);
                console.error(`   ⚠️ Response was: ${aiResponse.substring(0, 300)}`);

                // Check if this looks like an address was just provided (for createBooking retry)
                const looksLikeAddress = messageText.length > 5 && (
                    /\d/.test(messageText) || // Has numbers (street number)
                    messageText.toLowerCase().includes('street') ||
                    messageText.toLowerCase().includes('ave') ||
                    messageText.toLowerCase().includes('road') ||
                    messageText.toLowerCase().includes('blvd') ||
                    messageText.toLowerCase().includes('building') ||
                    messageText.toLowerCase().includes('floor') ||
                    messageText.toLowerCase().includes('unit') ||
                    messageText.toLowerCase().includes('makati') ||
                    messageText.toLowerCase().includes('manila') ||
                    messageText.toLowerCase().includes('kl') ||
                    messageText.toLowerCase().includes('selangor')
                );

                // RETRY MECHANISM: Force the AI to call the tool
                console.log(`   🔄 Retrying with strict tool enforcement...`);
                console.log(`   📍 Looks like address provided: ${looksLikeAddress}`);
                
                // If address was just provided, force createBooking specifically
                if (looksLikeAddress) {
                    console.log(`   🔄 Forcing createBooking with address...`);
                    
                    const bookingRetryResult = await generateText({
                        model: openai('gpt-4o-mini'),
                        system: `You are a booking assistant. The customer just provided their ADDRESS: "${messageText}"

Your ONLY job is to call createBooking with ALL the details from conversation history.

REQUIRED: Look through the conversation to find:
- The selected DATE (e.g., "2026-01-30" or "Friday")
- The selected WINDOW ("morning" or "afternoon")
- The SERVICE TYPE (e.g., "${businessContext?.niche || 'Service'} - ${(businessContext as any)?.serviceLabels?.primaryService || 'Cleaning'}")
- The PRICE ESTIMATE (e.g., 120)

Then call createBooking with:
- businessId: "${businessId}"
- customerId: "${customerContext?.id || ''}"
- customerPhone: "${customerPhone}"
- customerName: "${customerContext?.name || ''}"
- address: "${messageText}" (THE ADDRESS JUST PROVIDED!)
- date: (YYYY-MM-DD format)
- window: "morning" or "afternoon"
- serviceType: (from conversation)
- estimateAmount: (number from conversation)
- currency: "${businessContext?.currency || 'RM'}"

DO NOT call getAvailableSlots. DO NOT ask questions. CALL createBooking NOW!`,
                        messages: [
                            ...history.slice(-15),
                            { role: 'user', content: `My address is: ${messageText}` },
                        ],
                        tools: {
                            createBooking: receptionistTools.createBooking,
                        },
                        toolChoice: { type: 'tool', toolName: 'createBooking' },
                    });
                    
                    const bookingRetryToolCalls = bookingRetryResult.steps.flatMap(step => step.toolCalls || []);
                    const bookingRetryResults = bookingRetryResult.steps.flatMap(step => step.toolResults || []);
                    
                    if (bookingRetryToolCalls.some(tc => tc.toolName === 'createBooking')) {
                        console.log(`   ✅ createBooking retry successful!`);
                        
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const bookingResult = bookingRetryResults.find(tr => (tr as any).toolName === 'createBooking');
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const bookingOutput = (bookingResult as any)?.output ?? (bookingResult as any)?.result;
                        
                        if (bookingOutput?.success) {
                            aiResponse = `Done! ✅ Your booking is confirmed!\n\n📅 ${bookingOutput.slotLabel || 'Your selected time'}\n📍 ${messageText}\n💰 ${bookingOutput.estimate || 'RM 120'}\n\nThe technician will WhatsApp you 30 minutes before arrival. 🔧`;
                        } else {
                            aiResponse = `I apologize, I had trouble creating your booking. ${bookingOutput?.error || 'Please try again or reply "HUMAN" to speak with the owner.'}`;
                        }
                        
                        allToolCalls.push(...bookingRetryToolCalls);
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        bookingRetryResult.steps.forEach(step => result.steps.push(step as any));
                    }
                } else {
                    // Generic retry for other cases
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
                        retryResult.steps.forEach(step => result.steps.push(step));
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

            // Ensure user message is saved before saving assistant response (to maintain order in DB if timestamps are close)
            // Although we fired it earlier, we must ensure it completes so the Vercel function doesn't kill it
            if (saveMessagePromise) await saveMessagePromise;

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
