-- Migration: Add WhatsApp notification settings to businesses
-- Run this migration to enable WhatsApp push notifications

-- WhatsApp notification number (can be different from main phone)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS whatsapp_notify_number text;

-- Notification preference: 'whatsapp', 'sms', 'email', 'all'
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS notify_preference text DEFAULT 'whatsapp';

-- Optional: WhatsApp Business API configuration (for advanced users)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS whatsapp_api_config jsonb;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_businesses_whatsapp_notify 
ON businesses(whatsapp_notify_number) 
WHERE whatsapp_notify_number IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN businesses.whatsapp_notify_number IS 'Phone number for WhatsApp lead notifications (defaults to phone_number if null)';
COMMENT ON COLUMN businesses.notify_preference IS 'Preferred notification channel: whatsapp, sms, email, or all';
