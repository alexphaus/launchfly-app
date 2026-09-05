-- Migration: Copilot — plans, metered usage and Stripe subscriptions
-- The copilot has two real costs per user: scraping credits for sourced matches
-- and model tokens for briefs. Everything metered here maps to one of those, so
-- a plan limit is never an invented number.
-- Additive and idempotent. Run after 20260905_copilot_multi_user.sql.

-- ─── What plan this profile is on ───────────────────────────────────────────
-- 'free' is the real product with a small allowance, not a locked demo: the
-- whole loop works, there is just not enough supply to run a business on.
alter table copilot_profiles add column if not exists plan text not null default 'free'
  check (plan in ('free', 'pro', 'operator'));

-- Mirrors the Stripe subscription status. 'active' and 'trialing' entitle; every
-- other value falls back to free limits without deleting the row, so a failed
-- payment degrades instead of destroying the account.
alter table copilot_profiles add column if not exists plan_status text not null default 'active'
  check (plan_status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete'));

alter table copilot_profiles add column if not exists stripe_customer_id text;
alter table copilot_profiles add column if not exists stripe_subscription_id text;
-- End of the paid period. Access survives until this instant even after cancel.
alter table copilot_profiles add column if not exists plan_renews_at timestamptz;
alter table copilot_profiles add column if not exists plan_cancels_at_period_end boolean not null default false;

-- One customer maps to one profile. Partial so the many null rows never collide.
create unique index if not exists copilot_profiles_stripe_customer_idx
  on copilot_profiles(stripe_customer_id) where stripe_customer_id is not null;

-- ─── Metered usage, one row per profile per month per metric ────────────────
-- 'matches'  = sourced opportunities actually inserted (what the user receives,
--              not what an adapter was asked for — a failed scrape costs nobody).
-- 'briefs'   = agent runs of kind daily_brief.
create table if not exists copilot_usage (
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  period text not null,                         -- 'YYYY-MM' in the profile's timezone
  metric text not null check (metric in ('matches', 'briefs')),
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (profile_id, period, metric)
);

create index if not exists copilot_usage_period_idx on copilot_usage(period);

-- Atomic increment. Doing this read-modify-write in JS races two supply runs
-- against each other and silently loses a month of metering.
create or replace function copilot_bump_usage(p_profile uuid, p_period text, p_metric text, p_delta integer)
returns integer
language plpgsql
as $$
declare
  new_count integer;
begin
  insert into copilot_usage (profile_id, period, metric, count, updated_at)
  values (p_profile, p_period, p_metric, greatest(p_delta, 0), now())
  on conflict (profile_id, period, metric)
  do update set count = copilot_usage.count + greatest(p_delta, 0), updated_at = now()
  returning count into new_count;
  return new_count;
end;
$$;

-- ─── Stripe webhook log ─────────────────────────────────────────────────────
-- Stripe retries and can deliver the same event twice. The primary key is the
-- Stripe event id, so replaying one is a no-op rather than a double upgrade.
create table if not exists copilot_billing_events (
  id text primary key,                          -- Stripe event id (evt_...)
  type text not null,
  profile_id uuid references copilot_profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  handled_at timestamptz not null default now()
);

create index if not exists copilot_billing_events_profile_idx on copilot_billing_events(profile_id, handled_at desc);

-- Service-key only, same as every other copilot table: RLS on, no policies.
alter table copilot_usage enable row level security;
alter table copilot_billing_events enable row level security;
