-- Migration: Copilot foundation (opportunity engine + life OS)
-- Description: Isolated tables for the /copilot vertical. Nothing here touches
-- existing Launchfly tables. Run in Supabase SQL Editor or via supabase db push.
--
-- Design notes
--   * copilot_profiles        who the user is + current capacity
--   * copilot_goals           what they are going for (drives ranking)
--   * copilot_context_items   the data-plumbing landing zone: every fact we learn
--                             (onboarding answers, notes, later connector syncs)
--   * copilot_context_sources connectors foundation (calendar / CRM / finances)
--   * copilot_opportunities   ranked matches (clients, people, services, communities, signals)
--   * copilot_actions         daily leverage plan items + nudges (owner = ai | you)
--   * copilot_insights        "Today's read" per day
--   * copilot_growth_items    skills + things worth learning
--   * copilot_events          feedback loop: everything the user does in the app
--   * copilot_agent_runs      audit log of agent invocations

create extension if not exists pgcrypto;

create table if not exists copilot_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  headline text,                       -- "what you do", one line
  location text,
  timezone text default 'UTC',
  capacity text not null default 'moderate' check (capacity in ('deep','moderate','low')),
  hunt_types text[] not null default array['client','people','service','community','signal'],
  onboarding_complete boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists copilot_goals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  title text not null,
  metric text not null default 'none' check (metric in ('currency','number','percent','none')),
  unit text,                            -- e.g. USD, clients, months
  target_value numeric,
  current_value numeric default 0,
  horizon_days int default 90,
  priority int not null default 1,      -- 1 = primary
  status text not null default 'active' check (status in ('active','done','paused')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists copilot_goals_profile_idx on copilot_goals(profile_id, status);

create table if not exists copilot_context_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  source text not null,                 -- onboarding | note | checkin | calendar | crm | finance | system
  kind text not null default 'fact',    -- fact | constraint | preference | metric | event
  content text not null,
  data jsonb not null default '{}'::jsonb,
  weight real not null default 1.0,     -- how much the agent should trust/rely on it
  created_at timestamptz not null default now()
);
create index if not exists copilot_context_items_profile_idx on copilot_context_items(profile_id, created_at desc);

create table if not exists copilot_context_sources (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  source_key text not null,             -- calendar | crm | finance
  status text not null default 'not_connected' check (status in ('not_connected','requested','connected','error')),
  config jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, source_key)
);

create table if not exists copilot_opportunities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  type text not null check (type in ('client','people','service','community','signal')),
  title text not null,
  reason text not null,
  value_label text,                     -- "$1,800" | "Join" | "Read"
  value_amount numeric,
  currency text,
  effort text not null default 'medium' check (effort in ('light','medium','deep')),
  fit_score int not null default 50 check (fit_score between 0 and 100),   -- agent's raw fit
  score int not null default 50 check (score between 0 and 100),           -- final ranked score
  source text,
  url text,
  status text not null default 'new' check (status in ('new','saved','dismissed','acted')),
  data jsonb not null default '{}'::jsonb,
  agent_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists copilot_opportunities_profile_idx on copilot_opportunities(profile_id, status, score desc);

create table if not exists copilot_actions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  kind text not null check (kind in ('plan','nudge')),
  owner text not null default 'you' check (owner in ('ai','you')),
  title text not null,
  detail text,
  ai_draft text,                        -- content the agent produced, ready to review
  urgency text not null default 'normal' check (urgency in ('urgent','normal','info')),
  due_label text,                       -- "Due today" | "Overdue" | "Finance"
  minutes int,                          -- estimated effort, used by capacity filter
  status text not null default 'open' check (status in ('open','done','dismissed')),
  opportunity_id uuid references copilot_opportunities(id) on delete set null,
  for_date date not null default (now() at time zone 'utc')::date,
  agent_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists copilot_actions_profile_idx on copilot_actions(profile_id, for_date desc, status);

create table if not exists copilot_insights (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  for_date date not null default (now() at time zone 'utc')::date,
  eyebrow text not null default 'Today''s read',
  body text not null,
  reasoning text,
  agent_run_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists copilot_insights_profile_idx on copilot_insights(profile_id, for_date desc);

create table if not exists copilot_growth_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  kind text not null check (kind in ('skill','lesson')),
  title text not null,
  level int check (level between 0 and 100),   -- skills only
  minutes int,                                  -- lessons only
  note text,
  cta text,
  url text,
  status text not null default 'active' check (status in ('active','done','dismissed')),
  agent_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists copilot_growth_items_profile_idx on copilot_growth_items(profile_id, kind, status);

create table if not exists copilot_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  event_type text not null,             -- opportunity_saved | opportunity_dismissed | action_done | capacity_set | note_added | goal_updated | source_requested | app_open
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists copilot_events_profile_idx on copilot_events(profile_id, created_at desc);

create table if not exists copilot_agent_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  kind text not null default 'daily_brief',
  agent text not null,                  -- webhook | llm | starter
  model text,
  status text not null default 'running' check (status in ('running','ok','error')),
  input_summary jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists copilot_agent_runs_profile_idx on copilot_agent_runs(profile_id, started_at desc);

-- updated_at maintenance
create or replace function copilot_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['copilot_profiles','copilot_goals','copilot_context_sources','copilot_opportunities','copilot_actions','copilot_growth_items']
  loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format('create trigger %I_touch before update on %I for each row execute function copilot_touch_updated_at()', t, t);
  end loop;
end $$;

-- Row level security: the app talks to these tables with the service key only.
-- Lock them down so the anon key cannot read anything.
do $$
declare t text;
begin
  foreach t in array array['copilot_profiles','copilot_goals','copilot_context_items','copilot_context_sources','copilot_opportunities','copilot_actions','copilot_insights','copilot_growth_items','copilot_events','copilot_agent_runs']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
