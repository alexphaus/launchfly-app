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
-- Additive and idempotent: dropping and re-adding the same named constraint is
-- safe to run twice, widening a CHECK can never reject an existing row, and the
-- whole thing is guarded on the table existing so it is safe on a database
-- where 20260909 was never applied.

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'copilot_decisions') then

    alter table copilot_decisions
      drop constraint if exists copilot_decisions_verify_metric_check;

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
