import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const token = process.env.QSTASH_TOKEN;
const url = process.env.QSTASH_URL;

// Check QStash schedules
const res = await fetch(`${url}/v2/schedules`, { headers: { Authorization: `Bearer ${token}` } });
const schedules = await res.json();
console.log('QStash schedules:', schedules.length);
schedules.forEach(s => console.log(`  ${s.scheduleId} | cron=${s.cron} | dest=${(s.destination || '').substring(0, 80)}`));

// Check DB config
const { data: a } = await supabase.from('assistants').select('trigger_config').eq('id', '11595834-4950-4bfe-af18-b651947a9bd5').single();
const rule = a.trigger_config.rules.find(r => r.id === 'rule_lf_daily_prospecting');
console.log('\nDB schedule:', JSON.stringify(rule.scheduleConfig));
console.log('DB search:', JSON.stringify(rule.actions[0].config));
