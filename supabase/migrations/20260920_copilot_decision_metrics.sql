-- 20260920_copilot_decision_metrics.sql
-- The Call has been silently failing to save on most mornings.
--
-- `20260909` created copilot_decisions with:
--
--   verify_metric text check (verify_metric in
--     ('sent','replies','meetings','won','won_amount','none'))
--
-- Six values: the outbound funnel, plus 'none'. That was right at the time —
-- the decision record could only talk about sending.
--
-- Then `20260911` shipped arbitration, and stake.ts widened the vocabulary a
-- call may stake itself on to eight, adding `queue` and `runway_months`. Those
-- two are the whole point of that change: they are the first metrics that are
-- not funnel metrics, and they are what let a runway decision or a send-queue
-- decision be graded at all. The migration added the `stake` and
-- `source_move_id` COLUMNS and never touched this constraint.
--
-- So since 20260911, every Call promoted from a Move staking one of the two new
-- metrics has failed to save:
--
--   send_queue      metric: 'queue'           -> 23514 check_violation
--   runway_guard    metric: 'runway_months'   -> 23514
--   obligations     metric: 'runway_months'   -> 23514
--
-- saveDecision catches, retries once without source_move_id (which is not the
-- problem), fails again, and console.errors. persistBrief carries on, so the
-- insight row saves. loadHome then finds no decision for today and Today renders
-- the insight instead of the Call — and because the insight DID save,
-- `needsBrief` is false, so opening the app never retries it either.
--
-- Net effect: on any morning arbitration picked the send queue or a runway
-- decision — which is most mornings — the product's headline feature was not on
-- the screen, and the only evidence was a line in the server log. Invariant 13,
-- one more time: a catch that neither surfaces the reason nor records it where
-- the screen can read it is the same as no error at all.
--
-- The fix is the constraint. The guard against the next one is in
-- scripts/sql/copilot-schema-check.sql, which now diffs this list against
-- BUSINESS_METRICS rather than only checking that columns exist.
--
-- Additive and idempotent: every check constraint on the column is dropped by
-- definition rather than by guessed name (see below — guessing is how a
-- migration reports success and changes nothing), widening a CHECK can never
-- reject an existing row, and the whole thing is guarded on the table existing
-- so it is safe on a database where 20260909 was never applied.

do $$
declare
  con record;
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'copilot_decisions') then

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
      where n.nspname = 'public' and t.relname = 'copilot_decisions'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ilike '%verify_metric%'
    loop
      execute format('alter table copilot_decisions drop constraint %I', con.conname);
    end loop;

    -- Must stay in step with BUSINESS_METRICS in src/lib/copilot/stake.ts.
    -- A metric nobody can read back out of Metrics is not a stake, it is a
    -- promise — that is the bar for adding one here and there.
    alter table copilot_decisions
      add constraint copilot_decisions_verify_metric_check
      check (verify_metric in (
        'sent', 'replies', 'meetings', 'won', 'won_amount',
        'queue', 'runway_months',
        'none'
      ));

  end if;
end $$;
