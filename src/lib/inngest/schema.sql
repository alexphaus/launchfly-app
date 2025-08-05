-- Inngest-related database schema additions
-- Add these tables to your Supabase database

-- Table for tracking outreach campaigns
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
  CONSTRAINT outreach_campaigns_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- Table for growth sessions
CREATE TABLE IF NOT EXISTS public.growth_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  campaign_type text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  metrics jsonb DEFAULT '{"leads_generated": 0, "conversions": 0, "revenue_generated": 0}'::jsonb,
  CONSTRAINT growth_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT growth_sessions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- Table for growth experiments
CREATE TABLE IF NOT EXISTS public.growth_experiments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  name text NOT NULL,
  hypothesis text,
  success boolean DEFAULT false,
  learnings text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT growth_experiments_pkey PRIMARY KEY (id),
  CONSTRAINT growth_experiments_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_business_id ON public.outreach_campaigns(business_id);
CREATE INDEX IF NOT EXISTS idx_growth_sessions_business_id ON public.growth_sessions(business_id);
CREATE INDEX IF NOT EXISTS idx_growth_experiments_business_id ON public.growth_experiments(business_id);

-- Add columns to businesses table if they don't exist
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS total_leads integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_visitors integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS projected_revenue numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_growth_campaign_at timestamp with time zone;

-- Add completed_at to sessions table if it doesn't exist
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;