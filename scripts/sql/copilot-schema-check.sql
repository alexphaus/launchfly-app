-- What is actually missing in this database?
--
-- Migrations here are applied by hand, so "works locally, not in production"
-- almost always means one file was never pasted into the SQL editor. Guessing
-- which one costs more time than asking. Paste this into the Supabase SQL
-- editor; every row it returns is a column or table that the code expects and
-- the database does not have, with the file that adds it.
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
  ('table',  'copilot_decisions',      null,                        '20260909_copilot_decisions.sql')
)
select e.migration, e.kind, e.table_name, e.column_name
from expected e
where (e.kind = 'column' and not exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = e.table_name and c.column_name = e.column_name))
   or (e.kind = 'table' and not exists (
        select 1 from information_schema.tables t
        where t.table_schema = 'public' and t.table_name = e.table_name))
order by e.migration, e.table_name, e.column_name;
