-- Migration: Move automation rules to business level
-- Run this in the Supabase SQL editor.

-- 1. Add automation_rules column to businesses
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS automation_rules JSONB DEFAULT '[]'::jsonb;

-- 2. Seed it from the currently-active assistant's trigger_config.rules
--    for any business whose active assistant already has rules configured.
--    Only migrates if the column is still empty.
UPDATE businesses b
SET automation_rules = (
  SELECT COALESCE(a.trigger_config->'rules', '[]'::jsonb)
  FROM assistants a
  WHERE a.business_id = b.id
    AND a.active = true
    AND a.name NOT IN ('Purchasing OS', 'Chief of Staff', 'Marketing OS', 'Content & Growth OS')
    AND (a.trigger_config->'rules') IS NOT NULL
    AND jsonb_array_length(a.trigger_config->'rules') > 0
  LIMIT 1
)
WHERE (b.automation_rules IS NULL OR b.automation_rules = '[]'::jsonb)
  AND EXISTS (
    SELECT 1 FROM assistants a2
    WHERE a2.business_id = b.id
      AND a2.active = true
      AND a2.name NOT IN ('Purchasing OS', 'Chief of Staff', 'Marketing OS', 'Content & Growth OS')
      AND jsonb_array_length(COALESCE(a2.trigger_config->'rules', '[]'::jsonb)) > 0
  );
