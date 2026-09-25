# Working in this repo

Two products share this repository and almost nothing else.

| | Where | What |
| --- | --- | --- |
| **Launchfly** | `src/app/*` (except below), `src/lib/*` (except below) | The original product: AI website/store generation, WhatsApp sales agents, prospect pipeline. |
| **The Copilot** | `src/app/copilot/`, `src/app/lifeos/`, `src/app/copilot2/`, `src/app/api/copilot/`, `src/lib/copilot/`, `scripts/tests/copilot-core.test.ts` | A mobile-first installable PWA for local outbound. Shares the Supabase project, the Next runtime, the WhatsApp provider, Resend and the Apify Maps scraper — **none of the business logic**. |

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
npx tsx scripts/tests/copilot-core.test.ts    # 42 pure-module suites, ~2s, no DB
npm run build                                 # the one that catches route/type drift
```

`npm run build` **requires `.env.local`** with placeholder values for Supabase and
Stripe *and* `DISABLE_EXPENSIVE_AI_FUNCTIONS=true`. Without that flag the build
fails on a pre-existing duplicate registration in `src/lib/inngest/functions/index.js`
(lines 77–78 register `enhancedColdEmailOutreach` twice). That is not your change.
`.claude/hooks/bootstrap-env.sh` writes a usable `.env.local` if one is missing
(and never overwrites a real one). The SessionStart hook runs it for you in a
remote session.

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

To find out what is actually missing rather than guessing, paste
`scripts/sql/copilot-schema-check.sql` into the Supabase SQL editor: every row
it returns is a column or table the code expects and the database lacks, with
the file that adds it. No rows and a `PGRST204` still showing means the cache is
stale, not the schema — `notify pgrst, 'reload schema';`.

The app's own web searches (`copilot_hunts`, 20260925) need `EXA_API_KEY` and
that migration. Without either, Maps and feeds run as before and the Scout on
Work says what is missing — there is no screen of searches to check instead.

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
- Do not create a PR unless asked.

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
