-- Fix Customer Table Schema for Email Sequences
-- Run this in your Supabase SQL Editor to ensure email sequences work correctly

-- 1. Ensure tracking columns exist
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'lead',
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'lead_magnet';

-- 2. Ensure marketing consent column exists and defaults to true
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS accepts_marketing BOOLEAN DEFAULT true;

-- 3. Update existing records to have valid status/source if missing
UPDATE customers 
SET status = 'lead' 
WHERE status IS NULL;

UPDATE customers 
SET source = 'lead_magnet' 
WHERE source IS NULL;

UPDATE customers 
SET accepts_marketing = true 
WHERE accepts_marketing IS NULL;

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(source);
CREATE INDEX IF NOT EXISTS idx_customers_marketing ON customers(accepts_marketing);
CREATE INDEX IF NOT EXISTS idx_customers_sequence ON customers(email_sequence_day, next_email_at);

-- 5. Verify the columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'customers';
