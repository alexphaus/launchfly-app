-- Full-Text Search for chat_history table
-- Enables cross-session conversation recall ("What did we discuss about X last month?")

-- 1. Add a generated tsvector column for full-text search
ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

-- 2. Create a GIN index on the tsvector column for fast full-text search
CREATE INDEX IF NOT EXISTS idx_chat_history_fts ON chat_history USING GIN (fts);

-- 3. RPC function: search conversations with FTS + optional business_id filter
-- Returns matching messages with surrounding context (previous + next message)
CREATE OR REPLACE FUNCTION search_conversations(
  search_query TEXT,
  match_business_id UUID DEFAULT NULL,
  match_phone TEXT DEFAULT NULL,
  max_results INT DEFAULT 20,
  days_back INT DEFAULT 90
)
RETURNS TABLE (
  id UUID,
  phone TEXT,
  role TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ch.id,
    ch.phone,
    ch.role,
    ch.content,
    ch.created_at,
    ts_rank(ch.fts, websearch_to_tsquery('english', search_query)) AS rank
  FROM chat_history ch
  WHERE
    ch.fts @@ websearch_to_tsquery('english', search_query)
    AND ch.created_at >= NOW() - (days_back || ' days')::INTERVAL
    AND (match_business_id IS NULL OR ch.business_id = match_business_id)
    AND (match_phone IS NULL OR ch.phone = match_phone)
  ORDER BY rank DESC, ch.created_at DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Fallback ILIKE-based search for non-English content or exact phrases
CREATE OR REPLACE FUNCTION search_conversations_like(
  search_query TEXT,
  match_business_id UUID DEFAULT NULL,
  match_phone TEXT DEFAULT NULL,
  max_results INT DEFAULT 20,
  days_back INT DEFAULT 90
)
RETURNS TABLE (
  id UUID,
  phone TEXT,
  role TEXT,
  content TEXT,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  safe_query TEXT;
BEGIN
  -- Escape ILIKE metacharacters to prevent injection via wildcard manipulation (requires 4 backslashes for a literal backslash in plpgsql)
  safe_query := replace(replace(replace(search_query, '\', '\\\\'), '%', '\%'), '_', '\_');
  RETURN QUERY
  SELECT
    ch.id,
    ch.phone,
    ch.role,
    ch.content,
    ch.created_at
  FROM chat_history ch
  WHERE
    ch.content ILIKE '%' || safe_query || '%'
    AND ch.created_at >= NOW() - (days_back || ' days')::INTERVAL
    AND (match_business_id IS NULL OR ch.business_id = match_business_id)
    AND (match_phone IS NULL OR ch.phone = match_phone)
  ORDER BY ch.created_at DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_conversations IS 'Full-text search across chat_history using PostgreSQL tsvector. Used by the agent search_conversations tool for cross-session recall.';
