-- Available Balance System Migration
-- Date: 2025-09-22
-- Purpose: Add available balance tracking and cashout functionality

-- Add available_balance field to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS available_balance DECIMAL(10,2) DEFAULT 0;

-- Create cashout_transactions table to track withdrawal history
CREATE TABLE IF NOT EXISTS cashout_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Transaction Details
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  
  -- Processing Details
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processor TEXT DEFAULT 'stripe', -- 'stripe', 'bank_transfer', 'paypal'
  processor_transaction_id TEXT,
  
  -- Metadata
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Bank/Payment Details (encrypted/tokenized in production)
  payment_method_details JSONB, -- Store payment method info
  
  -- Failure handling
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cashout_transactions_business_id ON cashout_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_cashout_transactions_status ON cashout_transactions(status);
CREATE INDEX IF NOT EXISTS idx_cashout_transactions_requested_at ON cashout_transactions(requested_at);

-- Initialize available_balance for existing businesses
-- Set it to total_revenue for existing businesses as a one-time migration
UPDATE businesses 
SET available_balance = COALESCE(total_revenue, 0) 
WHERE available_balance IS NULL OR available_balance = 0;

-- Add updated_at trigger for cashout_transactions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cashout_transactions_updated_at 
    BEFORE UPDATE ON cashout_transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
