-- Add status and source tracking fields to customers table
-- Run this in your Supabase SQL Editor

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'lead',
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'unknown';

-- Add helpful comment
COMMENT ON COLUMN customers.status IS 'Customer lifecycle stage: lead, customer, inactive';
COMMENT ON COLUMN customers.source IS 'Acquisition channel: lead_magnet, direct, referral, social, etc';

-- Optional: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(source);
