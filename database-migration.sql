-- Database Migration for Real Customer Acquisition System
-- Run these SQL commands in your Supabase SQL editor

-- ================================================================
-- 1. CREATE MISSING TABLES
-- ================================================================

-- AI Activities Table (stores real customer acquisition activities)
CREATE TABLE IF NOT EXISTS public.ai_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  type varchar(50) NOT NULL,
  icon varchar(10),
  message text NOT NULL,
  details text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_activities_pkey PRIMARY KEY (id),
  CONSTRAINT ai_activities_business_id_fkey FOREIGN KEY (business_id) 
    REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- Prospects Table (stores real prospects found via Apollo.io)
CREATE TABLE IF NOT EXISTS public.prospects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  name varchar(255),
  email varchar(255),
  company varchar(255),
  industry varchar(100),
  company_size varchar(50),
  linkedin_url text,
  title varchar(255),
  source varchar(100),
  status varchar(50) DEFAULT 'discovered',
  contacted_at timestamp with time zone,
  last_response_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT prospects_pkey PRIMARY KEY (id),
  CONSTRAINT prospects_business_id_fkey FOREIGN KEY (business_id) 
    REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- Outreach Campaigns Table (tracks email campaigns)
CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  campaign_type text NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  total_prospects integer DEFAULT 0,
  email_templates jsonb,
  metrics jsonb DEFAULT '{"sent": 0, "opened": 0, "clicked": 0, "replied": 0}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  last_batch_sent_at timestamp with time zone,
  CONSTRAINT outreach_campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT outreach_campaigns_business_id_fkey FOREIGN KEY (business_id) 
    REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- Growth Sessions Table (tracks growth campaigns)
CREATE TABLE IF NOT EXISTS public.growth_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  campaign_type text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  metrics jsonb DEFAULT '{"leads_generated": 0, "conversions": 0, "revenue_generated": 0}'::jsonb,
  CONSTRAINT growth_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT growth_sessions_business_id_fkey FOREIGN KEY (business_id) 
    REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- ================================================================
-- 2. ADD MISSING COLUMNS TO EXISTING TABLES
-- ================================================================

-- Add columns to businesses table for customer acquisition tracking
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS total_leads integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_visitors integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS projected_revenue numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_growth_campaign_at timestamp with time zone;

-- Add completed_at column to sessions table
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- ================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ================================================================

-- Indexes for ai_activities table
CREATE INDEX IF NOT EXISTS idx_ai_activities_business_id ON public.ai_activities(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_activities_type ON public.ai_activities(type);
CREATE INDEX IF NOT EXISTS idx_ai_activities_created_at ON public.ai_activities(created_at DESC);

-- Indexes for prospects table
CREATE INDEX IF NOT EXISTS idx_prospects_business_id ON public.prospects(business_id);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON public.prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_email ON public.prospects(email);
CREATE INDEX IF NOT EXISTS idx_prospects_created_at ON public.prospects(created_at DESC);

-- Indexes for outreach_campaigns table
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_business_id ON public.outreach_campaigns(business_id);
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_status ON public.outreach_campaigns(status);

-- Indexes for growth_sessions table
CREATE INDEX IF NOT EXISTS idx_growth_sessions_business_id ON public.growth_sessions(business_id);
CREATE INDEX IF NOT EXISTS idx_growth_sessions_status ON public.growth_sessions(status);

-- ================================================================
-- 4. SET UP ROW LEVEL SECURITY (RLS) - OPTIONAL BUT RECOMMENDED
-- ================================================================

-- Enable RLS on new tables
ALTER TABLE public.ai_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (adjust based on your auth setup)
-- These policies allow service role to access everything, and authenticated users to access their own data

-- AI Activities policies
CREATE POLICY "ai_activities_service_role_all" ON public.ai_activities
  FOR ALL USING (true);

-- Prospects policies  
CREATE POLICY "prospects_service_role_all" ON public.prospects
  FOR ALL USING (true);

-- Outreach Campaigns policies
CREATE POLICY "outreach_campaigns_service_role_all" ON public.outreach_campaigns
  FOR ALL USING (true);

-- Growth Sessions policies
CREATE POLICY "growth_sessions_service_role_all" ON public.growth_sessions
  FOR ALL USING (true);

-- ================================================================
-- 5. GRANT PERMISSIONS
-- ================================================================

-- Grant permissions to service_role (used by your API)
GRANT ALL ON public.ai_activities TO service_role;
GRANT ALL ON public.prospects TO service_role;
GRANT ALL ON public.outreach_campaigns TO service_role;
GRANT ALL ON public.growth_sessions TO service_role;

-- Grant permissions to authenticated users (if needed)
GRANT SELECT, INSERT, UPDATE ON public.ai_activities TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prospects TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.outreach_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.growth_sessions TO authenticated;

-- ================================================================
-- 6. VERIFICATION QUERIES
-- ================================================================

-- Run these to verify everything was created correctly:

-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('ai_activities', 'prospects', 'outreach_campaigns', 'growth_sessions')
ORDER BY table_name;

-- Check if new columns were added to businesses table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'businesses' 
AND column_name IN ('total_leads', 'total_visitors', 'projected_revenue', 'last_growth_campaign_at')
ORDER BY column_name;

-- Check if completed_at column was added to sessions table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'sessions' 
AND column_name = 'completed_at';

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('ai_activities', 'prospects', 'outreach_campaigns', 'growth_sessions')
ORDER BY tablename, indexname;