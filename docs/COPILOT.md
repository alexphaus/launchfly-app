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
| UI (installable PWA) | `src/app/copilot/` (bold) and `src/app/lifeos/` (calm) — two tabs; `src/app/copilot2/` — the four-tab layout, five tabs now (Path · Swipe · Proof · Money · You), calm |
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

So: **one notification a day, from the nightly pass only, carrying the call.**
The nightly pass is the cron, or "Run again" on You, which starts the same pass
early (see **Running the night now**). With no decision it stays silent. The
urgent-nudge fallback went with the nudges. `notifyPayload()` holds the rule
and is pure, so the gates are tested without a push service. `DailyResult.brief.pushed` reports how many
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

A second layout over the same app: **Path**, **Swipe**, **Proof**, **Money**,
**You**. It began as Today, Matches, Work, You, written from its owner's verdict on the
two-tab version ("too many things, nothing that stands out, the purpose lost from
the original mock-ups; Working? is a log"). Then every redraft of Work met the
same verdict — "static sections that compete for attention and nothing changes",
its content "gettable from today's call, the You tab or the handover" — and the
answer was that Today and Work were halves of one question. On a time axis they
are one stream: the Path. For one release the Path replaced both, with the
machine and the team moved under the numbers on You. Work came back beside it on
its owner's word — "better for separation, and has important features": the
Path is what to do and what moved, Work is the business being built. Money
joined them in October 2026 as the one screen of a budgeting app its owner used
(see **The money book**); the layout keeps its name. Swipe replaced Matches after
one release side by side: its owner lived with both and kept the deck (see
**Swipe**). The Lab joined in October 2026, when its owner asked whether this
could be the toolkit for someone who has just read The Lean Startup, and within
the month Proof replaced both Work and the Lab (see **Proof**): Work said which
part of the business was weak, the Lab ran the bet on it, and two tabs asked one
question in two places.

It is a layout, not a fork. `useCopilot` (`_components/useCopilot.ts`) holds the
state, the sheet stack and every action, and both `CopilotApp` and `CopilotApp2`
render over it, so sending, closing a mandate or answering the call cannot
behave differently between them. Every sheet is shared. `/copilot` and `/lifeos`
are untouched, so the two can be installed side by side and the one that gets
opened wins — the same reasoning that kept `/lifeos` beside `/copilot`.

| Tab | The question | What is on it | Pure module |
| --- | --- | --- | --- |
| Path | where am I, and what moves it | the evidence (what came back in the last two weeks, steps reached where they happened, steps ticked off the plan, graded calls, hours with the one swap, today's call once answered, the week, what broke) · you are here, in words · the one move, sized to your capacity, and what else needs you beside it · the plan: **drawn** for the person's goals when the server has a model (why this order, what changed, then this week → this month → this quarter → after that, milestones with what makes them done and tagged steps, then every goal) — otherwise the funnel plan (this week's steps, the milestones walked back from your first goal at your price, rate and capacity, the checkpoint, the goal) · the composer | `roadmap.ts`, `plan.ts`, `pathway.ts`, `today.ts` |
| Swipe | who is worth contacting, one at a time — yes or no | one card to the foot of the screen, the buttons and nav frosted over it: the photo, what and where, every reason, the post itself for a find, how they can be reached, and the message already written · right sends it, left is not for me · at the top, the way to everyone already written to (To send · Waiting · Replied, a sheet) · see **Swipe** below | `deck.ts`, `matches.ts` |
| Proof | is the business proven, and what is being bet to find out | what you sell, how buyers find you, and the verdict — proven, or the bar and the count against it — over the chain as five dots, the weak link named, and runway in bets · one bet at a time: the belief, the pass line written before it starts, the count from the rows or your own log, the play, the work done for it, and the one place its next count happens — or, with none running, ideas a model wrote for this business, plays from books, your own · the checkpoint every two weeks · assets: offer, demo, script, landing page, workflow, price test, each versioned, by AI or by you, tied to its bet · the history, everything above dated · conversations, projects and agents, a line each | `proof.ts`, `business.ts`, `lab.ts`, `assets.ts`, `history.ts`, `ideas.ts` |
| Money | where did it go | the balance, shown in the book's currency or another · the month's list, each day's header carrying what it cost, or the calendar (spent or balance per day) · what is pending · + to log a move | `money/book.ts` |
| You | how is it going | money, runway, deep work, replies · your money as your bank shows it, with the payers still to name · the week read back · goals · Records, what it reads instead of asking · settings, with the nightly run: "Run again" starts tonight's pass now, and the row reports each step | `review.ts`, `focus.ts`, `nightly.ts`, `money/ledger.ts`, `sensors.ts` |

`derive.ts` computes all of it once per `HomeData`, from `generatedAt` rather
than the clock, so the header's status line and the tab under it cannot disagree
(the old header said 61 over a card saying 51) and the server render and the
hydrating client agree across an hour boundary.

**The Path is a plan, not a log.** One line runs down the left of the screen,
outside the cards: solid through the evidence above "you are here", dashed
through the plan below it, because that half is a guess. It opens on "you are
here" with a little of the evidence above. The stream it replaced put everything
on one time axis and weighted the axis evenly, so what a person opens it for —
what now, and where is this going — was a short list under a long log ("mostly a
log of what already happened", in its owner's words). The rules are in `plan.ts`
(the forward half) and `pathway.ts` (the evidence), and a suite covers each.

- **Where you are, in words** (`pathHere`): "2 paying clients · 9 sent · 2
  replied · 2 paid" — never "Step 5 of 6 · 2 of 3", which was accurate and read
  as a puzzle. The ladder still decides where you are (`pathLadder`: say what you
  sell → first message → first reply → first paying client → `REPEAT_WINS`
  paying clients → your goal, each done by a count the funnel keeps); its step
  numbers are the app's structure and stay out of sight.
- **One move, sized to the time you set** (`pathNow`). An offer when there is
  none; today's call while it waits, because arbitration already weighed it; the
  drafts, because on an outbound path nothing moves until something goes out —
  "Send 25 of your 51 drafts, about 75 min of your 150", with what that is at your
  own reply rate, marked early under `RATE_SAMPLE` sends; then whatever a person
  is blocking — a question, an introduction somebody offered (the one thing here
  lost by waiting), a breakage, an approval, a reply with no ending; then
  the planner's first Move that fits your capacity; then businesses worth a
  message. The rest of what needs you is a chip beside it, at most `MAX_ALSO`.
  Once answered, the call is a receipt at the foot of the evidence, said in its
  metric's own unit (`metricLabel`: "$2", not "2"), and the move is the next
  thing — the answered card had the centre of the screen to itself before.
- **The plan walks the goal back through your own funnel** (`pathAhead`). It
  points at your first goal by priority, a money one when there is one: money →
  clients at your price (`priceOf`, the low end of what you wrote) → sends at your
  own rate (sends per client, from your rows) → days at your capacity
  (`sendsPerDay`, the same pace the move asks for). Between you and the goal are
  the ladder's rungs still ahead, each with what it takes, and the checkpoint:
  before `RATE_SAMPLE` sends, "at 20 sends the guesses become numbers", with what
  each result means; after, the funnel's own bottleneck. The goal says the gap,
  what it takes, how long at your capacity, and — when it does not get there —
  the pace you actually kept this fortnight. The goals past it are named with
  where they stand and no plan: a plan past the first goal is built on the first
  goal's guesses. Where a link has nothing under it — no price, no client, no
  reply — the stop says what would turn it into a number rather than supplying
  one (invariant 2). Arithmetic rather than a written roadmap is DIRECTION.md's
  survival test: an agent with memory can write "here is your plan to $1,500";
  "10 clients at your $150, about 45 sends at the rate your own 9 sends earned,
  two days of Deep focus" needs the ledger.
- **Capacity is visible.** The move's size, a milestone's days and whether a step
  fits are all read from the time you set. The header's pill says "Deep focus"
  and opens the setting (the funnel plan also says "Sized for Deep focus, 150 min
  a day"), a step longer than that says "Bigger than today", and changing it
  redraws the plan.
- **This week's steps are the planner's** (`pathNext`): the Moves it ranked
  (`worthDoing`'s split still holds), work it offers to do itself — opened in
  place with its plan on screen and one tap to hand it over, never approved
  unseen — and projects under way. Each carries the planner's reason, the Move's
  `why[0]` or a project's `why`, and a step that came without one gets none.
- **The evidence is only what teaches something** (`pathEvents`, `EVIDENCE_DAYS`
  = 14, the last `MAX_PAST` behind "Show earlier"): every reply, meeting, payment
  and no; a call the ledger read back (`worked` or `no_movement` — until graded a
  call is a claim); a project's result, when the *worker* posted it
  (`WORKER_CLOSE_MS`); hours you logged, on the day worked; a step reached. Not
  what the app did — finds, drafts, a project's steps, a Move ticked off — and not
  a send on its own, which teaches nothing until something comes back. What the
  app did is under Projects and Agents on Proof. Days before this week carry their date ("Sat 12 Sep"): a
  weekday alone named two Saturdays. An empty fortnight says so, with the sends
  that explain it.
- **A step reached is a moment where it happened**, directly under the answer or
  payment that reached it — placed rather than sorted, so rows at one instant
  cannot come between them. It is dated by the diagnosis's all-time `firsts`
  (`sent_at` and `occurred_at` off the rows the funnel counts, `FIRST_WINS` of
  the wins), so "first reply" is the reply that was first, and it says how long
  it took ("12 days after your first message") rather than a step number. A goal
  carries no date, so once it is met the next goal is the step
  (`input: 'next-goal'`).
- **What broke** sits at the foot of the evidence, just above "you are here": a
  nightly job that never ran, a failed check, failing sources, and a failed read
  of the ledger the evidence is built from (`recent.unreadable`), so a quiet
  stretch is never read as a quiet week (invariant 13). The week's dots count days
  you moved it forward — a send, an answer you logged, a Move done, never an open
  (`pathWeek`) — from sends read by date (`recent.sentAt`), not from the
  pipeline, which holds only the 200 best-scored businesses and missed sends to
  the rest.
- **What changed since you looked** (`planChanges`): steps new since this device
  last showed the plan are marked New; each step that left is named with what
  happened to it, read off the rows — you did it, you said no, handed over,
  finished, called off, now today's call — and the one reason with no row behind
  it is said as exactly that: the last run replaced it. A step reached since then
  is a chip under "you are here", named rather than numbered. The snapshot is
  the whole plan, not the steps on screen (a step that moved up is not new), kept
  per device (`cp2.path.seen:<profile>` in localStorage) because it is a
  convenience about the screen and nothing is decided from it. No snapshot, or one older than
  `PATH_DAYS`, is no change — a first visit is not "everything is new", and a
  diff that can only say "gone" has said nothing. A browser that keeps nothing
  says so under The plan (invariant 13).
- **One suggestion, and only with two facts** (`pathSwap`): at least
  `SWAP_MIN_MINUTES` this week on one thing that is not outreach, next to what
  sending brought back. Nothing sent with drafts waiting: send those first.
  Sends being answered: try `SWAP_HOURS` of those hours on sending. Sending with
  nothing back yet has no second fact, and says nothing; the app never claims to
  know what the hours were worth. It sits in the evidence under the hours it is
  about, and "Keep it" holds for `SWAP_KEEP_DAYS` on this device.
- **"Back to now"** floats above the nav while "you are here" is off screen,
  pointing the way it is. Measured on scroll: an observer fires only when the
  node crosses the edge, so a fling past it left the arrow pointing the way it
  came. Portalled into the frame, like the toast — a sticky element is held
  inside the list's padding, and that padding is where the floating nav is.

**The plan is drawn, not walked back** (`roadmap.ts`, `agent/roadmap.ts`,
`PathPlan.tsx`). The funnel plan above — first message, first reply, three
paying clients, the goal — was the same ladder for everybody. It told someone
saving for a €60,000 property renovation "11800 clients at your €5", and it
told someone applying for jobs how many sends to their third client. Its owner's
verdict: static, hardcoded, centric to outbound; what was wanted was a plan that
understands the goals, puts quick wins before the long pulls, names milestones
and the actions with leverage, and redraws as things work or do not.

So a model draws it: phases (`week`, `month`, `quarter`, `later`), at most
three milestones each, each an outcome with a `done_when` a person can check
and at most three steps, every step sized (`quick`, `sitting`, `days`) and
tagged (quick win, high leverage, groundwork), plus one line on why this order
and one on what changed. The rows keep it honest, by structure rather than by
asking nicely:

- **Every number is the input's.** `unsourced` reads the plan against the
  prompt the model was shown (ids and the digits of dates taken out, and not the
  system text), numbers written as digits or as words, and months. A line with
  one the input did not contain is dropped whole, and the row records how many
  (`withheld`). Where a line sits decides what a small number means: in a step
  or a milestone (`target`) "send three" is an instruction and passes; in a
  reason, where you are, why this order or what changed (`claim`) it is an
  assertion and needs a source, and a small bare count must match a bare count
  in the input, not a price that happens to share its value. "A 20% reply
  rate", "€3,000 by March", "in 45 days", "five sales cover the fine" and "by
  mid-October" do not pass (invariant 2). Only "one" is exempt everywhere. The one piece of
  arithmetic handed over is a money goal said in clients at the person's own
  price, so the planner can see that €5 pieces do not close a €59,000 gap.
- **Done is a tap.** A step or milestone is done when a `roadmap_marked` event
  says so; the model is shown the ticks and cannot write one. The newest mark
  per item wins, so undo is another mark. A tick is evidence on the Path and
  counts as a day moved in the week's dots.
- **The record goes back in, the view does not.** The next draw sees the last
  plan's titles and ids and what the person did with each — never its `here`,
  `direction` or `why` (invariant 12). Ids are carried, by id or by title, so a
  tick survives a redraw.
- **`who: 'ai'` only with a worker connected** (invariant 7), and "Hand it over"
  writes a draft commission that still needs approving.
- **A failed draw is said beside the plan it could not replace**, and a plan
  that never landed says why (invariant 13). The row is the record: a `running`
  row older than `ROADMAP_STALE_MS` reads as stopped.

When it is redrawn (`roadmapDue`): opening the app draws only when there is no
plan or when what the person *said* changed — goals, the working file, a note in
the composer, capacity, the offer (`roadmapSignature`) — and not for an hour
after a failure. The nightly pass (step 5, "Plan", on You) also redraws when an
outcome or a tick landed since the last plan, and once `ROADMAP_MAX_AGE_DAYS`
have passed; otherwise it reports "Kept your plan". A tick never redraws the
plan under the thumb that ticked it.

With a plan, the plan decides whether the drafts go first. It is told they
exist (count and age) and asked to make sending them a step or to fix the opener
first. The move is whatever a person is blocking, then the plan's first open
step of the person's own that fits today (`roadmapFirstStep`), ahead of the
planner's Moves, and one tap marks it done. The drafts are the move only when
that step is about them or nothing of the person's fits today; otherwise they
are a chip beside it. This was added after Alex's plan said to rewrite the
opener before sending more, while the card over it said "Send 25 of your 56
drafts" written with the old one; a blank offer is no longer the
move by default, because the plan decides whether selling is on this person's
path. "You are here" is the plan's own title and line, with the send counts only
once something was sent. The planner's Moves and projects stay, under this week,
as "Also in motion". The goals it works on are shown at the end, in the person's order,
with how many milestones lead to each; the first always shows, and the rest are
one line, "4 more goals wait", that lists them on a tap (`goalLayout`) — five
rows in a row saying "nothing on the plan leads here yet" were one fact said five
times. "For <goal>" on a milestone only where the plan serves more than one
goal. Reasoning cut for length ends at the last whole sentence, never
mid-thought. The empty evidence agrees with the week's dots under it
(`quietEvidence`): a day moved with nothing back yet says so, rather than
"nothing recorded".

**One planner, not three.** The call, the Moves and the plan each answered
"what should I do", and they agreed by luck: Alex's plan put the exit fund and a
rewritten opener first while the call that evening was a maintenance-coordinator
application. Now the nightly pass draws the plan after the jobs and before the
brief (`NIGHTLY_STEPS`: supply, reconcile, jobs, roadmap, brief), and the call is
the plan's next step (`planCall`) — topic `plan`, no metric, graded done or not,
with the Move arbitration would have promoted named as what it was chosen over
and left open on the list. Only money due within `MONEY_WAITING_DAYS` (a deposit
owed, a client who paid — `moneyWaiting`) still takes the call from the plan, and
only from the jobs that mean it (`MONEY_DUE_JOBS`: `obligations`,
`client_delivery`). A stake's value is not always money owed. The send queue
values ten sends at what sends have earned and dates them by when the drafts go
cold. It passed as money due tomorrow, every night, and kept "send 10 of your 57
drafts" over a plan that said the opener behind them had never been answered. A
blank offer no longer forces the offer call when there is a plan: that rung
keeps drafts from being written from nothing, and a plan step is not a draft.
"I did it" on a plan call ticks its step (`stepForCall`, found by its words —
no column needed), and a tick that did not save is said in the toast. The plan
is shown what the checks found (open Moves, proposals excepted, since a model
wrote those), so it can plan around a client waiting or money owed.

**The plan points the searching.** What finds matches and what ranks them were
never told where the person is going, so they looked for buyers of the offer
while Alex's plan said "a job offer" and Maria's said "market days booked".
`planFocus` — the open milestones this week and this month with their unticked
steps, titles only — now goes to the search planner (`planPrompt`, whose system
text puts the plan first: an organiser for market days, an employer for a job)
and into the brief's pack as `plan`, with a `PLAN:` section telling the ranker
to score a candidate higher when reaching it serves a line of it. Nothing is
still planned from a blank offer (invariant 1), so a plan with no offer behind
it changes the ranking of what exists but starts no search.

**What you tell it can tick, but only you tick.** A note in the composer
redraws the plan, and the draw may name items of the last plan, still open, that
the person's own words say are done (`probably_done` → `suggestedDone`, held to
ids that were open and are still on the plan). The Path asks "From what you told
it — did you finish this?" with "Yes, tick it" and "Not yet". The model never
ticks; the answer is the person's tap (rule 2). Before this, telling the app
"booked two markets" left the step open until somebody found it and ticked it too.

**Whether it can work, said first** (`outlook.ts`). The drawn plan put the
goals in a sensible order and never said whether the order could get anywhere in
time. "Ten sales at $150 before November, from nine sends and no rate yet" was
the whole question, and the planner could not ask it: it may not do arithmetic,
and it did not know how many days were left. So `goalOutlook` does the
arithmetic from rows — gap, days left, the pace needed, and for a money goal
somebody sells toward, sales at their price and sends at what their sends have
*earned* (money per send, so two $1 wins are not two sales at $150) — and gives a
word: on track, tight, off track, too early to tell, no date, no number. Before
`RATE_SAMPLE` sends it is too early, and it says what would tell ("11 more and
the rate is a number"). Never a probability (invariant 2). A goal with no number
is measured by the plan's milestones for it. The lines go into the planner's
prompt, which is what lets it cite them past the number guard. The Path shows
the verdict for the goal the plan leads with (`roadmapLeadGoal`: its first open
milestone's goal, else the person's first) under **You are here**, as a pill,
the goal and the line; every goal's verdict is also on its marker at the foot of
the plan. It was a card per goal above the plan, which said each verdict twice.
The planner is told that an off-track goal changes the approach, the size, the
target or the date, not the effort, and that the verdict is shown beside
`here`, so `here.line` does not restate it.

**What the record says** (`outlookSignals`). Stop-or-change evidence, computed
from rows with thresholds that already mean something here: an opener with
`RATE_SAMPLE` settled sends and fewer than `WORKING_REPLIES` replies (the
funnel checkpoint's own rule, and silent below it — nine sends is a bad week,
not a verdict); calls made again and again and never done, or done and nothing
moved (`decisionReview`); steps carried `CARRIED_PLANS` plans in a row and never
ticked — one line for all of them, since three rows of "On 3 plans in a row and
still not done" were one fact said three times. The planner must answer each, in
`changed` or `direction`; the lines ride with the plan (`roadmap.signals`, never
written by the model) so the Path shows the evidence beside the answer, folded
to **What the record says** with the first line in view.

**One experiment at a time** (`experiment.ts`). One sample from one prompt
returns the most likely plan, and the most likely plan is the one the person
already had — which is why the drawn plan read as their notes, reordered. So the
planner is asked to weigh at least eight candidates across fixed angles (stop
something, go where it is asked for, one move for two goals, change the size,
test it fast, use what you have, ask one person, change the channel), throw out
anything already in their notes, the plan or an earlier experiment, and offer the
one with the most evidence and the cheapest test — or none: "a plain week beats a
clever guess". It must carry evidence (a claim, number-guarded), a test sized to
a day, what would show it worked, and a check date; `isNovel` rejects a
restatement. An open experiment is carried unchanged by every redraw. One nobody
started in `OFFER_DAYS` is recorded as not tried — inferred, never asked
(invariant 5); two set aside in a row pause the offers for `PAUSE_DAYS`. The
verdict is the person's tap (it worked, it did not, could not tell) as a
`roadmap_experiment` event; it shows in the evidence, and the ledger by angle
goes to the next draw — "change the channel: tried 2, worked 0" — which is told
never to offer an angle that failed twice. A record, not a trained model, with
one person; shaped so many people's could be pooled.

**Real dates** (`due.ts`). `horizon_days` is written once — 90 by default, and
the goal sheet had no date field — and six places read it as days left: the funnel
plan, the goal-gap Move, the proposer, the per-source judge, the brief's pack and
the Claude handoff, plus "Within 90 days, as you set it" on the Path. The date is
`created_at + horizon_days`; the sheet's **By when** stores the horizon that lands
on it (no migration), a new goal left undated is undated rather than defaulted,
and every reader asks `goalDue` for the days left today. The planner is told
when a date is the table's default rather than one the person picked.

**The call follows the plan.** The call is picked once, by the brief; a plan can
be redrawn after it. A redraw now re-picks today's call if it is still
unanswered (`refreshCallFromPlan`, `replacesCall`), in place and conditional on
`response = 'pending'` in the write itself, so an answer is never overwritten.
Money due this week keeps its call. Until the server catches up, the Path does
not put a call the new plan has overtaken over it — the same rule, in `derive`.
A call that did not save says so (the nightly report, the brief route's toast,
the run row) instead of going to `console.error`.

**The agent's side.** `COPILOT_AGENT_CAN` says what the connected agent can
finish alone; the planner hands it steps within that, never contacting, posting,
applying, spending or signing. A step it can do carries **Hand it to your agent**
in plain sight: one tap writes the project with its goal and a plan ending in "report back
with links, checked against" the milestone's done-when, approves it (read
authority), and dispatches it in `after()` — not at 21:00. Approving a project under
Projects also starts it now. The step then says where the project stands and opens it;
the tick stays the person's.

**The Path reads light.** Each block above was right, and together they buried
the steps: its owner called the Path heavy and overwhelming, with text at 10–12.5px
beside 19–21px titles. At 390×844, with a fixture shaped like his account, the
tab was 4,526px tall and the first step sat 2,353px below "You are here". Now
it is 3,423px, and the first step is 1,126px down. The rules that did it:
- Everything above the steps folds to a line: **Why this order** (two lines),
  a failed redraw (what happened, two lines of why, **Try again**), **What the
  record says** (a count and the first line), **Redrawn** (the counts). Each
  opens on a tap, so nothing is hidden, only folded. Invariant 13 holds: a
  failure's title and reason stay in view.
- This week opens one milestone, the first still open; the rest fold to their
  count of steps. A milestone's reason shows only while it is open. The
  experiment sits after this week's steps, not in front of them.
- The call card on the Path is `CallCard compact`: the call, its first reason,
  what to do and the three answers. The rest (other reasons, what it was chosen
  over, what would change it, not today, the read) folds under **Why this
  call**. /lifeos and /copilot render the full card, unchanged.
- The Now card for a plan step says which milestone it is toward, not why: the
  reason is on that milestone, open, a few rows down.
- The swap is not shown over a drawn plan. It only ever says "send the drafts"
  or "move hours to sending", and with a plan that is the plan's call.
- Type: 15px for what a row is, 13.5px for what it says, 12–12.5px for labels,
  times and pills; nodes 32px with 16px glyphs (30/15 small). Shared classes are
  resized only under `.cp2-frame`, so the calm theme at /lifeos does not move.

**What the planner writes is shorter, tied to goals, and read twice.**
`ROADMAP_SYSTEM` caps each line (here.line 25 words, a milestone's why 20,
direction 240 characters), asks for each fact once, and does not ask `here.line`
to restate the verdict. Every milestone carries the `goal_id` of the goal it
serves. The parse accepts the id with its brackets, and with a single goal an
unassigned milestone serves it; unassigned milestones were why every goal under
a plan said nothing led to it. A reply that came back and does not parse
(`UnreadableJson`, from `extractJson`, which also forgives a trailing comma for
every caller) is asked for once more, with the parser's message, when there is
still `RETRY_MIN_MS` of the draw's budget left. A broken page of JSON was the
commonest way a redraw failed, and it cost the plan until the next night.

Stored without a migration: the draw is a `copilot_agent_runs` row of kind
`roadmap` (plan in `output.roadmap`, the signature in `input_summary`) and a tick
is a `copilot_events` row of type `roadmap_marked`. With no model configured
(`resolveLlmConfig()` null) and nothing ever drawn, the Path renders the funnel
plan exactly as before and says nothing about a plan it cannot draw.

Today's parts all have a place, so nothing it did was lost: the call is the move
while it waits and a receipt once answered; "needs you" is the move and the chips
beside it; "worth doing" is this week's steps; and "done for you" is split by
what it was — an answer is evidence (a reply `reconcileReplies` matched is the
world's, never reported as the user's work), and the app's own activity is its
team's line on Proof. Old links to Today (`?tab=today`, `?tab=now`) land on the
Path.

**What was the Matches tab is the deck's supply now.** Matches was a filtered
list of the same people, pills for where each one was, and the paragraphs below
were written for it. Swipe replaced it (see **Swipe**), and the rules for what is
shown are the deck's, since `deckCards` deals from the list `matchFeed` judged.
Every answer still feeds the same keep rate the ranker orders by. No
percentages: the fit score orders the list and is never printed, because a "92% match" badge is a guess dressed as a
measurement (invariant 2). Targeting drives businesses only: with none set, feed
finds still show, under a note that says no businesses are being searched for —
otherwise someone who watches job feeds would see finds counted on Today and
have nowhere to open them. "Keep" on a feed find toasts "Kept.", read off the
queue the route returns; it used to say "Drafted" over a queue with nothing new
in it.

**Serve, not configure.** Two rounds of this tab put the search on the screen —
first a "Looking for" card and a fold of poor fits with a card explaining them,
then a sheet of "hunts" to write and manage — and its owner's verdict on both
was the brief for what it is now: the app works out what to look for, judges
what it finds, and shows the verdict; the user acts, in one tap. Nothing on the
tab asks them to set anything.

**Only what clears the bar is shown.** The ranker scores each candidate 0–100
against the offer, goals and constraints, and is told (agent/schema.ts) that 60
means "tell them to contact this one this week" — only those are shown — and
that below 60 it should give the reason not to. `SHOW_FIT` (60) is that line in
code (`belowBar`). A listing below it is not folded, counted or explained on the
tab; it stays in the pool, the funnel still counts it, and the search planner
reads it as unwanted when deciding which searches to retire. An unjudged listing
is not below the bar, because the heuristic is not a verdict. When nothing
cleared it, the empty state says so in one line ("It went through 8 and none
were worth a message") and Today reports the night as "Looked at 4 new
listings — none worth your time" rather than a tick over nothing. "Overnight",
"it keeps looking" and "every night" are said only while the nightly job has
run inside `STALE_NIGHT_HOURS`; a job that never runs does not keep on, and
Today already says so. The header counts the list it sits over. The business
sheet never prints the score as "% match" (invariant 2).

**Everyone already written to, in a sheet** (`v2/Outreach.tsx`). To send ·
Waiting · Replied, from `stageCards` over the queue (in the queue's own order)
and the pipeline's `sent`, `replied` and `meeting` rows: the Matches tab's other
three pills. A deck is the wrong shape for them — "they replied" is not a yes or
a no, and who you are waiting on is read, not swiped — so they are a sheet,
opened from the top of the deck (`outreachLine`: a reply leads, since it is what
goes cold, then who you are waiting on, then drafts), from the Path's "send the
drafts" ask (on To send) and its replies row and the week's review (on Replied
or Waiting). Each card does the one thing that moves it. **A draft is sent from
its own card**: the button is the draft's deep link (`StageCard.link`, wa.me or
mailto, pre-filled), `markOpened` records the tap, and the card asks "Did it
go?" in place — Sent logs it (`markSent`), Not yet puts the button back. Where
the copilot owns the identity the draft would go out under, the button sends it
instead (invariant 4). To send keeps "I am not sending these". Answering a row
keeps the sheet open (`{ stay: true }` on `markSent`, `sendAction` and
`recordOutcome`, which otherwise close the sheet they were answered from), and a
stage emptied by the last answer moves on with the person: the last draft sent
to Waiting, the last reply to Replied. Won and lost are over and are not on a
list of people to chase.

**A card says what it is, where, and why.** A tile first — the listing's photo
when Maps returned one (`image_url`; older rows have none), initials on a
per-title tint otherwise, a glyph for a feed find — then one line of what it is
and where (`placeOf`, with the region, so a wrong Toledo is visible at a
glance), then the ranker's reason, then the action. The category replaced the
segment as the label because the segment is a search term and can be wrong: on
one live account it was the letter "m". A one-letter segment is refused at every
write path (`isSearchableSegment`) and named back when it is.

**Proof: is it proven, and what is being bet to find out** (`proof.ts`,
`v2/ProofTab.tsx`, `v2/ProofSheets.tsx`). It replaced two tabs. Work was the
business as a chain of bets — the verdict, the parts, the weak link, the
projects, what was built — and the Lab was one bet at a time on that weak link.
Its owner found them answering one question in two places: the verdict on one,
the bet that moves it on the other, and a checkpoint on the Lab read back against
a chain drawn on Work. The brief for the one tab: replace both; not only for a
business that sells by outreach, which is how the owner's account runs; powered
by a model so it is not the same tab every time it is opened; clean panels;
assets as first-class things, each with who made it, its version and the bet that
produced it; and the history in one place. The rule underneath all of it is the
app's usual one: **a model proposes, the rows judge**. A model writes ideas for a
bet and drafts of an asset; nothing it writes decides a verdict, and nothing it
writes is the person's until they keep it.

On the screen, top to bottom:

- **The verdict.** What you sell, how buyers find you, proven or not — "Proven at
  3 paid at your $150. So far: 0." — and the chain as five dots in a row, each with
  its state's word, the weak link named under them with its rule. A tap opens the
  chain whole (the parts below). Under it, runway in bets and the last checkpoint
  read back. "Since you last looked" names a part that moved, per device, under
  the key Work used, so what a device saw there carries over.
- **The bet**, one at a time — or the checkpoint, or the way to pick one.
- **Assets**, the gaps first, each with who made the version in use.
- **History**, the four newest; all of it, by month and kind, behind a tap.
- **Behind it**: conversations, projects and agents, a line each.

**Five parts, each a bet with a rule** (`business.ts`). Who buys, how they hear,
how they say yes, what they pay, how you deliver. Each carries what it is in the
person's words, what the rows show, who runs it, and a state by a rule written out
beside it with its numbers: works · testing · not working · untested · missing.
The thresholds are the app's own: `WORKING_REPLIES` replies in every
`RATE_SAMPLE` sends (the funnel checkpoint), counted per whole batch so two by
twenty-five clears it and two by a hundred does not; `REPEAT_WINS` wins is
something you can repeat; and from `CLOSE_SAMPLE` (`MIN_SAMPLE`, five)
conversations, nobody paying says more about the ask or the price than about
luck. **Proven means paid, three times, at the price you set** — the owner's
account had two wins at $1 each, and a count of wins cannot tell those from
sales. **The weak link** opens by itself (`weakLink`): a part further down that
failed on its own evidence binds everything above it; otherwise a part nobody has
said, since it costs a sentence; otherwise the first part of the funnel that does
not work yet; delivery only once selling works. **What would move a part** is a
sheet of yours, a project for your agent (written as a draft and opened on its
approve button), a question for Claude with the whole record pasted, a bet on
that part, or an asset to make — and an agent move becomes a Claude one where no
worker is connected (invariant 7) or three projects are on the go. An agent that
failed says so on the part it stopped (invariant 13).

**How buyers find you** (`offer.found_by`: outreach · inbound · referrals ·
marketplace · local) decides how the chain is read. The app counts outreach
itself — finds, sends, replies. Every other way it cannot see buyers arrive, so
it does not pretend to: who buys is read from the conversations logged, sales at
the price and bets that passed; how they hear from the person's own bets on it —
two passed is a pattern, one passed with a sale is the channel doing its job, two
short in a row is not working; how they say yes and what they pay count the
conversations logged where the funnel counts meetings. Said beats read: unsaid,
it is outreach once the app has found or sent anything for the account, and
otherwise nobody knows — the chain asks rather than defaulting to outreach, and
the screen says when the channel was read rather than said. The owner's account
reads exactly as it did. It is set on its own sheet or on the offer sheet, kept
when the offer is saved without it, and is not part of the offer's history: no
message says it.

**One bet at a time, judged by the rows** (`lab.ts`). A part, a belief in a
sentence, something countable, a line and a last day, said back as the pass line
before Start — "1 sale at your $150 by 12 Oct, from 10 messages sent". It starts
on the person's own today; nothing before it counts. There is no "mark it
passed": neither route has an action for a verdict, and a test fails if one
appears (invariant 10's reasoning). It passes the day its count reaches the line,
and its counts close that day; it fails when its last day goes by short; a
call-off keeps what it counted and a line on why, and does not undo a pass.
What it can count is what the funnel counts — sends, replies once per business,
meetings, wins, projects finished — the conversations the person logs, and **a
count of their own** (`logged`, with their word for it: "sign-ups", "enquiries",
"walk-ins"), logged per bet and per day inside the bet's days, for the ways in
the app cannot see. A logged number never reads as a measured one: the line
under the count says where it comes from. Sends and replies are not offered to a
business whose buyers do not come through them (`metricsFor`), and a play's plan
counted in sends is dropped for one (`playFor`) — the line stays. One at a time,
because two bets share every count; the server refuses a second, and refuses any
while the record cannot be read.

On the card: the count and the bar, what it took so far (quieter: it is the plan,
never the verdict), the play, and **the work done for it** — the projects tied to
it (`lab_link`, written when a project is handed over from the bet or its prep),
the assets made for it, and the conversations or counts logged since it began —
so a bet with nothing done for it on day nine says so. **Get it ready** is the
play's prep: an asset drafted by AI for the bet or written by you, or a project or
a chat as before. **Hand part of this bet over** writes a project tied to it.
And **the one place its next count happens** (`betNext`): Swipe for sends and
replies; who replied, for a sale or a meeting where buyers are written to; a
sheet to log a sale, a meeting or a count where they are not — a sale logged
there carries no business and lands on the goal like any other.

**With none running**, the card asks what you believe that you have not tested,
on the weak part first, with the last bet's result. First come **ideas a model
wrote for this business** (`ideas.ts`, `proofai.ts writeIdeas`): three, from the
person's words, the chain with its rules and numbers, the bets already run and how
each ended, the conversations logged (who they were with, and what people said
in their words) and the assets there are — asked for once a
visit when there are none, or when the record has moved since the last were
written (a bet ended, or two weeks went by: `ideasStale`), and again on a tap.
Each is held to what a bet is before it is kept — a count this business can keep,
a line in range, a plan that is the step before the count, no placeholder — so
any idea on screen can become a bet as it stands. A reason that cites a number
the person never gave loses the reason; a book not on the list is not named. Then
**plays from books** (`PLAYS`), filtered by how buyers find you: The Mom Test,
Crossing the Chasm, Traction, $100M Leads, The Lean Startup, Building a
StoryBrand, The Referral Engine, Never Split the Difference, $100M Offers,
Million Dollar Weekend, Built to Sell, The E-Myth — each something to do with a
count, never advice dressed as a test. Then your own. Without a model on the
server there is no ideas button at all (invariant 7); the books are there.

**The checkpoint** asks pivot or persevere every two weeks, once a bet has ended
since the last answer, kept with the chain as it stood and read back next time —
a pivot against the part it changed, persevere against the whole chain. **The
clock** is runway in bets: the runway the bank gives over the pace kept (the
median gap between bet starts).

**Assets** (`assets.ts`): the offer, a demo, a script, a landing page, a
workflow, a price test. An asset is an identity and a list of versions; each
version says who made it (AI or you), when, from which bet or project, and holds
a link, a text or both. Nothing is edited in place: a change is the next version,
and the history is the list. **The offer** is one asset with a fixed id. The
profile row keeps the version in use, because every draft is written from it
(invariant 1), and every save records a version — the first save records the
offer it replaces too, undated, because it was written before the history began
and a date it does not have would be invented. A version the AI wrote is not the
offer until the person makes it theirs (`adopt`), which goes through the same
save that rewrites the waiting drafts; how buyers find you is kept as the person
said it. An offer changed where the history does not reach shows as the version
in use, undated. A demo with a link can be made the proof every message carries.
**Gaps** are the assets missing where they would matter now, two at most, the
weak part's first: no demo while the price is unproven, no landing page where
buyers find you online, no script while closing is stuck, no workflow once
selling works. **A draft by AI** (`proofai.ts draftAsset`) is written from the
offer, the working file as written, the part it is for, the bet, and what people
said in the conversations logged — nameless and never quoted, because an asset is
read by strangers and a name in it reads as a testimonial nobody gave — and is held
to the rule a message is (deck.ts `checkDraft`): no placeholder, no link the
person did not give, and no number that is not in their words or rows
(`numberOutside`; a step's number, a duration and a time of day are
instructions, not claims) — refused, not repaired, and the screen says which.
Only the two newest bodies per asset travel with the home payload; older ones
are fetched from `/api/copilot/assets?id=` when opened. A read that fails is said
and no version is written over it (invariant 13).

**History** (`history.ts`) is the gap its owner named: every record had its own
screen and its own clock, so "what did we try last month, and what came of it"
had nowhere to be answered. It is built from rows that already exist — nothing is
written for it, and nothing in it is a model's summary: bets started and how each
ended (one that did not pass stays: it is the cheapest lesson the business
gets), checkpoints with their line, conversations that ended in a commitment (a
compliment is not history), every dated asset version with who made it,
projects finished or stopped, sales with their amount and who where known, and
the plan's experiment verdicts (not the ones the app inferred). What the person
wrote they tried before the app is at the foot, in their words.

**Conversations** (`lab.ts`) are The Mom Test's log, and the one place the
person brings in what the rows cannot see: who, when, whether they have the
problem, what they committed, their words — and **who they were to the
business**, a tap: could buy, sells to them, runs the work, already earns in it,
knows people. Alone, a founder's bottleneck is finding out, and the people
around the money know what a buyer will not tell a stranger. Only "could buy" is
a buyer: the chain's who-buys, and the conversations its close and pay parts
count, are buyers alone (`talkTotals`) — a supplier counted as a buyer made who
buys look tested by people who never could. A conversation logged before there
was a choice was logged as a buyer's (the sheet said so) and reads as one; so
does a cached payload with no role. The problem is asked only of a buyer or
whoever runs the work. Bets still count every conversation — Five people close
to the money is judged on them — so no verdict already given moves. The log
counts the month's conversations by who they were with, the empty kinds shown
rather than hidden; when every one was with a buyer it says so and offers that
play. **An introduction** offered in a conversation is perishable: from the next
day it is in Needs you on the Path, right after a worker's question, until a
conversation is logged through it (`via`, checked against the record, never
taken from the request) or the person says they asked for it or it fell through
(`lab_intro`, the last word winning). A conversation logged through it closes it
whatever was said before; after `INTRO_DAYS` it lapses off the Path rather than
nag, and stays on its conversation. The history says who opened the door. **What
people said** goes to the model with who they were and the month's counts by kind
— named for ideas, so one can say whom to go back to; nameless for drafts. It is
the person's own rows, so a number in it is one they gave and passes
`numberOutside`; the prompt says one person's number is not a rate. Nothing here
keeps a file on anyone, sets a quota, or messages people for you (DIRECTION.md).

**Behind it**: the conversation log, with an introduction that waits said on
its line, the projects — the box to hand anything over or
copy it for Claude, the projects on the go with a question answered or a
breakage retried on the card, what the app offers to take on, and what finished,
with the bet each was for — and the agents as one line, the roster folded under
it.

**The Path keeps its job** — the plan, the call, the day's move — with three
links to Proof: the bet running (or a checkpoint due) as one line under "you are
here"; the plan's experiment can **become the bet** ("Or make it a bet, and let
the rows judge it"), opening the bet sheet with the experiment's test, check days
and the part its kind works on; and an experiment made a bet shows the bet's
progress or verdict instead of asking for a tap. When the bet ends, its verdict
becomes the experiment's (`experimentVerdicts`: passed is worked, did not pass is
failed, called off is could not tell), written by `settleBetExperiments` before
the next plan is drawn, so the planner hears what the rows said. An
introduction that waits is in Needs you, as above.

Stored without a migration, as `copilot_events` rows: the bets' `lab_bet`,
`lab_bet_stopped`, `lab_talk`, `lab_checkpoint`, `lab_count`, `lab_link`,
`lab_ideas`, `lab_intro`, and the assets' `asset_version`, `asset_retired`,
`asset_restored`. A read that fails is said on the tab and never drawn as empty.

**You asks three questions of the week** — what created value, what was wasted,
what has to change — and answers each from rows (`weekReview`). Money is never
summed across currencies; a queue is waste only once it has sat
(`STALE_DRAFT_DAYS`); a job key is never printed (`phrase.ts`, which also fixed
"calls about send_queue" on the old Working tab's export path). The call record
is cut to the week here, not by the caller, because the section is headed "This
week". A thing done is a call answered "I did it", a Move marked done — but not a
feed find (Keep and Did it both write done and cannot be told apart) or a
proposal (done there means handed over) — or a step ticked on the plan; a plan
call's tick and the call are one line, said as the call. A mandate
counts as closed with nothing to show when its ledger row says `nothing`, or when
it was stopped with no verdict at all; the sentence `closeCommission` writes is
read only when the ledger row is missing, matched against `worthSentence` itself. An empty block
says why it is empty, and `recent.unreadable` names any read that failed, so a
broken read never renders as a quiet week (invariant 13). The funnel, openings
and segments left the tab; the funnel is still one tap away as the chain on
Proof, and "Ask your own record" still answers by counting.

**Line by line, and the cards move.** The value card used to answer in sentences —
"You did 2 things it put in front of you — Apply today to the Maintenance
Coordinator role — it is scheduling and coordination for property maintenance,
the same muscle as your booking automation work +1" was one line, six lines tall
on a phone, naming one of the two things — and waste and change were, in their
owner's word, static: standing counts that moved only when the pile did, and one
sentence per funnel stage, the same every week the funnel stayed stuck. Now:
- **Every line is a glance and opens** (`ReviewLine`): each thing done is its own
  line (at most `MAX_DID_LINES`, the rest one line that opens), and a group — the
  wins, the replies, the hours — is one line with its rows behind it. Opened, a
  line shows where it came from and what came of it (a call's read-back, in its
  metric's unit), or the rows it was counted from: each win, each reply, each day
  worked with what it was on, the oldest drafts with their ages, each failing
  source with its error, the calls a topic counted. Opening never navigates; the
  way somewhere is at the foot. A group of one opens to its note rather than to a
  list whose only row repeats the line.
- **Waste says what moved** under what is standing: the drafts line carries sent
  this week and how many have sat `COLD_DRAFT_DAYS` or more — send-queue.ts's
  COLD_AFTER_DAYS, held equal by a test — a count that grows every day nothing is
  sent and drops the moment something is. Deep work says whether it is up or down
  on the week before, the one comparison on the card.
- **The change counts its own experiment.** `GrowthEdge.measure` sits beside the
  sentence it counts ("send five" is five sends, "the next ten" ten sends, "the
  next five replies" five replies; a test reads the number word against the
  target) and You reads it against this week's rows: "2 of 5 sent this week", then
  "5 sent this week — done", then the half a count cannot see ("now log what comes
  back") and a button to it. No sends on the payload is no meter, never "0 of 5".
  Nothing is ticked for anybody: the count is the ledger's.

**Deep work is the one new sensor.** It was asked for and nothing could supply
it, so it is logged by hand (`POST /api/copilot/focus`) and stored as
`copilot_events` rows of type `focus_logged` — no migration. Not a context item,
deliberately: those are read into the brief newest-first under a cap, and a log
line a day would push the user's own notes out of it. Future days are refused
rather than clamped, and nothing older than the week the tile shows can be
logged. Not yet read by the ranker.

`HomeData` gained two fields for this: `recent` (the last fortnight of outcomes,
answered Moves and deep work, from `loadRecentRows`) and `generatedAt`.

## What it looks for is worked out, not configured

Supply was one query shape for everybody: every target segment, as typed, on
Google Maps as "segment in area". Right for somebody who sells to the shops and
trades down the road; the wrong world for anyone else — a live account selling
medieval-market jewellery in Toledo got sixty businesses from Toledo, Ohio. A
first fix made the search the user's to write and manage, as a sheet of
"hunts"; its owner's verdict was that it made finding people their job again.
So the web searches are now the app's own (`lib/copilot/hunts.ts`, table
`copilot_hunts`, 20260925), and nobody sees one.

**Planned from what it already knows.** `planHunts` (`hunting.ts`) runs at the
start of every web run (`supply/web.ts`), so there is no step anybody takes: the
first run with an offer plans up to `AUTO_HUNTS` (3) searches — the model when
one is configured and there is time (`PLAN_SYSTEM`, reading the offer, the
working file, the goals and where the user is), otherwise the buyers the user
named, as they wrote them (`planFromOffer`). Queries describe the page to find
("a family-run resort in Palawan that takes bookings by Facebook message"), not
keywords. Two kinds only: `companies` (Exa, category `company`; each site is
opened and read for an email or WhatsApp link) and `people` (Exa, category
`people`; public profiles, contacted by hand). Nothing is planned from a blank
offer (invariant 1). Research that needs judgement across pages is not a search
at all — the app proposes it as a Move (`propose.ts`), one tap from handed over.

**Kept honest by what they bring in.** Every run retires the searches that have
said what they are worth (`spentHunts`): `HUNT_BIN_FLAG` (8) set aside
or judged below the bar with nothing ever drafted, or nothing found at all after
`HUNT_GRACE_DAYS`. Retired is paused, not deleted, so the planner never plans the
same words twice; the empty slot is planned again on the same run. A material
change to the offer retires every planned search (`retireAutoHunts`, from
`setOffer`), and the next run plans from the new one. Rows the user wrote when
hunts had a sheet (`origin = 'user'`) are judged on the same evidence — nothing
on screen can stop one now, and a web search is billable, so a bad one would
spend their allowance every night — but an offer change leaves them, because
they were never read off the offer. Old `agent` rows are not run.

**A find counts only with a real link** — a result some search index crawled,
never a URL a model wrote (invariant 3) — and **every URL is hostile until shown
otherwise**: `openPage` checks the name (`isPublicHttpUrl`), what it resolves to,
and every redirect hop, and reads at most 400 KB.

**Finds are ordinary opportunities** carrying `data.hunt_id`, `hunt_label` and
`segment` = the search's words, so dedupe, the ranker, the keep-rate and the
funnel work on them unchanged. The web adapter runs before Maps — it takes
seconds where a Maps segment takes ninety, and an interactive run's deadline
cuts whatever comes last — and is metered like Maps, because Exa charges per
search (invariant 6 protects the free adapters, not the paid ones).

**A search that cannot run is said, on Proof.** The searches have no screen, so
the Scout does it: a missing table, a search whose last run failed, or a run
that failed before any search did turns the Scout's row to Failed with the
reason (`RosterInput.searchProblem`). That last kind — a plan that could not be
made or saved — throws, the supply run keeps it on the run's web entry, and
`loadHunting` reads it back as `hunting.lastError`; it is not only in a log. So
does having nothing to search: with nothing live and nothing new to plan,
`noPlanReason` says why (the model failed or there was no time to ask it; the
offer does not say who buys it; everything it could think of was tried) instead
of returning an empty run that reads as a quiet night. A search cut off by the clock is recorded as such and
runs first next time. A manual look that brought in nothing and hit a failure
says which finder failed and why, not a setting to change. Never an empty deck over a broken
search (invariant 13).

Setup: `EXA_API_KEY`, and the 20260925 migration. Without either, Maps and feeds
run as before and the Scout says what is missing.

## Money, read from the bank, not typed (`lib/copilot/money/`)

Everything the app knew about somebody's money was typed: cash and burn on the
Runway sheet, each win one at a time, each invoice one at a time. So runway was
whatever was typed last month, and scoreMove's money factor was 1.0 on nearly
every Move — the comment in `obligations.ts` says it outright: the day collapses
to outreach "because nothing else brings a number to the argument". A bank
statement is the person's own record, written by their bank, and unlike every
other sensor it arrives with its history: a year of rows on day one, not a year
of collecting. DIRECTION.md's objection to widening the sensor ("months of
collection before anything ranks differently") does not hold for this one.

**How a statement gets in.** One upload control, reached from the money card on
You, Records → Bank statements, the Runway sheet and onboarding's fourth screen
(`BankSheet.tsx`, `POST /api/copilot/money/import`, 10 MB, 30 a day). The file
is read in memory and dropped; only the rows are kept. What it is is decided by
its bytes (`sniffFormat`), and the two ways in are not trusted the same:

- **parsed** — CSV, TSV and OFX exports (`statement.ts`). Deterministic: the bank
  wrote those rows and this only splits them. Headers are found under a
  preamble, dates are read day- or month-first by whichever keeps the column in
  order (the person's timezone breaks a tie), decimals by a vote across the
  column, debit/credit columns and DR/CR marks turned into signs. Read now, in
  the request.

  Budgeting-app exports (the kind people keep for cash) come through the same
  parser, and three of their habits are handled rather than summed: rows marked
  pending or dated after the person's today are left out (apps export a year of
  scheduled bills); a transfer whose row names both of the app's own accounts
  is left out (it is neither income nor spending); a blank note falls back to
  the payee column, then the category, so fifty unlabelled meals are "Dining
  Out", not one payee called "(no description)". Cancelled and declined rows are
  left out; refunded ones stay, because the refund is a row of its own. Rows in
  a second currency are left out, never relabelled. Each import carries one
  line saying what was left out (`skipped`), on the sheet and in the toast.
- **parsed, from a PDF** — a PDF's text layer (`pdf-parse`) is tried by rules
  first (`parseStatementText`): a line ending in an amount and a running
  balance, dated at its start or on the very next line (Wise's layout). It is
  used only when the running balance holds on every row
  (`statementFromPdfText`), so no misread column survives it; anything else
  goes to the model. Wise's 101-row quarterly statement is read this way in
  about a second, and nothing is sent anywhere. So a PDF that prints a balance
  needs no model, and the upload takes PDFs on a server with none.
- **read** — any other PDF, and screenshots (resized with `sharp`), copied into
  rows by a model in `after()` (`extract.ts`). A model can
  drop a line, misread a digit or flip a sign, so its prompt forbids arithmetic,
  `statementFromReading` drops whatever does not parse — counted, never
  repaired — and the reading is a proposal until it proves itself.

**Nothing read is trusted until it adds up** (`checkBalances`). Two proofs: the
running balance holds line to line, or the opening balance plus every row is the
closing balance. Either proves no row was dropped and no sign flipped; a file
that lists newest first is turned round, and one whose amounts come out
backwards against its own balances is corrected — the balances are the bank's
arithmetic. A parsed file is used unless its own balances contradict it; a
reading is used only when it balances. Anything else waits in `review`, its rows
in `copilot_money_imports.pending`, until the person holds the totals against
their statement and taps **They match** (or **Discard**). A worker cannot mark
its own homework (invariant 10), and neither can a reader.

**Overlapping statements are safe.** Each row's id is its account, day, amount
in cents, counterparty and how many identical rows preceded it in the file
(`rowFingerprints`), and `(profile_id, fingerprint)` is a plain unique
constraint the upsert skips on — August–October then September–November counts
September once, and two identical coffees on one day stay two.

**What the rows become** (`ledger.ts`, pure, and every number is a sum, a count or
a date off the rows — invariant 2):

- **The read** (`moneyRead`): "Since 1 Jul: $4,200 in from 2 payers. Acme was
  86% of it. Last paid on 25 Sep: Coron Reef Divers, $150. You spend $844 a
  month, $804 of it on repeat bills. That is 4.5 months of runway on $3,789 (25
  Sep). Next: Rent $400 around 1 Oct." Monthly figures average the last 90 days
  of rows and are withheld under 20 days of history; repeat bills are the same
  payee, about the same amount, weekly to monthly, at least three times and
  still going (`recurringOut`); cash is the last balance each account printed.
  The average covers only accounts still being written — one whose rows stop
  more than `LIVE_ACCOUNT_DAYS` before the newest does not speak for this
  month: a Wise quarter ending 30 Jun beside a budget export starting 15 Jul
  averaged a fortnight nobody recorded, and $648 a month read as $554. Runway
  comes off the rows only when every account printed a balance; a budget export
  prints none, and "0 months of runway on $5.50" was one euro account standing
  in for all the money there is, so the read says whose balance it has and asks
  for cash.
  One currency for everything: the main one (below), with every row in
  another converted into it at the rate for its own day. A row whose currency
  has no rate is left out and said, with why — never converted at a guess — and
  when nothing converts at all (the rate service down on a first load) the
  figures are shown in the pile with the most rows and say so (`inMain:
  false`), and runway does not take them. A file that names no currency is its
  own pile until the person says which (`setImportCurrency`: one chip on the
  Bank statements sheet, the time zone's currency offered first, applied to the
  whole account and inherited by the next upload to it, so next month's export
  of the same app needs no question). Until then its figures print as bare
  numbers (`currencyKnown: false`) and never reach runway: counted as "the
  person's currency" they were written into a dollar runway as $37,708 a month
  of peso spending, and before that, 264 unlabelled peso rows were summed into
  a euro account's figures and printed with its €.
- **The main currency and its rates** (`fx.ts`, `fxstore.ts`,
  `copilot_fx_rates`, 20260930). A person who sells in dollars, keeps a peso
  budget app and a euro Wise account asked for one currency the whole app
  counts in. It is the one chosen in Settings (`finance.main_currency`), else
  the one runway is already in, else the money goal's, else USD — "$" is a US
  dollar unless Settings says otherwise (`toCode`). Rates are the European
  Central Bank's reference rates via frankfurter.dev (`COPILOT_FX_URL` to point
  elsewhere): a weekend or holiday takes the last business day before it, and
  nothing older than `RATE_STALE_DAYS` counts as a day's rate. They are cached
  in `copilot_fx_rates`, shared by every account, so a load is one query and a
  fetch happens only for days the cache does not reach (`covers`); a pair that
  failed is not asked again for fifteen minutes, so a dead service cannot add
  six seconds to every open; and without the table they are held in the
  process's memory. A converted figure is a claim about a rate as well as the
  rows, so the read says which currencies were converted, and the Runway sheet
  shows the rate and its day. Goals keep the unit they were written in.
- **The last thirty days** (`recent`, `months`, `spend`): money in and out over
  the thirty days ending on the last row — not on today, since a statement
  that ends in June has no "last 30 days" in September (`recentLabel` says
  which) — who paid in them, calendar months in and out (`partial` when the
  rows start or stop inside one), and where the money goes a month over the
  same days `perMonth` averages.
- **The finance row** (`financeFromRead`): cash and burn written into
  `profile.finance` with where each came from (`source`, `cash_on`, `burn_to`),
  so metrics, the forecast, the runway guard, scoreMove's money factor and the
  plan all move without any of them changing. A number the person typed after
  the statement's own date stands (`typed_at`); the Runway sheet says which is
  which. Runway is in the main currency: statement figures arrive converted,
  and a number typed in another — ₱71,804 of cash in a dollar app — is kept as
  typed (`typed_in`) and converted at the newest rate every time runway
  settles, so the dollar figure follows the peso (`typedInLines` says what it
  became and at what rate). With no rate the number is left out, not guessed.
  A live account had typed "$1,000 cash, $350 a month", then uploaded a peso
  budget export: runway went blank beside a card that knew the burn to the
  peso, because the old rule refused to divide dollars by pesos and had nothing
  to convert with. `loadHome` settles the row on every load and writes only
  when it moved (`financeFromRead` returns the row itself otherwise; a failed
  write is `money.settleError`, said on the Runway sheet); the nightly pass
  settles it first, before the plan and the brief read it; and saving runway or
  the main currency settles it at once (`setFinance` → `refreshFinance`).
  An account's cash is the latest statement's closing on a date tie with its
  rows: a batch shares `created_at`, so the last row of a day with two is a
  coin toss (Wise's quarter read €5 for €0.00).
- **Wins in the main currency.** A client's deposit is recorded as a win
  converted at its day's rate, the original in the note: a ₱5,000 deposit
  recorded as 5,000 would have moved a dollar goal by $5,000. A deposit with
  no rate, or in a file whose currency nobody has said, is not recorded, and
  the statement's note says why.
- **Sales money** (`salesCurrency`, metrics.ts): an offer, a win, a goal and
  the plan's prices print in the first money goal's unit, else the finance
  row's, so a goal written in dollars stays in dollars whatever Settings says.
- **Who paid, named by the person.** Each payer nobody has named is one question
  with four answers — a client, my job, my own account, something else — and,
  where a payer shares distinctive words with exactly one business in the
  pipeline, that business as a fifth (`suggestOpportunity`). Nothing infers a
  role. "My own account" drops the counterparty out of income and spending both
  ways; payees that read like savings ("MY SAVINGS", "POT", "ISA") are asked
  about the same way (`ownCheck`), because until then a monthly transfer to
  savings is the biggest "bill" on the list.
- **Deposits into wins.** A client's deposits from the last 30 days become `won`
  outcomes — source `manual` when the person's naming caused it, `system` when
  a later statement brings money from somebody already named — or are attached
  to the win already logged by hand for the same money, within ten days and one
  percent (`matchWin`), so nothing counts twice. This is the join the product
  was missing: from a message sent to money that actually landed.

**The screen.** Money in and Runway, the first two tiles on You, read the rows:
Money in is what came in over the last thirty days of rows and opens who paid,
month by month, then the wins logged (`MoneyInSheet`); Runway opens the figure,
where each number came from, the cash field first when the rows gave the burn
and no balance, then where the money goes a month and the repeat bills
(`RunwaySheet`). Before statements both open what they always did. The money
card that sat under the tiles repeated them in prose and went; the questions
it carried — payers to name, a currency to say — are the Bank statements row's
in Records.

**The plan and the brief see it.** `drawRoadmap` puts the lines in the prompt as
THEIR MONEY, noting every figure is already in the main currency so the model
never converts again, so the number guard lets the plan cite them, and the signature
carries a money fingerprint (`moneyForPlan`) so a new statement or a payer
named redraws the plan like a note does. The brief's context pack carries the
same lines as `money` (one loader, `loadMoneyRead`, so the three cannot
disagree), under a MONEY rule that lets it cite them and forbids converting
them again or treating a payer as a won sale; a read that failed is
`moneyError`, never an empty section. The handoff export has them as "My
money". Built only from totals computed before any list is cut
for the screen, so the phone and the server always agree — a fingerprint that
differed would redraw on every open — and absent without statements, so no
existing plan redraws for nothing.

**Deleting it.** Remove one statement and its rows go with it
(`on delete cascade`), then its account if nothing else is on it. **Delete
everything read off your bank** (typed DELETE) removes every row, statement,
payer and account and the cash and burn read off them; what was typed stays,
and so does what was logged on the Money tab — its rows carry no import and its
account is `provider = 'book'`.
Wins already recorded stay in both cases — they are the person's record of
work — and the sheet says so before the tap.

**Bank links, later.** Nothing on screen offers one, because no provider exists
(invariant 7). The seam does: `copilot_money_accounts` keys an account by
`provider` and `external_key` and carries `status`, `last_error` and
`last_synced_at`; `startImport` takes source, format and method `link`; and
`finishImport(…, { method: 'link', provider })` runs a provider's rows through
the same dedupe, check, read, finance row and wins as an upload. A provider is
one module that turns its API's transactions into `StatementRow`s — GoCardless
Bank Account Data (free for EU/UK), Plaid (US), Belvo (Latin America) — plus
its consent screen and a scheduled sync.

### Records — what it reads instead of asking (`sensors.ts`)

The sensors lived in four places: the Runway sheet, the Money owed sheet, a tile
on You and a line under Settings. **Records** on You is the one list, so "what
does it actually know about me, and how" has one answer: bank statements (you
upload), money owed (you log), deep work (you log), sources you watch (read on
its own), each with a line computed from rows ("22 transactions · to 25 Sep", "2
of 5 failing") and a state (recording, not yet, look at this). Adding a sensor —
a calendar, a CV, a bank link — is a `SensorDef` in `SENSORS`, its line in
`sensorViews`, and its sheet. A test reads `SheetContent.tsx` for every sheet a
sensor names, so a row that opens nothing cannot ship (invariant 7).

Setup: `supabase/migrations/20260929_copilot_money.sql`. CSV and OFX need
nothing else. PDFs and screenshots need a model — the brief's, or
`COPILOT_STATEMENT_MODEL` on the same endpoint when the brief's model does not
take images. Without the migration the Bank statements sheet says it is not set
up, `/api/copilot/health` names the file, and every other screen is unchanged.

### The money book — the Money tab (`money/book.ts`, `money/bookstore.ts`)

Statements are a month behind by construction: somebody exports, then uploads.
Its owner spends cash and kept it in a budgeting app whose one used screen was
log a move, read the list under the balance, glance at the calendar — and fed
that app's CSV here by hand, so runway was as old as the last export. That
screen is now the Money tab, and nothing else of that app (DIRECTION.md).

**A logged row is an ordinary transaction.** `copilot_transactions` with
`import_id` null, in the account `provider = 'book'`, told apart by its
fingerprint: `book:<uuid>`, or `repeat:<series>:<day>` for one a repeat wrote.
The read, runway, money in, the plan and the brief take it with no change of
their own. Only these rows can be edited or deleted from the tab; a file's rows
change when the file does, on Bank statements.

**The balance is said once.** A budget export prints none, so the person types
what they have (`finance.book`: currency, balance, the instant and the day). The
book's currency is fixed from then on. Every row logged *after* that instant, or
dated after its day, moves it; a row read off a file never does — it was in the
number they typed. Tapping the balance says it again and restarts the count.
`financeFromRead` takes the book's balance as the cash (`source.cash = 'book'`),
ahead of any statement, converted like any number typed in another currency;
the Runway sheet drops its cash field and says where the cash comes from. The
rows that move it are read by their own query (`bookBalanceNow`), not taken from
the read's year of rows, so a book kept longer still matches the tab; unreadable,
runway is left as it was and the Runway sheet says why. The book account prints
no balance, so it is left out of the read's accounts — counted as one without,
every read said "type your cash". A move can be dated up to a year either way.

**Shown in another currency, logged in its own.** `bookView` converts every row
at its own day's ECB rate, pending ones at today's, the balance at the newest —
or none at all: a month with a day the rates do not reach is shown whole in the
book's currency, and says why. A list half in pesos and half in euros adds up to
nothing.

**The list and the calendar** are computed, never stored: the month's days,
newest first, each header with what the day spent and received; the calendar
with each day's spend or its end-of-day balance, worked back from now (so it
needs a balance and stops at today); a dot on a day money came in.

**Pending and repeats.** A row dated after today is pending: listed under
Upcoming, in no figure — `moneyRead` ignores it too. A repeat is `weekly` or
`monthly@<day>` (the 31st comes back after February's 28th); `materializeRepeats`
writes from each series' *latest* row every row owed up to the first one after
today, idempotent by fingerprint, bounded at sixty. The tab runs it on open and
the nightly pass before it settles runway. Deleting an upcoming repeat stops the
series — otherwise the row before it writes it back on the next open — and so
does turning repeat off on any of its rows; what already happened stays.

**Getting a file in without a download.** The `/copilot2` manifest has a
`share_target`: a budget app's Export → Share → Copilot POSTs the file to
`/copilot2/share`. `public/sw.js` takes that POST, keeps the file in Cache
Storage and redirects to the Money tab, which uploads it with an ordinary
same-origin fetch — so it carries the session whatever the phone did with
cookies on the share. The app registers the worker itself (`useCopilot`): the
root layout's registration waits for `load`, which has usually fired by then,
and it often never ran. Without an active worker the POST reaches the route,
which imports the file through the upload route and redirects with what the
upload said. An installed app picks the share target up when Chrome next
refreshes it, or on reinstall. iOS has no share target for web apps.

**Logging fast.** Timed on the owner's phone, a coffee took seven to nine
seconds from the Log money shortcut: the whole app loaded (fifty reads for the
Path, matches, plan and numbers), then the book, then the sheet — which opened
empty until the book arrived — then a tap to wake the keyboard, a swipe to put
it away because it covered the categories, and one to two seconds after "Log
it". Measured locally with 100ms per database request, the server was not the
slow part (the app page is fifty reads but six deep, 0.6s); the waits were the
book's six reads and the save's twenty, one after another, and everything the
phone did before the keypad could be touched. So:

- **The shortcut has its own page**, `/copilot2/log` (`loadLogScreen`): the
  profile, then categories, the balance and the entry rate at once — three
  reads, 0.23s — with the form in its first HTML. The old shortcut URL
  (`?tab=money&add=1`) redirects there before the home loads.
- **The phone's own number keyboard, up at once** (`EntryPad.tsx`): the amount
  field takes focus as the sheet opens, on the same tap as the +. A keypad drawn
  on the page was tried and the owner preferred the keyboard their hands know.
  A phone opens a keyboard only in answer to a tap, so on the Log money page,
  opened by a shortcut, the first one needs a tap on the amount; after each move
  the field takes focus again and the keyboard stays up. A comma is a thousands
  mark ("1,500"), never a decimal point (`cleanAmount`). Enter logs when it is
  ready, else puts the keyboard away so the categories show.
- **The save is not waited for.** "Log it" writes the move to the phone's
  outbox (`bookLocal.ts`) under an id the phone makes, closes the sheet, and
  sends behind it; the server stores it as `book:<that id>` with `ignoreDuplicates`,
  so a retry — a dropped answer, the app closed mid-send, two screens flushing
  the same queue — is one row. It is taken out of the outbox only when the
  server has it; tried again on reconnect, on return to the screen and every
  twenty seconds; listed under "Sending" or "Not saved yet" until then. A 400 is
  the person's to read — it stays with its reason and a Remove button, never
  retried into the same no. Where the phone cannot keep it (no local storage)
  the sheet waits for the server, as before.
- **Offline.** `public/sw.js` keeps the Log money page as last opened
  (network first, the kept copy only as fallback) and the app's content-hashed
  `/_next/static/` files the server marks immutable (cache first, newest 300).
  With no signal the page opens from the phone, works out today from the
  phone's clock in the person's zone, says it is offline, and queues what is
  logged. Tested by stopping the server, not by the browser's offline switch,
  which a service worker's own requests ignore.
- **The tab opens on the last book drawn** (this month and view, per account),
  replaced by the fresh one a moment later; the book's reads run at once (0.65s
  → 0.23s); the save settles runway in `after()`, since every home load settles
  it again and says so when it cannot. Loads carry a sequence number, so two
  months tapped through quickly cannot draw the older answer over the newer.
- **A picture per row** (`categoryIcon`): the category first, then the words
  in the row ("5G DATA" is a phone, "Siomai" is food, GrabFood is food and Grab
  is a ride), a plain in/out arrow when nothing matches — a wrong picture is
  worse than a plain one.

**Safe to spend today** (`safeToSpend`, `safeAfter`). The line under the
balance, and the label over the categories wherever a move is logged: what is
in the book, less what is already promised in the next thirty days — pending
moves out, and each repeat carried through the thirty (a weekly one is four
rows, not the one written ahead) — spread evenly, less what today has spent.
Today's spending is put back before the spread, so the share holds through the
day and only what is left shrinks. Money that has not arrived counts for
nothing: a pending "came in" is the cheapest thing to be wrong about, and a
figure called safe errs low. No forecast of income or of habits; from rows the
person made and nothing else (invariant 2). While an amount is typed the label
says what would be left after it — "₱1,721 left today after this", warm when
over — so "can I?" is answered before "Log it". Tapped, the line says where the
figure comes from. The Log money page gets it with the balance
(`balanceAndSafe`: the balance query and one read of today's and the pending
rows), and every reply to a move carries the new one.

**The calendar opens on today** in the current month, its moves already under
the grid; another month opens with nothing picked. "Download everything as CSV"
sits under the list only.

**Said, not typed** (`money/spoken.ts`, `v2/VoiceLog.tsx`). The header's
corner on every tab is a mic, where the capacity pill was: capacity is a
setting changed about never, and it is in You → Settings; logging money is what
the app is opened for several times a day. Say "coffee 130", "grab 240
yesterday", "salary came in 50,000" or "40 euros lunch": the words show under
the greeting as they are heard, and the add sheet opens filled in with them
quoted on top — nothing is logged until "Log it", so a mishearing is caught on
the screen. The Log money page has the same mic, and fills its pad in place.
The words come from the browser's own speech recognition (the Web Speech API;
on Android Chrome, Google's speech service, the one the keyboard's mic uses):
no per-minute cost and no audio through our server. Where there is none
(Firefox) the corner is a + that opens the sheet.

`parseSpoken` reads the words with no model, so nothing it fills in was not
said (invariant 2). The amount is a figure said — digits first, so in "one
coffee 130" it is 130; "5k", "fifteen hundred" and "1:50" (how recognition
writes "one fifty") are read; past a billion it is left blank rather than
wrong. The direction is a word said ("came in", "paid me", "received") or a
category that is only ever money in. The day is a word said: yesterday,
kahapon, "three days ago", last Monday, "September 12", "the 28th" (last
month's when this month has not reached it). The category is one of the
person's own that was named, plural or not; else the one of theirs whose
picture (`wordIcon`, the list's pictures matched from the start of a word, so
"sweater" is not "eat") the words carry — only when exactly one does, since
two is a guess. What else was said is the note. A currency counts only beside
the amount, and a word only after it: "I won 500" is not Korean money. Two
amounts in one breath fill in the first and say the other ("Also heard ₱50:
log it next"). A currency said is that move's only; the next goes back to the
default.

Every way the mic stops is said (invariant 13): blocked in site settings, no
connection (recognition needs one; the typed move still queues offline), no mic,
nothing heard. Where the move can still be typed, the sheet opens for it. The
mic loads the book as it starts listening, so a sheet opened from the Path has
the categories to read against; before the book arrives it says "Opening your
book…". Playwright has no mic: tests put a stand-in `SpeechRecognition` on the
page with `addInitScript` that "says" a set phrase.

**Logged in another currency.** Tap the ₱ on the keypad: a select laid over the
mark. The choice is the default for the next move, kept on the account
(`finance.book.entry`, `setEntryCurrency`) so the shortcut's first HTML already
knows it. A move typed in euros is converted into the book's currency at the ECB
rate on its day — the latest before it on a weekend, today's for a pending one —
and stored in pesos, with what was typed beside it (`entered_amount`,
`entered_currency`, 20261002): the balance never moves again when a rate does,
and the list shows "−₱763.13" over "€12", or exactly "−€12" in the euro view. No
rate for that day, no row: the sheet says so and to log it in the book's
currency. A repeat of a move typed in euros repeats its peso amount.

**Guarded writes.** A settle reads the whole finance row, works for a second
and writes the whole row back; a balance said in that second was overwritten by
the one read before it. `writeSettledFinance` writes only if `finance.book.at`
is still what it read (`is null` when there was no book) — the same guard as
setting the entry currency. Not written, the next settle starts from the new
balance.

**A copy to keep.** "Download everything as CSV" under the list
(`GET /api/copilot/money/book/export`): every row the book reads — logged,
repeated, from a file — with what was typed in another currency. The database is
the only other copy.

**Crashes stay in the tab.** `MoneyTabGuard` catches a render error in the tab
or its sheet and says what broke, with a reload; before, one bad row blanked the
whole app. The outbox is on the phone either way.

Setup: `supabase/migrations/20261001_copilot_book.sql` (three columns on
`copilot_transactions`: `category`, `note`, `repeat`). Without it the tab says
so, the health route names the file, and statements, runway and money in behave
as before. `20261002_copilot_book_entered.sql` (`entered_amount`,
`entered_currency`) is needed only to log in another currency; without it that
one thing is refused with the file's name, and the rows are read without it. Budget exports' categories are kept from then on, and backfilled on
the next upload of the same file.

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
COPILOT_AGENT_CAN="..."             # what the agent at COPILOT_JOBS_URL can finish alone, in words
#   The planner hands a step to the agent only within this ("research, a landing page
#   draft, spreadsheets, code"). Unset: the reference n8n worker's reach — research,
#   reading pages, comparisons, written drafts. Never contacting, posting, applying,
#   spending or signing, whatever it says (invariants 4 and 11).
#  or
OPENAI_API_KEY=... / DEEPSEEK_API_KEY=...
COPILOT_AI_API_KEY / COPILOT_AI_BASE_URL / COPILOT_AI_MODEL
# The plan's own model (optional; unset = the brief's). The plan is drawn in the
# background, so it can take a slower, stronger model than the 30s brief.
COPILOT_PLAN_MODEL / COPILOT_PLAN_API_KEY / COPILOT_PLAN_BASE_URL
COPILOT_PLAN_TIMEOUT_MS=110000      # up to 240000; spent inside the nightly pass too
COPILOT_PLAN_EXTRA_BODY / COPILOT_PLAN_MAX_OUTPUT_TOKENS   # e.g. a higher reasoning effort for the plan only
# The model that reads PDF statements and screenshots (optional; unset = the brief's).
# Screenshots need one that takes images. CSV and OFX need no model at all.
COPILOT_STATEMENT_MODEL

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

3. Open `/copilot`. New device → 3 screens → first supply pull (prospect pipeline) → first brief →
   a fourth, optional screen: a bank statement, read while they watch (see **Money, read from the bank**).
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
or notice replies until someone taps "Find new", or runs the whole pass from You → Nightly run
→ "Run again".

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

### Running the night now

You → Settings → **Nightly run → Run again** runs tonight's pass for the
signed-in account, so you do not have to wait a night to see what it does. It
used to be "Today's call · Run again", which re-ran the brief alone.

It is the cron's own code path, not a lighter copy. `runNightlyPass`
(`daily.ts`) is what both `/api/copilot/cron/daily` and `POST
/api/copilot/nightly` call. It runs supply, reply reconciliation, the jobs and
the brief, in that order, with no deadline, and a test fails if either route
stops calling it. What the pass does, and what it deliberately does not do:

- **It runs after the response.** A pass takes minutes and Traefik gives up in
  under one, so the route writes a `copilot_agent_runs` row (`kind = 'nightly'`,
  status `running`), hands the pass to `after()` and returns 202. On `next start`
  `after()` work runs to completion, so the button gets the long agent budget
  and the push, like the cron. `isNightlyPass()` is the one rule for both.
- **It never counts as the schedule.** It records `reason = 'nightly_now'`,
  never `cron`, so `lastCronRun`, the "Nothing ran overnight" notice and
  `/health`'s `loop.nightlyRuns` still say whether the scheduled task exists.
  The row says when the schedule itself last ran, underneath.
- **It reports every step.** Before each step the row's `output` is
  `{ step }`, so the row, and a banner on every tab, can say "2 of 5 · reading
  replies". The fourth step, Plan, redraws the Path's plan only when something
  changed since it was drawn, and runs before the call because the call is the
  plan's next step (see **The plan is drawn, not walked back**). Afterwards `output` is the `DailyResult` plus the adapter and job
  labels, and `nightlyLines()` turns it into one line per step, with a line for
  each adapter or job that broke. Skips that are by design ("not configured")
  are left out. A fallback brief is reported as broken even though a call came
  out of it.
- **A row that dies says so.** A redeploy kills `after()` work mid-pass. A row
  still `running` after `NIGHTLY_STALE_MS` (15 minutes, well past the slowest
  live pass) reads "Stopped without finishing", and a new tap is allowed.
  Whatever the dead pass wrote before that is kept, since each step persists as
  it goes.
- **It costs what a brief costs.** It uses the brief route's key and cap
  (`copilot:brief:<id>`, `briefsPerDay`), which is what that cap is for: re-runs
  on top of the one the schedule gets. Paid supply is capped inside `runSupply`
  at the monthly allowance, as it is for the cron. A tap while a pass is in
  flight gets that pass back rather than a second one.

The cron now writes the same row for every profile it runs, so the row on You
also reports what last night did. A row that cannot be written does not stop the
cron's pass: the cron's report carries the result, and `scripts/copilot-cron.mjs`
names the profile whose row is missing. The button refuses instead, because a
pass nobody can watch is the silent kind.

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
| `nightly_now` | the same pass from "Run again", running in `after()` once the response has gone | `COPILOT_AI_CRON_TIMEOUT_MS` | 120s |
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

## Swipe — the deck again, where yes is the send (`deck.ts`, `deckstore.ts`, `v2/SwipeTab.tsx`)

The tab that replaced Matches, from its owner's account of why 57 of 76 drafts
never went: "little info about each card, then open it and draft it to check and
send later; the message is not written for me; many didn't have WhatsApp". The
stack above was folded away because "yes" was a draft to send later — the cheap
side won. Here "yes" is the send itself, so both answers cost one flick again.
It sat beside Matches for one release; its owner kept it and dropped the list.
The metric stays the stack's: sends per session (the tab's own top line counts
them). Every way into Matches still lands: `?tab=matches` (and `pipeline`,
`opportunities`, `signals`) opens the deck, the Path's New opens the deck, and
its other pills open the outreach sheet on the same stage.

**The card is the whole screen**, and carries what the list sent people away to
open: the listing's photo, what and where, every reason it was picked (not two
lines of one), the post itself for a find (its Move's `artifact.value`), facts
off the listing ("4.2★ (6)", "No website" — never a guessed number) and how they
can be reached. Dealt in this order (`deckCards`): fresh finds, which go cold in
days; To send, first messages before follow-ups, which wait for their day; then
the rest of New in the list's own order.

**How they can be reached is said, not assumed.** A Maps phone went into
`contact.whatsapp` whatever it was, and many on the owner's account were
landlines: a `wa.me` link to a landline opens an error, a draft that could never
go. A Philippine number says which it is (`phoneKind`: 639… mobile; 632…, 032…,
02… landline), so a landline is offered a call, with the message as what to say
when they pick up, and a mobile WhatsApp, a text or a call. Elsewhere the number
cannot say, so WhatsApp and a call are both offered. Email and a website's
contact form are ways too; a find is answered on its own post.

**The message is written for the card before it is shown** — the card on screen
and the next two — by the brief's model (`DRAFT_SYSTEM`, `draftPrompt`: the
offer, what the person knows about their own work, the listing or the post, the
way it will go). It is held to the rules before it reaches a card (`checkDraft`):
no placeholder, no link but the proof link, and no number whose digits are not in
the offer, the listing or the post — durations and times of day excepted, since
they are an ask. A message it refuses, a model that does not answer in 20s, no
model on the server, or past 300 a day: the card shows the one written from the
offer (`openerTemplate`, or the To send draft's own text) and says why, under the
message. Model-written messages are kept on the phone for three days per offer,
so a reload does not write them again. Tap the message to change it; "Rewrite"
asks again.

**Right is the send.** From the person's own number or address when they
connected one (`channelsConfigured`; the button says "Send" and the card "sends
from your own number"), under the send route's own 40-a-day cap. Otherwise their
own app opens with it in — WhatsApp, texts, the dialler or mail — and the deck
asks when they are back: "Did it go?" (a call: "Did you get through?"). A reply
to a post, or a message for a contact form, is copied and the page opened; "did
you post it?" is asked the same way. The open happens inside the gesture, since
a phone opens nothing after a wait, and the record (`action: 'reach'`) is sent
with `keepalive`, so it survives the page going to the background. "It didn't" on
WhatsApp brings the card straight back offering the same number as a text or a
call — not being on WhatsApp is the usual reason. A number that refuses (the
provider errs) is said in a sentence, and the card offers to send it from their
own app instead.

**What is recorded is what the list records.** The approved message becomes the
business's draft (`draftWithBody` — the text read on the card, never the
template; an open draft is rewritten, never a second queued). Marked opened, so
someone who never comes back to answer is asked on the Path. "It went" is
`markSentManually`, with the way it went kept as the execution's `provider`
(`sms`, `call`), so its link and its day-3 follow-up open the same app
(`deepLink`); To send says "Call them" for a call. Every answer writes the same
`triage_answered` event the list writes (`from: 'swipe'`), so the keep-rate that
orders both learns from both. Not for me on a written draft cancels it (kept as
cancelled, for the funnel) and sets the business aside; on a business it also
cancels any draft it has — swiped right, no answer, then not for me left an
orphan draft in To send whose listing every read had dropped. A post or a site
has no recipient for a draft: posting marks the find's Move done, and a site
marks the business acted (`deck_posted`).

**Gestures, and a button for each:** drag right, drag left; Undo (a "not for
me" is held 8s or until the next answer, then saved — leaving the tab saves it
with `keepalive`); Later (to the back of the pile); Look up. Arrow keys on a
desk. "More about …" at the foot of a card opens the record behind it (the
business, the draft, the Move), as the list's chevron did.

**The card follows the thumb, both ways, as on a dating app.** Up and down
scrolls the card; sideways moves it, tilting, with a little of the thumb's
vertical so it is held rather than on a rail. The first version moved a few
pixels on a phone and sprang back: `touch-action` is read from the element
touched up to the nearest scroller and stops there, so `pan-y` on the card said
nothing about a touch inside the card's own scroller, the browser took the
sideways pan, fired `pointercancel`, and the cancel put the card back. `pan-y` is
on `.cp2-swp-scroll` now, and a non-passive `touchmove` guard cancels the scroll
of a touch that starts sideways, for a browser that decides on the first move
instead. Let go past 100px, or thrown faster than 0.4px/ms after 30px, and it
goes; pulled back, it does not. The next card sits underneath whole, not as a
picture of one, and comes forward as this one goes. The card answered leaves as
a copy of itself, scrolled where it was being read, from where the thumb let go
and at the speed it was thrown (Web Animations); React deals the next card the
same frame.

**The card reaches the foot of the screen.** The buttons and the nav float on
it, frosted (`backdrop-filter`), with a frost that thickens toward the nav over
its foot; the card's own content scrolls clear of them. The empty pile says why
it is empty — looking now, nothing can search on this server, nothing cleared
the bar — and, out of the month's matches, carries the plan wall the list did. The pile keeps its own order for the session, so
the home refreshed behind it once after a burst of swipes never reshuffles the
card under the thumb; a business swiped right that comes back as a draft takes
its own place in the pile, with the way picked and the words typed. What was
answered and the session's count are kept for the day on the phone, so a trip to
another tab does not deal them again.

**Testing it.** Headless Chromium hands `sms:`, `tel:` and `mailto:` to an
"open external app" prompt that swallows every click after it, so a test records
them instead — the tab opens them as a clicked link, and `HTMLAnchorElement.prototype.click`
can be wrapped in an init script. A model stand-in has to answer the Responses
API (`/v1/responses`), which is what the AI SDK's provider calls. Drive the drag
with touch, not the mouse: CDP `Input.dispatchTouchEvent` in a `hasTouch`
context goes through the browser's touch-action handling, and a mouse drag does
not — the mouse test passed while every phone sprang back. Put `touch-action:
auto` back on the scroller and drop the guard, and that test reproduces the bug
(a `pointercancel` mid-drag, the card at rest).

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

**Asked out loud** (`asked.ts`, `AskSheet.tsx`). The sheet also takes a question
said, typed or tapped — "how much did I spend this week?", "how is my bet
going?", "what should I do next?" — and answers it out loud when it was asked out
loud. Said into the header's mic, a question opens this sheet on its answer
instead of the book (`looksAsked`: a question word, or no amount and a match;
"did I spend 500 on food?" is still a question). The ask.ts argument holds and
this is its spoken half: a question is only ever **matched** to a fixed list —
the next move, the bet, the goals, safe to spend, spending and money in over some
days and on a category or a word, balance, runway, conversations, introductions
waiting, sales, sends and replies, deep work, and ask.ts's five — and the answer
is the app's count.

- **Counted where the screens count.** The answer is worked out in the sheet
  from the home as loaded and `derive()` (the Path's and Proof's own wiring),
  the book a month at a time (`/money/book`, in the currency the Money tab
  shows), and ask.ts's five from their route — so what is said is what the
  screens show.
- **Days said the way the screens count them.** A week is the last seven days,
  as the Path's week is; a month is the calendar's, as the book's is; and the
  answer says which ("in the last 7 days", "this month"). Sends, replies and deep
  work come from the two weeks the home reads back: asked about longer, the
  answer says so and gives the metrics' own thirty days, said as thirty days.
- **A failed read is said, never answered as nothing** (invariant 13): a book
  that would not open, a lab that could not be read, a currency with no rate —
  two months in two currencies are not added up.
- **A model only places the question.** Where the rules match nothing and the
  server has a model, `POST /api/copilot/asked` asks it which question on the
  list it was (`normalizeAsked`: an id off the list, days only when the words
  said some, "about" only if said or one of their categories) — never the answer.
  The card says "understood by AI". What matches nothing is said to be
  uncountable, and the copy for Claude carries the question.
- **Read aloud with the phone's own voice** (`speechSynthesis`, `Speak.ts`), in
  English, money in words ("850 pesos", `spokenMoney`). A voice that fails says
  so on the card. Nothing is ever logged from here.

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
| POST | `/api/copilot/offer` | `{ sells, for_who, problem, price_band, proof_url, found_by?, bet? }` — every change is recorded as a version of the offer; `bet` ties that version to the bet it was written for |
| POST | `/api/copilot/lab` | the bets: `open` (with `idea`, `unit`, `experiment`), `stop`, `talk` (with `role` and `via`, the introduction it came through), `intro` (asked for, or fell through), `forget`, `count`, `uncount`, `link` (a project to a bet), `checkpoint`, `ideas` (three from a model, for one part), `found_by` — never a verdict |
| GET/POST | `/api/copilot/assets` | `GET ?id=` one asset whole · `POST` `add`, `version`, `draft` (by AI), `retire`, `restore`, `adopt` (make a version of the offer yours), `proof` (a demo's link as the proof) |
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
| GET/POST | `/api/copilot/nightly` | "Run again": `POST` starts tonight's pass for this account and returns 202 with its row, or the pass already in flight · `GET` is the latest pass, polled while it runs |
| GET/POST/DELETE | `/api/copilot/watch/sources` | the feeds this profile watches |
| POST | `/api/copilot/watch/discover` | find feeds for the offer; every result is fetched and parsed before it is offered |
| POST | `/api/copilot/watch/run` | read the sources now (25s budget) — the nightly budget cannot fit the watcher |
| GET/POST | `/api/copilot/working` | the working file: write a line, confirm or decline a reading |
| DELETE | `/api/copilot/working?id=` | remove a line |
| GET/POST | `/api/copilot/commissions` | read the thread · write a mandate (always as a draft) |
| POST | `/api/copilot/commissions/[id]` | `approve` · `unblock` · `stop` · `done` · `seen`. `approve`, and `unblock` with an `answer`, hand the work to the worker in `after()` and answer `started`. `stop` and `done` carry the close-out verdict `{ worth, amount?, note? }`, and answer with `recorded` plus a `note` when it did not reach the ledger |
| POST | `/api/copilot/commissions/[id]/result` | **the worker's return leg** (Bearer `COPILOT_INBOUND_SECRET`) |
| POST | `/api/copilot/commissions/run` | hand live mandates over now (25s budget) |
| POST | `/api/copilot/obligations` | money owed, either way |
| POST | `/api/copilot/actions/[id]/opened` | `sendBeacon` target — a draft's deep link was tapped |
| POST | `/api/copilot/deck` | the Swipe tab, one card at a time, never answering with the home: `{ action: 'draft', kind: business \| draft \| find, id, via: whatsapp \| sms \| call \| email \| site \| post }` the card's message (`from: model \| offer`, `note` when not the model's) · `{ action: 'reach', kind, id, via, body, subject? }` the right swipe (`mode: sent` from their own number, else `open` with the draft's `actionId` and `link`) · `{ action: 'sent', id (the draft's action), via, body?, subject? }` · `{ action: 'unsent', id }` · `{ action: 'posted', kind, id, via }` · `{ action: 'skip', kind, id }` |
| POST | `/api/copilot/moves/:id` | `{ status: done \| dismissed \| handover }` — `handover` turns a proposed Move into a live mandate |
| GET | `/api/copilot/ask` | five questions about your own rows, each answered by counting. No model, no free text |
| POST | `/api/copilot/asked` | `{ heard }` → which question on the Ask list was asked (`{ asked: { id, period, about } \| null, why }`), by a model, when the sheet's own rules could not tell. Never the answer, never a write; 300 a day |
| GET | `/api/copilot/handoff` | everything the app knows, as text to paste into any model |
| POST | `/api/copilot/money/import` | multipart `file`: a bank statement. CSV/TSV/OFX, and a PDF whose running balance holds by rules, are read in the request and answer with the import and the screen; any other PDF or a screenshot answers 202 and is read by a model in `after()` (30 a day, 10 MB) |
| GET/POST | `/api/copilot/money/book` | the Money tab. `GET ?month=YYYY-MM&view=EUR` the month's list, calendar and balance · `POST { action: 'add', id (the phone's uuid: a retry is one row), kind: in \| out, amount, currency? (typed in; converted at its day's rate), on, category?, note?, repeat?: week \| month }` · `{ action: 'edit', id, …same }` · `{ action: 'delete', id }` (an upcoming repeat stops its series) · `{ action: 'balance', balance, currency? }` (the currency only the first time) · `{ action: 'entry', currency }` (the default to type in). Every POST answers with the book for the month and view sent, or `{ balance }` with `reply: 'balance'` |
| GET | `/api/copilot/money/book/export` | every row the book reads, as a CSV download |
| GET | `/copilot2/log` | the Log money shortcut's own page: the keypad, three reads, kept by the service worker for offline |
| POST | `/copilot2/share` | the manifest's share target: multipart `file`. Normally taken by the service worker; this route is the fallback, importing through the upload route and redirecting to the Money tab |
| GET/POST | `/api/copilot/money` | `GET` the statements, polled while one is read · `POST { action: 'confirm' \| 'discard', id }` · `{ action: 'currency', id, currency }` (three letters, for a file that named none) · `{ action: 'name', key, role: client \| employer \| self \| other \| null, opportunity_id? }` · `{ action: 'forget', confirm: 'DELETE' }` |
| POST | `/api/copilot/lab` | the Lab: `{ action: 'open', bet: { part, belief, play?, metric, target, tries?, days } }` — refused while a bet runs, or while the Lab cannot be read · `{ action: 'stop', id, note? }` · `{ action: 'talk', talk: { on?, who?, role?, problem, commitment, said?, via? } }` — `via` must be an introduction on record, offered on or before it · `{ action: 'intro', intro: { talk, outcome: 'asked' | 'dropped' } }` · `{ action: 'forget', id }` · `{ action: 'checkpoint', checkpoint: { decision, part?, note?, chain } }`. No action posts a verdict. Each answers with the home (`copilot_events`) |
| POST/DELETE | `/api/copilot/focus` | `{ minutes, on?, note? }` — log a block of deep work (`copilot_events`, `focus_logged`) · `?id=` removes one |
| GET/POST | `/api/copilot/roadmap` | the Path's drawn plan: `POST { action: 'draw', reason? }` writes a `copilot_agent_runs` row of kind `roadmap`, draws in `after()` and returns 202 (or the draw in flight; 12 a day) · `POST { action: 'mark', item, state: done \| dropped \| open }` ticks a step or milestone of the current plan (`copilot_events`, `roadmap_marked`) · `GET` is the latest draw, polled while it runs |

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
  "today": "YYYY-MM-DD",
  "log": [ { kind, step, summary, at } ] }
```

`today` is the person's own date in their timezone. Without it a worker asked
"Which year should I use for October 5: 2025 or 2026?" on October 1, 2026 — it
had the objective, the person and the log, and no idea when now was. The
reference worker opens its task with it and is told a date without a year means
the next one; a worker imported before this needs re-importing to read it.

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
daily read, the per-source judge, and a commissioned worker — and, since the
Swipe tab, the messages written for its cards (`writeDeckDraft`). It does **not**
reach the Draft button's draft: `draftOpener` calls `openerTemplate`, which is built from the
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
normalisation, starter agent, session signing — and, for the plan's judgement, due dates
counted down (`due.ts`), the will-it-work verdicts and the record's signals (`outlook.ts`),
the experiment's parse, novelty, life and ledger (`experiment.ts`), and a call that
follows a redrawn plan only while it is unanswered (`replacesCall`).

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

- **No bank link yet.** Statements are uploaded; the link seam (`provider`, `startImport` with `link`,
  `finishImport` with a provider) has no provider behind it, so nothing offers one.
- A credit-card export with no balance column can come in with purchases positive: there is no balance
  to prove the sign wrong. Bank-account exports and anything with balances are corrected by them.
- Money moved between two uploaded accounts counts as income on one and spending on the other until the
  person names the counterparty their own account. Nothing pairs the two rows automatically.
- Two sources for the same money are not reconciled. A card purchase in a bank statement and the same
  purchase logged in a budgeting app are two accounts, so both count. Dedupe is within one account
  (overlapping exports of the same file); across sources the advice is one source per kind of money.
  The same holds for the Money tab: a move logged there and again in a budget app whose CSV is shared in
  counts twice in spending (never in the book's balance, which only logged rows move).
- The book's balance counts every row logged after it was said, back-dated ones included. A move from
  last week logged today is taken as not yet in the balance typed this morning; if it was, tap the
  balance and say it again.
- The share target is Android's: iOS has no share target for installed web apps. There, Bank statements
  still takes the file.
- Uploads that name neither a bank nor an account number (most budgeting-app exports) share one
  account, so two different such apps would dedupe against each other on identical day/amount/payee rows.
- A PDF that prints debits and credits as unsigned figures in two columns loses the column in its text
  layer; its chain fails and it goes to the model. Nothing infers a sign from the balance delta, because
  the first row has no delta to prove it.
- Removing a statement leaves the wins its deposits became. Deliberate, and said on the sheet, but a
  statement removed because it was wrong leaves wins that were wrong with it.
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
- The working file does not reach the Draft button's draft (it does reach the Swipe tab's).
  Three of its six sections are worth typing mostly for what they would do to one. See the
  working file section above.
- The Swipe tab's guard on numbers checks that a number's digits are in what the model was
  given, not what it is used for: a listing with 40 reviews would let "we helped 40 bakeries"
  through. The prompt forbids it; the guard catches the numbers that are in nothing.
- A reply posted to a thread or sent through a contact form has no recipient, so it is not a
  send in the funnel: the find's Move is done, the business acted, and nothing waits for a
  reply to it.
- The Swipe pile's own order (Later, put back) lives with the tab: leaving it and coming back
  deals in the server's order again. What was answered is kept.
- The outreach sheet opens on the stage it was asked for each time: a record opened over it
  and closed again brings it back on that stage, not the pill last tapped.
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
- The chain places agents on the part of the business they run, and a bet shows the projects tied
  to it (`lab_link`); a project written from a part's own move is not yet tied to that part, and the
  plan's experiment reaches a part only by becoming a bet (`experimentPart` guesses one from its
  angle, and the person can move it). The planner tagging an experiment's part, and a commission
  keeping the part it was written for, need a field — the commission one a migration.
- An asset is versioned and tied to the bet it was made for, but not to the sends it went out in.
  Which proof link, demo or opener was in which message — and what came back — needs a version to be
  something an execution can point at.
- A count the person logs (`lab_count`) and a sale logged from Proof are dated the day they are
  logged on, or a day chosen inside the bet; a sale has no "earlier" yet, so one logged a day late
  counts on the day it was logged.
- Refusals are keyed on `decision.topic`, and only Move-driven calls write a job key
  there: `starterDecision` writes `'sending'`, `'opener'`, `'offer'`. Refusing the
  starter ladder therefore increments a counter `scoreMove` never reads, and the starter
  ladder is what runs when every job has been barred — so the one path that cannot be
  stood down is the one reached by standing everything else down.
