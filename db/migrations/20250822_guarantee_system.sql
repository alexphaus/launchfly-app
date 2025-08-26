-- Revenue Guarantee System Migration
-- Date: 2025-08-22
-- Purpose: Track and enforce Launchfly's revenue guarantees

-- Revenue Guarantees Table
CREATE TABLE IF NOT EXISTS revenue_guarantees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Guarantee Configuration
  guarantee_type TEXT DEFAULT 'standard' CHECK (guarantee_type IN ('standard', 'premium', 'custom')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- First Sale Guarantee (48 hours)
  first_sale_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  first_sale_payout DECIMAL(10,2) DEFAULT 100,
  first_sale_met BOOLEAN DEFAULT FALSE,
  first_sale_met_at TIMESTAMP WITH TIME ZONE,
  first_sale_payout_completed BOOLEAN DEFAULT FALSE,
  first_sale_payout_at TIMESTAMP WITH TIME ZONE,
  first_sale_payout_id TEXT, -- Stripe transfer ID
  
  -- Revenue Target Guarantee ($1000 in 60 days)
  revenue_target DECIMAL(10,2) DEFAULT 1000,
  revenue_target_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  revenue_target_met BOOLEAN DEFAULT FALSE,
  revenue_target_met_at TIMESTAMP WITH TIME ZONE,
  final_revenue DECIMAL(10,2),
  
  -- Free Service Mode
  free_service_activated BOOLEAN DEFAULT FALSE,
  free_service_activated_at TIMESTAMP WITH TIME ZONE,
  free_service_ended_at TIMESTAMP WITH TIME ZONE,
  
  -- Status Tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'free_service', 'cancelled')),
  needs_manual_review BOOLEAN DEFAULT FALSE,
  review_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled Guarantee Checks
CREATE TABLE IF NOT EXISTS scheduled_guarantee_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  guarantee_id UUID REFERENCES revenue_guarantees(id) ON DELETE CASCADE,
  
  check_type TEXT NOT NULL CHECK (check_type IN ('first_sale', 'revenue_target', 'progress')),
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  result JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emergency Acquisition Actions
CREATE TABLE IF NOT EXISTS guarantee_emergency_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  
  revenue_target DECIMAL(10,2) NOT NULL,
  strategies JSONB NOT NULL,
  
  activated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deactivated_at TIMESTAMP WITH TIME ZONE,
  
  results JSONB,
  success BOOLEAN,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guarantee Payouts History
CREATE TABLE IF NOT EXISTS guarantee_payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  
  payout_type TEXT NOT NULL CHECK (payout_type IN ('first_sale', 'milestone', 'refund')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  stripe_transfer_id TEXT,
  stripe_payout_id TEXT,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  processed_at TIMESTAMP WITH TIME ZONE,
  failed_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add guarantee tracking to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS revenue_share_suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS revenue_share_suspended_reason TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS guarantee_id UUID REFERENCES revenue_guarantees(id);

-- Views for monitoring
CREATE OR REPLACE VIEW active_guarantees AS
SELECT 
  g.*,
  b.name as business_name,
  b.total_revenue as current_revenue,
  b.first_payment_at,
  EXTRACT(EPOCH FROM (g.first_sale_deadline - NOW()))/3600 as hours_until_first_sale_deadline,
  EXTRACT(EPOCH FROM (g.revenue_target_deadline - NOW()))/86400 as days_until_revenue_deadline,
  CASE 
    WHEN g.first_sale_met THEN 'Met'
    WHEN NOW() > g.first_sale_deadline THEN 'Failed'
    ELSE 'Pending'
  END as first_sale_status,
  CASE 
    WHEN g.revenue_target_met THEN 'Met'
    WHEN NOW() > g.revenue_target_deadline THEN 'Failed'
    WHEN b.total_revenue >= g.revenue_target THEN 'Met'
    ELSE 'In Progress'
  END as revenue_status
FROM revenue_guarantees g
JOIN businesses b ON g.business_id = b.id
WHERE g.status = 'active';

-- View for guarantees needing attention
CREATE OR REPLACE VIEW guarantees_needing_action AS
SELECT * FROM active_guarantees
WHERE 
  (hours_until_first_sale_deadline < 24 AND NOT first_sale_met) OR
  (days_until_revenue_deadline < 7 AND current_revenue < revenue_target * 0.5) OR
  needs_manual_review = TRUE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_revenue_guarantees_business_id 
ON revenue_guarantees(business_id, status);

CREATE INDEX IF NOT EXISTS idx_revenue_guarantees_deadlines 
ON revenue_guarantees(first_sale_deadline, revenue_target_deadline);

CREATE INDEX IF NOT EXISTS idx_scheduled_checks_pending 
ON scheduled_guarantee_checks(scheduled_for, status) 
WHERE status = 'pending';

-- Function to check guarantees automatically
CREATE OR REPLACE FUNCTION check_pending_guarantees()
RETURNS INTEGER AS $$
DECLARE
  checked_count INTEGER := 0;
  guarantee_record RECORD;
BEGIN
  -- Check first sale guarantees
  FOR guarantee_record IN 
    SELECT g.*, b.first_payment_at 
    FROM revenue_guarantees g
    JOIN businesses b ON g.business_id = b.id
    WHERE g.status = 'active' 
    AND NOT g.first_sale_met 
    AND NOW() >= g.first_sale_deadline
  LOOP
    IF guarantee_record.first_payment_at IS NULL THEN
      -- Mark for payout
      UPDATE revenue_guarantees 
      SET needs_manual_review = TRUE,
          review_reason = 'First sale guarantee deadline passed - needs payout'
      WHERE id = guarantee_record.id;
    ELSE
      -- Mark as met
      UPDATE revenue_guarantees 
      SET first_sale_met = TRUE,
          first_sale_met_at = guarantee_record.first_payment_at
      WHERE id = guarantee_record.id;
    END IF;
    checked_count := checked_count + 1;
  END LOOP;
  
  -- Check revenue guarantees
  FOR guarantee_record IN 
    SELECT g.*, b.total_revenue 
    FROM revenue_guarantees g
    JOIN businesses b ON g.business_id = b.id
    WHERE g.status = 'active' 
    AND NOT g.revenue_target_met 
    AND NOW() >= g.revenue_target_deadline
  LOOP
    IF guarantee_record.total_revenue >= guarantee_record.revenue_target THEN
      -- Mark as met
      UPDATE revenue_guarantees 
      SET revenue_target_met = TRUE,
          revenue_target_met_at = NOW(),
          final_revenue = guarantee_record.total_revenue,
          status = 'completed'
      WHERE id = guarantee_record.id;
    ELSE
      -- Activate free service
      UPDATE revenue_guarantees 
      SET free_service_activated = TRUE,
          free_service_activated_at = NOW(),
          status = 'free_service'
      WHERE id = guarantee_record.id;
      
      UPDATE businesses 
      SET revenue_share_suspended = TRUE,
          revenue_share_suspended_reason = 'guarantee_activation'
      WHERE id = guarantee_record.business_id;
    END IF;
    checked_count := checked_count + 1;
  END LOOP;
  
  RETURN checked_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE TRIGGER revenue_guarantees_update_timestamp
  BEFORE UPDATE ON revenue_guarantees
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
