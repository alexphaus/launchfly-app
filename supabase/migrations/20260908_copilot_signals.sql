-- Migration: Copilot — the send queue, and the columns Signals will need
-- Additive and idempotent. Run after 20260907_copilot_lesson_cleanup.sql.

-- ─── Why a draft was cancelled ──────────────────────────────────────────────
-- Drafts are now cancelled by the system as well as by hand: when the offer
-- changes materially, every opener written from the old offer is retired and
-- rewritten. The reason is kept so the funnel and support can tell "the user
-- skipped it" from "the app replaced it".
alter table copilot_executions add column if not exists cancel_reason text;

-- ─── Daily vs weekly insight ────────────────────────────────────────────────
-- copilot_insights held exactly one row per day and nothing else. The weekly
-- Signals read needs to live alongside the daily brief without being deleted by
-- it or mistaken for it. Every existing row is a daily brief.
alter table copilot_insights add column if not exists kind text not null default 'daily'
  check (kind in ('daily', 'weekly'));
create index if not exists copilot_insights_kind_idx on copilot_insights(profile_id, kind, for_date desc);

-- ─── Demand over time ───────────────────────────────────────────────────────
-- Signals buckets sourced matches by the week they were found. This is the read
-- it does on every load.
create index if not exists copilot_opportunities_found_idx
  on copilot_opportunities(profile_id, source_kind, created_at desc);
