-- Semantic Cache Table for LLM Responses

CREATE TABLE IF NOT EXISTS ai_llm_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  state_hash VARCHAR(64) NOT NULL,
  llm_response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, state_hash)
);

CREATE INDEX IF NOT EXISTS idx_ai_llm_cache_hash ON ai_llm_cache(business_id, state_hash);
