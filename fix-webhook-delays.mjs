import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data } = await s.from('assistants').select('trigger_config').eq('id', '11595834-4950-4bfe-af18-b651947a9bd5').single();
const tc = typeof data.trigger_config === 'string' ? JSON.parse(data.trigger_config) : data.trigger_config;

// Fix external_webhook delays: 0.1h (6min) → 3h and 24h
const ewRule = tc.rules.find(r => r.event === 'external_webhook');
if (ewRule) {
  let delayIdx = 0;
  const newDelays = [3, 24]; // 3 hours, then 24 hours
  for (const action of ewRule.actions) {
    if (action.type === 'delay' && action.config) {
      const oldVal = action.config.delayHours;
      action.config.delayHours = newDelays[delayIdx] || 24;
      console.log(`  delay ${delayIdx + 1}: ${oldVal}h → ${action.config.delayHours}h`);
      delayIdx++;
    }
  }
}

// Save back
const { error } = await s.from('assistants')
  .update({ trigger_config: tc })
  .eq('id', '11595834-4950-4bfe-af18-b651947a9bd5');

if (error) console.error('Error:', error);
else console.log('\n✅ external_webhook delays updated');

// Verify
const { data: verify } = await s.from('assistants').select('trigger_config').eq('id', '11595834-4950-4bfe-af18-b651947a9bd5').single();
const vtc = typeof verify.trigger_config === 'string' ? JSON.parse(verify.trigger_config) : verify.trigger_config;
const vRule = vtc.rules.find(r => r.event === 'external_webhook');
console.log('\nVerified external_webhook chain:');
vRule.actions.forEach((a, i) => {
  const info = a.type === 'delay' ? ` (${a.config.delayHours}h)` : '';
  console.log(`  ${i + 1}. ${a.type}${info}`);
});
