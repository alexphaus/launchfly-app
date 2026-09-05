# Building the Copilot supply agent

Where real opportunities come from. The app already ships two in-process
adapters — the prospect pipeline and Google Maps — and this is the third: a URL
it calls, so the hunt can be built and changed without touching the codebase.

## How it fits

```
                       in-process adapters
copilot ──┬─► hunter        (Launchfly prospects, linked profiles only)
          ├─► google_maps   (Apify, local businesses in a target area)
          └─► remote  ──HTTP──►  YOUR AGENT  ──► Exa / job boards / Apify / anything
                                                 │
                    SupplyCandidate[] ◄──────────┘
                                │
              normalised, deduped on (profile, source, external_id),
              scored by heuristicFit, then ranked by the brief agent
```

The **brain** (ranking, drafting, the daily read) stays in the app — that is
`COPILOT_AGENT_URL`, a different seam. This one only finds things. Keep them
separate: a general "find me opportunities" agent returns categories, and
categories are what made the first prototype useless. Return rows.

## The contract

The app sends:

```http
POST $COPILOT_SUPPLY_URL
Authorization: Bearer $COPILOT_SUPPLY_SECRET
Content-Type: application/json

{
  "kind": "discover",
  "limit": 40,
  "profile": {
    "headline": "…",
    "offer": { "sells": "…", "for_who": "…", "problem": "…", "price_band": "…", "proof_url": "…" },
    "location": "Berlin",
    "target_segments": ["startup"],
    "target_area": "Berlin",
    "hunt_types": ["client", "people", "service", "community", "signal"]
  }
}
```

No profile id, no email, no goals — only what the hunt needs.

You return:

```json
{ "candidates": [ {
  "external_id": "remoteok:1001",
  "title": "Brand Designer — Northwind",
  "summary": "Northwind is hiring for Brand Designer. Stack: design, branding. Posted 2026-09-01.",
  "type": "client",
  "url": "https://…",
  "contact": { "name": "Maria", "whatsapp": "+63…", "email": "…", "website": "…" },
  "effort": "medium",
  "value_label": "$60,000+",
  "data": { "anything": "reaches the agent verbatim" }
} ] }
```

A bare array works too.

**Only two fields are required.** `external_id` must be **stable across runs** —
it is the dedupe key, so the same listing tomorrow must produce the same id, or
you will flood the pipeline with duplicates. `title` must be non-empty. Rows
missing either are dropped silently.

Everything else is normalised app-side: `phone` is accepted as an alias for
`whatsapp` and normalised to digits, unknown `type` falls back to `client`,
unknown `effort` to `medium`, results are capped at `limit`. Timeout is 90s and
there is no retry — a failing adapter is logged and the other adapters still run.

**Write summaries as facts, not adjectives.** "4.6★, 31 reviews, no website
listed" is useful; "great opportunity, high match" is noise. The ranking agent
decides what it means and writes the pitch — your job is to hand it evidence.

**Contacts are optional and honest.** Job boards give a link, not a phone number.
With no contact the app shows the match and the link but offers no drafted
message, which is correct — there is nobody to message yet. Rows *with* a phone
or email get a one-tap draft.

## Try it before building anything

```bash
node scripts/copilot-mock-supply.mjs 4010 dev-secret      # terminal 1
COPILOT_SUPPLY_URL=http://localhost:4010 COPILOT_SUPPLY_SECRET=dev-secret npm run dev   # terminal 2
```

Open `/copilot`, tap **Find new matches**. The mock prints exactly what the app
sent and returns four rows, two of them deliberately malformed so you can watch
them get dropped. Two appear in the Opps tab tagged **Real**.

## The n8n workflow

`docs/n8n/copilot-supply.json` — import it with **Workflows → Import from File**.

```
Webhook (POST /copilot-supply)
   └─► Authorize & plan      Code: check the bearer, build search terms from the offer
        └─► Authorized?      IF
             ├─ false ─► Respond 401
             └─ true  ─► Source: RemoteOK   HTTP, free, no key
                          └─► Normalize → candidates   Code
                               └─► Respond 200
```

Two things to do after importing:

1. In **Authorize & plan**, replace `REPLACE_WITH_COPILOT_SUPPLY_SECRET` with the
   value you will set as `COPILOT_SUPPLY_SECRET`. Leave it empty to disable the
   check while testing locally — never in production, since anyone who finds the
   URL can otherwise drive your scraping spend.
2. Activate the workflow and copy the **production** webhook URL into
   `COPILOT_SUPPLY_URL`. The test URL only accepts one call per *Listen* click.

Node type versions differ between n8n releases; if a node imports greyed out,
delete it and re-add the same type — the Code node bodies are the part that matters.

### What it does

**Authorize & plan** turns the offer into search terms: `for_who`, `sells` and
`target_segments`, split on commas and "and", lowercased, anything under three
characters dropped. So *"seed-stage startups and design teams"* becomes
`["seed-stage startups", "design teams", "brand identity systems", "startup"]`.
Those terms are what makes the result personal — nothing in the workflow assumes
an industry.

**Normalize** filters the board by those terms and maps each job to a candidate.
With an empty offer, terms are empty and everything passes through — better a
broad list than none.

### Adding sources

The shape to copy: one HTTP node per source, each followed by a Code node that
returns `{ candidates: [...] }`, then a **Merge** (append) before Respond 200.
Concatenate the arrays in a final Code node:

```js
const all = $input.all().flatMap((i) => i.json.candidates ?? []);
return [{ json: { candidates: all.slice(0, $('Authorize & plan').first().json.limit) } }];
```

Worth adding, in the order I would do it:

| Source | Why | Key |
|---|---|---|
| **Exa** | Semantic "find companies like this" — the one that generalises past local businesses | yes |
| More job boards | We Work Remotely, Hacker News *Who is hiring* — free, good for freelancer-shaped users | no |
| **Serper** | Cheap Google SERP for directories a board misses | yes |
| **Apify** | Extra actors (LinkedIn, Facebook groups) beyond the Maps one the app already runs | yes |
| **Hunter.io / Apollo** | Turn a company into an email, so a match becomes a draftable message | yes |

That last row is the highest-leverage addition: it converts link-only candidates
into ones the copilot can draft for.

Keep each source's `source` field distinct (`"remoteok"`, `"exa"`, …). Dedupe is
per source, so the same company found twice by two sources is two rows — that is
intended, they carry different evidence.

## Cost and scheduling

The remote adapter runs whenever the daily cron fires and whenever someone taps
**Find new matches** (capped at 10 per profile per day). If your workflow calls
paid APIs, that is your spend, per user. Cache inside n8n, or return fewer rows,
before opening this up to more than a handful of people.
