-- 20260914_copilot_obligations.sql
-- Money with a name and a date on it.
--
-- scoreMove multiplies five factors, and one of them has never moved. `money` is
-- built to range 1.0 to 3.0 from stake.value against monthly burn, but only
-- three jobs can set a value at all: client_delivery and repeat_customer read
-- sale.amount from a legacy table this product does not use, and goal_gap sets
-- the gap. On a real account the money factor is 1.0 on essentially every Move,
-- which is a large part of why the day keeps collapsing to outreach — not
-- because outreach wins, but because nothing else brings a number to the
-- argument.
--
-- An unpaid $2,000 invoice against $350 a month of burn, due Thursday:
--
--   money    = 1 + clamp(2000/350, 0, 2) = 3.0   (capped)
--   urgency  = clamp(30/3, 0.5, 3)       = 3.0
--   score    = 1.0 x 3.0 x 3.0 x 1.0     = 9.0
--
-- against a same-day send queue at 3.0. The arbitration already does the right
-- thing. It has never had the input.
--
-- Typed by hand on purpose. No bank integration, no parsing, no OAuth: an
-- invoice is one row somebody enters once, and the rows are the whole point —
-- this is the part a general agent with a memory file cannot hold, because it
-- needs a table it never collected.
--
-- Additive and idempotent. Read paths degrade to an empty list.

create table if not exists copilot_obligations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,

  -- 'in' is money owed TO this person, 'out' is money they owe. Both rank, and
  -- they rank differently: chasing an inflow is an earn, covering an outflow is
  -- a decision about what to cut.
  direction text not null check (direction in ('in','out')),
  counterparty text not null,
  amount numeric not null check (amount > 0),
  currency text,
  due_on date not null,

  -- 'settled' is the terminal state and keeps the row: a paid invoice is what
  -- makes the next forecast credible, and deleting it would make the ledger
  -- describe only what went wrong.
  status text not null default 'open' check (status in ('open','settled','written_off')),
  note text,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists copilot_obligations_due_idx
  on copilot_obligations(profile_id, status, due_on);
