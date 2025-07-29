SUPABASE SCHEMA:
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

-- Core business table with enhanced website data
CREATE TABLE public.businesses (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  subdomain text NOT NULL UNIQUE,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'generating'::text, 'ready'::text, 'failed'::text])),
  session_id text UNIQUE,
  phone_number text,
  completed_onboarding boolean DEFAULT false,
  launch_date timestamp with time zone,
  trial_ends_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
  form_data jsonb NOT NULL,
  business_data jsonb, -- Enhanced with website.theme, website.layout, products, etc.
  views integer DEFAULT 0,
  last_viewed_at timestamp with time zone,
  first_sale_date timestamp with time zone,
  total_revenue numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT businesses_pkey PRIMARY KEY (id),
  CONSTRAINT businesses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Enhanced sessions table with growth tracking
CREATE TABLE public.sessions (
  id text NOT NULL,
  business_id uuid,
  stage text DEFAULT 'initializing'::text CHECK (stage = ANY (ARRAY['pending'::text, 'initializing'::text, 'analyzing'::text, 'researching'::text, 'building'::text, 'finalizing'::text, 'complete'::text, 'error'::text])),
  progress integer DEFAULT 0,
  stage_message text,
  completed_steps ARRAY DEFAULT '{}'::text[],
  phone_number text,
  business_metrics jsonb, -- Revenue, customers, conversion rate
  growth_log jsonb, -- Growth experiment results
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  plan text DEFAULT 'trial'::text CHECK (plan = ANY (ARRAY['trial'::text, 'starter'::text, 'growth'::text, 'scale'::text])),
  phone_number text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- New table for customer leads from dynamic websites
CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text,
  service_interest text,
  source text DEFAULT 'website'::text,
  status text DEFAULT 'new'::text CHECK (status = ANY (ARRAY['new'::text, 'contacted'::text, 'qualified'::text, 'converted'::text, 'lost'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT leads_pkey PRIMARY KEY (id),
  CONSTRAINT leads_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);

-- New table for conversion tracking
CREATE TABLE public.conversions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL,
  conversion_type text NOT NULL, -- 'lead_generated', 'sale_made', 'consultation_booked'
  value numeric DEFAULT 0,
  source text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conversions_pkey PRIMARY KEY (id),
  CONSTRAINT conversions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);

-- New table for growth experiments (our competitive moat)
CREATE TABLE public.experiments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id text NOT NULL,
  experiment_name text NOT NULL,
  experiment_type text NOT NULL, -- 'acquisition', 'conversion', 'revenue'
  hypothesis text,
  implementation text,
  success boolean,
  metrics jsonb,
  learnings text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT experiments_pkey PRIMARY KEY (id),
  CONSTRAINT experiments_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);

-- Enhanced indexes for performance
CREATE INDEX idx_businesses_subdomain ON public.businesses(subdomain);
CREATE INDEX idx_businesses_status ON public.businesses(status);
CREATE INDEX idx_leads_business_id ON public.leads(business_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_conversions_business_id ON public.conversions(business_id);
CREATE INDEX idx_experiments_session_id ON public.experiments(session_id);