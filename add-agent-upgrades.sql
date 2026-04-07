-- ═══════════════════════════════════════════════════════════════════════════
-- Agent Upgrades: Approval Gates + Workflows + Memory Enhancements
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add 'waiting_approval' and 'waiting_subtask' to agent_tasks status
ALTER TABLE agent_tasks DROP CONSTRAINT IF EXISTS agent_tasks_status_check;
ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_status_check
  CHECK (status IN ('running', 'completed', 'failed', 'paused', 'waiting_approval', 'waiting_subtask'));

-- Add parent_task_id for sub-task → parent linking
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES agent_tasks(id);
-- Store serialized messages so we can resume paused tasks  
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS messages JSONB;
-- Store ownerPhone for resumption context
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS owner_phone TEXT;
-- Store enabled tools for resumption context
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS enabled_tools JSONB;

CREATE INDEX IF NOT EXISTS idx_agent_tasks_parent ON agent_tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_tasks_waiting ON agent_tasks(status) WHERE status IN ('waiting_approval', 'waiting_subtask');

-- 2. Pending Approvals table
CREATE TABLE IF NOT EXISTS agent_pending_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options TEXT[], -- e.g. ['approve', 'reject', 'modify']
  response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_pending_approvals_biz ON agent_pending_approvals(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_open ON agent_pending_approvals(business_id, expires_at) 
  WHERE response IS NULL;

ALTER TABLE agent_pending_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON agent_pending_approvals FOR ALL USING (true) WITH CHECK (true);

-- 3. Agent Workflows table (recurring/scheduled agent tasks)
CREATE TABLE IF NOT EXISTS agent_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- Cron expression (e.g. '0 9 * * 1' = Monday 9am)
  cron_expression TEXT NOT NULL,
  -- Which assistant runs this
  assistant_name TEXT NOT NULL DEFAULT 'Chief of Staff',
  -- The goal/instruction for the agent
  goal_template TEXT NOT NULL,
  -- Tools to enable
  enabled_tools TEXT[] DEFAULT '{}',
  -- Timezone for cron
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflows_active ON agent_workflows(active, next_run_at) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_workflows_business ON agent_workflows(business_id);

ALTER TABLE agent_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON agent_workflows FOR ALL USING (true) WITH CHECK (true);

-- 4. Ensure ai_memories table exists with embedding column (pgvector)
-- (Already exists from migration 20250117, but ensure the index is up to date)
CREATE INDEX IF NOT EXISTS idx_ai_memories_business_cat ON ai_memories(business_id, category, archived) 
  WHERE archived = false;

-- 5. Vector similarity search function for semantic memory
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding vector(1536),
  match_business_id UUID,
  match_category TEXT DEFAULT NULL,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  category VARCHAR(50),
  importance_score DECIMAL(3,2),
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.category,
    m.importance_score,
    m."timestamp",
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM ai_memories m
  WHERE m.business_id = match_business_id
    AND m.archived = false
    AND (match_category IS NULL OR m.category = match_category)
    AND m.embedding IS NOT NULL
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
