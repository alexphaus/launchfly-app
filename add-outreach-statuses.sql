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

-- Priority column: higher = picked first by outreach drip (default 0)
-- Set manually for hand-picked prospects, or bulk-update via AI scoring
ALTER TABLE hunter_prospects ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

-- Index for the outreach drip query: highest priority first, then oldest
CREATE INDEX IF NOT EXISTS idx_hunter_prospects_outreach_pool 
  ON hunter_prospects (priority DESC, created_at ASC) 
  WHERE status = 'new';
