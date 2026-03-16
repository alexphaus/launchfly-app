// src/lib/ai-receptionist/tools.ts
// The "Hands" - Database operations the AI can call
// Each tool is a discrete action with typed parameters

import { tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// ============================================================
// TOOL DEFINITIONS - These are the ONLY "hardcoded" operations
// The AI decides WHEN to call them based on conversation context
// ============================================================

// Schema definitions
const lookupCustomerSchema = z.object({
    phone: z.string().describe('Customer phone number in international format'),
});

const getBusinessConfigSchema = z.object({
    businessId: z.string().describe('The business UUID from [BIZ:xxx] tag'),
});

const checkAvailabilitySchema = z.object({
    businessId: z.string().describe('Business UUID'),
    date: z.string().describe('Date in YYYY-MM-DD format'),
    window: z.enum(['morning', 'afternoon']).describe('Time window'),
});

const getAvailableSlotsSchema = z.object({
    businessId: z.string().describe('Business UUID'),
});

const activateWarrantySchema = z.object({
    businessId: z.string().describe('Business UUID'),
    phone: z.string().describe('Customer phone number'),
    name: z.string().describe('Customer name'),
    serviceType: z.string().describe('Service type: cleaning or repair'),
    warrantyDays: z.number().optional().describe('Warranty duration in days (default 30)'),
});

const createBookingSchema = z.object({
    businessId: z.string().describe('Business UUID'),
    customerId: z.string().optional().describe('Customer UUID if known'),
    customerName: z.string().describe('Customer name'),
    customerPhone: z.string().describe('Customer phone'),
    address: z.string().describe('Service address'),
    date: z.string().describe('Booking date YYYY-MM-DD'),
    window: z.enum(['morning', 'afternoon']).describe('Time window'),
    serviceType: z.string().describe('e.g., "Cleaning (2 units)" or "Plumbing Repair (1 job)"'),
    estimateAmount: z.number().describe('Estimated price'),
    currency: z.string().optional().describe('Currency code, default RM'),
});

const updateCustomerSchema = z.object({
    customerId: z.string().describe('Customer UUID'),
    address: z.string().optional().describe('New address'),
    status: z.string().optional().describe('New status'),
    notes: z.string().optional().describe('Additional notes to append'),
});

const notifyOwnerSchema = z.object({
    ownerPhone: z.string().describe('Owner phone number'),
    message: z.string().describe('Notification message'),
});

const calculatePriceSchema = z.object({
    serviceType: z.enum(['cleaning', 'repair_inspection']).describe('Type of service'),
    units: z.number().optional().describe('Number of units (for cleaning)'),
    pricePerUnit: z.number().describe('Price per unit'),
    currency: z.string().optional().describe('Currency code'),
});

const getCustomerBookingsSchema = z.object({
    customerPhone: z.string().describe('Customer phone number'),
    businessId: z.string().describe('Business UUID'),
});

const cancelBookingSchema = z.object({
    bookingId: z.string().optional().describe('The booking UUID to cancel (if known)'),
    customerPhone: z.string().optional().describe('Customer phone number (if bookingId not known)'),
    businessId: z.string().optional().describe('Business ID (required if using customerPhone)'),
    reason: z.string().optional().describe('Reason for cancellation'),
});

const rescheduleBookingSchema = z.object({
    bookingId: z.string().optional().describe('The booking UUID to reschedule (if known)'),
    customerPhone: z.string().optional().describe('Customer phone number (if bookingId not known)'),
    businessId: z.string().optional().describe('Business ID (required if using customerPhone)'),
    newDate: z.string().describe('New date in YYYY-MM-DD format'),
    newWindow: z.enum(['morning', 'afternoon']).describe('New time window'),
});

const saveFeedbackSchema = z.object({
    customerId: z.string().describe('Customer UUID'),
    businessId: z.string().describe('Business UUID'),
    score: z.number().min(1).max(5).describe('Feedback score 1-5 (1=Excellent, 2=Good, 3=Not Good)'),
    feedbackText: z.string().optional().describe('Optional feedback text from customer'),
});

const saveReferralSchema = z.object({
    businessId: z.string().describe('Business UUID'),
    referrerId: z.string().describe('Customer UUID of person giving the referral'),
    refereeName: z.string().describe('Name of the friend being referred'),
    refereePhone: z.string().describe('Phone number of the friend being referred'),
});

// Type inference from schemas
type LookupCustomerInput = z.infer<typeof lookupCustomerSchema>;
type GetBusinessConfigInput = z.infer<typeof getBusinessConfigSchema>;
type CheckAvailabilityInput = z.infer<typeof checkAvailabilitySchema>;
type GetAvailableSlotsInput = z.infer<typeof getAvailableSlotsSchema>;
type ActivateWarrantyInput = z.infer<typeof activateWarrantySchema>;
type CreateBookingInput = z.infer<typeof createBookingSchema>;
type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
type NotifyOwnerInput = z.infer<typeof notifyOwnerSchema>;
type CalculatePriceInput = z.infer<typeof calculatePriceSchema>;
type GetCustomerBookingsInput = z.infer<typeof getCustomerBookingsSchema>;
type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
type SaveFeedbackInput = z.infer<typeof saveFeedbackSchema>;
type SaveReferralInput = z.infer<typeof saveReferralSchema>;

export const receptionistTools = {
    /**
     * Look up customer by phone number
     * Returns: warranty status, service history, name
     */
    lookupCustomer: tool({
        description: 'Look up a customer by their phone number to check warranty status, service history, and profile. Call this when a returning customer messages or after sticker scan.',
        inputSchema: lookupCustomerSchema,
        execute: async (input: LookupCustomerInput) => {
            const { phone } = input;
            const phoneWithPlus = phone.startsWith('+') ? phone : `+${phone}`;
            const phoneWithoutPlus = phone.replace(/^\+/, '');

            const { data: customer, error } = await supabase
                .from('customers')
                .select('*, businesses(id, name, business_data, whatsapp_number)')
                .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !customer) {
                return { found: false, message: 'Customer not found - this is a new customer' };
            }

            const warrantyActive = customer.warranty_end_date && 
                new Date(customer.warranty_end_date) > new Date();
            
            return {
                found: true,
                id: customer.id,
                name: customer.name || customer.first_name,
                phone: customer.phone,
                warrantyActive,
                warrantyEndDate: customer.warranty_end_date,
                lastServiceDate: customer.last_service_date,
                lastServiceType: customer.service_type,
                address: customer.address,
                businessId: customer.business_id,
                businessName: customer.businesses?.name,
                status: customer.status,
            };
        },
    }),

    /**
     * Get business configuration by ID
     * Returns: pricing, services, operating hours
     */
    getBusinessConfig: tool({
        description: 'Get business configuration including pricing, services, and settings. Call this when you see [BIZ:id] in the message or need pricing info.',
        inputSchema: getBusinessConfigSchema,
        execute: async (input: GetBusinessConfigInput) => {
            const { businessId } = input;
            const { data: business, error } = await supabase
                .from('businesses')
                .select('*')
                .eq('id', businessId)
                .single();

            if (error || !business) {
                return { found: false, message: 'Business not found' };
            }

            const config = business.business_data || {};
            return {
                found: true,
                id: business.id,
                name: business.name,
                niche: config.niche || 'General Service',
                currency: config.currency || 'RM',
                cleaningPrice: config.cleaningPrice || 120,
                repairInspectionFee: config.repairInspectionFee || 80,
                warrantyDays: config.warrantyDays || 30,
                serviceInterval: config.serviceInterval || 90,
                ownerPhone: business.whatsapp_number || business.phone_number,
                operatingHours: config.operatingHours || '9am - 5pm',
            };
        },
    }),

    /**
     * Check slot availability for a specific day/window
     */
    checkAvailability: tool({
        description: 'Check if a specific arrival window is available for booking. Morning = 9am-12pm, Afternoon = 1pm-5pm.',
        inputSchema: checkAvailabilitySchema,
        execute: async (input: CheckAvailabilityInput) => {
            const { businessId, date, window } = input;
            const maxPerWindow = 3; // Default cap

            const { data: bookings } = await supabase
                .from('bookings')
                .select('id')
                .eq('business_id', businessId)
                .eq('slot_date', date)
                .or(`slot_time.eq.${window},slot_time.eq.all_day`)
                .in('status', ['pending', 'confirmed', 'blocked']);

            const count = bookings?.length || 0;
            const available = count < maxPerWindow;
            const remaining = maxPerWindow - count;

            return {
                available,
                bookedCount: count,
                remainingSlots: remaining,
                windowLabel: window === 'morning' ? '9am - 12pm' : '1pm - 5pm',
            };
        },
    }),

    /**
     * Get next available slots across multiple days
     */
    getAvailableSlots: tool({
        description: 'Get the next 4 available arrival windows for booking. Call this when customer is ready to pick a time. Requires businessId.',
        inputSchema: getAvailableSlotsSchema,
        execute: async (input: GetAvailableSlotsInput) => {
            const { businessId } = input;
            
            if (!businessId) {
                console.error('❌ getAvailableSlots called without businessId');
                return { slots: [], fullyBooked: false, error: 'Missing businessId' };
            }
            
            console.log(`   📅 getAvailableSlots called for business: ${businessId}`);
            
            const maxPerWindow = 3;
            const slots: { label: string; date: string; window: string; available: boolean }[] = [];
            
            // Check next 4 days
            const now = new Date();
            const localNow = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
            const currentHour = localNow.getUTCHours();
            
            const startDate = new Date(localNow);
            const endDate = new Date(localNow);
            endDate.setDate(endDate.getDate() + 5); // Fetch a bit more just in case

            const sDateStr = startDate.toISOString().split('T')[0];
            const eDateStr = endDate.toISOString().split('T')[0];
            
            console.log(`   📅 Checking slots from ${sDateStr} to ${eDateStr}`);

            // OPTIMIZATION: Fetch all relevant bookings in ONE query instead of 8 loop queries
            const { data: allBookings, error } = await supabase
                .from('bookings')
                .select('slot_date, slot_time')
                .eq('business_id', businessId)
                .gte('slot_date', sDateStr)
                .lte('slot_date', eDateStr)
                .in('status', ['pending', 'confirmed', 'blocked']);
            
            if (error) {
                console.error('❌ Error fetching slots:', error);
                return { slots: [], fullyBooked: true, error: 'Failed to check availability' };
            }
            
            console.log(`   📅 Found ${allBookings?.length || 0} existing bookings`);

            for (let dayOffset = 0; dayOffset < 4 && slots.length < 4; dayOffset++) {
                const date = new Date(localNow);
                date.setDate(date.getDate() + dayOffset);
                const dateStr = date.toISOString().split('T')[0];
                const isToday = dayOffset === 0;
                const dayLabel = isToday ? 'Today' : dayOffset === 1 ? 'Tomorrow' : 
                    date.toLocaleDateString('en-GB', { weekday: 'long' });

                // Filter bookings for this day in memory
                const dayBookings = allBookings?.filter(b => b.slot_date === dateStr) || [];

                // Check morning window (skip if today and past 10am)
                if (!(isToday && currentHour >= 10)) {
                    const morningCount = dayBookings.filter(b => 
                        b.slot_time === 'morning' || b.slot_time === 'all_day'
                    ).length;
                    
                    if (morningCount < maxPerWindow) {
                        slots.push({
                            label: `${dayLabel} Morning (9am - 12pm window)`,
                            date: dateStr,
                            window: 'morning',
                            available: true,
                        });
                    }
                }

                // Check afternoon window (skip if today and past 3pm)
                if (!(isToday && currentHour >= 15) && slots.length < 4) {
                    const afternoonCount = dayBookings.filter(b => 
                        b.slot_time === 'afternoon' || b.slot_time === 'all_day'
                    ).length;
                    
                    if (afternoonCount < maxPerWindow) {
                        slots.push({
                            label: `${dayLabel} Afternoon (1pm - 5pm window)`,
                            date: dateStr,
                            window: 'afternoon',
                            available: true,
                        });
                    }
                }
            }

            return {
                slots: slots.slice(0, 4),
                fullyBooked: slots.length === 0,
            };
        },
    }),

    /**
     * Activate warranty for a customer
     */
    activateWarranty: tool({
        description: 'Register/activate warranty for a customer after sticker scan. Creates customer if new.',
        inputSchema: activateWarrantySchema,
        execute: async (input: ActivateWarrantyInput) => {
            console.log('   🛡️ activateWarranty called with:', JSON.stringify(input));
            
            const { businessId, phone, name, serviceType, warrantyDays = 30 } = input;
            
            // Validate required fields
            if (!businessId || !phone || !name) {
                console.error('   ❌ activateWarranty missing required fields:', { businessId: !!businessId, phone: !!phone, name: !!name });
                return { success: false, error: 'Missing businessId, phone, or name' };
            }
            
            const now = new Date();
            const warrantyEndDate = new Date(now);
            warrantyEndDate.setDate(warrantyEndDate.getDate() + warrantyDays);

            const phoneWithPlus = phone.startsWith('+') ? phone : `+${phone}`;
            console.log('   🛡️ Looking for existing customer:', { businessId, phone: phoneWithPlus });
            
            // First, check if customer already exists
            const { data: existingCustomer } = await supabase
                .from('customers')
                .select('id')
                .eq('business_id', businessId)
                .eq('phone', phoneWithPlus)
                .single();
            
            // email is required, so we use phone as placeholder email
            const placeholderEmail = `${phoneWithPlus.replace(/\+/g, '')}@whatsapp.customer`;
            
            let customer;
            let error;
            
            if (existingCustomer) {
                // Update existing customer
                console.log('   🛡️ Updating existing customer:', existingCustomer.id);
                const result = await supabase
                    .from('customers')
                    .update({
                        name,
                        first_name: name.split(' ')[0],
                        last_name: name.split(' ').slice(1).join(' ') || null,
                        last_service_date: now.toISOString(),
                        next_reminder_due: warrantyEndDate.toISOString(),
                        status: 'warranty_activated',
                        notes: `Service: ${serviceType || 'cleaning'}. Warranty until ${warrantyEndDate.toISOString().split('T')[0]}`,
                    })
                    .eq('id', existingCustomer.id)
                    .select()
                    .single();
                customer = result.data;
                error = result.error;
            } else {
                // Insert new customer
                console.log('   🛡️ Creating new customer');
                const result = await supabase
                    .from('customers')
                    .insert({
                        business_id: businessId,
                        phone: phoneWithPlus,
                        email: placeholderEmail,
                        name,
                        first_name: name.split(' ')[0],
                        last_name: name.split(' ').slice(1).join(' ') || null,
                        last_service_date: now.toISOString(),
                        next_reminder_due: warrantyEndDate.toISOString(),
                        status: 'warranty_activated',
                        source: 'whatsapp_sticker',
                        notes: `Service: ${serviceType || 'cleaning'}. Warranty until ${warrantyEndDate.toISOString().split('T')[0]}`,
                    })
                    .select()
                    .single();
                customer = result.data;
                error = result.error;
            }

            if (error) {
                console.error('   ❌ activateWarranty DB error:', error);
                return { success: false, error: error.message };
            }
            
            console.log('   ✅ Customer saved/updated:', customer?.id);

            // ============================================================
            // CREATE SERVICE RECORD (for Smart Nag reminders)
            // ============================================================
            // This populates the service_records table that the cron job queries
            const serviceIntervalDays = 180; // 6 months for cleaning
            const nextServiceDue = new Date(now);
            nextServiceDue.setDate(nextServiceDue.getDate() + serviceIntervalDays);

            const { data: serviceRecord, error: srError } = await supabase
                .from('service_records')
                .insert({
                    business_id: businessId,
                    customer_id: customer?.id,
                    service_type: serviceType || 'cleaning',
                    service_name: `${(serviceType || 'cleaning').charAt(0).toUpperCase() + (serviceType || 'cleaning').slice(1)} Service`,
                    units_serviced: 1,
                    warranty_days: warrantyDays,
                    warranty_expires_at: warrantyEndDate.toISOString(),
                    service_interval_days: serviceIntervalDays,
                    next_service_due_at: nextServiceDue.toISOString(),
                    registered_via: 'sticker_scan',
                    registered_by: 'customer',
                    service_date: now.toISOString(),
                })
                .select()
                .single();

            if (srError) {
                console.error('   ⚠️ Failed to create service_record (non-fatal):', srError.message);
            } else {
                console.log('   ✅ Service record created:', serviceRecord?.id);
                console.log('   📅 Next reminder due:', nextServiceDue.toISOString().split('T')[0]);
            }

            const endDateFormatted = warrantyEndDate.toLocaleDateString('en-GB', { 
                day: 'numeric', month: 'short', year: 'numeric' 
            });

            const nextDueFormatted = nextServiceDue.toLocaleDateString('en-GB', { 
                day: 'numeric', month: 'short', year: 'numeric' 
            });

            return {
                success: true,
                customerId: customer?.id,
                serviceRecordId: serviceRecord?.id,
                warrantyEndDate: endDateFormatted,
                nextServiceDue: nextDueFormatted,
                message: `Warranty activated until ${endDateFormatted}. Automatic reminder scheduled for ${nextDueFormatted}.`,
            };
        },
    }),

    /**
     * Create a booking request
     */
    createBooking: tool({
        description: 'CRITICAL: Create a booking request. You MUST call this when customer selects a time slot (replies "1", "2", "tomorrow", etc.) after seeing available slots. This creates the actual booking in database and notifies the owner. Without calling this, NO BOOKING EXISTS. ALL parameters are required.',
        inputSchema: createBookingSchema,
        execute: async (input: CreateBookingInput) => {
            console.log('   📝 createBooking called with:', JSON.stringify(input));
            
            const { 
                businessId, customerId, customerName, customerPhone, 
                address, date, window, serviceType, estimateAmount, 
                currency = 'RM' 
            } = input;
            
            // Validate required fields
            if (!businessId || !customerName || !customerPhone || !address || !date || !window || !serviceType) {
                const missing = [];
                if (!businessId) missing.push('businessId');
                if (!customerName) missing.push('customerName');
                if (!customerPhone) missing.push('customerPhone');
                if (!address) missing.push('address');
                if (!date) missing.push('date');
                if (!window) missing.push('window');
                if (!serviceType) missing.push('serviceType');
                console.error('   ❌ createBooking missing required fields:', missing.join(', '));
                return { success: false, error: `Missing required fields: ${missing.join(', ')}. Please provide all booking details.` };
            }
            
            const windowLabel = window === 'morning' ? 'Morning (9am - 12pm window)' : 'Afternoon (1pm - 5pm window)';
            const dateObj = new Date(date);
            const dayLabel = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

            // Fetch business owner phone for notification
            const { data: business } = await supabase
                .from('businesses')
                .select('whatsapp_number, phone_number, name, business_data')
                .eq('id', businessId)
                .single();
            
            const ownerPhone = business?.whatsapp_number || business?.phone_number;

            // Validate customerId - must be a valid UUID or null
            // AI sometimes passes "unknown" or empty strings which crash the DB
            const isValidUUID = (str: string | undefined) => {
                if (!str) return false;
                return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
            };
            const validCustomerId = isValidUUID(customerId) ? customerId : null;

            // Create booking record
            const { data: booking, error } = await supabase
                .from('bookings')
                .insert({
                    business_id: businessId,
                    customer_id: validCustomerId, // Use validated ID or null
                    slot_date: date,
                    slot_time: window,
                    slot_label: `${dayLabel} ${windowLabel}`,
                    status: 'pending',
                    booking_type: 'customer',
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    customer_address: address,
                    estimate: `${currency} ${estimateAmount}`,
                    notes: `Service: ${serviceType}`,
                })
                .select()
                .single();

            if (error) {
                return { success: false, error: error.message };
            }

            // Update customer status AND notes for dashboard visibility
            // Use validCustomerId (UUID-checked) and fallback to phone lookup
            if (validCustomerId) {
                await supabase
                    .from('customers')
                    .update({ 
                        status: 'booked',
                        address,
                        notes: `📅 SELECTED SLOT: ${dayLabel} ${windowLabel}\n📍 ADDRESS: ${address}\n🛠️ Service: ${serviceType}\n💰 Estimate: ${currency} ${estimateAmount}`,
                    })
                    .eq('id', validCustomerId);
            } else if (customerPhone) {
                // Fallback: update by phone if customerId was invalid/missing
                await supabase
                    .from('customers')
                    .update({ 
                        status: 'booked',
                        address,
                        notes: `📅 SELECTED SLOT: ${dayLabel} ${windowLabel}\n📍 ADDRESS: ${address}\n🛠️ Service: ${serviceType}\n💰 Estimate: ${currency} ${estimateAmount}`,
                    })
                    .eq('phone', customerPhone)
                    .eq('business_id', businessId);
            }

            return {
                success: true,
                bookingId: booking?.id,
                slotLabel: `${dayLabel} ${windowLabel}`,
                address,
                estimate: `${currency} ${estimateAmount}`,
                serviceType,
                customerName,
                customerPhone,
                ownerPhone, // For notification routing
                businessName: business?.name,
                message: `Booking created explicitly from tool for ${dayLabel} ${windowLabel}`, // Explicit message
                // This message guides the AI on what to tell the customer
                customerMessage: `Booking request received! Technician will confirm and WhatsApp you 30 mins before arrival.`,
                // Fire automation event (non-blocking)
                _automation: (() => {
                    import('@/lib/automations/executor').then(({ fireEvent }) =>
                        fireEvent({ businessId, event: 'booking_created', phone: customerPhone, customerName, metadata: { bookingId: booking?.id, slotLabel: `${dayLabel} ${windowLabel}`, serviceType, estimate: `${currency} ${estimateAmount}` } })
                    ).catch(() => {});
                    return 'fired';
                })(),
            };
        },
    }),

    /**
     * Update customer status/notes
     */
    updateCustomer: tool({
        description: 'Update customer record with new information like address, status, or notes.',
        inputSchema: updateCustomerSchema,
        execute: async (input: UpdateCustomerInput) => {
            const { customerId, address, status, notes } = input;
            const updates: Record<string, string> = {};
            if (address) updates.address = address;
            if (status) updates.status = status;

            const { error } = await supabase
                .from('customers')
                .update(updates)
                .eq('id', customerId);

            if (notes) {
                // Append to existing notes
                const { data: current } = await supabase
                    .from('customers')
                    .select('notes')
                    .eq('id', customerId)
                    .single();
                
                await supabase
                    .from('customers')
                    .update({ notes: (current?.notes || '') + '\n' + notes })
                    .eq('id', customerId);
            }

            return { success: !error };
        },
    }),

    /**
     * Send notification to business owner
     */
    notifyOwner: tool({
        description: 'Send a text message notification to the business owner to alert them of something. DO NOT USE THIS TO TRIGGER VOICE CALLS OR DEMOS.',
        inputSchema: notifyOwnerSchema,
        execute: async (input: NotifyOwnerInput) => {
            const { ownerPhone, message } = input;
            // This will be handled by the main route which has Twilio access
            // We just return the intent for the orchestrator to process
            return {
                action: 'notify_owner' as const,
                phone: ownerPhone,
                message,
            };
        },
    }),

    /**
     * Calculate service price
     */
    calculatePrice: tool({
        description: 'Calculate the total price for a service. Use this when customer specifies number of units.',
        inputSchema: calculatePriceSchema,
        execute: async (input: CalculatePriceInput) => {
            const { serviceType, units = 1, pricePerUnit, currency = 'RM' } = input;
            
            if (serviceType === 'repair_inspection') {
                return {
                    total: pricePerUnit,
                    label: `${currency} ${pricePerUnit} (Inspection fee - waived if you proceed with repair)`,
                    units: 1,
                };
            }

            const total = pricePerUnit * units;
            return {
                total,
                label: `${currency} ${total}`,
                units,
                breakdown: `${units} unit${units > 1 ? 's' : ''} × ${currency} ${pricePerUnit} = ${currency} ${total}`,
            };
        },
    }),

    /**
     * Get customer's bookings
     */
    getCustomerBookings: tool({
        description: 'Look up all bookings for a customer. Call this when customer asks about their reservations, appointments, or bookings.',
        inputSchema: getCustomerBookingsSchema,
        execute: async (input: GetCustomerBookingsInput) => {
            const { customerPhone, businessId } = input;
            const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
            const phoneWithoutPlus = customerPhone.replace(/^\+/, '');
            
            // Only show bookings from today onwards (not old completed ones)
            const today = new Date().toISOString().split('T')[0];

            const { data: bookings, error } = await supabase
                .from('bookings')
                .select('id, slot_date, slot_time, slot_label, status, customer_address, estimate, notes, created_at')
                .eq('business_id', businessId)
                .or(`customer_phone.eq.${phoneWithPlus},customer_phone.eq.${phoneWithoutPlus}`)
                .in('status', ['pending', 'confirmed'])
                .gte('slot_date', today)  // Only future/today bookings
                .order('slot_date', { ascending: true })
                .limit(5);

            if (error) {
                console.error('Error fetching bookings:', error);
                return { found: false, bookings: [], error: error.message };
            }

            if (!bookings || bookings.length === 0) {
                return { found: false, bookings: [], message: 'No upcoming bookings found' };
            }

            return {
                found: true,
                count: bookings.length,
                bookings: bookings.map(b => ({
                    id: b.id,
                    date: b.slot_label || `${b.slot_date} ${b.slot_time}`,
                    status: b.status,
                    address: b.customer_address,
                    estimate: b.estimate,
                    service: b.notes?.replace('Service: ', '') || 'Service',
                })),
            };
        },
    }),

    /**
     * Cancel a booking
     */
    cancelBooking: tool({
        description: 'Cancel a customer booking PERMANENTLY. Only use this if the customer wants to CANCEL entirely (not reschedule). For date/time changes, use rescheduleBooking instead!',
        inputSchema: cancelBookingSchema,
        execute: async (input: CancelBookingInput) => {
            let { bookingId, customerPhone, businessId, reason } = input;
            
            console.log('   🗑️ cancelBooking called with:', JSON.stringify(input));

            // SAFETY: Reject if this looks like a reschedule attempt
            if (reason && (reason.toLowerCase().includes('reschedul') || reason.toLowerCase().includes('moving') || reason.toLowerCase().includes('change date'))) {
                console.log('   ❌ cancelBooking rejected: reason suggests reschedule, not cancel');
                return { 
                    success: false, 
                    error: 'This looks like a reschedule request, not a cancellation. Use rescheduleBooking tool instead to change the date/time while preserving the booking.' 
                };
            }

            // If no bookingId, try to find by phone
            if (!bookingId && customerPhone && businessId) {
                const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
                const phoneWithoutPlus = customerPhone.replace(/^\+/, '');
                const today = new Date().toISOString().split('T')[0];
                
                const { data: bookings, error: findError } = await supabase
                    .from('bookings')
                    .select('id, slot_label, customer_name')
                    .eq('business_id', businessId)
                    .or(`customer_phone.eq.${phoneWithPlus},customer_phone.eq.${phoneWithoutPlus}`)
                    .in('status', ['pending', 'confirmed'])
                    .gte('slot_date', today)
                    .order('created_at', { ascending: false })
                    .limit(1);
                
                if (findError || !bookings || bookings.length === 0) {
                    console.log('   ❌ No active booking found for phone:', customerPhone);
                    return { success: false, error: 'No active booking found for this customer' };
                }
                
                bookingId = bookings[0].id;
                console.log('   ✅ Found booking by phone:', bookingId);
            }
            
            if (!bookingId) {
                return { success: false, error: 'Need bookingId or customerPhone+businessId to cancel' };
            }

            // First check if booking exists and is cancellable
            const { data: booking, error: fetchError } = await supabase
                .from('bookings')
                .select('id, status, slot_label, customer_name, customer_id, business_id, customer_phone')
                .eq('id', bookingId)
                .single();

            if (fetchError || !booking) {
                return { success: false, error: 'Booking not found' };
            }

            if (booking.status === 'cancelled') {
                return { success: false, error: 'Booking is already cancelled' };
            }

            if (booking.status === 'completed') {
                return { success: false, error: 'Cannot cancel a completed booking' };
            }

            // Update the booking status
            const { error: updateError } = await supabase
                .from('bookings')
                .update({
                    status: 'cancelled',
                    notes: reason ? `Cancelled: ${reason}` : 'Cancelled by customer',
                })
                .eq('id', bookingId);

            if (updateError) {
                return { success: false, error: updateError.message };
            }
            
            // Also update customer status back to warranty_activated if they had one
            if (booking.customer_id) {
                await supabase
                    .from('customers')
                    .update({ status: 'warranty_activated' })
                    .eq('id', booking.customer_id);
            }
            
            console.log('   ✅ Booking cancelled:', bookingId);

            // Fire automation event (non-blocking)
            import('@/lib/automations/executor').then(({ fireEvent }) =>
                fireEvent({ businessId: booking.business_id, event: 'booking_cancelled', phone: booking.customer_phone, customerName: booking.customer_name, metadata: { bookingId, slotLabel: booking.slot_label } })
            ).catch(() => {});

            return {
                success: true,
                message: `Booking for ${booking.slot_label} has been cancelled`,
                bookingId,
                customerName: booking.customer_name,
                slotLabel: booking.slot_label,
            };
        },
    }),

    /**
     * Reschedule a booking
     */
    rescheduleBooking: tool({
        description: 'PREFERRED: Reschedule an existing booking to a new date/time. Call this when customer wants to CHANGE their appointment date or time. This is an atomic update - it modifies the existing booking directly without cancelling. DO NOT use cancelBooking for date changes!',
        inputSchema: rescheduleBookingSchema,
        execute: async (input: RescheduleBookingInput) => {
            let { bookingId, customerPhone, businessId, newDate, newWindow } = input;
            
            console.log('   🔄 rescheduleBooking called with:', JSON.stringify(input));

            const phoneWithPlus = customerPhone ? (customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`) : undefined;
            const phoneWithoutPlus = customerPhone ? customerPhone.replace(/^\+/, '') : undefined;

            // If no bookingId, try to find by phone
            if (!bookingId && customerPhone && businessId) {
                const today = new Date().toISOString().split('T')[0];
                
                // Allow finding 'cancelled' bookings too, in case AI cancelled it first by mistake
                const { data: bookings, error: findError } = await supabase
                    .from('bookings')
                    .select('id, slot_label, customer_name, status')
                    .eq('business_id', businessId)
                    .or(`customer_phone.eq.${phoneWithPlus},customer_phone.eq.${phoneWithoutPlus}`)
                    .in('status', ['pending', 'confirmed', 'cancelled']) // Allow reviving cancelled bookings
                    .gte('slot_date', today)
                    .order('updated_at', { ascending: false }) // Get most recently touched
                    .limit(1);
                
                if (findError || !bookings || bookings.length === 0) {
                    return { success: false, error: 'No active or recent booking found to reschedule' };
                }
                
                bookingId = bookings[0].id; // Use the most recent one
                console.log('   ✅ Found booking to reschedule:', bookingId, 'Status:', bookings[0].status);
            }

            if (!bookingId) {
                return { success: false, error: 'Need bookingId or customerPhone+businessId to reschedule' };
            }

            // Check availability for the new slot
            if (businessId) {
                const { data: existingSlots } = await supabase
                    .from('bookings')
                    .select('id')
                    .eq('business_id', businessId)
                    .eq('slot_date', newDate)
                    .or(`slot_time.eq.${newWindow},slot_time.eq.all_day`)
                    .in('status', ['pending', 'confirmed', 'blocked']); // Don't count cancelled here
                
                if (existingSlots && existingSlots.length >= 3) {
                     return { success: false, error: 'The selected slot is fully booked. Please choose another time.' };
                }
            }

            const newDateObj = new Date(newDate);
            const newDayLabel = newDateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
            const windowLabel = newWindow === 'morning' ? 'Morning (9am - 12pm window)' : 'Afternoon (1pm - 5pm window)';
            const newSlotLabel = `${newDayLabel} ${windowLabel}`;

            // Update the booking
            const { data: updatedBooking, error: updateError } = await supabase
                .from('bookings')
                .update({
                    slot_date: newDate,
                    slot_time: newWindow,
                    slot_label: newSlotLabel,
                    status: 'pending', // Always reset to pending (revives cancelled bookings too)
                    notes: `Rescheduled to ${newSlotLabel}`,
                })
                .eq('id', bookingId)
                .select()
                .single();

            if (updateError) {
                return { success: false, error: updateError.message };
            }

            // Update customer notes too for dashboard visibility
            if (updatedBooking?.customer_id) {
                const { data: customer } = await supabase
                    .from('customers')
                    .select('notes')
                    .eq('id', updatedBooking.customer_id)
                    .single();
                
                const newNote = `📅 RESCHEDULED TO: ${newSlotLabel}`;
                const currentNotes = customer?.notes || '';
                
                await supabase
                    .from('customers')
                    .update({ 
                        notes: currentNotes + '\n' + newNote
                    })
                    .eq('id', updatedBooking.customer_id);
            }

            return {
                success: true,
                message: `Booking rescheduled to ${newSlotLabel}`,
                newSlotLabel,
                bookingId,
                customerName: updatedBooking?.customer_name,
            };
        },
    }),

    /**
     * Save customer feedback after 7-day follow-up
     */
    saveFeedback: tool({
        description: 'Save customer feedback after the 7-day follow-up. Call this when customer rates the service (1=Excellent, 2=Good, 3=Not Good). This clears the FEEDBACK_7D context.',
        inputSchema: saveFeedbackSchema,
        execute: async (input: SaveFeedbackInput) => {
            const { customerId, businessId, score, feedbackText } = input;
            
            console.log('   ⭐ saveFeedback called:', { customerId, score, feedbackText });
            
            // Map score to status: 1-2 = positive, 3+ = negative
            const feedbackStatus = score <= 2 ? 'positive' : 'negative';
            
            // Find the most recent service record for this customer
            const { data: serviceRecord, error: findError } = await supabase
                .from('service_records')
                .select('id')
                .eq('customer_id', customerId)
                .eq('business_id', businessId)
                .order('service_date', { ascending: false })
                .limit(1)
                .single();
            
            if (findError || !serviceRecord) {
                console.warn('   ⚠️ No service record found for feedback');
                // Still clear the context even if no record found
                await supabase
                    .from('customers')
                    .update({ last_interaction_context: null })
                    .eq('id', customerId);
                return { success: false, error: 'No recent service record found' };
            }
            
            // Update service record with feedback
            const { error: updateError } = await supabase
                .from('service_records')
                .update({
                    feedback_score: score,
                    feedback_status: feedbackStatus,
                    feedback_text: feedbackText || null,
                    feedback_received_at: new Date().toISOString(),
                })
                .eq('id', serviceRecord.id);
            
            if (updateError) {
                return { success: false, error: updateError.message };
            }
            
            // Clear the feedback context so AI doesn't keep asking
            await supabase
                .from('customers')
                .update({ last_interaction_context: null })
                .eq('id', customerId);
            
            return {
                success: true,
                feedbackStatus,
                message: feedbackStatus === 'positive' 
                    ? 'Great feedback recorded! Now ask for referral/review.'
                    : 'Negative feedback recorded. Escalate to owner.',
            };
        },
    }),

    /**
     * Save a referral when customer provides friend's details
     */
    saveReferral: tool({
        description: 'Save a referral when customer provides a friend\'s name and phone number. Creates a trackable referral record.',
        inputSchema: saveReferralSchema,
        execute: async (input: SaveReferralInput) => {
            const { businessId, referrerId, refereeName, refereePhone } = input;
            
            console.log('   🎁 saveReferral called:', { businessId, referrerId, refereeName, refereePhone });
            
            const phoneWithPlus = refereePhone.startsWith('+') ? refereePhone : `+${refereePhone}`;
            
            // Generate unique referral code and token
            const referralCode = `REF-${referrerId.substring(0, 6).toUpperCase()}`;
            const referralToken = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
            
            // Check if this referee was already referred
            const { data: existing } = await supabase
                .from('referrals')
                .select('id')
                .eq('business_id', businessId)
                .eq('referee_phone', phoneWithPlus)
                .single();
            
            if (existing) {
                return { success: false, error: 'This phone number has already been referred.' };
            }
            
            // Create referral record
            const { data: referral, error } = await supabase
                .from('referrals')
                .insert({
                    business_id: businessId,
                    referrer_id: referrerId,
                    referral_code: referralCode,
                    referral_token: referralToken,
                    referee_name: refereeName,
                    referee_phone: phoneWithPlus,
                    status: 'pending',
                    referral_message_sent_at: new Date().toISOString(),
                })
                .select()
                .single();
            
            if (error) {
                console.error('   ❌ Failed to save referral:', error);
                return { success: false, error: error.message };
            }
            
            // Mark referral_asked_at on the service record
            await supabase
                .from('service_records')
                .update({ referral_asked_at: new Date().toISOString() })
                .eq('customer_id', referrerId)
                .eq('business_id', businessId)
                .order('service_date', { ascending: false })
                .limit(1);
            
            return {
                success: true,
                referralCode,
                refereeName,
                refereePhone: phoneWithPlus,
                message: `Referral saved! ${refereeName} (${phoneWithPlus}) has been added.`,
            };
        },
    }),

    /**
     * Generate a Stripe checkout link for Launchfly $150/mo subscription
     */
    generateCheckoutLink: tool({
        description: 'Generate a Stripe checkout link for a $150/month Launchfly subscription. Call this when a prospect agrees to sign up.',
        inputSchema: z.object({
            customerName: z.string().describe('Prospect name'),
            customerPhone: z.string().describe('Prospect phone number'),
            customerEmail: z.string().optional().describe('Prospect email if known'),
        }),
        execute: async (input: { customerName: string; customerPhone: string; customerEmail?: string }) => {
            try {
                const Stripe = (await import('stripe')).default;
                const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
                const session = await stripe.checkout.sessions.create({
                    mode: 'subscription',
                    payment_method_types: ['card'],
                    line_items: [{
                        price_data: {
                            currency: 'usd',
                            recurring: { interval: 'month' },
                            unit_amount: 15000, // $150.00
                            product_data: {
                                name: 'Launchfly — AI Quote Follow-Up',
                                description: 'Automated WhatsApp follow-up for every quote you send. Cancel anytime.',
                            },
                        },
                        quantity: 1,
                    }],
                    customer_email: input.customerEmail || undefined,
                    metadata: {
                        source: 'sarah_sales_bot',
                        customer_name: input.customerName,
                        customer_phone: input.customerPhone,
                    },
                    success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai'}/onboarding/success`,
                    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai'}/onboarding/cancel`,
                });
                return { success: true, checkoutUrl: session.url };
            } catch (err: any) {
                console.error('[generateCheckoutLink] Stripe error:', err);
                return { success: false, error: err.message };
            }
        },
    }),

    /**
     * Trigger a Retell AI demo call to the prospect's phone
     * This lets the AI initiate a live voice demo mid-conversation
     */
    triggerDemoCall: tool({
        description: 'Trigger a 60-second AI demo voice call to the prospect\'s phone. Call this when the prospect agrees to hear a demo. The call will ring their phone immediately.',
        inputSchema: z.object({
            customerPhone: z.string().describe('Prospect phone number in international format (e.g. +60124900337)'),
            customerName: z.string().describe('Prospect name if known'),
            businessId: z.string().describe('Business UUID'),
        }),
        execute: async (input: { customerPhone: string; customerName: string; businessId: string }) => {
            try {
                const retellApiKey = process.env.RETELL_API_KEY;
                if (!retellApiKey) return { success: false, error: 'Voice calling not configured' };

                const agentId = process.env.RETELL_AGENT_ID || process.env.RETELL_DEFAULT_AGENT_ID || '';
                const fromNumber = process.env.RETELL_FROM_NUMBER || process.env.RETELL_DEFAULT_FROM_NUMBER || '';
                if (!agentId || !fromNumber) return { success: false, error: 'Voice agent not configured' };

                const phoneNorm = input.customerPhone.startsWith('+') ? input.customerPhone : `+${input.customerPhone}`;

                // Upsert a lead record so the call gets tracked
                const { data: lead } = await supabase
                    .from('quote_leads')
                    .upsert({
                        business_id: input.businessId,
                        phone: phoneNorm,
                        name: input.customerName || 'Prospect',
                        job_type: 'Demo Call',
                        status: 'Called',
                        source: 'ai_demo',
                        attempts: 1,
                    }, { onConflict: 'business_id,phone' })
                    .select('id')
                    .single();

                const res = await fetch('https://api.retellai.com/v2/create-phone-call', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${retellApiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        from_number: fromNumber,
                        to_number: phoneNorm,
                        agent_id: agentId,
                        retell_llm_dynamic_variables: {
                            customer_name: input.customerName || 'there',
                            business_name: 'Launchfly',
                            lead_id: lead?.id || '',
                        },
                        metadata: { lead_id: lead?.id || '', source: 'ai_demo_tool' },
                    }),
                });

                if (!res.ok) {
                    const errBody = await res.text();
                    return { success: false, error: `Call failed: ${errBody.substring(0, 100)}` };
                }

                return { success: true, message: 'Demo call triggered! The prospect\'s phone is ringing now.' };
            } catch (err: any) {
                console.error('[triggerDemoCall] Error:', err);
                return { success: false, error: err.message };
            }
        },
    }),

    /**
     * Call external webhooks (Zapier, Make, custom API)
     * URLs are pre-configured per business — AI cannot call arbitrary URLs
     */
    callWebhook: tool({
        description: 'Fire webhooks to the business owner\'s external automations (Zapier, Make, CRM, etc.). Use this when a significant event happens mid-conversation: prospect showed interest, booking confirmed, hot lead detected, etc. The webhook URLs are pre-configured by the business owner.',
        inputSchema: z.object({
            businessId: z.string().describe('Business UUID'),
            event: z.string().describe('Event name, e.g. "hot_lead", "demo_requested", "booking_confirmed", "objection_price"'),
            customerPhone: z.string().describe('Customer phone number'),
            customerName: z.string().optional().describe('Customer name if known'),
            summary: z.string().describe('Brief summary of what happened in the conversation'),
        }),
        execute: async (input: { businessId: string; event: string; customerPhone: string; customerName?: string; summary: string }) => {
            try {
                const { data: business } = await supabase
                    .from('businesses')
                    .select('business_data')
                    .eq('id', input.businessId)
                    .single();

                const bizData = business?.business_data || {};

                // Build webhooks list — support both legacy single URL and new array format
                type WebhookEntry = { label?: string; url: string; headers?: string; events?: string[] };
                const webhooks: WebhookEntry[] = [];
                if (Array.isArray(bizData.webhooks)) {
                    webhooks.push(...bizData.webhooks);
                } else if (bizData.webhook_url) {
                    webhooks.push({ url: bizData.webhook_url, headers: bizData.webhook_headers });
                }

                if (webhooks.length === 0) return { success: false, error: 'No webhook URLs configured for this business' };

                const payload = JSON.stringify({
                    event: input.event,
                    business_id: input.businessId,
                    phone: input.customerPhone,
                    customer_name: input.customerName || 'Unknown',
                    summary: input.summary,
                    timestamp: new Date().toISOString(),
                    source: 'ai_conversation',
                });

                const results: { label: string; ok: boolean; detail: string }[] = [];

                for (const wh of webhooks) {
                    // Skip webhooks that have an event filter that doesn't match
                    if (wh.events?.length && !wh.events.includes(input.event)) {
                        results.push({ label: wh.label || wh.url, ok: true, detail: 'skipped (event filter)' });
                        continue;
                    }

                    // SSRF protection
                    try {
                        const parsed = new URL(wh.url);
                        if (!['http:', 'https:'].includes(parsed.protocol)) {
                            results.push({ label: wh.label || wh.url, ok: false, detail: 'Only http/https allowed' });
                            continue;
                        }
                        if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(parsed.hostname)) {
                            results.push({ label: wh.label || wh.url, ok: false, detail: 'Private URL blocked' });
                            continue;
                        }
                    } catch {
                        results.push({ label: wh.label || wh.url, ok: false, detail: 'Invalid URL' });
                        continue;
                    }

                    // Parse optional custom headers
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (wh.headers && typeof wh.headers === 'string') {
                        for (const pair of wh.headers.split(',')) {
                            const eqIdx = pair.indexOf('=');
                            if (eqIdx > 0) {
                                headers[pair.substring(0, eqIdx).trim()] = pair.substring(eqIdx + 1).trim();
                            }
                        }
                    }

                    try {
                        const res = await fetch(wh.url, { method: 'POST', headers, body: payload });
                        if (!res.ok) {
                            const errBody = await res.text().catch(() => '');
                            results.push({ label: wh.label || wh.url, ok: false, detail: `HTTP ${res.status}: ${errBody.substring(0, 80)}` });
                        } else {
                            results.push({ label: wh.label || wh.url, ok: true, detail: 'OK' });
                        }
                    } catch (err: any) {
                        results.push({ label: wh.label || wh.url, ok: false, detail: err.message });
                    }
                }

                const fired = results.filter(r => r.ok && r.detail !== 'skipped (event filter)').length;
                return { success: fired > 0, message: `${fired}/${webhooks.length} webhooks fired for "${input.event}"`, details: results };
            } catch (err: any) {
                console.error('[callWebhook] Error:', err);
                return { success: false, error: err.message };
            }
        },
    }),

    /**
     * Send an image/media to the prospect via WhatsApp
     */
    sendImage: tool({
        description: 'Send an image or screenshot to the prospect via WhatsApp. Use this to send proof screenshots, demo videos, testimonials, or before/after photos. The image must be a publicly accessible URL.',
        inputSchema: z.object({
            customerPhone: z.string().describe('Prospect phone number'),
            imageUrl: z.string().describe('Publicly accessible URL of the image to send'),
            caption: z.string().optional().describe('Optional caption for the image'),
            businessId: z.string().describe('Business UUID'),
        }),
        execute: async (input: { customerPhone: string; imageUrl: string; caption?: string; businessId: string }) => {
            try {
                const { getWhatsAppProvider } = await import('@/lib/whatsapp-provider');
                const wa = await getWhatsAppProvider(input.businessId);
                const phoneNorm = input.customerPhone.startsWith('+') ? input.customerPhone : `+${input.customerPhone}`;
                const result = await wa.sendImage(phoneNorm, input.imageUrl, input.caption, input.businessId);
                if (!result.sent) return { success: false, error: result.error };
                return { success: true, message: 'Image sent successfully' };
            } catch (err: any) {
                console.error('[sendImage] Error:', err);
                return { success: false, error: err.message };
            }
        },
    }),
};

// Export tool names for type safety
export type ReceptionistToolName = keyof typeof receptionistTools;
