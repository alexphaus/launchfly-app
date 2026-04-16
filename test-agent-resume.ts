import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local', override: true });
import { executeAgentTask } from './src/lib/agent/runner';

const TASK_ID = '8a0d536c-c130-4529-9cc5-a9f1be21a88e';

async function main() {
  console.log(`Resuming task ${TASK_ID}\n`);
  let round = 0;
  const globalStart = Date.now();
  while (true) {
    round++;
    const roundStart = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ROUND ${round} — elapsed ${((Date.now() - globalStart) / 1000).toFixed(1)}s`);
    console.log(`${'='.repeat(60)}`);
    const res = await executeAgentTask(TASK_ID);
    const roundMs = Date.now() - roundStart;
    console.log(`\nRound ${round} result: status=${res.status}, steps=${res.stepsUsed}, took ${(roundMs / 1000).toFixed(1)}s`);
    if (res.status === 'completed') {
      console.log('\n✅ TASK COMPLETED');
      console.log('Result:', res.result?.substring(0, 2000));
      break;
    }
    if (res.status === 'failed') {
      console.log('\n❌ TASK FAILED');
      console.log('Result:', res.result);
      break;
    }
    console.log('↻ Continuing...');
    if (round > 10) {
      console.log('⚠️ Safety: too many rounds');
      break;
    }
  }
  console.log(`\nTotal: ${((Date.now() - globalStart) / 1000).toFixed(1)}s, ${round} rounds`);
}
main().catch(console.error);
