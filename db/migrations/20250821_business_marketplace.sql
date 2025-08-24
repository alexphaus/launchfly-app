-- Business Marketplace Migration
-- Date: 2025-08-21
-- Purpose: Create Instant Business Marketplace with proven templates

-- Business Templates - Proven business models
CREATE TABLE IF NOT EXISTS business_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Template Identity
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- 'ai_service', 'digital_agency', 'content_service', etc.
  
  -- Business Context
  business_type TEXT NOT NULL, -- 'service', 'ecommerce', 'subscription', 'saas'
  industry TEXT NOT NULL, -- 'marketing', 'healthcare', 'finance', etc.
  
  -- Proven Performance Metrics
  proven_revenue DECIMAL(10,2) NOT NULL, -- Average monthly revenue
  success_rate DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
  time_to_first_sale INTEGER NOT NULL, -- Hours to first sale
  guarantee_confidence DECIMAL(3,2) NOT NULL, -- Confidence in guarantee
  
  -- Business Model
  business_model JSONB NOT NULL, -- Pricing, target customers, value prop, fulfillment
  
  -- Marketing Playbook
  marketing_playbook JSONB NOT NULL, -- Channels, campaigns, sequences
  
  -- Operational Requirements
  operational_requirements JSONB NOT NULL, -- Setup time, skills, automation level
  
  -- Success Metrics
  success_metrics JSONB NOT NULL, -- Revenue, customers, retention, etc.
  
  -- Risk Assessment
  risk_factors JSONB, -- Seasonality, competition, market size
  
  -- Template Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'deprecated')),
  
  -- Performance Tracking
  usage_count INTEGER DEFAULT 0,
  actual_performance JSONB, -- Real results from businesses using this template
  last_performance_update TIMESTAMP WITH TIME ZONE,
  last_confidence_update TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template Usage Tracking
CREATE TABLE IF NOT EXISTS template_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES business_templates(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Usage Context
  user_id UUID REFERENCES auth.users(id),
  customizations JSONB, -- How user customized the template
  
  -- Performance Tracking
  actual_revenue DECIMAL(10,2) DEFAULT 0,
  actual_first_sale_hours INTEGER,
  success_achieved BOOLEAN DEFAULT FALSE,
  
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(template_id, business_id)
);

-- Template Performance Analytics
CREATE TABLE IF NOT EXISTS template_performance_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES business_templates(id) ON DELETE CASCADE,
  
  -- Performance Snapshot
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Metrics for this period
  businesses_created INTEGER DEFAULT 0,
  successful_businesses INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  avg_time_to_first_sale DECIMAL(8,2),
  
  -- Calculated Performance
  period_success_rate DECIMAL(3,2),
  period_avg_revenue DECIMAL(10,2),
  confidence_score DECIMAL(3,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template Categories for Organization
CREATE TABLE IF NOT EXISTS template_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT, -- Emoji or icon identifier
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template Reviews and Ratings
CREATE TABLE IF NOT EXISTS template_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES business_templates(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  
  -- Review Content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  review_text TEXT,
  
  -- Review Context
  business_revenue DECIMAL(10,2), -- Revenue achieved with template
  time_to_success INTEGER, -- Days to reach success
  would_recommend BOOLEAN DEFAULT TRUE,
  
  -- Verification
  verified_purchase BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(template_id, user_id)
);

-- Template Marketplace Views
CREATE OR REPLACE VIEW marketplace_templates AS
SELECT 
  t.*,
  COALESCE(AVG(r.rating), 0) as avg_rating,
  COUNT(r.id) as review_count,
  COUNT(tu.id) as total_usage,
  COUNT(CASE WHEN tu.success_achieved THEN 1 END) as successful_usage,
  CASE 
    WHEN COUNT(tu.id) > 0 THEN 
      COUNT(CASE WHEN tu.success_achieved THEN 1 END)::DECIMAL / COUNT(tu.id)
    ELSE t.success_rate 
  END as actual_success_rate
FROM business_templates t
LEFT JOIN template_reviews r ON t.id = r.template_id
LEFT JOIN template_usage tu ON t.id = tu.template_id
WHERE t.status = 'active'
GROUP BY t.id;

-- Top Performing Templates View
CREATE OR REPLACE VIEW top_templates AS
SELECT 
  t.*,
  (t.proven_revenue * t.success_rate * t.guarantee_confidence) as performance_score,
  COUNT(tu.id) as usage_count,
  AVG(tu.actual_revenue) as avg_actual_revenue
FROM business_templates t
LEFT JOIN template_usage tu ON t.id = tu.template_id
WHERE t.status = 'active'
GROUP BY t.id
ORDER BY performance_score DESC;

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_business_templates_category 
ON business_templates(category, status);

CREATE INDEX IF NOT EXISTS idx_business_templates_performance 
ON business_templates(proven_revenue DESC, success_rate DESC);

CREATE INDEX IF NOT EXISTS idx_business_templates_industry 
ON business_templates(industry, business_type);

CREATE INDEX IF NOT EXISTS idx_template_usage_template_id 
ON template_usage(template_id, success_achieved);

CREATE INDEX IF NOT EXISTS idx_template_usage_business_id 
ON template_usage(business_id);

CREATE INDEX IF NOT EXISTS idx_template_reviews_template_id 
ON template_reviews(template_id, rating);

-- Functions for Template Management

-- Function to increment template usage
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE business_templates 
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update template performance
CREATE OR REPLACE FUNCTION update_template_performance(
  template_id UUID,
  business_revenue DECIMAL,
  first_sale_hours INTEGER,
  is_success BOOLEAN
)
RETURNS VOID AS $$
DECLARE
  current_usage INTEGER;
  current_success_rate DECIMAL;
BEGIN
  -- Get current usage stats
  SELECT usage_count INTO current_usage 
  FROM business_templates 
  WHERE id = template_id;
  
  -- Update template usage record
  UPDATE template_usage 
  SET actual_revenue = business_revenue,
      actual_first_sale_hours = first_sale_hours,
      success_achieved = is_success,
      last_updated = NOW()
  WHERE template_id = template_id;
  
  -- Recalculate success rate
  SELECT 
    COUNT(CASE WHEN success_achieved THEN 1 END)::DECIMAL / COUNT(*)
  INTO current_success_rate
  FROM template_usage 
  WHERE template_id = template_id;
  
  -- Update template with new performance data
  UPDATE business_templates 
  SET success_rate = COALESCE(current_success_rate, success_rate),
      last_performance_update = NOW(),
      updated_at = NOW()
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate template confidence
CREATE OR REPLACE FUNCTION calculate_template_confidence(template_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  usage_count INTEGER;
  success_rate DECIMAL;
  confidence DECIMAL;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(CASE WHEN success_achieved THEN 1 END)::DECIMAL / COUNT(*)
  INTO usage_count, success_rate
  FROM template_usage 
  WHERE template_id = template_id;
  
  -- Confidence increases with usage and success rate
  confidence := LEAST(0.95, (usage_count::DECIMAL / 50) * success_rate);
  
  RETURN COALESCE(confidence, 0.1);
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic updates
CREATE OR REPLACE FUNCTION update_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER business_templates_update_timestamp
  BEFORE UPDATE ON business_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_template_timestamp();

CREATE TRIGGER template_usage_update_timestamp
  BEFORE UPDATE ON template_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_template_timestamp();

-- Seed initial template categories
INSERT INTO template_categories (name, description, icon, sort_order) VALUES
('AI Services', 'AI-powered service businesses', '🤖', 1),
('Digital Agencies', 'Marketing and digital service agencies', '📈', 2),
('Content Services', 'Content creation and curation services', '📝', 3),
('E-commerce', 'Online retail and product businesses', '🛒', 4),
('SaaS Tools', 'Software as a Service businesses', '💻', 5),
('Consulting', 'Professional consulting services', '💼', 6),
('Education', 'Online courses and training', '🎓', 7),
('Local Services', 'Location-based service businesses', '🏪', 8)
ON CONFLICT (name) DO NOTHING;
