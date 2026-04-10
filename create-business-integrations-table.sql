-- ═══════════════════════════════════════════════════════════════════════════
-- Business Integrations — Per-business credential vault for external APIs
-- Enables the agent to dynamically call any REST API the owner authorizes.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS business_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,                          -- 'creatomate', 'elevenlabs', 'canva', etc.
  description TEXT,                                     -- human-readable: "AI video generation"
  base_url TEXT NOT NULL,                               -- 'https://api.creatomate.com/v1'
  api_key_encrypted TEXT,                               -- stored encrypted; agent decrypts at call time
  auth_type TEXT DEFAULT 'bearer',                      -- 'bearer' | 'basic' | 'query_param' | 'custom_header'
  auth_header TEXT DEFAULT 'Authorization',              -- custom header name if auth_type='custom_header'
  status TEXT DEFAULT 'active',                          -- 'active' | 'pending' | 'expired' | 'revoked'
  config JSONB DEFAULT '{}',                             -- service-specific: default params, rate limits, etc.
  requested_by TEXT DEFAULT 'owner',                     -- 'agent' | 'owner'
  request_context TEXT,                                  -- why the agent requested it (goal context)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integrations_business ON business_integrations(business_id);
CREATE INDEX idx_integrations_service ON business_integrations(business_id, service_name);
CREATE UNIQUE INDEX idx_integrations_unique ON business_integrations(business_id, service_name);

-- RLS: service role only (agent backend runs as service role)
ALTER TABLE business_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON business_integrations FOR ALL USING (true) WITH CHECK (true);
