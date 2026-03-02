-- =====================================================
-- SQL Migration: Quote Follow-Up System
-- Run in Supabase SQL Editor
-- =====================================================

-- 1. Main leads table
CREATE TABLE IF NOT EXISTS quote_leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  phone           TEXT        NOT NULL,
  email           TEXT,
  quote_amount    NUMERIC     NOT NULL,
  job_type        TEXT        NOT NULL,
  contractor_id   TEXT,
  status          TEXT        NOT NULL DEFAULT 'Open'
                    CHECK (status IN ('Open','Called','WhatsApp_Nurture','Booked','Lost')),
  call_sid        TEXT,
  call_outcome    TEXT,
  whatsapp_thread_id TEXT,
  stripe_payment_link TEXT,
  retell_call_id  TEXT,
  next_action_time TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  attempts        INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
 
-- Unique constraint: prevent duplicate leads per phone + job_type combo
CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_leads_phone_job
  ON quote_leads (phone, job_type)
  WHERE status NOT IN ('Booked','Lost');

-- Index for the cron worker that fetches actionable leads
CREATE INDEX IF NOT EXISTS idx_quote_leads_next_action
  ON quote_leads (next_action_time)
  WHERE status IN ('Open','Called','WhatsApp_Nurture');

-- 2. WhatsApp chat history for negotiation context
CREATE TABLE IF NOT EXISTS quote_chat_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES quote_leads(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_history_lead
  ON quote_chat_history (lead_id, created_at);

-- 3. Auto-update `updated_at` on lead changes
CREATE OR REPLACE FUNCTION update_quote_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quote_leads_updated_at ON quote_leads;
CREATE TRIGGER trg_quote_leads_updated_at
  BEFORE UPDATE ON quote_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_leads_updated_at();
