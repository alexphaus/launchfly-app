// src/lib/copilot/deliver.ts
// The one door a worker's result comes in through.
//
// Four kinds of hands report now — the n8n workflow, the app's own Writer, the
// Claude agent, a person on a webhook — and every report goes through here
// before a line of it is recorded, so the contract is held in one place for all
// of them rather than in four slightly different ones:
//
//   1. the ring guard: the plan's steps the mandate cannot do by itself are
//      marked as the person's, and a claim to have done one is refiled as a
//      question for them (contract.ts guardResult)
//   2. the check: a done is held to what the objective asked for — the count,
//      links that open, the dates — and one that fails is not done
//      (contract.ts verdictOf, linkcheck.ts)
//   3. the record: the events, and the status nextStatus computes from them and
//      from the check (store.ts recordCommissionWork)
//
// A check is recorded before the status moves. If it cannot be, the result is
// still recorded and the caller is told (`note`), because losing the worker's
// work over the bookkeeping would be the worse of the two failures.

import { MAX_SENDBACKS, expectationsOf, guardResult, jobKindOf, linksDelivered, verdictOf, worthChecking, type Verdict } from './contract';
import type { Authority, Commission, CommissionEvent, CommissionResult, CommissionStatus } from './commission';
import { checkLinks } from './linkcheck';
import { loadCommissionEvents, recordCommissionWork } from './store';
import { WORK_CHECK, sendBackRound, type WorkLog } from './worklog';
import { loadWork, recordWork } from './workstore';

export interface Accepted {
  status: CommissionStatus;
  events: CommissionEvent[];
  verdict: Verdict | null;
  /** The last send-back: the job stopped for the person. */
  final: boolean;
  /** Claims to have acted outside the ring, refiled as questions. */
  breaches: number;
  /** Events that passed the floor. */
  accepted: number;
  /** What did not save, said rather than swallowed. */
  note: string | null;
}

/**
 * Take a worker's result for a job: guard it, check it, record it.
 *
 * `log` and `history` are optional reads the caller already has; without them
 * this reads its own. `mayClaim` is what can have legitimately happened —
 * reach, only when each message went out from the person's own account
 * through an OK they gave in the app.
 */
export async function acceptWork(
  profileId: string,
  c: Commission,
  raw: CommissionResult,
  o: { log?: WorkLog; history?: CommissionEvent[]; askEach?: boolean; mayClaim?: readonly Authority[]; deadline?: number } = {},
): Promise<Accepted> {
  const guarded = guardResult(raw, c.authority, { askEach: o.askEach, mayClaim: o.mayClaim });
  const job = jobKindOf(c.objective).kind;
  const expect = expectationsOf(c.objective, c.created_at, job);

  let verdict: Verdict | null = null;
  let final = false;
  let note: string | null = null;
  if (worthChecking(expect, guarded.events)) {
    const log = o.log ?? (await loadWork(profileId, [c.id])).log;
    const history = o.history ?? await loadCommissionEvents(profileId, [c.id]);
    // The delivery is what came after the last send-back: a re-delivery stands
    // on its own, or a link the worker already replaced would fail it forever.
    const lastFail = (log.checks.get(c.id) ?? []).find((k) => !k.passed)?.at ?? '';
    // Oldest first, whatever order the rows were read in: "the last done" has to
    // be the newest one, and this report's events are newer than any stored.
    const window = [
      ...history.filter((e) => e.at > lastFail).sort((a, b) => a.at.localeCompare(b.at)).map((e) => ({ kind: e.kind, summary: e.summary, artifact: e.artifact })),
      ...guarded.events.map((e) => ({ kind: e.kind, summary: e.summary, artifact: e.artifact })),
    ];
    const links = expect.links ? await checkLinks(linksDelivered(window), { deadline: o.deadline }) : [];
    verdict = verdictOf(expect, window, links, c.created_at);
    if (!verdict.passed) final = sendBackRound(log, c.id) >= MAX_SENDBACKS;
    try {
      await recordWork(profileId, WORK_CHECK, {
        commission_id: c.id, passed: verdict.passed, final, checks: verdict.checks,
        sendBack: verdict.sendBack, links: links.map((l) => ({ url: l.url.slice(0, 300), state: l.state, code: l.code })),
      });
      // Into the caller's log too: a second report read in the same pass counts
      // this send-back, and checks its delivery from after it.
      if (o.log) o.log.checks.set(c.id, [{ at: new Date().toISOString(), passed: verdict.passed, final, checks: verdict.checks, sendBack: verdict.sendBack }, ...(o.log.checks.get(c.id) ?? [])]);
    } catch (e) {
      note = `The app's check of this delivery did not save: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const rec = await recordCommissionWork(profileId, c, guarded, verdict ? { passed: verdict.passed, final } : null);
  return { status: rec.status, events: rec.events, verdict, final, breaches: guarded.breaches, accepted: guarded.events.length, note };
}
