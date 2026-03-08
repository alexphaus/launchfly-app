-- ═══════════════════════════════════════════════════════════════════════════
-- Assistants — The core AI employee abstraction layer
-- ═══════════════════════════════════════════════════════════════════════════
-- One assistant per business (for now). Stores the system prompt, tools,
-- knowledge base, and follow-up sequence — all configurable from the UI.
--
-- The v2 webhook, cron processor, and campaign engine all read from this
-- table instead of hardcoded logic.

CREATE TABLE IF NOT EXISTS assistants (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Identity
  name            TEXT NOT NULL DEFAULT 'AI Sales Assistant',
  tone            TEXT NOT NULL DEFAULT 'friendly',            -- friendly, professional, casual, direct
  goal            TEXT NOT NULL DEFAULT 'book_consultation',   -- book_consultation, close_sale, collect_review, reactivate

  -- The brain
  system_prompt   TEXT,           -- Custom override. NULL = auto-generate from business_data (existing behavior)
  custom_rules    TEXT[] DEFAULT '{}',  -- Business-specific rules appended to auto-generated prompt

  -- Knowledge base (JSONB so the owner can edit from UI)
  knowledge_base  JSONB DEFAULT '{}'::jsonb,
  -- Expected shape:
  -- {
  --   "pricing": [{ "service": "Roof Replacement", "price": "8000-15000", "unit": "job" }],
  --   "faq": [{ "q": "Do you offer financing?", "a": "Yes, 12-month zero interest..." }],
  --   "objections": [{ "trigger": "too expensive", "response": "We offer financing..." }]
  -- }

  -- Tools the assistant is allowed to use
  tools_enabled   TEXT[] DEFAULT '{send_checkout_link,book_calendar,send_template,transfer_to_human}',

  -- Follow-up sequence (JSONB array of steps)
  sequence_steps  JSONB DEFAULT '[]'::jsonb,
  -- Expected shape:
  -- [
  --   { "step": 0, "dayOffset": 0, "hour": -1, "minute": 0, "channel": "whatsapp", "message": "Hey {firstName}..." },
  --   { "step": 1, "dayOffset": 2, "hour": 16, "minute": 30, "channel": "whatsapp", "message": "..." },
  --   { "step": 2, "dayOffset": 4, "hour": 10, "minute": 30, "channel": "retell_voice", "message": "...", "voicemail": "..." }
  -- ]

  -- Triggers: how this assistant gets activated
  trigger_config  JSONB DEFAULT '{}'::jsonb,
  -- Expected shape:
  -- {
  --   "whatsapp_webhook": true,       -- Responds to inbound WhatsApp (existing v2 behavior)
  --   "missed_call": true,             -- Sends template on missed call
  --   "bcc_email": false,              -- Triggered by BCC quote email
  --   "csv_campaign": false,           -- Manual CSV upload triggers outbound
  --   "zapier_webhook": false          -- External webhook trigger
  -- }

  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- One active assistant per business (for now — can relax later for multi-agent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_assistants_business_active
  ON assistants (business_id) WHERE active = true;

-- Fast lookup by business
CREATE INDEX IF NOT EXISTS idx_assistants_business_id
  ON assistants (business_id);

-- RLS
ALTER TABLE assistants ENABLE ROW LEVEL SECURITY;

-- Policy: users can see assistants for businesses they own
CREATE POLICY "Users can view own assistants"
  ON assistants FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own assistants"
  ON assistants FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own assistants"
  ON assistants FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own assistants"
  ON assistants FOR DELETE
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- ── Seed: Auto-create a default assistant for every existing business ──
-- This runs once on migration. New businesses get one via the trigger below.
INSERT INTO assistants (business_id, name, tone, goal, tools_enabled, trigger_config)
SELECT
  id,
  'AI Sales Assistant',
  'friendly',
  'book_consultation',
  ARRAY['send_checkout_link', 'book_calendar', 'send_template', 'transfer_to_human'],
  '{"whatsapp_webhook": true, "missed_call": true}'::jsonb
FROM businesses
WHERE id NOT IN (SELECT business_id FROM assistants)
ON CONFLICT DO NOTHING;

-- ── Trigger: Auto-seed a default assistant when a new business is created ──
CREATE OR REPLACE FUNCTION seed_default_assistant()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO assistants (business_id, name, tone, goal, tools_enabled, trigger_config)
  VALUES (
    NEW.id,
    'AI Sales Assistant',
    'friendly',
    'book_consultation',
    ARRAY['send_checkout_link', 'book_calendar', 'send_template', 'transfer_to_human'],
    '{"whatsapp_webhook": true, "missed_call": true}'::jsonb
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_assistant ON businesses;
CREATE TRIGGER trg_seed_assistant
  AFTER INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION seed_default_assistant();
