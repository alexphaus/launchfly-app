-- 20260915_copilot_source_discovery.sql
-- Where a source came from, so the app can tell whether its own suggestions work.
--
-- Until now every row in copilot_sources was a URL somebody typed. That is the
-- hardest part of the whole watcher and it was the part left to the user: to add
-- a source you first have to know that r/forhire exists, which is most of what
-- you would be hiring this app to find out. The blank watchlist was the first
-- screen a new account saw and there was nothing on it.
--
-- Discovery fills it, but a suggestion the app made is not the same kind of row
-- as one the user chose, and the difference has to be readable later. If the
-- feeds Exa proposes get binned at twice the rate of the ones people paste, that
-- is the app being wrong about somebody's world and it should show up as a
-- number rather than as a vague sense that the watchlist is noisy.
--
-- No yield columns here on purpose. Moves already carry `${source_id}:${item_id}`
-- as their external_id, so how many a source produced and how many survived is
-- derivable from rows that already exist — see watch/yield.ts. A stored counter
-- would be a second copy of a fact, and the second copy is the one that drifts.
--
-- Additive and idempotent. A source with no discovered_by reads as 'user', which
-- is what every existing row is.

alter table copilot_sources
  add column if not exists discovered_by text
    check (discovered_by is null or discovered_by in ('user','catalogue','exa'));

comment on column copilot_sources.discovered_by is
  'Null or ''user'' = pasted. ''catalogue'' = a seeded starter. ''exa'' = found by discovery and verified before it was offered.';
