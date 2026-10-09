# Working in this repo

Two products share this repository and almost nothing else.

| | Where | What |
| --- | --- | --- |
| **Launchfly** | `src/app/*` (except below), `src/lib/*` (except below) | The original product: AI website/store generation, WhatsApp sales agents, prospect pipeline. |
| **The Copilot** | `src/app/copilot/`, `src/app/lifeos/`, `src/app/copilot2/`, `src/app/api/copilot/`, `src/lib/copilot/`, `scripts/tests/copilot-core.test.ts` | A mobile-first installable PWA for local outbound. Shares the Supabase project, the Next runtime, the WhatsApp provider, Resend and the Apify Maps scraper — **none of the business logic**. |

The copilot's fourth tab is called **Engine** on screen (it was Proof until October
2026). Its key, files, routes and the connector's `get_proof` are still `proof`, and
both names open it. Code and docs that say Proof mean this tab.

Almost all recent work is the copilot. Two docs carry the context this file
deliberately does not repeat:

- **`docs/COPILOT.md`** — architecture, the loop, the schema, every API route.
  Read it before changing anything under `src/lib/copilot/`.
- **`docs/DIRECTION.md`** — the thesis, what is deliberately *not* being built,
  and the test a proposed feature has to pass. Read it before proposing one.

---

## Verifying a change

Three commands, in this order. All three must pass before you say a change works.

```bash
npx tsc --noEmit                              # strict; catches most of it
npx tsx scripts/tests/copilot-core.test.ts    # 88 pure-module suites, ~2s, no DB
npm run build                                 # the one that catches route/type drift
```

`npm run build` **requires `.env.local`** with placeholder values for Supabase and
Stripe *and* `DISABLE_EXPENSIVE_AI_FUNCTIONS=true`. Without that flag the build
fails on a pre-existing duplicate registration in `src/lib/inngest/functions/index.js`
(lines 77–78 register `enhancedColdEmailOutreach` twice). That is not your change.
`.claude/hooks/bootstrap-env.sh` writes a usable `.env.local` if one is missing
(and never overwrites a real one). The SessionStart hook runs it for you in a
remote session. In a remote session also run the build (and any dev server) with
`NODE_USE_ENV_PROXY=1`: `next/font/google` downloads Sora with Node's own fetch,
which ignores `HTTPS_PROXY` without it, and the build fails with "next/font/google
queries have exactly one entry" — a network failure, not your change.

**There is no working linter.** `npm run lint` calls `next lint`, which Next 16
removed — it fails with "Invalid project directory provided, no such directory:
.../lint" — and there is no `eslint.config.*` in the repo. So `tsc` is the only
static check. Do not report that lint passed; there is nothing to run.

**Verify UI in a browser, not by reading JSX.** Chromium is at
`/opt/pw-browsers/chromium`; shoot at 390×844. The pattern that works: a
throwaway `src/app/copilot/zz-preview/page.tsx` rendering `<CopilotApp initial={fixture}/>`
(or `src/app/copilot2/zz-preview/page.tsx` rendering `<CopilotApp2 …/>` for the
four-tab layout, so it picks up the calm theme from that layout), screenshot it,
then **delete it and confirm `git status` before committing**.
Never verify inside a `/tmp` worktree — Turbopack rejects a symlinked
`node_modules` with "Symlink node_modules is invalid, it points out of the
filesystem root". Work in the main checkout.

When a layout is wrong, **read the computed box out of the browser** rather than
reasoning at the CSS. `.cp-steps` already existed and sized every `span` inside
it to 14x8, so a new component that reused the name rendered as grey rectangles
with its label stacked on top. Two rounds of theorising missed it; one
`getComputedStyle` found it. Scoping to `.cp-root` does not help when the
collision is inside `.cp-root` — pick class names that are distinctive in a
900-line file, not merely prefixed.

To kill a dev server, find it **by port** (`ss -lptn 'sport = :3000'`, or
`lsof -iTCP:3000 -sTCP:LISTEN` where `ss` is not installed), not by name. `pkill -f "next dev"` matches your own shell's command line and kills the
session (exit code 144) — this has happened twice. A PID file alone is not
enough either: stale servers survive under PIDs it lost track of, and the symptom
is `EADDRINUSE` with a 500 from a half-built `.next`. A production build and a
dev server cannot share `.next`; `rm -rf .next` between them.

---

## Deploying

**Coolify watches `v2.7.1`.** That is the deploy branch, not `main`.

**`vercel.json` crons are inert.** This deploy is not on Vercel, so nothing in
that file runs. Anything that must happen on a schedule needs a Coolify
scheduled task hitting the endpoint. As of this writing
`/api/copilot/cron/daily` has almost certainly never fired in production —
check with:

```sql
select kind, agent, status, finished_at from copilot_agent_runs order by started_at desc limit 10;
```

Set it up as a Coolify **Scheduled Task** running `node scripts/copilot-cron.mjs`
on `0 21 * * *`. That executes inside the container, so it reaches the app on
localhost and bypasses Traefik entirely — the proxy timeout does not apply to
the cron. The route accepts either `CRON_SECRET` or `COPILOT_CRON_SECRET`.

To see what the pass does without waiting for 21:00, use You → Nightly run →
**Run again** in `/copilot2`. It runs the cron's own code path (`runNightlyPass`)
for your account and reports each step on that row. It records
`reason = 'nightly_now'`, never `cron`, so it cannot make a schedule that never
fires look alive. Each pass, from either caller, is a `copilot_agent_runs` row
with `kind = 'nightly'`.

To find out what is actually missing rather than guessing, paste
`scripts/sql/copilot-schema-check.sql` into the Supabase SQL editor: every row
it returns is a column or table the code expects and the database lacks, with
the file that adds it. No rows and a `PGRST204` still showing means the cache is
stale, not the schema — `notify pgrst, 'reload schema';`.

The app's own web searches (`copilot_hunts`, 20260925) need `EXA_API_KEY` and
that migration. Without either, Maps and feeds run as before and the Scout (under
Agents on Proof) says what is missing — there is no screen of searches to check instead.

Bank statements (`copilot_money_*`, `copilot_transactions`,
`copilot_counterparties`, 20260929) need that migration and nothing else for CSV
and OFX. PDFs and screenshots are read by a model: the brief's, or
`COPILOT_STATEMENT_MODEL` when the brief's model does not take images. Without
the migration the Bank statements sheet says it is not set up and
`/api/copilot/health` names the file.

Every money figure is counted in one main currency (Settings → Currency), and
statements in others are converted at ECB daily rates fetched from
`api.frankfurter.dev` (`COPILOT_FX_URL` overrides). That needs outbound HTTPS
from the container, and `20260930_copilot_fx.sql` to cache the rates — without
the table they are kept in memory and fetched again after each restart; without
the network, rows in other currencies are left out of the figures and the
screen says why. The remote dev sandbox's network policy blocks that host: test
conversion against a local stand-in on `COPILOT_FX_URL`.

The Money tab (`copilot_transactions.category`, `note`, `repeat`, 20261001)
needs that migration and nothing else; without it the tab says so. Logging a
move in another currency also needs `20261002_copilot_book_entered.sql`; without
it that alone is refused, naming the file. The share target (a budget app's
Export → Share → Copilot) and the Log money shortcut's move to `/copilot2/log`
need the app reinstalled, or Chrome's next refresh of it; the old shortcut URL
redirects meanwhile.

**The count link** (You → Records → Sign-ups and sales, `/api/copilot/signal/*`)
needs no migration and no new secret: links are signed with a key derived from
`COPILOT_SESSION_SECRET`, signals are `copilot_events` rows, sales are
`copilot_outcomes` with `source = 'webhook'`. The addresses it shows are built
from `NEXT_PUBLIC_APP_URL`, and `/api/copilot/signal/*` must be reachable from
the outside (Stripe, form tools). Rotating the session secret ends every link. If
the app is what you sell, set `COPILOT_OWN_COUNT_LINK` to your own link and each
new account counts as a sign-up on your Proof; `/api/copilot/health` says when
it is set and wrong.

**People who said it** (a conversation bet's posts, Proof) needs `EXA_API_KEY` and
no migration: searches and set-asides are `copilot_events` rows, and each post kept
spends one of the month's matches. Without the key the section is not shown.

**Your page** (a landing page put online from its sheet, `/p/<code>`) needs no
migration and no new secret: the address is signed with a key derived from
`COPILOT_SESSION_SECRET` (rotating it changes every page's address), and states and
counts are `copilot_events` rows. The address shown is built from
`NEXT_PUBLIC_APP_URL`, and `/p/*` and `/api/copilot/page/*` must be reachable from
the outside. The page is served by a route, not a page, so the root layout's
script and service worker stay off it; its policy lets one script run by nonce.

**The Claude connector** (You → Claude, `/api/copilot/mcp`) needs no migration
and no new secret: its client ids, codes and tokens are signed with a key derived
from `COPILOT_SESSION_SECRET`, and its few rows are `copilot_events`. It does need
`NEXT_PUBLIC_APP_URL` set to the public origin — the address the sheet shows, the
discovery document's `resource` and every token's audience are built from it, and
Claude refuses a mismatch — and `/.well-known/*` and `/api/copilot/*` reachable
from Anthropic's `160.79.104.0/21`. Rotating the session secret ends every
connection; each has to be added again. Proposing (`copilot.propose`) is a tick
on the consent screen: a connection made before it, or without the tick, only
reads — disconnect it under You → Claude and connect again to let it propose.

**Testing the connector:** Allow on the consent screen answers with a 303 to
claude.ai, and a Playwright route handler does not see a redirect's target — read
the `Location` of the `/api/copilot/oauth/authorize` response instead. The whole
flow (register → consent → token → MCP → refresh → revoke) runs against a dev
server whose `NEXT_PUBLIC_SUPABASE_URL` points at an in-memory stand-in for
Supabase's REST API; sign the session cookie as
`pid.hmac_sha256(COPILOT_SESSION_SECRET, pid)`. Claude cannot reach a sandbox:
to try a real connection, deploy, then add the address from You → Claude.

**Testing the bet's search and the page:** `COPILOT_EXA_URL` points the Exa calls at
a stand-in (as `COPILOT_FX_URL` does for rates), and `COPILOT_AI_API_KEY` with
`COPILOT_AI_BASE_URL` at a Responses API stand-in writes the searches. The whole
loop — search, talk logged from a post, set aside, publish, a stranger's open and
tap, the owner's visit not counted — runs against a dev server whose
`NEXT_PUBLIC_SUPABASE_URL` points at an in-memory PostgREST stand-in. Open the page
in a context without the session cookie: the owner's own visits are not counted, by
design. A forged code answers 404, and a `GET` on the count's address counts nothing.

**Testing offline:** Playwright's `setOffline` does not cover a service
worker's own requests, and `public/sw.js` passes the page's API calls through
itself — so an "offline" test with it quietly sends everything. Stop the server
instead, with `launchPersistentContext` so the worker, its caches and the
outbox survive between the phases.

**Testing the Swipe tab:** a right swipe hands `sms:`, `tel:` and `mailto:` to
the phone's own apps. Headless Chromium has none, and its "open external app"
prompt then swallows every click on the page — the test looks like a dead
button. Wrap `HTMLAnchorElement.prototype.click` in an init script to record
those links instead (the tab opens them as a clicked link for this reason). The
cards' messages need a model: a stand-in must answer the Responses API
(`/v1/responses`), which is what the AI SDK calls. Test the drag with touch, not
the mouse: a `hasTouch` context and CDP `Input.dispatchTouchEvent`. Only touch
input goes through `touch-action`, and a mouse-drag test passed while on every
phone the card moved a few pixels and sprang back (COPILOT.md → **Swipe**).

**Testing the mic:** headless Chromium has no microphone, and its own
`webkitSpeechRecognition` fails. Put a stand-in `SpeechRecognition` on the page
with `addInitScript` that fires `onresult`/`onend` for a set phrase (or
`onerror` with `not-allowed`, `no-speech`); delete both constructors to see the
+ the header shows where a browser has none. A question the Ask sheet can count
(`askedOutright` in `tell.ts`) opens it and is answered aloud: headless Chromium
has no voice either, so define `window.speechSynthesis` and
`SpeechSynthesisUtterance` in the same init script and record what `speak` was
given. The Ask sheet reads the book a month at a time
(`/api/copilot/money/book?month=`) and calls `/api/copilot/asked` only when the
home says a model is configured (`home.ai`) and its rules missed. Anything else
said that is not plainly money goes to `/api/copilot/tell` under the same flag;
answer these routes with `page.route` to see each sheet, or leave `ai` off and
the rules sort it in the browser.

Migrations are **not** applied automatically. `supabase/migrations/*.sql` are run
by hand in the Supabase SQL editor. Several are still unapplied in production —
a missing column shows up as a runtime error like `column "plan" does not exist`,
so when something works locally and not in production, suspect this first.

**A partial unique index and an upsert do not mix.** PostgREST's `on_conflict`
emits no index predicate, so Postgres cannot infer a `where`-qualified index: the
write fails `42P10` every time. `20260917` shipped one, every nightly proposal
was swallowed, and half a feature was dead on arrival with no visible symptom
until `20260918` dropped the predicate.

Write every migration **additive and idempotent** (`add column if not exists`,
`create table if not exists`), and write read paths so a missing column or table
degrades to an empty state rather than a blank screen — code and schema deploy
separately here and will be out of order.

---

## Git

- One branch per change, off the **latest `origin/v2.7.1`**. One PR, based on
  `v2.7.1`.
- **Never push to a merged PR.** It cannot track new work. Branch fresh from
  `origin/v2.7.1` and open a new PR. (This has been got wrong three times.)
- **Never base a PR on another feature branch.** GitHub only retargets an open
  PR onto the repo default branch, and only when the base branch is deleted —
  so a stacked PR merges into the wrong branch and the work silently never
  reaches `v2.7.1`. (This has been got wrong once, and cost two phases.)
- Commit messages explain *why*, in prose. Look at recent history for the voice.
- Open a PR against `v2.7.1` for every change you push, without waiting to be
  asked and without only offering one: the owner reviews and merges from PRs,
  so a pushed branch with no PR is work nobody is looking at.

---

## Invariants

Each of these is load-bearing and each has a story. Do not "simplify" one away
without reading why it exists.

1. **Nothing drafts from a blank offer.** `offerIsEmpty()` gates the agent
   prompt, the starter, the draft route and `persistBrief`. 44 messages were
   written from a blank offer and 0 were sent; a message written from nothing is
   not the user's.
2. **The user's numbers are never invented.** Skill levels and estimated
   percentages were deleted in `3eaa03f`. If a number is shown it is computed
   from rows the user created. A lesson with no URL is not rendered.
3. **Sourced beats inferred, always.** An LLM guess is capped at
   `INFERRED_SCORE_CAP` and can never outrank a real listing.
4. **Nobody sends under an identity they do not own.** See the multi-user rule
   at the top of `docs/COPILOT.md`. Server WhatsApp/Resend credentials are the
   operator's and are never used on a user's behalf.
5. **"Ignored" is inferred, never asked** (`gradeDecisions`). Self-reported
   neglect produces a record that cannot tell you which calls were wrong.
6. **Free supply is not metered.** `SupplyAdapter.billable` — a free adapter
   must not spend a paid allowance.
7. **Never advertise a capability with no route behind it.** `emailApi` was
   sold on the pricing page while `setSendMode()` had no caller; a test now
   fails if it comes back.
8. **A one-time token is never spent by a `GET`.** Gmail scans every link in an
   email and Resend rewrites them through its own click tracker, so a magic
   link consumed on `GET` is dead before the recipient taps it — this locked
   the live account out. The `GET` peeks; a `POST` behind a real button
   consumes.
9. **CSS is scoped.** Everything lives under `.cp-root` in
   `src/app/copilot/copilot.css`, and every calm-theme rule under
   `.cp-root[data-theme="soft"]`. A test walks the theme block and fails on an
   unscoped rule. Scoping is not namespacing — see the browser note above.
10. **A worker cannot mark its own homework.** The commission result body carries
    a `status`; it is parsed and discarded. `nextStatus` computes state from the
    events, and a `needs_you` always outranks a `done` — otherwise reporting
    success is the cheapest way to look successful, and "done" becomes how an
    unapproved action slips past the person meant to approve it. `blocked` is the
    user's to clear and only theirs.
11. **`commit` is never autonomous.** Not "not yet". An agent that can spend your
    money while you are walking is worth *less* than one that cannot, because you
    would have to audit everything it did — the exact cost this product exists to
    remove. `reach` is gated too, but for a different reason: invariant 4.
12. **Two sources and never a third.** The working file holds what the user said
    (`you`) and what the rows show (`observed`, carrying its count). There is no
    `inferred` tier: the app does not form a view about somebody's business and
    feed that view back to itself as context. Invariant 2, at the level of prose.
13. **Nothing fails silently.** "It did not crash" is not "it was fine". Three
    bugs in one week shared one shape — a component failed, the failure was
    swallowed, and the screen reported calm: an agent died and the card read
    "Nothing back yet" forever; an index failed `42P10` nightly and the sheet
    looked like an account nothing had been noticed about; a dispatch threw into
    a `console.error` while the app said "Handed over". That last one had a
    comment explaining why it was fine. Every `catch` must either surface the
    reason to the screen or record it where the screen can read it.

---

## House style

- **Comments explain why, not what.** The codebase is dense with reasons —
  match that. A comment that restates the code is noise; one that records the
  failure a line prevents is the point.
- Pure logic goes in `src/lib/copilot/*.ts` with no DB import, so
  `copilot-core.test.ts` can cover it. DB access goes in `store.ts`,
  `execution.ts`, `outcomes.ts`.
- Tests are plain `node:assert/strict` in one file, one `async function` per
  suite, appended at the end with its own imports and a `.catch()` call. No
  framework.
- Copy is written for one specific person under real pressure: concrete, short,
  no filler, second person. "Runway is 3.4 months, so unsent work is the
  expensive kind" — not "consider prioritising your outreach".
