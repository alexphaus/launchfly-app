-- Forever Customer Engine - Database Migration
-- Created: January 21, 2026
-- Purpose: Enable lifecycle management, warranty tracking, and smart reminders

-- ============================================================================
-- 1. SERVICE RECORDS TABLE (Core of the Forever Customer Engine)
-- ============================================================================
-- Tracks every completed service for warranty and reminder scheduling

CREATE TABLE IF NOT EXISTS public.service_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  
  -- Service Details
  service_type text NOT NULL CHECK (service_type IN ('cleaning', 'repair', 'installation', 'maintenance', 'inspection')),
  service_name text, -- 'Aircon General Cleaning', 'AC Not Cooling Fix'
  appliance_type text, -- 'aircon', 'washing_machine', 'water_heater', 'pest', 'plumbing'
  units_serviced integer DEFAULT 1,
  service_details text, -- Additional notes from the job
  
  -- Pricing
  amount numeric,
  currency text DEFAULT 'RM',
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial', 'waived')),
  
  -- Location (for job clustering)
  address text,
  building_name text, -- For condo/subdivision clustering
  area text, -- General area like "Subang Jaya", "Makati"
  coordinates point, -- For proximity matching
  
  -- Warranty Info
  warranty_days integer DEFAULT 30,
  warranty_expires_at timestamp with time zone,
  warranty_claimed boolean DEFAULT false,
  warranty_claimed_at timestamp with time zone,
  
  -- Smart Nag: Reminder Scheduling
  service_interval_days integer DEFAULT 180, -- Default 6 months
  next_service_due_at timestamp with time zone, -- Auto-set to service_date + interval
  reminder_sent boolean DEFAULT false,
  reminder_sent_at timestamp with time zone,
  reminder_count integer DEFAULT 0, -- How many reminders sent
  
  -- Rebooking Loop (tracks conversion)
  rebooking_initiated boolean DEFAULT false,
  rebooked_at timestamp with time zone,
  rebooked_service_id uuid, -- Links to the new service record
  
  -- Meta
  registered_via text DEFAULT 'sticker_scan' CHECK (registered_via IN ('sticker_scan', 'tech_register', 'manual', 'import', 'booking_complete')),
  registered_by text, -- 'customer', 'technician', 'system'
  service_date timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT service_records_pkey PRIMARY KEY (id),
  CONSTRAINT service_records_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT service_records_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE,
  CONSTRAINT service_records_rebooked_fkey FOREIGN KEY (rebooked_service_id) REFERENCES public.service_records(id)
);

-- Performance indexes for cron job
CREATE INDEX IF NOT EXISTS idx_service_records_reminder_due 
  ON public.service_records(next_service_due_at) 
  WHERE reminder_sent = false AND next_service_due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_records_business ON public.service_records(business_id);
CREATE INDEX IF NOT EXISTS idx_service_records_customer ON public.service_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_records_building ON public.service_records(building_name) WHERE building_name IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_service_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_service_records_updated_at ON public.service_records;
CREATE TRIGGER trigger_service_records_updated_at
  BEFORE UPDATE ON public.service_records
  FOR EACH ROW
  EXECUTE FUNCTION update_service_records_updated_at();

-- Auto-set next_service_due_at and warranty_expires_at on insert
CREATE OR REPLACE FUNCTION auto_set_service_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Set warranty expiration
  IF NEW.warranty_expires_at IS NULL AND NEW.warranty_days > 0 THEN
    NEW.warranty_expires_at = NEW.service_date + (NEW.warranty_days || ' days')::interval;
  END IF;
  
  -- Set next service due date (default 6 months for cleaning/maintenance)
  IF NEW.next_service_due_at IS NULL AND NEW.service_type IN ('cleaning', 'maintenance') THEN
    NEW.next_service_due_at = NEW.service_date + (NEW.service_interval_days || ' days')::interval;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_service_dates ON public.service_records;
CREATE TRIGGER trigger_auto_service_dates
  BEFORE INSERT ON public.service_records
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_service_dates();

COMMENT ON TABLE public.service_records IS 'Tracks completed services for warranty management and automatic reminder scheduling';
COMMENT ON COLUMN public.service_records.next_service_due_at IS 'Date when customer should be reminded. Auto-set to service_date + 6 months for cleaning';
COMMENT ON COLUMN public.service_records.rebooked_service_id IS 'Links to new service record when customer rebooks, tracking the full lifecycle';

-- ============================================================================
-- 2. SERVICE REMINDERS TABLE (Reminder Queue)
-- ============================================================================
-- Tracks all reminders sent, their delivery status, and conversion

CREATE TABLE IF NOT EXISTS public.service_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service_record_id uuid NOT NULL,
  business_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  
  -- Scheduling
  scheduled_for timestamp with time zone NOT NULL,
  reminder_type text NOT NULL CHECK (reminder_type IN ('due_soon', 'due_now', 'overdue', 'warranty_expiring', 'follow_up')),
  sequence_number integer DEFAULT 1, -- 1st, 2nd, 3rd reminder
  
  -- Delivery
  channel text DEFAULT 'sms' CHECK (channel IN ('sms', 'whatsapp_template', 'whatsapp_session', 'email')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'clicked', 'booked', 'cancelled')),
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  
  -- Conversion Tracking
  clicked_at timestamp with time zone,
  booked_at timestamp with time zone,
  booking_id uuid, -- References bookings table
  
  -- Message Content
  message_template text, -- Template ID or name
  message_sent text, -- Actual message sent
  
  -- Cost Tracking
  cost numeric DEFAULT 0,
  cost_currency text DEFAULT 'USD',
  
  -- Errors
  error_message text,
  retry_count integer DEFAULT 0,
  
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT service_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT service_reminders_service_record_fkey FOREIGN KEY (service_record_id) REFERENCES public.service_records(id) ON DELETE CASCADE,
  CONSTRAINT service_reminders_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT service_reminders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE,
  CONSTRAINT service_reminders_booking_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);

-- Index for cron job to find pending reminders
CREATE INDEX IF NOT EXISTS idx_service_reminders_pending 
  ON public.service_reminders(scheduled_for) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_service_reminders_business ON public.service_reminders(business_id);
CREATE INDEX IF NOT EXISTS idx_service_reminders_customer ON public.service_reminders(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_reminders_status ON public.service_reminders(status);

COMMENT ON TABLE public.service_reminders IS 'Queue and history of all service reminders sent to customers';
COMMENT ON COLUMN public.service_reminders.sequence_number IS '1st reminder at 5.5 months, 2nd at 6 months, 3rd at 6.5 months (if not booked)';

-- ============================================================================
-- 3. EXTEND CUSTOMERS TABLE
-- ============================================================================
-- Add retention-related fields

ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS service_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_service_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS next_reminder_due timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reminder_preference text DEFAULT 'sms' CHECK (reminder_preference IN ('sms', 'whatsapp', 'both', 'none')),
  ADD COLUMN IF NOT EXISTS building_name text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS is_repeat_customer boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lifetime_services integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid;

-- Index for finding customers due for reminder
CREATE INDEX IF NOT EXISTS idx_customers_next_reminder 
  ON public.customers(next_reminder_due) 
  WHERE next_reminder_due IS NOT NULL AND reminder_preference != 'none';

-- Index for referral lookups
CREATE INDEX IF NOT EXISTS idx_customers_referral_code 
  ON public.customers(referral_code) 
  WHERE referral_code IS NOT NULL;

-- Foreign key for referrals
ALTER TABLE public.customers 
  ADD CONSTRAINT customers_referred_by_fkey 
  FOREIGN KEY (referred_by) REFERENCES public.customers(id);

COMMENT ON COLUMN public.customers.reminder_preference IS 'How customer prefers to receive service reminders';
COMMENT ON COLUMN public.customers.referral_code IS 'Unique code for refer-a-neighbor program';
COMMENT ON COLUMN public.customers.is_repeat_customer IS 'True if customer has booked more than once';

-- ============================================================================
-- 4. REFERRALS TABLE (for Refer-a-Neighbor feature)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  
  -- Referrer (existing customer)
  referrer_id uuid NOT NULL,
  referral_code text NOT NULL,
  
  -- Referee (new customer)
  referee_id uuid,
  referee_phone text,
  referee_name text,
  
  -- Status
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'clicked', 'registered', 'booked', 'completed', 'expired')),
  
  -- Rewards
  referrer_discount_percent integer DEFAULT 10,
  referee_discount_percent integer DEFAULT 10,
  referrer_reward_applied boolean DEFAULT false,
  referee_reward_applied boolean DEFAULT false,
  
  -- Tracking
  link_clicked_at timestamp with time zone,
  registered_at timestamp with time zone,
  booked_at timestamp with time zone,
  completed_at timestamp with time zone,
  
  -- Expiration
  expires_at timestamp with time zone DEFAULT (now() + interval '30 days'),
  
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT referrals_pkey PRIMARY KEY (id),
  CONSTRAINT referrals_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.customers(id) ON DELETE CASCADE,
  CONSTRAINT referrals_referee_id_fkey FOREIGN KEY (referee_id) REFERENCES public.customers(id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_business ON public.referrals(business_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);

COMMENT ON TABLE public.referrals IS 'Tracks the refer-a-neighbor program for viral growth';

-- ============================================================================
-- 5. HELPER FUNCTION: Get Customer Service History
-- ============================================================================

CREATE OR REPLACE FUNCTION get_customer_service_history(p_customer_id uuid)
RETURNS TABLE (
  service_id uuid,
  service_date timestamp with time zone,
  service_type text,
  service_name text,
  appliance_type text,
  amount numeric,
  currency text,
  warranty_expires_at timestamp with time zone,
  warranty_active boolean,
  next_due_at timestamp with time zone,
  reminder_sent boolean,
  business_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sr.id as service_id,
    sr.service_date,
    sr.service_type,
    sr.service_name,
    sr.appliance_type,
    sr.amount,
    sr.currency,
    sr.warranty_expires_at,
    (sr.warranty_expires_at > now()) as warranty_active,
    sr.next_service_due_at as next_due_at,
    sr.reminder_sent,
    b.name as business_name
  FROM public.service_records sr
  JOIN public.businesses b ON b.id = sr.business_id
  WHERE sr.customer_id = p_customer_id
  ORDER BY sr.service_date DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. HELPER FUNCTION: Get Services Due for Reminder
-- ============================================================================

CREATE OR REPLACE FUNCTION get_services_due_for_reminder(p_days_ahead integer DEFAULT 7)
RETURNS TABLE (
  service_record_id uuid,
  business_id uuid,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  business_name text,
  service_name text,
  appliance_type text,
  service_date timestamp with time zone,
  next_due_at timestamp with time zone,
  days_until_due integer,
  reminder_count integer,
  reminder_preference text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sr.id as service_record_id,
    sr.business_id,
    sr.customer_id,
    c.name as customer_name,
    c.phone as customer_phone,
    b.name as business_name,
    sr.service_name,
    sr.appliance_type,
    sr.service_date,
    sr.next_service_due_at as next_due_at,
    EXTRACT(DAY FROM (sr.next_service_due_at - now()))::integer as days_until_due,
    sr.reminder_count,
    c.reminder_preference
  FROM public.service_records sr
  JOIN public.customers c ON c.id = sr.customer_id
  JOIN public.businesses b ON b.id = sr.business_id
  WHERE sr.next_service_due_at IS NOT NULL
    AND sr.next_service_due_at <= now() + (p_days_ahead || ' days')::interval
    AND sr.reminder_sent = false
    AND sr.rebooked_service_id IS NULL -- Not already rebooked
    AND c.reminder_preference != 'none'
  ORDER BY sr.next_service_due_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. ANALYTICS VIEW: Business Retention Metrics
-- ============================================================================

CREATE OR REPLACE VIEW business_retention_metrics AS
SELECT 
  b.id as business_id,
  b.name as business_name,
  COUNT(DISTINCT sr.id) as total_services,
  COUNT(DISTINCT sr.customer_id) as unique_customers,
  COUNT(DISTINCT CASE WHEN sr.rebooked_service_id IS NOT NULL THEN sr.customer_id END) as repeat_customers,
  ROUND(COUNT(DISTINCT CASE WHEN sr.rebooked_service_id IS NOT NULL THEN sr.customer_id END)::numeric / 
        NULLIF(COUNT(DISTINCT sr.customer_id), 0) * 100, 2) as repeat_rate_percent,
  COUNT(CASE WHEN sr.reminder_sent = true THEN 1 END) as reminders_sent,
  COUNT(CASE WHEN sr.rebooking_initiated = true THEN 1 END) as rebookings_initiated,
  ROUND(COUNT(CASE WHEN sr.rebooking_initiated = true THEN 1 END)::numeric / 
        NULLIF(COUNT(CASE WHEN sr.reminder_sent = true THEN 1 END), 0) * 100, 2) as reminder_conversion_percent,
  SUM(sr.amount) as total_revenue,
  AVG(sr.amount) as avg_service_value
FROM public.businesses b
LEFT JOIN public.service_records sr ON sr.business_id = b.id
GROUP BY b.id, b.name;

COMMENT ON VIEW business_retention_metrics IS 'Dashboard view showing customer retention stats per business';

-- ============================================================================
-- DONE
-- ============================================================================

-- Verify tables created
DO $$
BEGIN
  RAISE NOTICE '✅ Forever Customer Engine migration complete!';
  RAISE NOTICE '   - service_records table created';
  RAISE NOTICE '   - service_reminders table created';
  RAISE NOTICE '   - customers table extended';
  RAISE NOTICE '   - referrals table created';
  RAISE NOTICE '   - Helper functions created';
  RAISE NOTICE '   - Analytics view created';
END $$;
