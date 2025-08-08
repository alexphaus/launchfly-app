# Launchfly plan vs codebase: gap audit (Aug 2025)

This doc maps the stated go-to-market plan to what exists in the repo, and highlights gaps to close for an MVP that fulfills the public promises.

## Snapshot

- Strengths present: intake via Tally, Supabase schema, subdomain sites, Stripe Checkout + webhook, Inngest plumbing, Resend email, AI-driven generation flows, dashboard scaffolding.
- Critical gaps: guarantees enforcement (+$100 payouts), Stripe Connect + revenue share, real metrics, paid ads/marketplaces automation, 30‑min setup wizard, offer library with SOPs, warmed outreach pool.

## Crosswalk (plan ➜ repo status)

- Intake → DB (Tally webhook, sessions)
  - Status: Partial. Tally webhook creates user/business/session and emails the dashboard. Missing SLA start (T0) fields and plan mapping.
  - Gaps: store T0 (guarantee start), plan_tier, rev_share_pct; validate duplicate emails; confirm profiles row creation.

- Offer library (3 fast-to-fulfill SKUs with templates/SOPs)
  - Status: Partial. `src/core/launch.js` generates products programmatically; no curated offers, assets, or SOPs.
  - Gaps: offer definitions, landing copy, fulfillment checklists, upsell flows.

- Auto site + checkout (Next.js subdomain + Stripe + Resend + basic CRM)
  - Status: Mostly there. Middleware-based subdomain routing, `/sites/[subdomain]`, product page + checkout, emails via Resend.
  - Gaps: add CRM tables for leads/conversations or reuse outreach tables.

- Traffic engine (marketplaces + paid sprint + warm outreach)
  - Status: Proto only. Inngest functions simulate growth; outbound email via Resend exists but uses mock/random data.
  - Gaps: no Fiverr/Upwork/Facebook group listing automations; no Google/Facebook Ads integration; no prospect sourcing (Apollo/Maps) or warmed sender pool.

- Conversations → close → fulfill (bot + human assist)
  - Status: Basic AI chat route/component; not wired to inbound replies or omni-channel inbox.
  - Gaps: unify inbound (email replies/web form/FB leads) to a queue; quick-reply bot + human handoff; push-to-Checkout links.

- Guarantee engine ($100 at 48h; $1k in 60 days)
  - Status: Missing. No deadlines/timers, no payout automation, no state machine.
  - Gaps: deadlines on T0, first_payment_at tracking, scheduled checks, payout queue, status surfaces.

- Metrics powering marketing site
  - Status: Homepage stub; dashboard uses random values in places; metrics not aggregated.
  - Gaps: API for “spots left”, “live users”, “% hit $1k”; replace randomization; render real homepage.

- 30‑minute setup wizard
  - Status: Missing. Relying on Tally.
  - Gaps: in-app wizard collecting niche/skills/availability/payouts/subdomain/budget; writes to DB and triggers generation.

- Pricing & rev-share (Starter/Pro/Scale)
  - Status: Missing. Checkout uses platform account; no Connect; no metered usage or fee split.
  - Gaps: Stripe Connect (Standard), Checkout with `on_behalf_of` + `transfer_data.destination` and `application_fee_percent`; monthly metered billing for revenue share; plan enforcement.

- Risk controls & compliance
  - Status: Missing. No eligibility checks, budget caps, or public T&Cs.
  - Gaps: enforce niche/budget guardrails; publish guarantees T&Cs; build ops reserve tracking.

## Priority
Ship in this order: (1) guarantees engine, (2) Connect + plans + rev-share, (3) one winning offer with real templates, (4) one acquisition channel that closes in <48h, (5) real metrics on the site.
