-- Migration: Copilot — the decision, and whether it was right
--
-- Until now the agent could emit an insight, a plan, nudges and opportunities.
-- None of those is a decision: there was no field for the one move, no field for
-- what you are choosing NOT to do, and no way to ask later whether the
-- recommendation worked. The read said "here are five things"; a decision says
-- "do this one, not that one, and here is the number that should move".
--
-- This table is the record of those calls. It is the one asset a frontier model
-- cannot reconstruct: what this app told THIS person to do, whether they did it,
-- and what happened to the metric it named.
--
-- Additive and idempotent. Run after 20260908_copilot_signals.sql.

create table if not exists copilot_decisions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  for_date date not null,
  agent_run_id uuid references copilot_agent_runs(id) on delete set null,

  -- ─── The call ─────────────────────────────────────────────────────────────
  headline text not null,                        -- the one move, in the imperative
  because jsonb not null default '[]'::jsonb,    -- evidence lines, each citing a real number
  instead_of text,                               -- the explicit trade-off
  -- 'low' is a first-class answer: two options were close, or the evidence was
  -- thin. `missing` then names what would settle it. A system that is never
  -- unsure is not being honest about a 12-message sample.
  confidence text not null default 'high' check (confidence in ('high', 'low')),
  missing text,
  -- A short slug ('lead volume', 'follow-up', 'pricing'). This is what makes the
  -- weekly reflection possible: "4 of your last 9 calls were about lead volume
  -- and none of them moved a reply."
  topic text,
  dont_title text,
  dont_why text,
  -- What moved since the previous brief, computed server-side, not by the model.
  changed jsonb not null default '[]'::jsonb,
  -- The full set of watched numbers as they stood when the call was made.
  -- The next brief diffs against this; without it "what changed" would have
  -- to be re-derived from event history on every run.
  snapshot jsonb not null default '{}'::jsonb,

  -- ─── What the user did about it ───────────────────────────────────────────
  -- 'ignored' is never asked for: a decision still pending when the next brief
  -- runs was ignored, and pretending otherwise would flatter the record.
  response text not null default 'pending' check (response in ('pending', 'did', 'rejected', 'ignored', 'wrong')),
  responded_at timestamptz,

  -- ─── Whether it was right ─────────────────────────────────────────────────
  -- The decision names the ONE metric that should move if it was correct. The
  -- baseline is snapshotted when the call is made; the after-value is read a few
  -- days later. Grading is against the ledger, not against the model's opinion
  -- of itself. Metrics run on a rolling window, so a value can fall as well as
  -- rise — the delta is the signal, not the absolute.
  verify_metric text check (verify_metric in ('sent', 'replies', 'meetings', 'won', 'won_amount', 'none')),
  verify_baseline numeric,
  verify_after numeric,
  verified_at timestamptz,

  created_at timestamptz not null default now()
);

-- One call per day. A re-run of the brief replaces it rather than stacking.
create unique index if not exists copilot_decisions_day_idx on copilot_decisions(profile_id, for_date);
create index if not exists copilot_decisions_recent_idx on copilot_decisions(profile_id, for_date desc);
-- The sweep looks for exactly two things: still pending, and due for verification.
create index if not exists copilot_decisions_open_idx on copilot_decisions(profile_id, response, verified_at);

alter table copilot_decisions enable row level security;
