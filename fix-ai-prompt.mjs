import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

// Update the ask_ai prompt in the prospect_found rule to be smarter about missing metadata
const { data: assistant } = await s
  .from('assistants')
  .select('id, trigger_config')
  .eq('id', '11595834-4950-4bfe-af18-b651947a9bd5')
  .single();

const rules = assistant.trigger_config.rules;
const prospectRule = rules.find(r => r.event === 'prospect_found');
const askAiAction = prospectRule.actions.find(a => a.type === 'ask_ai');

console.log('Current prompt:', askAiAction.config.aiPrompt);

// Update the prompt to be more practical — default to YES unless terrible
askAiAction.config.aiPrompt = `Business: {customerName}
Category: {metadata.category}
Rating: {metadata.rating} ({metadata.reviews} reviews)
Location: {metadata.city}

Should we reach out to this business? Default to YES if they have a phone number and are in a related industry. Only say NO if they are clearly unrelated, have terrible reviews (below 2 stars), or are a direct competitor.`;

console.log('\nUpdated prompt:', askAiAction.config.aiPrompt);

await s.from('assistants').update({ trigger_config: assistant.trigger_config }).eq('id', assistant.id);
console.log('\nSaved to DB!');
