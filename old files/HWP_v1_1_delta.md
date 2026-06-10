# HWP v1.1 — Spec Amendments (Unit-Econ Sane Mode)

This document **amends** the existing specs:
- `hybrid_winner_plan_implementation_spec_hwp_v_1.md` (Sections: Acceptance Scorecard, 48‑Hour Runbook, RRE Lane, Evidence & Reserve)
- `launchfly_revenue_engine_v5.markdown` (NS metrics, workers, evidence filtering)
- `implementation-guide-2.md` (Emergency protocols wording)
- `gpt5.md` (policy-safe creatives, scorecard numbers)
- `winning_hybrid_model.md` (RRE positioning)

> Purpose: make the 48h/60d promises operationally honest and financially sustainable, especially in **high-CPC** niches. No public copy changes needed; these are **internal rails**.

---

## 1) Acceptance Gate → **Dynamic, by Vertical/Geo**
**Replace** any hard rule like “Search CPC ≤ €1.20” with a dynamic check:

**Decision rule:** *Accept iff* `Expected_CPA ≤ Max_Acquire_Cost`

- `Expected_CPA = CPC_band * (1 / Expected_CVR)`
- `Max_Acquire_Cost = min( Tripwire_Price, Contribution_Margin_Core )`
- Require: `≥ 2 vetted partners` in locale and offer-supply fit

### Data additions
- Add CPC bands per vertical/geo (seeded from ops): `low=€0.8`, `mid=€1.5`, `high=€3.5`, `very_high=€6+`.
- Store on project at intake: `cpc_band`, `expected_cvr`, `expected_cpa_cents`, `acceptance_reason`.

### SQL migration
```sql
alter table project
  add column cpc_band text check (cpc_band in ('low','mid','high','very_high')),
  add column expected_cvr numeric,
  add column expected_cpa_cents int,
  add column acceptance_reason text,
  add column rejection_reason text;
```

### Pseudocode (intake scorer)
```ts
const cpc = pickBand(niche, geo);              // 'low' | 'mid' | 'high' | 'very_high'
const cpcValue = {low:0.8, mid:1.5, high:3.5, very_high:6}[cpc];
const expectedCVR = estimateCVR(niche, assets); // 0.02..0.05
const expectedCPA = cpcValue / expectedCVR;     // €

const tripwire = 29;
const coreContribution = 249 - 110;             // example; use table per vertical
const maxAcquire = Math.min(tripwire, coreContribution);

if (expectedCPA <= maxAcquire && partnersInGeo >= 2) accept(); else reject();
```

---

## 2) 48‑Hour Test Budget → **Scaled by CPC Band**
**Replace** the flat “~€60 in 48h” with a cap **by clicks or spend** (whichever first):

| CPC band     | 48h click cap | 48h spend cap |
|--------------|----------------|---------------|
| low (€≤1)    | 50 clicks      | €60           |
| mid (€≈1.5)  | 40 clicks      | €80           |
| high (€≈3.5) | 30 clicks      | €120          |
| very_high (€≥6) | 20 clicks   | €160          |

**Kill/pause rules stay** (CTR, CPC, CPA), but apply **per band**. Outreach caps unchanged (pause if reply-rate <1.5% after 50 sends).

### Constants (TypeScript)
```ts
export const TEST_CAPS = {
  low:      { maxClicks: 50, maxSpendEUR: 60 },
  mid:      { maxClicks: 40, maxSpendEUR: 80 },
  high:     { maxClicks: 30, maxSpendEUR: 120 },
  very_high:{ maxClicks: 20, maxSpendEUR: 160 },
};

export const KILL_SWITCH = {
  ctrMin: 0.007,                 // 0.7%
  cpcMaxByBand: { low: 1.2, mid: 2.2, high: 4.0, very_high: 7.5 },
  pauseCpaGT: 35,                // evaluate after ≥ €70 spend
};
```

---

## 3) **Make RRE the Default** in High‑CPC Cohorts
For `cpc_band in ('high','very_high')`:
- Enable **RRE lane** automatically at T+0 (not as fallback).
- Ads run as **retargeting + credibility**; outreach/partners do the heavy lift.
- Require a **human-assist micro‑slot** (10–15m) for any positive reply before sending deposit links.

### Toggle logic (worker)
```ts
if (['high','very_high'].includes(project.cpc_band)) {
  lanes.enable('rre');        // outreach-first
  ads.setBudgets({ search: 'low', meta: 'low' });
  concierge.requireHumanAssist = true;
}
```

---

## 4) Outcomes & Targets (internal) → **Band‑aware**
Public **SLAs remain the same** (48h first sale, $1k in 60 days). Internally track **real sale vs reserve** separately.

**Internal targets (genuine sales)**:
- `low/mid CPC`: p50 ≤ 36–48h, p80 ≤ 3–5 days
- `high/very_high CPC`: p50 ≤ 3–5 days, p80 ≤ 5–7 days

Dashboard: show **both** curves and keep reserve-triggered wins out of public evidence.

---

## 5) Tighten the 48‑Hour Runbook (Intent‑gated)
- **Hour 18**: pivot angles/expand audience **only** if zero *positive* signals; otherwise optimize winners.
- **Hour 24**: **send deposit/limited‑slots only on positive‑intent replies** (no cold push). If RRE mode, book a 10‑minute triage call or send tailored deposit link.
- **Hour 36**: activate marketplace/partner tap; do **not** arm buyer‑of‑last‑resort unless outreach shows buying intent or caps reached.
- **Hour 48**: if still no sale, honor payout and continue ops; log cleanly to `reserve` and exclude from public evidence.

**Copy change**: remove hard-sell language from cold sequences; keep it in **post‑intent** steps only.

---

## 6) Reserve Sizing → **Start Higher, Ratchet Down**
- Early cohorts: **8–12% GMV** reserve until fail-rate is measured.
- After 200 cohorts with verified stats: reduce to **5% GMV**.
- Weekly liability = `fail_rate * payout * active_cohorts`.
- Evidence API must **exclude** `order.source = 'reserve'`.

### SQL: evidence view (example)
```sql
create or replace view evidence_public as
select project_id,
       percentile_disc(0.5) within group (order by ttp_hours) as median_ttp_hours,
       avg(case when created_at >= now() - interval '30 days' then is_first_sale::int end) as first_sale_rate_30d,
       count(*) filter (where created_at >= now() - interval '7 days') as orders_last_7d
from (
  select o.project_id,
         extract(epoch from (o.created_at - p.t0))/3600 as ttp_hours,
         (o.rank_in_project = 1) as is_first_sale,
         o.created_at
  from orders o
  join project p on p.id = o.project_id
  where coalesce(o.source,'') <> 'reserve'        -- exclude internal purchases
) x
group by project_id;
```

---

## 7) Policy‑Safe Comms → **Enforce in Code**
- Keep guarantees in T&Cs and onboarding; **never** use “$X in Y hours” in **ads**.
- Evidence widget can show anonymized receipts, median TTP, and first‑sale rate **excluding reserve**.
- Add unit tests that reject creatives containing banned patterns.

### Creatives linter (sketch)
```ts
const banned = [/\$\d+\s+in\s+\d+\s*(hours|days)/i, /get-rich-quick/i];
export function assertPolicySafe(text: string) {
  if (banned.some(rx => rx.test(text))) throw new Error('Policy-unsafe creative');
}
```

---

## Worker & Config Touchpoints

- `intake` scorer → implement dynamic gate & fields (Section 1)
- `traffic-manager` → CPC‑band caps & auto‑RRE (Sections 2 & 3)
- `budget-watchdog` → per‑band CPC max; unchanged CTR/CPA thresholds
- `reply-parser`/`concierge` → intent‑gated deposits (Section 5)
- `guarantee-engine` → honor payout but delay reserve trigger until Hour‑47+ **only if caps reached or positive intent absent**
- `evidence-updater` → consume `evidence_public` view (Section 6)

---

## Acceptance Tests (update/add)

1. **Dynamic gate** rejects a `high` CPC cohort with `Expected_CPA > Tripwire_Price`.
2. **Per‑band caps** stop spend at click/spend thresholds; watchdog pauses on CPC breaches.
3. **Auto‑RRE** turns on for `high` CPC; ads budgets lowered; human‑assist required.
4. **Intent‑gated concierge**: deposit link sent only after `reply.intent='positive'`.
5. **Evidence filter** excludes `order.source='reserve'`; public API returns correct medians.
6. **Policy linter** throws on banned ad copy patterns.

---

## Notes for `implementation-guide-2.md`

- Reword “emergency protocols”: keep **triple spend / 70% flash sale / 500-emails blast** as **manual runbooks only**. Do **not** auto-trigger. Add a human approval check for any extreme escalation.
- Keep the Hour-18/24/36 markers but apply **intent gates** and **cap checks** before each step.

---

**Rollout**: ship as a single PR `feat/hwp-v1.1-dynamic-gates` with migrations, constants, and tests above. Keep old thresholds behind feature flags for A/B.