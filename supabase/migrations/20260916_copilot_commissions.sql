-- 20260916_copilot_commissions.sql
-- Work the app owns, as opposed to work it suggests.
--
-- Every row this product has ever written is one of two things: something for
-- the user to decide (a Move) or something waiting on them to send (an
-- execution). There has never been a third — work in progress that the app is
-- carrying. That absence is why "run the agent" changes nothing visible: it
-- regenerates prose and produces more decisions, and decisions are the thing
-- there are already too many of at nine in the morning.
--
-- A commission is a mandate. It has an objective tied to a goal, an authority
-- saying what it may do in the world, a plan whose steps have state, and a log
-- of what actually happened. The user approves the COMMISSION AND ITS AUTHORITY
-- once — not each step. Approving every action is a form; approving a mandate
-- and reading what came of it is the difference being aimed at here.
--
-- The app is the principal, not the worker. It decides what is worth doing and
-- why, authorises it, takes delivery and records the outcome; something else
-- with better tools does the doing and posts back. So there is no queue, no
-- retry state and no step runner in this schema: those belong to whatever holds
-- the tools, and they change every six months.
--
-- Additive and idempotent. Nothing existing reads these tables, so an unapplied
-- migration costs the commission layer and nothing else — every read path
-- degrades to an empty list, which renders as "nothing commissioned yet" and is
-- the same screen a new account sees.

create table if not exists copilot_commissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,

  -- Which goal this moves. Nullable because a commission can precede the goal
  -- it serves, but the thread view is much weaker without it: "why does this
  -- get me closer" is the question the app has never been able to answer.
  goal_id uuid references copilot_goals(id) on delete set null,

  objective text not null,
  -- Why this objective moves that goal, in one line. Written when the
  -- commission is created and shown every time it is opened, because a mandate
  -- nobody can remember the reason for is one nobody will stop when it stops
  -- making sense.
  why text,

  -- What it may do in the world. Deliberately named for the act rather than
  -- numbered, because the user reads this before granting it.
  --
  --   read    research, compare, draft, document. Touches nothing outside.
  --   reach   contact someone under an identity the user owns.
  --   commit  money leaves, a signature, a hire, a price agreed.
  --
  -- Only 'read' executes autonomously today. 'reach' needs a verified sending
  -- identity first (see the multi-user rule in docs/COPILOT.md: server
  -- credentials are the operator's and are never used on a user's behalf), and
  -- 'commit' is never autonomous at any point in this product's future — it is
  -- prepared to one tap and stopped. See AUTHORITY in lib/copilot/commission.ts.
  authority text not null default 'read'
    check (authority in ('read','reach','commit')),

  -- Worker minutes this mandate is worth. A bound on the thing being rented,
  -- so a commission cannot quietly become an open tab.
  budget_minutes int not null default 60,

  --   draft    written, not yet approved. Does nothing.
  --   active   approved; the worker may advance it.
  --   blocked  it needs the user before it can go on.
  --   done     objective met.
  --   stopped  the user called it off.
  status text not null default 'draft'
    check (status in ('draft','active','blocked','done','stopped')),

  -- CommissionStep[]: { n, do, state, note }. Held as one document rather than
  -- a table because a plan is read and rewritten whole, never queried across
  -- commissions, and a five-row join for something only ever shown on one card
  -- buys nothing.
  plan jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  -- When authority was granted, and by implication that it WAS granted. A null
  -- here with status 'active' is not a state this app can produce.
  approved_at timestamptz,
  last_run_at timestamptz,
  closed_at timestamptz,
  -- What came of it, written at close. The decision record grades calls; this
  -- grades mandates, and an honest "nothing" is a real entry.
  outcome text,

  -- The thread view needs "since you last looked" and the only honest source
  -- for that is when the user last opened this commission.
  seen_at timestamptz
);

create index if not exists copilot_commissions_profile_idx
  on copilot_commissions(profile_id, status, created_at desc);

-- The work log. One row per thing that happened, which is what the user
-- actually wants to read when they open the app while walking: not a new card
-- asking something, but what got done since last time.
create table if not exists copilot_commission_events (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references copilot_commissions(id) on delete cascade,
  profile_id uuid not null references copilot_profiles(id) on delete cascade,

  --   planned    the plan was written or revised
  --   worked     a step advanced
  --   found      something was learned, with the artifact attached
  --   needs_you  it cannot go on without the user — the approve path
  --   blocked    it cannot go on at all, and says why
  --   done       objective met
  --   failed     the worker gave up, with the reason
  kind text not null
    check (kind in ('planned','worked','found','needs_you','blocked','done','failed')),
  -- Which step this was about, when it was about one.
  step int,
  summary text not null,
  -- Same shape as a Move's artifact: { kind, label, value, href }. A log line
  -- with nothing attached is a claim; one carrying the document, the quote or
  -- the link is evidence, and evidence is the entire standard the rest of this
  -- product is held to.
  artifact jsonb,
  at timestamptz not null default now()
);

create index if not exists copilot_commission_events_idx
  on copilot_commission_events(commission_id, at desc);
create index if not exists copilot_commission_events_profile_idx
  on copilot_commission_events(profile_id, at desc);
