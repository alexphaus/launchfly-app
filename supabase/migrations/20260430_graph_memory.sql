-- Hybrid Graph-Vector Memory Tables

-- Nodes table for Knowledge Graph entities
CREATE TABLE IF NOT EXISTS ai_nodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  label VARCHAR(50) NOT NULL, -- e.g., 'Supplier', 'Rule', 'Concept', 'Contact'
  name VARCHAR(255) NOT NULL,
  properties JSONB DEFAULT '{}',
  embedding vector(1536), -- Optional embedding for semantic search
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, label, name)
);

-- Edges table for Relationships
CREATE TABLE IF NOT EXISTS ai_edges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  source_id UUID REFERENCES ai_nodes(id) ON DELETE CASCADE,
  target_id UUID REFERENCES ai_nodes(id) ON DELETE CASCADE,
  relation VARCHAR(50) NOT NULL, -- e.g., 'HAS_PREFERENCE', 'PROVIDED_QUOTE', 'IS_A'
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, source_id, target_id, relation)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_nodes_business_label ON ai_nodes(business_id, label);
CREATE INDEX IF NOT EXISTS idx_ai_edges_source ON ai_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_ai_edges_target ON ai_edges(target_id);

-- Vector Index for Nodes
CREATE INDEX IF NOT EXISTS idx_ai_nodes_embedding ON ai_nodes 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- RPC Function for searching nodes
CREATE OR REPLACE FUNCTION search_graph_nodes(
  query_embedding vector(1536),
  match_business_id UUID,
  match_count INT DEFAULT 5,
  min_similarity FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  label VARCHAR,
  name VARCHAR,
  properties JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.label,
    n.name,
    n.properties,
    1 - (n.embedding <=> query_embedding) AS similarity
  FROM ai_nodes n
  WHERE 
    n.business_id = match_business_id
    AND n.embedding IS NOT NULL
    AND 1 - (n.embedding <=> query_embedding) > min_similarity
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- RPC Function for getting 1-hop subgraph for a set of nodes
CREATE OR REPLACE FUNCTION get_subgraph(
  node_ids UUID[],
  match_business_id UUID
)
RETURNS TABLE (
  source_id UUID,
  source_name VARCHAR,
  source_label VARCHAR,
  relation VARCHAR,
  target_id UUID,
  target_name VARCHAR,
  target_label VARCHAR,
  edge_properties JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as source_id,
    s.name as source_name,
    s.label as source_label,
    e.relation,
    t.id as target_id,
    t.name as target_name,
    t.label as target_label,
    e.properties as edge_properties
  FROM ai_edges e
  JOIN ai_nodes s ON e.source_id = s.id
  JOIN ai_nodes t ON e.target_id = t.id
  WHERE 
    e.business_id = match_business_id AND
    (e.source_id = ANY(node_ids) OR e.target_id = ANY(node_ids));
END;
$$;

-- Upsert Node Helper
CREATE OR REPLACE FUNCTION upsert_ai_node(
  p_business_id UUID,
  p_label VARCHAR,
  p_name VARCHAR,
  p_properties JSONB,
  p_embedding vector(1536)
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_node_id UUID;
BEGIN
  INSERT INTO ai_nodes (business_id, label, name, properties, embedding)
  VALUES (p_business_id, p_label, p_name, p_properties, p_embedding)
  ON CONFLICT (business_id, label, name) 
  DO UPDATE SET 
    properties = ai_nodes.properties || p_properties,
    embedding = COALESCE(p_embedding, ai_nodes.embedding),
    updated_at = NOW()
  RETURNING id INTO v_node_id;
  
  RETURN v_node_id;
END;
$$;

-- Upsert Edge Helper
CREATE OR REPLACE FUNCTION upsert_ai_edge(
  p_business_id UUID,
  p_source_id UUID,
  p_target_id UUID,
  p_relation VARCHAR,
  p_properties JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_edge_id UUID;
BEGIN
  INSERT INTO ai_edges (business_id, source_id, target_id, relation, properties)
  VALUES (p_business_id, p_source_id, p_target_id, p_relation, p_properties)
  ON CONFLICT (business_id, source_id, target_id, relation) 
  DO UPDATE SET 
    properties = ai_edges.properties || p_properties
  RETURNING id INTO v_edge_id;
  
  RETURN v_edge_id;
END;
$$;
