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
    serviceType: z.string().describe('e.g., "Aircon Cleaning (2 units)"'),
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
    bookingId: z.string().describe('The booking UUID to cancel'),
    reason: z.string().optional().describe('Reason for cancellation'),
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
                niche: config.niche || 'Aircon Service',
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

            const endDateFormatted = warrantyEndDate.toLocaleDateString('en-GB', { 
                day: 'numeric', month: 'short', year: 'numeric' 
            });

            return {
                success: true,
                customerId: customer?.id,
                warrantyEndDate: endDateFormatted,
                message: `Warranty activated until ${endDateFormatted}`,
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

            // Create booking record
            const { data: booking, error } = await supabase
                .from('bookings')
                .insert({
                    business_id: businessId,
                    customer_id: customerId,
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

            // Update customer status
            if (customerId) {
                await supabase
                    .from('customers')
                    .update({ 
                        status: 'booked',
                        address,
                    })
                    .eq('id', customerId);
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
                // This message guides the AI on what to tell the customer
                customerMessage: `Booking request received! Technician will confirm and WhatsApp you 30 mins before arrival.`,
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
        description: 'Send a WhatsApp notification to the business owner about a new booking or important event.',
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
        description: 'Cancel a customer booking. Call this when customer wants to cancel their appointment.',
        inputSchema: cancelBookingSchema,
        execute: async (input: CancelBookingInput) => {
            const { bookingId, reason } = input;

            // First check if booking exists and is cancellable
            const { data: booking, error: fetchError } = await supabase
                .from('bookings')
                .select('id, status, slot_label, customer_name')
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

            return {
                success: true,
                message: `Booking for ${booking.slot_label} has been cancelled`,
                bookingId,
            };
        },
    }),
};

// Export tool names for type safety
export type ReceptionistToolName = keyof typeof receptionistTools;
