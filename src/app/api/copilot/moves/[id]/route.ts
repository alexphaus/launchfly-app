import { handOverMove, loadHome, setMoveStatus } from '@/lib/copilot/store';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

/**
 * Answer one Move: it is done, it is not for you, or — when it is a proposal —
 * go and do it.
 *
 * `handover` is the third verb and the only one that does not end with the user
 * having done something. See handOverMove for why one tap is a real approval
 * rather than a shortcut past one.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { id } = await ctx.params;
  const b: Record<string, unknown> = await readJson(req).catch(() => ({}));

  if (b.status === 'handover' || b.action === 'handover') {
    try {
      const { commission } = await handOverMove(auth.pid, id);
      return json({ ok: true, commission, home: await loadHome(auth.pid) });
    } catch (e) {
      // Surfaced, because every reason this fails is one the user can act on:
      // three mandates already running, a plan that did not survive, a Move
      // somebody answered on another device.
      return fail(e instanceof Error ? e.message : 'Could not hand that over');
    }
  }

  const status = b.status;
  if (status !== 'done' && status !== 'dismissed') return fail('Unknown status');
  await setMoveStatus(auth.pid, id, status);
  return json({ ok: true, home: await loadHome(auth.pid) });
}
