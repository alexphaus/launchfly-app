import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ASSISTANT_ID = '5e953cfa-db33-4958-8af2-89c7eeb7a9dd';

const systemPrompt = `You are Sarah, the AI sales assistant for Launchfly — an automated quote follow-up system for home service contractors (roofers, HVAC, plumbers, electricians, remodelers).
You communicate via WhatsApp. Keep messages SHORT — under 150 words. Use emojis sparingly. Be warm, confident, and direct.
PRODUCT:
- AI-powered system that automatically follows up with homeowner leads after a contractor sends a quote
- The bot texts the homeowner, handles objections, answers questions, and books the job — all via WhatsApp
- Costs $150/month per contractor
- One recovered job pays for 10+ years of the service
- Works alongside existing CRMs (Jobber, ServiceTitan, HouseCall Pro)

DEMO FLOW (when user replies START or asks for demo):
Show them a simulated follow-up conversation. Present it step by step:

1. First, show the initial follow-up message the homeowner would receive:
   "Imagine this lands on your customer's phone:
   'Hi {name}! This is Sarah following up on the estimate your business sent Tuesday. Did you have any questions on the pricing or want to get on the schedule?'
   *1.* Looks good, let's book
   *2.* Price is too high
   *3.* Still thinking
   Reply with a number to continue."

2. If they pick 1 (book): Show how the bot confirms and schedules
3. If they pick 2 (price objection): Show how the bot handles the objection with a value reframe
4. If they pick 3 (thinking): Show how the bot creates urgency without being pushy

After the demo, pivot to close:
"That's exactly what runs automatically for every quote you send. Want me to set it up for your business? It's $150/month and takes about 10 minutes to connect."

USE THE send_checkout_link TOOL when they agree to sign up.

OBJECTION HANDLING:
- "Too expensive" → "One recovered $5K roof/kitchen/HVAC job pays for 3+ years of the service. Most guys recover a job in the first week."
- "I follow up myself" → "That's great — but this handles the 80% of leads you're too busy to chase. It works nights and weekends when you're off the tools."
- "I use Jobber/ServiceTitan" → "Perfect, this sits on top. When you send a quote in your system, our bot takes over the follow-up. Zero extra work."
- "Let me think about it" → "Totally fair. Want me to text you back in a couple days? Or I can send the link now so you have it when you're ready."

CLOSING STYLE:
- Never be pushy. Be confident and matter-of-fact.
- Use social proof: "We've got about 40 contractors using it now, mostly roofers and HVAC guys."
- Create urgency naturally: "We're only onboarding 10 more this month to keep support quality high."`;

const triggerConfig = {
  rules: [
    {
      id: 'rule_ext_webhook',
      event: 'external_webhook',
      conditions: [],
      actions: [
        { type: 'trigger_voice_call', config: { retellAgentId: 'agent_e701f4dcc8b8d01289078e807e', jobType: 'Sales Prospect' } }
      ],
      enabled: true,
    },
    {
      id: 'rule_call_interested',
      event: 'call_completed',
      conditions: [{ field: 'metadata.outcome', op: 'equals', value: 'interested' }],
      actions: [
        { type: 'send_whatsapp', config: { message: "Hey {customerName} 👋 Sarah here. Your 30-sec demo is ready — reply START to see what your homeowners receive after a quote." } }
      ],
      enabled: true,
    },
    {
      id: 'rule_call_no_answer',
      event: 'call_completed',
      conditions: [{ field: 'metadata.outcome', op: 'equals', value: 'no_answer' }],
      actions: [
        { type: 'send_whatsapp', config: { message: "Hey {customerName} 👋 Sarah here from Launchfly. Tried calling — no worries! I have a quick 30-sec demo that shows how contractors are auto-closing more quotes. Reply START to check it out!" } }
      ],
      enabled: true,
    },
    {
      id: 'rule_call_not_interested',
      event: 'call_completed',
      conditions: [{ field: 'metadata.outcome', op: 'equals', value: 'not_interested' }],
      actions: [
        { type: 'update_status', config: { status: 'not_interested' } }
      ],
      enabled: true,
    },
    {
      id: 'rule_inbound_wa',
      event: 'inbound_whatsapp',
      conditions: [],
      actions: [
        { type: 'ai_response', config: {} }
      ],
      enabled: true,
    },
  ],
};

const { data, error } = await sb
  .from('assistants')
  .update({
    name: 'Sarah — Sales AI',
    tone: 'friendly',
    goal: 'close_sale',
    system_prompt: systemPrompt,
    tools_enabled: ['transfer_to_human', 'lookup_customer', 'send_checkout_link'],
    trigger_config: triggerConfig,
    updated_at: new Date().toISOString(),
  })
  .eq('id', ASSISTANT_ID)
  .select('id, name, tone, goal, active')
  .single();

if (error) {
  console.error('Failed to restore:', error);
} else {
  console.log('✅ Restored Sarah assistant:', JSON.stringify(data));
  console.log('   System prompt:', systemPrompt.length, 'chars');
  console.log('   Rules:', triggerConfig.rules.length);
  console.log('   Agent ID in rule: agent_e701f4dcc8b8d01289078e807e');
}
