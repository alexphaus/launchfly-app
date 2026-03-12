-- Add outreach_paused flag to businesses table
-- When true, all scheduled follow-ups and new prospect outreach are held (not cancelled)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS outreach_paused boolean DEFAULT false;
