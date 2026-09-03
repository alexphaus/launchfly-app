-- ═══════════════════════════════════════════════════════════════════════════
-- Foundation Copilot — operator-scoped schema
--
-- Divergence from the rest of Launchfly: every table here is keyed on the
-- OPERATOR (auth.users), not on a business. Launchfly's existing tables answer
-- "what should this business do for its customers?". Foundation answers
-- "what should this person do today?". A user may have zero businesses and
-- still be a full Foundation user, so business_id is an optional back-link.
--
-- Run in the Supabase SQL editor (or `supabase db push`).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS vector;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Operator profile + capacity
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.foundation_profiles (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name       text,
  headline           text,                       -- "n8n automation builder, SEA"
  positioning        text,                       -- free-text self-description, embedded for matching
  timezone           text NOT NULL DEFAULT 'UTC',
  currency           text NOT NULL DEFAULT 'USD',
  capacity_mode      text NOT NULL DEFAULT 'moderate'
                     CHECK (capacity_mode IN ('deep', 'moderate', 'low')),
  capacity_set_at    timestamptz DEFAULT now(),
  weekly_hours       numeric NOT NULL DEFAULT 25, -- billable hours the operator can actually sell
  min_deal_value     numeric NOT NULL DEFAULT 0,  -- floor below which work costs more than it earns
  brief_hour         smallint NOT NULL DEFAULT 7  -- local hour the daily brief should be ready
                     CHECK (brief_hour BETWEEN 0 AND 23),
  embedding          vector(1536),                -- positioning + skills, refreshed on change
  embedding_stale    boolean NOT NULL DEFAULT true,
  primary_business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Skills — the operator's supply side
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.foundation_skills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug          text NOT NULL,                  -- 'n8n-workflow-architecture'
  label         text NOT NULL,                  -- 'n8n workflow architecture'
  proficiency   smallint NOT NULL DEFAULT 0 CHECK (proficiency BETWEEN 0 AND 100),
  source        text NOT NULL DEFAULT 'declared'
                CHECK (source IN ('declared', 'inferred', 'demand')),
  evidence      jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{kind,ref,note}] — why we believe this
  demand_count  integer NOT NULL DEFAULT 0,      -- opportunities seen requiring it (rolling)
  matched_count integer NOT NULL DEFAULT 0,      -- of those, how many the operator matched on
  embedding     vector(1536),
  last_seen_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Goals — what the ranking is optimising for
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.foundation_goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key           text NOT NULL,                  -- 'monthly_revenue' | 'runway' | custom
  label         text NOT NULL,
  kind          text NOT NULL DEFAULT 'custom'
                CHECK (kind IN ('revenue', 'runway', 'volume', 'custom')),
  target_value  numeric,
  current_value numeric NOT NULL DEFAULT 0,
  unit          text NOT NULL DEFAULT 'currency'
                CHECK (unit IN ('currency', 'months', 'count', 'percent')),
  period        text NOT NULL DEFAULT 'month'
                CHECK (period IN ('week', 'month', 'quarter', 'none')),
  priority      smallint NOT NULL DEFAULT 0,    -- higher wins ties in ranking
  note          text,                           -- "Priority: close before relocation"
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'paused', 'hit', 'missed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Context sources — each one raises match confidence, none unlock new UI
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.foundation_context_sources (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind           text NOT NULL
                 CHECK (kind IN ('calendar', 'crm', 'finance', 'email', 'chat', 'files', 'launchfly')),
  provider       text,                          -- 'google', 'stripe', 'launchfly', ...
  status         text NOT NULL DEFAULT 'disconnected'
                 CHECK (status IN ('disconnected', 'connecting', 'connected', 'error')),
  config         jsonb NOT NULL DEFAULT '{}'::jsonb,   -- non-secret config only
  credential_ref text,                          -- pointer into the secret store, never the secret
  scopes         text[] NOT NULL DEFAULT '{}',
  last_synced_at timestamptz,
  last_error     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, provider)
);

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Opportunities — the demand side (clients, people, services, communities, signals)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.foundation_opportunities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            text NOT NULL DEFAULT 'client'
                  CHECK (type IN ('client', 'person', 'service', 'community', 'signal')),
  title           text NOT NULL,
  summary         text,
  body            text,                          -- full source text, embedded
  source          text NOT NULL DEFAULT 'manual', -- 'manual','bossjob','telegram','launchfly',...
  source_url      text,
  external_id     text,                          -- dedupe key within a source
  value_amount    numeric,
  value_currency  text DEFAULT 'USD',
  value_kind      text NOT NULL DEFAULT 'fixed'
                  CHECK (value_kind IN ('fixed', 'hourly', 'recurring', 'none')),
  effort_hours    numeric,
  required_skills text[] NOT NULL DEFAULT '{}',  -- skill slugs
  deadline_at     timestamptz,
  posted_at       timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  status          text NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'saved', 'pursuing', 'won', 'lost', 'dismissed', 'expired')),
  raw             jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding       vector(1536),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS foundation_opportunities_source_key
  ON public.foundation_opportunities (user_id, source, external_id)
  WHERE external_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Matches — the scored join. Scores are computed in code, never by an LLM.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.foundation_matches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES public.foundation_opportunities(id) ON DELETE CASCADE,
  score           smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  breakdown       jsonb NOT NULL DEFAULT '{}'::jsonb,  -- per-factor contributions
  confidence      numeric NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  reason          text,                          -- one line, LLM-written from the breakdown
  reason_model    text,
  capacity_fit    text NOT NULL DEFAULT 'moderate'
                  CHECK (capacity_fit IN ('deep', 'moderate', 'low')),
  seen_at         timestamptz,
  computed_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Actions — today's plan rows ("AI drafted" / "Needs you")
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.foundation_actions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             text NOT NULL,
  detail            text,
  kind              text NOT NULL DEFAULT 'needs_you'
                    CHECK (kind IN ('ai_drafted', 'needs_you')),
  lane              text NOT NULL DEFAULT 'plan'
                    CHECK (lane IN ('plan', 'next')),   -- leverage plan vs. next actions
  urgency           text NOT NULL DEFAULT 'soon'
                    CHECK (urgency IN ('overdue', 'today', 'soon', 'backlog')),
  category          text,                        -- 'finance', 'security', 'outreach', ...
  estimated_minutes integer,
  min_capacity      text NOT NULL DEFAULT 'low'
                    CHECK (min_capacity IN ('deep', 'moderate', 'low')),
  draft_content     text,                        -- the AI-written draft awaiting review
  draft_channel     text,                        -- 'whatsapp' | 'email' | 'dm'
  source_kind       text,                        -- 'opportunity' | 'goal' | 'brief' | 'agent_task'
  source_id         uuid,
  agent_task_id     uuid REFERENCES public.agent_tasks(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'sent', 'done', 'snoozed', 'dismissed')),
  due_at            timestamptz,
  snoozed_until     timestamptz,
  completed_at      timestamptz,
  brief_date        date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- 8. Briefs — one per user per day, with the evidence behind "today's read"
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.foundation_briefs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_date  date NOT NULL,
  greeting    text,
  read_text   text NOT NULL,                   -- the "Today's read" paragraph
  evidence    jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{claim, value, source, observed_at}]
  metrics     jsonb NOT NULL DEFAULT '{}'::jsonb, -- new_matches, needs_you, urgent counts
  confidence  numeric NOT NULL DEFAULT 0.5,
  model       text,
  cost_usd    numeric NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, brief_date)
);

-- ───────────────────────────────────────────────────────────────────────────
-- 9. Learning items — "worth learning this week", tied to real missed demand
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.foundation_learning_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  minutes     integer,
  rationale   text NOT NULL,                    -- must cite the demand that justifies it
  skill_slug  text,
  url         text,
  position    smallint NOT NULL DEFAULT 0,
  week_of     date NOT NULL,
  status      text NOT NULL DEFAULT 'suggested'
              CHECK (status IN ('suggested', 'started', 'done', 'dismissed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_of, title)
);

-- ───────────────────────────────────────────────────────────────────────────
-- 10. Events — the feedback loop. Every dismiss/pursue re-teaches the ranker.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.foundation_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text NOT NULL,                    -- 'match_dismissed','action_done','capacity_set',...
  subject_kind text,
  subject_id  uuid,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- Indexes
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_foundation_skills_user       ON public.foundation_skills (user_id, proficiency DESC);
CREATE INDEX IF NOT EXISTS idx_foundation_goals_user        ON public.foundation_goals (user_id, status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_foundation_sources_user      ON public.foundation_context_sources (user_id, status);
CREATE INDEX IF NOT EXISTS idx_foundation_opps_user_status  ON public.foundation_opportunities (user_id, status, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_foundation_opps_type         ON public.foundation_opportunities (user_id, type, status);
CREATE INDEX IF NOT EXISTS idx_foundation_matches_rank      ON public.foundation_matches (user_id, score DESC, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_foundation_actions_open      ON public.foundation_actions (user_id, status, urgency, due_at);
CREATE INDEX IF NOT EXISTS idx_foundation_actions_brief     ON public.foundation_actions (user_id, brief_date);
CREATE INDEX IF NOT EXISTS idx_foundation_events_user       ON public.foundation_events (user_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_foundation_learning_week     ON public.foundation_learning_items (user_id, week_of, position);

-- Vector indexes (ivfflat, cosine). Lists tuned for early scale; revisit past ~100k rows.
CREATE INDEX IF NOT EXISTS idx_foundation_opps_embedding
  ON public.foundation_opportunities USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_foundation_skills_embedding
  ON public.foundation_skills USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- ───────────────────────────────────────────────────────────────────────────
-- RPC: semantic candidate retrieval for a user's open opportunities
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.foundation_search_opportunities(
  query_embedding vector(1536),
  match_user_id   uuid,
  match_types     text[] DEFAULT NULL,
  match_count     int DEFAULT 25
)
RETURNS TABLE (
  id uuid,
  type text,
  title text,
  summary text,
  value_amount numeric,
  value_currency text,
  value_kind text,
  effort_hours numeric,
  required_skills text[],
  deadline_at timestamptz,
  posted_at timestamptz,
  status text,
  source text,
  similarity double precision
)
LANGUAGE sql STABLE
AS $$
  SELECT
    o.id, o.type, o.title, o.summary, o.value_amount, o.value_currency,
    o.value_kind, o.effort_hours, o.required_skills, o.deadline_at,
    o.posted_at, o.status, o.source,
    1 - (o.embedding <=> query_embedding) AS similarity
  FROM public.foundation_opportunities o
  WHERE o.user_id = match_user_id
    AND o.embedding IS NOT NULL
    AND o.status IN ('new', 'saved', 'pursuing')
    AND (o.expires_at IS NULL OR o.expires_at > now())
    AND (match_types IS NULL OR o.type = ANY (match_types))
  ORDER BY o.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Row Level Security — every table is "you can only see your own rows".
-- The service role bypasses RLS; server code still filters by user_id.
-- ───────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'foundation_profiles', 'foundation_skills', 'foundation_goals',
    'foundation_context_sources', 'foundation_opportunities',
    'foundation_matches', 'foundation_actions', 'foundation_briefs',
    'foundation_learning_items', 'foundation_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',
      t || '_owner', t
    );
  END LOOP;
END $$;

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.foundation_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'foundation_profiles', 'foundation_skills', 'foundation_goals',
    'foundation_context_sources', 'foundation_opportunities', 'foundation_actions'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_touch', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.foundation_touch_updated_at()',
      t || '_touch', t
    );
  END LOOP;
END $$;
