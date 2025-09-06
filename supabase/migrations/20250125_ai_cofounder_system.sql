-- AI Cofounder System Tables
-- Enhanced database schema for the adaptive AI cofounder

-- AI Personalities - Adaptive personality system
CREATE TABLE IF NOT EXISTS ai_personalities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  personality_data JSONB NOT NULL,
  traits TEXT[] DEFAULT '{}',
  communication_style TEXT DEFAULT 'professional_friendly',
  decision_making_style TEXT DEFAULT 'data_driven',
  risk_tolerance TEXT DEFAULT 'moderate',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business Plans - Strategic planning system
CREATE TABLE IF NOT EXISTS business_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'master_plan',
  plan_data JSONB NOT NULL,
  goals JSONB DEFAULT '[]',
  milestones JSONB DEFAULT '[]',
  tasks JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Insights - Strategic insights and recommendations
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  content TEXT NOT NULL,
  importance_score INTEGER DEFAULT 5,
  implementation_complexity TEXT DEFAULT 'medium',
  expected_impact TEXT,
  timeline TEXT,
  status TEXT DEFAULT 'identified',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations - Multi-channel conversation tracking
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  sender_email TEXT,
  sender_phone TEXT,
  sender_name TEXT,
  channel TEXT NOT NULL,
  incoming_message TEXT NOT NULL,
  response_message TEXT,
  intent_analysis JSONB DEFAULT '{}',
  response_metadata JSONB DEFAULT '{}',
  conversation_thread_id TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market Intelligence - Real-time market data
CREATE TABLE IF NOT EXISTS market_intelligence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  intelligence_type TEXT NOT NULL,
  intelligence_data JSONB NOT NULL,
  source TEXT,
  confidence_score INTEGER DEFAULT 7,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Competitor Intelligence - Competitive analysis
CREATE TABLE IF NOT EXISTS competitor_intelligence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  competitor_name TEXT,
  analysis_data JSONB NOT NULL,
  competitive_position TEXT,
  threat_level TEXT DEFAULT 'medium',
  opportunities JSONB DEFAULT '[]',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market Opportunities - Identified business opportunities
CREATE TABLE IF NOT EXISTS market_opportunities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  opportunity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  market_size TEXT,
  implementation_complexity TEXT DEFAULT 'medium',
  expected_roi TEXT,
  timeline TEXT,
  risk_level TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'identified',
  identified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pursued_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- A/B Tests - Dynamic optimization testing
CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  test_type TEXT NOT NULL,
  variants JSONB NOT NULL DEFAULT '[]',
  traffic_split DECIMAL DEFAULT 0.5,
  success_metric TEXT NOT NULL,
  hypothesis TEXT,
  status TEXT DEFAULT 'active',
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  results JSONB DEFAULT '{}',
  winner_variant TEXT,
  created_by TEXT DEFAULT 'ai_cofounder',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Page Variants - Landing page optimization variants
CREATE TABLE IF NOT EXISTS page_variants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  ab_test_id UUID REFERENCES ab_tests(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  variant_data JSONB NOT NULL,
  performance_metrics JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Analysis - Business performance insights
CREATE TABLE IF NOT EXISTS performance_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  analysis_data JSONB NOT NULL,
  recommendations JSONB DEFAULT '[]',
  performance_score INTEGER,
  analysis_type TEXT DEFAULT 'comprehensive',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Weekly Reviews - Comprehensive business reviews
CREATE TABLE IF NOT EXISTS weekly_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  review_data JSONB NOT NULL,
  next_week_plan JSONB DEFAULT '{}',
  achievements JSONB DEFAULT '[]',
  challenges JSONB DEFAULT '[]',
  week_start_date DATE NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Insights - Daily strategic insights
CREATE TABLE IF NOT EXISTS daily_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  insights_data JSONB NOT NULL,
  email_content JSONB,
  insights_count INTEGER DEFAULT 0,
  sent_to_user BOOLEAN DEFAULT FALSE,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business Tasks - Task management for AI cofounder
CREATE TABLE IF NOT EXISTS business_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  assigned_to TEXT DEFAULT 'ai_cofounder',
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_by TEXT DEFAULT 'ai_cofounder',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimization Reports - Detailed optimization tracking
CREATE TABLE IF NOT EXISTS optimization_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  report_data JSONB NOT NULL,
  optimizations_count INTEGER DEFAULT 0,
  opportunities_count INTEGER DEFAULT 0,
  expected_impact JSONB DEFAULT '{}',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Traffic Strategies - Traffic acquisition strategy tracking
CREATE TABLE IF NOT EXISTS traffic_strategies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  strategy_type TEXT NOT NULL,
  strategy_data JSONB NOT NULL,
  expected_traffic INTEGER,
  actual_traffic INTEGER,
  conversion_rate DECIMAL,
  status TEXT DEFAULT 'active',
  implemented_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  results_at TIMESTAMP WITH TIME ZONE
);

-- Customer Insights - Customer behavior and preferences
CREATE TABLE IF NOT EXISTS customer_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  customer_segment TEXT,
  insight_data JSONB NOT NULL,
  confidence_level INTEGER DEFAULT 7,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Human Escalations - When AI needs human intervention
CREATE TABLE IF NOT EXISTS human_escalations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  escalation_type TEXT NOT NULL,
  escalation_reason TEXT NOT NULL,
  contact_info JSONB NOT NULL,
  context JSONB DEFAULT '{}',
  urgency TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  assigned_to TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sentiment Tracking - Customer sentiment over time
CREATE TABLE IF NOT EXISTS sentiment_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  sentiment_score INTEGER NOT NULL,
  sentiment_source TEXT NOT NULL,
  sample_size INTEGER DEFAULT 1,
  positive_indicators JSONB DEFAULT '[]',
  negative_indicators JSONB DEFAULT '[]',
  tracked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add AI cofounder columns to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS ai_cofounder_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_cofounder_initialized_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ai_cofounder_settings JSONB DEFAULT '{}';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_personalities_business_id ON ai_personalities(business_id);
CREATE INDEX IF NOT EXISTS idx_business_plans_business_id ON business_plans(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_business_id ON ai_insights(business_id);
CREATE INDEX IF NOT EXISTS idx_conversations_business_id ON conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_market_intelligence_business_id ON market_intelligence(business_id);
CREATE INDEX IF NOT EXISTS idx_competitor_intelligence_business_id ON competitor_intelligence(business_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_business_id ON ab_tests(business_id);
CREATE INDEX IF NOT EXISTS idx_performance_analysis_business_id ON performance_analysis(business_id);
CREATE INDEX IF NOT EXISTS idx_business_tasks_business_id ON business_tasks(business_id);
CREATE INDEX IF NOT EXISTS idx_human_escalations_business_id ON human_escalations(business_id);

-- Create indexes for time-based queries
CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at ON ai_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_intelligence_generated_at ON market_intelligence(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_analysis_generated_at ON performance_analysis(generated_at DESC);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_insights_business_status ON ai_insights(business_id, status);
CREATE INDEX IF NOT EXISTS idx_business_tasks_business_status ON business_tasks(business_id, status);
CREATE INDEX IF NOT EXISTS idx_ab_tests_business_status ON ab_tests(business_id, status);

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE ai_personalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_tracking ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic policies - would be customized based on auth system)
CREATE POLICY "Users can access their business AI data" ON ai_personalities FOR ALL USING (TRUE);
CREATE POLICY "Users can access their business plans" ON business_plans FOR ALL USING (TRUE);
CREATE POLICY "Users can access their AI insights" ON ai_insights FOR ALL USING (TRUE);
CREATE POLICY "Users can access their conversations" ON conversations FOR ALL USING (TRUE);
CREATE POLICY "Users can access their market intelligence" ON market_intelligence FOR ALL USING (TRUE);
CREATE POLICY "Users can access their competitor intelligence" ON competitor_intelligence FOR ALL USING (TRUE);
CREATE POLICY "Users can access their market opportunities" ON market_opportunities FOR ALL USING (TRUE);
CREATE POLICY "Users can access their A/B tests" ON ab_tests FOR ALL USING (TRUE);
CREATE POLICY "Users can access their page variants" ON page_variants FOR ALL USING (TRUE);
CREATE POLICY "Users can access their performance analysis" ON performance_analysis FOR ALL USING (TRUE);
CREATE POLICY "Users can access their weekly reviews" ON weekly_reviews FOR ALL USING (TRUE);
CREATE POLICY "Users can access their daily insights" ON daily_insights FOR ALL USING (TRUE);
CREATE POLICY "Users can access their business tasks" ON business_tasks FOR ALL USING (TRUE);
CREATE POLICY "Users can access their optimization reports" ON optimization_reports FOR ALL USING (TRUE);
CREATE POLICY "Users can access their traffic strategies" ON traffic_strategies FOR ALL USING (TRUE);
CREATE POLICY "Users can access their customer insights" ON customer_insights FOR ALL USING (TRUE);
CREATE POLICY "Users can access their human escalations" ON human_escalations FOR ALL USING (TRUE);
CREATE POLICY "Users can access their sentiment tracking" ON sentiment_tracking FOR ALL USING (TRUE);
