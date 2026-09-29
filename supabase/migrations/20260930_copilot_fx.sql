-- 20260930_copilot_fx.sql
-- Exchange rates, so every figure can be counted in one main currency.
--
-- A person who sells in dollars, keeps a peso budget app and a euro Wise
-- account had three piles the app would not add up: it showed whichever had
-- the most rows and said the others "are not in these numbers". Now each row is
-- converted into the main currency at the European Central Bank's reference
-- rate for its own day (lib/copilot/money/fx.ts), fetched once and kept here —
-- a year of peso rows is one request, not one per screen load.
--
-- Shared by every account: a rate is a fact about a day, not about a person.
-- One row per pair per business day; the ECB publishes none on weekends, and
-- the lookup takes the last business day before (RATE_STALE_DAYS).
--
-- Additive and idempotent, with a plain primary key (the upsert's on_conflict
-- cannot infer a partial index — 20260918, CLAUDE.md). Until this is applied,
-- rates are kept in the server's memory instead: conversion still works, and
-- each restart fetches them again. /api/copilot/health names this file.

create table if not exists copilot_fx_rates (
  -- One unit of `base` bought `rate` units of `quote` on `day`.
  base text not null,
  quote text not null,
  day date not null,
  rate numeric not null check (rate > 0),
  -- Who published it. 'ecb' via frankfurter.dev unless COPILOT_FX_URL points elsewhere.
  source text not null default 'ecb',
  fetched_at timestamptz not null default now(),
  constraint copilot_fx_rates_pk primary key (base, quote, day)
);

create index if not exists copilot_fx_rates_pair_idx on copilot_fx_rates(quote, base, day);
