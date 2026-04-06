-- ═══════════════════════════════════════════════════════════════════════════
-- Drop the one-active-assistant-per-business constraint
--
-- This was created in sql/assistants-migration.sql as:
--   CREATE UNIQUE INDEX idx_assistants_business_active ON assistants (business_id) WHERE active = true;
--
-- We need multiple active assistants now (e.g. Receptionist + Purchasing OS).
-- The webhook routes by assistant name, so there's no conflict.
-- ═══════════════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_assistants_business_active;

-- Now activate the Purchasing OS assistant
UPDATE assistants
SET active = true, updated_at = NOW()
WHERE name = 'Purchasing OS';
