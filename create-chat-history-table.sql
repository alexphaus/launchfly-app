-- V2 AI Receptionist: Chat History Table
-- This table stores conversation history for context in AI responses

CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,                          -- Customer phone number (normalized, without +)
    business_id UUID REFERENCES businesses(id),   -- Optional business context
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    tool_calls JSONB,                             -- Optional: store tool calls for debugging
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by phone (most common query)
CREATE INDEX IF NOT EXISTS idx_chat_history_phone ON chat_history(phone);

-- Index for phone + business combo
CREATE INDEX IF NOT EXISTS idx_chat_history_phone_business ON chat_history(phone, business_id);

-- Index for timestamp-based cleanup
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at);

-- RLS policy: Only service role can access (server-side only)
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Service role full access policy
CREATE POLICY "Service role full access to chat_history" ON chat_history
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Cleanup function: Delete history older than 24 hours
-- Run this periodically via cron job
CREATE OR REPLACE FUNCTION cleanup_old_chat_history()
RETURNS void AS $$
BEGIN
    DELETE FROM chat_history
    WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Comment for documentation
COMMENT ON TABLE chat_history IS 'Stores conversation history for V2 AI Receptionist. Auto-expires after 24 hours.';
