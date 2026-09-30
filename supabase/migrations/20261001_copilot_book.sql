-- 20261001_copilot_book.sql
-- The money book: cash logged in the app, one tap at a time.
--
-- Its owner spends mostly cash and kept a budgeting app for it, then exported
-- a CSV to feed this one. The export is manual, so the money read was always a
-- month behind; and the only part of that app used day to day was one screen —
-- log a move, see the list under the balance, glance at the calendar. That
-- screen is now a tab here, writing straight into copilot_transactions, so
-- runway, money in and the plan move the moment something is logged.
--
-- Three columns on the rows that already exist, nothing new beside them:
--   category  what it was for — "Groceries", "Help" — kept apart from the note,
--             which is what the book and the category picker show. Filled by
--             the book and by budget-app exports (backfilled on re-import).
--   note      what the person typed about it, for a logged row only
--   repeat    'weekly' or 'monthly@<day>' on a logged row that repeats; the
--             next one is written ahead of its day, as a pending row
--
-- A logged row has import_id null and a fingerprint of 'book:<id>', or
-- 'repeat:<series>:<day>' for one a repeat wrote — which is also what makes a
-- repeat idempotent: writing the same next row twice is one row.
--
-- The balance the book starts from lives in copilot_profiles.finance (book),
-- beside runway, which reads it.
--
-- Additive and idempotent. Until this is applied the Money tab says so, and
-- every other screen — statements, runway, money in — behaves exactly as before.

alter table copilot_transactions add column if not exists category text;
alter table copilot_transactions add column if not exists note text;
alter table copilot_transactions add column if not exists repeat text;

create index if not exists copilot_transactions_repeat_idx on copilot_transactions(profile_id) where repeat is not null;
