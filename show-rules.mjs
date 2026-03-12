import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await s.from('assistants').select('trigger_config').eq('id', '11595834-4950-4bfe-af18-b651947a9bd5').single();
const tc = data.trigger_config;
const config = typeof tc === 'string' ? JSON.parse(tc) : tc;
const rules = config?.rules || [];
console.log(`Total rules: ${rules.length}\n`);
for (const r of rules) {
  const chain = r.actions?.map(a => {
    let label = a.type;
    if (a.config?.delayMinutes) label += `(delay:${a.config.delayMinutes}m)`;
    if (a.config?.staggerIntervalMin) label += `(interval:${a.config.staggerIntervalMin}m)`;
    if (a.config?.staggerMaxPerDay) label += `(max:${a.config.staggerMaxPerDay}/day)`;
    return label;
  }).join(' → ');
  console.log(`[${r.event}] → ${chain}`);
}
