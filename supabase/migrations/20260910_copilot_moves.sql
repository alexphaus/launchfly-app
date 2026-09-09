-- 20260910_copilot_moves.sql
-- A Move is a finished piece of work with something concrete attached.
--
-- The app had exactly one action type: a WhatsApp opener. One domain, one
-- artifact, and after weeks its own author had sent zero of them — not from a
-- lack of discipline but because it was not the action he wanted to take. A
-- Move is the generalisation: earn, spend, build, fix, learn, meet, decide or
-- avoid, each produced by a Job that went and did the work overnight.
--
-- The load-bearing column is `artifact`. No artifact, no Move. A row that says
-- "you should contact them" is advice, which the user can already get for free
-- from a chat window; a row carrying the drafted message, the link, the file or
-- the booking is work that was actually done. The same rule that stops a lesson
-- rendering without a URL.
--
-- Additive and idempotent. Nothing existing reads this table, so an unapplied
-- migration costs the Moves section and nothing else.

create table if not exists copilot_moves (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,

  job text not null,                     -- which Job produced it: client_delivery, gig_scan, ...
  kind text not null check (kind in ('earn','spend','build','fix','learn','meet','decide','avoid')),
  -- Stable id in the job's own source (a sale id, a listing id). This is how a
  -- nightly run that sees the same sale again does not produce a second Move.
  external_id text not null,

  headline text not null,                -- one imperative line naming the move
  why jsonb not null default '[]'::jsonb, -- evidence, each line citing a real input
  artifact jsonb not null,               -- { kind, label, value, href } — the thing itself
  cost_label text,                       -- "20 min", "₱18,000" — what it costs to take

  status text not null default 'open' check (status in ('open','done','dismissed')),
  for_date date not null,
  created_at timestamptz not null default now(),
  acted_at timestamptz,

  unique (profile_id, job, external_id)
);

create index if not exists copilot_moves_profile_idx on copilot_moves(profile_id, status, created_at desc);
