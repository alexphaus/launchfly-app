// /api/webhook/twilio/route.ts
// Twilio WhatsApp Webhook - Receives incoming messages from customers
// This is called when a customer sends a message to the Launchfly assistant number
// Now with AI-powered intent classification (Smart Receptionist)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendQuoteConfirmation, sendSlotSuggester, sendJobCard, sendJobConfirmed } from '@/lib/whatsapp-push';
import { classifyIntent, shouldEscalate, isPriceObjection, type ConversationContext } from '@/lib/ai-intent';
import { handleFAQ, generateEscalationMessage, type BusinessContext } from '@/lib/faq-handler';
import twilio from 'twilio';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// Twilio client for sending messages
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

// Generate slot labels based on current time (synced with generateSlotOptions in whatsapp-push.ts)
// Uses UTC+8 timezone offset for SEA businesses
// Only shows FUTURE slots - never past times
function getSlotLabel(slotNumber: number): string {
    const now = new Date();
    // Convert UTC to UTC+8 (SEA timezone)
    const utcHour = now.getUTCHours();
    const hour = (utcHour + 8 + 24) % 24;

    // Adjust 'now' object to reflect the local time (for getting tomorrow's date correctly)
    const localNow = new Date(now.getTime() + (8 * 60 * 60 * 1000));

    const tomorrow = new Date(localNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(localNow);
    dayAfter.setDate(dayAfter.getDate() + 2);

    const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

    const slots: string[] = [];

    // Today slots - only if before the slot starts (synced with whatsapp-push.ts)
    if (hour < 9) {
        slots.push('Today 9am - 11am');
    }
    if (hour < 14) {
        slots.push('Today 2pm - 4pm');
    }
    if (hour < 16) {
        slots.push('Today 4pm - 6pm');
    }

    // Tomorrow slots (always available)
    if (slots.length < 3) {
        slots.push(`${formatDate(tomorrow)} 9am - 11am`);
    }
    if (slots.length < 3) {
        slots.push(`${formatDate(tomorrow)} 2pm - 4pm`);
    }
    // Day after (if needed)
    if (slots.length < 3) {
        slots.push(`${formatDate(dayAfter)} 10am - 12pm`);
    }

    return slots[slotNumber - 1] || slots[0] || `${formatDate(tomorrow)} 9am - 11am`;
}

export async function POST(request: NextRequest) {
    try {
        // Twilio sends form-urlencoded data
        const formData = await request.formData();

        const from = formData.get('From') as string; // e.g., whatsapp:+34683233450
        const body = formData.get('Body') as string;
        const to = formData.get('To') as string;

        // Location pin data from Twilio
        const latitude = formData.get('Latitude') as string | null;
        const longitude = formData.get('Longitude') as string | null;
        const locationAddress = formData.get('Address') as string | null; // Address label if provided
        const locationLabel = formData.get('Label') as string | null; // Location name/label

        console.log('📨 Incoming WhatsApp message:');
        console.log(`   From: ${from}`);
        console.log(`   Body: ${body?.substring(0, 100)}...`);
        if (latitude && longitude) {
            console.log(`   📍 Location: ${latitude}, ${longitude}`);
            if (locationAddress) console.log(`   📍 Address: ${locationAddress}`);
        }

        // Extract phone number from WhatsApp format
        const customerPhone = from.replace('whatsapp:', '');
        const messageText = body?.trim() || '';

        // Check if this is a location pin share
        const isLocationPin = !!(latitude && longitude);
        // Construct address from location data (prefer Address > Label > coordinates)
        const locationDerivedAddress = locationAddress || locationLabel ||
            (isLocationPin ? `📍 Location: ${latitude}, ${longitude}` : null);

        // ========== AI INTENT CLASSIFICATION ==========
        // First, lookup customer to get conversation context
        const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
        const phoneWithoutPlus = customerPhone.replace(/^\+/, '');

        const { data: customerLookup } = await supabase
            .from('customers')
            .select('*, businesses(name, business_data, whatsapp_number), bookings(id)')
            .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // Build conversation context for AI
        const conversationContext: ConversationContext = {
            customerStatus: customerLookup?.status,
            hasQuote: customerLookup?.notes?.includes('AVAILABLE_SLOTS'),
            businessName: customerLookup?.businesses?.name,
            businessNiche: customerLookup?.businesses?.business_data?.niche,
        };

        // Special handling for location pins - always treat as address if awaiting
        if (isLocationPin && conversationContext.customerStatus === 'awaiting_address') {
            console.log('📍 Location pin received while awaiting address - treating as ADDRESS intent');
            // Continue to ADDRESS handler below
        }

        // Classify intent using AI
        const classification = await classifyIntent(messageText, conversationContext);
        console.log(`🤖 Intent: ${classification.intent} (confidence: ${classification.confidence})`);

        // Check for escalation
        if (shouldEscalate(classification)) {
            console.log('🚨 Escalation needed - notifying owner');
            const ownerPhone = customerLookup?.businesses?.whatsapp_number;
            if (ownerPhone && twilioClient && fromNumber) {
                const businessCtx: BusinessContext = {
                    name: customerLookup?.businesses?.name || 'Business',
                    niche: customerLookup?.businesses?.business_data?.niche || 'service',
                    ownerName: customerLookup?.businesses?.business_data?.owner_name,
                };

                // Send escalation message to customer
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${customerPhone}`,
                    body: generateEscalationMessage(businessCtx)
                });

                // Notify owner
                const cleanOwnerPhone = ownerPhone.replace(/[^\d+]/g, '');
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${cleanOwnerPhone}`,
                    body: `🚨 *Customer needs help!*\n\nFrom: ${customerPhone}\nMessage: "${messageText}"\n\nPlease respond to them directly.`
                });
            }
            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // Handle FAQ intent
        if (classification.intent === 'FAQ') {
            console.log('❓ FAQ intent detected');
            const businessCtx: BusinessContext = {
                name: customerLookup?.businesses?.name || 'Business',
                niche: customerLookup?.businesses?.business_data?.niche || 'service',
                serviceAreas: customerLookup?.businesses?.business_data?.service_areas,
                operatingHours: customerLookup?.businesses?.business_data?.operating_hours,
                paymentMethods: customerLookup?.businesses?.business_data?.payment_methods,
                warranty: customerLookup?.businesses?.business_data?.warranty,
                services: customerLookup?.businesses?.business_data?.services,
                ownerName: customerLookup?.businesses?.business_data?.owner_name,
                notes: customerLookup?.businesses?.business_data?.notes,  // Rich FB context
            };

            const faqResponse = await handleFAQ(messageText, businessCtx);

            if (twilioClient && fromNumber) {
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${customerPhone}`,
                    body: faqResponse.answer
                });
                console.log(`✅ FAQ response sent: ${faqResponse.topic}`);
            }

            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // Handle greeting - send a friendly welcome
        if (classification.intent === 'GREETING') {
            console.log('👋 Greeting detected');
            if (twilioClient && fromNumber) {
                const businessName = customerLookup?.businesses?.name || 'us';
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${customerPhone}`,
                    body: `Hello! 👋 Welcome to ${businessName}!\n\nHow can we help you today? You can ask about our services, pricing, or book an appointment.`
                });
            }
            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // Handle CONFIRMATION ("Yes", "Ok", "Sige") - Resume booking flow
        if (classification.intent === 'CONFIRMATION') {
            console.log('✅ Confirmation detected - resuming booking flow');
            const status = customerLookup?.status || 'unknown';

            if (twilioClient && fromNumber) {
                // Resume based on where customer left off
                if (status === 'awaiting_address') {
                    // They already selected a slot, need address
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${customerPhone}`,
                        body: `Great Boss! 🎉 Just send me your address or location pin 📍 and we'll confirm your booking!`
                    });
                } else if (status === 'awaiting_slot' || customerLookup?.notes?.includes('AVAILABLE_SLOTS')) {
                    // They have a quote, need to pick a slot
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${customerPhone}`,
                        body: `Awesome Boss! 👍 Which time slot works best for you?\n\nJust reply with 1, 2, or 3 to select.`
                    });
                } else if (status === 'quote_sent' && customerLookup?.businesses) {
                    // Re-send slot options with proper data
                    const businessData = customerLookup.businesses.business_data || {};
                    await sendSlotSuggester(customerPhone, {
                        businessName: customerLookup.businesses.name || 'Business',
                        customerName: customerLookup.name || 'Customer',
                        currency: businessData.currency || 'PHP',
                        estimateMin: customerLookup.estimate_min || 0,
                        estimateMax: customerLookup.estimate_max || 0,
                    });
                } else if (status === 'awaiting_discount_confirmation' && customerLookup?.businesses) {
                    // Applied 5% discount
                    const businessData = customerLookup.businesses.business_data || {};

                    // Robust estimate retrieval
                    let baseMin = customerLookup.estimate_min || 0;
                    let baseMax = customerLookup.estimate_max || 0;

                    if (baseMin === 0 && baseMax === 0 && customerLookup.notes) {
                        const estimateMatch = customerLookup.notes.match(/Estimate: [^\d]*(\d+)[^\d]*(\d+)/);
                        if (estimateMatch) {
                            baseMin = parseInt(estimateMatch[1]);
                            baseMax = parseInt(estimateMatch[2]);
                        }
                    }

                    let minWithDiscount = Math.floor(baseMin * 0.95);
                    let maxWithDiscount = Math.floor(baseMax * 0.95);

                    // Respond with discounted price and slots
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${customerPhone}`,
                        body: `Discount Applied! 🎁\n\nYour new estimate is: ${businessData.currency || 'RM'} ${minWithDiscount} - ${maxWithDiscount}.\n\nHere are the available slots:`
                    });

                    // Update DB with new estimates
                    await supabase.from('customers').update({
                        estimate_min: minWithDiscount,
                        estimate_max: maxWithDiscount,
                        status: 'quote_sent' // Move to quote_sent state
                    }).eq('id', customerLookup.id);

                    // Show slots
                    await sendSlotSuggester(customerPhone, {
                        businessName: customerLookup.businesses.name || 'Business',
                        customerName: customerLookup.name || 'Customer',
                        currency: businessData.currency || 'PHP',
                        estimateMin: minWithDiscount,
                        estimateMax: maxWithDiscount,
                    });

                } else {
                    // No clear context - ask what they need
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${customerPhone}`,
                        body: `Great! 🙌 What service would you like to book today?`
                    });
                }
            }

            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // Handle Price Objection ("The Closer")
        if (classification.intent === 'PRICE_OBJECTION') {
            console.log('💰 Price objection detected - checking for discount eligibility');

            // Logic: If NEW customer (0 or 1 bookings), offer 5% discount
            // Otherwise, escalate to owner
            const bookingCount = customerLookup?.bookings?.length || 0;
            const isNewCustomer = bookingCount <= 1;

            if (isNewCustomer && twilioClient && fromNumber) {
                console.log('✨ Offering 5% new customer discount');
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${customerPhone}`,
                    body: `I understand Boss! For our first-time customers, I can ask my manager for a special **5% Welcome Discount**. 🎁\n\nWould that help? Shall we proceed with the booking?`
                });

                // Track discount offer in customer notes AND set status
                if (customerLookup?.id) {
                    const existingNotes = customerLookup.notes || '';
                    await supabase.from('customers').update({
                        notes: existingNotes + '\n[DISCOUNT_OFFERED: 5% Welcome - ' + new Date().toISOString() + ']',
                        status: 'awaiting_discount_confirmation'
                    }).eq('id', customerLookup.id);
                }
            } else if (twilioClient && fromNumber) {
                console.log('⚠️ Existing customer price objection - escalating');
                // Escalate to owner for custom pricing
                // ... reuse escalation logic ...
                const businessCtx: BusinessContext = {
                    name: customerLookup?.businesses?.name || 'Business',
                    niche: customerLookup?.businesses?.business_data?.niche || 'service',
                    ownerName: customerLookup?.businesses?.business_data?.owner_name,
                };

                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${customerPhone}`,
                    body: `Best price na po yan Boss for quality service! ⭐\n\nBut let me check with ${businessCtx.ownerName || 'the owner'} if we have any other promos running. One moment please. 🙏`
                });

                // Notify owner
                const ownerPhone = customerLookup?.businesses?.whatsapp_number;
                if (ownerPhone) {
                    const cleanOwnerPhone = ownerPhone.replace(/[^\d+]/g, '');
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${cleanOwnerPhone}`,
                        body: `💰 *Price Negotiation*\n\nCustomer finds it expensive.\nFrom: ${customerPhone}\n\n*Action:* I told them I'll check with you. Please reply to them!`
                    });
                }
            }

            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        if (classification.intent === 'RESCHEDULE') {
            console.log('🗓️ Reschedule request detected');
            if (twilioClient && fromNumber && customerLookup?.businesses) {
                // Send slot suggestions with proper data
                // Send slot suggestions with proper data
                const businessData = customerLookup.businesses.business_data || {};

                // Robust estimate retrieval: Try DB columns first, then parse notes
                let min = customerLookup.estimate_min || 0;
                let max = customerLookup.estimate_max || 0;

                if (min === 0 && max === 0 && customerLookup.notes) {
                    const estimateMatch = customerLookup.notes.match(/Estimate: [^\d]*(\d+)[^\d]*(\d+)/);
                    if (estimateMatch) {
                        min = parseInt(estimateMatch[1]);
                        max = parseInt(estimateMatch[2]);
                    }
                }

                await sendSlotSuggester(customerPhone, {
                    businessName: customerLookup.businesses.name || 'Business',
                    customerName: customerLookup.name || 'Customer',
                    currency: businessData.currency || 'PHP',
                    estimateMin: min,
                    estimateMax: max,
                });
            } else if (twilioClient && fromNumber) {
                // Fallback if no business found
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${customerPhone}`,
                    body: `No problem Boss! Let me check available slots for you. 🗓️ One moment please.`
                });
            }
            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // Handle CANCELLATION ("Cancel na lang", "Nevermind", "Hindi na push through")
        if (classification.intent === 'CANCELLATION') {
            console.log('❌ Cancellation detected');
            if (twilioClient && fromNumber) {
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${customerPhone}`,
                    body: `No worries Boss! Your booking has been cancelled. 🙏\n\nIf you need our services in the future, just message us anytime. We're always here to help! 💪`
                });

                // Update customer status to cancelled
                if (customerLookup?.id) {
                    await supabase.from('customers').update({
                        status: 'cancelled',
                        notes: (customerLookup.notes || '') + '\n[CANCELLED by customer - ' + new Date().toISOString() + ']'
                    }).eq('id', customerLookup.id);
                }
            }
            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // Map AI intent to existing handlers
        const isSlotSelection = classification.intent === 'SLOT_SELECTION' ||
            (classification.entities.slot_number && classification.entities.slot_number >= 1 && classification.entities.slot_number <= 3);
        const isQuoteRequest = classification.intent === 'QUOTE_REQUEST';
        const isAddressMessage = classification.intent === 'ADDRESS' || isLocationPin;

        if (isSlotSelection) {
            // ========== SLOT SELECTION HANDLER ==========
            console.log(`🗓️ Detected slot selection: ${messageText}`);

            // Use AI-extracted slot number or fall back to parsing
            const slotNumber = classification.entities.slot_number || parseInt(messageText) || 1;

            // Phone already normalized above for AI intent context
            console.log(`📱 Looking up customer with phone: ${phoneWithPlus} or ${phoneWithoutPlus}`);

            // Find the customer - try both phone formats
            let customer = null;
            let error = null;

            // Try with plus first
            const result1 = await supabase
                .from('customers')
                .select('*, businesses(id, name, business_data, whatsapp_number, phone_number)')
                .eq('phone', phoneWithPlus)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (result1.data) {
                customer = result1.data;
                console.log(`✅ Found customer with +: ${customer.name}`);
            } else {
                // Try without plus
                const result2 = await supabase
                    .from('customers')
                    .select('*, businesses(id, name, business_data, whatsapp_number, phone_number)')
                    .eq('phone', phoneWithoutPlus)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (result2.data) {
                    customer = result2.data;
                    console.log(`✅ Found customer without +: ${customer.name}`);
                } else {
                    error = result2.error;
                    console.log(`❌ No customer found for either format`);
                }
            }

            if (customer && !error) {
                const businessName = customer.businesses?.name || 'Local Service';
                const customerName = customer.name || 'Customer';
                const businessId = customer.business_id;

                // Extract stored available slots from notes
                // Extract stored available slots from notes (Get LAST one)
                const slotsParts = customer.notes?.split('AVAILABLE_SLOTS: ');
                const slotsJson = (slotsParts && slotsParts.length > 1) ? slotsParts.pop()?.split('\n')[0] : null;
                const slotsMatch = slotsJson ? [null, slotsJson] : null; // Mock match structure for legacy code compatibility
                let availableSlots: { label: string; value: string }[] = [];
                let selectedSlot = getSlotLabel(slotNumber); // Fallback
                let selectedSlotValue = '';

                if (slotsMatch) {
                    try {
                        availableSlots = JSON.parse(slotsMatch[1]);
                        if (availableSlots[slotNumber - 1]) {
                            selectedSlot = availableSlots[slotNumber - 1].label;
                            selectedSlotValue = availableSlots[slotNumber - 1].value;
                        }
                    } catch (e) {
                        console.log('⚠️ Could not parse stored slots');
                    }
                }

                console.log(`✅ Found customer: ${customerName} for business: ${businessName}`);
                console.log(`📅 Selected slot: ${selectedSlot} (${selectedSlotValue})`);

                // Create a pending booking in the database to block this slot
                // DEPRECATED: We now create the booking only after address is received to prevent spam
                /* 
                if (selectedSlotValue) {
                     ... removed to prevent multiple pending bookings ...
                }
                */

                // Ask for address (don't confirm yet)
                const askAddressMessage = `Great choice! ✅\n\n` +
                    `I've reserved the *${selectedSlot}* slot for you.\n\n` +
                    `To finalize your booking, please reply with your *Complete Address*:\n` +
                    `📍 Unit #, Building, Street, City\n\n` +
                    `Or share your *Location Pin* below 👇`;

                console.log(`📤 Preparing to send address request to ${from} via ${fromNumber}`);
                if (twilioClient && fromNumber) {
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: from,
                        body: askAddressMessage
                    });
                    console.log('✅ Sent address request to customer');
                }

                // Update customer status to waiting_for_address and store selected slot
                await supabase
                    .from('customers')
                    .update({
                        status: 'waiting_for_address',
                        notes: `${customer.notes || ''}\n\n📅 SELECTED SLOT: ${selectedSlot}\n📅 SLOT_VALUE: ${selectedSlotValue}`
                    })
                    .eq('id', customer.id);


            } else {
                console.log(`⚠️ No customer found for slot selection from: ${customerPhone}`);
            }
        } else if (isAddressMessage) {
            // ========== ADDRESS RECEIVED HANDLER ==========
            console.log(`📍 Detected address message: ${messageText}`);
            // Normalize phone for lookup
            const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
            const phoneWithoutPlus = customerPhone.replace(/^\+/, '');

            // Find customer waiting for address - try both phone formats
            let customer = null;
            let error = null;

            const result1 = await supabase
                .from('customers')
                .select('*, businesses(id, name, business_data, whatsapp_number, phone_number)')
                .eq('phone', phoneWithPlus)
                .eq('status', 'waiting_for_address')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (result1.data) {
                customer = result1.data;
            } else {
                const result2 = await supabase
                    .from('customers')
                    .select('*, businesses(id, name, business_data, whatsapp_number, phone_number)')
                    .eq('phone', phoneWithoutPlus)
                    .eq('status', 'waiting_for_address')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (result2.data) {
                    customer = result2.data;
                } else {
                    error = result2.error;
                }
            }

            if (customer && !error) {
                const businessName = customer.businesses?.name || 'Local Service';
                const customerName = customer.name || 'Customer';

                // Extract selected slot from notes (Get the LAST one if multiple)
                // Use split/pop to find the latest valid selection
                const slotParts = customer.notes?.split('📅 SELECTED SLOT: ');
                const selectedSlot = (slotParts && slotParts.length > 1) ? slotParts.pop()?.split('\n')[0] : 'As scheduled';

                // Extract estimate from notes  
                const estimateMatch = customer.notes?.match(/Estimate: ([^\n]+)/);
                const estimate = estimateMatch ? estimateMatch[1] : 'As quoted';

                // Use location-derived address if it's a location pin, otherwise use message text
                const customerAddress = locationDerivedAddress || messageText;

                console.log(`✅ Found customer waiting for address: ${customerName}`);
                console.log(`📍 Address: ${customerAddress}${isLocationPin ? ' (from location pin)' : ''}`);
                console.log(`📅 Slot: ${selectedSlot}`);

                // 1. Send final confirmation to customer
                const finalConfirmation = `🎉 *Booking Confirmed!*\n\n` +
                    `Hi ${customerName}! Your service with *${businessName}* is confirmed:\n\n` +
                    `📅 *Time:* ${selectedSlot}\n` +
                    `📍 *Address:* ${customerAddress}\n` +
                    `💰 *Estimate:* ${estimate}\n\n` +
                    `A technician will contact you before arriving.\n` +
                    `Reply *HELP* if you need to reschedule.\n\n` +
                    `Thank you for choosing us! 🙏`;

                if (twilioClient && fromNumber) {
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: from,
                        body: finalConfirmation
                    });
                    console.log('✅ Sent final confirmation to customer');
                }

                // 2. Update customer status to booked with address
                await supabase
                    .from('customers')
                    .update({
                        status: 'booked',
                        notes: `${customer.notes || ''}\n\n📍 ADDRESS: ${customerAddress}\n✅ BOOKING CONFIRMED`
                    })
                    .eq('id', customer.id);

                // Create the final booking record
                const slotValueParts = customer.notes?.split('📅 SLOT_VALUE: ');
                const slotValue = (slotValueParts && slotValueParts.length > 1) ? slotValueParts.pop()?.split('\n')[0] : null;

                if (slotValue) {
                    const [slotDate, slotTimeId] = slotValue.split('_');

                    await supabase
                        .from('bookings')
                        .insert({
                            business_id: customer.business_id,
                            customer_id: customer.id,
                            slot_date: slotDate,
                            slot_time: slotTimeId,
                            slot_label: selectedSlot,
                            status: 'confirmed',
                            booking_type: 'customer',
                            customer_name: customerName,
                            customer_address: customerAddress,
                            customer_phone: customerPhone,
                            notes: 'Booking confirmed by customer via WhatsApp'
                        });

                    console.log('✅ Created confirmed booking record');
                }

                // 3. Notify the business owner with full details using template with Navigate button
                const ownerPhone = customer.businesses?.whatsapp_number ||
                    customer.businesses?.phone_number ||
                    customer.businesses?.business_data?.phone;

                if (ownerPhone) {
                    await sendJobConfirmed(ownerPhone, {
                        id: customer.id.substring(0, 8).toUpperCase(),
                        serviceName: customer.businesses?.business_data?.niche || 'Service',
                        serviceEmoji: customer.businesses?.business_data?.emoji,
                        timeSlot: selectedSlot,
                        address: customerAddress,
                        customerName: customerName,
                        customerPhone: customerPhone,
                        estimate: estimate
                    });
                    console.log(`✅ Sent job confirmed notification to owner via sendJobConfirmed`);
                } else {
                    console.log('⚠️ No owner phone found for job notification');
                }

            } else {
                console.log(`⚠️ No customer waiting for address from: ${customerPhone}`);
            }

        } else if (isQuoteRequest) {
            // ========== QUOTE REQUEST HANDLER ==========
            console.log('🎯 Detected quote request message');

            // Normalize phone for lookup
            const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
            const phoneWithoutPlus = customerPhone.replace(/^\+/, '');
            console.log(`📱 Looking up customer for quote: ${phoneWithPlus} or ${phoneWithoutPlus}`);

            // Find the most recent pending customer with this phone - try both formats
            let customer = null;
            let error = null;

            const result1 = await supabase
                .from('customers')
                .select('*, businesses(name, business_data)')
                .eq('phone', phoneWithPlus)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (result1.data) {
                customer = result1.data;
            } else {
                const result2 = await supabase
                    .from('customers')
                    .select('*, businesses(name, business_data)')
                    .eq('phone', phoneWithoutPlus)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (result2.data) {
                    customer = result2.data;
                } else {
                    error = result2.error;
                }
            }

            if (customer && !error) {
                console.log(`✅ Found customer: ${customer.name} for business: ${customer.businesses?.name}`);

                // Parse quote details from notes
                const notes = customer.notes || '';
                const estimateMatch = notes.match(/Estimate: ([^\n]+)/);

                // Now we can send the confirmation - customer is in 24h window!
                console.log('📤 Sending Quote Confirmation (customer now in 24h window)...');

                // Parse estimate values
                let estimateMin = 0;
                let estimateMax = 0;
                let currency = 'RM';
                if (estimateMatch) {
                    const parts = estimateMatch[1].split(' ');
                    // currency is usually the first part, strip numbers
                    const rawCurrency = parts[0] || 'RM';
                    currency = rawCurrency.replace(/[0-9]/g, '') || 'RM';

                    const range = parts.slice(1).join(' ').split('-').map((s: string) => parseInt(s.replace(/\D/g, '')));
                    estimateMin = range[0] || 0;
                    estimateMax = range[1] || estimateMin;
                }

                console.log(`💱 Parsed Estimate: ${currency} ${estimateMin}-${estimateMax}`);

                const confirmResult = await sendQuoteConfirmation(customerPhone, {
                    businessName: customer.businesses?.name || 'Local Service',
                    estimateMin,
                    estimateMax,
                    currency
                });

                console.log(`📤 Quote Confirmation result: ${confirmResult}`);

                // Fetch real-time available slots from API
                const businessId = customer.business_id;
                let availableSlots: { label: string; value: string }[] = [];

                try {
                    const slotsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '')}/api/slots/available?businessId=${businessId}`;
                    // Use internal API call (same server)
                    const { data: bookings } = await supabase
                        .from('bookings')
                        .select('slot_date, slot_time, status')
                        .eq('business_id', businessId)
                        .in('status', ['pending', 'confirmed', 'blocked']);

                    // Generate slots and subtract booked ones
                    const now = new Date();

                    // Fetch business slot settings first (needed for timezone)
                    const { data: businessData } = await supabase
                        .from('businesses')
                        .select('slot_settings')
                        .eq('id', businessId)
                        .single();

                    // Use UTC+8 timezone offset for SEA businesses (or from business settings)
                    const timezoneOffset = businessData?.slot_settings?.timezone_offset ?? 8;
                    const utcHour = now.getUTCHours();
                    const hour = (utcHour + timezoneOffset + 24) % 24;
                    console.log(`🕐 Slot generation - UTC hour: ${utcHour}, Local hour (UTC+${timezoneOffset}): ${hour}`);

                    const formatDateLabel = (d: Date, isToday: boolean) =>
                        isToday ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                    const formatDate = (d: Date) => d.toISOString().split('T')[0];

                    // Slot defaults
                    const DEFAULT_SLOTS = [
                        { id: 'morning', label: '9am - 11am', start: '09:00', startHour: 9, enabled: true },
                        { id: 'early_afternoon', label: '1pm - 3pm', start: '13:00', startHour: 13, enabled: true },
                        { id: 'late_afternoon', label: '3pm - 5pm', start: '15:00', startHour: 15, enabled: true },
                    ];

                    // Use business settings or defaults, filter to enabled slots only
                    const slotConfig = (businessData?.slot_settings?.slots || DEFAULT_SLOTS)
                        .filter((s: { enabled?: boolean }) => s.enabled !== false)
                        .map((s: { id: string; label: string; start?: string; startHour?: number }) => ({
                            ...s,
                            startHour: s.startHour || parseInt(s.start?.split(':')[0] || '9')
                        }));

                    const bookedSlotIds = new Set((bookings || []).map(b => `${b.slot_date}_${b.slot_time}`));
                    const blockedDates = new Set((bookings || []).filter(b => b.slot_time === 'all_day').map(b => b.slot_date));

                    for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
                        // Use LOCAL time for date calculation to ensure "Today" means Business Today
                        const localNow = new Date(now.getTime() + (timezoneOffset * 60 * 60 * 1000));
                        const date = new Date(localNow);
                        date.setDate(date.getDate() + dayOffset);
                        const dateStr = formatDate(date);
                        const isToday = dayOffset === 0;

                        if (blockedDates.has(dateStr)) continue;

                        for (const slot of slotConfig) {
                            if (isToday && hour >= slot.startHour - 2) continue;
                            const slotId = `${dateStr}_${slot.id}`;
                            // if (bookedSlotIds.has(slotId)) continue; // USER REQUEST: Allow multiple bookings per slot

                            availableSlots.push({
                                label: `${formatDateLabel(date, isToday)} ${slot.label}`,
                                value: slotId
                            });
                        }
                    }
                    availableSlots = availableSlots.slice(0, 3);
                    console.log(`📅 Found ${availableSlots.length} available slots`);
                } catch (e) {
                    console.log('⚠️ Could not fetch dynamic slots, using defaults');
                }

                // Send slot suggester with dynamic slots
                const slotResult = await sendSlotSuggester(customerPhone, {
                    businessName: customer.businesses?.name || 'Local Service',
                    customerName: customer.name || 'there',
                    currency,
                    estimateMin,
                    estimateMax,
                    slots: availableSlots.length > 0 ? availableSlots : undefined
                });

                console.log(`📤 Slot Suggester result: ${JSON.stringify(slotResult)}`);

                // Store available slots in notes for slot selection handler
                const slotsJson = JSON.stringify(availableSlots);

                // Update customer status, store slots, and SAVE ESTIMATES for future reference
                await supabase
                    .from('customers')
                    .update({
                        status: 'quote_sent', // Set to quote_sent so CONFIRMATION handlers work
                        notes: `${customer.notes || ''}\n\nAVAILABLE_SLOTS: ${slotsJson}`,
                        estimate_min: estimateMin,
                        estimate_max: estimateMax
                    })
                    .eq('id', customer.id);

            } else {
                console.log(`⚠️ No matching customer found for phone: ${customerPhone}`);
            }
        } else {
            // ========== GENERIC MESSAGE HANDLER ==========
            console.log('💬 Generic message received (not a quote or slot selection)');
            // TODO: Add AI response or forward to owner
        }

        // Return empty TwiML response (no immediate reply from webhook)
        return new NextResponse(
            `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
            {
                status: 200,
                headers: { 'Content-Type': 'text/xml' }
            }
        );

    } catch (error) {
        console.error('❌ Webhook error:', error);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}

// GET for Twilio validation
export async function GET() {
    return NextResponse.json({ status: 'Twilio webhook active' });
}

