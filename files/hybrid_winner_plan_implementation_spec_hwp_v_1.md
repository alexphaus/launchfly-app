# Hybrid Winner Plan — Implementation Spec (HWP v1)

**Goal:** Ship a single, safe, automated money engine that delivers **first sale ≤ 48h** and **\$1,000 ≤ 60 days** for accepted users. This spec merges **Revenue Engine v5** guardrails + 3-lane demand with an optional **RRE high‑ticket lane**, on top of the **MGE v1 scaffold** (orchestrator, outbox, idempotent workers).

---

## 0) Environment & Keys

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
RESEND_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
BASE_URL=https://app.launchfly.ai
GOOGLE_ADS_API_KEY=...
GOOGLE_ADS_CUSTOMER_ID=...
FACEBOOK_ACCESS_TOKEN=...
FACEBOOK_AD_ACCOUNT_ID=...
OPENAI_API_KEY=...
```

---

## 1) Data Model (Postgres / Supabase)

> **Conventions:** UUID v4 PKs, `snake_case`, RLS by `project.user_id`. Only key fields shown.

```sql
-- Users & Projects
create table app_user (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  role text default 'user',
  created_at timestamptz default now()
);

create table project (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_user(id) on delete cascade,
  name text not null,
  vertical text,
  locale text default 'ES',
  status text default 'discover', -- discover|offer|build|demand|convert|fulfill|retain
  created_at timestamptz default now()
);

-- Offers & SKUs
create table offer (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references project(id) on delete cascade,
  type text not null, -- tripwire|core|retainer|rre
  title text not null,
  price_cents int not null,
  deposit_cents int default 0,
  cogs_cents int default 0,
  description text,
  live boolean default false,
  created_at timestamptz default now()
);

-- Demand lanes / campaigns
create table campaign (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references project(id) on delete cascade,
  lane text not null,  -- search|meta|outreach|rre
  budget_cents int default 0,
  daily_cap_cents int default 0,
  status text default 'paused',
  meta jsonb default '{}',
  created_at timestamptz default now()
);

-- Leads & Outreach
create table lead (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references project(id) on delete cascade,
  email text,
  source text, -- google|meta|list|marketplace|linkedin
  url text,
  status text default 'new', -- new|contacted|replied|qualified|won|lost
  score int default 0,
  created_at timestamptz default now()
);

create table outreach_message (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references lead(id) on delete cascade,
  project_id uuid references project(id) on delete cascade,
  channel text, -- email|sms|whatsapp|linkedin
  angle text,  -- A|B|C
  sent_at timestamptz,
  reply_at timestamptz,
  intent text, -- negative|neutral|positive
  created_at timestamptz default now()
);

-- Orders & Fulfillment
create table "order" (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references project(id) on delete cascade,
  offer_id uuid references offer(id),
  amount_cents int not null,
  source text default 'stripe', -- stripe|reserve|partner
  created_at timestamptz default now()
);

create table fulfillment (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references "order"(id) on delete cascade,
  partner_id uuid,
  state text default 'assigned', -- assigned|in_progress|qa|delivered|rework
  due_at timestamptz,
  created_at timestamptz default now()
);

-- Guarantees & Evidence
create table guarantee_reserve (
  id uuid primary key default gen_random_uuid(),
  cohort text not null, -- vertical|geo batch key
  reserve_cents int not null,
  exposure_cap_cents int not null,
  created_at timestamptz default now()
);

create table evidence_cache (
  project_id uuid primary key,
  median_ttp_hours numeric,
  first_sale_rate_30d numeric,
  orders_last_7d int,
  recent_receipts jsonb,
  updated_at timestamptz default now()
);

-- Outbox
create table event_outbox (
  id bigserial primary key,
  topic text not null,
  payload jsonb not null,
  created_at timestamptz default now(),
  processed_at timestamptz
);
```

### SLO Views

```sql
create view slo_project as
select
  p.id as project_id,
  percentile_cont(0.5) within group (order by extract(epoch from (o.created_at - p.created_at))/3600) as median_ttp_hours,
  count(o.id) filter (where o.created_at <= p.created_at + interval '30 days')::float / nullif(count(o.id) over (partition by p.id),0) as first_sale_rate_30d
from project p
left join "order" o on o.project_id = p.id
group by p.id;
```

---

## 2) Thresholds & Guardrails (Constants)

```ts
export const ACCEPTANCE_SCORECARD = {
  max_cpc_eur: 1.20,      // search CPC ≤ €1.20
  min_template_cvr: 0.025, // template CVR ≥ 2.5%
  min_partners: 2          // ≥2 active partners in locale
};

export const SPEND_GUARDRAILS = {
  pre_sale_cap_eur: 60, // ~48h
  kill_ctr_lt: 0.007,   // 0.7%
  kill_cpc_gt: 1.20,    // €
  pause_cpa_gt_eur: 35,
  pause_after_spend_eur: 70
};

export const OUTREACH_RULES = {
  pause_if_reply_rate_lt: 0.015, // 1.5% after 50 sends
  sample_batch: 50
};

export const META_RULES = {
  kill_lp_view_rate_lt: 0.35,
  kill_cpr_gt_eur: 12
};
```

---

## 3) API Endpoints (Next.js App Router)

> Minimal skeletons to drop into `src/app/api/*`.

### `POST /api/intake`

Creates project + default SKUs (tripwire/core/retainer) and optional **RRE** SKU.

```ts
export async function POST(req: Request) {
  const body = await req.json();
  // 1) evaluate ACCEPTANCE_SCORECARD
  // 2) create project + offers
  // 3) enqueue `engine.launch`
  return Response.json({ ok: true });
}
```

### `POST /api/money-engine/launch`

Fires orchestrator to start lanes in parallel.

```ts
export async function POST(req: Request) {
  const { projectId } = await req.json();
  // enqueue topics: offer.published, demand.start, outreach.start
  return Response.json({ ok: true });
}
```

### `POST /api/leads/import`

Bulk import seed leads for warm outreach.

```ts
export async function POST(req: Request) {
  const rows = await req.json();
  // insert into lead[], emit lead.created per row
  return Response.json({ count: rows.length });
}
```

### `POST /api/stripe/webhook` (checkout‑watch)

```ts
export async function POST(req: Request) {
  // verify signature → upsert order → emit checkout.succeeded
  return Response.json({ received: true });
}
```

### `GET /api/evidence/public?project_id=`

Serve live counters + anonymized receipts.

```ts
export async function GET(req: Request) {
  // read evidence_cache; refresh if stale
  return Response.json({ /* metrics */ });
}
```

---

## 4) Workers (Edge Functions / Cron)

**All workers are idempotent; they consume **``** → publish to Redis Streams.**

- **outreach-sequencer**: Send 3‑step sequence, enforce rate limits, emit `outreach.sent`.
- **reply-parser**: Classify replies, route positives to sales‑assist (Slack/Inbox), attach Calendly/Stripe deposit links.
- **traffic-manager**: Create/search/meta campaigns; keep within daily caps; emit performance metrics.
- **budget-watchdog**: Enforce CTR/CPC/CPA thresholds; pause losers; emit `sla.breached`.
- **bandit-allocator**: Shift budget across angles/lanes within caps.
- **checkout-watch**: Detect first paid order → move project `status` to `convert` → trigger `fulfillment-router`.
- **fulfillment-router**: Assign partner by rating/capacity/margin; insert `fulfillment`; send assignment email; SLA‑based `due_at`.
- **qa-verifier**: On `state='qa'`, run checklist; fail→`rework`, pass→`delivered` + NPS.
- **guarantee-engine**: Run **T+18/36/48** checks (see runbook); adjust reserve and trigger **buyer‑of‑last‑resort** and **\$100 payout** when required.
- **evidence-updater**: Recompute `median_ttp_hours`, `first_sale_rate_30d`, `recent_receipts`; update cache.

---

## 5) 48‑Hour Runbook (automated)

**T+0–1h**

- Provision subdomain, publish offer page, wire Stripe, load ad/outreach kits.

**T+1–12h**

- Search: 2 exact‑intent ad groups (tight geo), €20/day cap.
- Meta: 1 lead‑ad set, €10/day cap.
- Outreach: 100 contacts, 3‑step sequence.

**Hour 18**

- If **no positive replies** → swap angle, widen audience +2 segments, partner‑tap ON.

**Hour 24**

- If **replies but no checkout** → concierge close: send deposit link + limited‑slots copy.

**Hour 36**

- If **no checkout** → boost marketplace listing + arm **buyer‑of‑last‑resort** path.

**Hour 48**

- If **still no first payment** → auto **\$100 payout** per SLA; continue to 60‑day plan.

---

## 6) RRE High‑Ticket Lane (toggle per cohort)

**When to enable:** B2B/service cohorts with strong willingness‑to‑pay.

**SKU:** `$297–497` (audit / 48‑hour setup).

**Activity math (conservative 2% conv):** 2–3 sales → \$1k; 150 targeted contacts in week 1.

**Channels:** cold email + LinkedIn + micro‑budget ads + personalized value videos.

**Automation:** Same workers; outreach sequence uses value videos; concierge close books short calls or takes deposits.

---

## 7) Evidence Layer (public)

- Endpoint `GET /api/evidence/public?project_id=...` → JSON `{ median_ttp_hours, first_sale_rate_30d, orders_last_7d, recent_receipts }`.
- Render counters + anonymized ticker on homepage; refresh via `evidence-updater`.

---

## 8) Security & Compliance

- Supabase **RLS**: all tables scoped by `project.user_id`.
- Webhook signature verification (Stripe/Resend); audit log admin actions.
- Lead consent logging; instant opt‑out; list hygiene; policy‑safe ad copy.

---

## 9) Release Plan (14 days)

**Sprint A (Days 1–7)**

1. DB migrations + RLS + `event_outbox`.
2. `/api/projects`, `/api/offers`, `/api/leads/import`.
3. Resend integration + `outreach-sequencer` (email) + rate limits.
4. Stripe Checkout + webhook + `checkout-watch`.
5. `fulfillment-router` basic (manual partner assignment) + email notices.
6. SLO views + Evidence endpoint + admin page skeleton.

**Sprint B (Days 8–14)**

1. `reply-parser` + sales‑assist Slack webhook.
2. `budget-watchdog` + thresholds + pause/resume controls.
3. `guarantee-engine` Hour‑18/36/48 plays + reserve accounting.
4. `traffic-manager` (Google/Meta) + `bandit-allocator`.
5. Marketplace lister + partner‑tap (manual → later API).
6. QA verifier + NPS capture; harden dashboard.

---

## 10) Integration Notes

- Hook engine launch after project creation:

```ts
// src/app/api/launch/route.ts
if (project.id) {
  await fetch(`${process.env.BASE_URL}/api/money-engine/launch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: project.id })
  });
}
```

- Keep **emergency plays** (triple spend, 70% flash sale, blast emails) as **manual** runbooks only.

---

## 11) What “good” looks like

- **80%** first sale < 48h; **60%** hit \$1k by day 60.
- **CAC < €50**; payouts < **5%** of projects.
- Blended week‑1 contribution ≈ **€175** in baseline verticals; improves with retainer attach.

---

**Done.** Drop these migrations + endpoints + workers into your Next.js/Supabase stack and turn on the three lanes; enable the RRE lane per cohort when acceptance math supports it.

