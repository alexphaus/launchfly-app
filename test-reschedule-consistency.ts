/**
 * RESCHEDULE CONSISTENCY TEST
 * ==========================
 * This test creates a real booking, asks to reschedule, and verifies:
 * 1. The original booking is UPDATED (not deleted + new created)
 * 2. No duplicate bookings are created
 * 3. The AI doesn't lie about rescheduling
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import { receptionistTools } from './src/lib/ai-receptionist/tools';
import { generateSystemPrompt, type BusinessContext, type CustomerContext } from './src/lib/ai-receptionist/system-prompt';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUSINESS_ID = '525b6e62-efb4-4c85-aee0-da47eedbdcc4'; // DANS AIRCON
const TEST_PHONE = '+1999TESTRESCHEDULE';

async function cleanup() {
    await supabase.from('bookings').delete().eq('customer_phone', TEST_PHONE);
    await supabase.from('customers').delete().eq('phone', TEST_PHONE);
}

async function getBookingsCount(): Promise<number> {
    const { data } = await supabase
        .from('bookings')
        .select('id')
        .eq('customer_phone', TEST_PHONE)
        .eq('business_id', BUSINESS_ID)
        .in('status', ['pending', 'confirmed']);
    return data?.length || 0;
}

async function getBookings() {
    const { data } = await supabase
        .from('bookings')
        .select('*')
        .eq('customer_phone', TEST_PHONE)
        .eq('business_id', BUSINESS_ID)
        .order('created_at', { ascending: false });
    return data || [];
}

function getMockBusinessContext(): BusinessContext {
    return {
        id: BUSINESS_ID,
        name: 'DANS AIRCON TEAM',
        niche: 'Aircon Service',
        currency: 'RM',
        cleaningPrice: 120,
        repairInspectionFee: 80,
        warrantyDays: 30,
        serviceInterval: 90,
        ownerName: 'Dan',
        ownerPhone: '+60123456789',
        operatingHours: '9am - 5pm',
    };
}

async function testRescheduleConsistency() {
    console.log('🧪 RESCHEDULE CONSISTENCY TEST\n');
    console.log('=' .repeat(60));
    
    await cleanup();
    
    // STEP 1: Create a real booking
    console.log('\n📝 Step 1: Creating initial MORNING booking...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const { data: booking, error } = await supabase.from('bookings').insert({
        business_id: BUSINESS_ID,
        customer_phone: TEST_PHONE,
        customer_name: 'Test Reschedule User',
        customer_address: '999 Test Street',
        slot_date: tomorrowStr,
        slot_time: 'morning',
        slot_label: 'Tomorrow Morning (9am - 12pm window)',
        status: 'pending',
        estimate: 'RM 120',
        notes: 'Service: Aircon Cleaning (1 unit)',
    }).select().single();
    
    if (error) {
        console.log('❌ Failed to create test booking:', error);
        return;
    }
    
    const bookingId = booking.id;
    console.log(`✅ Created booking: ${bookingId}`);
    console.log(`   Slot: ${booking.slot_label}`);
    
    const initialCount = await getBookingsCount();
    console.log(`   Active bookings: ${initialCount}`);
    
    // STEP 2: Simulate reschedule conversation
    console.log('\n📝 Step 2: Simulating reschedule request...');
    
    const businessContext = getMockBusinessContext();
    const customerContext: CustomerContext = {
        isReturning: true,
        warrantyActive: true,
        name: 'Test Reschedule User',
        id: 'test-customer-id',
    };
    
    const systemPrompt = generateSystemPrompt(businessContext, customerContext);
    const contextMessage = `
[SYSTEM CONTEXT]
- Customer Phone: ${TEST_PHONE}
- Business ID: ${BUSINESS_ID}
- Today is January 27, 2026

EXISTING BOOKING:
- Booking ID: ${bookingId}
- Tomorrow Morning (9am - 12pm window)
- Aircon Cleaning at 999 Test Street

CRITICAL RESCHEDULING INSTRUCTIONS:
When customer asks to change time (morning to afternoon or vice versa):
1. The afternoon slot IS available
2. IMMEDIATELY call rescheduleBooking with:
   customerPhone: "${TEST_PHONE}"
   businessId: "${BUSINESS_ID}"
   newDate: "${tomorrowStr}"
   newWindow: "afternoon"
3. DO NOT just check availability - actually CALL rescheduleBooking!
4. DO NOT create a new booking - UPDATE the existing one!
`;
    
    // Conversation: Customer wants to change from morning to afternoon
    const conversation = [
        { role: 'assistant' as const, content: `Welcome back! You have a booking for tomorrow morning (9am-12pm) for aircon cleaning at 999 Test Street. How can I help?` },
        { role: 'user' as const, content: 'Can it be afternoon instead? I cant make morning' },
    ];
    
    const result = await generateText({
        model: openai('gpt-4o-mini'),
        system: systemPrompt + contextMessage,
        messages: conversation,
        tools: receptionistTools,
        maxSteps: 5,
    });
    
    const aiResponse = result.text || '';
    const toolCalls = result.steps.flatMap(s => s.toolCalls || []);
    const toolResults = result.steps.flatMap(s => s.toolResults || []);
    
    console.log(`\n🤖 AI Response: ${aiResponse.substring(0, 200)}...`);
    console.log(`\n🔧 Tool calls (${toolCalls.length}):`);
    for (const tc of toolCalls) {
        console.log(`   - ${tc.toolName}: ${JSON.stringify((tc as any).args || {})}`);
    }
    
    console.log(`\n📤 Tool results (${toolResults.length}):`);
    for (const tr of toolResults) {
        const res = (tr as any).output ?? (tr as any).result;
        console.log(`   - ${(tr as any).toolName}: ${JSON.stringify(res)}`);
    }
    
    // STEP 3: Verify database state
    console.log('\n📝 Step 3: Verifying database state...');
    
    const finalCount = await getBookingsCount();
    const allBookings = await getBookings();
    
    console.log(`\n📊 RESULTS:`);
    console.log(`   Initial active bookings: ${initialCount}`);
    console.log(`   Final active bookings:   ${finalCount}`);
    console.log(`\n   All bookings:`);
    for (const b of allBookings) {
        console.log(`   - ${b.id.substring(0, 8)}: ${b.slot_time} on ${b.slot_date} (${b.status})`);
    }
    
    // ASSERTIONS
    let passed = true;
    
    // Check 1: Booking count should stay the same (no duplicates)
    if (finalCount > initialCount) {
        console.log('\n❌ FAIL: Duplicate booking created instead of updating!');
        passed = false;
    }
    
    // Check 2: The original booking should now be afternoon
    const afternoonBooking = allBookings.find(b => b.slot_time === 'afternoon' && b.status === 'pending');
    if (!afternoonBooking) {
        console.log('\n❌ FAIL: Booking was not rescheduled to afternoon!');
        passed = false;
    } else if (afternoonBooking.id !== bookingId) {
        console.log('\n❌ FAIL: A NEW booking was created instead of updating the original!');
        passed = false;
    }
    
    // Check 3: AI claimed success but tool failed
    const rescheduleResult = toolResults.find(tr => (tr as any).toolName === 'rescheduleBooking');
    const rescheduleSuccess = rescheduleResult && ((rescheduleResult as any).output?.success || (rescheduleResult as any).result?.success);
    const aiClaimsSuccess = aiResponse.toLowerCase().includes('done') || 
                           aiResponse.toLowerCase().includes('rescheduled') ||
                           aiResponse.toLowerCase().includes('changed');
    
    if (aiClaimsSuccess && !rescheduleSuccess) {
        console.log('\n❌ FAIL: AI claimed reschedule success but tool returned failure!');
        passed = false;
    }
    
    // Check 4: Did AI actually call rescheduleBooking?
    const calledReschedule = toolCalls.some(tc => tc.toolName === 'rescheduleBooking');
    const calledCreateBooking = toolCalls.some(tc => tc.toolName === 'createBooking');
    
    if (!calledReschedule && aiClaimsSuccess) {
        console.log('\n❌ FAIL: AI claimed to reschedule but never called rescheduleBooking!');
        passed = false;
    }
    
    if (calledCreateBooking) {
        console.log('\n⚠️ WARNING: AI called createBooking during a reschedule operation!');
    }
    
    if (passed) {
        console.log('\n✅ TEST PASSED: Reschedule worked correctly!');
    }
    
    // Cleanup
    await cleanup();
    console.log('\n🧹 Test data cleaned up');
    
    return passed;
}

testRescheduleConsistency().catch(console.error);
