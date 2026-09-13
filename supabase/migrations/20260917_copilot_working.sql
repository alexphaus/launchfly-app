-- 20260917_copilot_working.sql
-- What the app actually knows about this business.
--
-- Until now that was five strings: offer.sells, for_who, problem, price_band and
-- proof_url. A headline. Everything the app writes — every draft, every judged
-- feed item, every commissioned piece of research — is written from those five
-- strings, which is why the output reads like a template however good the model
-- is. It has nothing specific to be specific ABOUT.
--
-- A cofounder knows the things that are not on the landing page: how delivery
-- actually happens and how long it takes, what you quoted last time and whether
-- it closed, which customer worked out and which did not, what you already tried
-- that failed, and what you will not do. None of that is derivable from a
-- headline and all of it changes what should be written.
--
-- Two sources, and the difference between them is invariant 2.
--
--   'you'       the user wrote it. True because they said so.
--   'observed'  computed from their own rows, carrying the count that makes it
--               true. "3 of your 4 replies came from resorts" is a fact this app
--               can state because it can point at the rows. "You are good at
--               resorts" is an interpretation and is never written here.
--
-- There is no third source. The app does not guess about somebody's business and
-- then feed the guess back to itself as context — that is how an assistant ends
-- up confidently wrong about the one subject the user knows better than it does.
--
-- Observed entries arrive as 'proposed' and reach the prompts only once the user
-- confirms them. A computed fact is still the app's reading of what happened, and
-- the person who lived it gets the last word before it becomes part of what the
-- app believes.
--
-- Additive and idempotent. Nothing existing reads this table, so an unapplied
-- migration costs the working file and nothing else — every read degrades to an
-- empty one, which is the same state a new account is in and produces exactly
-- today's behaviour.

create table if not exists copilot_working (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,

  --   deliver     how the work actually happens, and how long it takes
  --   price       what was charged, and whether it closed
  --   works_for   who it worked for, and who it did not
  --   tried       what has already been tried, and what came of it
  --   refuse      what this person will not do
  --   voice       how they write, so a draft sounds like them
  section text not null
    check (section in ('deliver','price','works_for','tried','refuse','voice')),

  body text not null,
  source text not null default 'you' check (source in ('you','observed')),
  -- The rows behind an observed entry, as a countable phrase: "4 replies, 3 from
  -- resorts". Null for anything the user wrote, because their own statement
  -- needs no evidence — they are the evidence.
  evidence text,

  --   live       part of what the app believes, and in every prompt
  --   proposed   computed and waiting on the user. Never reaches a prompt.
  --   declined   the user said no. Kept so it is not proposed again next week.
  status text not null default 'live'
    check (status in ('live','proposed','declined')),

  -- What produced an observed entry, so the same reading updates its own row
  -- rather than stacking a new proposal every night.
  observed_key text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index if not exists copilot_working_profile_idx
  on copilot_working(profile_id, status, section);

-- One row per reading per profile. The nightly pass recomputes "3 of your 4
-- replies came from resorts" every time it runs; without this it writes that
-- sentence again every night and the sheet fills with the same proposal.
create unique index if not exists copilot_working_observed_key_idx
  on copilot_working(profile_id, observed_key) where observed_key is not null;
