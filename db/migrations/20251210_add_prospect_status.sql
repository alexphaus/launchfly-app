-- Migration: Add 'prospect' status for sales outreach preview businesses
-- Date: 2024-12-10
-- Description: Allows creating preview/ephemeral businesses from sales prospecting tool

-- 1. Update businesses status CHECK constraint to include 'prospect'
ALTER TABLE businesses 
DROP CONSTRAINT IF EXISTS businesses_status_check;

ALTER TABLE businesses 
ADD CONSTRAINT businesses_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'generating'::text, 'ready'::text, 'failed'::text, 'prospect'::text]));

-- 2. Add expires_at column for auto-cleanup of prospect businesses
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 3. Add source column to track where business came from
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'wizard';

-- 4. Add index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_businesses_prospect_expires 
ON businesses (status, expires_at) 
WHERE status = 'prospect';

-- 5. Add index for source tracking
CREATE INDEX IF NOT EXISTS idx_businesses_source 
ON businesses (source);

COMMENT ON COLUMN businesses.expires_at IS 'For prospect businesses: auto-delete after this timestamp';
COMMENT ON COLUMN businesses.source IS 'Origin: wizard, sales-prospector, import, etc.';
