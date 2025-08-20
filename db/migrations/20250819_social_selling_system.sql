-- Migration: Social Selling System Tables
-- Created: 2025-08-20
-- Description: Database extensions for social selling automation (works with existing schema)

-- Social Campaigns Table (track active social selling campaigns)
CREATE TABLE IF NOT EXISTS social_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL,
  platforms TEXT[] NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  estimated_reach INTEGER DEFAULT 0,
  estimated_conversions INTEGER DEFAULT 0,
  estimated_first_sale TEXT,
  campaign_settings JSONB DEFAULT '{}',
  performance_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT social_campaigns_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);

-- Extend existing prospects table with social selling fields
-- Add new columns to existing prospects table
ALTER TABLE public.prospects 
ADD COLUMN IF NOT EXISTS platform TEXT CHECK (platform IN ('reddit', 'facebook', 'linkedin', 'twitter', 'instagram', 'email')),
ADD COLUMN IF NOT EXISTS platform_username TEXT,
ADD COLUMN IF NOT EXISTS platform_user_id TEXT,
ADD COLUMN IF NOT EXISTS profile_url TEXT,
ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
ADD COLUMN IF NOT EXISTS conversion_status TEXT DEFAULT 'discovered' CHECK (conversion_status IN ('discovered', 'contacted', 'engaged', 'qualified', 'converted', 'lost')),
ADD COLUMN IF NOT EXISTS last_engagement TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS contact_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Social Platform Accounts (store platform-specific data)
CREATE TABLE IF NOT EXISTS social_platform_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('reddit', 'facebook', 'linkedin', 'twitter', 'instagram')),
  account_username TEXT NOT NULL,
  account_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'rate_limited', 'error')),
  daily_action_count INTEGER DEFAULT 0,
  daily_action_limit INTEGER DEFAULT 100,
  last_action_at TIMESTAMP WITH TIME ZONE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, platform, account_username),
  CONSTRAINT social_platform_accounts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);

-- Social Actions Log (detailed activity tracking) - extends existing ai_activities
CREATE TABLE IF NOT EXISTS social_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL,
  campaign_id UUID REFERENCES social_campaigns(id),
  prospect_id UUID REFERENCES prospects(id),
  platform TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('post', 'comment', 'dm', 'like', 'follow', 'connect', 'join_group', 'message')),
  action_status TEXT DEFAULT 'pending' CHECK (action_status IN ('pending', 'completed', 'failed', 'rate_limited')),
  content TEXT,
  target_url TEXT,
  target_user TEXT,
  response_received BOOLEAN DEFAULT false,
  response_sentiment TEXT CHECK (response_sentiment IN ('positive', 'neutral', 'negative')),
  conversion_generated BOOLEAN DEFAULT false,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT social_actions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);

-- Monitored Keywords/Hashtags
CREATE TABLE IF NOT EXISTS social_monitoring (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL,
  platform TEXT NOT NULL,
  keyword TEXT NOT NULL,
  location TEXT, -- subreddit, group, hashtag, etc.
  monitoring_type TEXT DEFAULT 'keyword' CHECK (monitoring_type IN ('keyword', 'hashtag', 'mention', 'competitor')),
  is_active BOOLEAN DEFAULT true,
  last_checked TIMESTAMP WITH TIME ZONE,
  results_found INTEGER DEFAULT 0,
  opportunities_created INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT social_monitoring_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_campaigns_business_id ON social_campaigns(business_id);
CREATE INDEX IF NOT EXISTS idx_social_campaigns_status ON social_campaigns(status);

CREATE INDEX IF NOT EXISTS idx_prospects_platform ON prospects(platform) WHERE platform IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_engagement_score ON prospects(engagement_score DESC) WHERE engagement_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_platform_accounts_business_id ON social_platform_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_social_platform_accounts_platform ON social_platform_accounts(platform);

CREATE INDEX IF NOT EXISTS idx_social_actions_business_id ON social_actions(business_id);
CREATE INDEX IF NOT EXISTS idx_social_actions_campaign_id ON social_actions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_social_actions_platform ON social_actions(platform);
CREATE INDEX IF NOT EXISTS idx_social_actions_created_at ON social_actions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_monitoring_business_id ON social_monitoring(business_id);
CREATE INDEX IF NOT EXISTS idx_social_monitoring_platform ON social_monitoring(platform);
CREATE INDEX IF NOT EXISTS idx_social_monitoring_active ON social_monitoring(is_active) WHERE is_active = true;

-- Update timestamps trigger (reuse existing function if it exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to new tables
CREATE TRIGGER update_social_campaigns_updated_at 
  BEFORE UPDATE ON social_campaigns 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_platform_accounts_updated_at 
  BEFORE UPDATE ON social_platform_accounts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_monitoring_updated_at 
  BEFORE UPDATE ON social_monitoring 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
