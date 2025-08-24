-- Migration script for existing businesses
-- Run this to ensure all existing businesses work with Central AI Brain

-- 1. Add missing fields to existing businesses (safe to run multiple times)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS ai_agent_enabled BOOLEAN DEFAULT true;

-- 2. Ensure all existing businesses have guarantee tracking
UPDATE businesses 
SET guarantee_start_at = COALESCE(guarantee_start_at, created_at)
WHERE guarantee_start_at IS NULL;

-- 3. Set default business types for existing businesses without them
UPDATE businesses 
SET business_data = COALESCE(business_data, '{}'::jsonb) || 
    jsonb_build_object(
      'businessType', CASE 
        WHEN business_data->>'businessType' IS NULL THEN 'service'
        ELSE business_data->>'businessType'
      END,
      'industry', CASE 
        WHEN business_data->>'industry' IS NULL THEN 'general'
        ELSE business_data->>'industry'
      END
    )
WHERE business_data IS NULL 
   OR business_data->>'businessType' IS NULL 
   OR business_data->>'industry' IS NULL;

-- 4. Enable AI agent for all ready businesses
UPDATE businesses 
SET ai_agent_enabled = true 
WHERE status = 'ready' AND ai_agent_enabled IS NULL;

-- 5. Create initial revenue patterns from existing conversion data
INSERT INTO revenue_patterns (
  business_id,
  business_type,
  industry,
  offer_type,
  channel,
  conversion_rate,
  avg_order_value,
  sample_size,
  confidence_score,
  created_at
)
SELECT 
  b.id as business_id,
  COALESCE(b.business_data->>'businessType', 'service') as business_type,
  COALESCE(b.business_data->>'industry', 'general') as industry,
  'product' as offer_type, -- Default for existing businesses
  'website' as channel, -- Default channel
  CASE 
    WHEN b.total_visitors > 0 THEN LEAST(1.0, (b.total_leads::decimal / b.total_visitors))
    ELSE 0.05 
  END as conversion_rate,
  CASE 
    WHEN b.total_leads > 0 THEN (b.total_revenue / b.total_leads)
    ELSE 100 
  END as avg_order_value,
  GREATEST(1, b.total_leads) as sample_size,
  CASE 
    WHEN b.total_leads >= 10 THEN 0.7
    WHEN b.total_leads >= 5 THEN 0.5
    ELSE 0.3
  END as confidence_score,
  b.created_at
FROM businesses b
WHERE b.status = 'ready' 
  AND b.total_revenue > 0
  AND NOT EXISTS (
    SELECT 1 FROM revenue_patterns rp 
    WHERE rp.business_id = b.id
  );

-- 6. Verify migration results
SELECT 
  COUNT(*) as total_businesses,
  COUNT(CASE WHEN ai_agent_enabled = true THEN 1 END) as ai_enabled,
  COUNT(CASE WHEN business_data->>'businessType' IS NOT NULL THEN 1 END) as with_business_type,
  COUNT(CASE WHEN guarantee_start_at IS NOT NULL THEN 1 END) as with_guarantees
FROM businesses;
