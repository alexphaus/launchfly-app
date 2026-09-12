-- 20260913_copilot_capture.sql
-- What the app actually saw, as opposed to what it was told.
--
-- The deep link was an <a href target="_blank"> with no handler. Tapping "Open
-- in WhatsApp" recorded nothing at all, so the app's entire knowledge of whether
-- a message went out came from the user leaving to WhatsApp, sending, finding
-- the browser tab again, and pressing "I sent it" — a button sitting at equal
-- weight beside "Skip for now" and "Not for me".
--
-- Miss that fourth step and the ledger says nothing happened. The live account
-- reads 9 sent in 30 days, 51 drafts waiting, 2 replies and 6 meetings. Nine
-- sends do not produce six meetings. The count is wrong, and `sent` is upstream
-- of metrics.reply_rate, verdictOf, the whole starterDecision ladder, the
-- funnel, openingTrend and the silence job — so the one number every decision
-- rests on is the least trustworthy field in the database.
--
-- `opened_at` is what the app can honestly observe: a tap. It is NOT a send, and
-- nothing here treats it as one — invariant 2 is why. It makes the gap between
-- "opened" and "confirmed" visible so it can be closed with one question instead
-- of N round trips.
--
-- `sent_at` is also fixed by this. It is stamped at CONFIRMATION time, so a
-- draft opened Monday and confirmed Thursday records Thursday, which quietly
-- moves oldestWaitDays, the silence job's three-day window and decision
-- verification timing. With opened_at on file the confirmation can backdate.
--
-- Additive and idempotent. Every read path treats a missing column as null.

alter table copilot_executions
  add column if not exists opened_at timestamptz;

-- Partial: the only query that uses it asks for opened-and-not-yet-sent, which
-- is a handful of rows against a table that grows forever.
create index if not exists copilot_executions_opened_idx
  on copilot_executions(profile_id, opened_at)
  where opened_at is not null and approval_state <> 'sent';
