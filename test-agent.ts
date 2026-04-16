import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { executeAgentTask } from './src/lib/agent/runner';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // get a user/business to attach it to.
  const { data: b } = await supabase.from('businesses').select('id, owner_phone').limit(1).single();
  if (!b) throw new Error('No business found');

  const { data: task, error } = await supabase.from('agent_tasks').insert({
    business_id: b.id,
    goal: "Can you research about competition is it crowded what we selling and what unique differentiator can we add",
    status: 'pending',
    messages: [] 
  }).select('id').single();

  if (error || !task) throw error;
  console.log('Created task', task.id);
  
  while (true) {
    const res = await executeAgentTask(task.id);
    console.log('Result:', res);
    if (!res.continue) break;
  }
}
main().catch(console.error);
