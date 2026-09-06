# Copilot — opportunity engine (`/copilot`)

> **Multi-user rule.** Nobody sends under an identity they do not own, and nobody
> reads another user's supply. A profile may only send through the API when it
> has its own WhatsApp instance (`linked_business_id`) or its own verified
> sending address (`email_from`) *and* `send_mode = 'api'`. Everyone else gets
> `send_mode = 'manual'`: the draft opens pre-filled in their own WhatsApp or
> mail app via a `wa.me` / `mailto` link, they send it, and tap "I sent it" —
> which records the same execution, schedules the same day-3 follow-up, and
> feeds the same metrics. The server's WhatsApp and Resend credentials are the
> operator's and are never used on a user's behalf.

A separate, mobile-first, installable web app living inside this repo. It shares
the Supabase project, the Next.js runtime and a few Launchfly primitives (the
WhatsApp provider, Resend, the Apify Google Maps scraper, the prospect pipeline)
but none of the business logic. Everything is under:

| Layer | Path |
| --- | --- |
| UI (installable PWA) | `src/app/copilot/` |
| API | `src/app/api/copilot/` |
| Core | `src/lib/copilot/` |
| Schema | `supabase/migrations/20260903_copilot_foundation.sql`, `20260904_copilot_close_the_loop.sql` |

## The loop

```
real supply ───────────► copilot_opportunities (sourced, with contact)
  hunter_prospects            │
  Google Maps (Apify)         ▼
                         agent ranks candidates + cites metrics ──► Today
notes / goals / capacity ─┘                                          │
                                                       AI-drafted opener + execution
                                                                     │  (user taps Approve & send)
                                            WhatsApp / email ◄───────┘
                                                  │
                        chat_history (inbound) ───┴──► copilot_outcomes (reply · meeting · won · lost)
                                                              │
                        ranking (outcome-weighted) ◄──────────┼──► goal current_value (won amount)
                        metrics in the next read ◄────────────┘
```

Every arrow is implemented. Nothing leaves without the user's tap.

## Setup

1. Run every `supabase/migrations/2026090*_copilot_*.sql` in the SQL editor, in order.
2. Environment (all optional except the first two):

```
NEXT_PUBLIC_SUPABASE_URL=...        # already used by the app
SUPABASE_SERVICE_KEY=...            # already used by the app
COPILOT_SESSION_SECRET=...          # long random string; falls back to the service key

# Agent (pick one; none = deterministic starter that still ranks real candidates)
COPILOT_AGENT_URL=https://...       # external vertical agent (contract below)
COPILOT_AGENT_SECRET=...
COPILOT_SUPPLY_URL=https://...      # external supply service (contract below)
COPILOT_SUPPLY_SECRET=...
#  or
OPENAI_API_KEY=... / DEEPSEEK_API_KEY=...
COPILOT_AI_API_KEY / COPILOT_AI_BASE_URL / COPILOT_AI_MODEL

# Real supply
APIFY_API_TOKEN=...                 # Google Maps adapter (same token Launchfly uses)

# Approve & send
ULTRAMSG_INSTANCE_ID / ULTRAMSG_TOKEN     or   EVOLUTION_BASE_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE
RESEND_API_KEY=... COPILOT_EMAIL_FROM="Alex <alex@yourdomain>"   # email channel and sign-in links (falls back to FROM_EMAIL)

# Push
COPILOT_VAPID_PUBLIC_KEY / COPILOT_VAPID_PRIVATE_KEY / COPILOT_VAPID_SUBJECT   # node scripts/copilot-vapid.mjs

# Cron
CRON_SECRET=...                     # REQUIRED for /api/copilot/cron/daily — it fails closed without one
#   On the profile's Monday the cron also writes the weekly Signals read (copilot_insights.kind='weekly')
#   and pushes it, deep-linking to /copilot?tab=signals. Idempotent per ISO week.
COPILOT_CRON_BATCH=25               # profiles per run
COPILOT_CRON_BUDGET_MS=240000       # stop starting new profiles past this point

NEXT_PUBLIC_APP_URL=https://...     # sign-in links AND Stripe return urls; falls back to request host

# Billing (no keys = free plan for everyone, upgrade buttons hidden — see COPILOT_BILLING.md)
STRIPE_SECRET_KEY=sk_live_...
COPILOT_STRIPE_WEBHOOK_SECRET=whsec_...    # its OWN endpoint secret, not the one /api/webhook/stripe uses
STRIPE_PRICE_COPILOT_PRO_MONTHLY=price_...
STRIPE_PRICE_COPILOT_PRO_YEARLY=price_...
STRIPE_PRICE_COPILOT_OPERATOR_MONTHLY=price_...
STRIPE_PRICE_COPILOT_OPERATOR_YEARLY=price_...
NEXT_PUBLIC_COPILOT_CURRENCY=$             # display only; Stripe decides what is charged
```

3. Open `/copilot`. New device → 3 screens → first supply pull (prospect pipeline) → first brief.
   Add to home screen installs it as its own app.

### Scheduling the daily loop

`vercel.json` carries a cron entry, but **that file only does anything on Vercel**. On a
self-hosted deploy (Coolify, Docker, a VPS) add a scheduled task:

```
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/copilot/cron/daily
```

In Coolify: application → **Scheduled Tasks** → the command above on `0 21 * * *`. The daily
run does supply → reply reconciliation → brief for every profile seen in the last 30 days, and
reports `truncated: true` rather than silently dropping anyone. The app also runs the brief on
open when today's is missing, so it works without the schedule; it just won't find new matches
or notice replies until someone taps "Find new".

## How each phase works

**Identity** — signed httpOnly cookie carrying the profile id (`session.ts`). Optional email
magic links (`auth.ts`): own tokens hashed in `copilot_login_tokens`, sent with Resend,
consumed once by `/api/copilot/auth/callback`. Requested from inside the app it verifies and
links the current profile; from `/copilot/login` it finds the profile by email. No third-party
auth configuration. Onboarding is rate limited per IP and refuses when a session already exists.

**Real supply** (`supply/`) — adapters implement `SupplyAdapter` and are registered in
`supply/index.ts`. `hunter` reads Launchfly's `hunter_prospects` — a **shared** operator
table, so it is only offered to profiles with a `linked_business_id` and refuses to run
otherwise; `google_maps` runs the existing Apify scraper for each target segment in the
target area; `remote` calls an external supply service (see below). Candidates are upserted as
`source_kind = 'sourced'` with a `contact` and deduped on `(profile, source, external_id)` —
never by title. A deterministic `heuristicFit` (≤ 80) gives them a first score; the agent
then ranks them properly. Inferred (LLM) opportunities are capped at 70 so a guess can never
outrank a real business.

**Agent** (`agent/`) — one interface, three implementations picked by env: `webhook` →
`llm` → `starter`, with fallback to the starter so Today always renders. The context pack now
carries `candidates` (to rank, not invent) and `metrics` (to cite). Output carries `rankings`
and plan items may reference a candidate with a channel; those become send-ready executions.
The starter ranks heuristically, drafts a templated opener for the best reachable candidate,
and writes an insight from the real numbers — so the loop closes with zero API keys.

**Approve & send** (`execution.ts`) — an execution is a draft bound to an action, an
opportunity, a channel and a recipient. `POST /api/copilot/actions/:id/send` sends it through
the existing WhatsApp provider (per-business instance when `linked_business_id` is set, env
instance otherwise) or Resend. On success the action is done, a day-3 follow-up nudge plus a
drafted follow-up are scheduled, and the daily purge leaves them alone (they carry no
`agent_run_id`). Drafts can be edited in the sheet before sending, or cancelled.

**Outcomes** (`outcomes.ts`) — `copilot_outcomes` records reply / meeting / proposal / won /
lost / no_reply. `reconcileReplies` matches inbound WhatsApp (`chat_history`, role = user) to
sent executions by phone, with no change to the existing webhooks. Won with an amount
increments the primary currency goal and closes the opportunity. Everything feeds
`computeOutcomeAffinity` (reply and win rates per type, shrunk by volume) and `computeMetrics`,
which the read must cite. Replies trigger a push.

**Growth is measured, not guessed** — the tab used to render an LLM's invented
"skill level 0-100" as a progress bar, which reads as measurement and was not.
`diagnose.ts` replaces it with arithmetic over real rows: a funnel
(matched → drafted → sent → replied → meeting → won) with the worst-converting
step highlighted, a channel comparison, a source comparison, and a demand gap —
terms recurring across real matches that the offer never mentions. Three rules
it obeys: never show a number that was not computed; never compare without
`MIN_SAMPLE` (5) on both sides; when nothing can be concluded, say which step is
blocking instead of filling space. The agent now returns an empty `skills` array
and at most **one** lesson, which is dropped unless it carries a real URL — and
returning none is a valid answer.

**Context** — runway is two manual numbers on the profile (`finance`), shown in the read and
the metrics. The pipeline (opportunities + executions + outcomes) *is* the CRM; there is nothing
to connect. Calendar remains a foundation-only connector.

**Push** (`push.ts`) — Web Push via VAPID. `public/sw.js` gained `push` and
`notificationclick` handlers (additive; the fetch pass-through is unchanged). Urgent nudges and
detected replies notify subscribed devices. Silently off until keys are set.

## Offer — what every draft is built from

`copilot_profiles.offer` holds `{ sells, for_who, problem, price_band, proof_url }`. It is
asked for in onboarding and editable in You → Your offer. Openers are assembled from it, the
proof link replaces the vague "I can show you an example", and the agent prompt requires
messages in the user's own words. With no offer the template falls back to the headline and
stays deliberately vague rather than inventing a business. Nothing in the copy assumes an
industry, country, channel or company size.

## External supply agent

Supply can be outsourced without touching this app — an n8n workflow, or a small service
fanning out to Exa, Apify, job boards. Set `COPILOT_SUPPLY_URL` (and optionally
`COPILOT_SUPPLY_SECRET`) and the `remote` adapter calls it:

```
POST $COPILOT_SUPPLY_URL          Authorization: Bearer $COPILOT_SUPPLY_SECRET
{ "kind": "discover", "limit": 40,
  "profile": { headline, offer, location, target_segments, target_area, hunt_types } }

-> { "candidates": [ {
      "external_id": "stable-id-in-your-source",   // required — this is how dedupe works
      "title": "Acme Resort",                       // required
      "summary": "why this is worth a message",
      "type": "client|people|service|community|signal",
      "url": "https://…",
      "contact": { "name": "Maria", "whatsapp": "+63…", "email": "…", "website": "…" },
      "effort": "light|medium|deep",
      "data": { "anything": "kept for the agent" }
    } ] }
```

A bare array is accepted too. Everything is normalised and capped server-side: rows without a
title or a stable `external_id` are dropped, phones are normalised, unknown enums fall back.
Return facts, not adjectives — the agent scores and words them.

> Building the supply service itself — the contract, a runnable mock, and an
> importable n8n workflow — is covered in **[COPILOT_SUPPLY_AGENT.md](./COPILOT_SUPPLY_AGENT.md)**.

## External agent contract

`POST $COPILOT_AGENT_URL` with `Authorization: Bearer $COPILOT_AGENT_SECRET`:

```json
{ "kind": "daily_brief", "pack": ContextPack }
```

Respond with `BriefOutput` (or `{ "brief": BriefOutput }`). Types are in
`src/lib/copilot/types.ts`; the full shape and rules are in `agent/schema.ts` (`SYSTEM_PROMPT`).
The pack's `candidates` are real; return `rankings` for them. `metrics` are real; cite them.
Plan items with `opportunity_ref` + `channel` + `ai_draft` become send-ready drafts.
Output is normalised and capped server-side. This is where search, scraping and richer listing
discovery belong; to add a source inside the app instead, implement one `SupplyAdapter`.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/copilot/onboard` | profile + goal + targeting + context, cookie, first supply, first brief |
| GET | `/api/copilot/home` | everything for the three tabs and the You sheet: send queue, pipeline, diagnosis (demand with weekly trend and per-segment read), latest weekly Signals insight, metrics |
| POST | `/api/copilot/brief` | run the agent now |
| POST | `/api/copilot/supply` | find new matches: supply → reconcile → brief |
| POST | `/api/copilot/capacity` | `{ capacity }` |
| POST | `/api/copilot/context` | `{ content, kind?, regenerate? }` — "tell the copilot" |
| POST | `/api/copilot/goals` | create / update a goal |
| POST | `/api/copilot/targeting` | `{ target_segments, target_area }` |
| POST | `/api/copilot/offer` | `{ sells, for_who, problem, price_band, proof_url }` |
| POST | `/api/copilot/finance` | `{ monthly_burn, cash, currency }` |
| POST | `/api/copilot/opportunities/:id` | `{ status: saved \| dismissed \| acted \| new }` |
| POST | `/api/copilot/opportunities/:id/draft` | draft an opener onto today's plan, send-ready |
| POST | `/api/copilot/actions/:id` | `{ status: done \| dismissed \| open }` |
| POST/DELETE | `/api/copilot/actions/:id/send` | approve & send via API (only when the profile owns the channel) / cancel |
| POST | `/api/copilot/actions/:id/sent` | manual dispatch: "I sent it from my own app" |
| POST | `/api/copilot/outcomes` | `{ kind, opportunity_id?, action_id?, amount?, currency?, note? }` |
| POST | `/api/copilot/growth/:id` | `{ status: active \| done \| dismissed }` |
| POST | `/api/copilot/sources/:key` | mark a connector as requested (foundation) |
| POST | `/api/copilot/auth/magic-link` | `{ email }` — send a one-time sign-in link |
| GET | `/api/copilot/auth/callback?token=` | consume the link, set the cookie |
| POST/DELETE | `/api/copilot/push/subscribe` | register / remove a Web Push subscription |
| DELETE | `/api/copilot/session` | forget this device |
| GET | `/api/copilot/cron/daily` | scheduled loop (Bearer `CRON_SECRET`, fails closed) |

All copilot API responses are `Cache-Control: private, no-store` (rule in `next.config.ts`).

## Tests

```
npm run test:copilot
```

Pure-module tests: ranking (sourced/inferred rule, capacity plan selection, outcome-weighted
affinity), metrics, phone normalisation and heuristic fit, message templates, agent output
normalisation, starter agent, session signing.

## Quotas

Per profile, per day: 40 sends, 10 supply runs, 30 briefs. Onboarding is limited to 5 per IP
per hour and refuses when the device already has a copilot. Stored in `copilot_rate_limits`.

## Known gaps

- Email replies are not reconciled automatically yet (WhatsApp is); log them by hand on the match.
- Cross-user learning ("people like you get 12% replies with this angle") needs more than one
  user; `copilot_outcomes` is shaped for it.
- Calendar is a placeholder. Growth (skills / lessons) is still agent-authored, not derived from
  real job-post requirements.
- The Google Maps adapter spends Apify credits per run from the operator's token; it runs from
  the cron and the button, never on onboarding. Per-user billing does not exist yet.
- API sending needs a per-profile channel, and there is no UI to provision one — set
  `linked_business_id` / `email_from` and `send_mode` in the database. Manual dispatch is the
  path everyone else uses, and it is the default.
