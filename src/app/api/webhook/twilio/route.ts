// /api/webhook/twilio/route.ts
// Twilio WhatsApp Webhook - Receives incoming messages from customers
// This is called when a customer sends a message to the Launchfly assistant number

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendQuoteConfirmation, sendSlotSuggester, sendJobCard } from '@/lib/whatsapp-push';
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

// Generate slot labels based on current time (same logic as sendSlotSuggester)
// Uses UTC+8 timezone offset for SEA businesses
function getSlotLabel(slotNumber: number): string {
    const now = new Date();
    // Convert UTC to UTC+8 (SEA timezone)
    const utcHour = now.getUTCHours();
    const hour = (utcHour + 8 + 24) % 24;

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);

    const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

    const slots: string[] = [];

    // Today slots (if before 3pm local time)
    if (hour < 15) {
        slots.push(`Today ${hour < 12 ? '2pm - 4pm' : '4pm - 6pm'}`);
    }
    // Tomorrow slots
    slots.push(`${formatDate(tomorrow)} 9am - 11am`);
    slots.push(`${formatDate(tomorrow)} 2pm - 4pm`);
    // Day after
    if (slots.length < 3) {
        slots.push(`${formatDate(dayAfter)} 9am - 11am`);
    }

    return slots[slotNumber - 1] || slots[0];
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

        // Check if this is a slot selection (1, 2, or 3)
        const isSlotSelection = /^[123]$/.test(messageText);

        // Check if this looks like a quote request (matches our prefilled message pattern)
        const isQuoteRequest = messageText.toLowerCase().includes('quote') ||
            messageText.toLowerCase().includes('requested') ||
            messageText.toLowerCase().includes('estimated');

        // Check if this looks like an address (longer message, not a quote or slot)
        // Address messages are typically 10+ characters and don't match other patterns
        // OR it's a location pin share
        const isAddressMessage = isLocationPin || (messageText.length >= 10 &&
            !isSlotSelection &&
            !isQuoteRequest &&
            !messageText.toLowerCase().startsWith('hi') &&
            !messageText.toLowerCase().startsWith('hello'));

        if (isSlotSelection) {
            // ========== SLOT SELECTION HANDLER ==========
            console.log(`🗓️ Detected slot selection: ${messageText}`);

            const slotNumber = parseInt(messageText);

            // Normalize phone for lookup (try multiple formats)
            const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
            const phoneWithoutPlus = customerPhone.replace(/^\+/, '');
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
                const slotsMatch = customer.notes?.match(/AVAILABLE_SLOTS: (\[.*?\])/);
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
                if (selectedSlotValue) {
                    const [slotDate, slotTime] = selectedSlotValue.split('_');
                    const slotTimeId = selectedSlotValue.replace(`${slotDate}_`, '');

                    await supabase
                        .from('bookings')
                        .insert({
                            business_id: businessId,
                            customer_id: customer.id,
                            slot_date: slotDate,
                            slot_time: slotTimeId,
                            slot_label: selectedSlot,
                            status: 'pending',
                            booking_type: 'customer',
                            customer_name: customerName,
                            customer_phone: customerPhone,
                            notes: 'Awaiting address confirmation'
                        });
                    console.log(`📅 Created pending booking for slot: ${selectedSlot}`);
                }

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

                // Extract selected slot from notes
                const slotMatch = customer.notes?.match(/📅 SELECTED SLOT: ([^\n]+)/);
                const selectedSlot = slotMatch ? slotMatch[1] : 'As scheduled';

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

                // Also update the booking record with address
                const slotValueMatch = customer.notes?.match(/📅 SLOT_VALUE: ([^\n]+)/);
                if (slotValueMatch) {
                    const slotValue = slotValueMatch[1];
                    const [slotDate, slotTimeId] = slotValue.split('_');

                    await supabase
                        .from('bookings')
                        .update({
                            status: 'confirmed',
                            customer_address: customerAddress,
                            notes: 'Booking confirmed by customer'
                        })
                        .eq('customer_id', customer.id)
                        .eq('status', 'pending');

                    console.log('✅ Updated booking record with address');
                }

                // 3. Notify the business owner with full details
                const ownerPhone = customer.businesses?.whatsapp_number ||
                    customer.businesses?.phone_number ||
                    customer.businesses?.business_data?.phone;

                if (ownerPhone) {
                    const ownerNotification = `🚨 *NEW JOB CONFIRMED!*\n\n` +
                        `👤 *Customer:* ${customerName}\n` +
                        `📞 *Phone:* ${customerPhone}\n` +
                        `📅 *Time:* ${selectedSlot}\n` +
                        `📍 *Address:* ${customerAddress}\n` +
                        `💰 *Estimate:* ${estimate}\n\n` +
                        `Customer is waiting - contact them now! 💪`;

                    const cleanOwnerPhone = ownerPhone.replace(/[^\d+]/g, '');
                    await twilioClient.messages.create({
                        from: fromNumber?.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${cleanOwnerPhone}`,
                        body: ownerNotification
                    });
                    console.log(`✅ Sent job notification to owner: ${cleanOwnerPhone}`);
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
                        const date = new Date(now);
                        date.setDate(date.getDate() + dayOffset);
                        const dateStr = formatDate(date);
                        const isToday = dayOffset === 0;

                        if (blockedDates.has(dateStr)) continue;

                        for (const slot of slotConfig) {
                            if (isToday && hour >= slot.startHour - 2) continue;
                            const slotId = `${dateStr}_${slot.id}`;
                            if (bookedSlotIds.has(slotId)) continue;

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

                // Update customer status and store slots
                await supabase
                    .from('customers')
                    .update({
                        status: 'contacted',
                        notes: `${customer.notes || ''}\n\nAVAILABLE_SLOTS: ${slotsJson}`
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

