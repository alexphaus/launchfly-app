// /api/slots/available/route.ts
// Smart Slot Availability API - "Blue Collar Scheduling" with Arrival Windows
// Uses wider time windows to accommodate technician schedules
// Supports max_per_window cap to limit bookings per slot

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// Default arrival window configuration - wider windows for technicians
const DEFAULT_SLOTS = [
    { id: 'morning', label: '9am - 12pm window', start: '09:00', end: '12:00' },
    { id: 'afternoon', label: '1pm - 5pm window', start: '13:00', end: '17:00' },
];

// Default max bookings per window (can be overridden in business settings)
const DEFAULT_MAX_PER_WINDOW = 3;

interface SlotOption {
    id: string;
    date: string;
    time: string;
    label: string;
    value: string;
}

function formatDate(d: Date): string {
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function formatDateLabel(d: Date, isToday: boolean, isTomorrow: boolean = false): string {
    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    return d.toLocaleDateString('en-GB', { weekday: 'long' });
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
        return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    try {
        // 1. Get business slot settings (or use defaults)
        const { data: business } = await supabase
            .from('businesses')
            .select('slot_settings')
            .eq('id', businessId)
            .single();

        const slotConfig = business?.slot_settings?.slots || DEFAULT_SLOTS;
        const daysAhead = business?.slot_settings?.days_ahead || 4;
        // Buffer before morning window (need 2 hours before 9am to show morning)
        const morningBuffer = business?.slot_settings?.morning_buffer || 2;
        // Buffer before afternoon window (need to be before 3pm to show afternoon)
        const afternoonBuffer = business?.slot_settings?.afternoon_buffer || 2;
        // Timezone offset in hours (default to UTC+8 for SEA businesses)
        const timezoneOffset = business?.slot_settings?.timezone_offset ?? 8;
        // Max bookings per arrival window (default 3)
        const maxPerWindow = business?.slot_settings?.max_per_window ?? DEFAULT_MAX_PER_WINDOW;

        // 2. Generate all potential slots for the next N days
        const now = new Date();
        // Convert UTC hour to local hour using timezone offset
        const utcHour = now.getUTCHours();
        const currentHour = (utcHour + timezoneOffset + 24) % 24; // Handle wraparound
        console.log(`🕐 UTC hour: ${utcHour}, Local hour (UTC+${timezoneOffset}): ${currentHour}`);
        const potentialSlots: SlotOption[] = [];

        for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
            const date = new Date(now);
            date.setDate(date.getDate() + dayOffset);
            const dateStr = formatDate(date);
            const isToday = dayOffset === 0;
            const isTomorrow = dayOffset === 1;

            for (const slot of slotConfig) {
                const slotStartHour = parseInt(slot.start.split(':')[0]);
                const slotEndHour = parseInt(slot.end.split(':')[0]);

                // For arrival windows, we need enough time for tech to arrive within window
                // Morning (9am-12pm): show if before 10am local time (tech can arrive by noon)
                // Afternoon (1pm-5pm): show if before 3pm local time (tech can arrive by 5pm)
                if (isToday) {
                    // Calculate cutoff: if window ends at 12pm, cutoff is 10am (2 hours before end)
                    const cutoffHour = slotEndHour - morningBuffer;
                    if (currentHour >= cutoffHour) {
                        continue;
                    }
                }

                potentialSlots.push({
                    id: `${dateStr}_${slot.id}`,
                    date: dateStr,
                    time: slot.id,
                    label: `${formatDateLabel(date, isToday, isTomorrow)} ${slot.label}`,
                    value: `${dateStr}_${slot.id}`
                });
            }
        }

        // 3. Query existing bookings for these dates
        const dates = [...new Set(potentialSlots.map(s => s.date))];
        const { data: bookings } = await supabase
            .from('bookings')
            .select('slot_date, slot_time, status')
            .eq('business_id', businessId)
            .in('slot_date', dates)
            .in('status', ['pending', 'confirmed', 'blocked']);

        // 4. Count bookings per slot for cap enforcement
        const slotBookingCounts: Record<string, number> = {};
        const blockedDates = new Set<string>();
        
        (bookings || []).forEach(b => {
            // Handle "all_day" blocks - entire day unavailable
            if (b.slot_time === 'all_day') {
                blockedDates.add(b.slot_date);
                return;
            }
            // Count bookings per slot for cap
            const slotKey = `${b.slot_date}_${b.slot_time}`;
            slotBookingCounts[slotKey] = (slotBookingCounts[slotKey] || 0) + 1;
        });

        // 5. Filter to available slots (under cap and not blocked)
        const availableSlots = potentialSlots.filter(slot => {
            // Check if entire day is blocked
            if (blockedDates.has(slot.date)) {
                return false;
            }
            // Check if slot is at or over capacity
            const bookingCount = slotBookingCounts[slot.value] || 0;
            if (bookingCount >= maxPerWindow) {
                return false;
            }
            return true;
        });

        // Add remaining capacity info for UI
        const slotsWithCapacity = availableSlots.slice(0, 4).map(slot => ({
            ...slot,
            booked: slotBookingCounts[slot.value] || 0,
            remaining: maxPerWindow - (slotBookingCounts[slot.value] || 0)
        }));

        // 6. Return top 4 available arrival windows
        return NextResponse.json({
            success: true,
            slots: slotsWithCapacity,
            totalAvailable: availableSlots.length,
            totalBooked: bookings?.length || 0
        });

    } catch (error) {
        console.error('❌ Error getting available slots:', error);
        return NextResponse.json({ error: 'Failed to get slots' }, { status: 500 });
    }
}

// POST: Block a day or create a booking
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { businessId, action, date, slotTime, customerId, customerName, customerPhone, address, estimate, notes } = body;

        if (!businessId) {
            return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
        }

        if (action === 'block_day') {
            // Create an "all_day" block for the specified date
            // Use UTC+8 (SEA) for "Today" if no date provided
            const now = new Date();
            const localNow = new Date(now.getTime() + (8 * 60 * 60 * 1000));
            const blockDate = date || formatDate(localNow);

            const { data, error } = await supabase
                .from('bookings')
                .insert({
                    business_id: businessId,
                    slot_date: blockDate,
                    slot_time: 'all_day',
                    slot_label: 'All Day Block',
                    status: 'blocked',
                    booking_type: 'admin_block',
                    notes: notes || 'Owner marked day as unavailable'
                })
                .select()
                .single();

            if (error) throw error;

            return NextResponse.json({
                success: true,
                message: `Blocked ${blockDate}`,
                booking: data
            });

        } else if (action === 'book_slot') {
            // Create a customer booking
            if (!date || !slotTime) {
                return NextResponse.json({ error: 'date and slotTime required' }, { status: 400 });
            }

            // Check if slot is still available
            const { data: existing } = await supabase
                .from('bookings')
                .select('id')
                .eq('business_id', businessId)
                .eq('slot_date', date)
                .or(`slot_time.eq.${slotTime},slot_time.eq.all_day`)
                .in('status', ['pending', 'confirmed', 'blocked'])
                .single();

            if (existing) {
                return NextResponse.json({
                    error: 'Slot no longer available',
                    success: false
                }, { status: 409 });
            }

            // Create the booking
            const { data, error } = await supabase
                .from('bookings')
                .insert({
                    business_id: businessId,
                    customer_id: customerId,
                    slot_date: date,
                    slot_time: slotTime,
                    slot_label: `${date} ${slotTime}`,
                    status: 'pending',
                    booking_type: 'customer',
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    customer_address: address,
                    estimate,
                    notes
                })
                .select()
                .single();

            if (error) throw error;

            return NextResponse.json({
                success: true,
                message: 'Booking created',
                booking: data
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('❌ Error managing slots:', error);
        return NextResponse.json({ error: 'Failed to manage slot' }, { status: 500 });
    }
}
