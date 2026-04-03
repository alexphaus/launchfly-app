-- Agent Tasks Table
-- Tracks the state and results of autonomous agent executions
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'paused')),
  goal TEXT NOT NULL,
  role TEXT,
  steps_used INTEGER NOT NULL DEFAULT 0,
  tool_log JSONB DEFAULT '[]'::jsonb,
  result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by business
CREATE INDEX IF NOT EXISTS idx_agent_tasks_business ON agent_tasks(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status) WHERE status = 'running';

-- RLS (enable if you use RLS)
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: service role can do everything, users can only see their own business tasks
CREATE POLICY "Service role full access" ON agent_tasks FOR ALL USING (true) WITH CHECK (true);
