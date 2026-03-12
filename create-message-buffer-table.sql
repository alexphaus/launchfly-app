-- Message buffer table for debouncing rapid-fire WhatsApp messages
-- When a user sends multiple texts quickly, they get buffered here
-- and combined into a single AI call instead of triggering duplicates.

CREATE TABLE IF NOT EXISTS message_buffer (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  debounce_key text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  business_id uuid NOT NULL,
  phone text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookups by debounce_key + recency
CREATE INDEX IF NOT EXISTS idx_message_buffer_key ON message_buffer (debounce_key, created_at DESC);

-- Auto-cleanup: delete old buffers after 1 minute (they should be consumed in ~3s)
-- You can set up a cron or pg_cron job to run: DELETE FROM message_buffer WHERE created_at < now() - interval '1 minute';
