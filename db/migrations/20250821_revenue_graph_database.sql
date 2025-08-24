-- Revenue Graph Database Migration
-- Date: 2025-08-21
-- Purpose: Create the proprietary Revenue Graph Database for competitive moat

-- Revenue Patterns - Raw conversion data
CREATE TABLE IF NOT EXISTS revenue_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Business Context
  business_type TEXT NOT NULL, -- 'ecommerce', 'service', 'saas', 'consulting'
  industry TEXT NOT NULL, -- 'fitness', 'marketing', 'healthcare', etc.
  
  -- Offer Context  
  offer_type TEXT NOT NULL, -- 'lead-magnet', 'product', 'service', 'consultation'
  offer_price DECIMAL(10,2),
  offer_name TEXT,
  
  -- Channel Context
  channel TEXT NOT NULL, -- 'email', 'social', 'ads', 'organic', 'referral'
  channel_details JSONB, -- Specific platform, campaign details
  
  -- Message Context
  message_template TEXT, -- The actual message/copy that converted
  message_type TEXT, -- 'cold_email', 'ad_copy', 'landing_page', 'social_post'
  
  -- Timing Context
  timing_pattern JSONB, -- { dayOfWeek: 2, hourOfDay: 14, timezone: 'PST' }
  
  -- Conversion Results
  conversion_rate DECIMAL(5,4) NOT NULL, -- 0.0000 to 1.0000
  avg_order_value DECIMAL(10,2) DEFAULT 0,
  
  -- Customer Context
  customer_profile JSONB, -- Demographics, behavior, source
  
  -- Campaign Context  
  campaign_context JSONB, -- A/B test variant, campaign settings
  
  -- Quality Metrics
  sample_size INTEGER DEFAULT 1,
  confidence_score DECIMAL(3,2) DEFAULT 0.1, -- 0.00 to 1.00
  
  -- Failure Analysis (for failed conversions)
  failure_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue Pattern Aggregates - Processed intelligence
CREATE TABLE IF NOT EXISTS revenue_pattern_aggregates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_key TEXT UNIQUE NOT NULL, -- business_type_industry_offer_channel
  
  -- Pattern Dimensions
  business_type TEXT NOT NULL,
  industry TEXT NOT NULL, 
  offer_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  
  -- Aggregated Performance
  conversion_rate DECIMAL(5,4) NOT NULL, -- Weighted average
  avg_order_value DECIMAL(10,2) NOT NULL, -- Weighted average
  
  -- Statistical Confidence
  sample_size INTEGER NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
  
  -- Best Performing Elements
  best_message_template TEXT,
  best_timing JSONB, -- Optimal timing pattern
  best_customer_profile JSONB, -- Ideal customer characteristics
  
  -- Performance Trends
  trend_direction TEXT, -- 'improving', 'declining', 'stable'
  last_30_days_performance DECIMAL(5,4),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business Success Predictions
CREATE TABLE IF NOT EXISTS business_success_predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Prediction Results
  success_probability DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
  projected_revenue DECIMAL(10,2) NOT NULL,
  projected_timeframe_days INTEGER,
  
  -- Prediction Basis
  based_on_patterns INTEGER, -- Number of similar patterns used
  confidence_level TEXT, -- 'low', 'medium', 'high'
  
  -- Recommendations
  recommendations JSONB, -- Array of AI-generated recommendations
  
  -- Prediction Accuracy Tracking
  actual_outcome DECIMAL(10,2), -- Filled in later for accuracy measurement
  prediction_accuracy DECIMAL(3,2), -- How accurate was this prediction
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- Conversion Intelligence Cache
CREATE TABLE IF NOT EXISTS conversion_intelligence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Query Context
  business_type TEXT NOT NULL,
  industry TEXT NOT NULL,
  query_hash TEXT UNIQUE NOT NULL, -- Hash of query parameters
  
  -- Intelligence Results
  top_strategies JSONB NOT NULL, -- Top performing strategies for this context
  timing_insights JSONB, -- Best timing patterns
  message_insights JSONB, -- Best performing messages
  
  -- Cache Metadata
  cache_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
  hit_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue Graph Analytics Views
CREATE OR REPLACE VIEW revenue_graph_summary AS
SELECT 
  business_type,
  industry,
  COUNT(*) as total_patterns,
  AVG(conversion_rate) as avg_conversion_rate,
  AVG(avg_order_value) as avg_order_value,
  SUM(sample_size) as total_samples,
  MAX(confidence_score) as max_confidence
FROM revenue_pattern_aggregates
GROUP BY business_type, industry;

-- Top Performing Strategies View
CREATE OR REPLACE VIEW top_strategies AS
SELECT 
  business_type,
  industry,
  offer_type,
  channel,
  conversion_rate,
  avg_order_value,
  sample_size,
  confidence_score,
  (conversion_rate * avg_order_value * confidence_score) as performance_score
FROM revenue_pattern_aggregates
WHERE confidence_score >= 0.3
ORDER BY performance_score DESC;

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_revenue_patterns_business_context 
ON revenue_patterns(business_type, industry, offer_type, channel);

CREATE INDEX IF NOT EXISTS idx_revenue_patterns_performance 
ON revenue_patterns(conversion_rate DESC, confidence_score DESC);

CREATE INDEX IF NOT EXISTS idx_revenue_patterns_timing 
ON revenue_patterns USING GIN(timing_pattern);

CREATE INDEX IF NOT EXISTS idx_revenue_aggregates_pattern_key 
ON revenue_pattern_aggregates(pattern_key);

CREATE INDEX IF NOT EXISTS idx_revenue_aggregates_performance 
ON revenue_pattern_aggregates(conversion_rate DESC, sample_size DESC);

CREATE INDEX IF NOT EXISTS idx_business_predictions_business_id 
ON business_success_predictions(business_id);

CREATE INDEX IF NOT EXISTS idx_conversion_intelligence_query 
ON conversion_intelligence(query_hash, cache_expires_at);

-- Triggers for automatic updates
CREATE OR REPLACE FUNCTION update_revenue_pattern_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER revenue_patterns_update_timestamp
  BEFORE UPDATE ON revenue_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_revenue_pattern_timestamp();

CREATE TRIGGER revenue_aggregates_update_timestamp
  BEFORE UPDATE ON revenue_pattern_aggregates  
  FOR EACH ROW
  EXECUTE FUNCTION update_revenue_pattern_timestamp();

-- Function to clean expired cache
CREATE OR REPLACE FUNCTION clean_expired_intelligence_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM conversion_intelligence 
  WHERE cache_expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate pattern confidence
CREATE OR REPLACE FUNCTION calculate_pattern_confidence(sample_count INTEGER)
RETURNS DECIMAL(3,2) AS $$
BEGIN
  -- Confidence increases with sample size, caps at 0.95
  RETURN LEAST(0.95, sample_count::DECIMAL / 100);
END;
$$ LANGUAGE plpgsql;
