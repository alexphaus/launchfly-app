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
| UI (installable PWA) | `src/app/copilot/` (bold) and `src/app/lifeos/` (calm) — two tabs; `src/app/copilot2/` — four tabs, calm |
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

**A call that cannot be saved is a call that never existed.** `verify_metric`
was pinned by `20260909` to the six funnel metrics. `20260911` widened
`BUSINESS_METRICS` to eight — `queue` and `runway_months` are the whole point of
arbitration — and did not touch the constraint. So every Call promoted from
`send_queue`, `runway_guard` or `obligations` failed `23514` on write, was
swallowed into a `console.error`, and Today rendered the insight instead. The
insight row saved, so `needsBrief` was false and opening the app never retried
it. Fixed by `20260920`; the guard is in `copilot-schema-check.sql`, which now
diffs constraint CONTENTS against the code rather than only checking that
columns exist. **If the Call is ever missing again, look there first.**

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
'/'`), same database, same components, same two tabs — `src/app/lifeos/`
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

A third shell, `/copilot2`, is a different *layout* rather than a different
theme — four tabs, calm only — over the same data and actions. See **Four tabs**
below. Its settings link back to `/lifeos`, and `shellOf` keeps every in-app link
inside it (`/copilot` is a prefix of it, so the boundary is tested).

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

## Two tabs

Two questions, two tabs: **Now** (what do I do) and **Working?** (is it working).

### Three zones on Now, and the axis is the point

```
   the call            one decision, alone, no header above it
   also needs you      confirm, jobs waiting on you, the deck, the queue,
                       and the one input the scrapers cannot supply
   since you last      running jobs, finished Moves, what is in motion
   looked
```

Before this, Now was grouped by **feature** — handed-over jobs in one section,
Moves in another, the queue below that, the composer near the top — while the
question somebody has when they open it is temporal: *what needs me* and *what
happened while I was away*. So the screen alternated between asking and
reporting four times on the way down, and a job sat in whichever block its
feature owned regardless of which of the two it was. `splitThreads` is the whole
idea in one function: `needsYou` (blocked or draft — an unapproved mandate is
waiting on a person), `running`, `finished`.

Three rules keep it legible:

- **The call stays outside zone two.** It is one decision, and a header above it
  announcing that three things need you is the dilution the single-call design
  exists to prevent.
- **A zone header contains; a sub-header is contained.** "Done while you slept"
  and "Since you last looked" are the same sentence, so the first one is gone;
  the deck and In motion are `cp-section sub`, with a smaller, dimmer marker.
  At equal weight three stacked headers made the zone header read as a third
  peer and the grouping was invisible.
- **Zone three's header stays when the zone is empty.** "Nothing came back" is
  itself the report — the same reason the Moves block says so out loud. It also
  carries the way in to handing work over, which for months existed only four
  taps inside a saved goal.

**Finished jobs are not on Now.** They live on Working?, beside the decision
record, because a finished job with an outcome *is* a graded call and "did that
work" is the only question that tab asks. A card reading "done" for a fortnight
in the middle of the one screen meant for deciding what to do next is the screen
congratulating itself.

Pipeline was the third and every part of it already existed somewhere else. Its
send queue was Today's send queue read a second way — the two rendered from
different queries and disagreed on screen, 40 against 42. Its triage deck is one
card on Now. Its stage groups are what the funnel on Working now opens into.

**The funnel is the navigation.** Every bar is a button into the businesses at
that stage, oldest first (`StageSheet`), which is what stops it being a picture
you look at once. `STAGE_OF_FUNNEL` maps the two vocabularies in one place.

**The queue is one draft at a time** (`QueueSheet`), not a list. It was a list —
forty rows on Today, forty-two on Pipeline — and 45 of 54 drafts were never sent.
A list of forty-five is a decision about forty-five things, and the reliable
answer to a decision that size is to close the app. The message is on screen,
because approving text you cannot see is not approval.

**What Now dropped:** the metrics strip (moved to Working — above the day's one
decision it said "this is an outreach tool" every morning), the forty-row queue,
the "drafts waiting" chip, and the separate "Next actions" list, which is now
folded into "Also today" with the plan. Two nudges went with them: the starter's
"N drafts waiting for approval" and "runway is N months" both restated a card
that now carries the same fact plus the way to act on it.

Old deep links still work: `TAB_ALIAS` maps `today`/`pipeline` → `now` and
`signals` → `working`, so an installed shell and the weekly push keep landing
somewhere sensible.

## Four tabs (`/copilot2`)

A second layout over the same app: **Today**, **Matches**, **Work**, **You**.
Written from its owner's own verdict on the two-tab version after living with it —
"too many things, nothing that stands out, the purpose lost from the original
mock-ups; Working? is a log" — and his brief for what each tab should be.

It is a layout, not a fork. `useCopilot` (`_components/useCopilot.ts`) holds the
state, the sheet stack and every action, and both `CopilotApp` and `CopilotApp2`
render over it, so sending, closing a mandate or answering the call cannot
behave differently between them. Every sheet is shared. `/copilot` and `/lifeos`
are untouched, so the two can be installed side by side and the one that gets
opened wins — the same reasoning that kept `/lifeos` beside `/copilot`.

| Tab | The question | What is on it | Pure module |
| --- | --- | --- | --- |
| Today | what do I do, and what did it do while I was away | the call (`CallCard`, unchanged) · done for you · needs you · worth doing (≤ 3) · the composer | `today.ts` |
| Matches | who is worth contacting | the queue as one strip · chips (Clients, Gigs & jobs, People, Signals) · every find, newest first | `matches.ts` |
| Work | what am I building | the offer · the path to money · the agents · projects handed over · the brief for Claude | `machine.ts` |
| You | how is it going | money, runway, deep work, replies · the week read back · goals · settings | `review.ts`, `focus.ts` |

`derive.ts` computes all of it once per `HomeData`, from `generatedAt` rather
than the clock, so the header's status line and the tab under it cannot disagree
(the old header said 61 over a card saying 51) and the server render and the
hydrating client agree across an hour boundary.

**Each Move lives in exactly one place.** Below the call, Today renders rows,
not cards — only the call gets a card, which is how nine blocks became four.
`worthDoing` keeps a Move out of Today when it belongs somewhere else: a watched
feed's find is on Matches, the send queue is its own row in Needs you, a
mandate's blocked question is its row in Needs you too, and a plan the app offers
to carry out is a project on Work. A test asserts the split.

**Done for you** is the part the old Now never had. The product's promise is an
app that works while you sleep, and nothing on the screen said what it had done.
Every row is something the app produced in the last day and a row proves it: new
matches, replies `reconcileReplies` matched (`source = 'system'` only — a reply
typed in by hand is the user's work, and reporting it back as done *for* them is
the screen taking credit), the watcher's row from `motion`, project progress by
the plan's own count, Moves worked out. A nightly job that never ran replaces the
list rather than sitting above it; a sensor that broke is said.

**Matches is the deck laid flat, and it still learns.** Businesses are answered
through the triage route, so "Draft opener" and "Not for me" feed the same keep
rate; `draftFromMatch` opens the new draft straight away, because a match you
chose and a draft you then have to find in a queue of fifty are two decisions and
the second is where drafts go to wait. The queue gate survives: with the queue
backed up, the first tap on Draft states the trade-off and the second proceeds —
the pattern "Find new" already used. No percentages: the fit score orders the
list and is never printed, because a "92% match" badge is a guess dressed as a
measurement (invariant 2).

**Work is an illustration with one rule: every part is drawn from rows.** Four
stages — find, reach, convert, get paid — from the funnel's own counts, with who
runs each and the one weak link placed on the part of the business it belongs to.
Five agents — Scout, Watcher, Writer, Researcher, Planner — whose state is when
they last actually ran and what they last produced, always with its word
(`AGENT_STATE_LABEL`), never a coloured dot alone. A Researcher with no worker
connected says "needs setup" rather than looking busy; a Writer on a blank offer
is setup, not idle (invariant 1). Handed-over work finally has a home here.
"Build with Claude" is the handoff route's text with one task line on top: the
app exports what it knows instead of competing with a model on building, which
is what DIRECTION.md already decided.

**You asks three questions of the week** — what created value, what was wasted,
what has to change — and answers each from rows (`weekReview`). Money is never
summed across currencies; a queue is waste only once it has sat
(`STALE_DRAFT_DAYS`); a job key is never printed (`phrase.ts`, which also fixed
"calls about send_queue" on the old Working tab's export path). An empty block
says why it is empty, and `recent.unreadable` names any read that failed, so a
broken read never renders as a quiet week (invariant 13). The funnel, openings
and segments left the tab; the funnel is still one tap away as the path to money
on Work, and "Ask your own record" still answers by counting.

**Deep work is the one new sensor.** It was asked for and nothing could supply
it, so it is logged by hand (`POST /api/copilot/focus`) and stored as
`copilot_events` rows of type `focus_logged` — no migration. Not a context item,
deliberately: those are read into the brief newest-first under a cap, and a log
line a day would push the user's own notes out of it. Future days are refused
rather than clamped, and nothing older than the week the tile shows can be
logged. Not yet read by the ranker.

`HomeData` gained two fields for this: `recent` (the last fortnight of outcomes,
answered Moves and deep work, from `loadRecentRows`) and `generatedAt`.

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
COPILOT_JOBS_URL=https://...        # the worker: external Move producer AND commission contractor
COPILOT_JOBS_SECRET=...
COPILOT_INBOUND_SECRET=...          # what a worker posts results back with (falls back to COPILOT_JOBS_SECRET)
#   Two payload shapes arrive at COPILOT_JOBS_URL and the `kind` field says which:
#
#     { "kind": "moves", ... }       -> { "moves": MoveDraft[] }   unsolicited suggestions
#     { "kind": "commission", ... }  -> a job order. Carries commission_id, objective,
#                                      `may` / `may_autonomously`, budget_minutes, plan,
#                                      result_url, who (incl. who.working) and `log`.
#                                      Answer inline, or 202 and POST to result_url
#                                      later — long work is expected.
#
#   READ `log` BEFORE ASKING ANYTHING. It is the tail of this mandate's own history,
#   oldest first, and it is where the user's answer to your last needs_you arrives:
#     [ { "kind": "needs_you", "summary": "Which of the three?", "at": ... },
#       { "kind": "answered",  "summary": "The second one.",     "at": ... } ]
#   Without it every dispatch was byte-identical, so a worker re-asked the same
#   question every night and no commission that needed its owner could finish.
#   `who.working` is the user's working file — how they deliver, what they charge,
#   what they will not do — and is absent for an account that has not written one.
#
#   Post work back to result_url (Bearer COPILOT_INBOUND_SECRET):
#     { "events": [ { "kind": "found"|"worked"|"needs_you"|"blocked"|"done"|"failed",
#                     "step": 2, "summary": "...",
#                     "artifact": { "kind": "link", "label": "...", "value": "...", "href": "..." } } ],
#       "plan": [ { "n": 1, "do": "...", "state": "done" } ] }
#
#   `status` in that body is parsed and DISCARDED. The commission's state is computed
#   from the events (see nextStatus) because a worker must not mark its own homework,
#   and a needs_you always outranks a done. `may_autonomously` is false for `reach` and
#   `commit`: report what you WOULD do as needs_you rather than doing it.
#   `answered` is NOT postable here — it is the user's line, written only when they
#   answer in the app. A worker that could post one would clear its own gate.
#  or
OPENAI_API_KEY=... / DEEPSEEK_API_KEY=...
COPILOT_AI_API_KEY / COPILOT_AI_BASE_URL / COPILOT_AI_MODEL

# Real supply
APIFY_API_TOKEN=...                 # Google Maps adapter (same token Launchfly uses)
EXA_API_KEY=...                     # source DISCOVERY only — /api/copilot/watch/discover
#   Without it the Sources sheet still works; the "Find them for me" button says the
#   deployment does not have it and the user adds feeds by hand, as before. Exa is
#   never asked what to DO — only where to look. It returns pages, those are turned
#   into feed URLs deterministically (the site's own <link rel="alternate">, or
#   normalizeSourceUrl), and every candidate is fetched and parsed before the user is
#   offered it. Nothing it returns can reach a Move. Same key Launchfly's agent uses.

# Approve & send
ULTRAMSG_INSTANCE_ID / ULTRAMSG_TOKEN     or   EVOLUTION_BASE_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE
RESEND_API_KEY=... COPILOT_EMAIL_FROM="Alex <alex@yourdomain>"   # email channel and sign-in links (falls back to FROM_EMAIL)

# Push
COPILOT_VAPID_PUBLIC_KEY / COPILOT_VAPID_PRIVATE_KEY / COPILOT_VAPID_SUBJECT   # node scripts/copilot-vapid.mjs

# Cron
CRON_SECRET=...                     # REQUIRED for /api/copilot/cron/daily — it fails closed without one
#   On the profile's Monday the cron also writes the weekly Signals read (copilot_insights.kind='weekly')
#   and pushes it, deep-linking to /copilot?tab=working. Idempotent per ISO week.
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

## The working file — the offer's other half

`copilot_working` (20260917) holds what the app knows about the business rather than what it
can guess. The offer above is five strings — a headline — and until this existed every draft,
every judged feed item and every commissioned piece of research was written from those five
strings, which is why the output read like a template however good the model was: there was
nothing specific for it to be specific about.

Six sections: `deliver`, `price`, `works_for`, `tried`, `refuse`, `voice`. `tried` and
`refuse` earn their place on their own — an app that does not know outreach on Instagram
already failed, or that this person will not take retainers under $100, proposes both
forever.

**Two sources and never a third.** `you` is the user's own statement, true because they said
so, live immediately and carrying no evidence — they are the evidence. `observed` is computed
from their rows and carries the count that makes it true. There is no `inferred`: the app
does not form a view about somebody's business and feed it back to itself as context, which
is invariant 2 at the level of prose rather than numbers.

Observed readings are written by `runJobs` on a full nightly pass (never on an on-demand
run), upserted on `(profile_id, observed_key)` so recomputing the same sentence updates one
row instead of stacking it. They arrive as `proposed` and **never reach a prompt** until the
user confirms them — a computed fact is still the app's reading, and the person who lived it
gets the last word. A declined reading is kept, not deleted, so it is not proposed again next
week.

`workingBrief()` renders the live entries and is read by `buildContextPack` (so the daily
brief sees it) and by `watchBrief` (so the feed judge scores items against the business
rather than the headline). Observed lines carry their evidence into the prompt too, so a
model can tell a count from a claim.

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
| `goal_gap` | `decide` | onboarding complete | no |
| `client_delivery` | `build` | linked `sales` table | no |
| `repeat_customer` | `earn` | linked `sales` table | no |
| `runway_guard` | `decide` | `finance.cash` + `monthly_burn` | no |
| `opening_gap` | `decide` | `target_segments` | no |
| `capability_gap` | `learn` / `avoid` | onboarding complete | no |
| `silence` | `fix` | onboarding complete | no |
| `obligations` | `decide` | typed rows | no |
| `watch` | any | an active feed | yes — to judge each item |
| `commission` | `decide` | `COPILOT_JOBS_URL` | no — it dispatches |
| `propose` | any | a model, and onboarding | yes — one call a night |
| `remote` | any of the eight | `COPILOT_JOBS_URL` | remote's business |

Only two call a model, and neither of them writes a number. `watch` judges
whether an item is worth the morning; `propose` writes an objective and a plan
and is told never to state a figure, because `whyFor` computes every line of its
evidence from rows. Everything else here is arithmetic the app did or a value the
user typed, which is the only reason a Move can cite something and be believed.

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

### Jobs before the brief. Always.

`runBrief` picks the Call by arbitrating over the OPEN Moves. If the jobs that
write today's Moves run afterwards, the Call is decided from yesterday's
leftovers — and on a morning when those were all answered, from nothing, which
falls through to `starterDecision`, every branch of which is outreach.

That shipped. `/api/copilot/brief` — the "Run agent" button — ran the brief and
then the jobs, so arbitration was merged, live, and could never fire: the app
went on saying "send the 45 drafts already written" for a fifth morning while the
Move that should have won sat in the list underneath it. Nothing in the type
system catches an ordering bug.

Both callers now go through **`runJobsThenBrief`** in `daily.ts`, so the two
orders cannot drift apart again. Anything new that produces a brief must use it.

### A no that is heard, and one that is kept

`refusalsByTopic` counts recent `rejected` and `ignored` responses per topic, and
`scoreMove` multiplies by `REFUSAL_DECAY ** n`. Past `MAX_REFUSALS` a job is
barred from leading — it stays in the stack, because the work is still real, it
just cannot be the Call again — and the winner's evidence says so once.

**But a refusal expires after `REFUSAL_WINDOW` decisions**, which is right for a
mood and wrong for a conclusion. Somebody who has sent forty-four openers, got
nothing back and decided outreach is no longer their leverage was asked again ten
days later, every time, forever. That is the loudest complaint this product has
had about itself, and it is why "Not doing it" is now two answers:

| | what it means | where it lives | expires |
| --- | --- | --- | --- |
| Just not today | a mood about one card | `copilot_decisions.response` | after `REFUSAL_WINDOW` |
| Stop suggesting this | a conclusion about a kind of work | working file, `refuse` | never |

A standing refusal is a row in the working file's **`refuse`** section, keyed
`stand-down:<job>`. Not a new table, and the reuse buys three things: the user
sees every stand-down in the one place that already means "what you will not
do", lifts one by deleting the line, and the prose reaches the brief, the
per-source judge and any commissioned worker through `workingBrief` — so the
whole product hears it, not only the ranker.

It bars in three places, and it needs all three. `scoreMove` bars it from
leading; `runJobs` stops the job producing at all, because "stop suggesting
this" plainly means stop making the card; and `starterDecision` honours it too,
because barring a job means arbitration promotes nothing, which falls through to
exactly that ladder — six of whose seven rungs are outreach. Without the third,
standing down the queue bought one quiet morning and then the starter proposed
the queue.

### The ledger's own verdict

`decisionReview().deadTopic` — acted on three or more times, and the metric it
named never moved — was computed, shown on the Working tab, and read by nothing
that decides anything. It now reaches `scoreMove` as `DEAD_TOPIC_DECAY`, harsher
than a refusal, and the asymmetry is the point: a refusal is an opinion about a
suggestion, this is the ledger on one that was actually carried out. The ranker
reads `RANKING_WINDOW` decisions rather than ten, because "you did this and
nothing happened" does not stop being true because a fortnight passed.

### Work it offers to take off you

Every surface on Now was something the app **found** and the user **does**:

| | who finds it | who does it | button |
| --- | --- | --- | --- |
| the Call | app | you | Did it / Not doing it / Wrong call |
| a Move | app | you | Did it / Not this one |
| a mandate | **you** | app | *type it into a blank box* |

The gradient was inverted. The one thing that asks least of somebody to carry
out asked most of them to conceive — and the app's only real edge, knowing which
of forty things matters from this person's own rows, was spent on work they then
did themselves and withheld from the surface where it would do the work for
them. "Put something to work" is also, precisely, what you can already get by
typing into a chat window, which makes it the worst place in the product to ask
for effort.

**A proposal is a Move, not a fourth surface.** The shapes already matched:

```
MoveDraft   job, kind, headline, why[], artifact, cost_label, stake
Commission  objective,     why,  plan[], budget_minutes, goal_id
```

`headline` is the objective, `why[]` the reason, `cost_label` what approving
costs *you*, `stake` the goal it claims to move — and the plan is the artifact.
`ArtifactKind` gains `plan`, carrying `steps[]` alongside the readable `value`.

**That is also why it cannot be noisy.** It enters the pool `arbitrate()` already
ranks, so it either wins and *is* the Call with a different verb, or it places
among the Moves, or it is under `CALL_FLOOR` and nothing renders. Measured
against a send queue seven days from stale: 0.90 to 3.00, so urgent real work
still leads. On a 20-minute day the proposal doubles its standing — it costs a
tap, the queue costs 45 minutes — without taking the day. It leads against a
two-hour `learn` with no stake, and it leads once the queue is stood down. The
permanent "Hand something over" button, saying the same thing every morning
forever whether or not anything is worth handing over, is the noisy design.

**The model writes WHAT; the job writes WHY.** `proposeJob` asks for an objective
and 2–5 plan steps and is told never to state a number. Every `why` line is
computed by `whyFor` from rows — the goal gap, the funnel, the runway, the worth
ledger — so it never passes through a model at all. Invariant 2 made structural
rather than promised. The prompt carries the two things a general model cannot
have: what has already been handed over, and what the user has stood down.

**Four gates before it spends a model call** (`shouldPropose`): an active goal,
because a proposal with none is the app inventing a direction for somebody's
business; `MAX_ACTIVE_COMMISSIONS`; one open proposal at a time; and silence once
`QUIET_AFTER_WORTHLESS` mandates have closed worth nothing. That last one reads
the `commission` worth record, because "was handing this over worth anything" is
the same question a proposal asks you to bet on again — and it stops the card
being *made*, which is stronger than ranking it down.

Its job key is `propose` and deliberately not `commission`. `runJobs` bars a
stood-down job from producing at all, so sharing the key would mean "stop
proposing work to me" also silenced the question a mandate you already approved
is blocked on. Refusing suggestions and refusing to be asked are different
sentences.

**One tap is a real approval.** `handOverMove` creates the commission and grants
`read` in one act. The draft state exists so nobody approves a mandate they have
not read — and on a proposal card they have: objective, reasons, every step, the
authority and the budget are all on screen, and `approved_at` still records the
moment of the tap. What must never happen is a proposal *arriving* active, and it
cannot. `reach` and `commit` still need the sheet, so invariants 4 and 11 are
untouched.

### What the work turned out to be worth

`copilot_outcomes` could only describe a message — `reply` / `meeting` /
`proposal` / `won` / `lost` / `no_reply`, with `opportunity_id`, `action_id` and
`execution_id` to hang them on. Eight of the nine Jobs produce work that is not a
message, and a **commission** is work the app was authorised to have done; when
one closed, the answer went into free text on the commission row that nothing
read. So a mandate could run for a week, spend worker minutes and be closed
without leaving a row any ranking, metric or verdict could see.

`20260921` adds `move_id` and `commission_id`, and widens `kind` by three. The
new three are the answers to **"what did this turn out to be worth?"**, asked once
when a mandate closes (`WORTH_KINDS` in `lib/copilot/worth.ts`):

| | means |
| --- | --- |
| `won` | money arrived. Amount optional; with one it moves the revenue goal |
| `saved` | money or time that would otherwise have gone. Counts for ranking, **never** for `won_amount` |
| `delivered` | something useful exists and no number describes it |
| `nothing` | it was worth nothing |

`nothing` is the point, not a leftover. A close-out question with no honest zero
collects agreement: every answer is a flavour of value, the rollup reads as
uniformly positive, and the ranker learns nothing it did not already assume.

**Two consequences in `scoreMove`.** `worthByJob` rolls outcomes up by job key —
through `copilot_moves.job` for a Move, and to the literal `commission` for a
mandate, so handing work over is graded as a kind of work like any other. Then:

- the **money** factor prefers the observed average over the job's own
  `stake.value`. Evidence beats a claim, invariant 3 at the level of value, and
  including when the evidence is *lower*: a job claiming a customer is worth the
  full contract with three closes averaging a tenth of that has had its claim
  tested. The `MAX_MONEY_FACTOR` ceiling still applies, so one enormous close
  cannot run away with the day.
- `WORTHLESS_DECAY` bites when a job has `MIN_WORTH_RUN` closes and **every one**
  said nothing. Not a ratio — a job that produced something once is a job that
  can, and an average would bury work whose payoff is occasional and large. It
  multiplies with `DEAD_TOPIC_DECAY` rather than replacing it: "the number did
  not move" and "it moved and I still got nothing" are separate findings.

A worth answer is always `source: 'manual'`. Invariant 10 with more force than
anywhere else in the codebase: a worker allowed to file its own work as valuable
would be grading the one number that decides whether it keeps getting work.

The sheet asks on **both** close buttons. "Call it off" pre-selects `nothing`,
because that is almost always what it means and the escape hatch should not cost
thinking — the other three stay available, since a mandate can produce something
real and still be worth stopping. **Skipping is a real path**: a required answer
here would be given by whichever button is nearest the thumb, and a ledger of taps
is worse than an empty one because it looks like evidence.

`closeCommission` writes twice, in this order, and the order is the design. The
close goes first with the answer as a sentence on the commission row; the ledger
insert follows. If the insert is rejected — an unapplied `20260921` makes
`delivered` a `23514` — the mandate is closed, the sentence is saved, and the
route answers `recorded: false` with a reason the sheet renders. Nothing reports
a clean close over a verdict that never landed.

### Ask your own record

`GET /api/copilot/ask` answers five questions by counting: which segment replies,
where drafts die, which calls worked, what has been stood down, and whether any
of it has been worth money. Opened from the card under the funnel on Working.

**Deliberately not a chatbot, and `lib/copilot/ask.ts` argues it at length.** A
free-text question over these rows has to be answered by a model; a model counting
rows will produce a plausible figure; and nobody — including whoever built it —
can tell which time it is wrong. That is invariant 2 at its root: the skill levels
and estimated percentages deleted in `3eaa03f` went because a figure nobody can
trace is worse than no figure, since it gets acted on.

Two rules the answers keep. `MIN_ASK_SAMPLE` — a reply rate off three sends is not
a smaller fact but a different kind of thing, so under-sampled segments are left
out **and named as left out**. And every answer that renders no rows carries
`thin`: why it is empty. A blank card is the shape of the three bugs in invariant
13, in the one feature whose job is to tell the truth about the record.

`worth` will not subtract across currencies. The plan is priced in a
deployment-wide `CURRENCY` and the user's money is counted in their own, so when
they differ both figures are stated and no verdict is drawn — "₱100 against ₱87"
out of a $29 plan is exactly the invented number invariant 2 forbids.

### Take it somewhere else

`GET /api/copilot/handoff` renders everything the app knows as text: the working
file with `you` and `observed` still distinguishable, the funnel, every call it
made and what was done about it, what has been stood down, what is running, what
is owed, what people wrote back. One tap copies it.

This looks like giving the product away and is the opposite. The whole thesis is
that judgement about what is worth doing today gets better with **this user's**
rows rather than with a better model — a claim, and until now an untestable one. A
general model asked "what should I do now?" has no funnel, no record of what was
refused and no working file. If handing it all of that closes the gap, the value
is in the rows and this should be a system of record; if it does not, the value is
in the arbitration. Either answer is worth more than the argument.

It is also the honest answer to lock-in: somebody whose context cannot leave is a
hostage, and a product chosen because leaving is expensive finds out what it was
worth the moment that changes.

Truncation at `HANDOFF_MAX` says so in the text. A paste that looks whole and is
not is worse than a short one, because the reader cannot tell which they have. No
contact details leave — the destination is a third-party model, and the export is
context about the user's own business, not a list of other people's numbers.

### The queue you have decided against

`cancelOpenDrafts` existed since the offer-change path and had **no user-facing
caller**, so a queue somebody had decided against was permanent: it fed
`awaiting_approval`, that fed the `send_queue` stake, and the Call proposed
sending them every morning. `POST /api/copilot/queue {action:'clear'}` is the way
to say so. Nothing is deleted — the executions move to `cancelled` with a
reason, so "written and never sent" stays in the funnel, which is the most
informative number this account has produced.

It also clears the drafts nobody could see. `loadSendQueue` drops executions
whose action row has gone (`if (!a) continue`), while `awaiting_approval` counts
them — on the live account that was ten: invisible, unsendable, and holding the
metric permanently above zero so a `queue` call could never grade as having
worked. `countOpenDrafts` is the honest total, `HomeData.queueTotal` carries it,
and the gap is stated at the one moment it changes a decision: the confirmation
before clearing. **Grade on the metric, show the list you can act on** — that is
why `statusLine` takes the queue length, after the header said 61 while the call
under it said 51.

### A no that is heard

`refusalsByTopic` counts recent `rejected` and `ignored` responses per topic, and
`scoreMove` multiplies by `REFUSAL_DECAY ** n`. Past `MAX_REFUSALS` a job is
barred from leading — it stays in the stack, because the work is still real, it
just cannot be the Call again — and the winner's evidence says so once.

This fact existed and was consumed by nothing. Signals could say "you ignored 2
of your last 4 calls" while the Call was re-proposed unchanged the next morning
for the fifth day running. Reading a refusal and then repeating the request is
the behaviour of a notification, not of somebody working with you.

### Novelty is a supply problem, not a layout one

Everything the app produced was derived from data it already had. The only thing
that ever arrived from outside was `reconcileReplies`, which reads replies to
messages the app itself sent — so inbound was gated on outbound, and outbound was
the thing not happening. Nine sends in thirty days meant the state at nine in the
morning was the state at nine at night.

Two openings now exist:

- **`POST /api/copilot/moves/inbound`** — an n8n workflow, an agent with browser
  access or a person can post finished work in. Bearer `COPILOT_INBOUND_SECRET`,
  addressed by `email` or `profile_id`, normalised by the same
  `normalizeRemoteMove` the pull adapter uses and written by the same
  `writeMoves`. Untrusted by construction; a bad workflow can put nothing on the
  screen.
- **`lastCronRun`** — the nightly job's own last finish, distinct from a run the
  user triggered by opening the app. With no cron there are no overnight Moves,
  no push and no graded decisions, so every morning is identical because the user
  is computing it by looking. A scheduled task nobody set up looks exactly like a
  quiet week, so Now says it out loud and `/api/copilot/health` reports
  `loop.nightlyRuns` over thirty days.

`health.loop` is the whole funnel in four numbers — produced → called → answered
→ landed — counted from events that were already being logged. It measures
finished work rather than taps, because taps would flatter it.

### Goals

`JobSense` carries `goals`. It did not, and that was the widest gap between this
product and what it claims to be: the brief could see them (`ContextPack.goals`)
and the decision layer could not, so an account whose owner had written "Get a
job — urgent money" and "MacBook Air, $1,000" into it could not produce or rank
one thing that referenced either.

`goal_gap` speaks about the highest-priority goal the ledger can actually
measure: a currency goal with a target. It compares the gap to the rate of
logged wins and says whether the second closes the first before the date the
user set. **It stays silent on the others** — "Monetize App — 0 of 10 users" and
"Get a job" are real goals with no meter behind them, and a projection with no
meter is the invention every other job here refuses to make. They are waiting on
a sensor, not on wording.

There is deliberately **no goal-alignment multiplier** in `scoreMove`. A goal
that is behind produces its own Move and competes on the same four factors as
everything else; a vague "this feels goal-shaped" bonus on unrelated Moves would
be exactly the invented precision this file keeps arguing against.

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
| GET | `/api/copilot/home` | everything for both tabs and the You sheet: send queue, pipeline, diagnosis (openings with weekly trend and per-segment read), latest weekly Signals insight, metrics |
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
| POST | `/api/copilot/outcomes` | `{ kind, opportunity_id?, action_id?, amount?, currency?, note? }` — `kind` is any `OUTCOME_KINDS` value, including the three worth answers |
| POST | `/api/copilot/decision` | `{ response: did \| rejected \| wrong }` — what you did about today's call |
| POST | `/api/copilot/growth/:id` | `{ status: active \| done \| dismissed }` |
| POST | `/api/copilot/sources/:key` | mark a connector as requested (foundation) |
| POST | `/api/copilot/auth/magic-link` | `{ email }` — send a one-time sign-in link |
| GET | `/api/copilot/auth/callback?token=` | consume the link, set the cookie |
| POST/DELETE | `/api/copilot/push/subscribe` | register / remove a Web Push subscription |
| DELETE | `/api/copilot/session` | forget this device |
| GET | `/api/copilot/health` | what this deployment actually has: missing env vars by name, unapplied migrations by file (session or cron bearer) |
| GET | `/api/copilot/cron/daily` | scheduled loop (Bearer `CRON_SECRET`, fails closed) |
| GET/POST/DELETE | `/api/copilot/watch/sources` | the feeds this profile watches |
| POST | `/api/copilot/watch/discover` | find feeds for the offer; every result is fetched and parsed before it is offered |
| POST | `/api/copilot/watch/run` | read the sources now (25s budget) — the nightly budget cannot fit the watcher |
| GET/POST | `/api/copilot/working` | the working file: write a line, confirm or decline a reading |
| DELETE | `/api/copilot/working?id=` | remove a line |
| GET/POST | `/api/copilot/commissions` | read the thread · write a mandate (always as a draft) |
| POST | `/api/copilot/commissions/[id]` | `approve` · `unblock` · `stop` · `done` · `seen`. `stop` and `done` carry the close-out verdict `{ worth, amount?, note? }`, and answer with `recorded` plus a `note` when it did not reach the ledger |
| POST | `/api/copilot/commissions/[id]/result` | **the worker's return leg** (Bearer `COPILOT_INBOUND_SECRET`) |
| POST | `/api/copilot/commissions/run` | hand live mandates over now (25s budget) |
| POST | `/api/copilot/obligations` | money owed, either way |
| POST | `/api/copilot/actions/[id]/opened` | `sendBeacon` target — a draft's deep link was tapped |
| POST | `/api/copilot/moves/:id` | `{ status: done \| dismissed \| handover }` — `handover` turns a proposed Move into a live mandate |
| GET | `/api/copilot/ask` | five questions about your own rows, each answered by counting. No model, no free text |
| GET | `/api/copilot/handoff` | everything the app knows, as text to paste into any model |
| POST/DELETE | `/api/copilot/focus` | `{ minutes, on?, note? }` — log a block of deep work (`copilot_events`, `focus_logged`) · `?id=` removes one |

All copilot API responses are `Cache-Control: private, no-store` (rule in `next.config.ts`).

## Commissions — the principal layer

`copilot_commissions` + `copilot_commission_events` (20260916). A mandate the
user grants once: an objective tied to a goal, an **authority**, a budget, a plan
whose steps have state, and a log. The user approves the commission and its
authority **once, not each step** — approving every action is a form.

Three rings, and only the first runs by itself:

| ring | may | autonomous |
| --- | --- | --- |
| `read` | research, compare, draft, document | **yes** |
| `reach` | contact someone under an identity the user owns | **no** — needs a verified sending identity (invariant 4) |
| `commit` | money leaves, a signature, a hire, a price agreed | **never**, in any version |

`canAct(granted, level)` requires both that the mandate covers the level *and*
that the level is autonomous, so granting `reach` today buys nothing extra by
design: the mandate records intent, the second gate decides what runs.

`COPILOT_JOBS_URL` receives a second payload shape alongside `kind: "moves"`:

```
{ "kind": "commission", "commission_id", "objective", "why",
  "may", "may_autonomously", "budget_minutes", "plan", "result_url",
  "who": { name, headline, offer, location, timezone, target_segments, target_area,
           working? },
  "goal": { title, target, unit },
  "log": [ { kind, step, summary, at } ] }
```

`who` carries no email, no phone, no billing and no id. `who.working` is
`workingBrief` — live entries only, omitted for an account with no file — and it
is what stops commissioned research reading like it was written from a headline,
because until `20260919` it was: the offer's five strings were all a worker got.

**`log` is why the loop can close.** It is the tail of this mandate's own events,
oldest first, capped at `MAX_BRIEF_LOG`. A worker raised a `needs_you`, the user
tapped "I have answered", `unblockCommission` wrote a status and nothing else —
and the next brief went out identical to the last. So the worker asked the same
question again, every night, and no commission that needed anything from its
owner could ever finish. That is the whole of "the loop has never completed
unassisted end to end": not a hard problem, a field that did not exist.

The user's reply is an `answered` event, written by `unblockCommission` and by
nothing else. It is deliberately outside `WORKER_EVENT_KINDS`, which is what
`normalizeResult` validates the result socket against — a worker that could post
`answered` would be answering its own question and clearing its own gate, which
is invariant 10 with one extra step. The database permits the kind
(`20260919`); the parser is what refuses it from a worker. Until that migration
is applied `unblockCommission` refuses to move the mandate at all, rather than
clearing the gate and silently dropping what the user typed.

The worker answers inline or posts to `result_url` later:

```
{ "events": [ { "kind": "planned|worked|found|needs_you|blocked|done|failed",
                "step": 2, "summary": "required, <=300",
                "artifact": { "kind", "label", "value", "href" } } ],
  "plan": [ { "n", "do", "state" } ] }
```

`status` in that body is **parsed and discarded**. `nextStatus` computes state
from the events: a `needs_you` outranks a `done`, a bare `done` with no summary
is dropped, and `blocked` is the user's to clear — via the sheet button, or by
answering the Move the app raised (`commissionIdFromMove` carries it through
`setMoveStatus`). A draft or stopped commission refuses work outright.

**A question and a breakage are opposite states.** Both arrive as `blocked`, and
for a while both rendered as a blue "NEEDS YOU" chip over a text box — so a
morning with three handed-over jobs showed three things the user had apparently
failed to do, two of which were a dead search tool, and the section stopped
being a report and became a fault list. `reportOf` now splits them: `yours` is
`needs_you` only, `stopped` is `blocked`/`failed`, and `blockedOn()` says which
the mandate is actually waiting for (newest wins, because a job can carry an
answered question and a fresh failure). A breakage gets a grey chip, a plain
sentence and one retry — never a text box, because nobody can answer a 500 —
and it raises no Move at all.

A blocked mandate surfaces as a Move so it competes through `scoreMove` like
anything else. `MAX_ACTIVE_COMMISSIONS = 3`, enforced at creation (counting
drafts) and again at approval.

## The working file — the offer's other half

`copilot_working` (20260917, index fixed in 20260918). Six sections: `deliver`,
`price`, `works_for`, `tried`, `refuse`, `voice`.

**Two sources and never a third.** `you` is the user's own statement — true
because they said so, live immediately, no evidence needed. `observed` is
computed from their rows and carries the count that makes it true. There is no
`inferred` tier.

`observedFrom` emits arithmetic with words around it, never conclusions: "9 sent
in the last 30 days, 2 replied" is in; "you are good at resorts" is out, and the
test greps for that shape. Nothing from a thin funnel, nothing below
`MIN_OBSERVED`, and no price reading without a real amount.

Readings arrive as `proposed` and never reach a prompt until confirmed. A
declined one is kept so it is not re-proposed; a **confirmed** one whose number
moves is refreshed in place, never demoted. `workingBrief()` feeds
`buildContextPack`, `watchBrief` and `commissionBrief`, capped at `BRIEF_MAX`
characters because it sits at the head of every per-source judge prompt.

**Three destinations, and the sheet may only name those three.** It reaches the
daily read, the per-source judge, and a commissioned worker. It does **not**
reach a draft: `draftOpener` calls `openerTemplate`, which is built from the
offer's five strings and has never read this table. The sheet claimed "every
draft" anyway, and `SECTION.voice.changes` said "changes every draft, which is
most of what this app produces" — invariant 7 inside the app's own copy, on the
one feature whose entire argument is that it never overstates what it knows. The
copy now says what is true and a test in `workingFile` fails on the word
"draft" in any `changes` line. Delete that assertion when `draftOpener` reads the
file; it is the single highest-value wire left in this feature, because `voice`,
`deliver` and `price` are mostly worth typing for what they would do to a draft.

## The worker

`scripts/n8n/copilot-worker.json` is the reference worker, importable as-is. It
is the `read` ring and nothing more: it searches, reads pages, compares, drafts
and asks one good question. That is a complete v1 — `reach` and `commit` are not
autonomous by design, so a contractor that cannot act is not a limitation, it is
the product.

Four things in it are load-bearing and were each learned the hard way:

- **It reads `log`.** The version before it did not, so the agent re-asked a
  question the owner had already answered — in new words, the next night, for as
  long as anybody kept answering. `Build the task` renders the log oldest-first
  and says outright not to ask an answered question again.
- **It reads `who.working`.** Research written from a five-string offer comes
  back generic however good the model is.
- **It has no `sendHeaders`.** The previous version set `sendHeaders: true` with
  one empty entry in `parametersHeaders.values` — a header with no name — and
  every Exa call returned an internal request-header error. Two live jobs sat
  stuck on it for a day. The key belongs in the Header Auth credential and
  nothing else belongs in that node.
- **It can read a page, not just search.** Search returns six summaries; a price,
  a spec or a date has to come off the page itself or the honest answer is "I
  could not", which is exactly what the search-only version kept reporting.

`Shape the result` re-validates everything the app validates on arrival, and
relabels a `needs_you` that is plainly a tool failure as `blocked` — the model is
told which to use, and this is the backstop, because the cost of getting it wrong
lands on the user as a text box asking them to reply to a 500.

## Tests

```
npm run test:copilot
```

Pure-module tests: ranking (sourced/inferred rule, capacity plan selection, outcome-weighted
affinity), metrics, phone normalisation and heuristic fit, message templates, agent output
normalisation, starter agent, session signing.

Two of them read files rather than modules, and both exist because the same bug
shipped twice. `OUTCOME_KINDS` is diffed against the `kind` CHECK in
`20260921_copilot_outcome_worth.sql` **in both directions**, and `BUSINESS_METRICS`
against `20260920`'s. A widened TS union over an untouched constraint is a silent
`23514` — that drift made the daily Call invisible for a fortnight while every
write went into a `console.error` and the screen reported calm.

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
- The working file does not reach a draft. Three of its six sections are worth typing
  mostly for what they would do to one. See the working file section above.
- `budget_minutes` is written, shown as "up to 60 min" and sent in the payload, and
  nothing accounts for it. `dueCommissions` re-dispatches every active mandate nightly
  with no cooldown, so what reads as a total is a per-night allowance with no ledger
  behind it. Of the three rails a mandate is sold on — objective, budget, authority —
  that one is currently a hint to a third party.
- Answering a blocked mandate through its **Move** (marking the card done) carries no
  text — only the sheet has the field. The mandate unblocks either way, but a worker
  told nothing new may ask the same question again.
- A worker failure still consumes one of the three mandate slots. That is deliberate —
  a broken job is still a job somebody asked for — but it means three bad nights fill
  the cap. The retry is one tap; the cap is not lifted.
- `deadTopic` — "you did this three times and the number never moved" — is computed by
  `decisionReview` and read by `growthEdge` and the Working tab, but not by `scoreMove`.
  So the refusal decay hears an explicit no and an inferred ignore, and does not hear
  "this does not work". It is the same shape as the bug `REFUSAL_DECAY` exists to fix,
  one level up, and wants its own change with its own test.
- Refusals are keyed on `decision.topic`, and only Move-driven calls write a job key
  there: `starterDecision` writes `'sending'`, `'opener'`, `'offer'`. Refusing the
  starter ladder therefore increments a counter `scoreMove` never reads, and the starter
  ladder is what runs when every job has been barred — so the one path that cannot be
  stood down is the one reached by standing everything else down.
