-- Migration: Add future-proof business intelligence columns
-- Run this in your Supabase SQL editor

-- Add new columns to businesses table for enhanced intelligence
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS opportunity_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS validation_data JSONB DEFAULT '{}', 
ADD COLUMN IF NOT EXISTS customer_plan JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS success_plan JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS revenue_milestones JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS current_stage TEXT DEFAULT 'discovery',
ADD COLUMN IF NOT EXISTS success_score INTEGER DEFAULT 0;

-- Create leads table for contact form submissions
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create analytics table for tracking business performance
CREATE TABLE IF NOT EXISTS public.analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create value_layers table for tracking which services customers have
CREATE TABLE IF NOT EXISTS public.value_layers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  layer_type TEXT NOT NULL CHECK (layer_type IN ('discovery', 'validation', 'creation', 'acquisition', 'scale')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  price INTEGER NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_layers ENABLE ROW LEVEL SECURITY;

-- Policies for leads table
CREATE POLICY "Business owners can manage their leads" ON leads
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Policies for analytics table  
CREATE POLICY "Business owners can view their analytics" ON analytics
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Policies for value_layers table
CREATE POLICY "Business owners can manage their value layers" ON value_layers
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leads_business_id ON leads(business_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_business_id ON analytics(business_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at);

CREATE INDEX IF NOT EXISTS idx_value_layers_business_id ON value_layers(business_id);
CREATE INDEX IF NOT EXISTS idx_value_layers_layer_type ON value_layers(layer_type);
CREATE INDEX IF NOT EXISTS idx_value_layers_status ON value_layers(status);

-- Create function to increment business views
CREATE OR REPLACE FUNCTION increment_views(business_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE businesses 
  SET views = COALESCE(views, 0) + 1,
      updated_at = NOW()
  WHERE id = business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to calculate success score
CREATE OR REPLACE FUNCTION calculate_success_score(business_id UUID)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  leads_count INTEGER;
  analytics_count INTEGER;
  days_since_launch INTEGER;
BEGIN
  -- Count leads
  SELECT COUNT(*) INTO leads_count FROM leads WHERE business_id = business_id;
  
  -- Count page views
  SELECT COUNT(*) INTO analytics_count FROM analytics 
  WHERE business_id = business_id AND event_type = 'page_view';
  
  -- Days since launch
  SELECT EXTRACT(DAY FROM NOW() - created_at) INTO days_since_launch 
  FROM businesses WHERE id = business_id;
  
  -- Calculate score (simplified algorithm)
  score := LEAST(100, 
    (leads_count * 10) + 
    (analytics_count * 2) + 
    (CASE WHEN days_since_launch > 30 THEN 20 ELSE 0 END)
  );
  
  RETURN score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing businesses to have default values
UPDATE public.businesses 
SET 
  opportunity_data = '{"analyzed": false}',
  validation_data = '{"validated": false}',
  customer_plan = '{"created": false}',
  success_plan = '{"milestones": []}',
  current_stage = 'discovery',
  success_score = 0
WHERE 
  opportunity_data IS NULL OR 
  validation_data IS NULL OR 
  customer_plan IS NULL OR 
  success_plan IS NULL;
