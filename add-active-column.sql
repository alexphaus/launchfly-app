-- Add active column to businesses table
-- Default FALSE so all existing/old businesses are inactive
-- Only explicitly activated businesses will be processed by CRONs
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS active boolean DEFAULT false;

-- Optionally activate businesses that seem legitimately active:
-- (have a whatsapp number configured AND status = 'ready' AND agent enabled)
-- Run this AFTER the ALTER to seed initial active businesses:
-- UPDATE businesses SET active = true WHERE status = 'ready' AND ai_agent_enabled = true AND whatsapp_notify_number IS NOT NULL;
