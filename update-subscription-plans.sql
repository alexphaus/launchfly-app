-- Update platform_subscriptions table to allow new plan types
-- Run this in your Supabase SQL Editor

ALTER TABLE public.platform_subscriptions 
DROP CONSTRAINT IF EXISTS platform_subscriptions_plan_check;

ALTER TABLE public.platform_subscriptions 
ADD CONSTRAINT platform_subscriptions_plan_check 
CHECK (plan IN ('professional', 'scale', 'pro', 'vip', 'starter'));

-- Verify the change
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'platform_subscriptions_plan_check';
