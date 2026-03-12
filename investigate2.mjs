import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await s.from('assistants').select('trigger_config').eq('id', '11595834-4950-4bfe-af18-b651947a9bd5').single();
const tc = data.trigger_config;
const config = typeof tc === 'string' ? JSON.parse(tc) : tc;
const rules = config?.rules || [];

// Find prospect_found rule  
const pf = rules.find(r => r.event === 'prospect_found');
if (pf) {
  console.log('=== prospect_found action chain ===');
  pf.actions.forEach((a, i) => {
    console.log(`  ${i+1}. ${a.type}`);
    if (a.config) console.log(`     config: ${JSON.stringify(a.config)}`);
  });
}

// Find user_inactive rule
const ui = rules.find(r => r.event === 'user_inactive');
if (ui) {
  console.log('\n=== user_inactive action chain ===');
  ui.actions.forEach((a, i) => {
    console.log(`  ${i+1}. ${a.type}`);
    if (a.config) console.log(`     config: ${JSON.stringify(a.config)}`);
  });
}

// Count total QStash resume messages per lead
// For prospect_found: stagger → ask_ai → send_whatsapp → delay → ai_followup → delay → ai_followup → delay → send_whatsapp
// Each delay creates a QStash resume. So per lead: at least 3 delay resumes + the stagger resume = 4 QStash messages
// With old stagger bug (all at same position), PLUS the earlier runs...

// Also check: how many runs happened today?
const ext = rules.find(r => r.event === 'external_webhook');
if (ext) {
  console.log('\n=== external_webhook action chain ===');
  ext.actions.forEach((a, i) => {
    console.log(`  ${i+1}. ${a.type}`);
    if (a.config) console.log(`     config: ${JSON.stringify(a.config)}`);
  });
}

// Calculate total QStash messages per prospect_found
let totalResumes = 0;
let delays = [];
for (const a of pf?.actions || []) {
  if (a.type === 'delay') {
    totalResumes++;
    delays.push(a.config?.delayMinutes || '?');
  }
}
// stagger_outreach also creates a resume
totalResumes++;

console.log(`\n=== QStash messages per lead ===`);
console.log(`  Stagger resume: 1`);
console.log(`  Delay resumes: ${delays.length} (delays: ${delays.join('m, ')}m)`);
console.log(`  Total QStash publishes per lead: ${totalResumes + 1}`);
console.log(`  For 15 leads: ${(totalResumes + 1) * 15} QStash messages`);
console.log(`  For 3 test runs of ~15 leads: ${(totalResumes + 1) * 15 * 3} QStash messages`);
