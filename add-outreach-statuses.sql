-- Add new statuses for the outreach drip system
-- 'opener_queued' = picked by outreach action, scheduled via QStash, awaiting send
-- 'no_whatsapp'   = checked and has no WhatsApp — skip in future picks

-- Drop and recreate the CHECK constraint to include new statuses
ALTER TABLE hunter_prospects DROP CONSTRAINT IF EXISTS hunter_prospects_status_check;
ALTER TABLE hunter_prospects ADD CONSTRAINT hunter_prospects_status_check 
  CHECK (status IN (
    'new', 'opener_queued', 'opener_sent', 'replied', 
    'preview_sent', 'follow_up_1', 'follow_up_2', 'follow_up_3', 
    'closed_won', 'closed_lost', 'archived', 'no_whatsapp'
  ));

-- Index for the outreach drip query: pick 'new' prospects, oldest first
CREATE INDEX IF NOT EXISTS idx_hunter_prospects_outreach_pool 
  ON hunter_prospects (status, created_at ASC) 
  WHERE status = 'new';
