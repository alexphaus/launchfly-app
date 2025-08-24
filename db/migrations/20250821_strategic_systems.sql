-- Strategic Systems Migration
-- Date: 2025-08-21
-- Purpose: Support guarantee engine, revenue sharing, real acquisition, and transparency

-- Guarantee Payouts Tracking
CREATE TABLE IF NOT EXISTS guarantee_payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  payout_id TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL, -- '48h_guarantee_miss', '60d_guarantee_miss'
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  stripe_payout_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Revenue Share Transactions
CREATE TABLE IF NOT EXISTS revenue_share_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  payment_intent_id TEXT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  business_amount DECIMAL(10,2) NOT NULL,
  launchfly_fee DECIMAL(10,2) NOT NULL,
  revenue_share_percentage DECIMAL(5,4) NOT NULL,
  plan_tier TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Acquisition Campaigns
CREATE TABLE IF NOT EXISTS acquisition_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  strategy JSONB NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  channels_launched JSONB DEFAULT '[]',
  total_prospects INTEGER DEFAULT 0,
  total_conversions INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  next_optimization_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Ad Campaigns
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'facebook', 'google', 'linkedin'
  campaign_name TEXT NOT NULL,
  budget DECIMAL(10,2) NOT NULL,
  targeting JSONB,
  ad_copy JSONB,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  cost_spent DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Marketplace Listings
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'fiverr', 'upwork', 'freelancer'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  pricing JSONB NOT NULL,
  tags TEXT[],
  status TEXT DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'active', 'paused', 'rejected')),
  orders_received INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Public Metrics for Transparency
CREATE TABLE IF NOT EXISTS public_metrics (
  id TEXT PRIMARY KEY, -- 'current'
  metrics JSONB NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business Proof Pages
CREATE TABLE IF NOT EXISTS business_proof_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  subdomain TEXT UNIQUE NOT NULL,
  metrics JSONB NOT NULL,
  sales_data JSONB DEFAULT '[]',
  testimonials JSONB DEFAULT '[]',
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'stripe_verified')),
  verified_revenue DECIMAL(10,2),
  last_verified TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue Verifications
CREATE TABLE IF NOT EXISTS revenue_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  verification_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'expired')),
  verified_revenue DECIMAL(10,2),
  stripe_account_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Customer Testimonials
CREATE TABLE IF NOT EXISTS customer_testimonials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  testimonial_text TEXT NOT NULL,
  order_id UUID,
  verified BOOLEAN DEFAULT FALSE,
  verification_method TEXT, -- 'email', 'stripe', 'manual'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Business Reviews (for satisfaction scoring)
CREATE TABLE IF NOT EXISTS business_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  would_recommend BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_guarantee_payouts_business_id ON guarantee_payouts(business_id);
CREATE INDEX IF NOT EXISTS idx_guarantee_payouts_status ON guarantee_payouts(status, created_at);

CREATE INDEX IF NOT EXISTS idx_revenue_share_business_id ON revenue_share_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_revenue_share_created_at ON revenue_share_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_acquisition_campaigns_business_id ON acquisition_campaigns(business_id);
CREATE INDEX IF NOT EXISTS idx_acquisition_campaigns_status ON acquisition_campaigns(status, next_optimization_at);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_business_id ON ad_campaigns(business_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_platform ON ad_campaigns(platform, status);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_business_id ON marketplace_listings(business_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_platform ON marketplace_listings(platform, status);

CREATE INDEX IF NOT EXISTS idx_business_proof_pages_subdomain ON business_proof_pages(subdomain);
CREATE INDEX IF NOT EXISTS idx_business_proof_pages_verification ON business_proof_pages(verification_status, last_updated);

CREATE INDEX IF NOT EXISTS idx_revenue_verifications_token ON revenue_verifications(verification_token);
CREATE INDEX IF NOT EXISTS idx_revenue_verifications_business_id ON revenue_verifications(business_id, status);

CREATE INDEX IF NOT EXISTS idx_customer_testimonials_business_id ON customer_testimonials(business_id, verified);
CREATE INDEX IF NOT EXISTS idx_business_reviews_business_id ON business_reviews(business_id, created_at);

-- Functions for Transparency Engine

-- Function to update public metrics
CREATE OR REPLACE FUNCTION update_public_metrics()
RETURNS VOID AS $$
DECLARE
  total_businesses INTEGER;
  total_revenue DECIMAL;
  success_rate DECIMAL;
  live_users INTEGER;
BEGIN
  -- Calculate metrics
  SELECT COUNT(*) INTO total_businesses FROM businesses WHERE status = 'ready';
  SELECT COALESCE(SUM(total_revenue), 0) INTO total_revenue FROM businesses WHERE status = 'ready';
  SELECT COUNT(*) INTO live_users FROM sessions WHERE created_at > NOW() - INTERVAL '10 minutes';
  
  -- Calculate success rate
  SELECT 
    CASE WHEN total_businesses > 0 
    THEN COUNT(*)::DECIMAL / total_businesses 
    ELSE 0 END
  INTO success_rate
  FROM businesses 
  WHERE status = 'ready' AND total_revenue >= 1000;
  
  -- Update public metrics
  INSERT INTO public_metrics (id, metrics, last_updated)
  VALUES (
    'current',
    jsonb_build_object(
      'totalBusinessesCreated', total_businesses,
      'totalRevenueGenerated', total_revenue,
      'successRate', success_rate,
      'liveUsers', live_users,
      'lastUpdated', NOW()
    ),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    metrics = EXCLUDED.metrics,
    last_updated = EXCLUDED.last_updated;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate business success metrics
CREATE OR REPLACE FUNCTION calculate_business_success_metrics(business_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  total_sales INTEGER;
  total_revenue DECIMAL;
  first_sale_date TIMESTAMP;
  launch_date TIMESTAMP;
  time_to_first_sale INTERVAL;
BEGIN
  -- Get business data
  SELECT created_at INTO launch_date FROM businesses WHERE id = business_uuid;
  SELECT first_sale_date INTO first_sale_date FROM businesses WHERE id = business_uuid;
  
  -- Get sales data
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO total_sales, total_revenue
  FROM sales 
  WHERE business_id = business_uuid;
  
  -- Calculate time to first sale
  IF first_sale_date IS NOT NULL THEN
    time_to_first_sale := first_sale_date - launch_date;
  END IF;
  
  -- Build result
  result := jsonb_build_object(
    'totalSales', total_sales,
    'totalRevenue', total_revenue,
    'firstSaleDate', first_sale_date,
    'launchDate', launch_date,
    'timeToFirstSaleHours', EXTRACT(EPOCH FROM time_to_first_sale) / 3600
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic updates
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ad_campaigns_update_timestamp
  BEFORE UPDATE ON ad_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER marketplace_listings_update_timestamp
  BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Initial data
INSERT INTO public_metrics (id, metrics, last_updated) VALUES (
  'current',
  '{"totalBusinessesCreated": 0, "totalRevenueGenerated": 0, "successRate": 0, "liveUsers": 0}',
  NOW()
) ON CONFLICT (id) DO NOTHING;
