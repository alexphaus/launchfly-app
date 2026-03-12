import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const BUSINESS_ID = '06203464-2b76-4468-8d2e-6630ab0ed71a';

const { data: sarah } = await supabase
  .from('assistants')
  .select('id, trigger_config')
  .eq('business_id', BUSINESS_ID)
  .eq('active', true)
  .single();

if (!sarah) { console.log('Sarah not found'); process.exit(1); }

const rules = sarah.trigger_config.rules.map(r => {
  if (r.id === 'rule_lf_prospect_outreach' && r.event === 'prospect_found') {
    r.actions = [
      // 1. Stagger outreach (15min apart, max 15/day)
      {
        type: 'stagger_outreach',
        config: { staggerMaxPerDay: 15, staggerIntervalMin: 15 },
      },
      // 2. AI qualifies — stop if NO
      {
        type: 'ask_ai',
        config: {
          aiPrompt: 'Business: {customerName}\nCategory: {metadata.category}\nRating: {metadata.rating} ({metadata.reviews} reviews)\nLocation: {metadata.city}\n\nShould we reach out to this business?',
          stopOnNo: true,
        },
      },
      // 3. Opener WhatsApp
      {
        type: 'send_whatsapp',
        config: {
          message: 'Hey boss — quick question. When you send out a renovation quote, do you usually follow up yourself or just wait for them to get back to you?',
        },
      },
      // 4. Wait 3h (catch them at lunch break)
      {
        type: 'delay',
        config: { delayHours: 3 },
      },
      // 5. AI follow-up #1
      {
        type: 'ai_followup',
        config: {},
      },
      // 6. Wait 24h
      {
        type: 'delay',
        config: { delayHours: 24 },
      },
      // 7. AI follow-up #2
      {
        type: 'ai_followup',
        config: {},
      },
      // 8. Wait 48h
      {
        type: 'delay',
        config: { delayHours: 48 },
      },
      // 9. Closing shot — hard value prop with CTA
      {
        type: 'send_whatsapp',
        config: {
          message: "Last thing from me — one of our roofers recovered a $22K job in his first week using Launchfly. If you want to see how it works, just reply START for a 60-second demo. If not, no worries at all 👊",
        },
      },
    ];
    console.log('Updated prospect_found rule with 9-step sequence');
  }
  return r;
});

const { error } = await supabase
  .from('assistants')
  .update({ trigger_config: { ...sarah.trigger_config, rules } })
  .eq('id', sarah.id);

if (error) {
  console.log('ERROR:', error.message);
} else {
  console.log('Done — Sarah prospect_found updated');
  console.log('\nNew sequence:');
  console.log('  1. stagger_outreach (15min gaps, 15/day cap)');
  console.log('  2. ask_ai (gate — stop if NO)');
  console.log('  3. send_whatsapp (opener)');
  console.log('  4. delay 3h');
  console.log('  5. ai_followup #1');
  console.log('  6. delay 24h');
  console.log('  7. ai_followup #2');
  console.log('  8. delay 48h');
  console.log('  9. send_whatsapp (closing shot)');
}
