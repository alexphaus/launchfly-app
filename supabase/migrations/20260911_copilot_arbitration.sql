-- 20260911_copilot_arbitration.sql
-- The day's Call is picked, not written.
--
-- Two columns, both additive and both optional to the code that reads them.
--
-- `stake` is what a Move claims it will move and by when. It is how a runway
-- decision or a paid-and-undelivered client can out-rank the send queue: before
-- this, the brief wrote the Call and the jobs wrote Moves on separate paths that
-- never met, so "send the drafts" led every morning by construction rather than
-- by winning. See src/lib/copilot/stake.ts.
--
-- `source_move_id` is the Move a Call was promoted from. A Decision has no
-- artifact of its own, which is why its button used to say "open the queue"
-- rather than being the message; the link is what lets the Call carry finished
-- work. Null for a call the agent or the starter ladder wrote.
--
-- Every read and write of both falls back to the old column list on error, so an
-- unapplied migration costs ranking evidence and nothing else — no blank Today,
-- no lost call, no dropped Move.

alter table copilot_moves
  add column if not exists stake jsonb;

alter table copilot_decisions
  add column if not exists source_move_id uuid references copilot_moves(id) on delete set null;

create index if not exists copilot_decisions_move_idx
  on copilot_decisions(source_move_id) where source_move_id is not null;
