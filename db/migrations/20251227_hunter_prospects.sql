-- Hunter prospects table for lead generation tracking
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.hunter_prospects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  
  -- Basic business info (collected during hunting)
  business_name text NOT NULL,
  service_type text NOT NULL,
  area text NOT NULL,
  whatsapp_number text NOT NULL,
  
  -- Optional info
  owner_name text,
  website_url text,
  facebook_url text,
  google_maps_url text,
  instagram_url text,
  notes text,
  
  -- Source tracking
  source text DEFAULT 'manual' CHECK (source IN ('facebook', 'google_maps', 'instagram', 'referral', 'manual', 'other')),
  
  -- Pain signals observed (stored as array)
  pain_signals text[] DEFAULT '{}',
  
  -- Status tracking (the funnel)
  status text DEFAULT 'new' CHECK (status IN (
    'new',           -- Just logged, no message sent
    'opener_sent',   -- Opener message sent, waiting for reply
    'replied',       -- They replied (warm lead!)
    'preview_sent',  -- Generated and sent preview
    'follow_up_1',   -- First follow-up sent
    'follow_up_2',   -- Second follow-up sent
    'follow_up_3',   -- Third follow-up sent
    'closed_won',    -- They paid!
    'closed_lost',   -- Not interested / dead lead
    'archived'       -- Old lead, keep for reference
  )),
  
  -- Preview tracking (only populated after they reply "yes")
  preview_business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  preview_url text,
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  opener_sent_at timestamp with time zone,
  replied_at timestamp with time zone,
  preview_sent_at timestamp with time zone,
  last_follow_up_at timestamp with time zone,
  closed_at timestamp with time zone,
  
  -- User tracking (for when you have VAs)
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  CONSTRAINT hunter_prospects_pkey PRIMARY KEY (id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hunter_prospects_status ON public.hunter_prospects(status);
CREATE INDEX IF NOT EXISTS idx_hunter_prospects_created_at ON public.hunter_prospects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hunter_prospects_service_type ON public.hunter_prospects(service_type);
CREATE INDEX IF NOT EXISTS idx_hunter_prospects_whatsapp ON public.hunter_prospects(whatsapp_number);

-- Enable Row Level Security
ALTER TABLE public.hunter_prospects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users full access (you and future VAs)
CREATE POLICY "Allow authenticated full access" ON public.hunter_prospects
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Allow anon read access for the hunter page (if needed)
CREATE POLICY "Allow anon read" ON public.hunter_prospects
  FOR SELECT
  TO anon
  USING (true);

-- Policy: Allow anon insert for the hunter page
CREATE POLICY "Allow anon insert" ON public.hunter_prospects
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Allow anon update for status changes
CREATE POLICY "Allow anon update" ON public.hunter_prospects
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE public.hunter_prospects IS 'Tracks prospects found during lead hunting phase';
COMMENT ON COLUMN public.hunter_prospects.status IS 'Pipeline status: new -> opener_sent -> replied -> preview_sent -> closed_won/lost';
COMMENT ON COLUMN public.hunter_prospects.pain_signals IS 'Array of observed pain points like: pm_comments, slow_replies, broken_links, no_booking, whatsapp_only';
