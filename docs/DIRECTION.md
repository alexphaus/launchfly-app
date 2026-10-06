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
  *One screen reopened in October 2026, with a reason that is new:* money is not
  life context here, it is the survival test's own input, and it was the one
  number still a month stale. Its owner spends cash, logs it in a budgeting
  app, and fed that app's CSV to this one by hand — so runway was always as old
  as the last export. The **Money tab** is that app's one used screen and
  nothing else of it: log a move, the list under the balance, the calendar. No
  charts, no budgets, no analytics — each of those would be a screen about
  money, which is still declined. What earns the tab is that a logged row is an
  ordinary transaction every read already takes: runway moves when a coffee is
  logged. See COPILOT.md → **The money book**.
- **A decision engine over domains the app cannot observe.** A leverage formula
  ranking "collect the deposit" against "finish the demo" is arithmetic on
  invented numbers until those things are actually in the system. Add the sensor
  first, then the ranking.
- **A general reality-ingestion bus**, entity resolution across sources, or
  autonomous execution without approval. Months of work; changes no decision
  this quarter.
- **New supply adapters** until the send side has a pulse. Supply is the surplus.
  *Reopened in September 2026 with a reason that is new:* that was about volume
  on the owner's own account. A second persona showed the problem is relevance —
  sixty matches from the wrong Toledo, for someone who does not sell to local
  trades at all. The answer taken was not more adapters but **hunts**: web
  searches the app plans for itself from what the user told it, every find
  held to a real link. See COPILOT.md → **What it looks for is worked out**.
- **`emailApi` as a sold feature.** `setSendMode()` has no route calling it. A
  test fails if the pricing page advertises it again.
- **A file on every person.** A contact list, a map of who knows whom, a
  follow-up cadence for everyone you have met. Considered in October 2026, when
  networking came up as information acquisition, and declined: the app keeps
  conversations by what each one was — who they were to the business, what they
  said, what they committed — and an introduction until it is followed, because
  those are rows a bet and a model can read. A person's file is a CRM, and a
  harness keeps contacts better. A weekly quota of conversations went with it:
  advice dressed as a test.
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
**Then** — `/copilot2`, four tabs (Today / Matches / Work / You), from its
owner's own verdict that the two-tab app had too many things and no single reason
to open it. Built as a second layout over the same data rather than a rework, so
the two can be compared by living with them. It adds one sensor — deep work,
logged by hand — and no new ranking. See COPILOT.md → **Four tabs**.
**Then** — hunts, twice. First as searches the user wrote and managed, beyond
"segment in area" on Maps. Then, on its owner's verdict that this made finding
people their job again — "serve, not configure" — as the app's own: planned from
the offer, the working file and the goals, retired when they bring in nothing
anybody drafts, never shown. Matches lost its setup with them: no "looking for",
no poor fits, no queue sheet — only what the ranker recommends, and one tap to
act on it. See COPILOT.md → **What it looks for is worked out, not configured**.
**Then** — the Path. Four drafts of a better Work tab (an honest take with
tests, a live machine, a milestone path, a weekly quota) all met the same
verdict: static sections competing for attention, nothing that changes, content
gettable from the call, You or the handover. The answer was that Today and Work
were halves of one question — where am I, and what moves it — and on a time axis
they are one stream: what moved above, "you are here" with the call, the
planner's next steps below, a ladder of rungs every one of which is a count the
funnel already keeps. Three tabs: Path · Matches · You. No new sensor and no new
ranking; the past is rows, the future is the Moves. Then it was made to move and
say so: a rung reached is dated where it happened, the plan names what left it
and why, every step carries the planner's reason, and one swap is suggested only
where hours and replies sit side by side.
**Then** — Work back, beside the Path. With the machine and the team under the
numbers on You, its owner found the separation was the point: the Path is what
to do and what moved, Work is the business being built — the offer, the
machine, the team and the projects in full. Four tabs: Path · Matches · Work ·
You. See COPILOT.md → **Four tabs**. (Money joined them later, and Swipe took
Matches' place: COPILOT.md → **Swipe**.)
**Then** — the Path as a plan, not a log. The stream put everything on one axis
and weighted it evenly, so the part a person opens it for — what now, and where
is this going — was a short list under a long log. Now the evidence above "you
are here" is only what taught something, the centre is one move sized to the
time the user set, and below it the plan walks their first goal back through
their own funnel: money → clients at their price → sends at their rate → days
at their capacity, each estimate marked early until the sample is real, and a
checkpoint saying when the guesses become numbers. It passes the survival test
for the same reason the rest does: an agent with memory can write a roadmap;
"10 clients at your $150, about 45 sends at the rate your own 9 earned" needs
the ledger. Goals past the first are named, not planned.
**Then** — the plan drawn for the person, not walked back through the funnel.
The ladder was the same for everybody, and its owner's verdict on it was the
brief: static, hardcoded, outbound-centric, where the want was a plan that
understands the goals — a job, a property, a skill, a business — and orders them
by what is achievable now, quick wins first, then the long pulls, redrawn as
things work. That reverses "arithmetic rather than a written roadmap" above,
knowingly: a model now writes the order, the milestones and the steps. What
keeps it on this side of the survival test is what it is drawn *from* and what
it is not allowed to write. It reads the ledger — replies, payments, hours,
research that finished, and what the person did with every step of the last
plan — and it cannot write a number the input did not contain, cannot mark
anything done, and never sees its own earlier reasoning. A harness with memory
can write a roadmap; one redrawn from which of last week's steps you actually
ticked, and what came back from them, needs the rows. The funnel plan stays
where there is no model to draw with. See COPILOT.md → **The plan is drawn, not
walked back**.

**Then** — the plan as a judgement, not a reordering. Its owner's verdict on the
drawn plan: a well-made copy of their own notes, nothing they could not have
written themselves, and no word on whether it could work in time. Three changes,
one PR. The app does the arithmetic the planner may not — will it work, per goal,
from the ledger and the goal's real date — and the record's stop-or-change
signals, and the plan must answer both in its own words. One experiment at a time
is searched for across fixed angles, held to evidence and novelty, graded by the
person's tap and read back to the next draw by angle: a record of which kinds of
bet pay off for this person, the first half of anything that could later be
called a value network. And the agent is handed what it says it can do, in one
tap that starts it. The survival test holds for all three for the usual reason:
the verdict needs the ledger and the dates, the signals need the sends and the
call record, the experiment ledger needs verdicts over weeks — rows, not
recollection. See COPILOT.md → **Whether it can work, said first**.

**Then** — money read from the bank, not typed. Its owner asked for the thing a
person with an agent or a prompt cannot get without setting one up — and the
answer was under this document's own root cause: everything the app knew about
money was typed, so the engine had one lever. A bank statement changes that
without the cost this document charged every new sensor. "Widening the sensor is
months of collection before anything ranks differently" is true of a calendar
and false of a statement, which arrives with a year of history on day one. So:
upload a statement (CSV, OFX, a PDF or a screenshot), and runway, who pays, what
repeats and how long the cash lasts are counted off it; a client's deposit
becomes a win joined to the ledger; the plan is shown the lines and may cite
them. It passes the survival test on the joins, not the reading: a chat can read
one pasted statement once, and a harness could be set up to parse one, but
neither keeps a deduplicated, balance-checked ledger across months, attributed
by the person to clients, their job and their own accounts, and joined to the
messages that earned it. What a model reads is held to the statement's own
arithmetic before it counts; a role is the person's tap, never inferred. And
the sensors are one list now — **Records** on You — so a calendar, a CV or a
bank link is an entry and a sheet, not a new screen. See COPILOT.md → **Money,
read from the bank, not typed**.

**Then** — Work as the business, judged. Its owner's verdict on the tab that came
back beside the Path: stale, the path to money generic, the team too heavy for a
status, Build with Claude better as a box for handing work over. The want was the
lean playbook — the proven system and how it connects, assets, experiments,
suggestions that pay — run by an app that suggests, works and asks only when it
must, unlike a chat that has to be prompted. The answer kept the one thing every
rejected redraft lacked, a single spine: the business as a chain (who buys, how
they hear, how they say yes, what they pay, how you deliver), each part a bet
with a state by the app's own thresholds, the weak link open with what would move
it, the agents placed on the part they run, and what was built listed by who made
it. "Proven" is three paid at the person's price, which needed one change below
the screen: the funnel now keeps every win's amount, because a count could not
tell two one-dollar tests from two sales. It passes the survival test for the
usual reason — a harness can write a business model canvas; "six meetings, two
paid, none at your $150, so the weak link is the price" needs the ledger. What it
deliberately does not do: build the asset in the app (the worker or a chat does —
see **What is deliberately not built**), or let an agent act past `read`
unapproved. See COPILOT.md → **Proof**, which it became part of.

**Then** — the Lab, one bet at a time. Its owner asked whether this could be the
toolkit for someone who has just read The Lean Startup, then which other books
fit that founder and what the ideal tab for them would be. The honest answer to
the first was not yet: the book starts from assumptions bet on against a line
set in advance, and the app started from an offer already being sold. So a sixth
tab, which answers what the founder does not know on Monday — which play, on
which part, and did it work — and nothing else: a bet with a pass line written
before it starts and read off the rows after, plays from ten books each with a
count the app can take, The Mom Test's conversation log, runway counted in bets,
and pivot or persevere every two weeks with the last answer read back. What the
brief ruled out stays out: book summaries, canvases, daily quotas. It passes the
survival test for the usual reason — a chat can explain The Mom Test; it cannot
read two weeks of your sends and payments and say a guarantee moved nothing at
your price. Nobody marks a bet passed, for the reason a worker cannot mark its
own homework. See COPILOT.md → **Proof**, which it became part of.

**Then** — Proof, the two as one. Work said which part of the business was weak
and the Lab ran the bet on it; its owner found two tabs asking one question in two
places, and asked for one in their place — for a business that does not sell by
outreach as much as one that does, powered by a model so it is not the same tab
every time, with clean panels, the assets as things with versions, who made each
and the bet that produced it, and the history in one place. The rule that held it
together is the app's oldest one at a new layer: a model proposes, the rows judge.
A model writes three ideas for a bet from this business's own record, and drafts
an asset; each is held to what the person gave it before it is kept — a count the
business can keep, no number they never said, no link they did not give — and
neither decides anything. The verdict is the chain's rule, a bet passes on its
count, and a drafted offer is not the offer until the person makes it theirs. How
buyers find you is now a setting, because "two replies in twenty sends" is a rule
about outreach: a shop whose buyers walk in is read through the conversations,
sales and counts it logs, and the app says when it read the channel rather than
being told it. The history is not a new record but a join of the ones there were:
bets and how each ended, decisions, commitments, versions, projects, sales. It
passes the survival test on the joins again — a chat can write a landing page,
and it cannot say which version was in use when the enquiries came, under which
bet, and that the one before it did not pass. Drafting stays text from the
person's own words, kept and judged here; building is still exported (see **What
is deliberately not built**). See COPILOT.md → **Proof**.

**Then** — the people around the money. Its owner brought an argument about
networking as information acquisition: alone, a founder's bottleneck is finding
out, and the people close to the money — buyers, people who sell to them, people
who run the work, people already earning from them, people who know them — know
what a stranger cannot learn. What changed is small on purpose. A conversation
says in one tap who it was with, and only a buyer counts as one: who-buys had
been counting every conversation, a supplier's too. An introduction offered is
perishable work, so it waits on the Path from the next day until a conversation
is logged through it or the person says how it went, and lapses off after a
month rather than nag. What people said, in their words, goes to the model that
writes ideas and drafts — the person's own rows, so a number in them passes the
check that refuses invented ones. One play joins the books: five people close to
the money in a week, judged as The Mom Test judges, by what they committed to.
Declined: a file on every person, a weekly quota, and anything that messages
people for the user (invariant 4). It passes the survival test on the join — a
chat can say talk to suppliers; it cannot see that every conversation this month
was with a buyer, or that the introduction Mara offered six days ago still waits.
See COPILOT.md → **Proof**, conversations.

**Then** — asked out loud. Its owner wanted the mic to be something to talk to.
The half that is a conversation is Claude's; the half that is a question about
the record — how much went out this week, how the bet is going, what to do
next — is a count, and this app is the one place it can be counted. So the mic
answers those, out loud, and nothing else: a spoken question is matched to a
fixed list (by the app's rules, or by a model that may only say which question
it was), counted from the same rows the screens count, and read back with the
phone's own voice. The days are said in the answer, and when the rows do not
reach them the answer says what it counted instead. A question that needs
judgement is said to be one, and goes to Claude with the record. It passes the
survival test on the rows: a chat with memory can hear "how much did I spend on
coffee this week"; it cannot open the book. See COPILOT.md → **Ask your own
record**, asked out loud.

---

## Where it actually stands

Honest scoring against the "control loop" this is aiming at:

| Layer | State |
| --- | --- |
| Reality ingestion | **~30%** — Maps supply, manual notes, and bank statements read into rows (CSV, OFX, PDF, screenshot), which replace typed cash and burn. No bank link yet. Calendar is a button that does nothing. |
| State model | **~60%** — goals, capacity, runway from the bank, named cash obligations, who pays (named by the person), decisions, outcomes. Missing: projects, people. |
| Leverage engine | **~45%** — `scoreOpportunity` is a real, transparent formula, and there is now one decision a day. But it can only rank opportunities, because they are the only domain observed. |
| Execution | **~70%** — draft → approve → deep link → day-3 follow-up. Missing: calendar blocks, documents, workflows. |
| Verification | **~65%** — six outcome kinds, reply reconciliation, a funnel that flags work done outside it, decisions graded on a named metric. Nothing proactively asks. |
| Learning | **~60%** — type affinity, outcome affinity, and now the decision-outcome record with topic grouping. |

**The root cause of "it only ever advises outreach" is one sensor, not the UI.**
Everything observed is outbound supply, so the engine has one lever. The
cheapest fix that changes this is **named cash obligations** — expected inflows
and outflows with dates, entered by hand, no integration — which turns runway
from a number into a forecast and makes "collect the deposit" rankable against
"send ten messages". Calendar second. Delivery/projects third. *Since
20260929:* money is read off bank statements, so cash and burn are the bank's
and not a guess — the first sensor that arrives with its own history.

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

- **Whether a verdict changes what gets built.** Work now says which part of the
  business is the weak link and offers the work that would move it. If the parts it
  names are the ones projects get handed over for, and the states move after, the
  chain is doing its job; if the projects stay personal errands beside it, it is a
  better-drawn report. The count to watch is projects written from a part's move.
- **Swipe, not Matches.** The deck came back as a sixth tab (COPILOT.md →
  **Swipe**), because 57 of 76 drafts sat unsent and its owner named why: too
  little on each card, a message that was not written for them, numbers that were
  not on WhatsApp. What changed from the deck that was folded away is what "yes"
  is — the send, with the message on the card — not the gesture. After a release
  side by side its owner kept the deck and dropped the list; who is waiting and
  who replied moved into a sheet off the deck. Still open: whether it moves sends
  per session. If swiping goes up and sending does not, the deck made the app
  feel better and changed nothing, and that is the number to watch.
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
- **Unknown: whether people will give an app their bank statement.** The whole
  money read rests on it. Uploads are the low-trust path (read in memory, the
  file never kept, a typed DELETE removes every row); a bank link would be the
  high-trust one and does not exist yet. Five uploads from people who are not
  the owner would answer it.
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
