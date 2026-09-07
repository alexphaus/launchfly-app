-- 20260909_copilot_shared_pool.sql
-- The pool stops being one per user.
--
-- Until now the dedupe key was (profile_id, source, external_id), so the same
-- business scraped by two people was two rows, paid for twice, and could be
-- messaged by both on the same morning. Everything defensible about this
-- product needs the opposite: one row per real business that every profile
-- refers to. Territory, contact quality and regional demand are all queries
-- over that shared row and are impossible without it.
--
-- Additive and idempotent, and nothing reads it yet. Supply writes through to
-- both, so the shared pool starts accumulating in the right shape before there
-- is enough data for the retrofit to hurt. Every existing read path is
-- untouched and keeps working whether or not this file has been applied --
-- required, because migrations here are run by hand after the code ships.

create table if not exists copilot_businesses (
  id uuid primary key default gen_random_uuid(),
  source text not null,                     -- adapter key: google_maps | hunter | remote
  external_id text not null,                -- stable id in that source (place_id etc.)
  title text not null,
  url text,
  contact jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,  -- rating, reviews, pain_signals, category
  segment text,                             -- grouping key, for regional demand
  area text,                                -- city or target area, same
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source, external_id)
);

-- Regional demand reads by where and what, never by who.
create index if not exists copilot_businesses_segment_idx on copilot_businesses(segment, area);
create index if not exists copilot_businesses_seen_idx on copilot_businesses(last_seen_at desc);

-- The claim. An opportunity stops being the business and starts being this
-- profile's relationship to one. Nullable on purpose: rows created before this
-- migration, and inferred opportunities that correspond to no real listing,
-- both legitimately have no business.
alter table copilot_opportunities add column if not exists business_id uuid references copilot_businesses(id) on delete set null;
create index if not exists copilot_opportunities_business_idx on copilot_opportunities(business_id);

-- Shared, so it is deliberately NOT profile-scoped. RLS on with no policy:
-- anon and authenticated get nothing, and the service key this app uses is
-- unaffected. Territory will expose "claimed", never by whom.
alter table copilot_businesses enable row level security;
