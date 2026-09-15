-- What is actually missing in this database?
--
-- Migrations here are applied by hand, so "works locally, not in production"
-- almost always means one file was never pasted into the SQL editor. Guessing
-- which one costs more time than asking. Paste this into the Supabase SQL
-- editor; every row it returns is something the code expects and the database
-- does not have — a table, a column, or one of the two shapes below that are
-- neither — with the file that adds it.
--
-- Keep this file level with supabase/migrations. It stopped at 20260909 for ten
-- releases, which meant it returned no rows for the entire commission layer and
-- the entire working file: exactly the two features whose read paths degrade to
-- an empty list on purpose, and therefore the two where an unapplied migration
-- is indistinguishable from a quiet account. A checker that is silently behind
-- is worse than no checker, because it answers.
--
-- No rows returned = the schema is complete and any PGRST204 you are seeing is
-- a stale PostgREST cache. Fix that with:  notify pgrst, 'reload schema';

with expected(kind, table_name, column_name, migration) as (values
  ('column', 'copilot_profiles',      'target_segments',            '20260904_copilot_close_the_loop.sql'),
  ('column', 'copilot_profiles',      'target_area',                '20260904_copilot_close_the_loop.sql'),
  ('column', 'copilot_profiles',      'linked_business_id',         '20260904_copilot_close_the_loop.sql'),
  ('column', 'copilot_profiles',      'finance',                    '20260904_copilot_close_the_loop.sql'),
  ('column', 'copilot_profiles',      'pending_login_email',        '20260904_copilot_close_the_loop.sql'),
  ('column', 'copilot_profiles',      'email_verified_at',          '20260904_copilot_close_the_loop.sql'),
  ('column', 'copilot_profiles',      'offer',                      '20260905_copilot_multi_user.sql'),
  ('column', 'copilot_profiles',      'send_mode',                  '20260905_copilot_multi_user.sql'),
  ('column', 'copilot_profiles',      'email_from',                 '20260905_copilot_multi_user.sql'),
  ('column', 'copilot_profiles',      'plan',                       '20260906_copilot_billing.sql'),
  ('column', 'copilot_profiles',      'plan_status',                '20260906_copilot_billing.sql'),
  ('column', 'copilot_profiles',      'stripe_customer_id',         '20260906_copilot_billing.sql'),
  ('column', 'copilot_profiles',      'stripe_subscription_id',     '20260906_copilot_billing.sql'),
  ('column', 'copilot_profiles',      'plan_renews_at',             '20260906_copilot_billing.sql'),
  ('column', 'copilot_profiles',      'plan_cancels_at_period_end', '20260906_copilot_billing.sql'),
  ('column', 'copilot_executions',    'cancel_reason',              '20260908_copilot_signals.sql'),
  ('column', 'copilot_insights',      'kind',                       '20260908_copilot_signals.sql'),
  ('table',  'copilot_usage',          null,                        '20260906_copilot_billing.sql'),
  ('table',  'copilot_billing_events', null,                        '20260906_copilot_billing.sql'),
  ('table',  'copilot_decisions',      null,                        '20260909_copilot_decisions.sql'),

  -- Everything below was missing from this file, and the newest three tables
  -- are the ones it mattered most for. loadMoves, loadCommissions and
  -- loadWorking all degrade to an empty list on error — deliberately, so an
  -- unapplied migration cannot blank a screen. The cost is that "the migration
  -- was never run" and "a quiet account" render identically, and this file is
  -- the only thing that can tell them apart. It stopped at 20260909 while ten
  -- migrations shipped past it, so for the whole commission layer and the whole
  -- working file it could only ever return no rows.
  ('table',  'copilot_moves',          null,                        '20260910_copilot_moves.sql'),
  ('column', 'copilot_moves',          'stake',                     '20260911_copilot_arbitration.sql'),
  ('column', 'copilot_decisions',      'source_move_id',            '20260911_copilot_arbitration.sql'),
  ('table',  'copilot_sources',        null,                        '20260912_copilot_watch.sql'),
  ('column', 'copilot_executions',     'opened_at',                 '20260913_copilot_capture.sql'),
  ('table',  'copilot_obligations',    null,                        '20260914_copilot_obligations.sql'),
  ('column', 'copilot_sources',        'discovered_by',             '20260915_copilot_source_discovery.sql'),
  ('table',  'copilot_commissions',       null,                     '20260916_copilot_commissions.sql'),
  ('table',  'copilot_commission_events', null,                     '20260916_copilot_commissions.sql'),
  ('table',  'copilot_working',        null,                        '20260917_copilot_working.sql'),
  ('column', 'copilot_working',        'observed_key',              '20260917_copilot_working.sql')
),

missing as (
  select e.migration, e.kind, e.table_name, e.column_name
  from expected e
  where (e.kind = 'column' and not exists (
          select 1 from information_schema.columns c
          where c.table_schema = 'public' and c.table_name = e.table_name and c.column_name = e.column_name))
     or (e.kind = 'table' and not exists (
          select 1 from information_schema.tables t
          where t.table_schema = 'public' and t.table_name = e.table_name))
),

-- Two migrations do not add a table or a column, and a table-and-column check
-- is blind to both. Each is a live example of the thing worth catching: the
-- object exists, so everything above says the schema is complete, and the
-- feature behind it is dead anyway.
--
--   20260918  dropped a WHERE predicate from a unique index. While it was
--             partial, PostgREST's on_conflict could not infer it and every
--             nightly proposeObserved failed 42P10 — caught, logged, zero
--             written. The whole "It noticed" half of the working file was
--             dead on arrival with no user-visible symptom at all.
--   20260919  widened a check constraint to permit 'answered'. Without it the
--             user's reply to a worker's question cannot be recorded, so
--             unblockCommission refuses rather than clearing the gate and
--             dropping what they typed.
wrong as (
  select '20260918_copilot_working_index.sql' as migration,
         'index' as kind,
         'copilot_working_observed_key_idx' as table_name,
         'still partial: every observed reading fails 42P10' as column_name
  where exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'copilot_working_observed_key_idx'
      and indexdef ilike '%where%')

  union all

  select '20260919_copilot_commission_answers.sql',
         'constraint',
         'copilot_commission_events_kind_check',
         'does not permit ''answered'': a reply cannot be recorded'
  where exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'copilot_commission_events')
    and not exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and t.relname = 'copilot_commission_events'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) like '%answered%')

  union all

  -- The drift that cost the Call for weeks, and the reason this file now checks
  -- constraint CONTENTS and not just that columns exist.
  --
  -- 20260909 pinned verify_metric to the outbound funnel. 20260911 widened
  -- BUSINESS_METRICS to eight and added its columns without touching this. Every
  -- Call promoted from send_queue ('queue'), runway_guard or obligations
  -- ('runway_months') then failed 23514 on save, was swallowed into a
  -- console.error, and Today rendered the insight instead of the call — with the
  -- insight row saved, so needsBrief was false and nothing ever retried.
  --
  -- One row per value rather than one for the constraint, so adding a ninth
  -- metric to stake.ts and forgetting the migration lands here too.
  select '20260920_copilot_decision_metrics.sql',
         'constraint',
         'copilot_decisions_verify_metric_check',
         'does not permit ''' || m.metric || ''': every Call staking it fails 23514 and Today shows no call'
  from (values ('queue'), ('runway_months')) as m(metric)
  where exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'copilot_decisions')
    and not exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and t.relname = 'copilot_decisions'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) like '%' || m.metric || '%')
)

select * from missing
union all
select * from wrong
order by migration, table_name, column_name;
