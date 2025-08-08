# MVP backlog (2-week sprint)

Timebox: 10–14 days. Goal: fulfill promises with one offer and one reliable acquisition channel.

## Epic A — Guarantees engine (48h + $1k/60d)
- [ ] DB: add guarantee fields to `businesses` (T0, statuses, payout ids, plan, rev share, Connect id, work_free_mode). See migration `db/migrations/20250808_guarantees.sql`.
- [ ] Intake: in `api/webhook/tally`, set `guarantee_start_at = now()`, `plan_tier` from form, default `rev_share_percent`.
- [ ] Engine: create `api/guarantee/check` to (a) mark first payment and (b) check 48h/60d conditions; schedule daily via Inngest or Vercel cron.
- [ ] Email: apology + payout notice via Resend when 48h missed; switch to work‑free mode when 60d < $1k.

## Epic B — Stripe Connect + plans
- [ ] Connect onboarding: store `stripe_connect_account_id` on profiles/business.
- [ ] Checkout: use `transfer_data.destination` + `application_fee_percent` based on `plan_tier` (Starter 20%, Pro 10%, Scale 5%).
- [ ] Metered: monthly report revenue via usage records, or compute from `sales` and invoice via subscription item (phase 2).

## Epic C — One winning offer (library v1)
- [ ] Define 3 SKUs (lead‑gen starter, AI content sprint, website‑in‑a‑day) under `src/offers/` with: copy blocks, pricing, assets checklist, upsell.
- [ ] Update generation to select one SKU and render templates (product page + checkout).

## Epic D — One acquisition channel to close <48h
- [ ] Warm outreach: CSV of 100 prospects for a niche; send via Resend from a warmed domain; log to `email_outreach`.
- [ ] Response handling: simple reply‑to inbox + webhook to mark `response_received` and send checkout links.

## Epic E — Real metrics
- [ ] API `GET /api/metrics`: spots left (config), live users (active sessions last 10m), total users, % hit $1k.
- [ ] Replace random counters in dashboard; build homepage using existing UI components with real aggregates.

## Epic F — Setup wizard (lean)
- [ ] A single `/r` route with 5 steps (niche, skills, availability, subdomain, budget); writes to `businesses.form_data` and triggers generation.

## Epic G — Compliance & risk controls
- [ ] T&Cs page listing guarantees, definitions, exclusions, refund windows.
- [ ] Guardrails: budget caps per plan, niche eligibility check before accepting.

## Stretch
- Fiverr/Upwork posting automation; FB Lead Ads/Google Ads scripts.
