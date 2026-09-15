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
declare
  con record;
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'copilot_commission_events') then

    -- Dropped by DEFINITION, not by guessed name.
    --
    -- An inline `column type check (...)` is auto-named <table>_<column>_check
    -- *usually*. A table created twice, or a constraint ever re-added by hand,
    -- gets <name>1 instead. `drop constraint if exists <guess>` then silently
    -- does nothing, the `add` below succeeds under the guessed name, and the
    -- table ends up carrying TWO check constraints — with the old narrow one
    -- still rejecting every write this migration exists to permit.
    --
    -- The migration would report success and the bug would survive it, with no
    -- visible symptom. That is the exact failure this file was written to end,
    -- reproduced inside the fix for it, so the fix does not guess.
    for con in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and t.relname = 'copilot_commission_events'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ilike '%kind%'
    loop
      execute format('alter table copilot_commission_events drop constraint %I', con.conname);
    end loop;

    alter table copilot_commission_events
      add constraint copilot_commission_events_kind_check
      check (kind in ('planned','worked','found','needs_you','blocked','done','failed','answered'));

  end if;
end $$;
