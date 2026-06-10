# Launchfly Week‑1 Pilot Runbook
*(v5 backbone + HWP v1.1 guardrails + HWP v2 ops)*

## 0) Objectives (pilot cohort)
- **First genuine sale ≤ 48h (p50)** — excludes reserve orders from public proof.
- **Unit economics safety** — dynamic acceptance + CPC‑band spend caps + strict kill‑switches.
- Track KPIs: **TTP p50/p80**, **7‑day first‑sale rate**, **reserve share**.

---

## 1) Team & Ownership (DRIs)
- **Engineering** — Orchestrator, endpoints, workers, outbox/idempotency. *KPI:* 0 unprocessed events; green E2E.
- **Growth Ops** — Search + Meta + outreach execution. *KPI:* within caps; CTR/CPC/CPA thresholds respected.
- **Sales Ops** — Concierge Close (human‑assist). *KPI:* time‑to‑reply < **15 min**; deposit link usage.
- **Data** — Evidence API + dashboards (exclude reserves). *KPI:* correct medians/filters.

> Assign a named DRI for each line before launch.

---

## 2) Ship This First (Day 1)
**Endpoints**
- `POST /api/intake`
- `POST /api/money-engine/launch`
- `POST /api/leads/import`
- `POST /api/stripe/webhook`
- `GET  /api/evidence/public` (excludes reserve orders)

**Workers (idempotent)**
- outreach‑sequencer, reply‑parser, checkout‑watch, evidence‑updater, guarantee‑engine timers
- budget‑watchdog (caps), traffic‑manager v0

**Evidence view**
- Show: median **TTP**, 30‑day **first‑sale rate**, **7‑day orders** ticker
- DB filter: exclude `orders.source = 'reserve'`

---

## 3) Acceptance Gate (block bad fits before spend)
Accept a user **iff**:
- `Expected_CPA ≤ Max_Acquire_Cost`, **and**
- there are **≥2 vetted partners** available in the user’s locale.

**Seed priors**
- CPC bands: **low = €0.8**, **mid = €1.5**, **high = €3.5**, **very_high = €6+**
- Expected CVR: **2–5%** (by lane + niche)
- Max_Acquire_Cost = `min(tripwire price, core contribution margin)`

**Persist on profile**
- `cpc_band`, `expected_cvr`, `expected_cpa_cents`, and a human‑readable `rejection_reason` when blocked.

---

## 4) 48‑Hour Spend Caps (by CPC band)
Stop by **clicks or spend (whichever first):**
- **low:** 50 clicks / **€60**
- **mid:** 40 / **€80**
- **high:** 30 / **€120**
- **very_high:** 20 / **€160**

**Kill‑switch thresholds (global)**
- Pause **ad group** if **CTR < 0.7%** **or** **CPC > €1.20 after 30 clicks**
- Pause **lane** if **CPA > €35 after €70 spend**
- **Outreach:** pause if **reply‑rate < 1.5%** after **50 sends**
- **Meta:** kill if **LP‑view‑rate < 0.35** or **CPR > €12**

---

## 5) The 48‑Hour Runbook (automation + human‑assist)
**T+0–1h**
- Publish conversion page (stub OK) + **Stripe Checkout** link
- Load ad/outreach kits; start orchestrator; verify webhooks

**T+1–12h**
- **Search:** 2 exact‑intent ad groups (tight geo) with caps
- **Meta:** 1 lead‑ad set with caps
- **Outreach:** 100 contacts, 3‑step sequence; respect reply‑rate gate

**Hour 18 (intent‑gated)**
- Only if **no positive signals**: swap angle, widen audience (+2 segments), **enable partner/marketplace tap**

**Hour 24**
- If replies but no checkout → **Concierge Close** sends deposit/limited‑slots **only on positive intent**

**Hour 36**
- Boost marketplace listing; keep buyer‑of‑last‑resort **armed but gated** (never used for public proof)

**Hour 48**
- If no genuine sale → honor **$100 payout**; continue ops toward 60‑day target; log as `reserve` and **exclude from evidence**

---

## 6) Demand Engine (run all three lanes in parallel)
- **Lane A — Search intent (speed):** exact‑match + tight geo; budget capped; bandit shifts later
- **Lane B — FB/IG lead ads (scale):** 1 angle; follow kill rules; warm leads → concierge
- **Lane C — Warm outreach (profit):** 100 seeds day‑1; URL‑audit personalization; reply‑parser → human closer

---

## 7) Offer Ladder (attach revenue fast, then stabilize)
- **Tripwire €19–39** → **Core €199–399** → **Retainer €249–399/mo**
- Sequences: **D+0** thank‑you → **D+2** case study → **D+5** proof
- Retainer attach **D+10–21** (goal: stability + LTV)

---

## 8) Compliance & Proof (policy‑safe by default)
- **Creatives linter** blocks time‑bound income claims; unit tests required
- **Evidence endpoint** publishes TTP median, first‑sale rate, receipts ticker; **reserves excluded** (DB‑level)

---

## 9) Daily Ops Ritual (pilot)
- **09:00** — Review stopped channels & reserve share; re‑enable only within caps
- **12:00 / 18:00** — Verify **T+18/24/36** timers; concierge SLA **<15 min**
- **EOD** — Update partner capacity; reject tomorrow’s bad‑fit intakes via dynamic gate

---

### Notes
- Start with **Tier‑1 niches** (low‑to‑mid CPC, active demand) for the pilot cohort.
- Keep proof centralized on your site (policy‑safe), not in paid creatives.
- Price early pilot as **small setup fee + rev‑share** to align incentives.
