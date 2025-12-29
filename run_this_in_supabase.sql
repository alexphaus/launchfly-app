-- Run this in your Supabase SQL Editor to fix the "Could not find the 'email' column" error
ALTER TABLE hunter_prospects ADD COLUMN IF NOT EXISTS email TEXT;
