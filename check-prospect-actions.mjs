import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

const { data: assistant } = await s
  .from('assistants')
  .select('trigger_config')
  .eq('id', '11595834-4950-4bfe-af18-b651947a9bd5')
  .single();

const rules = assistant.trigger_config?.rules || [];
const prospectRule = rules.find(r => r.event === 'prospect_found');
console.log('Prospect Found Rule - Full Actions:');
prospectRule.actions.forEach((a, i) => {
  console.log(`\nAction ${i}: ${a.type}`);
  console.log('Config:', JSON.stringify(a.config, null, 2));
});
