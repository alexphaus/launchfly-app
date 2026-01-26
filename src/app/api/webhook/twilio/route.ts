// /api/webhook/twilio/route.ts
// Twilio WhatsApp Webhook - Receives incoming messages from customers
// This is called when a customer sends a message to the Launchfly assistant number
// Now with AI-powered intent classification (Smart Receptionist)
// Supports multi-business routing via [BIZ:id] in sticker scan messages
// Updated with "Forever Customer Engine" - returning customer recognition

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendQuoteConfirmation, sendSlotSuggester, sendJobCard, sendJobConfirmed, sendTypingIndicator } from '@/lib/whatsapp-push';
import { classifyIntent, shouldEscalate, isPriceObjection, type ConversationContext } from '@/lib/ai-intent';
import { handleFAQ, generateEscalationMessage, type BusinessContext } from '@/lib/faq-handler';
import { 
    getFlowConfig, 
    generateStickerGreeting, 
    generateCleaningPrompt, 
    generateRepairPrompt, 
    generatePriceList, 
    generateUnitsConfirmation,
    extractBusinessIdFromTrigger,
    generateBookingConfirmation,
    generateSlotOptions
} from '@/lib/sticker-flow-templates';
import {
    isTechRegistrationTrigger,
    generateTechRegistrationPrompt,
    generateTechRegistrationConfirmation,
    generateServiceDetailsPrompt,
    generateReturningCustomerGreeting,
    generateServiceHistoryMessage,
    isServiceDueSoon,
    generateServiceDueNudge,
    formatDateSEA,
    calculateNextServiceDue,
    type CustomerServiceHistory,
    // Feedback flow
    generateFeedbackRequest,
    detectFeedbackRating,
    generateFeedbackResponse,
    generateServiceRecoveryAlert,
    generateComplaintAcknowledgment,
    isFeedbackFlowStatus,
    // Customer self-activation
    generateWarrantyOffer,
    generateCustomerServiceTypePrompt,
    generateNameCapturePrompt,
    isWarrantyActivationChoice,
    getDefaultWarrantyDays,
    getDefaultServiceInterval,
} from '@/lib/warranty-flow';
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
        const messageSid = formData.get('MessageSid') as string; // For typing indicator

        // Location pin data from Twilio
        const latitude = formData.get('Latitude') as string | null;
        const longitude = formData.get('Longitude') as string | null;
        const locationAddress = formData.get('Address') as string | null; // Address label if provided
        const locationLabel = formData.get('Label') as string | null; // Location name/label

        // 🔥 IMMEDIATELY show "Typing..." to mask AI processing delay
        if (messageSid) {
            sendTypingIndicator(messageSid).catch(() => { }); // Fire and forget, don't block
        }

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

        // ========== BUSINESS CONTEXT EXTRACTION ==========
        // Extract business ID from message if present [BIZ:uuid]
        const extractedBusinessId = extractBusinessIdFromTrigger(messageText);
        let targetBusiness: any = null;
        
        if (extractedBusinessId) {
            console.log(`🏢 Extracted business ID from message: ${extractedBusinessId}`);
            const { data: bizData } = await supabase
                .from('businesses')
                .select('id, name, business_data, whatsapp_number, phone_number')
                .eq('id', extractedBusinessId)
                .single();
            
            if (bizData) {
                targetBusiness = bizData;
                console.log(`✅ Found target business: ${bizData.name}`);
            }
        }

        // ========== AI INTENT CLASSIFICATION ==========
        // First, lookup customer to get conversation context
        const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
        const phoneWithoutPlus = customerPhone.replace(/^\+/, '');

        const { data: customerLookup } = await supabase
            .from('customers')
            .select('*, businesses(id, name, business_data, whatsapp_number, phone_number), bookings(id)')
            .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // Use extracted business or customer's existing business
        const businessContext = targetBusiness || customerLookup?.businesses;

        // Build conversation context for AI
        const conversationContext: ConversationContext = {
            customerStatus: customerLookup?.status,
            hasQuote: customerLookup?.notes?.includes('AVAILABLE_SLOTS'),
            businessName: businessContext?.name,
            businessNiche: businessContext?.business_data?.niche,
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

        // ========== FEEDBACK FLOW HANDLER ==========
        // Handle customer feedback responses (1-3 rating - Golden Flow)
        // 1 = Excellent, 2 = Good (both positive), 3 = Not Good (negative)
        if (customerLookup?.status === 'feedback_pending') {
            console.log('📝 Feedback Flow: Processing rating');
            
            const rating = detectFeedbackRating(messageText);
            
            if (rating !== null) {
                // Get business info for response
                const business = customerLookup?.businesses;
                const businessName = business?.name || business?.business_data?.businessName || 'Your Service Provider';
                const googleReviewLink = business?.business_data?.googleReviewLink || 
                                         business?.business_data?.google_review_link ||
                                         null;
                
                // Generate appropriate response
                const responseMsg = generateFeedbackResponse({
                    rating: rating,
                    businessName: businessName,
                    googleReviewLink: googleReviewLink,
                });

                if (twilioClient && fromNumber) {
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${customerPhone}`,
                        body: responseMsg
                    });
                }

                // Update customer status based on rating (1-2 positive, 3 negative)
                const newStatus = rating <= 2 ? 'feedback_positive' : 'feedback_negative';
                await supabase.from('customers').update({
                    status: newStatus,
                    notes: (customerLookup.notes || '') + `\n[FEEDBACK_RATING: ${rating}/3 at ${new Date().toISOString()}]`
                }).eq('id', customerLookup.id);

                // If negative feedback (3 = Not Good), alert the business owner/tech immediately
                if (rating === 3) {
                    const ownerPhone = business?.whatsapp_number || business?.phone_number;
                    if (ownerPhone && twilioClient && fromNumber) {
                        const alertMsg = generateServiceRecoveryAlert({
                            customerName: customerLookup.name || customerLookup.first_name || 'Customer',
                            customerPhone: customerPhone,
                            rating: rating,
                            serviceName: 'Recent Service', // Could be enhanced to pull from service_records
                        });

                        const cleanOwnerPhone = ownerPhone.replace(/[^\d+]/g, '');
                        await twilioClient.messages.create({
                            from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                            to: `whatsapp:${cleanOwnerPhone}`,
                            body: alertMsg
                        });
                        console.log(`🚨 Service recovery alert sent to owner: ${cleanOwnerPhone}`);
                    }
                }

                console.log(`✅ Feedback recorded: ${rating}/3 for customer ${customerLookup.id}`);
            } else {
                // Couldn't parse rating - prompt again with 3-option scale
                if (twilioClient && fromNumber) {
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${customerPhone}`,
                        body: `Please reply with 1, 2, or 3:\n\n1️⃣ ⭐ *Excellent* - Loved it!\n2️⃣ 👍 *Good* - Satisfied\n3️⃣ 👎 *Not Good* - Had issues`
                    });
                }
            }

            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // ========== COMPLAINT HANDLER ==========
        // Handle complaint text from negative feedback
        if (customerLookup?.status === 'feedback_negative') {
            console.log('📝 Complaint Flow: Receiving complaint details');
            
            // This is the customer typing what went wrong
            const complaint = messageText;
            const business = customerLookup?.businesses;
            const businessName = business?.name || business?.business_data?.businessName || 'Your Service Provider';
            
            // Send acknowledgment to customer
            if (twilioClient && fromNumber) {
                const ackMsg = generateComplaintAcknowledgment(businessName);
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${customerPhone}`,
                    body: ackMsg
                });
            }

            // Log complaint in customer notes
            await supabase.from('customers').update({
                status: 'complaint_logged',
                notes: (customerLookup.notes || '') + `\n[COMPLAINT: ${new Date().toISOString()}]\n"${complaint}"`
            }).eq('id', customerLookup.id);

            // Alert owner with the complaint
            const ownerPhone = business?.whatsapp_number || business?.phone_number;
            if (ownerPhone && twilioClient && fromNumber) {
                const alertMsg = generateServiceRecoveryAlert({
                    customerName: customerLookup.name || customerLookup.first_name || 'Customer',
                    customerPhone: customerPhone,
                    rating: 4, // Assume worst since they wrote complaint
                    serviceName: 'Recent Service',
                    complaint: complaint,
                });

                const cleanOwnerPhone = ownerPhone.replace(/[^\d+]/g, '');
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${cleanOwnerPhone}`,
                    body: alertMsg
                });
                console.log(`🚨 Complaint alert sent to owner: ${cleanOwnerPhone}`);
            }

            console.log(`✅ Complaint logged for customer ${customerLookup.id}`);

            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // ========== CUSTOMER WARRANTY OFFER HANDLER ==========
        // Handle customer's choice from warranty offer menu (1=activate, 2/3/4=booking)
        if (customerLookup?.status === 'warranty_offer') {
            console.log('📝 Warranty Offer: Processing customer choice');
            
            const choice = messageText.trim();
            const business = customerLookup?.businesses;
            const businessName = business?.name || business?.business_data?.businessName || 'Your Service Provider';
            const businessNiche = business?.business_data?.niche || 'default';
            const flowConfig = getFlowConfig(businessNiche);
            
            if (choice === '1' || isWarrantyActivationChoice(messageText)) {
                // Customer wants warranty activation - ask for service type
                if (twilioClient && fromNumber) {
                    const servicePrompt = generateCustomerServiceTypePrompt({
                        cleaningLabel: flowConfig.cleaningLabel,
                        repairLabel: flowConfig.repairLabel,
                    });
                    
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${customerPhone}`,
                        body: servicePrompt
                    });
                }

                await supabase.from('customers').update({
                    status: 'customer_warranty_service', // Waiting for service type
                    notes: (customerLookup.notes || '') + `\n[WARRANTY_SELF_ACTIVATE: ${new Date().toISOString()}]`
                }).eq('id', customerLookup.id);

            } else if (['2', '3', '4'].includes(choice)) {
                // Customer wants booking - redirect to normal sticker menu flow
                // Map: 2→1 (cleaning), 3→2 (repair), 4→3 (price)
                const menuChoice = (parseInt(choice) - 1).toString();
                
                // Update status to sticker_menu and re-process
                await supabase.from('customers').update({
                    status: 'sticker_menu',
                    notes: (customerLookup.notes || '') + `\n[SKIPPED_WARRANTY: chose option ${choice}]`
                }).eq('id', customerLookup.id);

                // Generate appropriate response based on choice
                let response: string;
                if (choice === '2') {
                    response = generateCleaningPrompt(flowConfig);
                    await supabase.from('customers').update({ status: 'cleaning_qty' }).eq('id', customerLookup.id);
                } else if (choice === '3') {
                    response = generateRepairPrompt(flowConfig);
                    await supabase.from('customers').update({ status: 'repair_describe' }).eq('id', customerLookup.id);
                } else {
                    response = generatePriceList(flowConfig, businessName);
                    await supabase.from('customers').update({ status: 'sticker_menu' }).eq('id', customerLookup.id);
                }

                if (twilioClient && fromNumber) {
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${customerPhone}`,
                        body: response
                    });
                }
            } else {
                // Invalid choice - prompt again
                if (twilioClient && fromNumber) {
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${customerPhone}`,
                        body: `Please reply with 1, 2, 3, or 4:\n\n1️⃣ ✅ Activate warranty\n2️⃣ Book Cleaning\n3️⃣ Not Cooling / Repair\n4️⃣ Check Price`
                    });
                }
            }

            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // ========== CUSTOMER WARRANTY SERVICE TYPE HANDLER ==========
        // Handle service type selection for customer self-activation
        // Golden Flow Step: Ask for service type, then ask for name
        if (customerLookup?.status === 'customer_warranty_service') {
            console.log('📝 Customer Warranty: Processing service type');
            
            const choice = messageText.trim();
            const business = customerLookup?.businesses;
            const businessName = business?.name || business?.business_data?.businessName || 'Your Service Provider';
            const businessNiche = business?.business_data?.niche || 'default';
            const flowConfig = getFlowConfig(businessNiche);

            let serviceType: string;
            let serviceName: string;

            if (choice === '1') {
                serviceType = 'cleaning';
                serviceName = flowConfig.cleaningLabel.replace(/[^\w\s\/]/g, '').trim();
            } else if (choice === '2') {
                serviceType = 'repair';
                serviceName = flowConfig.repairLabel.replace(/[^\w\s\/]/g, '').trim();
            } else if (choice === '3') {
                serviceType = 'maintenance';
                serviceName = 'Other Service';
            } else {
                // Invalid - prompt again
                if (twilioClient && fromNumber) {
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${customerPhone}`,
                        body: `Please reply with 1, 2, or 3:\n\n1️⃣ Cleaning\n2️⃣ Repair\n3️⃣ Other`
                    });
                }
                return new NextResponse(
                    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                    { headers: { 'Content-Type': 'text/xml' } }
                );
            }

            // Golden Flow: Ask for name before creating warranty
            const namePrompt = generateNameCapturePrompt({
                serviceName: serviceName,
                businessName: businessName,
            });

            if (twilioClient && fromNumber) {
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${customerPhone}`,
                    body: namePrompt
                });
            }

            // Store service type temporarily and wait for name
            await supabase.from('customers').update({
                status: 'customer_warranty_name', // New status - waiting for name
                notes: (customerLookup.notes || '') + `\n[WARRANTY_SERVICE_TYPE: ${serviceType}|${serviceName}]`
            }).eq('id', customerLookup.id);

            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // ========== CUSTOMER WARRANTY NAME CAPTURE HANDLER ==========
        // Golden Flow Step 2: Capture customer name before warranty activation
        if (customerLookup?.status === 'customer_warranty_name') {
            console.log('📝 Customer Warranty: Capturing customer name');
            
            const customerName = messageText.trim();
            const business = customerLookup?.businesses;
            const businessId = customerLookup?.business_id;
            const businessName = business?.name || business?.business_data?.businessName || 'Your Service Provider';
            const businessNiche = business?.business_data?.niche || 'default';
            const flowConfig = getFlowConfig(businessNiche);
            const googleReviewLink = business?.business_data?.googleReviewLink;

            // Validate name (at least 2 characters)
            if (customerName.length < 2) {
                if (twilioClient && fromNumber) {
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${customerPhone}`,
                        body: `Please enter your *full name* to complete the warranty registration:`
                    });
                }
                return new NextResponse(
                    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                    { headers: { 'Content-Type': 'text/xml' } }
                );
            }

            // Extract service type from notes
            const notesMatch = customerLookup.notes?.match(/\[WARRANTY_SERVICE_TYPE: ([^|]+)\|([^\]]+)\]/);
            const serviceType = notesMatch?.[1] || 'cleaning';
            const serviceName = notesMatch?.[2] || flowConfig.cleaningLabel.replace(/[^\w\s\/]/g, '').trim();

            // Create service record with customer name
            const warrantyDays = getDefaultWarrantyDays(serviceType);
            const intervalDays = getDefaultServiceInterval(serviceType);
            const serviceDate = new Date();
            const warrantyExpiresAt = new Date(serviceDate);
            warrantyExpiresAt.setDate(warrantyExpiresAt.getDate() + warrantyDays);
            const nextDueAt = new Date(serviceDate);
            nextDueAt.setDate(nextDueAt.getDate() + intervalDays);

            const { error: recordError } = await supabase
                .from('service_records')
                .insert({
                    business_id: businessId,
                    customer_id: customerLookup.id,
                    service_type: serviceType,
                    service_name: serviceName,
                    appliance_type: flowConfig.serviceName.split(' ')[0].toLowerCase(),
                    warranty_days: warrantyDays,
                    warranty_expires_at: warrantyExpiresAt,
                    service_interval_days: intervalDays,
                    next_service_due_at: nextDueAt,
                    registered_via: 'sticker_scan',
                    registered_by: 'customer'
                });

            if (!recordError) {
                // Update customer name in database
                const nameParts = customerName.split(' ');
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ') || '';

                await supabase.from('customers').update({
                    name: customerName,
                    first_name: firstName,
                    last_name: lastName,
                }).eq('id', customerLookup.id);

                // Golden Flow: Send warranty confirmation + feedback request (Reputation Gate)
                const feedbackMsg = generateFeedbackRequest({
                    customerName: customerName,
                    serviceName: serviceName,
                    businessName: businessName,
                    warrantyDays: warrantyDays,
                    warrantyExpires: formatDateSEA(warrantyExpiresAt),
                    nextServiceDue: formatDateSEA(nextDueAt),
                });

                if (twilioClient && fromNumber) {
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${customerPhone}`,
                        body: feedbackMsg
                    });
                }

                // Update customer status to await feedback
                await supabase.from('customers').update({
                    status: 'feedback_pending',
                    notes: (customerLookup.notes || '') + `\n[CUSTOMER_WARRANTY_ACTIVATED: ${serviceType} at ${new Date().toISOString()}]`
                }).eq('id', customerLookup.id);

                console.log(`✅ Customer ${customerName} self-activated warranty: ${serviceName}`);
            } else {
                console.error('❌ Failed to create service record from customer activation:', recordError);
                if (twilioClient && fromNumber) {
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${customerPhone}`,
                        body: `❌ Sorry, there was an error activating your warranty. Please try scanning the sticker again or contact ${businessName} directly.`
                    });
                }
            }

            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // ========== TECH REGISTRATION FLOW (Detailed Log) ==========
        // Handle the multi-step flow for owners registering a service
        
        // STEP 1: Owner sent customer phone -> Ask for Service Type
        if (customerLookup?.status === 'tech_registering') {
            console.log('📝 Tech Registration: Received phone number');
            
            // Extract phone number from message
            const inputPhone = messageText.replace(/[^\d+]/g, '');
            if (inputPhone.length < 8) {
                if (twilioClient && fromNumber) {
                    await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${customerPhone}`,
                        body: '⚠️ Please enter a valid phone number (e.g., +6012...).'
                    });
                }
                return new NextResponse(
                    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                    { headers: { 'Content-Type': 'text/xml' } }
                );
            }

            // Save phone in notes and move to next step
            // We store the target customer's phone in the OWNER's notes temporarily
            const flowConfig = getFlowConfig(customerLookup.businesses?.business_data?.niche);
            const prompt = generateServiceDetailsPrompt(flowConfig);

            await supabase.from('customers').update({
                status: 'tech_awaiting_service',
                notes: (customerLookup.notes || '') + `\n[TECH_TARGET_PHONE: ${inputPhone}]`
            }).eq('id', customerLookup.id);

            if (twilioClient && fromNumber) {
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${customerPhone}`,
                    body: prompt
                });
            }

            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // STEP 2: Owner selected Service Type -> Create Record
        if (customerLookup?.status === 'tech_awaiting_service') {
            console.log('📝 Tech Registration: Service selection received');
            
            const selection = parseInt(messageText.replace(/[^\d]/g, ''));
            const flowConfig = getFlowConfig(customerLookup.businesses?.business_data?.niche);
            
            let serviceType = 'cleaning'; // Default
            let serviceName = flowConfig.serviceName;

            if (selection === 2) {
                serviceType = 'repair';
                serviceName = flowConfig.repairLabel.replace(/[^\w\s]/g, '').trim();
            } else if (selection === 3 || isNaN(selection)) {
                serviceType = 'maintenance'; // "Other" maps to maintenance for now
            } else {
                serviceName = flowConfig.cleaningLabel.replace(/[^\w\s]/g, '').trim();
            }

            // Extract target customer phone from notes
            const notes = customerLookup.notes || '';
            const phoneMatch = notes.match(/\[TECH_TARGET_PHONE: ([^\]]+)\]/);
            const targetPhone = phoneMatch ? phoneMatch[1] : null;

            if (targetPhone) {
                // Find or create the customer being registered
                // Note: We need to use a server-side call (API) or direct DB insert
                // For now, we'll do a quick DB lookup/insert here
                
                let targetCustomerId: string | null = null;
                
                // Try finding customer
                const { data: existingTarget } = await supabase
                    .from('customers')
                    .select('id')
                    .or(`phone.eq.${targetPhone},phone.eq.+${targetPhone}`)
                    .limit(1)
                    .single();

                if (existingTarget) {
                    targetCustomerId = existingTarget.id;
                } else {
                    // Create new customer
                    const { data: newTarget } = await supabase
                        .from('customers')
                        .insert({
                            phone: targetPhone,
                            status: 'lead',
                            source: 'tech_register',
                            business_id: customerLookup.business_id
                        })
                        .select('id')
                        .single();
                    if (newTarget) targetCustomerId = newTarget.id;
                }

                if (targetCustomerId && customerLookup.business_id) {
                    // Create Service Record using our API logic (replicated here for speed/simplicity)
                    // We call the API endpoint internally or just insert directly
                    // Direct insert is safer here to avoid self-call auth issues
                    const serviceDate = new Date();
                    
                    // Import helper logic dynamically or assume defaults
                    const warrantyDays = serviceType === 'repair' ? 30 : 30; // Default
                    const intervalDays = serviceType === 'repair' ? 90 : 180; // 6 months for cleaning
                    
                    const warrantyExpiresAt = new Date(serviceDate);
                    warrantyExpiresAt.setDate(warrantyExpiresAt.getDate() + warrantyDays);
                    
                    const nextDueAt = new Date(serviceDate);
                    nextDueAt.setDate(nextDueAt.getDate() + intervalDays);

                    const { error: recordError } = await supabase
                        .from('service_records')
                        .insert({
                            business_id: customerLookup.business_id,
                            customer_id: targetCustomerId,
                            service_type: serviceType,
                            service_name: serviceName,
                            appliance_type: flowConfig.serviceName.split(' ')[0].toLowerCase(),
                            warranty_days: warrantyDays,
                            warranty_expires_at: warrantyExpiresAt,
                            service_interval_days: intervalDays,
                            next_service_due_at: nextDueAt,
                            registered_via: 'tech_register',
                            registered_by: 'technician'
                        });

                    if (!recordError) {
                        // Send confirmation to Owner/Tech
                        const confirmMsg = generateTechRegistrationConfirmation({
                            customerPhone: targetPhone,
                            serviceName: serviceName,
                            warrantyDays: warrantyDays,
                            warrantyExpiresAt: warrantyExpiresAt.toLocaleDateString(),
                            nextReminderDate: nextDueAt.toLocaleDateString(),
                        });

                        if (twilioClient && fromNumber) {
                            await twilioClient.messages.create({
                                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                                to: `whatsapp:${customerPhone}`,
                                body: confirmMsg
                            });

                            // ========== SEND FEEDBACK REQUEST TO CUSTOMER ==========
                            // Get target customer details for personalization
                            const { data: targetCustomer } = await supabase
                                .from('customers')
                                .select('name, first_name')
                                .eq('id', targetCustomerId)
                                .single();
                            
                            const customerName = targetCustomer?.first_name || targetCustomer?.name || '';
                            const businessName = customerLookup?.businesses?.name || 
                                                 customerLookup?.businesses?.business_data?.businessName || 
                                                 'Your Service Provider';
                            
                            const feedbackMsg = generateFeedbackRequest({
                                customerName: customerName,
                                serviceName: serviceName,
                                businessName: businessName,
                            });

                            // Send to the CUSTOMER (not the tech)
                            const cleanTargetPhone = targetPhone.replace(/[^\d+]/g, '');
                            await twilioClient.messages.create({
                                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                                to: `whatsapp:${cleanTargetPhone}`,
                                body: feedbackMsg
                            });

                            // Update target customer status to await feedback
                            await supabase.from('customers').update({
                                status: 'feedback_pending',
                                notes: (targetCustomer ? '' : '') + `\n[FEEDBACK_REQUESTED: ${new Date().toISOString()}]`
                            }).eq('id', targetCustomerId);

                            console.log(`📝 Feedback request sent to customer: ${cleanTargetPhone}`);
                        }

                        // Reset owner status
                        await supabase.from('customers').update({
                            status: 'lead', // Reset to default
                            notes: notes + `\n[TECH_REGISTER_COMPLETE: ${new Date().toISOString()}]`
                        }).eq('id', customerLookup.id);
                    } else {
                        console.error('❌ Failed to create service record from tech flow:', recordError);
                    }
                }
            } else {
                console.error('❌ Tech flow error: Target phone lost from notes');
                if (twilioClient && fromNumber) {
                     await twilioClient.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: `whatsapp:${customerPhone}`,
                        body: '❌ Error: Could not find customer phone. Please scan sticker again to restart.'
                    });
                }
            }

            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // ========== STICKER SCAN HANDLER ==========
        // Direct-to-WhatsApp flow for QR sticker scans
        // Now supports business context via [BIZ:id] in the trigger message
        // Enhanced with "Forever Customer Engine" - returning customer recognition
        if (classification.intent === 'STICKER_SCAN') {
            console.log('🏷️ Sticker scan detected - starting VIP flow');

            // Use already extracted business context or fall back to customer's business
            const business = targetBusiness || customerLookup?.businesses;
            const businessId = targetBusiness?.id || customerLookup?.business_id;

            console.log(`📋 Business context: ${business?.name || 'none'} (ID: ${businessId || 'none'})`);

            const businessName = business?.name || business?.business_data?.businessName || 'us';
            const businessNiche = business?.business_data?.niche || 'default';
            const flowConfig = getFlowConfig(businessNiche);

            // ========== CHECK FOR OWNER SCAN (Admin Mode) ==========
            // If the sender is the business owner, enter Service Registration Mode
            const ownerPhone = business?.whatsapp_number || business?.phone_number;
            const cleanOwnerPhone = ownerPhone ? ownerPhone.replace(/[^\d]/g, '') : null;
            const cleanSenderPhone = customerPhone.replace(/[^\d]/g, '');

            // Check if sender matches owner (try exact match and with/without country code)
            const isOwner = cleanOwnerPhone && (
                cleanSenderPhone === cleanOwnerPhone || 
                cleanSenderPhone.endsWith(cleanOwnerPhone.slice(-10)) // Last 10 digits match
            );

            if (isOwner && twilioClient && fromNumber) {
                console.log('👑 Owner scanned sticker - starting Service Registration Flow');
                
                const prompt = generateTechRegistrationPrompt(businessName);
                
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${customerPhone}`,
                    body: prompt
                });

                // Update owner's state to "tech_registering"
                // We treat the owner as a "customer" record for flow state management
                if (customerLookup?.id) {
                    await supabase.from('customers').update({
                        status: 'tech_registering', // Defined in warranty-flow.ts
                        notes: (customerLookup.notes || '') + `\n[ADMIN_MODE: registering service at ${new Date().toISOString()}]`
                    }).eq('id', customerLookup.id);
                }
                
                return new NextResponse(
                    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                    { headers: { 'Content-Type': 'text/xml' } }
                );
            }

            // ========== CHECK FOR RETURNING CUSTOMER ==========
            // Look up service history for this customer + business
            let serviceHistory: any[] = [];
            let isReturningCustomer = false;
            
            if (customerLookup?.id && businessId) {
                const { data: historyData } = await supabase
                    .from('service_records')
                    .select('id, service_date, service_name, appliance_type, warranty_expires_at, next_service_due_at')
                    .eq('customer_id', customerLookup.id)
                    .eq('business_id', businessId)
                    .order('service_date', { ascending: false })
                    .limit(5);
                
                if (historyData && historyData.length > 0) {
                    serviceHistory = historyData;
                    isReturningCustomer = true;
                    console.log(`🔄 Returning customer detected! ${serviceHistory.length} past services`);
                }
            }

            if (twilioClient && fromNumber) {
                let greeting: string;

                if (isReturningCustomer && serviceHistory.length > 0) {
                    // ========== RETURNING CUSTOMER PATH ==========
                    const customerName = customerLookup?.name || customerLookup?.first_name || 'there';
                    const history: CustomerServiceHistory = {
                        customerId: customerLookup!.id,
                        customerName: customerName,
                        totalServices: serviceHistory.length,
                        lastServiceDate: serviceHistory[0]?.service_date ? new Date(serviceHistory[0].service_date) : undefined,
                        nextDueDate: serviceHistory[0]?.next_service_due_at ? new Date(serviceHistory[0].next_service_due_at) : undefined,
                        services: serviceHistory.map(s => ({
                            id: s.id,
                            serviceDate: new Date(s.service_date),
                            serviceName: s.service_name || flowConfig.serviceName,
                            applianceType: s.appliance_type,
                            warrantyActive: s.warranty_expires_at ? new Date(s.warranty_expires_at) > new Date() : false,
                            warrantyExpiresAt: s.warranty_expires_at ? new Date(s.warranty_expires_at) : undefined,
                        })),
                    };

                    // Check if service is due soon
                    if (history.nextDueDate && isServiceDueSoon(history.nextDueDate, 30)) {
                        // Service due - show nudge
                        const lastServiceDateStr = history.lastServiceDate 
                            ? formatDateSEA(history.lastServiceDate)
                            : 'recently';
                        const daysToDue = Math.ceil((history.nextDueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        
                        greeting = generateServiceDueNudge({
                            customerName: history.customerName,
                            applianceType: history.services[0]?.applianceType || flowConfig.serviceName.split(' ')[0].toLowerCase(),
                            daysToDue: daysToDue,
                            lastServiceDate: lastServiceDateStr,
                        });
                    } else {
                        // Normal returning customer greeting - pass flowConfig for consistent menu
                        greeting = generateReturningCustomerGreeting(history, businessName, {
                            cleaningLabel: flowConfig.cleaningLabel,
                            repairLabel: flowConfig.repairLabel,
                            priceLabel: flowConfig.priceLabel,
                        });
                    }

                    // Update customer as repeat customer
                    await supabase.from('customers').update({
                        is_repeat_customer: true,
                        status: 'returning_menu',
                        notes: (customerLookup?.notes || '') + `\n[RETURNING_SCAN: ${new Date().toISOString()}]`
                    }).eq('id', customerLookup!.id);

                } else {
                    // ========== NEW CUSTOMER PATH ==========
                    // Offer warranty activation OR booking menu
                    greeting = generateWarrantyOffer({
                        businessName: businessName,
                        cleaningLabel: flowConfig.cleaningLabel,
                        repairLabel: flowConfig.repairLabel,
                        priceLabel: flowConfig.priceLabel,
                    });

                    // Update or create customer record for sticker scan
                    if (customerLookup?.id) {
                        await supabase.from('customers').update({
                            status: 'warranty_offer', // New status - waiting for 1/2/3/4 choice
                            business_id: businessId || customerLookup.business_id,
                            notes: (customerLookup.notes || '') + `\n[STICKER_SCAN: ${new Date().toISOString()}]` + 
                                (businessId ? ` [BIZ:${businessId}]` : '')
                        }).eq('id', customerLookup.id);
                        console.log(`✅ Updated existing customer ${customerLookup.id} with warranty_offer status`);
                    } else {
                        // Create new customer record for sticker scan
                        const { data: newCustomer, error: insertError } = await supabase
                            .from('customers')
                            .insert({
                                phone: phoneWithPlus,
                                status: 'warranty_offer',
                                notes: `[STICKER_SCAN: ${new Date().toISOString()}]` + 
                                    (businessId ? ` [BIZ:${businessId}]` : ''),
                                business_id: businessId || null
                            })
                            .select()
                            .single();
                        
                        if (insertError) {
                            console.error(`❌ Failed to create customer for sticker scan:`, insertError);
                        } else {
                            console.log(`✅ Created new customer ${newCustomer?.id} with phone ${phoneWithPlus} status warranty_offer`);
                        }
                    }
                }

                // Send greeting
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${customerPhone}`,
                    body: greeting
                });

                // Notify owner that someone scanned their sticker (optional - for tracking)
                const ownerPhone = business?.whatsapp_number || business?.phone_number;
                if (ownerPhone) {
                    const cleanOwnerPhone = ownerPhone.replace(/[^\d+]/g, '');
                    // Silent tracking - don't spam owner for every scan
                    console.log(`📊 Sticker scanned for ${businessName} - owner: ${cleanOwnerPhone}${isReturningCustomer ? ' (RETURNING CUSTOMER!)' : ''}`);
                }
            }

            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // ========== STICKER MENU HANDLER ==========
        // Handle menu selection (1/2/3) after sticker scan
        if (classification.intent === 'STICKER_MENU') {
            console.log('📋 Sticker menu selection detected');

            const selection = classification.entities.slot_number;
            const businessName = customerLookup?.businesses?.name || 'Business';
            const businessNiche = customerLookup?.businesses?.business_data?.niche || 'default';
            const flowConfig = getFlowConfig(businessNiche);

            if (twilioClient && fromNumber && selection) {
                let responseMessage = '';
                let newStatus = '';

                switch (selection) {
                    case 1: // Cleaning / Primary Service
                        responseMessage = generateCleaningPrompt(flowConfig);
                        newStatus = 'sticker_units';
                        break;
                    case 2: // Repair / Issue
                        responseMessage = generateRepairPrompt(flowConfig);
                        newStatus = 'sticker_repair';
                        break;
                    case 3: // Check Price
                        responseMessage = generatePriceList(flowConfig, businessName);
                        newStatus = 'sticker_menu'; // Stay in menu after showing prices
                        break;
                    default:
                        responseMessage = 'Please reply with 1, 2, or 3 to select an option.';
                        newStatus = 'sticker_menu';
                }

                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${customerPhone}`,
                    body: responseMessage
                });

                // Update status
                if (customerLookup?.id) {
                    await supabase.from('customers').update({
                        status: newStatus,
                        notes: (customerLookup.notes || '') + `\n[STICKER_MENU: Selected ${selection} at ${new Date().toISOString()}]`
                    }).eq('id', customerLookup.id);
                }
            }

            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // ========== STICKER UNITS HANDLER ==========
        // Handle units/quantity response after selecting cleaning
        if (conversationContext.customerStatus === 'sticker_units') {
            console.log('🔢 Sticker units response detected');

            // Extract number from message
            const unitsMatch = messageText.match(/(\d+)/);
            const units = unitsMatch ? parseInt(unitsMatch[1]) : 1;

            const businessNiche = customerLookup?.businesses?.business_data?.niche || 'default';
            const flowConfig = getFlowConfig(businessNiche);

            if (twilioClient && fromNumber) {
                // Send confirmation with total and ask for address
                const confirmMessage = generateUnitsConfirmation(flowConfig, units);
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${customerPhone}`,
                    body: confirmMessage
                });

                // Save units and transition to awaiting_address
                if (customerLookup?.id) {
                    const total = flowConfig.pricePerUnit * units;
                    await supabase.from('customers').update({
                        status: 'awaiting_address',
                        estimate_min: total,
                        estimate_max: total,
                        notes: (customerLookup.notes || '') + `\n[STICKER_UNITS: ${units} ${flowConfig.unitLabel}(s) = ${flowConfig.currency} ${total}]`
                    }).eq('id', customerLookup.id);
                }
            }

            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                { headers: { 'Content-Type': 'text/xml' } }
            );
        }

        // ========== STICKER REPAIR HANDLER ==========
        // Handle photo/description response for repair requests
        if (conversationContext.customerStatus === 'sticker_repair') {
            console.log('🔧 Sticker repair response detected');

            const businessNiche = customerLookup?.businesses?.business_data?.niche || 'default';
            const flowConfig = getFlowConfig(businessNiche);

            if (twilioClient && fromNumber) {
                // Thank them and ask for address
                await twilioClient.messages.create({
                    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                    to: `whatsapp:${customerPhone}`,
                    body: `Thanks! I've noted that down. 📝\n\nPlease share your *Address* or send a *Location Pin* 📍 so we can schedule the inspection.`
                });

                // Save issue description and transition to awaiting_address
                if (customerLookup?.id) {
                    await supabase.from('customers').update({
                        status: 'awaiting_address',
                        estimate_min: flowConfig.repairInspectionFee,
                        estimate_max: flowConfig.repairInspectionFee,
                        notes: (customerLookup.notes || '') + `\n[REPAIR_ISSUE: ${messageText.substring(0, 200)}]`
                    }).eq('id', customerLookup.id);
                }
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
            // Support both 'waiting_for_address' (quote flow) and 'awaiting_address' (sticker flow)
            let customer = null;
            let error = null;

            // Try with plus first - check both status types
            const result1 = await supabase
                .from('customers')
                .select('*, businesses(id, name, business_data, whatsapp_number, phone_number)')
                .eq('phone', phoneWithPlus)
                .in('status', ['waiting_for_address', 'awaiting_address'])
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
                    .in('status', ['waiting_for_address', 'awaiting_address'])
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
                const isFromStickerFlow = customer.status === 'awaiting_address';

                // Extract selected slot from notes (Get the LAST one if multiple)
                // Use split/pop to find the latest valid selection
                const slotParts = customer.notes?.split('📅 SELECTED SLOT: ');
                const hasSelectedSlot = slotParts && slotParts.length > 1;
                const selectedSlot = hasSelectedSlot ? slotParts.pop()?.split('\n')[0] : null;

                // Extract estimate from notes or DB
                let estimate = 'As quoted';
                if (customer.estimate_min && customer.estimate_max) {
                    const businessData = customer.businesses?.business_data || {};
                    const currency = businessData.currency || 'RM';
                    estimate = customer.estimate_min === customer.estimate_max 
                        ? `${currency} ${customer.estimate_min}`
                        : `${currency} ${customer.estimate_min} - ${currency} ${customer.estimate_max}`;
                } else {
                    const estimateMatch = customer.notes?.match(/Estimate: ([^\n]+)/);
                    if (estimateMatch) estimate = estimateMatch[1];
                }

                // Use location-derived address if it's a location pin, otherwise use message text
                const customerAddress = locationDerivedAddress || messageText;

                console.log(`✅ Found customer waiting for address: ${customerName}`);
                console.log(`📍 Address: ${customerAddress}${isLocationPin ? ' (from location pin)' : ''}`);
                console.log(`📅 Has slot: ${hasSelectedSlot ? selectedSlot : 'No - need to show slots'}`);
                console.log(`🏷️ From sticker flow: ${isFromStickerFlow}`);

                // For sticker flow customers without a slot selected - show slot options
                if (isFromStickerFlow && !hasSelectedSlot) {
                    // Generate available slots
                    const slots = generateSlotOptions();
                    const slotMessage = `Thanks! 📍\n\n` +
                        `Address: *${customerAddress}*\n\n` +
                        `When works best for you?\n\n` +
                        `1️⃣ ${slots[0].label}\n` +
                        `2️⃣ ${slots[1].label}\n` +
                        `3️⃣ ${slots[2].label}\n\n` +
                        `Reply with 1, 2, or 3`;

                    if (twilioClient && fromNumber) {
                        await twilioClient.messages.create({
                            from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                            to: from,
                            body: slotMessage
                        });
                        console.log('✅ Sent slot options to sticker flow customer');
                    }

                    // Update customer with address and move to slot selection state
                    await supabase
                        .from('customers')
                        .update({
                            status: 'quote_sent', // Uses standard slot selection handler
                            notes: `${customer.notes || ''}\n\n📍 ADDRESS: ${customerAddress}\n\nAVAILABLE_SLOTS: ${JSON.stringify(slots)}`
                        })
                        .eq('id', customer.id);

                    return new NextResponse(
                        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                        { headers: { 'Content-Type': 'text/xml' } }
                    );
                }

                // Customer has already selected a slot - confirm booking
                // 1. Send final confirmation to customer
                const finalConfirmation = generateBookingConfirmation({
                    customerName,
                    businessName,
                    serviceName: customer.businesses?.business_data?.niche || 'Service',
                    timeSlot: selectedSlot || 'As scheduled',
                    address: customerAddress,
                    estimate
                });

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
                            notes: 'Booking confirmed by customer via WhatsApp (Sticker Flow)'
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
                        timeSlot: selectedSlot || 'As scheduled',
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

