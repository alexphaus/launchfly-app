-- Database Validation Script
-- Run this after the migration to ensure everything is working

-- ================================================================
-- 1. TEST DATA INSERTION (Optional - for testing)
-- ================================================================

-- Test inserting a sample AI activity (replace with real business_id)
/*
INSERT INTO public.ai_activities (business_id, type, icon, message, details, metadata)
VALUES (
  'your-business-uuid-here',
  'prospect_search',
  '🔍',
  'Found 25 potential customers in Technology industry',
  'Searched for: SaaS companies, 10-100 employees',
  '{"industry": "Technology", "count": 25, "source": "Apollo.io"}'::jsonb
);
*/

-- ================================================================
-- 2. VALIDATION QUERIES
-- ================================================================

-- Check table structures
SELECT 
  t.table_name,
  COUNT(c.column_name) as column_count
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
AND t.table_name IN ('ai_activities', 'prospects', 'outreach_campaigns', 'growth_sessions', 'businesses', 'sessions')
GROUP BY t.table_name
ORDER BY t.table_name;

-- Check foreign key constraints
SELECT 
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
AND tc.table_name IN ('ai_activities', 'prospects', 'outreach_campaigns', 'growth_sessions')
ORDER BY tc.table_name;

-- Check indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('ai_activities', 'prospects', 'outreach_campaigns', 'growth_sessions')
ORDER BY tablename, indexname;

-- Verify businesses table has new columns
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'businesses'
AND column_name IN ('total_leads', 'total_visitors', 'projected_revenue', 'last_growth_campaign_at')
ORDER BY column_name;

-- Verify sessions table has completed_at column
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'sessions'
AND column_name = 'completed_at';

-- ================================================================
-- 3. SAMPLE QUERIES TO TEST FUNCTIONALITY
-- ================================================================

-- Test ai_activities table structure
SELECT 
  'ai_activities' as table_name,
  COUNT(*) as row_count
FROM public.ai_activities;

-- Test prospects table structure
SELECT 
  'prospects' as table_name,
  COUNT(*) as row_count
FROM public.prospects;

-- Test outreach_campaigns table structure
SELECT 
  'outreach_campaigns' as table_name,
  COUNT(*) as row_count
FROM public.outreach_campaigns;

-- Test growth_sessions table structure
SELECT 
  'growth_sessions' as table_name,
  COUNT(*) as row_count
FROM public.growth_sessions;

-- ================================================================
-- 4. PERMISSIONS CHECK
-- ================================================================

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('ai_activities', 'prospects', 'outreach_campaigns', 'growth_sessions')
ORDER BY tablename, policyname;

-- ================================================================
-- 5. MIGRATION SUCCESS SUMMARY
-- ================================================================

-- Final verification - this should show all required tables and columns
WITH required_tables AS (
  SELECT unnest(ARRAY['ai_activities', 'prospects', 'outreach_campaigns', 'growth_sessions']) as table_name
),
existing_tables AS (
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
),
required_business_columns AS (
  SELECT unnest(ARRAY['total_leads', 'total_visitors', 'projected_revenue', 'last_growth_campaign_at']) as column_name
),
existing_business_columns AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'businesses'
)
SELECT 
  '✅ Migration Summary' as status,
  CASE 
    WHEN (SELECT COUNT(*) FROM required_tables rt LEFT JOIN existing_tables et ON rt.table_name = et.table_name WHERE et.table_name IS NULL) = 0
    THEN 'All required tables created'
    ELSE 'Some tables missing'
  END as tables_status,
  CASE 
    WHEN (SELECT COUNT(*) FROM required_business_columns rbc LEFT JOIN existing_business_columns ebc ON rbc.column_name = ebc.column_name WHERE ebc.column_name IS NULL) = 0
    THEN 'All business columns added'
    ELSE 'Some business columns missing'
  END as business_columns_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'completed_at')
    THEN 'Sessions completed_at column added'
    ELSE 'Sessions completed_at column missing'
  END as sessions_column_status;