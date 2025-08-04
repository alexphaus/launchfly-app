-- Inngest Integration Database Tables
-- These tables support the comprehensive Inngest orchestration system

-- Marketing campaigns table to track multi-channel campaigns
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_data JSONB NOT NULL,
  channel VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email outreach table for cold email campaigns
CREATE TABLE IF NOT EXISTS email_outreach (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  prospect_id VARCHAR(255) NOT NULL,
  email_type VARCHAR(100) NOT NULL, -- 'initial', 'followup_1', 'followup_2'
  subject VARCHAR(500),
  content TEXT,
  status VARCHAR(50) DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE,
  response_received BOOLEAN DEFAULT FALSE,
  meeting_scheduled BOOLEAN DEFAULT FALSE,
  converted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Growth experiments table to track experiment results
CREATE TABLE IF NOT EXISTS growth_experiments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  experiment_type VARCHAR(100) NOT NULL,
  experiment_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  results JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inngest job tracking table
CREATE TABLE IF NOT EXISTS inngest_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  job_type VARCHAR(100) NOT NULL,
  event_name VARCHAR(200) NOT NULL,
  event_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'queued', -- 'queued', 'running', 'completed', 'failed', 'retrying'
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_business_id ON marketing_campaigns(business_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_outreach_business_id ON email_outreach(business_id);
CREATE INDEX IF NOT EXISTS idx_email_outreach_prospect_id ON email_outreach(prospect_id);
CREATE INDEX IF NOT EXISTS idx_email_outreach_status ON email_outreach(status);
CREATE INDEX IF NOT EXISTS idx_growth_experiments_business_id ON growth_experiments(business_id);
CREATE INDEX IF NOT EXISTS idx_growth_experiments_status ON growth_experiments(status);
CREATE INDEX IF NOT EXISTS idx_inngest_jobs_business_id ON inngest_jobs(business_id);
CREATE INDEX IF NOT EXISTS idx_inngest_jobs_status ON inngest_jobs(status);
CREATE INDEX IF NOT EXISTS idx_inngest_jobs_event_name ON inngest_jobs(event_name);

-- Add new columns to existing businesses table for Inngest integration
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS growth_data JSONB,
ADD COLUMN IF NOT EXISTS latest_campaign_review JSONB,
ADD COLUMN IF NOT EXISTS latest_email_campaign JSONB,
ADD COLUMN IF NOT EXISTS latest_email_batch JSONB,
ADD COLUMN IF NOT EXISTS opportunity_data JSONB;

-- Add new stage for sessions table to support queued state
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS inngest_job_id UUID REFERENCES inngest_jobs(id);

-- Update RLS policies for new tables
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inngest_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic service role access for now)
CREATE POLICY "Service role can manage marketing campaigns" ON marketing_campaigns
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage email outreach" ON email_outreach
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage growth experiments" ON growth_experiments
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage inngest jobs" ON inngest_jobs
  FOR ALL USING (auth.role() = 'service_role');
