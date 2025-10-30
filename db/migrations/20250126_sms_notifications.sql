-- Migration: Add SMS notification support
-- Created: 2025-01-26
-- Description: Adds SMS notification preferences and tracking tables

-- Add SMS notification settings to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS sms_notifications_enabled boolean DEFAULT true;

-- Add phone_number to profiles if it doesn't exist (may already exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN phone_number text;
  END IF;
END $$;

-- Create SMS notifications log table
CREATE TABLE IF NOT EXISTS public.sms_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid,
  user_id uuid,
  phone_number text NOT NULL,
  message_type text NOT NULL,
  message_content text NOT NULL,
  twilio_message_id text,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'delivered', 'undelivered')),
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  delivered_at timestamp with time zone,
  CONSTRAINT sms_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT sms_notifications_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT sms_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index for querying SMS notifications by business
CREATE INDEX IF NOT EXISTS sms_notifications_business_id_idx ON public.sms_notifications(business_id);

-- Create index for querying SMS notifications by user
CREATE INDEX IF NOT EXISTS sms_notifications_user_id_idx ON public.sms_notifications(user_id);

-- Create index for querying SMS notifications by type
CREATE INDEX IF NOT EXISTS sms_notifications_type_idx ON public.sms_notifications(message_type);

-- Create index for querying SMS notifications by status
CREATE INDEX IF NOT EXISTS sms_notifications_status_idx ON public.sms_notifications(status);

-- Add comment to table
COMMENT ON TABLE public.sms_notifications IS 'Tracks all SMS notifications sent to users for sales, payouts, and milestones';

-- Add comments to columns
COMMENT ON COLUMN public.sms_notifications.message_type IS 'Type of notification: sale, first_sale, payout, milestone, test';
COMMENT ON COLUMN public.sms_notifications.status IS 'Delivery status: sent, failed, delivered, undelivered';
COMMENT ON COLUMN public.profiles.sms_notifications_enabled IS 'Whether user has SMS notifications enabled (default: true)';

