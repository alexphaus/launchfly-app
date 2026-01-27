/**
 * RESCHEDULE VARIATIONS TEST
 * ==========================
 * Tests multiple ways customers might ask to reschedule
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

const BUSINESS_ID = '525b6e62-efb4-4c85-aee0-da47eedbdcc4';
const TEST_PHONE = '+1999TESTVARIATIONS';

// Test variations of reschedule requests
const RESCHEDULE_VARIATIONS = [
    { message: "Can it be afternoon instead?", expectedWindow: "afternoon" },
    { message: "I can't make morning, afternoon please", expectedWindow: "afternoon" },
    { message: "Change to afternoon", expectedWindow: "afternoon" },
    { message: "Move it to the afternoon slot", expectedWindow: "afternoon" },
    { message: "Actually morning doesn't work, can we do afternoon?", expectedWindow: "afternoon" },
    { message: "afternoon instead please", expectedWindow: "afternoon" },
    { message: "Switch to afternoon", expectedWindow: "afternoon" },
    { message: "Make it afternoon", expectedWindow: "afternoon" },
    { message: "I need to reschedule to afternoon", expectedWindow: "afternoon" },
    { message: "Can you change my booking to afternoon?", expectedWindow: "afternoon" },
];

async function cleanup() {
    await supabase.from('bookings').delete().eq('customer_phone', TEST_PHONE);
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

async function testVariation(variation: { message: string, expectedWindow: string }, index: number): Promise<boolean> {
    // Create a fresh booking for each test
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const { data: booking, error } = await supabase.from('bookings').insert({
        business_id: BUSINESS_ID,
        customer_phone: TEST_PHONE,
        customer_name: 'Variation Tester',
        customer_address: '123 Test Ave',
        slot_date: tomorrowStr,
        slot_time: 'morning',
        slot_label: 'Tomorrow Morning (9am - 12pm window)',
        status: 'pending',
        estimate: 'RM 120',
        notes: 'Test booking for variation ' + index,
    }).select().single();
    
    if (error || !booking) {
        console.log(`   ❌ Failed to create test booking: ${error?.message}`);
        return false;
    }
    
    const bookingId = booking.id;
    
    // Run AI conversation
    const businessContext = getMockBusinessContext();
    const customerContext: CustomerContext = {
        isReturning: true,
        warrantyActive: true,
        name: 'Variation Tester',
        id: 'test-customer',
    };
    
    const systemPrompt = generateSystemPrompt(businessContext, customerContext);
    const contextMessage = `
[SYSTEM CONTEXT]
- Customer Phone: ${TEST_PHONE}
- Business ID: ${BUSINESS_ID}
- Today is January 27, 2026
- Tomorrow is ${tomorrowStr}

EXISTING BOOKING:
- Booking ID: ${bookingId}
- Tomorrow Morning (9am - 12pm window)
- At 123 Test Ave

CRITICAL: When customer asks to change time (e.g., "afternoon instead"):
1. Afternoon IS available - do NOT just check availability
2. IMMEDIATELY call rescheduleBooking with:
   - customerPhone: "${TEST_PHONE}"
   - businessId: "${BUSINESS_ID}"
   - newDate: "${tomorrowStr}"
   - newWindow: "afternoon"
3. DO NOT stop after checkAvailability - call rescheduleBooking!
`;
    
    const conversation = [
        { role: 'assistant' as const, content: `You have a booking for tomorrow morning (9am-12pm). How can I help?` },
        { role: 'user' as const, content: variation.message },
    ];
    
    try {
        const result = await generateText({
            model: openai('gpt-4o-mini'),
            system: systemPrompt + contextMessage,
            messages: conversation,
            tools: receptionistTools,
            maxSteps: 5,
        });
        
        const toolCalls = result.steps.flatMap(s => s.toolCalls || []);
        const toolResults = result.steps.flatMap(s => s.toolResults || []);
        
        console.log(`   Tools: ${toolCalls.map(tc => tc.toolName).join(', ') || 'none'}`);
        console.log(`   Response: ${result.text?.substring(0, 80) || '(empty)'}...`);
        
        // Check if rescheduleBooking was called
        const rescheduleCall = toolCalls.find(tc => tc.toolName === 'rescheduleBooking');
        const createCall = toolCalls.find(tc => tc.toolName === 'createBooking');
        
        // Check result
        const rescheduleResult = toolResults.find(tr => (tr as any).toolName === 'rescheduleBooking');
        const success = rescheduleResult && ((rescheduleResult as any).output?.success || (rescheduleResult as any).result?.success);
        
        // Verify DB was updated
        const { data: updatedBooking } = await supabase
            .from('bookings')
            .select('slot_time')
            .eq('id', bookingId)
            .single();
        
        const dbUpdated = updatedBooking?.slot_time === variation.expectedWindow;
        
        // Check for duplicates
        const { data: allBookings } = await supabase
            .from('bookings')
            .select('id')
            .eq('customer_phone', TEST_PHONE)
            .eq('business_id', BUSINESS_ID)
            .in('status', ['pending', 'confirmed']);
        
        const hasDuplicates = (allBookings?.length || 0) > 1;
        
        // Delete test booking
        await supabase.from('bookings').delete().eq('id', bookingId);
        
        // Results
        if (!rescheduleCall) {
            if (createCall) {
                console.log(`   ❌ FAIL: Called createBooking instead of rescheduleBooking`);
            } else {
                console.log(`   ❌ FAIL: No rescheduleBooking called`);
            }
            return false;
        }
        
        if (!success) {
            console.log(`   ❌ FAIL: rescheduleBooking returned failure`);
            return false;
        }
        
        if (!dbUpdated) {
            console.log(`   ❌ FAIL: DB not updated to ${variation.expectedWindow}`);
            return false;
        }
        
        if (hasDuplicates) {
            console.log(`   ❌ FAIL: Duplicate bookings created`);
            return false;
        }
        
        console.log(`   ✅ PASS`);
        return true;
        
    } catch (err) {
        console.log(`   ❌ ERROR: ${(err as Error).message}`);
        await supabase.from('bookings').delete().eq('id', bookingId);
        return false;
    }
}

async function runAllTests() {
    console.log('🧪 RESCHEDULE VARIATIONS TEST\n');
    console.log('=' .repeat(60));
    
    await cleanup();
    
    let passed = 0;
    let failed = 0;
    
    for (let i = 0; i < RESCHEDULE_VARIATIONS.length; i++) {
        const variation = RESCHEDULE_VARIATIONS[i];
        console.log(`\n${i + 1}. "${variation.message}"`);
        
        const success = await testVariation(variation, i);
        if (success) passed++;
        else failed++;
        
        // Small delay between tests
        await new Promise(r => setTimeout(r, 500));
    }
    
    await cleanup();
    
    console.log('\n' + '=' .repeat(60));
    console.log(`📊 RESULTS: ${passed}/${RESCHEDULE_VARIATIONS.length} passed`);
    if (failed > 0) {
        console.log(`❌ ${failed} tests FAILED`);
    } else {
        console.log(`✅ All tests PASSED!`);
    }
}

runAllTests().catch(console.error);
