import { setGrowthItemStatus } from '@/lib/copilot/store';
import type { GrowthItem } from '@/lib/copilot/types';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { id } = await ctx.params;
  const { status } = await readJson(req);
  if (!(['active', 'done', 'dismissed'] as GrowthItem['status'][]).includes(status as GrowthItem['status'])) return fail('Unknown status');
  const row = await setGrowthItemStatus(auth.pid, id, status as GrowthItem['status']);
  if (!row) return fail('Not found', 404);
  return json({ ok: true });
}
