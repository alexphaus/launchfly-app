-- Migration: guarantees + plans + connect
-- Safe to run multiple times if columns exist checks are added in UI before applying.

-- Businesses: guarantees & monetization fields
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS guarantee_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS guarantee_48h_status text DEFAULT 'pending' CHECK (guarantee_48h_status IN ('pending','met','missed','paid')),
  ADD COLUMN IF NOT EXISTS guarantee_60d_status text DEFAULT 'pending' CHECK (guarantee_60d_status IN ('pending','met','extended','failed')),
  ADD COLUMN IF NOT EXISTS guarantee_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS guarantee_48h_payout_id text,
  ADD COLUMN IF NOT EXISTS guarantee_48h_payout_amount numeric DEFAULT 100,
  ADD COLUMN IF NOT EXISTS plan_tier text DEFAULT 'starter' CHECK (plan_tier IN ('starter','pro','scale')),
  ADD COLUMN IF NOT EXISTS rev_share_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS work_free_mode boolean DEFAULT false;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_businesses_guarantee_start_at ON public.businesses(guarantee_start_at);
CREATE INDEX IF NOT EXISTS idx_sales_business_created ON public.sales(business_id, created_at);
