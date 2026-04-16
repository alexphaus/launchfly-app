-- Run this in your Supabase SQL Editor to speed up Agent Database queries

-- Add composite indexes for the Agent's query_database tool 
-- so that .eq('business_id', id).order('created_at', desc) is instantaneous 
-- instead of performing a sequential scan + memory heapsort on large tables.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_history_business_created 
  ON public.chat_history (business_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_business_created 
  ON public.customers (business_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_tasks_business_created 
  ON public.agent_tasks (business_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_business_created 
  ON public.bookings (business_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_business_created 
  ON public.leads (business_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_business_created 
  ON public.sales (business_id, created_at DESC);
