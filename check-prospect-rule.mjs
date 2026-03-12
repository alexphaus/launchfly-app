import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const assistantId = '11595834-4950-4bfe-af18-b651947a9bd5';

const { data: assistant } = await supabase
  .from('assistants')
  .select('trigger_config')
  .eq('id', assistantId)
  .single();

const config = assistant.trigger_config;
const rule = config.rules.find(r => r.id === 'rule_lf_prospect_outreach');

console.log('=== prospect_found rule ===');
console.log(JSON.stringify(rule, null, 2));
