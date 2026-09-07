# Direction

What this product is for, what it is deliberately not, and the test a proposed
feature has to pass. `COPILOT.md` says how the thing works; this says why it
works that way, so a decision does not get re-litigated every few weeks.

Written for whoever picks this up next, including an agent starting cold.

Last substantially revised **September 2026**, when the competitive picture
changed and four of the six layers this document claimed turned out to be
someone else's free product. See **The harness threat**.

---

## The one-line thesis

> **Persistent, outcome-compounding outbound infrastructure for people who sell
> to local businesses on WhatsApp.**

This document used to plan for one threat: frontier models getting better at
reasoning, writing and advice. That was the wrong threat. What arrived was not a
better model but a better **harness** — a personal agent with persistent memory,
a built-in cron and a gateway into WhatsApp, self-hosted and MIT-licensed. Half
the list that used to sit here has been cut because that harness now does it,
free.

What is left, and why each one survives:

- **A maintained supply pool.** 140 deduped businesses keyed by `place_id`, with
  contact channels, segment, rating and pain signals, refreshed under a budget.
  That is a database and a scraping bill, not a memory file.
- **Aggregate demand computed over that pool.** "Facebook ads appears in 40 of
  *your* 140 matches and is not in your offer" is a group-by minus the offer
  text. Recall cannot produce it; only rows can.
- **A truthful outcome ledger.** This execution, this body, this recipient, sent
  at this timestamp, reply matched at this one, won for this amount — joined.
  Measurement about the world, not an agent's self-report about its own
  behaviour.
- **A decision record that grades itself.** One call, one named metric, read back
  three days later against a stored snapshot.

The property those four share is the whole thesis:

> **Rows, not recollection.**

Anything this product can only *remember* is commodity now. Anything it can
*compute over* is not.

## The survival test

The old test asked whether a ten-times-better model would make a feature
redundant. It passed things it should have failed, because the competition was
never going to be a raw model — it was going to be a model with memory, a
scheduler and your WhatsApp session. Ask this instead:

> **Could a self-hosted personal agent with persistent memory, a cron and a
> WhatsApp gateway do this after a week of use — or does it need rows it never
> collected?**

**Needs rows** → build it. The supply pool, demand aggregation, the outcome
ledger, decision grading, the send queue.

**A week of memory covers it** → do not. Morning briefs, insight and advice,
drafting an opener, remembering preferences, nudges, "what should I do today".
These are not weak features. They are someone else's product now, given away
and self-hosted, and building a nicer one is competing on the only ground the
competition has already conceded for free.

---

## The harness threat

Recorded **September 2026**, with names and dates, because a document that says
"nothing general can do this" ages badly without them.

**OpenClaw**, and its successor **Hermes Agent** (Nous Research, February 2026,
MIT, self-hosted), are personal agents with persistent memory across sessions, a
built-in cron, subagents, and one gateway reaching 20+ platforms including
WhatsApp, Telegram, Signal and Slack. Hermes additionally claims a learning loop
that builds skills from experience. They run on the user's own machine, which
means they hold the user's own WhatsApp session.

Six layers this document used to claim. Four of them fell:

| Layer once claimed here | Verdict |
| --- | --- |
| Memory of the user across sessions | **Gone.** Persistent, and improving on its own. |
| Running while you sleep | **Gone.** Built-in cron. |
| The read — insight, advice, "what matters today" | **Gone.** On a better model than the one writing our briefs. |
| **"From you" delivery** | **Gone, and theirs is better.** An agent holding your WhatsApp session sends as you properly; a deep link is a workaround for not having one. Invariant 4 — nobody sends under an identity they do not own — is served better by software on your own laptop than by anything server-side. |
| Real-world supply joined up | **Holds.** They can call a scraper once. They do not maintain a deduped pool across months under a budget. |
| Aggregate demand from your own pool | **Holds**, and is the strongest thing in the product. |
| A truthful system of record | **Holds.** Their learning is an agent's self-report about its own behaviour; this is measurement about the world. |
| A decision, and whether it was right | **Holds.** Needs snapshots over time, not recall. |

Nothing stops Hermes adding a database. The durable part was never the schema —
it is the maintained pool and the outcome joins, which are operational work
rather than code.

**The uncomfortable corroboration.** This app's own funnel already ran the
experiment: 140 matched → 44 drafted → **0 sent**, 6 meetings happening outside
it, and its author preferring Claude and Grok for thinking. The layers a general
harness takes are almost exactly the layers of this app that were never used.
The threat is not a forecast. It is in the usage data, and it predates the
competition.

**The direction that follows — argued, not decided.** Stop competing on the
surface; become the tool the harness calls. Hermes and OpenClaw both take tools
and skills. A skill exposing `matches()`, `demand()`, `queue()` and
`record_outcome()` gives someone their own agent *plus* a substrate they cannot
keep in a Markdown file: the harness delivers the morning message, which it does
better than a PWA, and this supplies the numbers that stop it being generic.
Most of the routes already exist under `/api/copilot/*`; the gap is an MCP
server and auth scoping. Carried as an open question below rather than as a
plan, because no external user has been asked.

Sources, as of this revision: [openclaw.ai](https://openclaw.ai/) ·
[hermes-agent.nousresearch.com](https://hermes-agent.nousresearch.com/) ·
[Hermes feature overview](https://hermes-agent.nousresearch.com/docs/user-guide/features/overview)

---

## What is deliberately not built

Each of these was considered and declined. Reopen one only with a reason that is
new.

- **A general "life OS" surface.** Habits, journaling, health, relationships as
  their own screens. The original brief called this "expand later if validated";
  it has not been validated. Life context belongs as *ranking input* inside the
  You sheet — runway, capacity, goals — never as screens.
- **A decision engine over domains the app cannot observe.** A leverage formula
  ranking "collect the deposit" against "finish the demo" is arithmetic on
  invented numbers until those things are actually in the system. Add the sensor
  first, then the ranking.
- **A general reality-ingestion bus**, entity resolution across sources, or
  autonomous execution without approval. Months of work; changes no decision
  this quarter.
- **New supply adapters** until the send side has a pulse. Supply is the surplus.
- **`emailApi` as a sold feature.** `setSendMode()` has no route calling it. A
  test fails if the pricing page advertises it again.
- **Competing with Claude Code on building.** The app should *export* what it
  knows to a model, not try to be one. A context pack the user pastes into a
  chat is the honest version of "help me build this".
- **Competing on the morning message.** A self-hosted harness already delivers a
  daily brief over WhatsApp with better memory and a better model. A nicer
  version of that is the one thing the competition gives away. The **send queue**
  stays a real screen — one-tap approve over a thirty-item queue genuinely beats
  a chat thread — but the brief text, the lesson and the nudges are not worth
  defending.

---

## How it got here

Three narrowing passes, each driven by the app's own numbers rather than by
opinion. Worth knowing so the same ground is not re-covered.

**The funnel that forced it.** 140 matched → 44 drafted → **0 sent**, while 6
meetings and 2 replies happened *outside* the app. Supply was never the problem.

Two diagnoses came from reading the code, not from any critique:

1. **Older drafts were invisible.** `loadHome` selected plan rows for
   `for_date = today` only, so a Tuesday draft vanished on Wednesday while still
   blocking a fresh one. Hence: the send queue is built from
   `copilot_executions`, any date — never from today's plan.
2. **`demandGap` counted the user's own targeting as demand.** "Pest control 20"
   (a segment the user chose) sat beside "running Facebook ads 40" (a want).
   Hence: segment is a grouping key; only tags and pain signals are demand.

**Phase 0** — Today became a send queue; nothing drafts from a blank offer.
**Phase 1** — four tabs became three (Today / Pipeline / Signals); You moved
behind the header avatar. Vanity counters ("3 new matches") deleted.
**Phase 2** — Signals became the product: demand over time, per segment, with
two actions (add to offer, stop matching) and a weekly push.
**Then** — `/lifeos`, a second calm-themed shell over the same three tabs, so
two personas can be tested without forking the app.
**Then** — the decision layer: every brief now ends in one call with a trade-off
and a metric, and the record grades itself against the ledger.

---

## Where it actually stands

Honest scoring against the "control loop" this is aiming at:

| Layer | State |
| --- | --- |
| Reality ingestion | **~20%** — Maps supply, manual notes, manual cash/burn. Calendar is a button that does nothing. |
| State model | **~55%** — goals, capacity, runway, commitments, decisions, outcomes. Missing: projects, people, *named* cash obligations. |
| Leverage engine | **~45%** — `scoreOpportunity` is a real, transparent formula, and there is now one decision a day. But it can only rank opportunities, because they are the only domain observed. |
| Execution | **~70%** — draft → approve → deep link → day-3 follow-up. Missing: calendar blocks, documents, workflows. |
| Verification | **~65%** — six outcome kinds, reply reconciliation, a funnel that flags work done outside it, decisions graded on a named metric. Nothing proactively asks. |
| Learning | **~60%** — type affinity, outcome affinity, and now the decision-outcome record with topic grouping. |

**The root cause of "it only ever advises outreach" is one sensor, not the UI.**
Everything observed is outbound supply, so the engine has one lever. The
cheapest fix that changes this is **named cash obligations** — expected inflows
and outflows with dates, entered by hand, no integration — which turns runway
from a number into a forecast and makes "collect the deposit" rankable against
"send ten messages". Calendar second. Delivery/projects third.

That ordering still passes the revised survival test — each one is rows nobody
else collected — but it now competes with the harness question above, and loses
on cost. Widening the sensor is months of collection before anything ranks
differently. Exposing what is *already* collected to an agent the user is
running anyway is an MCP server over routes that exist. Do the cheap one first.

Note that the one-line thesis survived the revision unchanged. "Infrastructure"
was the right word before there was a reason for it; it now describes the
direction better than "copilot" does.

---

## Open, and honest

- **The loop has never closed end to end.** Zero messages sent from the app.
  Until one goes out and one reply comes back, everything downstream is
  speculation. This is the highest-value thing anyone can do, and it is not a
  feature.
- **The cron fires now, and the agent behind it never ran.** A Coolify scheduled
  task running `scripts/copilot-cron.mjs` reached `200 in 220.7s — 2/2 profiles
  ok`. But every `daily_brief | llm` row in `copilot_agent_runs` was `error`,
  aborted at exactly 30.0s by this codebase's own timeout, so every brief anyone
  has read was the deterministic starter. Fixed by giving the cron a budget
  separate from the interactive one; the lesson worth keeping is that a
  capability can be fully built, fully deployed, logging success at the top
  level, and dead one layer down. Check `copilot_agent_runs.status` before
  believing any claim in this file.
- **No external user.** "Me first, clients later" was the right call; whether
  "later" is real is unanswered. Five conversations would answer it.
- **No completed Stripe checkout, ever.** The billing layer is untested against
  a live card.
- **Unknown: WhatsApp deliverability at volume.** The whole "from you" mechanic
  assumes deep-link outreach to strangers does not get numbers flagged. If it
  does, the core loop is unshippable. Existential and cheap to research.
- **Unknown: supply unit economics.** Pro promises 400 matches/month, Operator
  2,000. Apify cost per *inserted* match is not measured against those prices.
- **No account deletion.** "Forget device" clears a cookie; the profile stays.
- **Unknown: whether the surface is worth keeping at all.** If the harness
  argument above is right, Today's brief, insight, lesson and nudges are dead
  weight, and the send queue is the only screen worth defending. Nobody has
  tested a copilot that is an MCP server plus one approval screen. This is the
  cheapest large experiment available and it has not been run.
- **Unknown: whether the moat is operational or imaginary.** "They cannot
  maintain a deduped pool under a budget" is an assertion about effort, not
  about capability. If a Hermes skill plus one Apify key gets someone 80% of
  the pool, the remaining 20% is not a business. Nobody has tried to build the
  competitor to find out.
