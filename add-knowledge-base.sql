-- Knowledge Base chunks table for RAG
-- Stores chunked + embedded documents for semantic search

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge base chunks table
CREATE TABLE IF NOT EXISTS knowledge_base_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  document_id UUID NOT NULL,
  document_title TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  chunk_text TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kb_chunks_business ON knowledge_base_chunks(business_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc ON knowledge_base_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_business_doc ON knowledge_base_chunks(business_id, document_id);

-- RLS policy
ALTER TABLE knowledge_base_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business isolation" ON knowledge_base_chunks
  FOR ALL USING (business_id = auth.uid()::uuid);

-- Service role can do everything
CREATE POLICY "Service role full access" ON knowledge_base_chunks
  FOR ALL USING (auth.role() = 'service_role');

-- Semantic search RPC function
CREATE OR REPLACE FUNCTION search_knowledge_base(
  query_embedding vector(1536),
  match_business_id UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  document_title TEXT,
  chunk_index INT,
  chunk_text TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kbc.id,
    kbc.document_id,
    kbc.document_title,
    kbc.chunk_index,
    kbc.chunk_text,
    kbc.metadata,
    1 - (kbc.embedding <=> query_embedding) AS similarity
  FROM knowledge_base_chunks kbc
  WHERE kbc.business_id = match_business_id
    AND kbc.embedding IS NOT NULL
  ORDER BY kbc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- HNSW index for fast vector search (create after initial data load for best performance)
CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding ON knowledge_base_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
