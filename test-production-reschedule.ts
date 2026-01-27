/**
 * PRODUCTION-LIKE RESCHEDULE TEST
 * ================================
 * Tests reschedule with minimal context (like production)
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
const TEST_PHONE = '+1999PRODTEST';

const VARIATIONS = [
    "Can it be afternoon instead?",
    "afternoon instead please",
    "Change to afternoon",
    "I can't make morning",
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

async function testProduction(message: string): Promise<boolean> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Create booking
    const { data: booking } = await supabase.from('bookings').insert({
        business_id: BUSINESS_ID,
        customer_phone: TEST_PHONE,
        customer_name: 'Prod Tester',
        customer_address: '123 Test Ave',
        slot_date: tomorrowStr,
        slot_time: 'morning',
        slot_label: 'Tomorrow Morning (9am - 12pm window)',
        status: 'pending',
        estimate: 'RM 120',
    }).select().single();
    
    if (!booking) return false;
    
    const businessContext = getMockBusinessContext();
    const customerContext: CustomerContext = {
        isReturning: true,
        warrantyActive: true,
        name: 'Prod Tester',
    };
    
    // Use MINIMAL context like production
    const systemPrompt = generateSystemPrompt(businessContext, customerContext);
    const contextMessage = `
[SYSTEM CONTEXT]
- Customer Phone: ${TEST_PHONE}
- Business ID: ${BUSINESS_ID}
- Customer has existing booking for tomorrow morning
`;
    
    // Simulate conversation history (like production would have)
    const history = [
        { role: 'assistant' as const, content: 'You have a booking for tomorrow morning (9am-12pm) for aircon cleaning at 123 Test Ave. How can I help?' },
    ];
    
    try {
        const result = await generateText({
            model: openai('gpt-4o-mini'),
            system: systemPrompt + contextMessage,
            messages: [...history, { role: 'user' as const, content: message }],
            tools: receptionistTools,
            maxSteps: 5,
        });
        
        const toolCalls = result.steps.flatMap(s => s.toolCalls || []);
        
        console.log(`   Tools: ${toolCalls.map(tc => tc.toolName).join(', ') || 'none'}`);
        
        // Check if called rescheduleBooking
        const calledReschedule = toolCalls.some(tc => tc.toolName === 'rescheduleBooking');
        const calledCreate = toolCalls.some(tc => tc.toolName === 'createBooking');
        
        // Cleanup
        await supabase.from('bookings').delete().eq('id', booking.id);
        
        if (calledReschedule) {
            console.log(`   ✅ PASS: rescheduleBooking called`);
            return true;
        } else if (calledCreate) {
            console.log(`   ❌ FAIL: createBooking called instead!`);
            return false;
        } else {
            console.log(`   ❌ FAIL: No booking tool called`);
            // This is where production retry would kick in
            return false;
        }
    } catch (err) {
        console.log(`   ❌ ERROR: ${(err as Error).message}`);
        await supabase.from('bookings').delete().eq('id', booking.id);
        return false;
    }
}

async function run() {
    console.log('🧪 PRODUCTION-LIKE RESCHEDULE TEST\n');
    console.log('=' .repeat(60));
    
    await cleanup();
    
    let passed = 0;
    
    for (const msg of VARIATIONS) {
        console.log(`\n"${msg}"`);
        if (await testProduction(msg)) passed++;
        await new Promise(r => setTimeout(r, 300));
    }
    
    await cleanup();
    
    console.log('\n' + '=' .repeat(60));
    console.log(`📊 RESULTS: ${passed}/${VARIATIONS.length} passed`);
    
    if (passed < VARIATIONS.length) {
        console.log('\n⚠️ Some tests failed - but production retry mechanism should catch these!');
    }
}

run().catch(console.error);
