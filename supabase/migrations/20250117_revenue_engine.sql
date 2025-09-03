-- Revenue Generation Engine Migration
-- Date: 2025-01-17
-- Purpose: Complete money generation system for Launchfly

-- Revenue Streams Table
CREATE TABLE IF NOT EXISTS revenue_streams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('product_sales', 'services', 'subscriptions', 'digital_downloads', 'affiliate', 'upsells')),
  name TEXT NOT NULL,
  configuration JSONB NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
  projected_revenue DECIMAL(10,2),
  actual_revenue DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Table (Enhanced)
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  cost DECIMAL(10,2),
  category TEXT,
  features JSONB,
  image_url TEXT,
  images JSONB,
  sku TEXT,
  barcode TEXT,
  inventory_quantity INTEGER DEFAULT 0,
  track_inventory BOOLEAN DEFAULT false,
  weight DECIMAL(10,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  seo_title TEXT,
  seo_description TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Services Table
CREATE TABLE IF NOT EXISTS services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  tiers JSONB NOT NULL, -- Array of service tiers with pricing
  average_rating DECIMAL(2,1) DEFAULT 0,
  completed_orders INTEGER DEFAULT 0,
  delivery_time TEXT,
  revisions INTEGER,
  requirements JSONB,
  portfolio_items JSONB,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  monthly_price DECIMAL(10,2),
  annual_price DECIMAL(10,2),
  features JSONB NOT NULL,
  trial_days INTEGER DEFAULT 7,
  setup_fee DECIMAL(10,2) DEFAULT 0,
  max_users INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Digital Products Table
CREATE TABLE IF NOT EXISTS digital_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  asset_url TEXT,
  preview_url TEXT,
  download_limit INTEGER DEFAULT 5,
  download_expiry_days INTEGER DEFAULT 30,
  category TEXT,
  file_type TEXT,
  file_size BIGINT,
  tags TEXT[],
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Affiliate Programs Table
CREATE TABLE IF NOT EXISTS affiliate_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  product_name TEXT,
  commission_rate DECIMAL(5,2) NOT NULL, -- Percentage
  cookie_duration INTEGER DEFAULT 30, -- Days
  affiliate_link TEXT,
  tracking_code TEXT,
  total_clicks INTEGER DEFAULT 0,
  total_conversions INTEGER DEFAULT 0,
  total_commissions DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders Table (Enhanced)
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  order_number TEXT UNIQUE,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  product_type TEXT CHECK (product_type IN ('product', 'service', 'subscription', 'digital', 'mixed')),
  product_id UUID,
  product_name TEXT,
  items JSONB,
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  shipping DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  fulfillment_status TEXT DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'processing', 'in_progress', 'shipping', 'completed', 'cancelled', 'review')),
  fulfillment_data JSONB,
  shipping_address JSONB,
  billing_address JSONB,
  notes TEXT,
  tags TEXT[],
  metadata JSONB,
  requirements TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE
);

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID,
  plan_id UUID REFERENCES subscription_plans(id),
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'cancelled', 'past_due', 'paused')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Revenue Transactions Table
CREATE TABLE IF NOT EXISTS revenue_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  amount DECIMAL(10,2) NOT NULL,
  fee DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2),
  source TEXT NOT NULL, -- 'stripe', 'paypal', 'manual', etc.
  type TEXT CHECK (type IN ('sale', 'refund', 'fee', 'adjustment')),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market Analysis Table
CREATE TABLE IF NOT EXISTS market_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  analysis JSONB NOT NULL,
  confidence_score DECIMAL(3,2),
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Applied Optimizations Table
CREATE TABLE IF NOT EXISTS applied_optimizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  optimizations JSONB NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'testing', 'completed', 'reverted')),
  performance_impact JSONB,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reverted_at TIMESTAMP WITH TIME ZONE
);

-- Conversion Metrics Table
CREATE TABLE IF NOT EXISTS conversion_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  visitors INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  add_to_carts INTEGER DEFAULT 0,
  checkouts_initiated INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  conversion_rate DECIMAL(5,4),
  average_order_value DECIMAL(10,2),
  cart_abandonment_rate DECIMAL(5,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, date)
);

-- Marketplace Listings Table
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL,
  listings JSONB NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready_to_post', 'posted', 'inactive')),
  posted_at TIMESTAMP WITH TIME ZONE,
  metrics JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Marketplace Connections Table
CREATE TABLE IF NOT EXISTS marketplace_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL,
  connection_data JSONB,
  credentials JSONB, -- Encrypted in production
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'error')),
  last_sync TIMESTAMP WITH TIME ZONE,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, marketplace)
);

-- Fulfillment Rules Table
CREATE TABLE IF NOT EXISTS fulfillment_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  rules JSONB NOT NULL,
  automation_level TEXT DEFAULT 'high' CHECK (automation_level IN ('manual', 'medium', 'high', 'very_high')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deliverables Table
CREATE TABLE IF NOT EXISTS deliverables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'ready_for_review', 'approved', 'delivered')),
  revision_count INTEGER DEFAULT 0,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Shipping Orders Table
CREATE TABLE IF NOT EXISTS shipping_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  shipping_address JSONB NOT NULL,
  items JSONB NOT NULL,
  carrier TEXT,
  service TEXT,
  tracking_number TEXT,
  shipping_label_url TEXT,
  cost DECIMAL(10,2),
  estimated_delivery TIMESTAMP WITH TIME ZONE,
  actual_delivery TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'in_transit', 'delivered', 'returned')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Email Campaigns Table
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('automated', 'triggered', 'broadcast')),
  trigger TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed')),
  emails JSONB NOT NULL,
  metrics JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Tracking Table
CREATE TABLE IF NOT EXISTS email_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
  email_id TEXT,
  recipient_email TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE
);

-- Social Commerce Config Table
CREATE TABLE IF NOT EXISTS social_commerce_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  channels JSONB NOT NULL,
  content_calendar JSONB,
  funnels JSONB,
  engagement_rules JSONB,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social Posts Table
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  platforms TEXT[],
  content TEXT NOT NULL,
  media_urls JSONB,
  hashtags TEXT[],
  scheduled_for TIMESTAMP WITH TIME ZONE,
  posted_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'posted', 'failed')),
  metrics JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue Engine Status Table
CREATE TABLE IF NOT EXISTS revenue_engine_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  status TEXT DEFAULT 'initializing' CHECK (status IN ('initializing', 'active', 'paused', 'error')),
  streams_count INTEGER DEFAULT 0,
  projected_monthly_revenue DECIMAL(10,2),
  actual_monthly_revenue DECIMAL(10,2) DEFAULT 0,
  last_optimization TIMESTAMP WITH TIME ZONE,
  optimization_version INTEGER DEFAULT 0,
  initialized_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business Metrics Table
CREATE TABLE IF NOT EXISTS business_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  revenue DECIMAL(10,2) DEFAULT 0,
  orders INTEGER DEFAULT 0,
  customers INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,4),
  average_order_value DECIMAL(10,2),
  customer_lifetime_value DECIMAL(10,2),
  churn_rate DECIMAL(5,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, date)
);

-- Create indexes for performance
CREATE INDEX idx_revenue_streams_business_id ON revenue_streams(business_id);
CREATE INDEX idx_products_business_id ON products(business_id);
CREATE INDEX idx_services_business_id ON services(business_id);
CREATE INDEX idx_orders_business_id ON orders(business_id);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_subscriptions_business_id ON subscriptions(business_id);
CREATE INDEX idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX idx_revenue_transactions_business_id ON revenue_transactions(business_id);
CREATE INDEX idx_revenue_transactions_created_at ON revenue_transactions(created_at);
CREATE INDEX idx_conversion_metrics_business_id_date ON conversion_metrics(business_id, date);
CREATE INDEX idx_social_posts_scheduled_for ON social_posts(scheduled_for);
CREATE INDEX idx_email_tracking_recipient ON email_tracking(recipient_email);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_revenue_streams_updated_at BEFORE UPDATE ON revenue_streams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_listings_updated_at BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_campaigns_updated_at BEFORE UPDATE ON email_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust based on your auth setup)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
