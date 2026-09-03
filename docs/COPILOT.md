# Copilot — opportunity engine (`/copilot`)

A separate, mobile-first, installable web app living inside this repo. It shares
nothing with the Launchfly business logic except the Supabase project and the
Next.js runtime. Everything is under three folders:

| Layer | Path |
| --- | --- |
| UI (installable PWA) | `src/app/copilot/` |
| API | `src/app/api/copilot/` |
| Core | `src/lib/copilot/` |
| Schema | `supabase/migrations/20260903_copilot_foundation.sql` |

## Setup

1. Run the migration in the Supabase SQL editor (or `supabase db push`).
2. Environment:

```
NEXT_PUBLIC_SUPABASE_URL=...        # already used by the app
SUPABASE_SERVICE_KEY=...            # already used by the app
COPILOT_SESSION_SECRET=...          # optional; any long random string. Falls back to the service key.

# Agent (pick one; none = deterministic starter brief)
COPILOT_AGENT_URL=https://...       # external vertical agent (preferred, see contract below)
COPILOT_AGENT_SECRET=...            # sent as Bearer token
#  or
OPENAI_API_KEY=... / DEEPSEEK_API_KEY=...   # LLM agent through the AI SDK
COPILOT_AI_API_KEY / COPILOT_AI_BASE_URL / COPILOT_AI_MODEL   # explicit override

CRON_SECRET=...                     # protects /api/copilot/cron/daily (already used by other crons)
```

3. Open `/copilot`. New device → 3-screen onboarding → first brief → app.
   Add to home screen installs it as its own app (manifest scoped to `/copilot`).

## How it works

```
onboarding / notes / connectors ──► copilot_context_items ─┐
goals, capacity, hunt types ───────────────────────────────┤
saves / skips / done (copilot_events) ─► type affinity ────┼─► ContextPack ─► Agent ─► BriefOutput
                                                           │                              │
                                                           └──── ranking.ts ◄─────────────┘
                                                                     │
                       insight · plan · nudges · opportunities · skills · lessons
```

- **Identity**: signed httpOnly cookie with the profile id (`session.ts`). No account wall.
  Swap for Supabase Auth later; the data model does not change.
- **Context pack** (`context.ts`): profile, goals, last 60 context items, connector
  status, what the user saved / dismissed / acted on, learned type affinity.
  Any new data source only has to write `copilot_context_items` to reach the agent.
- **Agent** (`agent/`): one interface, three implementations, picked by env:
  `webhook` (external service) → `llm` (AI SDK, OpenAI-compatible) → `starter`
  (deterministic, never invents opportunities). A failing agent falls back to the starter
  so Today always renders. Every run is logged in `copilot_agent_runs`.
- **Ranking** (`ranking.ts`): `score = fit·0.85 + hunt-type ±, affinity ±20, capacity fit, freshness`.
  Runs at read time, so changing capacity re-ranks instantly.
- **Daily**: `/api/copilot/cron/daily` (Vercel cron, 21:00 UTC) rebuilds briefs for
  profiles seen in the last 30 days. Opening the app with no brief for today also triggers one.

## External agent contract

`POST $COPILOT_AGENT_URL` with `Authorization: Bearer $COPILOT_AGENT_SECRET`:

```json
{ "kind": "daily_brief", "pack": ContextPack }
```

Respond with `BriefOutput` (or `{ "brief": BriefOutput }`). Types are in
`src/lib/copilot/types.ts`; the full shape is in `agent/schema.ts` (`SYSTEM_PROMPT`).
Output is normalised and capped server-side, so the agent can be generous.
This is where search, scraping and real listing discovery belong.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/copilot/onboard` | create profile + goal + context, set cookie, first brief |
| GET | `/api/copilot/home` | everything for the four tabs |
| POST | `/api/copilot/brief` | run the agent now |
| POST | `/api/copilot/capacity` | `{ capacity }` |
| POST | `/api/copilot/context` | `{ content, kind?, regenerate? }` — "tell the copilot" |
| POST | `/api/copilot/goals` | create / update a goal |
| POST | `/api/copilot/opportunities/:id` | `{ status: saved \| dismissed \| acted \| new }` |
| POST | `/api/copilot/actions/:id` | `{ status: done \| dismissed \| open }` |
| POST | `/api/copilot/sources/:key` | mark a connector as requested (foundation) |
| DELETE | `/api/copilot/session` | forget this device |
| GET | `/api/copilot/cron/daily` | scheduled briefs (Bearer `CRON_SECRET`) |

All copilot API responses are `Cache-Control: private, no-store` (rule in `next.config.ts`).

## Next steps the foundation is ready for

- Real connectors: implement a sync that writes `copilot_context_items` and flips
  `copilot_context_sources.status` to `connected`.
- Account sync: replace the cookie with Supabase Auth; keep `profile_id`.
- Push nudges: the `copilot_actions` rows with `urgency = 'urgent'` are the trigger.
- Richer learning: `copilot_events` already records every interaction.
