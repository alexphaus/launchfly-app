-- Migration: Add blast credits system
-- Run this in Supabase SQL Editor

-- Add blast_credits column to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS blast_credits DECIMAL(10,2) DEFAULT 0;

-- Add blast_credits_used for tracking
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS blast_credits_used DECIMAL(10,2) DEFAULT 0;

-- Create blast_transactions table for history/audit
CREATE TABLE IF NOT EXISTS blast_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('topup', 'blast', 'bonus', 'refund')),
  amount DECIMAL(10,2) NOT NULL,
  recipient_count INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_blast_transactions_business 
ON blast_transactions(business_id, created_at DESC);

-- Grant ₱500 free credits to all existing activated businesses
UPDATE businesses 
SET blast_credits = 500 
WHERE status = 'ready' AND blast_credits = 0;
