# Direction

What this product is for, what it is deliberately not, and the test a proposed
feature has to pass. `COPILOT.md` says how the thing works; this says why it
works that way, so a decision does not get re-litigated every few weeks.

Written for whoever picks this up next, including an agent starting cold.

---

## The one-line thesis

> **Persistent, outcome-compounding outbound infrastructure for people who sell
> to local businesses on WhatsApp.**

Frontier models will keep getting better at reasoning, writing and advice. That
makes this app more useful, not less — but only if it stays the layer models
cannot be:

- **A ledger with a cron.** Persistent state, outcomes attached, running while
  you sleep. A chat window forgets; this does not.
- **Real-world supply joined up.** Google Maps → matched → drafted → sent →
  replied → won, in one chain, with the joins kept.
- **A truthful system of record.** What was actually sent, what actually came
  back. The model can reason over it; it cannot know it.
- **Aggregate demand from your own live pool.** "Facebook ads appears in 40 of
  *your* matches and is not in your offer." Nothing general can compute that.
- **A decision, and whether it was right.** One call a day, the trade-off it
  implies, and the metric read back three days later.
- **"From you" delivery.** Drafts open pre-filled in the user's own WhatsApp.
  The model writes; the user stays the sender.

## The survival test

Before building anything, ask:

> **If the frontier model gets ten times better tomorrow, does this still need
> *my* persistent state, *my* live supply, or *my* outcome ledger to work?**

**Yes** → build it. Signals, ranking from outcomes, the overnight queue, the
truthful funnel, the offer-feedback loop, the decision record.

**No** → do not. Standalone smart drafts, generic prioritisation, one-shot
analysis of a pasted list, broad planning, motivational framing. Anything a user
gets by opening Claude alongside Maps and WhatsApp is a thin wrapper, and a thin
wrapper loses.

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

---

## Open, and honest

- **The loop has never closed end to end.** Zero messages sent from the app.
  Until one goes out and one reply comes back, everything downstream is
  speculation. This is the highest-value thing anyone can do, and it is not a
  feature.
- **The cron has never fired in production** (see `CLAUDE.md` → Deploying).
  Until it does, the most defensible property in the thesis — running while you
  sleep — does not exist, and the weekly Signals push has never sent.
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
