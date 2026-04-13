-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Speeds up search_memory agent tool from O(n) scan to O(log n) lookup

-- 1. HNSW index for vector similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS idx_ai_memories_embedding_hnsw
ON ai_memories
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 2. Composite index for the common filter (business_id + archived=false)
CREATE INDEX IF NOT EXISTS idx_ai_memories_business_archived
ON ai_memories (business_id, archived)
WHERE archived = false;
