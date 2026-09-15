-- 20260919_copilot_commission_answers.sql
-- Somewhere for the user's answer to go.
--
-- The commission layer shipped complete except for one wire, and the missing
-- wire made the whole loop impossible rather than merely worse.
--
-- A worker raises a needs_you — "which of the three should I brief?" — and the
-- mandate blocks, which is correct: a worker must not clear its own gate. The
-- user then had exactly one affordance, a button reading "I have answered —
-- carry on", and unblockCommission wrote a status and nothing else. The next
-- dispatch sent commissionBrief: objective, why, may, budget, plan, who, goal.
-- No history. No answer. A byte-identical brief.
--
-- So the worker asked the identical question, and the next night asked it again.
-- No commission that needed anything from its owner could ever finish, which is
-- the whole of "the loop has never completed unassisted end to end". Not a hard
-- problem — a field that did not exist.
--
-- An answer is a line in the thread, not a column on the commission: the user
-- reads it under the question it answers, briefLog carries it out with the next
-- brief, and a mandate that is answered twice keeps both. So it is an event
-- kind, and the only thing this migration does is permit it.
--
-- 'answered' is deliberately absent from WORKER_EVENT_KINDS in
-- lib/copilot/commission.ts, which is what normalizeResult validates the result
-- socket against. A worker that could post 'answered' could answer its own
-- question on the user's behalf and clear its own gate — invariant 10 with one
-- extra step, and the same reason the `status` a worker claims is parsed and
-- discarded. The database permits the kind; the parser is what refuses it from
-- a worker.
--
-- Additive and idempotent, and safe on a database where 20260916 never ran: the
-- whole thing is guarded on the table existing. Until it is applied,
-- unblockCommission refuses to move a mandate it cannot record the answer for,
-- rather than clearing the gate and dropping what the user typed.

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'copilot_commission_events') then

    alter table copilot_commission_events
      drop constraint if exists copilot_commission_events_kind_check;

    alter table copilot_commission_events
      add constraint copilot_commission_events_kind_check
      check (kind in ('planned','worked','found','needs_you','blocked','done','failed','answered'));

  end if;
end $$;
