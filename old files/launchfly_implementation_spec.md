# Launchfly Money Engine — Implementation Spec
**Version:** v1.0  
**Architecture:** v5 backbone + HWP v1.1 guardrails + HWP v2 ops layer  
**Target pilot:** First *genuine* sale ≤ 48 hours (p50), profitable unit-economics, public evidence endpoint

---

## 1) Objectives & Success Criteria

### Primary objectives
- **First genuine sale ≤ 48h** for pilot users (p50) without counting reserves.
- **Evidence integrity:** public counters exclude `orders.source='reserve'`.
- **Unit-economics guardrails:** dynamic acceptance gate and CPC-band spend caps.
- **Reliability:** event-driven, idempotent workers with observability.

### Success metrics (Week-1 pilot)
- **TTP (Time-to-Paid) p50:** ≤ 48h; p80 ≤ 96h.
- **First-sale rate (7d):** ≥ 60% among accepted projects.
- **Budget containment:** 100% adherence to CPC-band caps; zero unbounded spend.
- **SLO dashboards shipped:** TTP p50/p90, attach rate, reserve share (internal).

### Non-goals (pilot)
- Full ad API automation (Google/META) beyond v0 stubs.
- Multi-currency tax invoices; complex fulfillment marketplace UX.
- SMS and voice lanes (email-only outbound for Week-1).

---

## 2) System Overview

**Stack**
- **Next.js 14 (App Router) + TypeScript**
- **Postgres (Supabase)** for persistence and RLS
- **Upstash Redis Streams** for event bus + idempotency locks
- **Stripe Checkout** for payments & webhook ingestion
- **Resend** for outbound email
- **OpenAI** for reply intent classification & copy lint

**Key patterns**
- **Outbox → Stream**: DB transactions enqueue events; workers consume at-least-once with idempotency.
- **Band-aware guardrails**: CPC-band acceptance & budget caps embedded in orchestrator/workers.
- **Evidence layer**: public metrics view excluding reserves; cached via worker/cron.

---

## 3) Configuration & Secrets (`.env.example`)

```
NEXT_PUBLIC_APP_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE=
DATABASE_URL=

UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

RESEND_API_KEY=
OPENAI_API_KEY=

# (stubs for ad channels)
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
META_ADS_ACCESS_TOKEN=
```
- Fail fast with helpful errors when any secret is missing.
- Provide `scripts/dev:env-check` to validate presence/shape.

---

## 4) Data Model (minimum viable)

**Tables**
- `app_user(id uuid pk, email text, created_at timestamptz)`
- `project(id uuid pk, user_id uuid fk -> app_user, vertical text, geo text, status text, created_at timestamptz)`
- `offer(id uuid pk, project_id uuid fk, name text, price_cents int, currency text, created_at timestamptz)`
- `campaign(id uuid pk, project_id uuid fk, channel text, status text, budget_cents int, created_at timestamptz)`
- `lead(id uuid pk, project_id uuid fk, source text, email text, metadata jsonb, status text, created_at timestamptz)`
- `outreach_message(id uuid pk, project_id uuid fk, lead_id uuid fk, step int, channel text, status text, sent_at timestamptz, response_raw jsonb)`
- `orders(id uuid pk, project_id uuid fk, amount_cents int, currency text, source text check (source in ('checkout','reserve')), status text, created_at timestamptz)`
- `event_outbox(id bigserial pk, topic text, key text, payload jsonb, created_at timestamptz, processed_at timestamptz null)`

**Acceptance fields (on `project`)**
- `cpc_band enum('very_low','low','mid','high','very_high')`
- `expected_cvr numeric`, `expected_cpa_cents int`
- `acceptance_reason text`, `rejection_reason text`

**Views**
- `evidence_public` (rolling metrics excluding `orders.source='reserve'`)

**RLS**
- Scope by `project.user_id` for user-facing reads/writes.

---

## 5) API Endpoints (Week‑1 must ship)

### `POST /api/intake`
- **Input**: `{ vertical, geo, offer: { name, price_cents, currency } }`
- **Actions**: create project + default offer → run **acceptance gate** → enqueue `engine.launch`.
- **Output**: `{ projectId, accepted: boolean, reason? }`
- **Errors**: 4xx validation; 409 if duplicate open project.

### `POST /api/money-engine/launch`
- **Input**: `{ projectId }`
- **Action**: starts orchestrator for the project; idempotent.
- **Output**: `{ projectId, stage }`

### `POST /api/leads/import`
- **Input**: CSV or JSON array of leads.
- **Action**: bulk upsert + emit `lead.created` for each.
- **Output**: `{ imported, duplicates }`

### `POST /api/stripe/webhook`
- **Action**: verify signature → upsert `orders` (`source='checkout'`) → emit `checkout.succeeded`.
- **Output**: `200 OK`

### `GET /api/evidence/public?project_id=`
- **Output (JSON)**: `{ ttp_p50_hours, ttp_p80_hours, orders_7d, attach_rate }`
- **Rule**: exclude reserves (computed in DB view).

---

## 6) Event Bus

**Topics**
- `engine.launch`, `lead.created`, `outreach.sent`, `reply.received`, `checkout.succeeded`, `hourly.tick`, `evidence.refresh`

**Message envelope**
```
{
  "id": "<uuid>",
  "topic": "<topic>",
  "key": "<projectId or orderId>",
  "payload": { ... },
  "ts": "<ISO8601>"
}
```

**Idempotency**
- Derive dedupe key as `${topic}:${id}` (prefer outbox row id). Use Redis `SETNX` with TTL.

---

## 7) Orchestrator & 48‑Hour Runbook

**Phases**
- **T+0–1h**: Provision page (stub OK), create Stripe link, **outreach step 1** (≤100 sends).
- **T+1–12h**: Continue outreach; pause if reply‑rate `< 1.5%` after 50 sends.
- **Hour 18/24/36/48**: `guarantee-engine` executes **intent-gated** plays (angle tweaks, partner tap, reserve accounting).

**State machine**
- `init → prospect → engage → convert → fulfill`
- First genuine order (`checkout.succeeded`) → `convert` immediately.

---

## 8) Guardrails

### Dynamic Acceptance Gate
- Compute `expected_cpa = estimated_cpc / (ctr * cvr)` from vertical/geo priors.
- Reject when `expected_cpa > max_acquire_cost(offer)`; store reason.
- Bands `high/very_high`: default to **RRE** (outreach-heavy), cap paid traffic.

### Budget Watchdog
- Enforce per-band daily spend caps and channel pause/resume.
- Hard kill-switch flags per project/channel.

### Creative Linter
- Block claims like “$X in Y hours”, “guaranteed results”, prohibited financial/medical promises.
- Export `lintCopy(text): LintResult[]`; include unit tests.

---

## 9) Workers (Week‑1 MVP ✅)

- ✅ **outreach-sequencer** — Send 3-step email cadence via Resend; emits `outreach.sent`.
- ✅ **reply-parser** — Classify replies via LLM (negative/neutral/positive); positives → sales-assist webhook.
- ✅ **checkout-watch** — On `checkout.succeeded`, set project to `convert` and trigger fulfillment router (stub).
- ✅ **evidence-updater** — Refresh cache powering `/api/evidence/public` on schedule/events.
- **traffic-manager** — v0 stub; read caps; no external calls yet.
- **bandit-allocator** — placeholder for budget shifts across lanes.
- **guarantee-engine** — Timers for Hour 18/24/36/48; log reserves to `orders.source='reserve'`.
- **fulfillment-router** — v0 stub; assign partner by capacity (Week‑2).
- **qa-verifier** — v0 stub.

**Failure policy**
- Retry with exponential backoff; after N attempts → dead-letter stream and alert.
- All workers emit structured logs with correlation id (`projectId`).

---

## 10) Evidence Layer

**Metrics**
- `ttp_p50_hours`, `ttp_p80_hours` (rolling window)
- `orders_7d` (genuine only)
- `attach_rate` (orders/leads or orders/outreach as defined)
- **Exclusions**: any `orders.source='reserve'`

**Public API** → `/api/evidence/public` (cache 5–15 min).

---

## 11) Development Plan

### Week‑1: Four PRs
1. **PR1 — Schema + Outbox + Evidence**
   - Migrations, outbox helpers, evidence view (exclude reserves), `.env.example`, README.
   - Tests: acceptance scorer, creative linter.
2. **PR2 — Endpoints + Orchestrator + Core Workers**
   - Ship all 5 endpoints; orchestrator; `outreach-sequencer`, `reply-parser`, `checkout-watch`, `evidence-updater`.
3. **PR3 — Guardrails & Runbook**
   - Budget watchdog, CPC-band policies, `guarantee-engine` timers, cron wiring.
4. **PR4 — Admin JSON & Tests**
   - SLO JSON endpoints; e2e happy path (intake → outreach → Stripe webhook → evidence).

### Day-by-day (14-Day) Milestones
- **D1** schema/env → **D2** endpoints scaffold → **D3** Stripe path → **D4** outbound lane → **D5** event bus → **D6** acceptance/guardrails → **D7** evidence v1 → **D8** reply/inbox → **D9** paid-traffic stub → **D10** runbook timers → **D11** partner tap stub → **D12** fulfillment stubs → **D13** QA/NPS & dashboard → **D14** pilot cohort go-live.

---

## 12) Testing Strategy

**Unit**
- Acceptance scorer (edge bands, reject paths).
- Creative linter (block/allow list).
- Outbox producer (transactional enqueue).

**Integration**
- Webhooks: Stripe signature verification & idempotent order upsert.
- Outbox → Streams consumption with dedupe.

**E2E (happy path)**
- `POST /api/intake` → accepted.
- Seed leads → outreach step 1 emits events.
- Simulated `checkout.succeeded` webhook → project `convert`.
- `/api/evidence/public` reflects genuine sale; reserves excluded.

---

## 13) Observability

- **Logging**: pino-style JSON with `topic`, `projectId`, `eventId`.
- **Metrics**: counters per topic; histogram for TTP; error rates per worker.
- **Dashboards**: SLO tiles (TTP p50/p90, attach rate, reserve share), worker lag/head-of-line blocking.

---

## 14) Security & Compliance

- Verify Stripe webhooks; reject unknown events.
- RLS on user-owned data; admin-only SLO endpoints.
- PII minimization; encrypt API keys; rotate secrets; audit access to evidence cache.
- Policy-safe creative checks before any ad/email send.

---

## 15) Rollout & Ops

**Pilot cohort (10 users)**
- Must pass dynamic acceptance gate.
- For `high/very_high` CPC bands, enable **RRE** by default; ads capped.
- Daily standup: review SLOs, stopped channels, reserve shares.

**Kill switches**
- Global: `DISABLE_PAID_TRAFFIC`, `DISABLE_OUTREACH`.
- Per-project channel flags with TTL.

**Runbooks**
- Hourly cron to tick timers; DLQ monitor with alerting; evidence refresh every 15 min.

---

## 16) Future Work (Weeks 2–6)

- **Traffic Manager v1**: Google/META API integration, basic bandit allocation.
- **Partner Marketplace**: partner onboarding, scoring, capacity routing.
- **Closer Network**: booking links, pipeline stages, conversion attribution.
- **SMS/WhatsApp lane**; **RAG** for angle libraries; **auto-landing-page** generation.

---

## 17) Developer Ergonomics

- `scripts/dev:db-migrate`, `dev:db-seed`, `dev:workers`, `dev:env-check`.
- Sample cURL:
```
curl -X POST /api/intake -d '{"vertical":"coaching","geo":"ES","offer":{"name":"Starter","price_cents":9900,"currency":"EUR"}}' -H 'Content-Type: application/json'
```
- Local verification checklist after each PR.

---

## Appendix A — Example SQL (sketch)

```sql
create type cpc_band as enum ('very_low','low','mid','high','very_high');

create table project (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  vertical text not null,
  geo text not null,
  status text not null default 'init',
  cpc_band cpc_band,
  expected_cvr numeric,
  expected_cpa_cents int,
  acceptance_reason text,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table event_outbox (
  id bigserial primary key,
  topic text not null,
  key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Evidence view should exclude reserve orders.
-- create view evidence_public as select ... where orders.source <> 'reserve';
```
