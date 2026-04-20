-- MCP (Model Context Protocol) Server Configuration Table
-- Stores MCP server connections per business for dynamic tool discovery

CREATE TABLE IF NOT EXISTS mcp_servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                          -- Human-readable name (e.g. "GitHub", "Notion", "Slack")
    transport TEXT NOT NULL DEFAULT 'http',       -- 'http' (Streamable HTTP) or 'sse' (Server-Sent Events)
    url TEXT NOT NULL,                           -- MCP server endpoint URL
    api_key TEXT,                                -- Optional auth token/API key for the server
    headers JSONB DEFAULT '{}',                  -- Additional HTTP headers (e.g. {"X-Custom": "value"})
    enabled BOOLEAN NOT NULL DEFAULT true,       -- Toggle without deleting
    tool_filter TEXT[],                          -- Optional allowlist of tool names (null = all tools)
    cached_tools JSONB,                          -- Cached tool definitions (refreshed periodically)
    cached_at TIMESTAMPTZ,                       -- When tools were last cached
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by business
CREATE INDEX IF NOT EXISTS idx_mcp_servers_business ON mcp_servers(business_id);

-- RLS: service role only
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to mcp_servers" ON mcp_servers
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE mcp_servers IS 'MCP server configurations per business. Agent discovers and calls tools from these servers dynamically.';
