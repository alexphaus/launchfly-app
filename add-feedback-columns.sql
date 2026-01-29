-- Add whatsapp_template_feedback to businesses
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS whatsapp_template_feedback text;

-- Add last_interaction_context to customers for AI context tracking
-- This will store values like 'FEEDBACK_7D', 'WARRANTY_CLAIM', etc.
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS last_interaction_context text;

-- Add generated name column if it doesn't exist (simplifies queries)
-- Or just rely on first_name in the code. I'll stick to first_name in code to be safe, 
-- but having a name column is useful if the prompt expects it. 
-- In the snippet: customers(id, name, phone). 
-- Let's check if 'name' exists in customers. The output above didn't show it.
-- I will assume I need to use first_name in the code or query as `name:first_name`.

-- Add index for efficient 7-day lookups on service_records
CREATE INDEX IF NOT EXISTS idx_service_records_service_date 
ON public.service_records (service_date);
