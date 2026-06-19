-- Personal savings tracker (single-row JSON store, accessed via API only)
CREATE TABLE IF NOT EXISTS public.personal_savings_tracker (
  id text PRIMARY KEY DEFAULT 'default',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_savings_tracker ENABLE ROW LEVEL SECURITY;

INSERT INTO public.personal_savings_tracker (id, data)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
