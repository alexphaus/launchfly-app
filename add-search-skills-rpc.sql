-- ═══════════════════════════════════════════════════════════════════════════
-- Vector-based skill search for agent auto-recall
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION search_skills(
  query_embedding vector(1536),
  match_business_id UUID,
  match_count INT DEFAULT 3,
  min_similarity FLOAT DEFAULT 0.25
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  category VARCHAR(50),
  importance_score DECIMAL(3,2),
  use_count INT,
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
    m.use_count,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM ai_memories m
  WHERE m.business_id = match_business_id
    AND m.archived = false
    AND m.category IN ('skill', 'tool_recipe')
    AND m.embedding IS NOT NULL
    AND (1 - (m.embedding <=> query_embedding)) >= min_similarity
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
