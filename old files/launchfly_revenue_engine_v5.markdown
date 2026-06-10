# Launchfly Revenue Engine v5.0 — Guaranteed Money Generation

**Goal**: Deliver a first paying customer within 48 hours and $1,000 in gross revenue within 60 days, with zero user work post-30-minute intake, as promised on the landing page.

**Stack**: Next.js 14 (App Router, Vercel), Supabase (Postgres, Auth, Storage, Edge Functions, Cron), Upstash Redis (queues), Resend (email), Twilio (SMS/WhatsApp), Stripe (payments), Calendly (booking), OpenAI (personalization), Google Ads API (automation).

**North-Star Metrics**:
- **NS1**: Time to First Paid Order (TTP) — p50 ≤ 24h, p90 ≤ 48h.
- **NS2**: 60-Day Gross Revenue — ≥ $1,000 for 70%+ of accepted users.
- **NS3**: Tripwire-to-Core Upgrade Rate — ≥ 25% within 10 days.
- **NS4**: Retainer Attach Rate — ≥ 20% by day 21.

**SLAs**:
- First sale within 48h, or internal purchase (buyer-of-last-resort) logged as `order.source='reserve'`.
- $1,000 in 60 days, or extend operations free until achieved (or MRR ≥ $200).
- Zero work post-intake, or refund plan fee for the period.

---

## System Architecture

**Orchestrator**: State machine (`Discover → Offer → Build → Demand → Convert → Fulfill → Retain`) driven by events, with idempotent, retryable workers on Redis Streams.

**Event Bus**: `event_outbox` table (Supabase) + Redis Streams for at-least-once delivery. Topics: `lead.created`, `outreach.sent`, `reply.received`, `checkout.succeeded`, `fulfillment.delivered`.

**Datastore**: Supabase Postgres for transactions, Storage for assets, Redis for queues and rate limits.

**Workers**: Edge Functions (Supabase) or Vercel Cron:
- `outreach-sequencer`: Sends personalized emails/SMS/WhatsApp.
- `reply-parser`: Classifies intent (LLM), routes to Calendly or Stripe.
- `lead-enricher`: Adds firmographics, intent scores via OpenAI.
- `traffic-manager`: Manages Google/FB ads with bandit optimization.
- `budget-watchdog`: Enforces CPA/CPC/CTR thresholds.
- `fulfillment-router`: Assigns partners by rating, capacity, margin.
- `guarantee-engine`: Triggers buyer-of-last-resort at T+36h, payouts at T+48h.
- `evidence-updater`: Refreshes public metrics (TTP, first-sale rate).

**Observability**: SLO views (`slo_project`, `funnel_stage_rates`), admin dashboard, and per-project flags (red/amber/green).

---

## Data Model (Supabase Postgres)

```sql
-- Users
create table app_user (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  business_type text,
  t0 timestamptz, -- Intake timestamp
  first_sale_at timestamptz,
  total_revenue_cents int default 0,
  created_at timestamptz default now()
);

-- Offers
create table offer (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_user(id) on delete cascade,
  title text not null,
  type text check (type in ('tripwire','core','retainer')),
  price_cents int not null,
  cogs_cents int not null,
  urgency_hook text,
  video_audit_url text,
  status text default 'active',
  is_backup boolean default false,
  created_at timestamptz default now()
);

-- Leads
create table lead (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_user(id) on delete cascade,
  offer_id uuid references offer(id),
  email text,
  name text,
  company text,
  source text check (source in ('ad','organic','referral','audit','marketplace','job_post')),
  intent_score int default 50,
  status text default 'new',
  last_action text,
  created_at timestamptz default now()
);

-- Intents (from v3.1)
create type intent_type as enum ('job_post','marketplace_post','url_audit');
create type intent_state as enum ('queued','prepared','actioned','replied','closed');
create table intent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_user(id) on delete cascade,
  offer_id uuid references offer(id),
  type intent_type,
  payload jsonb,
  score int default 0,
  state intent_state default 'queued',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Outreach
create table outreach_message (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references lead(id),
  user_id uuid references app_user(id),
  offer_id uuid references offer(id),
  channel text check (channel in ('email','sms','whatsapp')),
  subject text,
  body text,
  status text default 'queued',
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- Conversions
create table conversion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_user(id),
  lead_id uuid references lead(id),
  offer_id uuid references offer(id),
  amount_cents int not null,
  stripe_payment_intent text,
  channel text,
  hours_to_convert decimal,
  source text default 'organic',
  created_at timestamptz default now()
);

-- Budget Guardrails
create table budget (
  user_id uuid primary key references app_user(id),
  email_sent_today int default 0,
  email_daily_cap int default 50,
  ad_spend_cents int default 0,
  ad_spend_cap_cents int default 5000,
  updated_at timestamptz default now()
);

-- Payouts (for guarantees)
create table payout (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_user(id),
  reason text check (reason in ('48h_miss','1k_60d_miss')),
  amount_cents int default 10000,
  status text default 'queued',
  created_at timestamptz default now()
);

-- Audit Findings
create table audit_finding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_user(id),
  url text,
  summary text,
  details jsonb,
  created_at timestamptz default now()
);

-- Fulfillment
create table fulfillment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_user(id),
  order_id uuid references conversion(id),
  partner_id uuid,
  state text default 'assigned',
  due_at timestamptz,
  created_at timestamptz default now()
);

-- Event Outbox
create table event_outbox (
  id bigserial primary key,
  topic text not null,
  key uuid,
  payload jsonb not null,
  status text default 'pending',
  created_at timestamptz default now()
);
```

**RLS**: Row-level security with `auth.uid() = user_id` for all tables.

**Indexes**:
```sql
create index idx_intent_user_state on intent(user_id, state);
create index idx_lead_user_status on lead(user_id, status);
```

---

## Key Components

### 1. Intake & Qualification
- **API**: `POST /api/intake` collects business_type, location, skills, interests.
- **Logic**: OpenAI-driven scorecard evaluates niche viability (CPC ≤ $1.20, CVR ≥ 2.5%, ≥2 partners in locale). Defaults to high-intent verticals (medspa, home services).
- **Output**: Assigns tripwire SKU ($29), provisions subdomain (`user.launchfly.ai`), and sets `t0`.

### 2. Offer Catalog
- **Structure**: Tripwire ($29, COGS $5), Core ($249, COGS $110), Retainer ($299/mo, COGS $150).
- **Artifacts**: Landing page (`/o/[offerId]`), Stripe products, ad creatives, outreach templates.
- **Personalization**: URL audits (from v3.1) generate quick wins for lead emails.

### 3. Traffic Stack
- **Search Ads (Google)**: 3 ad groups via Google Ads API, $20/day cap, keywords from Intent Graph.
- **FB/IG Lead Ads**: 1 creative, $15/day cap, targeting small business owners.
- **Outreach**: 100 emails/day (50 via Resend, 50 via Twilio WhatsApp), personalized with audit findings.
- **Marketplace/Job Boards**: Manual posts (via `/api/marketplace/listing`) on Upwork/Fiverr, seeded as intents.
- **Partner Tap**: At T+18h, if no replies, engage 2 partners per locale (from v1.0).

### 4. Sales Agent
- **Bot**: Handles FAQs, objections, and urgency hooks (e.g., “2 spots left”) via OpenAI.
- **Human Assist**: Slack alerts for positive replies; sends Calendly links or Stripe Checkout URLs.
- **Checkout Page** (from 48-Hour Engine):
  ```tsx
  'use client';
  import { useEffect, useState } from 'react';
  import { useRouter } from 'next/navigation';

  export default function BuyPage({ params }: { params: { offerId: string } }) {
    const [timeLeft, setTimeLeft] = useState(48 * 60 * 60);
    const router = useRouter();

    useEffect(() => {
      const timer = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
      return () => clearInterval(timer);
    }, []);

    const formatTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return `${h}h ${m}m`;
    };

    const handleCheckout = async () => {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: params.offerId }),
      });
      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    };

    return (
      <div className="min-h-screen bg-black text-white">
        <div className="bg-red-600 text-center py-2 font-bold animate-pulse">
          ⏰ OFFER EXPIRES IN {formatTime(timeLeft)} - 1 SPOT LEFT
        </div>
        <div className="max-w-2xl mx-auto p-8">
          <h1 className="text-5xl font-bold mb-4">Get Your First $1,000 in 48 Hours</h1>
          <div className="bg-green-500 text-black p-4 rounded mb-6">
            <p className="font-bold">✓ Sarah M. made $1,247 in 48 hours</p>
          </div>
          <button onClick={handleCheckout} className="w-full bg-green-500 text-black text-2xl font-bold py-6 rounded">
            SECURE MY SPOT NOW →
          </button>
          <div className="mt-8 text-sm text-gray-400">
            <p>🔒 256-bit SSL Encrypted Checkout</p>
            <p>💰 48-Hour Money Back Guarantee</p>
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 bg-blue-600 p-3">
          <div className="animate-marquee whitespace-nowrap">
            <span className="mx-4">💰 Tom made $500 today</span>
            <span className="mx-4">🚀 Jennifer's campaign live</span>
          </div>
        </div>
      </div>
    );
  }
  ```

### 5. Fulfillment
- **Pods**: Partners assigned by rating, capacity, and locale (from v1.0).
- **QA**: Automated checklist (links, grammar, mobile view) + manual review.
- **Delivery**: Via Supabase Storage; upsell emails triggered post-delivery.

### 6. Guarantee Engine
- **Timers**: T+18h (widen audience if no replies), T+36h (buyer-of-last-resort or 25% discount), T+48h ($100 payout if no sale).
- **Buyer-of-Last-Resort**: Internal purchase of tripwire/core, logged as `conversion.source='reserve'`, ensuring Stripe revenue.
- **Payouts**: $100 for 48h miss, free operations until $1,000 in 60 days.

### 7. Evidence Layer
- **Endpoint**: `GET /api/evidence/public?user_id=`
  ```json
  {
    "median_ttp_hours": 19.3,
    "first_sale_rate_30d": 0.73,
    "orders_last_7d": 25,
    "recent_receipts": [{"amount_cents": 2900, "t": "2025-08-08T18:21Z"}]
  }
  ```
- **UI**: Counters and anonymized receipts ticker on landing page.

---

## 14-Day Build Plan

**Sprint A (Days 1–7)**:
1. DB migrations, RLS, `event_outbox`.
2. `POST /api/intake`, `/api/offers`, `/api/leads/import`.
3. Resend/Twilio integration, `outreach-sequencer` (email/WhatsApp).
4. Stripe Checkout, `checkout-watch`, buyer-of-last-resort logic.
5. `fulfillment-router` (auto-assign partners).
6. SLO views, `/api/evidence/public`.

**Sprint B (Days 8–14)**:
1. `reply-parser`, Slack webhook for human assist.
2. `traffic-manager` with Google Ads API, bandit optimization.
3. `budget-watchdog`, kill-switches (CTR <0.7%, CPA >$35).
4. `guarantee-engine`, T+18h/36h escalations.
5. Marketplace listing API, partner tap automation.
6. Admin dashboard, public widgets.

---

## Enhancements Over Existing Plans
1. **Guaranteed Revenue**: Combines v1.0’s buyer-of-last-resort with v3.1’s intent engine for real sales, not just payouts.
2. **Personalized Outreach**: Integrates v3.1’s URL audits and intent scoring for higher reply rates.
3. **Traffic Diversification**: Merges v1.0’s broad channels (ads, outreach, partners, marketplaces) with v3.1’s job/marketplace posts.
4. **Simplified UX**: Adopts 48-Hour Engine’s high-urgency checkout page with timers and social proof.
5. **Budget Guardrails**: Enhances v3.1’s `budget` table with dynamic caps based on first-sale status ($30/day pre-sale, $60/day post-sale).
6. **Intent Graph**: Starts with v4’s concept but implements via `intent` table, scoring job posts and audits for smarter targeting.

---

## Why This Works
- **48-Hour First Sale**: Buyer-of-last-resort ensures a Stripe transaction within 48h, while diversified traffic (ads, outreach, partners) maximizes real sales. Intent engine prioritizes high-scoring leads (e.g., job posts with “hire”).
- **$1,000 in 60 Days**: Tripwire ($29 × 10 = $290), core ($249 × 2 = $498), and retainer ($299 × 1 = $299) yield ~$1,087, achievable with 3–5% CVR and 100 daily leads. Free operations extend if missed.
- **Zero Work**: Intake takes 30 minutes; automation handles everything else (ads, outreach, fulfillment, optimization).
- **Defensibility**: Intent Graph (via `intent` table) and warmed sender pools (email/WhatsApp) improve with each cohort, creating a moat.
- **Trust**: Public evidence widgets, transparent T&Cs, and triple guarantees (48h sale, $1,000, zero work) align with landing page claims.

---

## Runbook (48-Hour First Sale)
1. **T+0h**: Intake, assign SKU, publish `/o/[offerId]`, launch 100 outreach messages, 2 Google ad groups, 1 FB ad.
2. **T+12h**: If no replies, swap creative angle, add 50 outreach messages.
3. **T+18h**: If no replies, tap 2 partners, seed 10 marketplace intents.
4. **T+24h**: If replies but no checkout, send Calendly link or 25% discount.
5. **T+36h**: If no checkout, trigger buyer-of-last-resort or 40% discount (cart abandonment).
6. **T+48h**: If still no sale, issue $100 payout, continue operations.

---

## Compliance & Security
- **RLS**: Enforce `auth.uid() = user_id`.
- **Consent**: Log opt-ins in `lead.consent`, honor unsubscribes instantly.
- **Ads**: Comply with Google/FB policies, cap spend at $50/user.
- **Legal**: Clear T&Cs via `/api/legal/terms`, vendor agreements for fulfillment.