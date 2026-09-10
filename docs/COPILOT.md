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
| UI (installable PWA) | `src/app/copilot/` (bold) and `src/app/lifeos/` (calm) |
| API | `src/app/api/copilot/` |
| Core | `src/lib/copilot/` |
| Schema | `supabase/migrations/20260903_copilot_foundation.sql` … `20260909_copilot_decisions.sql` |

## Which model writes the brief

Already configurable; nothing needs adding. `resolveLlmConfig()` takes the first
match:

| Set | Endpoint | Model |
| --- | --- | --- |
| `COPILOT_AI_API_KEY` + `COPILOT_AI_BASE_URL` + `COPILOT_AI_MODEL` | whatever you point it at | whatever you name |
| `OPENAI_API_KEY` alone | OpenAI | `gpt-4o-mini` |
| `DEEPSEEK_API_KEY` alone | DeepSeek | `deepseek-chat` |

**A deployment with only `OPENAI_API_KEY` set is running `gpt-4o-mini`** — the
oldest, weakest option in that table, and the default nobody chose. Setting the
three explicit variables costs a redeploy and no code.

The prompt is ~1,850 tokens of system rules plus ~7,550 of context pack, for
~9,400 in and ~2,000 out per brief, once per user per day. At solo scale the
cost difference between any two frontier models is cents a month, so choose on
reliability, not on price.

Reliability here means one thing: does the reply survive `normalizeBrief` and
obey the rules? A model that reasons well and wraps its JSON in prose is worth
nothing — the run falls back to the starter and nobody is told. Measure it
rather than guessing:

```bash
COPILOT_AI_API_KEY=sk-or-... COPILOT_AI_BASE_URL=https://openrouter.ai/api/v1 \
  npm run bench:models -- z-ai/glm-5.3-flash openai/gpt-5.6-luna
```

It runs the real system prompt through the real normalizer twice per model —
once normally, once with a blank offer — and scores what actually breaks. Two
checks are disqualifying: **survives normalizeBrief**, and **blank offer:
drafted nothing**. The second is invariant 1, and the reason this project has
44 unsent drafts in its history.

## The call

Every brief ends in one decision, not a list. The agent's output carries a
`decision` object — headline, `because[]` citing real numbers, `instead_of`,
`confidence`, `topic`, and the one `verify_metric` it stakes itself on — plus a
`dont`. Without those fields the model could only smuggle a decision into
`insight.body` as prose, where nothing can rank it, act on it, or check it
later. `src/lib/copilot/decision.ts` holds the pure half; `copilot_decisions`
holds the record.

```
    changed[]  ──►  DECISION  ──►  did / rejected / wrong / ignored  ──►  verdict
  (computed        (one move,       (the user, except "ignored")      (the ledger,
   from the         one trade-off,                                     3 days later)
   ledger)          one metric)
```

Four rules keep the record honest:

- **The floor is deterministic.** `starterDecision()` is a ladder over the same
  metrics the insight cites — a broken opener outranks an unsent queue, because
  sending more of a message nobody answers is the most expensive thing on the
  list. It runs when no model is configured, when the model fails, when the
  model returns no decision, and always when the offer is blank (the same rule
  that strips drafts written from nothing).
- **"Ignored" is inferred, never asked.** A call still pending when the next one
  arrives was ignored. Asking someone to self-report having ignored something
  produces a flattering record, and a flattering record cannot tell you which of
  your calls were wrong.
- **Grading is against the ledger.** The decision names one metric; the baseline
  is snapshotted when the call is made, and `gradeDecisions()` reads the same
  metric back `VERIFY_AFTER_DAYS` later. The metric window rolls, so a value can
  fall — the delta is the signal. Movement is only attributed to a call the user
  says they made.
- **"Low confidence" is a first-class answer.** `missing` then names the one fact
  that would settle it. A system that is never unsure is not being honest about
  a twelve-message sample.

Today renders **one** card for all of it. The call absorbs the primary action,
the "not today" line and the daily read (behind *See the read*) because the
first version shipped them as four separate blocks that all said the same
sentence — with a blank offer, "set your offer" appeared four times above the
fold. `starterDecision` never emits a `dont` for the same reason: every rung's
version merely restated `instead_of` in the imperative.

The compounding part is `topic`. `decisionReview()` groups by it, so the app can
say *"3 of your last 5 calls were about sending, and you have not done one of
them"* — a sentence no general model can produce about you, because it requires
the record of what this app told **you** to do and what you did about it.

The sweep runs at the top of `runBrief`, so the pack the agent reads already
knows which of its previous calls were ignored, and the prompt forbids simply
repeating a topic with that history. `DailyResult.brief.graded` reports the
sweep, which is how you can tell from outside the app whether the record is
being graded or merely accumulating.

## What to get better at

"Worth learning" asked the agent for an article with a working URL — the single
thing a model is least able to supply. It either invents the link, which breaks
invariant 2, or, told not to, returns nothing. Told not to, it returned nothing
almost every day, and the section sat empty on a product whose whole point is
compounding.

The gate was not the problem; the supply was. `growthEdge()` computes the
capability instead of fetching it, in priority order:

1. **From your calls** — a topic in the decision record acted on three or more
   times where the metric it named never moved. Repeating something that does
   not work is the most expensive gap there is, and nothing but the record can
   see it.
2. **From your funnel** — the bottleneck stage, named as a capability. Every
   stage has one now: `BOTTLENECK_TOPIC` had no entry for `drafted` or `sent`,
   so the most common bottleneck in this product produced the emptiest answer.
3. **From your matches** — the top opening the offer does not name.

Each carries evidence citing a number from rows the user created, and one
bounded experiment for the week rather than a reading list. `null` only for an
account with nothing measured yet — a real empty state instead of a permanent
one.

A lesson with a real URL still renders, underneath, as a bonus. It is no longer
the reason the section exists.
## Push

Three things had to be wrong at once for a notification never to arrive, and all
three were:

- **It only fired for *fresh* urgent nudges.** Urgent nudges are deliberately
  carried forward until acted on, so anything that persists — "follow up with
  Briones" — pushed once and was silent forever after. The nudges that mattered
  most were the ones that went quiet.
- **It fired from any brief, including the one that runs when the app opens.**
  A notification sent to somebody already looking at the screen is suppressed at
  best and noise at worst.
- **It never carried the decision**, which is the only thing here worth
  interrupting someone for. A count of nudges is not a reason to pick up a
  phone; "send the 7 drafts already written" is.

So: **one notification a day, from the cron only, carrying the call.** It falls
back to the top urgent nudge when there is no decision, and stays silent when
there is neither. `notifyPayload()` holds the rule and is pure, so the gates are
tested without a push service. `DailyResult.brief.pushed` reports how many
devices it reached, which is how you tell from outside whether push is working
at all.

Everything above depends on the cron running. Until it does, there is nothing to
notify anyone about — see **When the brief 504s** and the deploy notes in
`CLAUDE.md`. Check the keys are set at all with
`GET /api/copilot/health` → `capabilities.push`.

## Two shells, one app

`/copilot` and `/lifeos` are the same application. Same session cookie (`path:
'/'`), same database, same components, same three tabs — `src/app/lifeos/`
contains only a layout and four thin pages, all of which render the entries in
`src/app/copilot/_components/`. The single difference is `data-theme="soft"` on
`.cp-root`, plus Sora in place of Archivo:

| | `/copilot` | `/lifeos` |
| --- | --- | --- |
| Surface | 2.5px ink borders, hard corners | shadow and space, 24px corners |
| Nav | full-width black bar | floating white pill |
| Accent | `#2B3EF0` on `#FAF8F4` | `#4F63D2` on `#EEF1F7` |
| Face | Archivo | Sora |
| Manifest | `/copilot/manifest.webmanifest` | `/lifeos/manifest.webmanifest` |

Both install separately, so both can be lived with for a week and one of them
chosen. Switch between them under the header avatar → Copilot → **Look**.

The theme is one additive block at the end of `src/app/copilot/copilot.css`,
where every rule is scoped to `.cp-root[data-theme="soft"]` — the bold theme
cannot regress from anything the calm one adds, and a test in
`scripts/tests/copilot-core.test.ts` (`two-shells`) fails if a rule in that
block is ever written unscoped.

Anything that builds an in-app link or a redirect has to stay inside the shell
the viewer opened, or a tap on "Plans" silently changes the theme. The legal set
of shells lives in `src/lib/copilot/shell.ts` and nowhere else: `useShell()` for
hrefs on the client, `toShell()` to narrow the value a client sends before it is
concatenated into a Stripe `success_url`. One thing still lands on `/copilot`
whichever shell asked for it — the emailed magic link, whose target is fixed
when the token is written.

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
COPILOT_JOBS_URL=https://...        # external Move producer — any of the eight kinds
COPILOT_JOBS_SECRET=...
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
consumed once by `/api/copilot/auth/callback` — but only by its `POST`. The
`GET` the email links to merely checks the token and forwards to
`{shell}/auth/confirm`, because Gmail scans every URL in an email and Resend
rewrites them through `resend-links.com`; a token spent on `GET` is dead before
the recipient taps it. The button on that page is the only thing that spends
one, and `?shell=/lifeos` on the link brings the calm shell back. Requested from inside the app it verifies and
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
step highlighted, a channel comparison, a source comparison, and an openings read —
conditions recurring across real matches that the offer never names. Three rules
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

## Setting up the scheduled loop

Nothing in this app wakes up on its own until this exists. No overnight supply,
no brief waiting in the morning, no weekly Signals read, no push — every one is
downstream of the cron, and the cron has never run.

`vercel.json` is inert here (this is not a Vercel deploy), so the schedule has to
come from Coolify. Its **Scheduled Tasks** run a command *inside the container*,
which is the right place for it: the app is reached on localhost and Traefik is
never involved, so the proxy timeout that turns a long brief into a 504 does not
apply. The cron gets its full `maxDuration`.

Coolify → the application → **Scheduled Tasks** → add:

| Field | Value |
| --- | --- |
| Name | `copilot daily` |
| Command | `node scripts/copilot-cron.mjs` |
| Frequency | `0 21 * * *` |

No arguments. It reads `CRON_SECRET` (or `COPILOT_CRON_SECRET` — the route
accepts either, because insisting on the prefix is what kept this switched off)
and `PORT` from the environment the container already has, summarises the run
into one log line, and exits non-zero on failure so a broken schedule shows red
rather than quietly succeeding.

Check it without waiting for 21:00 — run it once from the container shell, then:

```sql
select kind, agent, status, finished_at from copilot_agent_runs
 order by started_at desc limit 10;
```

Rows with `kind = 'daily_brief'` and a `finished_at` mean the loop is alive. On a
Monday there should also be a `copilot_insights` row with `kind = 'weekly'`, and
a notification.

## When the brief 504s

A reasoning model on this prompt can spend 6,000-11,000 tokens thinking before
it answers. Observed on GLM-5.3-Flash through OpenRouter: generations of 75s,
120s, 185s, 318s and 335s, every one finishing normally and every one billed.
`/api/copilot/brief` allows 90s and the reverse proxy in front of it usually
allows less (Coolify/Traefik commonly 60s), so the request dies first and the
user sees a 504 having paid for a brief they never got.

`LlmAgent` is therefore bounded: **one attempt**, aborted at
`COPILOT_AI_TIMEOUT_MS` (default 30s).

**Two budgets, because there are two callers.** `budgetForReason()` picks them:

| reason | budget | env var | default |
| --- | --- | --- | --- |
| `cron` | the nightly run, started by `scripts/copilot-cron.mjs` against `127.0.0.1` | `COPILOT_AI_CRON_TIMEOUT_MS` | 120s |
| anything else | a tap — `manual`, `offer`, `note` — sitting behind the proxy | `COPILOT_AI_TIMEOUT_MS` | 30s |

The distinction is the whole point: **Traefik is not in the cron's path**, so
the ceiling that forces 30s does not apply to it. Sharing one number cost every
brief in production. `copilot_agent_runs` showed the cron healthy —
`200 in 220.7s — 2/2 profiles ok` — while every `llm` row read
`status = error`, `The operation was aborted due to timeout`, at exactly 30.0s
from `started_at`. The model was answering normally; this file was hanging up on
it. Every brief the user read for weeks was the starter fallback.

Two things now make that legible from the row alone, because the row is usually
all that is left: `input_summary.budget_ms` records what the run was bounded by,
and the abort is re-thrown naming the budget and the variable that sets it
rather than the SDK's bare "The operation was aborted due to timeout" — which
reads exactly like an endpoint rejecting the request, and was read that way.

Keep `COPILOT_AI_CRON_TIMEOUT_MS` under `/api/copilot/cron/daily`'s
`maxDuration` (300s), remembering it is spent **once per profile** and that
supply and reconcile run first.

That default is deliberately conservative. 55s was tried first, against a guess
that the proxy allowed 60, and it still 504'd — so the ceiling is lower than
that and had never been measured. Measure it:

```
GET /api/copilot/health?sleep=10   → JSON
GET /api/copilot/health?sleep=30   → JSON
GET /api/copilot/health?sleep=45   → 504   ← the proxy's real limit is here
```

Then set `COPILOT_AI_TIMEOUT_MS` under it. This measurement bounds the
interactive budget only; the cron's is bounded by `maxDuration`, not by the
proxy. The failure modes are not symmetric:
too low costs a starter brief and the client says so; too high costs a 504 with
the generation billed and nothing shown. The abort raises, `runBrief` catches it,
and the starter writes the brief instead — the fallback that already existed but
could never fire while the call hung. Keep the timeout below both `maxDuration`
and the proxy, so the starter still has room to run.

Cutting a reasoning model off is a poor fix by itself, so two knobs make it fast
enough to finish inside the window:

```
COPILOT_AI_EXTRA_BODY={"reasoning":{"effort":"low"},"provider":{"sort":"latency"}}
COPILOT_AI_MAX_OUTPUT_TOKENS=6000
```

`COPILOT_AI_EXTRA_BODY` is merged into the request body so endpoint-specific
knobs stay out of the code; invalid JSON is logged and ignored. Note that the
SDK speaks the **Responses API** (`input`, `max_output_tokens`), not Chat
Completions — worth knowing when comparing against a raw `curl`.

## Why long work returns partial instead of failing

`maxDuration` is what Next allows, not what survives. The reverse proxy in front
of this deployment gives up first — measure the exact ceiling with
`/api/copilot/health?sleep=N` — so any route that legitimately needs longer
cannot work synchronously however high `maxDuration` is set.

"Find new matches" is the worst case: `runDaily` scrapes up to three Google Maps
segments at up to 90s each, reconciles replies, then runs a brief — minutes of
work behind a door that shuts in under a minute, which is why it returned
**504**.

So the run carries a wall-clock deadline instead:

- `/api/copilot/supply` sets one `COPILOT_SUPPLY_BUDGET_MS` ahead (default 40s,
  leaving room for `loadHome` and the response).
- `runSupply` skips adapters once it passes, and flags `partial`.
- The Maps adapter stops **between segments** and shortens the last scrape to
  whatever is left, never starting one below `MIN_SEGMENT_MS`. Nothing is lost:
  the upsert dedupes on `(profile, source, external_id)`, so the next run
  continues where this one stopped.
- `runDaily` skips the brief when the budget is gone — whoever tapped the button
  wanted matches, and the next brief ranks them anyway.
- The toast says so: *"12 found so far — there was not time for every segment.
  Tap again for more."*

Raise `COPILOT_SUPPLY_BUDGET_MS` only after raising the proxy's own timeout;
otherwise it just moves where the request dies.
## The triage stack

One unjudged match at a time: **Draft it** or **Not for me**, by swipe or by
button. It lives on Pipeline and owns the `not_drafted` pile, which is no
longer also listed below it.

**Why a deck here and nowhere else.** A stack works when both answers cost the
same flick. That is true of exactly one judgement in this app — "is this
business worth messaging at all". It is emphatically not true of the send queue
or Today's call, where yes costs ten minutes and no costs a thumb; put those
behind a swipe and the cheap side wins every session, and you end up with a
cleared deck and nothing sent. Today's call is worse still: a deck of calls is
"a list of five good things", which is the thing the decision layer exists to
replace.

**What a swipe is allowed to teach.** A swipe is a *preference*; a reply is the
*truth*. `segmentKeepRate` turns the history into a per-segment keep rate and
`orderTriage` uses it to decide what comes up first — and that is the entire
blast radius. It never touches the decision record, Signals, or what counts as
an outcome. Invariant 5 is the same rule for the same reason. `MIN_TRIAGE_SAMPLE`
(5) keeps a rate from being one person's mood, the same floor `MIN_OPENING`
applies to openings.

Every gesture has a button beside it — a deck answerable only by dragging is
unusable one-handed or with assistive tech. Both answers are recorded: a keep
rate built only from keeps is not a rate.

**The metric that decides whether this stays: sends per session, not swipes per
session.** If swiping goes up and sending does not, it made the app feel better
and changed nothing, and it should be reverted.

## Moves and Jobs

A **Move** is a finished piece of work with something concrete attached. A
**Job** is what produces one.

This exists because the app could make exactly one kind of action — a WhatsApp
opener — and after weeks its own author had sent zero of them. Not a discipline
problem: the only move on offer was not one he wanted to make. `MOVE_KINDS` is
`earn | spend | build | fix | learn | meet | decide | avoid`, and outbound is
one of eight.

**The load-bearing rule is the artifact.** `isDeliverable()` in `moves.ts`
drops any draft without one, because a row saying "you should contact them" is
advice, and advice is the one thing a chat window already gives away. A row
carrying the drafted message, the link or the file is work that was done. Same
reasoning as a lesson with no URL not rendering.

A Job is `SupplyAdapter` widened: `available()` says whether the sensor is
connected, `run()` does the work and returns drafts. Register it in
`jobs/index.ts`. `runJobs` upserts on `(profile_id, job, external_id)` with
`ignoreDuplicates`, so a nightly rerun over the same source row produces no
second card — and a Move already answered stays answered.

`available()` is contractually **cheap** — profile and environment only. It is
asked for every job on every home load, and it must never call `ctx.sense()`.

### The registry

The registry is the product. A list with one entry is that action's tool,
whatever the landing page says.

| Job | Kind | Sensor | Model? |
|---|---|---|---|
| `send_queue` | `earn` | a non-blank offer | no |
| `client_delivery` | `build` | linked `sales` table | no |
| `repeat_customer` | `earn` | linked `sales` table | no |
| `runway_guard` | `decide` | `finance.cash` + `monthly_burn` | no |
| `opening_gap` | `decide` | `target_segments` | no |
| `capability_gap` | `learn` / `avoid` | onboarding complete | no |
| `remote` | any of the eight | `COPILOT_JOBS_URL` | remote's business |

Not one of them calls a model. Every line of evidence is a number the app
counted or a value the user typed, which is the only reason a Move can cite
something and be believed.

`spend`, `meet` and `fix` have no built-in job on purpose. Finding the laptop
you wanted at a price, quoting three suppliers, or fixing the n8n node that is
dropping enquiries needs a searcher, a browser or a builder — not a request
handler. Those arrive through `remote`, below, and the app does not pretend
otherwise.

### The Call is picked, not written

For months there were two production paths that never met: the brief wrote a
`Decision`, the jobs wrote `Move`s, and `loadHome` put the Decision on top
whatever it said. Since `starterDecision` has seven branches and all seven are
outreach branches, the Call was "send the drafts" on a morning when somebody who
paid three months ago was still waiting to hear from anyone. Not a ranking bug —
there was no ranking.

Now every Move declares a **stake** (`stake.ts`) and the Call is simply the Move
that wins. Outreach is `send_queue`, a Job like any other, and has to earn the
top of the screen the same way a runway decision does.

The ladder, in `call.ts`:

1. A blank offer forces the offer call (invariant 1 outranks everything here).
2. The winning Move, when one clears `CALL_FLOOR` — it is grounded in a real row
   and carries an artifact, which prose does not.
3. Whatever the agent wrote.
4. `starterDecision`'s ladder, so Today always leads with one move.

`scoreMove` is four bounded factors, each explainable in a sentence: the **kind
prior** (used only when nothing better is known, and derived from `KIND_ORDER` so
there is one opinion about kinds in the codebase), **money** against monthly burn
(capped, so a named number always outranks a guess but never runs away with the
day), **urgency** from the stake's `withinDays`, and **fit** against the capacity
the user set. The absolute number means nothing; only the order does.

Two consequences worth knowing:

- **`instead_of` stopped being a sentence somebody wrote.** It is the runner-up,
  named. The app can only claim it chose this over something if there was
  something.
- **The Call carries the work.** A `Decision` has no artifact of its own, which
  is why its button used to say "open the queue" rather than being the queue.
  `source_move_id` links the two; `isDeliverable` guarantees the Move has one.
  Answering the Call closes the Move, so it never reappears in the stack below.

`BUSINESS_METRICS` is the vocabulary a call may stake itself on. It was the
outbound funnel and nothing else, so a runway call could only pick `'none'` —
ungradeable, therefore never learned from, therefore the decision record could
only ever teach the app about sending. `queue` and `runway_months` are the first
two that are not funnel metrics, and both are there because `metricValue` can
read them back out of `Metrics` today. **A metric nobody can read back is not a
stake, it is a promise** — that is the bar for adding one.

`METRIC_GOOD_DIRECTION` exists because good is not always up: "clear the queue"
succeeds when the number falls, and `verdictOf` graded that as `no_movement`
until it was told otherwise.

### ctx.sense() — reading what the app already worked out

`opening_gap`, `capability_gap` and `runway_guard` say things like "seven of
your own matches have this in common". That number comes from `JobSense`
(`jobs/sense.ts`): the same `diagnose()` / `growthEdge()` / `loadMetrics()`
pass `loadHome` uses, so a Move and the Signals tab can never disagree about
what the funnel says.

It is lazy and memoised per run — six jobs asking still costs one pass, and
jobs with their own sensor never pay for it.

### Ordering

`orderMoves()` in `moves.ts` decides what leads the screen: `earn`, `build`,
`fix`, `decide`, `avoid`, `spend`, `meet`, `learn`, newest first within a kind.
This is deliberately not the declaration order of `MOVE_KINDS`, which is the
shape of the check constraint. With one job the ordering was academic; with
six, `created_at` alone means whichever job finished last leads, so a reconnect
worth real money sits under a tutorial link written a second later.
`loadMoves` reads four screens' worth and lets this pick, so re-ordering never
needs a migration.

### client_delivery — the first non-outbound job

Somebody paid; nothing happened since. It reads Launchfly's own `sales` table,
which lives in the same Supabase project the copilot already connects to, so it
needed **no new integration** — the sensor was always there. That is the shape
later jobs should copy: a real event in data the user already owns.

It uses **no model**. The message is a template, so it is deterministic, free,
under test, and cannot invent a purchase that did not happen. Two details that
came out of looking at it in a browser rather than reading the JSX:

- `greetingName()` addresses three-or-more-word names whole. First-naming
  "Cebu Pest Pros" produced "Hi Cebu", which reads as a mistake to the one
  person who matters.
- It is deliberately **not** gated by `offerIsEmpty`. Invariant 1 exists
  because an opener to a stranger written from a blank offer describes a
  business the user never described; this message is grounded in a purchase
  that actually happened.

The cron reports `moves` per profile, and `copilot-cron.mjs` sums it into the
one log line — the number that says whether the non-outbound half did anything.

## What the agent gets to read

`buildContextPack` is the only place "more data in" becomes "more context for
the agent". Three of its fields carry text, and all three were sitting in the
database for months before anything read them.

| field | source | why it is not something a model can know |
| --- | --- | --- |
| `replies` | `copilot_outcomes.note`, written by `reconcileReplies` | what a real prospect wrote back to a message this person actually sent |
| `sent` | `copilot_executions.body` joined to reply outcomes | which openers got an answer and which were ignored |
| `openings` | `openingTrend()` over the user's own sourced matches | conditions counted across their live pool, already filtered to what the offer does not name |

**Openings are not demand, and the difference is load-bearing.**
`openingsOf()` reads two arrays off a matched listing: `tags` and
`pain_signals`. Both are written by a scraper ABOUT the prospect —
`no_website`, `few_reviews`, `low_rating`, `running facebook ads`. Nobody asked
for any of them.

For months this was computed correctly and labelled backwards: Signals headed
it "What they keep asking for", the sheet offered "Add it to what you sell", and
`growthEdge` returned `selling no website`. The measurement was real and the
frame around it was false, which is worse than not having it — the tab was
unreadable and the offer edit produced a business nobody runs.

The rule now, enforced in three places: the term goes into `offer.problem`
(what you fix), never `offer.sells` (what you sell) — `addOpeningToOffer` is
the only writer and it targets `problem`; the prompt tells the model in as many
words that nobody asked for these and that it must never write "clients are
asking for X"; and tests assert no demand language survives in the finding, the
edge, the weekly push or the Move.

An opening's real use is the FIRST LINE of a draft. "You are running ads into a
WhatsApp nobody answers after six" is why a stranger keeps reading; "clients are
asking for no website" is why they stop.

**Replies were the expensive omission.** `reconcileReplies` matched inbound
WhatsApp messages by phone and selected `phone, created_at` — so the system knew
*that* someone replied and never once knew *what they said*. The body now rides
along on the same match: it is only ever read for a phone this profile itself
sent to, after its own `sent_at`, which is what keeps one user's inbox out of
another's pack.

**Both halves or neither.** `selectSentExamples` returns replied *and* ignored
openers, capped separately (`MAX_SENT_PER_BUCKET`). A model shown only the ones
that worked concludes that everything works. Silence counts only after
`NO_REPLY_AFTER_DAYS` (3) — a message sent yesterday and unanswered is pending,
not a result, the same rule `gradeDecisions` applies to a call.

**Budget.** The pack is serialised whole into the prompt (`userPrompt`), so
every field costs tokens on a model that already needs two minutes. Worst case
these three add ~5.6KB (~1,400 tokens) to a ~9KB pack — negligible for latency,
which is dominated by 6-11k *reasoning* tokens, but the caps in
`conversations.ts` are why it stays that way. Raise one and it is the metrics
the decision has to cite that get pushed out.

Adding a field is not enough on its own: `SYSTEM_PROMPT` has a section per
field, and a field the prompt never names is a field the model ignores. A test
asserts those sections stay.

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

## External jobs — any kind of Move, produced elsewhere

The same seam as external supply, one level up. Supply asks "which businesses
should I message"; this asks "what is worth doing", and the answer can be any
of the eight kinds. Set `COPILOT_JOBS_URL` (and optionally
`COPILOT_JOBS_SECRET`) and the `remote` job calls it on the nightly run:

```
POST $COPILOT_JOBS_URL            Authorization: Bearer $COPILOT_JOBS_SECRET
{ "kind": "moves", "today": "2026-09-09",
  "profile": { name, headline, offer, location, timezone, capacity,
               target_segments, target_area, hunt_types } }

-> { "source": "n8n",                              // optional; namespaces the ids
     "moves": [ {
       "external_id": "mbp-14-listing-882",        // required — this is how dedupe works
       "kind": "spend",                            // required — one of the eight
       "headline": "MacBook Pro 14 M4, ₱82,000 — below the ceiling you set",
       "why": ["You said under ₱90,000.", "Seller 4.9 over 300 sales."],
       "artifact": { "kind": "link|message|text",
                     "label": "View the listing",
                     "value": "what was found, or the drafted message",
                     "href": "https://…" },        // required when kind is link
       "cost_label": "₱82,000"
     } ] }
```

The payload that leaves the deployment carries **no identity** — no id, no
email, no phone, no billing (`profileForRemote`).

Nothing coming back is trusted. `normalizeRemoteMove` drops anything without a
stable id, a known kind, at least one `why` line, or an artifact with content —
then `isDeliverable` applies the same floor again. A bad workflow can put
nothing on the screen; it cannot crash the run and it cannot write advice.

This is where the examples that need a searcher live: the laptop you wanted at
a price, three suppliers quoted, the person worth an hour, the n8n node that is
dropping enquiries, the page put up for the new offer.

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
| GET | `/api/copilot/home` | everything for the three tabs and the You sheet: send queue, pipeline, diagnosis (openings with weekly trend and per-segment read), latest weekly Signals insight, metrics |
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
| POST | `/api/copilot/decision` | `{ response: did \| rejected \| wrong }` — what you did about today's call |
| POST | `/api/copilot/growth/:id` | `{ status: active \| done \| dismissed }` |
| POST | `/api/copilot/sources/:key` | mark a connector as requested (foundation) |
| POST | `/api/copilot/auth/magic-link` | `{ email }` — send a one-time sign-in link |
| GET | `/api/copilot/auth/callback?token=` | consume the link, set the cookie |
| POST/DELETE | `/api/copilot/push/subscribe` | register / remove a Web Push subscription |
| DELETE | `/api/copilot/session` | forget this device |
| GET | `/api/copilot/health` | what this deployment actually has: missing env vars by name, unapplied migrations by file (session or cron bearer) |
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
