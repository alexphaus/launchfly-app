-- =====================================================
-- SQL Migration: Quote Follow-Up v2 — Multi-Tenant Fields
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

-- 4. Index on business_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_quote_leads_business_id
  ON quote_leads (business_id)
  WHERE business_id IS NOT NULL;

-- 5. Composite index: phone + status (for v2 bot quote-lead routing)
CREATE INDEX IF NOT EXISTS idx_quote_leads_phone_status
  ON quote_leads (phone, status)
  WHERE status IN ('WhatsApp_Nurture', 'Called', 'Open');
