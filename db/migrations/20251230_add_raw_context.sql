-- Add raw_context column to hunter_prospects to store original Facebook/context data
-- This preserves the full context for better preview generation later
-- Run this in your Supabase SQL editor

ALTER TABLE public.hunter_prospects 
ADD COLUMN IF NOT EXISTS raw_context text;

-- Add email column if it doesn't exist
ALTER TABLE public.hunter_prospects 
ADD COLUMN IF NOT EXISTS email text;

-- Comment
COMMENT ON COLUMN public.hunter_prospects.raw_context IS 'Original raw context/Facebook post data preserved for later preview generation';
COMMENT ON COLUMN public.hunter_prospects.email IS 'Business email address for email outreach';
