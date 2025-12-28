CREATE TABLE public.sales_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  service text,
  area text,
  phone text,
  url text,
  context text,
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'converted', 'rejected')),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_leads_pkey PRIMARY KEY (id)
);
