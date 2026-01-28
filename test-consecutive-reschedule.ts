/**
 * TEST: Consecutive Reschedule Bug
 * ================================
 * Tests the scenario where a user reschedules twice in a row:
 * 1. Create booking for "today afternoon"
 * 2. Reschedule to "tomorrow afternoon" 
 * 3. Reschedule again to "morning instead" (should update to tomorrow morning, NOT create new)
 * 
 * Run with: npx tsx test-consecutive-reschedule.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEST_BUSINESS_ID = '525b6e62-efb4-4c85-aee0-da47eedbdcc4'; // DANS AIRCON
const TEST_PHONE = '+34683233450'; // Alex's phone

async function cleanupTestBookings() {
    console.log('🧹 Cleaning up old test bookings...');
    const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('business_id', TEST_BUSINESS_ID)
        .or(`customer_phone.eq.${TEST_PHONE},customer_phone.eq.${TEST_PHONE.replace('+', '')}`);
    
    if (error) console.log('  Cleanup error (OK if no rows):', error.message);
    else console.log('  ✅ Cleaned up');
}

async function createTestBooking() {
    console.log('\n📝 Creating initial test booking...');
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const { data, error } = await supabase
        .from('bookings')
        .insert({
            business_id: TEST_BUSINESS_ID,
            customer_phone: TEST_PHONE,
            customer_name: 'Alex Test',
            slot_date: todayStr,
            slot_time: 'afternoon',
            slot_label: `${today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })} Afternoon (1pm - 5pm window)`,
            booking_type: 'customer',
            estimate: 'RM 200',
            notes: 'Service: Aircon Cleaning (2 units)',
            status: 'pending',
        })
        .select()
        .single();
    
    if (error) {
        console.log('  ❌ Error creating booking:', error.message);
        return null;
    }
    
    console.log(`  ✅ Created booking: ${data.id}`);
    console.log(`     Date: ${data.slot_date} ${data.slot_time}`);
    return data;
}

async function getBookingState() {
    const { data } = await supabase
        .from('bookings')
        .select('id, slot_date, slot_time, slot_label, updated_at')
        .eq('business_id', TEST_BUSINESS_ID)
        .or(`customer_phone.eq.${TEST_PHONE},customer_phone.eq.${TEST_PHONE.replace('+', '')}`)
        .order('updated_at', { ascending: false });
    
    return data || [];
}

async function simulateReschedule(newDate: string, newWindow: string, description: string) {
    console.log(`\n🔄 ${description}`);
    console.log(`   Target: ${newDate} ${newWindow}`);
    
    // Get current booking first
    const before = await getBookingState();
    console.log(`   Before: ${before.length} booking(s)`);
    if (before[0]) {
        console.log(`     Current: ${before[0].slot_date} ${before[0].slot_time}`);
    }
    
    // Simulate what the rescheduleBooking tool does
    const phoneWithPlus = TEST_PHONE;
    const phoneWithoutPlus = TEST_PHONE.replace(/^\+/, '');
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Find booking by phone (like the tool does)
    const { data: bookings, error: findError } = await supabase
        .from('bookings')
        .select('id, slot_label, customer_name, status')
        .eq('business_id', TEST_BUSINESS_ID)
        .or(`customer_phone.eq.${phoneWithPlus},customer_phone.eq.${phoneWithoutPlus}`)
        .in('status', ['pending', 'confirmed', 'cancelled'])
        .gte('slot_date', todayStr)
        .order('updated_at', { ascending: false })
        .limit(1);
    
    if (findError || !bookings || bookings.length === 0) {
        console.log('   ❌ No booking found to reschedule!');
        return false;
    }
    
    const bookingId = bookings[0].id;
    console.log(`   Found booking: ${bookingId}`);
    
    // Build the new slot label
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
            status: 'pending',
            notes: `Rescheduled to ${newSlotLabel}`,
        })
        .eq('id', bookingId)
        .select()
        .single();
    
    if (updateError) {
        console.log('   ❌ Update error:', updateError.message);
        return false;
    }
    
    console.log(`   ✅ Updated to: ${updatedBooking.slot_date} ${updatedBooking.slot_time}`);
    
    // Verify final state
    const after = await getBookingState();
    console.log(`   After: ${after.length} booking(s)`);
    
    // Check for duplicates
    if (after.length > 1) {
        console.log('   ⚠️ WARNING: Multiple bookings exist!');
        after.forEach((b, i) => console.log(`     ${i + 1}. ${b.slot_date} ${b.slot_time}`));
        return false;
    }
    
    return true;
}

async function runTest() {
    console.log('=' .repeat(60));
    console.log('🧪 CONSECUTIVE RESCHEDULE TEST');
    console.log('=' .repeat(60));
    
    // Step 1: Clean up
    await cleanupTestBookings();
    
    // Step 2: Create initial booking
    const booking = await createTestBooking();
    if (!booking) {
        console.log('\n❌ TEST FAILED: Could not create initial booking');
        return;
    }
    
    // Step 3: First reschedule - "tomorrow afternoon"
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const reschedule1 = await simulateReschedule(
        tomorrowStr, 
        'afternoon', 
        'RESCHEDULE 1: "tomorrow afternoon"'
    );
    
    if (!reschedule1) {
        console.log('\n❌ TEST FAILED: First reschedule failed');
        return;
    }
    
    // Wait a bit to ensure updated_at changes
    await new Promise(r => setTimeout(r, 1000));
    
    // Step 4: Second reschedule - "morning instead" 
    // This should keep the SAME date (tomorrow) but change window
    const reschedule2 = await simulateReschedule(
        tomorrowStr,  // Same date!
        'morning',    // Different window
        'RESCHEDULE 2: "morning instead" (should stay on tomorrow)'
    );
    
    if (!reschedule2) {
        console.log('\n❌ TEST FAILED: Second reschedule failed');
        return;
    }
    
    // Step 5: Verify final state
    console.log('\n📊 FINAL VERIFICATION');
    const final = await getBookingState();
    
    if (final.length !== 1) {
        console.log(`❌ FAIL: Expected 1 booking, found ${final.length}`);
        return;
    }
    
    const finalBooking = final[0];
    if (finalBooking.slot_date !== tomorrowStr) {
        console.log(`❌ FAIL: Date should be ${tomorrowStr}, got ${finalBooking.slot_date}`);
        return;
    }
    
    if (finalBooking.slot_time !== 'morning') {
        console.log(`❌ FAIL: Window should be 'morning', got ${finalBooking.slot_time}`);
        return;
    }
    
    console.log('✅ TEST PASSED!');
    console.log(`   Final: ${finalBooking.slot_date} ${finalBooking.slot_time}`);
    console.log(`   Label: ${finalBooking.slot_label}`);
    
    // Cleanup
    await cleanupTestBookings();
}

runTest().catch(console.error);
