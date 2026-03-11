-- Add prospecting_config jsonb column to businesses table
-- Stores: { apifyToken, defaultLocation }
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS prospecting_config jsonb DEFAULT NULL;
