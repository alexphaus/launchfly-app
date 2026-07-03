-- Leads captured by the landing-page prototype (public/start.html).
-- Written only via the service role from /api/prototype/lead.

CREATE TABLE IF NOT EXISTS public.prototype_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  idea text,
  mode text DEFAULT 'new' CHECK (mode IN ('new', 'existing')),
  plan text DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'scale')),
  business jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT prototype_leads_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS prototype_leads_created
  ON public.prototype_leads (created_at DESC);

-- RLS on with no policies: anon/authenticated clients are denied,
-- the service role (used by the API) bypasses RLS.
ALTER TABLE public.prototype_leads ENABLE ROW LEVEL SECURITY;
