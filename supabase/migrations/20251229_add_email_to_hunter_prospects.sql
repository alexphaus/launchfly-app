-- Add email column to hunter_prospects table
ALTER TABLE hunter_prospects ADD COLUMN IF NOT EXISTS email TEXT;
