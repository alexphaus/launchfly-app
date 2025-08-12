-- Add strategy plan and related columns to businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS assets jsonb,
  ADD COLUMN IF NOT EXISTS strategy_plan jsonb;


