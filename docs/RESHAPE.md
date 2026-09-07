# Reshape — v2.7.2

What this branch is for, in one line:

> **Stop being a copilot with a database. Become the book of record other
> agents read and write.**

`DIRECTION.md` says why (rows, not recollection, and the harness threat).
`COPILOT.md` says how the thing works today. This says what is being changed
and in what order, so the sequencing argument does not get lost in the diff.

**`v2.7.1` remains the deploy branch.** Coolify watches it. Nothing here reaches
production until that is repointed, which is deliberate: this branch changes the
shape of the data.

---

## The correction that produced this

`DIRECTION.md` argues "rows, not recollection" — that what survives a
general-purpose agent harness is what needs stored rows rather than memory.

That is only half right, and the half it gets wrong matters. **A self-hosted
agent can keep rows too.** Give a competent solo builder a weekend and Postgres
and they have a supply pool, an outcome ledger and a decision record. Every
single-user asset in this app is replicable.

The line that actually holds is **rows across users**. A self-hosted agent sees
one person's world and can never see anyone else's. Four things follow from
that, and nothing else here is defensible:

| asset | what it is | why a self-hoster cannot have it |
| --- | --- | --- |
| **Territory** | These businesses are yours; nobody else on the platform messages them | Requires knowing what other users claimed |
| **Opener benchmarks** | "Openers naming a missing booking link get 3× replies from dentists in Cebu" | Needs outcomes across hundreds of senders |
| **Contact quality** | This number bounced for three users, so it is dead for everyone | Needs other users' failures |
| **Regional demand** | What businesses in a region want, not just in your own 140 | Needs pooled supply |

Territory is the strongest and was the most overlooked. It is a reason to pay
rather than a feature, and it is the one thing that gets *worse for the user if
they leave* — which is the working definition of defensible.

---

## The constraint that sets the order

**Every asset above is worth exactly zero at one user**, and the runway is 3.4
months. Territory with one user is a table with no rows. Benchmarks over zero
sends are undefined.

So the priority order is not the build order:

| # | step | when | code? |
| --- | --- | --- | --- |
| 1 | **Send ten messages** | now | no |
| 2 | **Shrink to the queue** | now | yes — this branch |
| 3 | **Split the pool from the claim** | now | yes — this branch |
| 4 | **MCP server** | once anything is worth reading | later |
| 5 | **Territory, benchmarks, contact quality** | ~20 users | later |

Step 1 is not a feature and cannot be done by an agent. Until one message goes
out and one reply comes back, everything below it is speculation — including
this document.

Step 3 is the only place architecture budget is spent before revenue, and only
because it is the one change that gets more expensive with every row and every
user. The data has to start accumulating in the right shape **before there is
data**. That is the whole argument for doing it now, at n=1, when it is worth
nothing yet.

---

## Step 3 — the pool and the claim

Today the unique index is `(profile_id, source, external_id)`. The pool is
siloed per user by construction: two people targeting Cebu dentists scrape the
same businesses, pay Apify twice, and can message the same shop on the same
morning.

The split:

- **`copilot_businesses`** — one row per real business, keyed globally on
  `(source, external_id)`. Scraped once, enriched once, paid for once.
- **`copilot_opportunities`** — unchanged in shape, gains `business_id`. It
  stops being *the business* and starts being *this profile's claim on it*.

Territory then becomes a rule over `business_id`, not a new subsystem. Regional
demand becomes a query over `copilot_businesses` instead of one profile's rows.
Contact quality becomes columns on a row every user shares.

**This lands additively and reads nothing.** The migration only adds; supply
writes through to both; every existing read path is untouched and keeps working
if the migration has not been applied yet. That is required here, not stylistic
— migrations are applied by hand in this project and code ships before SQL does
(see `CLAUDE.md` → Deploying). A write-through shadow is also reversible: if the
argument above is wrong, the table is dropped and nothing else changes.

What is deliberately **not** in this step: reading from the shared pool to skip
a scrape. The saving is real but it is zero at one user, and it changes what
`runSupply` returns. It arrives with step 5.

---

## Step 2 — shrink to the queue

Two surfaces survive:

- **The send queue** — human, mobile, one tap. Approval is the one action that
  must be a person's and must be frictionless, and a chat thread is bad at a
  thirty-item queue. This is the app a user touches.
- **An MCP server** (step 4) — agent-facing, over routes that mostly exist.

The advisory layer goes: the brief text, the insight, the lesson, the nudges,
the growth edge. A self-hosted harness delivers a daily brief over WhatsApp with
better memory and a better model, so a nicer version of that is competing on the
only ground the competition gives away for free.

**The decision is the exception, and the distinction is worth being precise
about.** The decision *record* — one call, one named metric, graded three days
later against a stored snapshot — is a row asset and one of the four survivors.
The decision *text* is advice. So the recording stays exactly as it is and the
screen stops leading with the prose.

Pipeline survives as a sheet. Signals survives, and is the one thing worth
showing publicly: "what businesses in Cebu are asking for this month" is both a
demonstration of the moat and a lead magnet.

---

## What this branch does not do

- No new supply adapters. Supply was never the problem.
- No calendar or Gmail OAuth. Weeks of consent plumbing for a sensor nobody has
  pulled once.
- No named cash obligations. `DIRECTION.md` calls this the cheapest sensor fix;
  under this framing it is months of hand-entered collection to widen a lever
  that has never been used.
- No territory enforcement. It needs users, and enforcing exclusivity over an
  empty table is a constraint with nothing to constrain.
- Nothing that makes the app smarter rather than more used.
