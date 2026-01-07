// /api/slots/available/route.ts
// Smart Slot Availability API - Returns available slots using "subtraction logic"
// Assumes owner is always free, subtracts already-booked slots in real-time

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// Default slot configuration
const DEFAULT_SLOTS = [
    { id: 'morning', label: '9am - 11am', start: '09:00', end: '11:00' },
    { id: 'early_afternoon', label: '1pm - 3pm', start: '13:00', end: '15:00' },
    { id: 'late_afternoon', label: '3pm - 5pm', start: '15:00', end: '17:00' },
];

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

function formatDateLabel(d: Date, isToday: boolean): string {
    if (isToday) return 'Today';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
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
        const daysAhead = business?.slot_settings?.days_ahead || 3;
        const bufferHours = business?.slot_settings?.buffer_hours || 2;
        // Timezone offset in hours (default to UTC+8 for SEA businesses)
        const timezoneOffset = business?.slot_settings?.timezone_offset ?? 8;

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

            for (const slot of slotConfig) {
                const slotStartHour = parseInt(slot.start.split(':')[0]);

                // Skip past slots for today (with buffer)
                if (isToday && currentHour >= slotStartHour - bufferHours) {
                    continue;
                }

                potentialSlots.push({
                    id: `${dateStr}_${slot.id}`,
                    date: dateStr,
                    time: slot.id,
                    label: `${formatDateLabel(date, isToday)} ${slot.label}`,
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

        // 4. Create a set of booked slot IDs
        const bookedSlotIds = new Set(
            (bookings || []).map(b => {
                // Handle "all_day" blocks
                if (b.slot_time === 'all_day') {
                    return `blocked_${b.slot_date}`;
                }
                return `${b.slot_date}_${b.slot_time}`;
            })
        );

        // Also mark full-day blocks
        const blockedDates = new Set(
            (bookings || [])
                .filter(b => b.slot_time === 'all_day')
                .map(b => b.slot_date)
        );

        // 5. Subtract booked slots
        const availableSlots = potentialSlots.filter(slot => {
            // Check if entire day is blocked
            if (blockedDates.has(slot.date)) {
                return false;
            }
            // Check if specific slot is booked
            return !bookedSlotIds.has(slot.value);
        });

        // 6. Return top 3 available slots
        return NextResponse.json({
            success: true,
            slots: availableSlots.slice(0, 3),
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
            const blockDate = date || formatDate(new Date());

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
