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
  const assistantId = '11595834-4950-4bfe-af18-b651947a9bd5';

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
    .eq('id', assistantId);

  if (updateError) {
    console.error('Failed to update assistant:', updateError);
  } else {
    console.log('✅ Assistant updated to Alex persona successfully in database!');
  }
}
main();