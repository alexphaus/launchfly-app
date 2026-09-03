import { setActionStatus } from '@/lib/copilot/store';
import type { ActionStatus } from '@/lib/copilot/types';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { id } = await ctx.params;
  const { status } = await readJson(req);
  if (!(['open', 'done', 'dismissed'] as ActionStatus[]).includes(status as ActionStatus)) return fail('Unknown status');
  const row = await setActionStatus(auth.pid, id, status as ActionStatus);
  if (!row) return fail('Not found', 404);
  return json({ ok: true });
}
