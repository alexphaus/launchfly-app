-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: Add 'pending' to agent_tasks status constraint
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The new DB-driven runner (v2) creates tasks with status='pending' before
-- dispatching to QStash. The previous constraint only allowed:
--   ('running', 'completed', 'failed', 'paused', 'waiting_approval', 'waiting_subtask')
-- This blocked all new tasks from being created.
--
-- Run in Supabase SQL Editor.

ALTER TABLE agent_tasks DROP CONSTRAINT IF EXISTS agent_tasks_status_check;

ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_status_check
  CHECK (status IN (
    'pending',           -- Initial state: created, waiting for QStash dispatch
    'running',           -- Actively executing in a Vercel invocation
    'completed',         -- Done successfully
    'failed',            -- Terminal failure
    'paused',            -- Manually paused (legacy)
    'waiting_approval',  -- Paused at an approval gate
    'waiting_subtask'    -- Paused waiting for a sub-agent to complete
  ));

-- Also update the default to 'pending' so direct inserts work correctly
ALTER TABLE agent_tasks ALTER COLUMN status SET DEFAULT 'pending';
