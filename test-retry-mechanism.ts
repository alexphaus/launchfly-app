/**
 * TEST THE RETRY MECHANISM
 * ========================
 * Simulates what happens when AI doesn't call rescheduleBooking
 * and the retry mechanism kicks in
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
const TEST_PHONE = '+1999RETRYTEST';

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

async function testRetryMechanism(message: string): Promise<boolean> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Create booking
    const { data: booking } = await supabase.from('bookings').insert({
        business_id: BUSINESS_ID,
        customer_phone: TEST_PHONE,
        customer_name: 'Retry Tester',
        customer_address: '123 Test Ave',
        slot_date: tomorrowStr,
        slot_time: 'morning',
        slot_label: 'Tomorrow Morning (9am - 12pm window)',
        status: 'pending',
        estimate: 'RM 120',
    }).select().single();
    
    if (!booking) {
        console.log('   Failed to create booking');
        return false;
    }
    
    const businessContext = getMockBusinessContext();
    const customerContext: CustomerContext = {
        isReturning: true,
        warrantyActive: true,
        name: 'Retry Tester',
    };
    
    const systemPrompt = generateSystemPrompt(businessContext, customerContext);
    const contextMessage = `
[SYSTEM CONTEXT]
- Customer Phone: ${TEST_PHONE}
- Business ID: ${BUSINESS_ID}
- Customer has existing booking for tomorrow morning
`;
    
    const history = [
        { role: 'assistant' as const, content: 'You have a booking for tomorrow morning (9am-12pm). How can I help?' },
    ];
    
    // STEP 1: Initial AI call (like production)
    console.log('   Step 1: Initial AI call...');
    const result = await generateText({
        model: openai('gpt-4o-mini'),
        system: systemPrompt + contextMessage,
        messages: [...history, { role: 'user' as const, content: message }],
        tools: receptionistTools,
        maxSteps: 5,
    });
    
    const toolCalls = result.steps.flatMap(s => s.toolCalls || []);
    const calledReschedule = toolCalls.some(tc => tc.toolName === 'rescheduleBooking');
    
    console.log(`   Initial tools: ${toolCalls.map(tc => tc.toolName).join(', ') || 'none'}`);
    
    if (calledReschedule) {
        console.log('   ✅ Reschedule called on first try!');
        await supabase.from('bookings').delete().eq('id', booking.id);
        return true;
    }
    
    // STEP 2: Detect reschedule request pattern (like production route)
    const messageLower = message.toLowerCase();
    const looksLikeRescheduleRequest = (
        messageLower.includes('instead') ||
        (messageLower.includes('change') && (messageLower.includes('to') || messageLower.includes('time') || messageLower.includes('date') || messageLower.includes('my'))) ||
        (messageLower.includes('move') && (messageLower.includes('to') || messageLower.includes('it'))) ||
        messageLower.includes('switch') ||
        messageLower.includes('make it') ||
        (messageLower.includes('reschedule') && !messageLower.includes('?')) ||
        messageLower.includes("can't make") || messageLower.includes("cant make") ||
        messageLower.includes("doesn't work") || messageLower.includes("doesnt work") ||
        ((messageLower.includes('afternoon') || messageLower.includes('morning')) && messageLower.includes('please'))
    );
    
    console.log(`   Pattern detected: ${looksLikeRescheduleRequest}`);
    
    if (!looksLikeRescheduleRequest) {
        console.log('   ❌ Pattern not detected, retry wouldn\'t trigger');
        await supabase.from('bookings').delete().eq('id', booking.id);
        return false;
    }
    
    // STEP 3: Retry mechanism (like production - use specific tool)
    console.log('   Step 2: Retry with specific tool enforcement...');
    
    const wantsAfternoon = messageLower.includes('afternoon');
    const wantsMorning = messageLower.includes('morning') && !messageLower.includes("can't") && !messageLower.includes("cant");
    const targetWindow = wantsAfternoon ? 'afternoon' : (wantsMorning ? 'morning' : 'afternoon');
    
    const retryResult = await generateText({
        model: openai('gpt-4o-mini'),
        system: `You are a booking assistant. Your ONLY job right now is to call rescheduleBooking.

CALL rescheduleBooking with EXACTLY these values:
- customerPhone: "${TEST_PHONE}"
- businessId: "${BUSINESS_ID}"  
- newDate: "${tomorrowStr}"
- newWindow: "${targetWindow}"

Do NOT use bookingId - leave it empty and the system will find it.
Do NOT call any other tool. ONLY call rescheduleBooking.`,
        messages: [
            { role: 'user' as const, content: `Reschedule booking to ${targetWindow}` },
        ],
        tools: {
            rescheduleBooking: receptionistTools.rescheduleBooking,
        },
        toolChoice: { type: 'tool', toolName: 'rescheduleBooking' },
    });
    
    const retryToolCalls = retryResult.steps.flatMap(s => s.toolCalls || []);
    const retryCalledReschedule = retryToolCalls.some(tc => tc.toolName === 'rescheduleBooking');
    
    console.log(`   Retry tools: ${retryToolCalls.map(tc => tc.toolName).join(', ') || 'none'}`);
    
    // Verify DB updated
    const { data: updatedBooking } = await supabase
        .from('bookings')
        .select('slot_time')
        .eq('id', booking.id)
        .single();
    
    await supabase.from('bookings').delete().eq('id', booking.id);
    
    if (retryCalledReschedule && updatedBooking?.slot_time === 'afternoon') {
        console.log('   ✅ PASS: Retry mechanism worked!');
        return true;
    } else if (retryCalledReschedule) {
        console.log('   ⚠️ Reschedule called but DB not updated');
        return false;
    } else {
        console.log('   ❌ FAIL: Retry didn\'t call rescheduleBooking');
        return false;
    }
}

async function run() {
    console.log('🧪 RETRY MECHANISM TEST\n');
    console.log('=' .repeat(60));
    
    await cleanup();
    
    const tests = [
        "Can it be afternoon instead?",
        "afternoon instead please", 
        "Change to afternoon",
        "I can't make morning",
        "move it to afternoon",
        "switch to afternoon slot",
    ];
    
    let passed = 0;
    
    for (const msg of tests) {
        console.log(`\n"${msg}"`);
        if (await testRetryMechanism(msg)) passed++;
        await new Promise(r => setTimeout(r, 500));
    }
    
    await cleanup();
    
    console.log('\n' + '=' .repeat(60));
    console.log(`📊 RESULTS: ${passed}/${tests.length} passed`);
}

run().catch(console.error);
