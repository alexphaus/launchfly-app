/**
 * Quick test for slot selection booking
 */
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { receptionistTools } from './src/lib/ai-receptionist/tools';
import { generateSystemPrompt, type BusinessContext, type CustomerContext } from './src/lib/ai-receptionist/system-prompt';

const TEST_BUSINESS_ID = 'e8fc5a62-19df-473f-b275-d159e563050e';

async function testSlotSelection() {
    const businessContext: BusinessContext = {
        id: TEST_BUSINESS_ID,
        name: 'Cool Air Services',
        niche: 'Aircon Service',
        currency: 'RM',
        cleaningPrice: 120,
        repairInspectionFee: 80,
        warrantyDays: 30,
        serviceInterval: 90,
        ownerName: 'Ahmad',
        ownerPhone: '+60111111111',
        operatingHours: '9am - 5pm',
    };
    
    const customerContext: CustomerContext = {
        isReturning: true,
        warrantyActive: true,
        name: 'John Doe',
        id: 'test-customer-id',
        address: '123 Main St',
    };
    
    const systemPrompt = generateSystemPrompt(businessContext, customerContext);
    
    // Add context message like v2 route does
    const contextMessage = `
[SYSTEM CONTEXT - USE THESE VALUES WHEN CALLING TOOLS]
- Customer Phone: +60199999999
- Business ID: ${TEST_BUSINESS_ID}
- Customer ID: test-customer-id
- Customer Name: John Doe

⚠️ CRITICAL: When customer selects a time slot, call createBooking IMMEDIATELY with:
  businessId: "${TEST_BUSINESS_ID}"
  customerId: "test-customer-id"
  customerPhone: "+60199999999"
  customerName: "John Doe"
  address: (the address they provided in conversation)
  date: (YYYY-MM-DD from the selected slot)
  window: "morning" or "afternoon"
  serviceType: (e.g., "Aircon Cleaning (2 units)")
  estimateAmount: (the price as a number, e.g., 240)
  currency: "RM"

⚠️ SLOT SELECTION TRIGGERS:
The customer has CONFIRMED when they reply with ANY of these:
- "1", "2", "3", "4" (number selection)
- "tomorrow", "today", "Wednesday", "Friday" etc (day name)  
- "morning", "afternoon" (time window)
- "first one", "second one", "the first", "option 1"
- "yes", "ok", "sounds good" (after you showed slots)
When you see these replies AFTER showing available slots → CALL createBooking!
`;
    
    // Full booking flow conversation
    const history = [
        { role: 'user' as const, content: 'Hi, I want to book cleaning' },
        { role: 'assistant' as const, content: 'How many aircon units need cleaning?' },
        { role: 'user' as const, content: '2 units' },
        { role: 'assistant' as const, content: 'Got it! 2 units = RM 240. What is your address for the service?' },
        { role: 'user' as const, content: '123 Jalan Ampang, Unit 12-3, Kuala Lumpur' },
        { role: 'assistant' as const, content: `Thanks! 📍 Here are the available slots:\n1️⃣ Tomorrow Morning (9am-12pm) - 2026-01-28\n2️⃣ Tomorrow Afternoon (1pm-5pm) - 2026-01-28\n3️⃣ Wednesday Morning - 2026-01-29\n4️⃣ Wednesday Afternoon - 2026-01-29\n\nWhich one works for you?` },
    ];
    
    console.log('\n📊 Testing slot selection "1":');
    
    const result = await generateText({
        model: openai('gpt-4o-mini'),
        system: systemPrompt + '\n\n' + contextMessage,
        messages: [
            ...history,
            { role: 'user' as const, content: '1' }, // Select first slot
        ],
        tools: receptionistTools,
        maxSteps: 5,
        toolChoice: 'auto',
    });
    
    const toolCalls = result.steps.flatMap(s => s.toolCalls || []);
    console.log('Response:', result.text?.substring(0, 300));
    console.log('Tools called:', toolCalls.map(t => t.toolName));
    console.log('createBooking called?', toolCalls.some(t => t.toolName === 'createBooking'));
    
    if (toolCalls.some(t => t.toolName === 'createBooking')) {
        const bookingCall = toolCalls.find(t => t.toolName === 'createBooking');
        console.log('createBooking args:', JSON.stringify((bookingCall as any).args, null, 2));
    }
    
    // Test human escalation
    console.log('\n\n📊 Testing human escalation:');
    
    const humanResult = await generateText({
        model: openai('gpt-4o-mini'),
        system: systemPrompt + '\n\n' + contextMessage,
        messages: [
            { role: 'user' as const, content: 'I need to speak to a human please' },
        ],
        tools: receptionistTools,
        maxSteps: 5,
        toolChoice: 'auto',
    });
    
    const humanToolCalls = humanResult.steps.flatMap(s => s.toolCalls || []);
    console.log('Response:', humanResult.text?.substring(0, 300));
    console.log('Tools called:', humanToolCalls.map(t => t.toolName));
    console.log('notifyOwner called?', humanToolCalls.some(t => t.toolName === 'notifyOwner'));
}

testSlotSelection().catch(console.error);
