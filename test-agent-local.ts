// Local test: simulates QStash continuation loop
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local', override: true });
import { createClient } from '@supabase/supabase-js';
import { executeAgentTask } from './src/lib/agent/runner';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

const BUSINESS_ID = '06203464-2b76-4468-8d2e-6630ab0ed71a'; // Launchfly

async function main() {
  console.log(`Using business ${BUSINESS_ID}`);

  // Create the task directly in DB (skip QStash)
  const taskId = crypto.randomUUID();
  const { error: insertErr } = await supabase.from('agent_tasks').insert({
    id: taskId,
    business_id: BUSINESS_ID,
    goal: 'Can you research about competition is it crowded what we selling and what unique differentiator can we add',
    status: 'pending',
    messages: [],
    steps_used: 0,
    tool_log: [],
    result: null,
  });
  if (insertErr) throw insertErr;
  console.log(`Created task ${taskId}\n`);

  // Simulate QStash continuation loop
  let round = 0;
  const globalStart = Date.now();
  while (true) {
    round++;
    const roundStart = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ROUND ${round} — elapsed ${((Date.now() - globalStart) / 1000).toFixed(1)}s`);
    console.log(`${'='.repeat(60)}`);

    const res = await executeAgentTask(taskId);
    const roundMs = Date.now() - roundStart;
    console.log(`\nRound ${round} result: status=${res.status}, steps=${res.stepsUsed}, took ${(roundMs / 1000).toFixed(1)}s`);

    if (res.status === 'completed') {
      console.log('\n✅ TASK COMPLETED');
      console.log('Result:', res.result?.substring(0, 3000));
      break;
    }
    if (res.status === 'failed') {
      console.log('\n❌ TASK FAILED');
      console.log('Result:', res.result);
      break;
    }
    // status === 'continued' — re-invoke (simulates QStash)
    console.log('↻ Continuing...');
    // Small delay to avoid "already running" race condition
    await new Promise(r => setTimeout(r, 3000));
    
    if (round > 15) {
      console.log('⚠️ Safety: too many rounds, stopping');
      break;
    }
  }
  
  const totalSec = ((Date.now() - globalStart) / 1000).toFixed(1);
  console.log(`\nTotal time: ${totalSec}s across ${round} rounds`);
}

main().catch(console.error);
