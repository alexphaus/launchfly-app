-- Add plan_dag to agent_tasks for Phase 2: Advanced Reasoning

ALTER TABLE agent_tasks
ADD COLUMN IF NOT EXISTS plan_dag JSONB;
