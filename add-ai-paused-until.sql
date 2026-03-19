-- Add per-customer AI pause field for human handoff
-- NULL = AI active, future timestamp = AI paused until that time
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS ai_paused_until TIMESTAMPTZ DEFAULT NULL;

-- Index for fast lookups during webhook processing
CREATE INDEX IF NOT EXISTS idx_customers_ai_paused ON public.customers (business_id, phone) WHERE ai_paused_until IS NOT NULL;
