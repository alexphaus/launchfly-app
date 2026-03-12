import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const BUSINESS_ID = '06203464-2b76-4468-8d2e-6630ab0ed71a';
const NEW_SCHEDULE_ID = 'scd_6mY53dCvBvqo21zfosSz153dSiyF';

const { data: sarah } = await supabase
  .from('assistants')
  .select('id, trigger_config')
  .eq('business_id', BUSINESS_ID)
  .eq('active', true)
  .single();

const rules = sarah.trigger_config.rules.map(r => {
  if (r.event === 'daily_schedule' && r.scheduleConfig) {
    r.scheduleConfig.qstashScheduleId = NEW_SCHEDULE_ID;
    console.log('Updated scheduleConfig.qstashScheduleId ->', NEW_SCHEDULE_ID);
  }
  return r;
});

const { error } = await supabase
  .from('assistants')
  .update({ trigger_config: { ...sarah.trigger_config, rules } })
  .eq('id', sarah.id);

console.log(error ? 'ERROR: ' + error.message : 'Done - Sarah updated');
