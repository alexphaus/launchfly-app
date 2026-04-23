-- Migration to add AI provider hot-swapping columns to businesses table
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS ai_provider TEXT,
ADD COLUMN IF NOT EXISTS ai_model TEXT;

-- Example:
-- UPDATE public.businesses SET ai_provider = 'openrouter', ai_model = 'google/gemini-2.0-flash-001' WHERE id = '...';
