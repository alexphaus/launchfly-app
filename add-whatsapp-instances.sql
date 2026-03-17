-- ═══════════════════════════════════════════════════════════════════════════
-- Multi-Instance WhatsApp Outreach — Load Balancing
-- ═══════════════════════════════════════════════════════════════════════════
-- Each row = one WhatsApp phone number that can send outbound messages.
-- The outreach system round-robins across active instances, picking the one
-- with the fewest sends today. Each prospect gets pinned to an instance so
-- all follow-ups come from the same number.

CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  label         TEXT NOT NULL DEFAULT '',          -- e.g. "Phone 1 (MY)", "Phone 2 (SG)"
  provider      TEXT NOT NULL DEFAULT 'ultramsg',  -- 'ultramsg' | 'evolution'

  -- UltraMsg credentials
  instance_id   TEXT,                              -- UltraMsg instance ID
  token         TEXT,                              -- UltraMsg token

  -- Evolution API credentials
  base_url      TEXT,                              -- e.g. https://evo.yourdomain.com
  api_key       TEXT,
  instance_name TEXT,                              -- Evolution instance name

  -- Limits & counters
  daily_limit   INTEGER NOT NULL DEFAULT 25,        -- max outbound/day for anti-ban
  sends_today   INTEGER NOT NULL DEFAULT 0,         -- reset daily by cron
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- when sends_today was last zeroed

  -- Status
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for the load-balancer query: active instances for a business, ordered by sends
CREATE INDEX idx_wa_instances_business_active
  ON whatsapp_instances (business_id, active, sends_today ASC)
  WHERE active = true;

-- Pin prospects to a specific instance so follow-ups come from the same number
ALTER TABLE hunter_prospects
  ADD COLUMN IF NOT EXISTS wa_instance_id UUID REFERENCES whatsapp_instances(id);

-- Also track on customers for inbound routing
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS wa_instance_id UUID REFERENCES whatsapp_instances(id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS Policies (service role bypasses these; frontend uses them)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage their instances"
  ON whatsapp_instances FOR ALL
  USING (business_id IN (
    SELECT id FROM businesses WHERE user_id = auth.uid()
  ));

-- ═══════════════════════════════════════════════════════════════════════════
-- Daily reset function (call from a cron or QStash daily at midnight)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION reset_wa_instance_counters()
RETURNS void AS $$
BEGIN
  UPDATE whatsapp_instances
  SET sends_today = 0, last_reset_at = now()
  WHERE sends_today > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic increment for daily send counter (called from app after each send)
CREATE OR REPLACE FUNCTION increment_wa_sends(instance_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE whatsapp_instances
  SET sends_today = sends_today + 1, updated_at = now()
  WHERE id = instance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
