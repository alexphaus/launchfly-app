import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  const newAssistant = JSON.parse(fs.readFileSync('alex-sales-ai.json', 'utf8'));

  // The usual test business we're using
  const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';

  const { data: assistant, error } = await supabase
    .from('assistants')
    .select('*')
    .eq('business_id', businessId)
    .single();

  if (error) {
    console.error('Error finding assistant:', error);
    process.exit(1);
  }

  console.log(`Found active assistant: ${assistant.name} (ID: ${assistant.id})`);

  const { error: updateError } = await supabase
    .from('assistants')
    .update({
      name: newAssistant.name,
      system_prompt: newAssistant.system_prompt,
      tone: newAssistant.tone,
      custom_rules: newAssistant.custom_rules,
      knowledge_base: newAssistant.knowledge_base,
      trigger_config: newAssistant.trigger_config
    })
    .eq('id', assistant.id);

  if (updateError) {
    console.error('Failed to update assistant:', updateError);
  } else {
    console.log('✅ Assistant updated to Alex persona successfully in database!');
  }
}

main();