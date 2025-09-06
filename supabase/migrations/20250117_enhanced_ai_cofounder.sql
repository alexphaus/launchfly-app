-- Enhanced AI Cofounder Database Schema
-- This migration adds all necessary tables for the advanced AI systems

-- AI Memories table with vector embeddings
CREATE TABLE IF NOT EXISTS ai_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category VARCHAR(50),
  embedding vector(1536), -- For OpenAI embeddings
  importance_score DECIMAL(3,2) DEFAULT 0.5,
  success_indicator BOOLEAN,
  context JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  archived BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_ai_memories_embedding ON ai_memories 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for business and category
CREATE INDEX IF NOT EXISTS idx_ai_memories_business ON ai_memories(business_id, category);
CREATE INDEX IF NOT EXISTS idx_ai_memories_timestamp ON ai_memories(timestamp DESC);

-- Shared AI Knowledge base
CREATE TABLE IF NOT EXISTS shared_ai_knowledge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  learning JSONB NOT NULL,
  contributor_id UUID REFERENCES businesses(id),
  embedding vector(1536),
  verified BOOLEAN DEFAULT FALSE,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Learning patterns table
CREATE TABLE IF NOT EXISTS ai_learning_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  pattern_type VARCHAR(100),
  condition JSONB,
  action JSONB,
  outcome JSONB,
  success_rate DECIMAL(3,2),
  confidence DECIMAL(3,2),
  application_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business plans table
CREATE TABLE IF NOT EXISTS ai_business_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  plan JSONB NOT NULL,
  goals JSONB,
  status VARCHAR(50) DEFAULT 'draft',
  confidence_score DECIMAL(3,2),
  expected_revenue DECIMAL(10,2),
  adaptation_count INTEGER DEFAULT 0,
  last_adapted TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id VARCHAR(255) PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  participant_id VARCHAR(255),
  participant_type VARCHAR(50), -- customer, provider, user
  conversation_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  outcome JSONB,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Experiments table
CREATE TABLE IF NOT EXISTS ai_experiments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  hypothesis TEXT,
  type VARCHAR(50), -- landing_page, pricing, email, offer, funnel
  variants JSONB NOT NULL,
  tracking JSONB,
  allocation JSONB,
  status VARCHAR(50) DEFAULT 'draft',
  confidence_threshold DECIMAL(3,2) DEFAULT 0.95,
  minimum_sample_size INTEGER DEFAULT 1000,
  winner VARCHAR(100),
  results JSONB,
  interim_results JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Experiment queue
CREATE TABLE IF NOT EXISTS ai_experiment_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  experiment JSONB NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium',
  parent_experiment_id UUID REFERENCES ai_experiments(id),
  executed BOOLEAN DEFAULT FALSE,
  queued_at TIMESTAMPTZ DEFAULT NOW()
);

-- Experiment applications
CREATE TABLE IF NOT EXISTS ai_experiment_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID REFERENCES ai_experiments(id),
  variant_id VARCHAR(100),
  expected_impact JSONB,
  actual_impact JSONB,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Cofounder state
CREATE TABLE IF NOT EXISTS ai_cofounder_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Landing pages configuration (for A/B testing)
CREATE TABLE IF NOT EXISTS landing_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  page_data JSONB NOT NULL,
  variant_id VARCHAR(100),
  is_active BOOLEAN DEFAULT FALSE,
  performance_metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business metrics table (if not exists)
CREATE TABLE IF NOT EXISTS business_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  revenue DECIMAL(10,2) DEFAULT 0,
  customers INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  avg_order_value DECIMAL(10,2) DEFAULT 0,
  traffic INTEGER DEFAULT 0,
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Functions for vector search
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding vector(1536),
  business_id UUID,
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  category VARCHAR(50),
  importance_score DECIMAL(3,2),
  context JSONB,
  metadata JSONB,
  timestamp TIMESTAMPTZ,
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
    m.context,
    m.metadata,
    m.timestamp,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM ai_memories m
  WHERE 
    m.business_id = search_memories.business_id
    AND m.archived = FALSE
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Function for searching shared knowledge
CREATE OR REPLACE FUNCTION search_shared_knowledge(
  query_embedding vector(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  learning JSONB,
  verified BOOLEAN,
  success_count INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    k.id,
    k.learning,
    k.verified,
    k.success_count,
    1 - (k.embedding <=> query_embedding) AS similarity
  FROM shared_ai_knowledge k
  WHERE 
    1 - (k.embedding <=> query_embedding) > match_threshold
  ORDER BY 
    k.verified DESC,
    similarity DESC,
    k.success_count DESC
  LIMIT match_count;
END;
$$;

-- Trigger to update landing page updated_at
CREATE OR REPLACE FUNCTION update_landing_page_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_landing_pages_updated_at
BEFORE UPDATE ON landing_pages
FOR EACH ROW
EXECUTE FUNCTION update_landing_page_updated_at();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_business_plans_business ON ai_business_plans(business_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_business ON ai_conversations(business_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_experiments_business ON ai_experiments(business_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_experiment_queue_business ON ai_experiment_queue(business_id, executed);
CREATE INDEX IF NOT EXISTS idx_business_metrics_business ON business_metrics(business_id, created_at DESC);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
