-- ═══════════════════════════════════════════════════════════════════════════
-- Demo Sessions — Interactive WhatsApp sales demo for contractors
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS demo_sessions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone         TEXT NOT NULL,                    -- Contractor's phone (E.164)
  owner_name    TEXT NOT NULL,                    -- Contractor name (from Retell)
  business_name TEXT,                             -- Their business name
  business_id   TEXT,                             -- Optional: if we already have them in `businesses`
  step          TEXT NOT NULL DEFAULT 'pending',  -- Current step in the demo flow
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ,                      -- When they finished/converted
  outcome       TEXT,                             -- 'converted', 'lost', 'timeout', 'in_progress'
  stripe_session_id TEXT,                         -- If they clicked the payment link
  fallback_sent BOOLEAN DEFAULT false             -- Whether the 10-min fallback was sent
);

-- Index for fast phone lookup (webhook handler)
CREATE INDEX IF NOT EXISTS idx_demo_sessions_phone ON demo_sessions (phone);

-- Index for timeout cleanup
CREATE INDEX IF NOT EXISTS idx_demo_sessions_step ON demo_sessions (step, created_at);

-- RLS (optional, same pattern as other tables)
ALTER TABLE demo_sessions ENABLE ROW LEVEL SECURITY;
