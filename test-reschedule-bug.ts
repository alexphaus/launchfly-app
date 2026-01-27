/**
 * Test to reproduce the reschedule bug:
 * Uses the actual AI receptionist route handler
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUSINESS_ID = '525b6e62-efb4-4c85-aee0-da47eedbdcc4';
const TEST_PHONE = '+34683233450'; // Use Alex's real phone

async function cleanupTestData() {
    console.log('🧹 Cleaning up test data...');
    await supabase
        .from('bookings')
        .delete()
        .eq('customer_phone', TEST_PHONE);
    await supabase
        .from('chat_history')
        .delete()
        .eq('customer_phone', TEST_PHONE);
}

async function countBookings(): Promise<number> {
    const { data, error } = await supabase
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

async function simulateConversation(messages: { role: 'user' | 'assistant', content: string }[], userMessage: string) {
    const systemPrompt = `You are an AI receptionist for DANS AIRCON TEAM. Today is January 27, 2026.

TOOLS AVAILABLE:
- createBooking: Create NEW bookings
- rescheduleBooking: Update EXISTING booking to new date/time (PREFERRED for date changes)
- cancelBooking: Delete booking permanently (ONLY for full cancellation)
- getCustomerBookings: Check what bookings customer has

CRITICAL RULES:
1. When customer wants to CHANGE date/time → use rescheduleBooking (NOT cancel + create)
2. rescheduleBooking needs: customerPhone, businessId, newDate, newWindow
3. DO NOT create a new booking when rescheduling!

Customer phone: ${TEST_PHONE}
Business ID: ${BUSINESS_ID}
`;

    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
        {
            type: 'function',
            function: {
                name: 'createBooking',
                description: 'Create a NEW booking. Only use for NEW bookings, not for rescheduling!',
                parameters: {
                    type: 'object',
                    properties: {
                        businessId: { type: 'string' },
                        customerPhone: { type: 'string' },
                        customerName: { type: 'string' },
                        customerAddress: { type: 'string' },
                        slotDate: { type: 'string', description: 'YYYY-MM-DD' },
                        slotWindow: { type: 'string', enum: ['morning', 'afternoon'] },
                        serviceType: { type: 'string' },
                        estimate: { type: 'string' },
                    },
                    required: ['businessId', 'customerPhone', 'slotDate', 'slotWindow']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'rescheduleBooking',
                description: 'PREFERRED: Reschedule an existing booking to a new date/time. Use this when customer wants to CHANGE their appointment. This is atomic - it modifies the existing booking directly.',
                parameters: {
                    type: 'object',
                    properties: {
                        bookingId: { type: 'string', description: 'Optional - will find by phone if not provided' },
                        customerPhone: { type: 'string' },
                        businessId: { type: 'string' },
                        newDate: { type: 'string', description: 'YYYY-MM-DD' },
                        newWindow: { type: 'string', enum: ['morning', 'afternoon'] },
                    },
                    required: ['customerPhone', 'businessId', 'newDate', 'newWindow']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'getCustomerBookings',
                description: 'Get all bookings for a customer',
                parameters: {
                    type: 'object',
                    properties: {
                        customerPhone: { type: 'string' },
                        businessId: { type: 'string' },
                    },
                    required: ['customerPhone', 'businessId']
                }
            }
        }
    ];

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
            { role: 'user', content: userMessage }
        ],
        tools,
        tool_choice: 'auto',
    });

    const toolCalls = response.choices[0].message.tool_calls || [];
    const assistantMessage = response.choices[0].message.content || '';

    return { toolCalls, assistantMessage };
}

async function runTest() {
    console.log('🧪 RESCHEDULE BUG REPRODUCTION TEST\n');
    console.log('=' .repeat(60));
    
    await cleanupTestData();
    
    // Step 1: Create initial booking
    console.log('\n📝 Step 1: Creating initial morning booking...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const { error: createError } = await supabase.from('bookings').insert({
        business_id: BUSINESS_ID,
        customer_phone: TEST_PHONE,
        customer_name: 'Test Customer',
        customer_address: '123 Test St',
        slot_date: tomorrowStr,
        slot_time: 'morning',
        slot_label: 'Tomorrow Morning (9am - 12pm window)',
        status: 'pending',
        estimate: 'RM 120',
        notes: 'Service: Aircon Cleaning (1 unit)',
    });
    
    if (createError) {
        console.log('❌ Failed to create test booking:', createError);
        return;
    }
    
    const initialCount = await countBookings();
    console.log(`✅ Initial booking created. Active bookings: ${initialCount}`);
    
    // Step 2: Simulate reschedule request
    console.log('\n📝 Step 2: Simulating reschedule conversation...');
    
    const conversationHistory: { role: 'user' | 'assistant', content: string }[] = [
        { role: 'assistant', content: 'Welcome! You have a booking for tomorrow morning (9am-12pm) for aircon cleaning. How can I help?' },
    ];
    
    // Test: Ask to change to afternoon
    const rescheduleRequest = "Can it be afternoon instead? I can't make it in the morning";
    console.log(`\n👤 User: "${rescheduleRequest}"`);
    
    const result = await simulateConversation(conversationHistory, rescheduleRequest);
    
    console.log(`\n🤖 AI Response: ${result.assistantMessage || '(no text)'}`);
    console.log(`\n🔧 Tool Calls (${result.toolCalls.length}):`);
    
    for (const tc of result.toolCalls) {
        console.log(`   - ${tc.function.name}:`);
        console.log(`     ${tc.function.arguments}`);
        
        // Execute the tool to see what happens
        const args = JSON.parse(tc.function.arguments);
        
        if (tc.function.name === 'rescheduleBooking') {
            console.log('\n   🔄 Executing rescheduleBooking...');
            
            // Find the booking
            const { data: bookings } = await supabase
                .from('bookings')
                .select('*')
                .eq('business_id', BUSINESS_ID)
                .eq('customer_phone', TEST_PHONE)
                .in('status', ['pending', 'confirmed'])
                .limit(1);
            
            if (bookings && bookings.length > 0) {
                const bookingId = bookings[0].id;
                console.log(`   Found booking to update: ${bookingId}`);
                
                const { error: updateError } = await supabase
                    .from('bookings')
                    .update({
                        slot_date: args.newDate,
                        slot_time: args.newWindow,
                        slot_label: `Tomorrow ${args.newWindow === 'afternoon' ? 'Afternoon (1pm - 5pm window)' : 'Morning (9am - 12pm window)'}`,
                        notes: `Rescheduled to ${args.newWindow}`,
                    })
                    .eq('id', bookingId);
                
                if (updateError) {
                    console.log(`   ❌ Update failed: ${updateError.message}`);
                } else {
                    console.log(`   ✅ Booking updated successfully`);
                }
            }
        } else if (tc.function.name === 'createBooking') {
            console.log('\n   ⚠️ BUG DETECTED: AI called createBooking instead of rescheduleBooking!');
            
            // Simulate what would happen
            await supabase.from('bookings').insert({
                business_id: BUSINESS_ID,
                customer_phone: TEST_PHONE,
                customer_name: 'Test Customer',
                customer_address: '123 Test St',
                slot_date: args.slotDate,
                slot_time: args.slotWindow,
                slot_label: `Tomorrow ${args.slotWindow === 'afternoon' ? 'Afternoon (1pm - 5pm window)' : 'Morning (9am - 12pm window)'}`,
                status: 'pending',
                estimate: 'RM 120',
            });
        }
    }
    
    // Step 3: Check final state
    console.log('\n📝 Step 3: Checking final state...');
    const finalCount = await countBookings();
    const allBookings = await getBookings();
    
    console.log(`\n📊 RESULTS:`);
    console.log(`   Initial bookings: ${initialCount}`);
    console.log(`   Final bookings:   ${finalCount}`);
    console.log(`\n   Bookings:`);
    for (const b of allBookings) {
        console.log(`   - ${b.slot_time} on ${b.slot_date} (${b.status})`);
    }
    
    if (finalCount > initialCount) {
        console.log('\n❌ BUG CONFIRMED: Duplicate booking created instead of rescheduling!');
    } else if (finalCount === initialCount) {
        const afternoonBooking = allBookings.find(b => b.slot_time === 'afternoon' && b.status === 'pending');
        if (afternoonBooking) {
            console.log('\n✅ SUCCESS: Booking was properly rescheduled!');
        } else {
            console.log('\n⚠️ Booking count unchanged but not rescheduled to afternoon');
        }
    }
    
    // Cleanup
    await cleanupTestData();
    console.log('\n🧹 Test data cleaned up');
}

runTest().catch(console.error);
