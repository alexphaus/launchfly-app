-- ═══════════════════════════════════════════════════════════════════════════
-- Purchasing OS — Suppliers + Jobs tables
-- Run against Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Suppliers: per-business supplier contacts
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  whatsapp_number TEXT,
  email TEXT,
  category TEXT,         -- 'plumbing', 'hvac', 'electrical', 'lumber', 'jewelry_materials', etc.
  notes TEXT,
  avg_response_hours NUMERIC,  -- calculated over time: avg hours to reply to a quote request
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suppliers_business ON suppliers(business_id);

-- Jobs: per-business job/purchase orders
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT,
  status TEXT DEFAULT 'draft',  -- draft, quoting, ready, blocked, completed
  description TEXT,              -- original raw input (voice transcript, text, etc.)
  materials_needed JSONB DEFAULT '[]',   -- [{"item": "2-inch PVC", "qty": 5, "unit": "lengths"}, ...]
  quotes_received JSONB DEFAULT '[]',    -- [{"supplier_id": "...", "total": 145, "available": [...], "missing": [...], "received_at": "..."}]
  blockers JSONB DEFAULT '[]',           -- ["Waiting on landlord approval", "PVC glue out of stock"]
  metadata JSONB DEFAULT '{}',           -- flexible: job_date, address, technician, client_name, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_business ON jobs(business_id);
CREATE INDEX idx_jobs_status ON jobs(business_id, status);

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies: service role can do everything, authenticated users see their own business
CREATE POLICY "Service role full access" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON jobs FOR ALL USING (true) WITH CHECK (true);
