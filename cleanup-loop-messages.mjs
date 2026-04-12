/**
 * Cleanup script: Remove agent loop-generated chat_history and agent_tasks
 * from the April 12, 2026 feedback loop incident.
 *
 * Run:  node cleanup-loop-messages.mjs
 * Dry-run first (default), then set DRY_RUN=false to delete.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const DRY_RUN = false; // Set to false to actually delete

// The loop started around 9:07 PM SGT (UTC+8) on April 12, 2026
// = ~13:07 UTC. First valid message was at 8:52 PM SGT = 12:52 UTC.
// We'll keep everything before 13:05 UTC and clean from there.
const LOOP_START = '2026-04-12T13:05:00Z';

// Patterns that identify agent-generated loop messages
const AGENT_ECHO_PATTERNS = [
  '🤖 Agent Report',
  '🔌 New Integration Request',
  '🔔 Approval Required',
  'search_memory:',
  'search_tasks:',
  'query_database:',
  'call_api:',
  'manage_automation:',
  'run_code:',
  'save_memory:',
  'update_instructions:',
  'draft_content:',
  'request_integration:',
  'request_approval:',
];

async function main() {
  console.log(`\n${DRY_RUN ? '🔍 DRY RUN' : '🗑️  LIVE DELETE'} — Cleaning up loop messages\n`);

  // ── 1. Find looping agent_tasks ──
  console.log('── Agent Tasks ──');
  const { data: tasks, error: taskErr } = await supabase
    .from('agent_tasks')
    .select('id, status, goal, steps_used, created_at')
    .gte('created_at', LOOP_START)
    .order('created_at', { ascending: true });

  if (taskErr) {
    console.error('Error fetching tasks:', taskErr.message);
    return;
  }

  // Identify loop tasks: tasks created in rapid succession with repetitive goals
  const seenGoals = new Map();
  const loopTaskIds = [];

  for (const t of tasks || []) {
    const goalSnip = (t.goal || '').substring(0, 100);
    const prev = seenGoals.get(goalSnip);
    if (prev) {
      // Duplicate goal within the window — mark as loop
      loopTaskIds.push(t.id);
      console.log(`  LOOP: ${t.id} | ${t.status} | ${t.steps_used} steps | ${goalSnip.substring(0, 60)}...`);
    } else {
      seenGoals.set(goalSnip, t);
    }
  }

  // Also flag tasks that were spawned by the loop (agent-generated goals)
  for (const t of tasks || []) {
    if (loopTaskIds.includes(t.id)) continue;
    const goal = t.goal || '';
    // Tasks started from agent echo messages (like integration requests, approval requests)
    const isEchoGoal = goal.startsWith('🔌') || goal.startsWith('🔔') ||
      goal.includes('Retell AI integration') && tasks.filter(x => x.goal?.includes('Retell AI')).length > 2;
    if (isEchoGoal) {
      loopTaskIds.push(t.id);
      console.log(`  ECHO: ${t.id} | ${t.status} | ${t.steps_used} steps | ${goal.substring(0, 60)}...`);
    }
  }

  console.log(`\n  Total tasks in window: ${(tasks || []).length}`);
  console.log(`  Loop tasks to delete: ${loopTaskIds.length}`);
  console.log(`  Tasks to keep: ${(tasks || []).length - loopTaskIds.length}`);

  // ── 2. Find looping chat_history entries ──
  console.log('\n── Chat History ──');
  const { data: chats, error: chatErr } = await supabase
    .from('chat_history')
    .select('id, role, content, created_at')
    .gte('created_at', LOOP_START)
    .order('created_at', { ascending: true });

  if (chatErr) {
    console.error('Error fetching chat history:', chatErr.message);
    return;
  }

  const loopChatIds = [];
  for (const c of chats || []) {
    const content = c.content || '';
    // Match assistant messages that are agent echoes
    if (c.role === 'assistant') {
      const isAgentEcho = AGENT_ECHO_PATTERNS.some(p => content.includes(p));
      if (isAgentEcho) {
        loopChatIds.push(c.id);
        console.log(`  ECHO: ${c.id} | ${c.role} | ${content.substring(0, 70)}...`);
      }
    }
    // Match user messages that are actually echo-backs of agent reports
    if (c.role === 'user') {
      const isEchoBack = content.startsWith('🤖 Agent Report') ||
        content.startsWith('🔌 New Integration Request') ||
        content.startsWith('🔔 Approval Required') ||
        content.match(/^_[^\n]{1,120}_$/);
      if (isEchoBack) {
        loopChatIds.push(c.id);
        console.log(`  ECHO-USER: ${c.id} | ${content.substring(0, 70)}...`);
      }
    }
  }

  console.log(`\n  Total chat entries in window: ${(chats || []).length}`);
  console.log(`  Loop entries to delete: ${loopChatIds.length}`);
  console.log(`  Entries to keep: ${(chats || []).length - loopChatIds.length}`);

  // ── 3. Find stale pending approvals ──
  console.log('\n── Pending Approvals ──');
  const { data: approvals, error: apprErr } = await supabase
    .from('agent_pending_approvals')
    .select('id, task_id, question, created_at')
    .gte('created_at', LOOP_START)
    .is('response', null);

  if (apprErr) {
    console.error('Error fetching approvals:', apprErr.message);
  }

  const loopApprovalIds = (approvals || [])
    .filter(a => loopTaskIds.includes(a.task_id))
    .map(a => a.id);

  console.log(`  Stale approvals to delete: ${loopApprovalIds.length}`);

  // ── 4. Delete if not dry run ──
  if (!DRY_RUN) {
    console.log('\n🗑️  Deleting...');

    if (loopApprovalIds.length > 0) {
      const { error } = await supabase
        .from('agent_pending_approvals')
        .delete()
        .in('id', loopApprovalIds);
      console.log(`  Approvals: ${error ? `ERROR: ${error.message}` : `${loopApprovalIds.length} deleted`}`);
    }

    if (loopTaskIds.length > 0) {
      // Delete in batches of 50
      for (let i = 0; i < loopTaskIds.length; i += 50) {
        const batch = loopTaskIds.slice(i, i + 50);
        const { error } = await supabase
          .from('agent_tasks')
          .delete()
          .in('id', batch);
        console.log(`  Tasks batch ${Math.floor(i / 50) + 1}: ${error ? `ERROR: ${error.message}` : `${batch.length} deleted`}`);
      }
    }

    if (loopChatIds.length > 0) {
      for (let i = 0; i < loopChatIds.length; i += 50) {
        const batch = loopChatIds.slice(i, i + 50);
        const { error } = await supabase
          .from('chat_history')
          .delete()
          .in('id', batch);
        console.log(`  Chat batch ${Math.floor(i / 50) + 1}: ${error ? `ERROR: ${error.message}` : `${batch.length} deleted`}`);
      }
    }

    console.log('\n✅ Cleanup complete!');
  } else {
    console.log('\n⚠️  Dry run — no changes made. Set DRY_RUN = false to delete.');
  }
}

main().catch(console.error);
