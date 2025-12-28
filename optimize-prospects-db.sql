-- Performance optimization for hunter_prospects table
-- Run this in Supabase SQL editor

-- Add indexes for commonly queried columns
CREATE INDEX IF NOT EXISTS idx_hunter_prospects_status 
  ON hunter_prospects(status);

CREATE INDEX IF NOT EXISTS idx_hunter_prospects_service_type 
  ON hunter_prospects(service_type);

CREATE INDEX IF NOT EXISTS idx_hunter_prospects_created_at 
  ON hunter_prospects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hunter_prospects_whatsapp_number 
  ON hunter_prospects(whatsapp_number);

-- Composite index for status + created_at (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_hunter_prospects_status_created 
  ON hunter_prospects(status, created_at DESC);

-- Add index for search queries
CREATE INDEX IF NOT EXISTS idx_hunter_prospects_business_name 
  ON hunter_prospects(business_name);

CREATE INDEX IF NOT EXISTS idx_hunter_prospects_area 
  ON hunter_prospects(area);

-- Analyze table to update statistics for query planner
ANALYZE hunter_prospects;
