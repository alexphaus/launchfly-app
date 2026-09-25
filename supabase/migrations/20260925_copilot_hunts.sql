-- 20260925_copilot_hunts.sql
-- What to look for, in the user's words.
--
-- Supply has been one query shape for everybody: every target segment, as
-- typed, searched on Google Maps as "segment in area". That fits somebody who
-- sells to the shops and trades down the road and nobody else — a live account
-- selling medieval-market jewellery in Toledo got sixty businesses from Toledo,
-- Ohio, and the ranker's own reasons said so. B2B buyers, a handful of named
-- people, a list somebody publishes: none of those are "segment in area", and
-- there was nowhere to say what else to look for.
--
-- A hunt is one line the user wrote and a kind saying who runs it:
--
--   companies  a web search over company sites; the site is read for a contact
--   people     a web search over public profiles; contacted by hand
--   agent      a standing brief for the research worker, handed over as a
--              DRAFT commission (commission_id) and approved like any other
--
-- Places stay in copilot_profiles.target_segments and posts stay in
-- copilot_sources. Finds are ordinary copilot_opportunities rows carrying
-- data.hunt_id, so the pool, the dedupe, the ranker and the keep-rate all work
-- on them unchanged — no column is added anywhere else.
--
-- Additive and idempotent. Until it is applied, loadHunts reports the table as
-- unreadable (the hunts sheet says so) and every other path behaves exactly as
-- before: no hunts means supply is Maps and feeds, which is today.

create table if not exists copilot_hunts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  kind text not null check (kind in ('companies','people','agent')),
  -- The user's words, searched as written. Never rewritten by a model: a
  -- suggestion becomes a hunt only when the user adds it, and then it is theirs.
  query text not null,
  area text,
  -- A short name for the chip on Matches.
  label text not null,
  status text not null default 'active' check (status in ('active','paused')),
  origin text not null default 'user' check (origin in ('user','suggested')),
  -- The mandate behind an agent hunt — the latest, when it has been re-run.
  commission_id uuid references copilot_commissions(id) on delete set null,
  -- The last run, as the finder reported it. last_error is cleared by the next
  -- good run; until then the hunt says it failed rather than looking quiet.
  last_run_at timestamptz,
  last_found int,
  -- An agent hunt's finds whose link would not open, last delivery. Kept apart
  -- from last_error: dropping an unverifiable find is the check working, not
  -- the hunt failing, but the gap between "the worker found 7" and "5 arrived"
  -- still has to be on the screen.
  last_dropped int,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists copilot_hunts_profile_idx on copilot_hunts(profile_id, created_at);
create index if not exists copilot_hunts_commission_idx on copilot_hunts(commission_id) where commission_id is not null;

-- The per-hunt yield reads opportunities by data->>'hunt_id'. Without this the
-- read is a scan of every opportunity the account has ever had. Partial, and
-- deliberately NOT unique: nothing upserts against it, so it cannot become the
-- index PostgREST's on_conflict fails to infer (see 20260918 and CLAUDE.md).
create index if not exists copilot_opportunities_hunt_idx
  on copilot_opportunities(profile_id, ((data->>'hunt_id')))
  where data ? 'hunt_id';
