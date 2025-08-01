SUPABASE SCHEMA:
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

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
  business_data jsonb,
  views integer DEFAULT 0,
  first_sale_date timestamp with time zone,
  total_revenue numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT businesses_pkey PRIMARY KEY (id),
  CONSTRAINT businesses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
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
CREATE TABLE public.sessions (
  id text NOT NULL,
  CONSTRAINT sessions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);

CREATE TABLE public.sales (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL,
  product_id text,
  product_name text,
  amount numeric,
  customer_email text,
  stripe_session_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);