const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const rules = [
  // ─── Rule 1: Lead comes in → Call them ───
  {
    id: 'rule_ext_webhook',
    event: 'external_webhook',
    enabled: true,
    conditions: [],
    actions: [
      { type: 'trigger_voice_call', config: { retellAgentId: 'agent_8d13aac0c3b22060d0ab23c442', jobType: 'Sales Prospect' } },
    ],
  },

  // ─── Rule 2: Call went well (interested) → Demo + follow-up sequence ───
  {
    id: 'rule_call_interested',
    event: 'call_completed',
    enabled: true,
    conditions: [{ field: 'metadata.outcome', op: 'equals', value: 'interested' }],
    actions: [
      // Immediate: Send demo prompt
      { type: 'send_whatsapp', config: { message: "Hey {customerName} 👋 Sarah here. Your 30-sec demo is ready — reply START to see what your homeowners receive after a quote." } },
      // 10 min nudge
      { type: 'delay', config: { delayHours: 0.17 } },
      { type: 'send_whatsapp', config: { message: "Still there {customerName}? Just tap START and I'll walk you through the demo in 30 seconds 👇" } },
      // 4 hour follow-up
      { type: 'delay', config: { delayHours: 4 } },
      { type: 'send_whatsapp', config: { message: "Hey {customerName}, quick update — we just helped a roofer recover a $6,200 job that went cold for 3 weeks. His quote follow-up bot caught it on Day 2.\n\nReply START whenever you're ready to see how it works 🔧" } },
      // 24 hour follow-up
      { type: 'delay', config: { delayHours: 24 } },
      { type: 'send_whatsapp', config: { message: "Hey {customerName} — just circling back. We're onboarding 10 contractors this week and spots are filling up.\n\nIf you want your follow-up system live by tomorrow, reply START and I'll set it up in 10 minutes. $150/mo, cancel anytime." } },
      // 72 hour breakup
      { type: 'delay', config: { delayHours: 72 } },
      { type: 'send_whatsapp', config: { message: "Last one from me {customerName} — I'll assume the timing isn't right.\n\nIf you ever want to stop losing quotes to competitors who follow up faster, just text me START and I'll have your system ready same day. Take care! 👊" } },
    ],
  },

  // ─── Rule 3: No answer → Intro + nurture sequence ───
  {
    id: 'rule_call_no_answer',
    event: 'call_completed',
    enabled: true,
    conditions: [{ field: 'metadata.outcome', op: 'equals', value: 'no_answer' }],
    actions: [
      // Immediate: Intro message
      { type: 'send_whatsapp', config: { message: "Hey {customerName} 👋 Sarah here from Launchfly. Tried calling — no worries!\n\nI have a quick 30-sec demo that shows how contractors are auto-closing more quotes. Reply START to check it out!" } },
      // 2 hour nudge
      { type: 'delay', config: { delayHours: 2 } },
      { type: 'send_whatsapp', config: { message: "Hey {customerName}, just a quick follow-up. One of our HVAC guys recovered 3 jobs worth $14K in his first month — all quotes he thought were dead.\n\nReply START to see how it works 👇" } },
      // 24 hour social proof
      { type: 'delay', config: { delayHours: 24 } },
      { type: 'send_whatsapp', config: { message: "{customerName}, most contractors lose 40-60% of their quotes to ghosting. Our bot follows up automatically so you don't have to.\n\nTakes 10 min to connect, $150/mo, cancel anytime. Reply START for a quick demo!" } },
      // 72 hour breakup
      { type: 'delay', config: { delayHours: 72 } },
      { type: 'send_whatsapp', config: { message: "Last message from me {customerName}. If you ever want to stop losing quotes, just text START and I'll set you up same day.\n\nGood luck out there! 🔧" } },
    ],
  },

  // ─── Rule 4: Not interested → Mark and move on ───
  {
    id: 'rule_call_not_interested',
    event: 'call_completed',
    enabled: true,
    conditions: [{ field: 'metadata.outcome', op: 'equals', value: 'not_interested' }],
    actions: [
      { type: 'update_status', config: { status: 'not_interested' } },
    ],
  },

  // ─── Rule 5: Any inbound WhatsApp → AI responds ───
  {
    id: 'rule_inbound_wa',
    event: 'inbound_whatsapp',
    enabled: true,
    conditions: [],
    actions: [
      { type: 'ai_response', config: {} },
    ],
  },
];

sb.from('assistants')
  .update({ trigger_config: { rules } })
  .eq('id', '5e953cfa-db33-4958-8af2-89c7eeb7a9dd')
  .then(r => {
    if (r.error) { console.error('ERROR:', r.error); process.exit(1); }
    console.log(`Done! ${rules.length} rules, ${rules.reduce((n, r) => n + r.actions.length, 0)} total actions`);
    process.exit(0);
  });
