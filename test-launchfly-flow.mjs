import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LAUNCHFLY_ASSISTANT_ID = '5e953cfa-db33-4958-8af2-89c7eeb7a9dd';
const LAUNCHFLY_BUSINESS_ID = '06203464-2b76-4468-8d2e-6630ab0ed71a';

async function inspectConfig() {
  console.log('\n========== LAUNCHFLY ASSISTANT CONFIG ==========\n');
  
  const { data: ast, error } = await sb
    .from('assistants')
    .select('id, name, business_id, system_prompt, knowledge_base, tools_enabled, tone, goal, trigger_config')
    .eq('id', LAUNCHFLY_ASSISTANT_ID)
    .single();

  if (error) { console.error('Error fetching assistant:', error); return null; }

  console.log('Name:', ast.name);
  console.log('Business:', ast.business_id);
  console.log('Tone:', ast.tone, '| Goal:', ast.goal);
  console.log('Tools:', JSON.stringify(ast.tools_enabled));
  console.log('System prompt length:', ast.system_prompt?.length || 0);
  console.log('KB length:', ast.knowledge_base?.length || 0);

  console.log('\n--- Automation Rules ---');
  const rules = ast.trigger_config?.rules || [];
  if (rules.length === 0) {
    console.log('⚠️  NO RULES CONFIGURED');
  }
  rules.forEach((r, i) => {
    console.log(`\n[Rule ${i}] event=${r.event}  condition=${JSON.stringify(r.condition || {})}`);
    (r.actions || []).forEach((a, j) => {
      console.log(`  action[${j}]: ${a.type}  config=${JSON.stringify(a.config || {})}`);
    });
  });

  console.log('\n--- Business ---');
  const { data: biz } = await sb
    .from('businesses')
    .select('id, name, owner_name, phone, whatsapp_number')
    .eq('id', LAUNCHFLY_BUSINESS_ID)
    .single();
  console.log(JSON.stringify(biz, null, 2));

  console.log('\n--- System Prompt (first 500 chars) ---');
  console.log(ast.system_prompt?.substring(0, 500) || '(empty)');

  return ast;
}

async function checkEnvVars() {
  console.log('\n========== ENV VARS CHECK ==========\n');
  const vars = [
    'RETELL_API_KEY', 'RETELL_AGENT_ID', 'RETELL_FROM_NUMBER',
    'TWILIO_WHATSAPP_NUMBER', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN',
    'OPENAI_API_KEY', 'QSTASH_TOKEN',
    'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'
  ];
  vars.forEach(v => {
    const val = process.env[v];
    const display = val ? `✅ set (${val.substring(0, 8)}...)` : '❌ MISSING';
    console.log(`  ${v}: ${display}`);
  });
}

async function checkRecentLeads() {
  console.log('\n========== RECENT LEADS (quote_leads) ==========\n');
  const { data: leads } = await sb
    .from('quote_leads')
    .select('id, customer_name, phone, status, job_type, call_outcome, created_at')
    .eq('business_id', LAUNCHFLY_BUSINESS_ID)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (!leads?.length) {
    console.log('No leads found for Launchfly');
  } else {
    leads.forEach(l => {
      console.log(`  [${l.status}] ${l.customer_name} ${l.phone} - ${l.job_type} - outcome: ${l.call_outcome || 'n/a'} - ${l.created_at}`);
    });
  }
}

async function checkRecentChatHistory() {
  console.log('\n========== RECENT CHAT HISTORY ==========\n');
  const { data: chats } = await sb
    .from('chat_history')
    .select('id, business_id, customer_phone, role, content, created_at')
    .eq('business_id', LAUNCHFLY_BUSINESS_ID)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (!chats?.length) {
    console.log('No chat history for Launchfly');
  } else {
    chats.forEach(c => {
      const content = c.content?.substring(0, 80) || '';
      console.log(`  [${c.role}] ${c.customer_phone} - ${content}... - ${c.created_at}`);
    });
  }
}

// Run all checks
await inspectConfig();
await checkEnvVars();
await checkRecentLeads();
await checkRecentChatHistory();

console.log('\n========== DONE ==========\n');
