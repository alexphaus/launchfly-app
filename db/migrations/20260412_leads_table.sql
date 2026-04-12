-- Generic per-business leads table for agent lead generation.
-- Separate from hunter_prospects (Launchfly's own sales pipeline).
-- Any business on the platform can use this for their own lead gen.

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Unknown',
  phone text,
  email text,
  website text,
  address text,
  category text,
  notes text,
  source text DEFAULT 'agent',
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost', 'archived')),
  rating numeric(2,1),
  reviews_count integer,
  google_maps_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT leads_pkey PRIMARY KEY (id)
);

-- Index for fast lookups by business + phone (dedup)
CREATE UNIQUE INDEX IF NOT EXISTS leads_biz_phone_uniq
  ON public.leads (business_id, phone)
  WHERE phone IS NOT NULL;

-- Index for listing by business
CREATE INDEX IF NOT EXISTS leads_biz_created
  ON public.leads (business_id, created_at DESC);

-- RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select_own" ON public.leads
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "leads_insert_own" ON public.leads
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "leads_update_own" ON public.leads
  FOR UPDATE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "leads_delete_own" ON public.leads
  FOR DELETE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

-- Service role bypass
CREATE POLICY "leads_service_all" ON public.leads
  FOR ALL USING (true) WITH CHECK (true);
