-- 20260921_copilot_outcome_worth.sql
-- The ledger can only grade outreach, so most of what the app does is ungraded.
--
-- copilot_outcomes has carried three attributions since 20260904:
--
--   opportunity_id   a business
--   action_id        a plan item
--   execution_id     a message that went out
--
-- All three are the outbound funnel, and so is the vocabulary:
-- reply / meeting / proposal / won / lost / no_reply. That was the whole product
-- once. It is not now. Two things happen that the ledger cannot see at all:
--
--   a Move        eight jobs produce finished work that is not a message
--   a commission  work the app was authorised to have done, closed with free
--                 text in copilot_commissions.outcome that nothing ever reads
--
-- So a mandate could run for a week, cost worker minutes, get closed, and leave
-- no row anywhere that any ranking, any metric or any verdict could read. The
-- app knew that handing work over had happened and never once knew whether it
-- had been worth anything — which is also why "has this paid for itself" was
-- unanswerable, and why scoreMove weights commission work by a kind prior, i.e.
-- by a guess about a category, forever.
--
-- Three changes, all additive.
--
--   move_id        attributes an outcome to the Move it came out of, and
--                  through copilot_moves.job to the job key the ranker reads
--   commission_id  attributes one to a mandate
--   kind           widens by three: delivered, saved, nothing
--
-- On `nothing`. It is the point of this migration, not a leftover. A close-out
-- question with no honest zero in it is a question that collects agreement:
-- every answer would be some flavour of value, the rollup would read as
-- uniformly positive, and the ranker would learn nothing it did not already
-- assume. "I did this and it was worth nothing to me" is the single most
-- expensive sentence a user can say about a feature, and until there is a row
-- for it the product cannot hear it.
--
-- On `source`. Untouched, and it stays ('manual','system','webhook'). A worth
-- answer is always 'manual' because it is always the user's — invariant 10, a
-- worker cannot mark its own homework, applies with more force here than
-- anywhere else in the codebase: a worker allowed to file its own work as
-- valuable would be grading the one number that decides whether it keeps
-- getting work.
--
-- Idempotent and safe out of order: `add column if not exists`, and widening a
-- CHECK cannot reject a row that already exists. The whole block is guarded on
-- the table being there, so it is a no-op on a database that never ran 20260904.
-- Read paths degrade: loadWorthLedger returns an empty record on any error, and
-- an empty worth record means scoreMove has no opinion — which is exactly its
-- behaviour before this migration.

do $$
declare
  con record;
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'copilot_outcomes') then

    -- Guarded individually: copilot_moves and copilot_commissions ship in
    -- 20260910 and 20260916, both hand-applied, and a database missing either
    -- would otherwise fail the whole migration on the foreign key. The column
    -- is worth having even without its reference — an unattributable outcome is
    -- still a graded one — so the reference is added only when it can be.
    alter table copilot_outcomes add column if not exists move_id uuid;
    alter table copilot_outcomes add column if not exists commission_id uuid;

    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = 'copilot_moves')
       and not exists (select 1 from pg_constraint
                       where conname = 'copilot_outcomes_move_id_fkey') then
      alter table copilot_outcomes
        add constraint copilot_outcomes_move_id_fkey
        foreign key (move_id) references copilot_moves(id) on delete set null;
    end if;

    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = 'copilot_commissions')
       and not exists (select 1 from pg_constraint
                       where conname = 'copilot_outcomes_commission_id_fkey') then
      alter table copilot_outcomes
        add constraint copilot_outcomes_commission_id_fkey
        foreign key (commission_id) references copilot_commissions(id) on delete set null;
    end if;

    -- Dropped by DEFINITION, not by guessed name. 20260919 and 20260920 both
    -- shipped a guessed `drop constraint if exists <table>_<column>_check`,
    -- which is the auto-generated name only usually: a table created twice, or
    -- a constraint ever re-added by hand, gets <name>1. The drop then does
    -- nothing, the add below succeeds under the guessed name, and the table
    -- carries TWO checks with the old narrow one still rejecting every write
    -- this migration exists to permit — a migration that reports success and
    -- changes nothing, with no visible symptom. Proved on Postgres 16 before
    -- this was written.
    for con in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and t.relname = 'copilot_outcomes'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ilike '%kind%'
    loop
      execute format('alter table copilot_outcomes drop constraint %I', con.conname);
    end loop;

    -- Must stay in step with OutcomeKind in src/lib/copilot/types.ts. A test in
    -- copilot-core.test.ts reads this file and fails if the two drift, because
    -- that drift is exactly what made the Call invisible for a fortnight: the
    -- TS union widened, the CHECK did not, every write 23514'd into a
    -- console.error and the screen reported calm.
    alter table copilot_outcomes
      add constraint copilot_outcomes_kind_check
      check (kind in (
        'reply', 'meeting', 'proposal', 'won', 'lost', 'no_reply',
        'delivered', 'saved', 'nothing'
      ));

    create index if not exists copilot_outcomes_move_idx
      on copilot_outcomes(profile_id, move_id) where move_id is not null;
    create index if not exists copilot_outcomes_commission_idx
      on copilot_outcomes(profile_id, commission_id) where commission_id is not null;

  end if;
end $$;
