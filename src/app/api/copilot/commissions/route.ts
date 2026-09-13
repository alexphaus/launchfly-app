// src/app/api/copilot/commissions/route.ts
// Write a mandate, and read the thread.
//
// A commission is always created as a draft and never as an active one. The
// approve button is the whole point of this layer — it is what turns the app
// from something that suggests into something that was authorised — and a
// commission that arrives already approved has quietly deleted it.

import { createCommission, loadCommissionEvents, loadCommissions, loadHome } from '@/lib/copilot/store';
import { MAX_BUDGET_MINUTES, MIN_BUDGET_MINUTES, OBJECTIVE_MAX, WHY_MAX, isAuthority, normalizePlan } from '@/lib/copilot/commission';
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
    const commission = await createCommission(auth.pid, {
      objective,
      why: typeof b.why === 'string' ? b.why.trim().slice(0, WHY_MAX) : null,
      goal_id: typeof b.goal_id === 'string' ? b.goal_id : null,
      // Anything unrecognised lands on 'read', which is the level that cannot
      // touch the world. A typo must never widen a mandate.
      authority: isAuthority(b.authority) ? b.authority : 'read',
      budget_minutes: Number.isFinite(budget) ? Math.min(MAX_BUDGET_MINUTES, Math.max(MIN_BUDGET_MINUTES, budget)) : undefined,
      plan: normalizePlan(b.plan),
    });
    return json({ ok: true, commission, home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not write that commission');
  }
}
