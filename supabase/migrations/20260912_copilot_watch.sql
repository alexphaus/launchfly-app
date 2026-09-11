-- 20260912_copilot_watch.sql
-- Where supply comes from is a row, not a line of code.
--
-- Until now the list of places this app could look was `ADAPTERS` in
-- src/lib/copilot/supply/index.ts: Hunter, Google Maps, one remote webhook. Three
-- entries, compiled in, and every one of them answers the same question — which
-- local business should I message. That is one person's world. Hand the app to
-- somebody whose top goal is getting a job and there is nothing for it to look
-- at; hand it to a freelancer who lives in two Discords and a subcontract
-- channel and it cannot see either. It was the same shape of bug as JOBS having
-- one entry, one layer further down.
--
-- So the sources move into the database, per profile. A feed URL is the 80% of
-- this: Reddit exposes .rss on every subreddit and every search, Google Alerts
-- emits RSS, Hacker News has hnrss.org, the remote job boards and most job
-- boards publish one, YouTube and GitHub and Substack all do. No scraper, no
-- API key, no per-site adapter — a URL the user pasted, fetched nightly.
--
-- `seen_ids` is why there is no second table. Dedupe needs to answer "have I
-- looked at this item before", and a rolling window of the last few hundred
-- item ids answers it exactly, including for the many feeds that publish no
-- dates at all. Bounded by trimSeen() in watch/feed.ts, so it cannot grow.
--
-- Additive and idempotent. Nothing existing reads this table, so an unapplied
-- migration costs the watcher and nothing else — every read path degrades to an
-- empty source list.

create table if not exists copilot_sources (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,

  -- 'feed' is the only kind the code implements. 'page' (fetch and diff) and
  -- 'push' (an inbound webhook per source, for the Discords and Slacks that
  -- have no feed) are named here so adding them is a job, not a migration.
  kind text not null default 'feed' check (kind in ('feed','page','push')),
  url text not null,
  label text not null,
  -- Why the user added it, in their words or from the catalogue. Goes into the
  -- judge's prompt: "this feed is here because you are looking for contract
  -- work" is the difference between a relevant pick and a topical one.
  intent text,

  -- How often it is worth checking. A job board that posts hourly and a
  -- competitor's blog do not deserve the same budget, and every check costs one
  -- model call.
  every_hours int not null default 24,

  -- 'error' is allowed but never written: a source that fails keeps its status
  -- and records last_error instead, because dueSources only reads active rows
  -- and one bad night would otherwise disable a feed permanently.
  status text not null default 'active' check (status in ('active','paused','error')),
  -- The last N item ids seen, newest last. Exact dedupe without dates.
  seen_ids text[] not null default '{}',
  last_checked_at timestamptz,
  -- What went wrong, shown on the Sources sheet. A source that silently stops
  -- working is worse than one that says it is broken.
  last_error text,
  created_at timestamptz not null default now(),

  -- One row per URL per person. Pasting the same feed twice is a no-op, not a
  -- second nightly model call against the same items.
  unique (profile_id, url)
);

create index if not exists copilot_sources_profile_idx
  on copilot_sources(profile_id, status, last_checked_at);
