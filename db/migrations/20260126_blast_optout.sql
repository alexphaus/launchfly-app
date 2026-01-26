-- Migration: Add blast opt-out and tracking fields to customers
-- Run this in Supabase SQL Editor

-- Add blast_optout column (default false = customer receives blasts)
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS blast_optout BOOLEAN DEFAULT false;

-- Add last_blast_at to track when customer was last blasted
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS last_blast_at TIMESTAMPTZ;

-- Add index for faster blast queries
CREATE INDEX IF NOT EXISTS idx_customers_blast_optout 
ON customers(business_id, blast_optout) 
WHERE blast_optout = false;

-- Add index for service_records due date queries
CREATE INDEX IF NOT EXISTS idx_service_records_due_date
ON service_records(business_id, next_service_due_at)
WHERE next_service_due_at IS NOT NULL;

COMMENT ON COLUMN customers.blast_optout IS 'Customer opted out of promotional blasts';
COMMENT ON COLUMN customers.last_blast_at IS 'Timestamp of last blast message sent';
