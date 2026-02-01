-- Sticker Scan Tracking Table
-- Tracks when customers scan the QR code on warranty stickers

CREATE TABLE IF NOT EXISTS sticker_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    customer_phone TEXT NOT NULL,
    source TEXT DEFAULT 'warranty_sticker', -- 'warranty_sticker', 'van_sticker', 'business_card', etc.
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    converted_to_customer BOOLEAN DEFAULT FALSE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by business
CREATE INDEX IF NOT EXISTS idx_sticker_scans_business_id ON sticker_scans(business_id);
CREATE INDEX IF NOT EXISTS idx_sticker_scans_scanned_at ON sticker_scans(scanned_at DESC);

-- Enable RLS
ALTER TABLE sticker_scans ENABLE ROW LEVEL SECURITY;

-- Policy: Business owners can view their own sticker scans
CREATE POLICY "Business owners can view own sticker scans"
ON sticker_scans FOR SELECT
USING (
    business_id IN (
        SELECT id FROM businesses WHERE user_id = auth.uid()
    )
);

-- Policy: Allow inserts from service role (webhook)
CREATE POLICY "Service role can insert sticker scans"
ON sticker_scans FOR INSERT
WITH CHECK (true);

-- Useful view for analytics
CREATE OR REPLACE VIEW sticker_scan_stats AS
SELECT 
    b.id as business_id,
    b.name as business_name,
    COUNT(ss.id) as total_scans,
    COUNT(DISTINCT ss.customer_phone) as unique_scanners,
    COUNT(CASE WHEN ss.scanned_at > NOW() - INTERVAL '7 days' THEN 1 END) as scans_last_7_days,
    COUNT(CASE WHEN ss.scanned_at > NOW() - INTERVAL '30 days' THEN 1 END) as scans_last_30_days,
    COUNT(CASE WHEN ss.converted_to_customer THEN 1 END) as conversions
FROM businesses b
LEFT JOIN sticker_scans ss ON b.id = ss.business_id
GROUP BY b.id, b.name;

COMMENT ON TABLE sticker_scans IS 'Tracks QR code scans from physical warranty stickers';
