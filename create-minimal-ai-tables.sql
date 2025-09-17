-- Database migrations for Minimal AI Cofounder system
-- Run this to create the required tables

-- Simple memories table (no embeddings)
CREATE TABLE IF NOT EXISTS ai_memories_simple (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  importance DECIMAL(3,2) DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, key)
);

-- Cost tracking table
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_cost DECIMAL(10,4) DEFAULT 0,
  operation_count INTEGER DEFAULT 0,
  operations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, date)
);

-- Budget events table
CREATE TABLE IF NOT EXISTS ai_budget_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  operation TEXT,
  estimated_cost DECIMAL(10,4),
  current_cost DECIMAL(10,4),
  daily_budget DECIMAL(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tool usage tracking
CREATE TABLE IF NOT EXISTS tool_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  success BOOLEAN DEFAULT true,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event counters for pattern recognition
CREATE TABLE IF NOT EXISTS ai_event_counters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  counters JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, date)
);

-- Pattern triggers
CREATE TABLE IF NOT EXISTS pattern_triggers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  pattern_id TEXT NOT NULL,
  pattern_name TEXT NOT NULL,
  severity TEXT NOT NULL,
  counters JSONB,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly digests
CREATE TABLE IF NOT EXISTS weekly_digests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  digest_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, week_start)
);

-- Success patterns for playbook generation
CREATE TABLE IF NOT EXISTS success_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_details JSONB NOT NULL,
  outcome_data JSONB NOT NULL,
  context_data JSONB,
  success_score DECIMAL(3,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI playbooks (cross-business knowledge)
CREATE TABLE IF NOT EXISTS ai_playbooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  playbook_data JSONB NOT NULL,
  source_patterns_count INTEGER DEFAULT 0,
  confidence_score DECIMAL(3,2) DEFAULT 0.5,
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playbook applications
CREATE TABLE IF NOT EXISTS playbook_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  playbook_id UUID NOT NULL REFERENCES ai_playbooks(id) ON DELETE CASCADE,
  results JSONB,
  success_rate DECIMAL(3,2),
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_memories_business_key ON ai_memories_simple(business_id, key);
CREATE INDEX IF NOT EXISTS idx_ai_memories_importance ON ai_memories_simple(business_id, importance DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_business_date ON ai_usage(business_id, date);

CREATE INDEX IF NOT EXISTS idx_tool_usage_business_tool ON tool_usage(business_id, tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_usage_created ON tool_usage(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_counters_business_date ON ai_event_counters(business_id, date);

CREATE INDEX IF NOT EXISTS idx_pattern_triggers_business ON pattern_triggers(business_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_triggers_pattern ON pattern_triggers(pattern_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_digests_business ON weekly_digests(business_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_success_patterns_action ON success_patterns(action_type, success_score DESC);
CREATE INDEX IF NOT EXISTS idx_success_patterns_business ON success_patterns(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_playbooks_action ON ai_playbooks(action_type, confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_playbooks_usage ON ai_playbooks(usage_count DESC, success_rate DESC);

CREATE INDEX IF NOT EXISTS idx_playbook_applications_business ON playbook_applications(business_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_playbook_applications_playbook ON playbook_applications(playbook_id, applied_at DESC);

-- Add triggers to update playbook usage stats
CREATE OR REPLACE FUNCTION update_playbook_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_playbooks 
  SET 
    usage_count = usage_count + 1,
    success_rate = (
      SELECT AVG(success_rate) 
      FROM playbook_applications 
      WHERE playbook_id = NEW.playbook_id
    ),
    updated_at = NOW()
  WHERE id = NEW.playbook_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_playbook_stats_trigger
  AFTER INSERT ON playbook_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_playbook_stats();

