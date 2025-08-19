-- Migration: Add AI Business Agent tables
-- Date: 2025-08-19

-- Market research storage
CREATE TABLE IF NOT EXISTS market_research (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  research_type TEXT NOT NULL,
  insights JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Competitor analysis storage
CREATE TABLE IF NOT EXISTS competitor_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  analysis_data JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Strategy reviews storage
CREATE TABLE IF NOT EXISTS strategy_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  review_data JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A/B test experiments
CREATE TABLE IF NOT EXISTS ab_experiments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  experiment_type TEXT NOT NULL, -- 'landing_page', 'email', 'pricing', etc.
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'completed'
  variants JSONB NOT NULL, -- Array of variant configurations
  traffic_split JSONB NOT NULL, -- Traffic allocation per variant
  success_metric TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  results JSONB,
  winner_variant_id TEXT,
  confidence_level DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI agent settings per business
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS ai_agent_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS ai_agent_settings JSONB DEFAULT '{
  "optimization_frequency": "hourly",
  "auto_implement_changes": true,
  "risk_tolerance": "medium",
  "focus_areas": ["conversion", "email", "pricing", "traffic"],
  "notification_preferences": {
    "major_changes": true,
    "daily_summary": true,
    "weekly_report": true
  }
}'::jsonb;

-- Performance alerts
CREATE TABLE IF NOT EXISTS performance_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  current_value DECIMAL NOT NULL,
  threshold_value DECIMAL NOT NULL,
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  status TEXT DEFAULT 'active', -- 'active', 'acknowledged', 'resolved'
  action_taken JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Partner prospects (for business development)
CREATE TABLE IF NOT EXISTS partner_prospects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_email TEXT,
  contact_name TEXT,
  partnership_type TEXT NOT NULL, -- 'supplier', 'affiliate', 'integration', 'joint_venture'
  status TEXT DEFAULT 'identified', -- 'identified', 'contacted', 'responded', 'negotiating', 'partner', 'declined'
  score INTEGER DEFAULT 0, -- AI-generated partner fit score 0-100
  notes TEXT,
  last_contact_date TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI optimization history
CREATE TABLE IF NOT EXISTS optimization_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  optimization_type TEXT NOT NULL,
  description TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  expected_impact TEXT,
  actual_impact JSONB,
  confidence_score DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'implemented', -- 'planned', 'implemented', 'testing', 'successful', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  evaluated_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_market_research_business_id ON market_research(business_id);
CREATE INDEX IF NOT EXISTS idx_market_research_generated_at ON market_research(generated_at);
CREATE INDEX IF NOT EXISTS idx_competitor_analysis_business_id ON competitor_analysis(business_id);
CREATE INDEX IF NOT EXISTS idx_strategy_reviews_business_id ON strategy_reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_ab_experiments_business_id ON ab_experiments(business_id);
CREATE INDEX IF NOT EXISTS idx_ab_experiments_status ON ab_experiments(status);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_business_id ON performance_alerts(business_id);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_status ON performance_alerts(status);
CREATE INDEX IF NOT EXISTS idx_partner_prospects_business_id ON partner_prospects(business_id);
CREATE INDEX IF NOT EXISTS idx_partner_prospects_status ON partner_prospects(status);
CREATE INDEX IF NOT EXISTS idx_optimization_history_business_id ON optimization_history(business_id);

-- Row Level Security (RLS) policies
ALTER TABLE market_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_history ENABLE ROW LEVEL SECURITY;

-- RLS policies (users can only see data for their businesses)
CREATE POLICY "Users can view their market research" ON market_research
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their competitor analysis" ON competitor_analysis
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their strategy reviews" ON strategy_reviews
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their AB experiments" ON ab_experiments
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their performance alerts" ON performance_alerts
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their partner prospects" ON partner_prospects
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their optimization history" ON optimization_history
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Service role can manage all AI agent data
CREATE POLICY "Service role can manage market research" ON market_research
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage competitor analysis" ON competitor_analysis
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage strategy reviews" ON strategy_reviews
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage AB experiments" ON ab_experiments
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage performance alerts" ON performance_alerts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage partner prospects" ON partner_prospects
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage optimization history" ON optimization_history
  FOR ALL USING (auth.role() = 'service_role');
