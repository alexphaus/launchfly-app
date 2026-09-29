-- 20260929_copilot_money.sql
-- Money read from the bank, not typed.
--
-- Everything the app knew about somebody's money was typed: cash and burn on
-- one sheet, each win one at a time, each invoice one at a time. So runway was
-- whatever was typed last month, and scoreMove's money factor was 1.0 on nearly
-- every Move — the day collapsed to outreach because nothing else brought a
-- number to the argument (see 20260914). A statement is the person's own
-- record, written by their bank, and it arrives with its history: a year of
-- rows on day one instead of a year of collecting.
--
-- Four tables:
--
--   copilot_money_accounts   where rows come from. 'upload' today; a bank link
--                            later is a provider row here and nothing else new
--   copilot_money_imports    one statement read: how, whether it added up, what
--                            it brought in. A reading that could not prove
--                            itself waits in `pending` for the person's yes
--   copilot_transactions     the rows, signed, deduplicated by fingerprint so
--                            overlapping statements never count a row twice
--   copilot_counterparties   who each payer or payee is to this person — a
--                            client, their job, their own account — in their
--                            words, one tap each, never inferred
--
-- The file itself is never stored: it is read in memory and dropped, and only
-- the rows are kept (money/extract.ts, the import route).
--
-- Additive and idempotent. The unique constraints are plain, never partial:
-- PostgREST's on_conflict emits no predicate, so a partial unique index cannot
-- be inferred and every upsert against it fails 42P10 (20260918, CLAUDE.md).
-- Until this is applied the money read degrades to "not set up yet" on the
-- Bank statements sheet, and every other screen behaves exactly as before.

create table if not exists copilot_money_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  -- Who supplies its rows: 'upload' for statements the person uploads; a bank
  -- link names its aggregator ('gocardless', 'plaid', 'belvo') when one exists.
  provider text not null default 'upload',
  -- The account within that provider: a link's own account id, or for an
  -- upload the bank and last digits read off the file (statement.ts accountKey).
  external_key text not null,
  label text,
  institution text,
  mask text,
  currency text,
  -- The last balance a statement printed for it, and the day it was true.
  balance numeric,
  balance_on date,
  -- A link's own health; uploads are always active. last_error is said on the
  -- sheet, never swallowed — an expired bank link looks exactly like a quiet month.
  status text not null default 'active' check (status in ('active','expired','error','revoked')),
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  constraint copilot_money_accounts_key unique (profile_id, provider, external_key)
);

create table if not exists copilot_money_imports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  account_id uuid references copilot_money_accounts(id) on delete set null,
  source text not null default 'upload' check (source in ('upload','link')),
  file_name text,
  format text not null check (format in ('csv','ofx','pdf','image','link')),
  -- 'parsed' is deterministic (the bank's own export); 'read' is a model's
  -- reading of a PDF or a screenshot, which has to prove itself.
  method text not null check (method in ('parsed','read','link')),
  status text not null default 'reading' check (status in ('reading','review','ready','failed')),
  balance_check text check (balance_check in ('balanced','unbalanced','no_balances')),
  check_detail text,
  currency text,
  period_start date,
  period_end date,
  opening_balance numeric,
  closing_balance numeric,
  rows_found int,
  rows_new int,
  rows_dropped int,
  total_in numeric,
  total_out numeric,
  -- The checked rows of a reading that is waiting on the person's yes. Emptied
  -- when they confirm (the rows move to copilot_transactions) or discard.
  pending jsonb,
  -- Why it failed.
  error text,
  -- Something that went wrong after the rows were in — a deposit that could not
  -- be recorded as a win — said beside the statement rather than lost in a log.
  note text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  confirmed_at timestamptz
);

create index if not exists copilot_money_imports_profile_idx on copilot_money_imports(profile_id, started_at desc);

create table if not exists copilot_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  account_id uuid references copilot_money_accounts(id) on delete cascade,
  -- Discarding a statement takes the rows it brought in with it.
  import_id uuid references copilot_money_imports(id) on delete cascade,
  -- Account, day, amount, counterparty and occurrence, hashed: the same row
  -- uploaded twice is one row (statement.ts rowFingerprints).
  fingerprint text not null,
  posted_on date not null,
  -- Signed: money in positive, money out negative.
  amount numeric not null,
  currency text,
  description text not null,
  counterparty_key text not null,
  balance_after numeric,
  -- The win this deposit was recorded as, once its payer was named a client.
  outcome_id uuid references copilot_outcomes(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint copilot_transactions_fingerprint unique (profile_id, fingerprint)
);

create index if not exists copilot_transactions_profile_on_idx on copilot_transactions(profile_id, posted_on desc);
create index if not exists copilot_transactions_key_idx on copilot_transactions(profile_id, counterparty_key);

create table if not exists copilot_counterparties (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references copilot_profiles(id) on delete cascade,
  key text not null,
  name text not null,
  -- What they are to this person, in their own answer. Null until asked.
  role text check (role in ('client','employer','self','other')),
  -- The business in the pipeline they are, when the person linked one.
  opportunity_id uuid references copilot_opportunities(id) on delete set null,
  named_at timestamptz,
  created_at timestamptz not null default now(),
  constraint copilot_counterparties_key unique (profile_id, key)
);
