# Launchfly ULRG — Implementation Spec v1.0

**Goal:** Ship a lean, defensible money engine that delivers a *genuine* first sale fast, scales safely, and requires \~95% automation. This spec merges your v5 backbone with HWP guardrails and Week‑1 runbook, adds the “Marketplace First Sale” wedge, and keeps humans escalation‑only.

---

## 1) Non‑Negotiables

- **Evidence integrity:** Public metrics exclude internal/reserve orders.
- **Budget safety:** CPC‑band caps and kill‑switches enforced in code.
- **Acceptance gate:** Only accept projects where unit economics are sane.
- **Human scope:** Only for positive‑intent replies and first‑delivery QA.

---

## 2) Architecture Overview

```
Frontend (Next.js)  ←→  API (App Router)  ←→  Supabase (Postgres+RLS)
                                      ↘  Upstash Redis Streams (events)
Workers: outreach‑sequencer | reply‑parser | checkout‑watch | budget‑watchdog
         guarantee‑engine | fulfillment‑router | evidence‑updater
```

**Core pattern:** Outbox → Stream → Idempotent workers. State machine stages: `INTAKE → ROUTE → DEMAND → CONVERT → FULFILL → EVIDENCE → RETAIN`.

---

## 3) Acceptance Gate & Offer Router

**Decision rule (at intake):** *Accept iff* `Expected_CPA ≤ Max_Acquire_Cost` **and** there are ≥2 vetted partners in the locale.

- `Expected_CPA = CPC_band_value / Expected_CVR`
- `Max_Acquire_Cost = min(Tripwire_Price, Core_Contribution_Margin)`

**Persist on **``**:** `cpc_band`, `expected_cvr`, `expected_cpa_cents`, `acceptance_reason | rejection_reason`.

**Routing:**

- `cpc_band ∈ {high, very_high}` → enable **RRE (outreach‑first)**; ads run as retargeting/cred only.
- else → run **all three lanes** (Search, Meta leads, Outreach) with band caps.

**Offer ladder:** *Tripwire* €19–39 → *Core* €199–399 → *Retainer* €249–399/mo. One assigned per user.

---

## 4) Demand Engine (three lanes + marketplace wedge)

### Lane A — Search intent (speed)

- 2 exact‑intent ad groups, tight geo. Enforce CTR/CPC/CPA kill rules per band.

### Lane B — FB/IG lead ads (scale)

- 1–2 angles; warm leads → concierge if positive intent.

### Lane C — Outreach (profit)

- 3–4 steps over 12–16 days. URL‑audit personalization. Pause if reply <1.5% after 50 sends.

### Marketplace First‑Sale Wedge (Day‑1)

- Publish programmatic micro‑offer profiles in active directories/marketplaces (per niche).
- **Responder:** surfaces matching gigs; composes 3‑paragraph proposal from offer catalog + proof; human clicks **Send**; includes **Stripe Payment Link** or **Cal + deposit**.
- Use as fastest path to first *real* sale; then scale with lanes A–C.

**48‑Hour escalation (intent‑gated)**

- **T+18h:** Pivot angles/expand audiences **only if zero positive signals**.
- **T+24h:** Send deposit/limited‑slots **only on positive intent**.
- **T+36h:** Boost marketplace & partner tap. Arm reserve flow (internal) but keep out of evidence.
- **T+48h:** If no genuine sale → honor payout as per SLA, continue ops; log as `reserve`.

**CPC‑band caps (whichever first in 48h):** low 50 clicks / €60 · mid 40/€80 · high 30/€120 · very\_high 20/€160. Kill if CTR <0.7% or CPC exceeds band, pause if CPA >€35 after ≥€70 spend.

---

## 5) Conversion Stack (universal)

- **Offer page:** benefit‑driven + proof widgets; timer allowed; policy‑safe copy linter.
- **Checkout:** Stripe Checkout/Payment Links (tripwire/pay‑to‑book deposits).
- **Booking:** Calendly/Cal.com embed (optional).
- **Reply parser:** On positive intent → Slack alert with one‑click deposit link; otherwise continue sequence.

---

## 6) Fulfillment & QA

- **Router:** Assign partners by rating/capacity/margin; set SLA `due_at` and track status.
- **Micro‑offer library (8–12 SKUs):** GBP tune‑up; Pixel/Tracking fix; Speed/LCP uplift; Simple Lead Funnel; Ads account cleanup; Review‑request workflow; Basic SEO tune‑up; Local listing syndication.
- **QA:** First order per user/offer = human QA; thereafter 1/10 spot‑check. Capture before/after assets for Proof Vault.

---

## 7) Evidence Layer (public & tamper‑proof)

- **Endpoint:** `/api/evidence/public?project_id=…` → `{ median_ttp_hours, first_sale_rate_30d, orders_last_7d, recent_receipts }`.
- Exclude `orders.source='reserve'` in SQL view. Cache with `evidence‑updater`.
- Surface counters + anonymized receipts ticker on landing/app.

---

## 8) Data Model (minimum viable)

**Tables (Postgres/Supabase, RLS on **``**):**

- `app_user(id, email, created_at)`
- `project(id, user_id, vertical, geo, cpc_band, expected_cvr, expected_cpa_cents, acceptance_reason, rejection_reason, t0)`
- `offer(id, project_id, name, price_cents, currency, sku)`
- `lead(id, project_id, source, email, metadata jsonb, score int, status)`
- `outreach_message(id, project_id, lead_id, step, status, sent_at, meta jsonb)`
- `order(id, project_id, offer_id, amount_cents, source, created_at, rank_in_project)`
- `event_outbox(id, topic, payload jsonb, created_at, processed_at)`
- `partner(id, geo, verticals text[], rating, capacity, margin_bp)`
- `fulfillment_task(id, project_id, order_id, partner_id, state, due_at, artifacts jsonb)`

**Views:** `evidence_public`, `slo_project`, `funnel_stage_rates`.

---

## 9) Services & Workers

- **outreach‑sequencer** — sends steps, respects reply‑rate gate & daily caps; emits `outreach.sent`.
- **reply‑parser** — classifies intent; routes positive to concierge; emits `reply.received`.
- **checkout‑watch** — listens to Stripe webhook; emits `checkout.succeeded`; starts fulfillment.
- **fulfillment‑router** — assigns partner; sets `due_at`; moves tasks through `qa → delivered`; collects NPS.
- **budget‑watchdog** — enforces CTR/CPC/CPA caps by band; pauses lanes & annotates reason.
- **guarantee‑engine** — runs T+18/24/36/48 timers; arms reserve payout; tags `order.source='reserve'` when used.
- **evidence‑updater** — recomputes medians/rates; updates cache; drives public widget.

All workers are idempotent (use Redis locks + message keys). Failures write to a `dead_letter` queue with retry policy.

---

## 10) API Endpoints

- `POST /api/intake` — create project; run acceptance scoring; return routing decision + assigned offer.
- `POST /api/leads/import` — bulk load leads; returns `lead_ids`.
- `POST /api/money-engine/launch` — kickoff lanes; returns campaign ids and budgets.
- `POST /api/checkout/session` — generate Stripe Checkout/Payment Link for assigned offer.
- `POST /api/stripe/webhook` — verify signature; upsert orders; emit event.
- `GET  /api/evidence/public?project_id=…` — returns public metrics JSON.

---

## 11) Compliance & Safety

- **Email:** Auth domains, instant unsubscribe, list hygiene; pause segment if reply‑rate gate fails or bounces elevate; no income‑time promises in creatives.
- **SMS/WhatsApp:** Off by default in v1; add only with explicit opt‑in and registration.
- **LinkedIn:** Manual touches only; no bots; daily caps.
- **Creatives linter:** Reject banned patterns before publish; unit tests included.

---

## 12) Observability & SLOs

- **Dashboard:** TTP p50/p80; first‑sale rate (7d); reserve share; paused channels; concierge SLA; CPC‑band distribution.
- **Alerts:**
  - Lane paused by watchdog (reason).
  - Evidence widget out‑of‑date > 2h.
  - Concierge SLA breach (>15 min) on positive‑intent replies.

---

## 13) Runbook — First 14 Days

**Day 1–2 — Foundations**

- DB migrations (project fields for CPC/accept reasons), RLS, `event_outbox`.
- Ship `/api/intake`, `/api/checkout/session`, `/api/stripe/webhook`.
- Stand up `outreach‑sequencer` + basic templates; configure domain auth & unsub.

**Day 3–4 — Routing & Demand**

- Implement acceptance scorer + router; enable lanes A–C with band caps.
- Build marketplace responder (manual send button) for two pilot niches.

**Day 5 — Guardrails On**

- `budget‑watchdog` with CTR/CPC/CPA rules; creatives linter.
- `reply‑parser` → Slack concierge; deposit links for positive intent.

**Day 6 — Fulfillment & Proof**

- `fulfillment‑router` (manual partner assignment v1); Proof Vault capture.
- `evidence‑updater` + public widget on site/app.

**Day 7 — Pilot Launch**

- 10 accepted projects (Tier‑1 niches). Hold to caps. Daily 09:00/12:00/18:00 rituals.

**Days 8–14 — Iterate to Green**

- Add second angle per lane; enable partner tap; start retainer offers for first buyers.
- Reduce reserve % as stats improve; expand to 2 more niches if p50 TTP ≤ 48h.

---

## 14) Success Metrics & Stop‑Losses

- **Within 48h:** p50 genuine first sale ≤ 48h for accepted projects.
- **Week‑1:** ≥60% first‑sale rate (7d), all spend within band caps.
- **Stop‑loss:** outreach reply <1.5% after 50 sends → rewrite/segment pause; CTR <0.7% or CPC > band max → kill ad set; CPA >€35 after ≥€70 → pause lane.

---

## 15) Roles & Minimal Staffing

- **Ops lead (you)** — accept/reject decisions; partner capacity; daily rituals.
- **Concierge closer (1 part‑time)** — positive‑intent replies only; SLA <15 min.
- **Vendor bench (2–3)** — micro‑offer fulfillment under SOPs.

---

## 16) Risks & Mitigations

- **List quality / deliverability:** strict hygiene + reply‑rate gates + domain pools.
- **Policy/ToS:** keep LI manual; linter blocks risky claims; evidence is data‑backed.
- **Cash burn:** CPC‑band caps + reserve sizing; outreach and marketplace lanes cost‑light.

---

## 17) Launch Checklist (ship‑ready)

-

**Outcome:** a lean engine that turns accepted users into paid orders quickly, proves it publicly (without gaming), and scales safely with codified guardrails.

