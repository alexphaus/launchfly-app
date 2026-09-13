-- 20260918_copilot_working_index.sql
-- The index 20260917 created could not be used by the write that needs it.
--
-- That migration ended with:
--
--   create unique index ... on copilot_working(profile_id, observed_key)
--     where observed_key is not null;
--
-- and proposeObserved upserts with onConflict 'profile_id,observed_key'.
-- PostgREST turns that into `ON CONFLICT (profile_id, observed_key)` with no
-- index predicate, and Postgres will only infer a PARTIAL unique index when the
-- statement supplies a matching one. So every nightly write failed 42P10,
-- proposeObserved caught it, logged and returned 0, and not one observed reading
-- was ever written. The whole "It noticed" half of the working file was dead on
-- arrival with no user-visible symptom at all — the sheet just looked like an
-- account the app had not noticed anything about yet.
--
-- The WHERE was there to let many user-written rows carry a null observed_key.
-- It was not needed: Postgres treats NULLs as distinct in a unique index, so a
-- plain unique index already permits any number of null-keyed rows while still
-- collapsing two readings that share a key. The predicate bought nothing and
-- cost the feature.
--
-- Idempotent, and safe to run on a database where 20260917 never ran: the
-- create is `if not exists` against the same name the drop just removed.

drop index if exists copilot_working_observed_key_idx;

create unique index if not exists copilot_working_observed_key_idx
  on copilot_working(profile_id, observed_key);
