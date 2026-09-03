import { upsertGoal } from '@/lib/copilot/store';
import type { Goal, GoalMetric } from '@/lib/copilot/types';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  const patch: Partial<Goal> & { id?: string } = {
    id: typeof b.id === 'string' ? b.id : undefined,
    title: typeof b.title === 'string' ? b.title.trim().slice(0, 120) || undefined : undefined,
    metric: (['currency', 'number', 'percent', 'none'] as GoalMetric[]).includes(b.metric as GoalMetric) ? (b.metric as GoalMetric) : undefined,
    unit: typeof b.unit === 'string' ? b.unit.trim().slice(0, 12) : undefined,
    target_value: num(b.target_value),
    current_value: num(b.current_value),
    horizon_days: num(b.horizon_days),
    status: (['active', 'done', 'paused'] as Goal['status'][]).includes(b.status as Goal['status']) ? (b.status as Goal['status']) : undefined,
    note: typeof b.note === 'string' ? b.note.trim().slice(0, 400) : undefined,
  };
  try {
    return json({ ok: true, goal: await upsertGoal(auth.pid, patch) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not save goal');
  }
}
