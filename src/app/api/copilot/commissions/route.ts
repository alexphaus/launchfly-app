// src/app/api/copilot/commissions/route.ts
// Write a mandate, and read the thread.
//
// A commission is always created as a draft and never as an active one. The
// approve button is the whole point of this layer — it is what turns the app
// from something that suggests into something that was authorised — and a
// commission that arrives already approved has quietly deleted it.

import { createCommission, insertLabEvent, loadCommissionEvents, loadCommissions, loadHome } from '@/lib/copilot/store';
import { MAX_BUDGET_MINUTES, MIN_BUDGET_MINUTES, OBJECTIVE_MAX, WHY_MAX, isAuthority, normalizePlan, type Authority } from '@/lib/copilot/commission';
import { jobKindOf } from '@/lib/copilot/contract';
import { registry } from '@/lib/copilot/hands';
import { canTake } from '@/lib/copilot/workers';
import { WORK_ASSIGNED } from '@/lib/copilot/worklog';
import { recordWork } from '@/lib/copilot/workstore';
import { LAB_LINK } from '@/lib/copilot/lab';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const commissions = await loadCommissions(auth.pid);
  return json({ ok: true, commissions, events: await loadCommissionEvents(auth.pid, commissions.map((c) => c.id)) });
}

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b: Record<string, unknown> = await readJson(req).catch(() => ({}));

  const objective = typeof b.objective === 'string' ? b.objective.trim().slice(0, OBJECTIVE_MAX) : '';
  if (!objective) return fail('What should it get done?');

  const budget = Number(b.budget_minutes);
  try {
    // For the running bet: it keeps a slot of its own (commission.ts
    // roomForProject), so the bet has to be the one running — checked here, on
    // the record, never taken from the request — and the project is tied to it
    // in the same request, so a bet's own slot cannot be spent by work the bet
    // does not know about.
    let bet: { id: string; linked: string[] } | null = null;
    let today: string | undefined;
    if (typeof b.bet === 'string' && b.bet) {
      const home = await loadHome(auth.pid);
      if (home?.lab?.unreadable) return fail(`Your bets could not be read just now, so this cannot be handed over for one: ${home.lab.unreadable}`);
      const running = home?.lab?.bets.find((x) => x.state === 'running' && x.bet.id === b.bet);
      if (!running) return fail('That bet is not running.');
      bet = { id: running.bet.id, linked: home!.lab!.links?.[running.bet.id] ?? [] };
      today = home!.recent.today;
    }
    // Anything unrecognised lands on 'read', which is the level that cannot
    // touch the world. A typo must never widen a mandate.
    const authority: Authority = isAuthority(b.authority) ? b.authority : 'read';
    // The worker the person chose, if they did — checked before anything is
    // written, so a job is never created for hands that may not take it.
    const workerKey = typeof b.worker === 'string' && b.worker ? b.worker : null;
    if (workerKey) {
      const w = registry().workers.find((x) => x.key === workerKey);
      if (!w) return fail('No worker by that name is connected.');
      if (!canTake(w, jobKindOf(objective).kind, authority)) return fail(`${w.name} does not take this kind of job.`);
    }
    const commission = await createCommission(auth.pid, {
      objective,
      why: typeof b.why === 'string' ? b.why.trim().slice(0, WHY_MAX) : null,
      goal_id: typeof b.goal_id === 'string' ? b.goal_id : null,
      authority,
      budget_minutes: Number.isFinite(budget) ? Math.min(MAX_BUDGET_MINUTES, Math.max(MIN_BUDGET_MINUTES, budget)) : undefined,
      // Held to the ring by createCommission, like every other way a job is written.
      plan: normalizePlan(b.plan),
      today,
      forBet: bet?.linked,
    });
    let unassigned: string | null = null;
    if (commission && workerKey) {
      try { await recordWork(auth.pid, WORK_ASSIGNED, { commission_id: commission.id, worker: workerKey }); }
      catch (e) { unassigned = e instanceof Error ? e.message : 'it did not save'; }
    }
    // Said, not swallowed: the project is written either way, and a tie that did
    // not save leaves it under Projects with the reason (invariant 13).
    let tied = false;
    let untied: string | null = null;
    if (bet && commission) {
      try { await insertLabEvent(auth.pid, LAB_LINK, { bet: bet.id, commission: commission.id }); tied = true; }
      catch (e) { untied = e instanceof Error ? e.message : 'it did not save'; }
    }
    return json({ ok: true, commission, tied, untied, unassigned, home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not write that commission');
  }
}
