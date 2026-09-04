-- Migration: Copilot — close the loop
-- Adds real supply, approve-and-send execution, outcome tracking, finance,
-- magic-link login, push subscriptions and rate limits. Additive only; safe to
-- re-run. Run after 20260903_copilot_foundation.sql.

-- ─── Phase 1: real supply ───────────────────────────────────────────────────
alter table copilot_profiles add column if not exists target_segments text[] not null default '{}';
alter table copilot_profiles add column if not exists target_area text;
-- Optional link to a Launchfly business: scopes the WhatsApp instance, Apify
-- token and prospect data the copilot may use. Null = env-level defaults.
alter table copilot_profiles add column if not exists linked_business_id uuid;

alter table copilot_opportunities add column if not exists external_id text;
alter table copilot_opportunities add column if not exists source_kind text not null default 'inferred'
  check (source_kind in ('sourced','inferred'));
alter table copilot_opportunities add column if not exists contact jsonb not null default '{}'::jsonb;  -- {name, whatsapp, email, website}
alter table copilot_opportunities add column if not exists scored_at timestamptz;                       -- when the agent last ranked it
-- Dedupe sourced rows by identity, not by title. NULL external_id (inferred) never collides.
create unique index if not exists copilot_opportunities_external_uniq
  on copilot_opportunities(profile_id, source, external_id);

-- ─── Phase 2: approve and send ──────────────────────────────────────────────
create table if not exists copilot_executions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  action_id uuid references copilot_actions(id) on delete set null,
  opportunity_id uuid references copilot_opportunities(id) on delete set null,
  channel text not null check (channel in ('whatsapp','email')),
  recipient text not null,
  subject text,
  body text not null,
  approval_state text not null default 'needs_approval'
    check (approval_state in ('needs_approval','approved','sent','failed','cancelled')),
  provider text,
  external_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists copilot_executions_profile_idx on copilot_executions(profile_id, approval_state, created_at desc);
create index if not exists copilot_executions_action_idx on copilot_executions(action_id);
create index if not exists copilot_executions_recipient_idx on copilot_executions(profile_id, recipient, sent_at desc);

-- ─── Phase 3: outcomes ──────────────────────────────────────────────────────
create table if not exists copilot_outcomes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  opportunity_id uuid references copilot_opportunities(id) on delete set null,
  action_id uuid references copilot_actions(id) on delete set null,
  execution_id uuid references copilot_executions(id) on delete set null,
  kind text not null check (kind in ('reply','meeting','proposal','won','lost','no_reply')),
  amount numeric,
  currency text,
  note text,
  source text not null default 'manual' check (source in ('manual','system','webhook')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists copilot_outcomes_profile_idx on copilot_outcomes(profile_id, occurred_at desc);
create index if not exists copilot_outcomes_opportunity_idx on copilot_outcomes(opportunity_id);
create index if not exists copilot_outcomes_execution_idx on copilot_outcomes(execution_id);

-- ─── Phase 4: finance (runway) ──────────────────────────────────────────────
alter table copilot_profiles add column if not exists finance jsonb not null default '{}'::jsonb;  -- {monthly_burn, cash, currency, updated_at}

-- ─── Phase 5: login, push, abuse limits ─────────────────────────────────────
alter table copilot_profiles add column if not exists pending_login_email text;
alter table copilot_profiles add column if not exists email_verified_at timestamptz;
create index if not exists copilot_profiles_email_idx on copilot_profiles(lower(email));

create table if not exists copilot_login_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references copilot_profiles(id) on delete cascade,   -- set when linking from inside the app
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists copilot_login_tokens_email_idx on copilot_login_tokens(lower(email), created_at desc);

create table if not exists copilot_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists copilot_push_subscriptions_profile_idx on copilot_push_subscriptions(profile_id);

create table if not exists copilot_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);

-- updated_at trigger for the new table
drop trigger if exists copilot_executions_touch on copilot_executions;
create trigger copilot_executions_touch before update on copilot_executions
  for each row execute function copilot_touch_updated_at();

-- RLS on every new table (service key only, same as the foundation)
do $$
declare t text;
begin
  foreach t in array array['copilot_executions','copilot_outcomes','copilot_login_tokens','copilot_push_subscriptions','copilot_rate_limits']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
