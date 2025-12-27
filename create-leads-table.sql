CREATE TABLE IF NOT EXISTS public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  phone text NOT NULL,
  service text NOT NULL,
  area text NOT NULL,
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'converted', 'rejected')),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT leads_pkey PRIMARY KEY (id)
);

-- Add RLS policies if needed, but for now assuming internal use or admin only.
-- If RLS is enabled on public schema by default, we might need to enable it for this table and add policies.
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to authenticated users" ON public.leads
  FOR ALL USING (auth.role() = 'authenticated');
