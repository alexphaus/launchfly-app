# Foundation Copilot — prototype review & backend

Status: **backend vertical slice built.** Schema, domain logic, 8 API routes, cron
and unit tests are in. No UI yet — the prototype HTML is still the spec for that.

---

## 1. What the prototype actually proposes

Four tabs, one capacity switch:

| Tab | Promise |
|---|---|
| **Today** | A read on your week's data, a plan fitted to today, and the 2-3 things that decay if ignored |
| **Opps** | Ranked, explained opportunities — clients, people, services, communities, signals |
| **Growth** | Skill gaps measured against demand you actually saw and missed |
| **You** | Goals that steer the ranking, plus context sources that sharpen it |

Three things in it are load-bearing, and the backend is built around them:

**The capacity switch is the product.** "Matches and today's plan re-rank
instantly to fit what you actually have right now." *Instantly* rules out
recomputing scores on every switch. So the stored score is capacity-neutral, and
capacity is a pure re-sort at read time (`rerankForCapacity`). Switching modes
costs one profile write and zero model calls.

**Every number is a claim someone will check.** "92% MATCH", "3% reply rate",
"4.2 months runway", "3 opportunities you weren't matched to". A model that
invents any one of these destroys trust in all of them. So scores are computed
in code (`scoring.ts`) and every factor writes its own plain-language note; the
model only compresses those notes into a sentence and can never move a number.

**A cold-start user is a real user.** "Nothing is connected yet — matches run on
what you tell the copilot directly. Each source you add sharpens ranking, it
doesn't unlock new tabs." So there is no gating: no connected source lowers
`confidence`, which is stored on every match and brief and shown, never hidden.

### What the prototype leaves open

These need product answers before the UI is worth building:

1. **Where do opportunities come from?** The mock shows Bossjob, Telegram
   groups, and market signals. Scraping, partner APIs, and user-forwarded email
   are three very different businesses. `POST /api/foundation/opportunities` is
   source-agnostic so this can be answered later, but it has to be answered.
2. **"AI drafted" — drafted from what?** Writing "risk-reversal close, ready to
   review" requires the thread it replies to. Until a chat or email source is
   connected, drafts can only be generic. `foundation_actions.draft_content` is
   modelled; nothing populates it well yet.
3. **What is a "signal"?** "AU trades demand for voice-first intake is rising"
   is market research, not a matched opportunity. It scores on a different basis
   and probably deserves its own surface.
4. **Attribution.** Growth claims "3 opportunities you weren't matched to" — that
   only holds if the corpus is complete enough to say what was missed. With one
   source connected, it is a claim about your feed, not about the market. The
   copy should say so.

---

## 2. How it fits the existing codebase

**The one real divergence:** Launchfly is business-scoped. Every table keys on
`business_id`, and the AI answers *"what should this business do for its
customers?"*. Foundation is operator-scoped — it answers *"what should this
person do today?"* — and a Foundation user may have no business at all.

So Foundation tables key on `auth.users`, with `foundation_profiles.primary_business_id`
as an optional back-link for users who have both. Rule of thumb going forward:
if a type needs `business_id` to make sense, it belongs in the existing modules,
not here.

**What is reused rather than rebuilt:**

| Existing | Foundation use |
|---|---|
| `src/lib/ai-provider.ts` (DeepSeek) | brief narration + match reasons |
| `text-embedding-3-small` / pgvector | semantic matching, same 1536 dims as `ai_memories` |
| `agent_tasks` + `src/lib/agent/runner.ts` | `foundation_actions.agent_task_id` — where real drafting will run |
| Cron pattern (`CRON_SECRET`, per-run cap) | `/api/cron/foundation-daily-brief` |
| `createRouteHandlerClient` auth | `requireUser()` |
| Supabase + RLS | one owner policy per table |

**Deliberately not reused:** `ai-cofounder/*` and `central-ai-brain/*`. Both are
business-scoped and both instantiate clients at module load. Foundation
initialises lazily so its routes don't inherit that build fragility.

---

## 3. What was built

```
supabase/migrations/20260903_foundation_copilot.sql   10 tables, RLS, ivfflat, 1 RPC
src/lib/foundation/
  types.ts        domain types
  capacity.ts     capacity model — pure, no IO (this is why re-rank is instant)
  scoring.ts      deterministic scorer — the "92% MATCH" number
  embeddings.ts   text-embedding-3-small helpers, degrade to null not throw
  db.ts           service client, requireUser, event log
  context.ts      one-read operator context + honest confidence
  matcher.ts      ingest → embed → score → explain → persist
  brief.ts        observe (code) → narrate (model) → plan
  growth.ts       skill gaps from real demand, learning suggestions
src/app/api/foundation/{today,opportunities,opportunities/[id],capacity,
                        actions/[id],growth,goals,context-sources,profile}
src/app/api/cron/foundation-daily-brief/route.ts     hourly, fires at each user's local brief_hour
scripts/tests/foundation-scoring.test.ts             26 assertions, no network
```

### The scoring model

Four weighted factors, capacity-neutral, summing to 100:

| Factor | Weight | Asks |
|---|---|---|
| `skillFit` | 0.40 | Can they actually do it? Explicit skill tags, weighted by proficiency; embedding similarity fills in for untagged posts |
| `valueFit` | 0.25 | Is it worth their hour? Compared against `min_deal_value`; below the floor is penalised, not just ranked lower |
| `urgency` | 0.15 | Does it decay? Deadline proximity and post freshness |
| `goalAlignment` | 0.20 | Does it move the goal they set? Revenue gap coverage, amplified by short runway |

Capacity is applied *after*: `adjusted = score × capacityFit(required, current)`.
Work too big for the moment is demoted to 25-55%, never hidden — hiding the
$1,800 job because someone is tired is the wrong call, and the operator can
always switch modes.

### Two-pass generation, everywhere

Both the brief and the match reasons follow the same shape, and this is the
pattern to keep for anything new:

1. **Observe (code)** — gather checkable facts. Each becomes a stored evidence
   row. `See the reasoning →` renders these; it is not a second generation pass.
2. **Narrate (model)** — compress into prose, with an explicit ban on facts not
   in the list.

If the model call fails, both still ship, assembled from the observations. A day
without DeepSeek is a plainer brief, not a broken one.

### The feedback loop

Every state change writes `foundation_events` — including what the system had
scored the thing at. A dismissed 92% match is the most valuable signal available
and must not be discarded as a UI-only change. Nothing consumes this yet; it is
being accumulated so that weight-tuning has data to work from.

---

## 4. Deploying it

1. Run `supabase/migrations/20260903_foundation_copilot.sql` (needs `pgvector`,
   already used by `ai_memories`).
2. Env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`
   (embeddings), `DEEPSEEK_API_KEY` (prose), `CRON_SECRET`. All already set for
   the existing app.
3. The hourly cron is registered in `vercel.json`. It only generates for
   profiles with `onboarding_complete = true` whose local `brief_hour` matches,
   capped at 50 per run.
4. `npx tsx scripts/tests/foundation-scoring.test.ts` — no network, safe in CI.

### Local testing without auth

Set `FOUNDATION_ALLOW_DEV_USER=true` (non-production builds only) and pass
`x-foundation-user-id: <uuid>`. The flag is inert in a production build, so the
header can never become an auth bypass on a deployed environment.

```bash
curl -X POST localhost:3000/api/foundation/opportunities \
  -H 'content-type: application/json' -H 'x-foundation-user-id: <uuid>' \
  -d '{"items":[{"title":"WhatsApp booking build for an agency client",
                 "type":"client","value_amount":1800,"effort_hours":10,
                 "required_skills":["n8n","whatsapp-api"],
                 "summary":"Agency already sold the client; needs inventory locking."}]}'

curl localhost:3000/api/foundation/today -H 'x-foundation-user-id: <uuid>'
curl -X PUT localhost:3000/api/foundation/capacity \
  -H 'content-type: application/json' -H 'x-foundation-user-id: <uuid>' \
  -d '{"mode":"low"}'
```

---

## 5. What I would build next, in order

1. **One real opportunity source.** Everything above is a ranking engine with
   nothing to rank. Until a source lands, every score is computed over a corpus
   the user typed in themselves. This is the single highest-value next step.
2. **The UI**, against these routes. The prototype's four tabs map 1:1:
   `/today`, `/opportunities`, `/growth`, `/goals` + `/context-sources`.
3. **Drafting.** Wire `foundation_actions.agent_task_id` to the existing agent
   runner so "AI drafted" rows carry a real draft, and approval flows to the
   channel that owns the transport.
4. **A finance context source**, so runway and the pricing floor stop being
   hand-entered — they drive two of the four scoring factors.
5. **Tune weights from `foundation_events`** once there is a month of dismissals
   and wins to learn from.
