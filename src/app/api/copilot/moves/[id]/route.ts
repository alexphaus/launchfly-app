import { loadHome, setMoveStatus } from '@/lib/copilot/store';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

/** Answer one Move: it is done, or it is not for you. Both are recorded. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { id } = await ctx.params;
  const { status } = await readJson(req);
  if (status !== 'done' && status !== 'dismissed') return fail('Unknown status');
  await setMoveStatus(auth.pid, id, status);
  return json({ ok: true, home: await loadHome(auth.pid) });
}
