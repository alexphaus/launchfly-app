-- ============================================================================
-- 7-Day Feedback + Referral Engine - Database Migration
-- ============================================================================
-- Adds tracking columns for the automated feedback loop that runs 7 days after
-- service completion. This is the "Revenue Multiplier" that generates:
-- 1. Google Reviews (social proof)
-- 2. Referrals (new customers)
-- 3. Quality checks (warranty claims if issues)
-- ============================================================================

-- 1. Add feedback tracking columns to service_records
-- Using timestamps instead of booleans for idempotency & debugging
ALTER TABLE public.service_records
ADD COLUMN IF NOT EXISTS feedback_request_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS feedback_score integer CHECK (feedback_score >= 1 AND feedback_score <= 5),
ADD COLUMN IF NOT EXISTS feedback_status text CHECK (feedback_status IN ('positive', 'negative', 'pending', 'no_response')),
ADD COLUMN IF NOT EXISTS feedback_text text,
ADD COLUMN IF NOT EXISTS feedback_received_at timestamptz,
ADD COLUMN IF NOT EXISTS referral_asked_at timestamptz,
ADD COLUMN IF NOT EXISTS google_review_asked_at timestamptz;

-- 2. Add context tracking to customers table for AI conversation awareness
-- This tells the AI "this customer is responding to a feedback request"
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS last_outbound_type text,
ADD COLUMN IF NOT EXISTS last_outbound_at timestamptz,
ADD COLUMN IF NOT EXISTS last_service_record_id uuid REFERENCES public.service_records(id);

-- 3. Add referral tracking columns to referrals table (enhance existing)
-- The token is used for trackable referral links
ALTER TABLE public.referrals
ADD COLUMN IF NOT EXISTS referral_token text UNIQUE,
ADD COLUMN IF NOT EXISTS referral_message_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS google_review_link_sent boolean DEFAULT false;

-- 4. Create index for efficient cron queries
-- The cron needs to find "services completed exactly 7 days ago, not yet sent feedback"
CREATE INDEX IF NOT EXISTS idx_service_records_feedback_due
ON public.service_records(service_date, feedback_request_sent_at)
WHERE feedback_request_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_records_service_date
ON public.service_records(service_date);

-- 5. Create index for referral token lookups
CREATE INDEX IF NOT EXISTS idx_referrals_token
ON public.referrals(referral_token)
WHERE referral_token IS NOT NULL;

-- 6. Create function to get services due for 7-day feedback
-- This is the core query for the feedback-trigger cron
CREATE OR REPLACE FUNCTION get_services_due_for_feedback(
    p_days_after_service integer DEFAULT 7,
    p_batch_size integer DEFAULT 50
)
RETURNS TABLE (
    service_record_id uuid,
    service_date timestamptz,
    customer_id uuid,
    customer_name text,
    customer_phone text,
    business_id uuid,
    business_name text,
    google_review_link text,
    service_name text,
    appliance_type text,
    currency text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.id as service_record_id,
        sr.service_date,
        sr.customer_id,
        COALESCE(c.first_name, c.name, 'there') as customer_name,
        c.phone as customer_phone,
        sr.business_id,
        b.name as business_name,
        (b.business_data->>'googleReviewLink')::text as google_review_link,
        sr.service_name,
        sr.appliance_type,
        COALESCE(sr.currency, 'RM') as currency
    FROM public.service_records sr
    JOIN public.customers c ON sr.customer_id = c.id
    JOIN public.businesses b ON sr.business_id = b.id
    WHERE 
        -- Service was completed exactly p_days_after_service days ago (timezone-safe)
        sr.service_date::date = (CURRENT_DATE - p_days_after_service)
        -- Haven't sent feedback request yet
        AND sr.feedback_request_sent_at IS NULL
        -- Customer has a phone number
        AND c.phone IS NOT NULL
        AND c.phone != ''
        -- Not opted out of blasts/marketing
        AND COALESCE(c.blast_optout, false) = false
    ORDER BY sr.service_date DESC
    LIMIT p_batch_size;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to generate a unique referral token
CREATE OR REPLACE FUNCTION generate_referral_token()
RETURNS text AS $$
DECLARE
    chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed confusable: I,O,0,1
    token text := '';
    i integer;
BEGIN
    FOR i IN 1..8 LOOP
        token := token || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN token;
END;
$$ LANGUAGE plpgsql;

-- 8. Add comments for documentation
COMMENT ON COLUMN public.service_records.feedback_request_sent_at IS '7-day feedback request sent timestamp (idempotent check)';
COMMENT ON COLUMN public.service_records.feedback_score IS 'Customer rating 1-5 (5=excellent, 1=poor)';
COMMENT ON COLUMN public.service_records.feedback_status IS 'positive=4-5, negative=1-3, pending=awaiting response, no_response=no reply after 48h';
COMMENT ON COLUMN public.service_records.feedback_text IS 'Free-form feedback text from customer';
COMMENT ON COLUMN public.service_records.referral_asked_at IS 'When we asked for referral (only after positive feedback)';
COMMENT ON COLUMN public.service_records.google_review_asked_at IS 'When we sent Google review link';

COMMENT ON COLUMN public.customers.last_outbound_type IS 'Context tag: FEEDBACK_7D, REMINDER_6M, REFERRAL_ASK, etc.';
COMMENT ON COLUMN public.customers.last_outbound_at IS 'When we last messaged this customer (for rate limiting)';
COMMENT ON COLUMN public.customers.last_service_record_id IS 'Reference to the service record we are currently asking about';

COMMENT ON FUNCTION get_services_due_for_feedback IS 'Returns services completed N days ago that need feedback request';
COMMENT ON FUNCTION generate_referral_token IS 'Generates unique 8-char alphanumeric token for referral links';

-- ============================================================================
-- VERIFY MIGRATION
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ 7-Day Feedback Engine migration complete';
    RAISE NOTICE '   - service_records: feedback tracking columns added';
    RAISE NOTICE '   - customers: context tracking columns added';
    RAISE NOTICE '   - referrals: token tracking enhanced';
    RAISE NOTICE '   - get_services_due_for_feedback() function created';
    RAISE NOTICE '   - generate_referral_token() function created';
END $$;
