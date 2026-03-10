// patch-sarah-rules.mjs — Fix duplicate call + update rules in live assistant
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const ASSISTANT_ID = '6a9a084c-4ac4-4df0-a674-efe0ef3a5d7c';

// Load the updated template
const template = JSON.parse(readFileSync('templates/launchfly-sarah-v2.json', 'utf8'));

async function patch() {
  // Get current assistant
  const { data: current, error: fetchErr } = await supabase
    .from('assistants')
    .select('trigger_config, name')
    .eq('id', ASSISTANT_ID)
    .maybeSingle();

  if (fetchErr) {
    console.error('Failed to fetch:', fetchErr.message);
    process.exit(1);
  }

  console.log(`📋 Current assistant: ${current.name}`);
  console.log(`   Rules: ${current.trigger_config?.rules?.length || 0}`);

  // Update with template rules
  const { error: updateErr } = await supabase
    .from('assistants')
    .update({
      trigger_config: template.trigger_config,
      system_prompt: template.system_prompt,
      knowledge_base: template.knowledge_base,
      custom_rules: template.custom_rules,
      tools_enabled: template.tools_enabled,
    })
    .eq('id', ASSISTANT_ID);

  if (updateErr) {
    console.error('Failed to update:', updateErr.message);
    process.exit(1);
  }

  // Verify
  const { data: updated } = await supabase
    .from('assistants')
    .select('trigger_config')
    .eq('id', ASSISTANT_ID)
    .single();

  const rules = updated.trigger_config?.rules || [];
  console.log(`\n✅ Updated! ${rules.length} rules:`);
  for (const r of rules) {
    const actions = r.actions.map(a => a.type).join(' → ');
    const conds = r.conditions?.length ? ` [if ${r.conditions.map(c => `${c.field}=${c.value}`).join(',')}]` : '';
    console.log(`   ${r.enabled ? '✅' : '❌'} ${r.id} (${r.event})${conds}: ${actions}`);
  }

  // Check for duplicate call issue
  const newLeadRule = rules.find(r => r.id === 'rule_lf_new_lead');
  const hasVoiceCall = newLeadRule?.actions.some(a => a.type === 'trigger_voice_call');
  if (hasVoiceCall) {
    console.log('\n⚠️  WARNING: new_lead_created still has trigger_voice_call — duplicate calls possible!');
  } else {
    console.log('\n✅ No duplicate call issue — new_lead_created only tags, external_webhook handles calls');
  }
}

patch();
