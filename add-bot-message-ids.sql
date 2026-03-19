-- Track bot-sent WhatsApp message IDs so the Evolution webhook can
-- distinguish bot echoes (fromMe) from real contractor messages.
-- Run this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public._bot_message_ids (
  message_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: service-role only
ALTER TABLE public._bot_message_ids ENABLE ROW LEVEL SECURITY;
