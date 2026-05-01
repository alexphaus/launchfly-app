-- ═══════════════════════════════════════════════════════════════════════════
-- Memory System Upgrades: Decay, Outcome Tracking, Auto-Recall
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add recall tracking columns
ALTER TABLE ai_memories ADD COLUMN IF NOT EXISTS last_recalled_at TIMESTAMPTZ;
ALTER TABLE ai_memories ADD COLUMN IF NOT EXISTS recall_count INTEGER NOT NULL DEFAULT 0;

-- 2. Add outcome tracking column
-- Stores: 'validated', 'invalidated', 'superseded', or null (unknown)
ALTER TABLE ai_memories ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE ai_memories ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

-- 3. Add updated_at column for tracking freshness (used by decay CRON)
ALTER TABLE ai_memories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 4. Index for decay CRON (find stale memories efficiently)
CREATE INDEX IF NOT EXISTS idx_ai_memories_decay
  ON ai_memories(archived, importance_score, last_recalled_at)
  WHERE archived = false;

-- 5. RPC: Bump recall tracking when memories are auto-injected
CREATE OR REPLACE FUNCTION touch_recalled_memories(memory_ids UUID[])
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE ai_memories
  SET
    last_recalled_at = now(),
    recall_count = recall_count + 1,
    updated_at = now()
  WHERE id = ANY(memory_ids)
    AND archived = false;
END;
$$;

-- 6. Updated search_memories: includes recall tracking columns
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
    m."memory_timestamp",
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

-- 7. RPC: Find near-duplicate memory pairs for consolidation CRON
CREATE OR REPLACE FUNCTION find_duplicate_memories(
  match_business_id UUID,
  similarity_threshold FLOAT DEFAULT 0.85,
  max_pairs INT DEFAULT 50
)
RETURNS TABLE (
  id_a UUID,
  id_b UUID,
  score_a DECIMAL(3,2),
  score_b DECIMAL(3,2),
  recall_a INT,
  recall_b INT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS id_a,
    b.id AS id_b,
    a.importance_score AS score_a,
    b.importance_score AS score_b,
    a.recall_count AS recall_a,
    b.recall_count AS recall_b,
    1 - (a.embedding <=> b.embedding) AS similarity
  FROM ai_memories a
  JOIN ai_memories b ON a.id < b.id  -- avoid self-joins and duplicates
    AND a.business_id = b.business_id
    AND b.archived = false
    AND b.embedding IS NOT NULL
    AND b.category NOT IN ('skill', 'playbook')
  WHERE a.business_id = match_business_id
    AND a.archived = false
    AND a.embedding IS NOT NULL
    AND a.category NOT IN ('skill', 'playbook')
    AND 1 - (a.embedding <=> b.embedding) > similarity_threshold
  ORDER BY 1 - (a.embedding <=> b.embedding) DESC
  LIMIT max_pairs;
END;
$$;
