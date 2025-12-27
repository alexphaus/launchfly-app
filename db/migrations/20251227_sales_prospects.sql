-- Migration: Sales Prospects System (FOS v1.0)
-- Date: 2024-12-27
-- Description: Separate lead collection from business generation for cost-effective outreach

-- 1. Create prospects table for lead collection (Hunter phase)
CREATE TABLE IF NOT EXISTS sales_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core business info (collected by Hunter)
  business_name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  area TEXT,
  whatsapp_phone TEXT,
  email TEXT,
  owner_name TEXT,
  
  -- Source info
  source TEXT DEFAULT 'manual', -- manual, google_maps, facebook, instagram, scraper
  source_url TEXT,
  notes TEXT,
  
  -- Scraped data (optional, only if URL was analyzed)
  scraped_data JSONB DEFAULT '{}',
  
  -- Outreach status (Closer phase)
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'opener_sent', 'replied', 'interested', 'not_interested', 'converted', 'no_response')),
  opener_sent_at TIMESTAMPTZ,
  last_followup_at TIMESTAMPTZ,
  followup_count INTEGER DEFAULT 0,
  
  -- Preview generation (only when interested)
  preview_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  preview_generated_at TIMESTAMPTZ,
  
  -- Conversion tracking
  converted_at TIMESTAMPTZ,
  converted_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Create outreach_messages table to track all messages sent
CREATE TABLE IF NOT EXISTS outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES sales_prospects(id) ON DELETE CASCADE NOT NULL,
  
  message_type TEXT NOT NULL CHECK (message_type IN ('opener', 'followup_1', 'followup_2', 'followup_3', 'preview_share', 'custom')),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms', 'instagram_dm', 'facebook_dm')),
  
  message_content TEXT NOT NULL,
  
  -- Response tracking
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  reply_content TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_prospects_status ON sales_prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_created ON sales_prospects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_whatsapp ON sales_prospects(whatsapp_phone);
CREATE INDEX IF NOT EXISTS idx_prospects_service ON sales_prospects(service_type);
CREATE INDEX IF NOT EXISTS idx_outreach_prospect ON outreach_messages(prospect_id);
CREATE INDEX IF NOT EXISTS idx_outreach_sent ON outreach_messages(sent_at DESC);

-- 4. Add daily metrics view for founder dashboard
CREATE OR REPLACE VIEW sales_daily_metrics AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as prospects_added,
  COUNT(*) FILTER (WHERE status = 'opener_sent') as openers_sent,
  COUNT(*) FILTER (WHERE status = 'replied') as replies_received,
  COUNT(*) FILTER (WHERE status = 'interested') as interested,
  COUNT(*) FILTER (WHERE status = 'converted') as converted,
  COUNT(*) FILTER (WHERE preview_business_id IS NOT NULL) as previews_generated
FROM sales_prospects
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 5. Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_prospect_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prospect_updated_at ON sales_prospects;
CREATE TRIGGER prospect_updated_at
  BEFORE UPDATE ON sales_prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_prospect_timestamp();

-- 6. Comments
COMMENT ON TABLE sales_prospects IS 'Lead collection for FOS - Hunter collects, Closer converts';
COMMENT ON COLUMN sales_prospects.status IS 'new=just collected, opener_sent=waiting reply, replied=they responded, interested=ready for preview, converted=paid customer';
COMMENT ON COLUMN sales_prospects.preview_business_id IS 'Only populated when prospect shows interest and preview is generated';
