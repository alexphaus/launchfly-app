# Working in this repo

Two products share this repository and almost nothing else.

| | Where | What |
| --- | --- | --- |
| **Launchfly** | `src/app/*` (except below), `src/lib/*` (except below) | The original product: AI website/store generation, WhatsApp sales agents, prospect pipeline. |
| **The Copilot** | `src/app/copilot/`, `src/app/lifeos/`, `src/app/api/copilot/`, `src/lib/copilot/`, `scripts/tests/copilot-core.test.ts` | A mobile-first installable PWA for local outbound. Shares the Supabase project, the Next runtime, the WhatsApp provider, Resend and the Apify Maps scraper — **none of the business logic**. |

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
npx tsx scripts/tests/copilot-core.test.ts    # 9 pure-module suites, ~2s, no DB
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
throwaway `src/app/copilot/zz-preview/page.tsx` rendering `<CopilotApp initial={fixture}/>`,
screenshot it, then **delete it and confirm `git status` before committing**.
Never verify inside a `/tmp` worktree — Turbopack rejects a symlinked
`node_modules` with "Symlink node_modules is invalid, it points out of the
filesystem root". Work in the main checkout.

To kill a dev server, use a PID file. `pkill -f "next dev"` matches your own
shell's command line and kills the session (exit code 144). A stale
`.next/dev/lock` after that needs `rm -f .next/dev/lock`.

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

Migrations are **not** applied automatically. `supabase/migrations/*.sql` are run
by hand in the Supabase SQL editor. Several are still unapplied in production —
a missing column shows up as a runtime error like `column "plan" does not exist`,
so when something works locally and not in production, suspect this first.

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
   unscoped rule.

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
