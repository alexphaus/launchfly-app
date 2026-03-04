-- =====================================================
-- SQL Migration: Quote Follow-Up v2 — Multi-Tenant + 14-Day Sequence
-- Run AFTER the original quote-followup-migration.sql
-- =====================================================

-- 1. Add business_id FK to quote_leads (nullable for legacy rows)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_leads' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE quote_leads ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Add currency column (defaults to USD for existing rows)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_leads' AND column_name = 'currency'
  ) THEN
    ALTER TABLE quote_leads ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';
  END IF;
END $$;

-- 3. Add source column to track how the lead was ingested (webhook, bcc_email, manual)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_leads' AND column_name = 'source'
  ) THEN
    ALTER TABLE quote_leads ADD COLUMN source TEXT NOT NULL DEFAULT 'webhook';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════
-- 14-Day Revenue Recovery Sequence Columns
-- ════════════════════════════════════════════════════════════════════════

-- 4. Sequence step tracker (0 = Day 0 confirmation, 1-6 = subsequent steps)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_leads' AND column_name = 'sequence_step'
  ) THEN
    ALTER TABLE quote_leads ADD COLUMN sequence_step INT NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 5. Sequence paused flag (set when prospect replies — "Stop on Reply")
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_leads' AND column_name = 'sequence_paused'
  ) THEN
    ALTER TABLE quote_leads ADD COLUMN sequence_paused BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 6. Snooze: resume date (when "not ready yet" detected, pause until this time)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_leads' AND column_name = 'paused_until'
  ) THEN
    ALTER TABLE quote_leads ADD COLUMN paused_until TIMESTAMPTZ;
  END IF;
END $$;

-- 7. Prospect timezone (for 9 AM - 6 PM send window enforcement)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_leads' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE quote_leads ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/New_York';
  END IF;
END $$;

-- 8. Last reply timestamp (for stop-on-reply tracking)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_leads' AND column_name = 'last_reply_at'
  ) THEN
    ALTER TABLE quote_leads ADD COLUMN last_reply_at TIMESTAMPTZ;
  END IF;
END $$;

-- 9. Sequence completed flag (true after Day 14 break-up sent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_leads' AND column_name = 'sequence_completed'
  ) THEN
    ALTER TABLE quote_leads ADD COLUMN sequence_completed BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 10. Break-up reply choice (A/B/C from Day 14 multiple choice)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_leads' AND column_name = 'breakup_reply'
  ) THEN
    ALTER TABLE quote_leads ADD COLUMN breakup_reply TEXT;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════
-- Indexes
-- ════════════════════════════════════════════════════════════════════════

-- Index on business_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_quote_leads_business_id
  ON quote_leads (business_id)
  WHERE business_id IS NOT NULL;

-- Composite index: phone + status (for v2 bot quote-lead routing)
CREATE INDEX IF NOT EXISTS idx_quote_leads_phone_status
  ON quote_leads (phone, status)
  WHERE status IN ('WhatsApp_Nurture', 'Called', 'Open');

-- Index for sequence cron: find leads ready for next step
CREATE INDEX IF NOT EXISTS idx_quote_leads_sequence_due
  ON quote_leads (next_action_time, sequence_step)
  WHERE sequence_paused = false
    AND sequence_completed = false
    AND status NOT IN ('Booked', 'Lost');
