// src/app/api/copilot/commissions/[id]/route.ts
// Grant authority, call it off, or mark the thread read.

import { approveCommission, closeCommission, loadHome, markCommissionSeen } from '@/lib/copilot/store';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { id } = await ctx.params;
  const b: Record<string, unknown> = await readJson(req).catch(() => ({}));

  try {
    switch (b.action) {
      case 'approve': {
        const c = await approveCommission(auth.pid, id);
        // Null means it was not a draft. Re-approving would reset approved_at
        // and lose when the mandate was actually granted, which is the one
        // timestamp that matters if anybody asks what the app was allowed to do.
        if (!c) return fail('That commission is already running.');
        return json({ ok: true, commission: c, home: await loadHome(auth.pid) });
      }
      case 'stop':
        await closeCommission(auth.pid, id, 'stopped', typeof b.outcome === 'string' ? b.outcome : undefined);
        return json({ ok: true, home: await loadHome(auth.pid) });
      case 'done':
        await closeCommission(auth.pid, id, 'done', typeof b.outcome === 'string' ? b.outcome : undefined);
        return json({ ok: true, home: await loadHome(auth.pid) });
      case 'seen':
        // No home reload: this fires on opening the sheet, and rewriting the
        // whole screen underneath somebody who just tapped into it is how the
        // card they were reading moves out from under them.
        await markCommissionSeen(auth.pid, id);
        return json({ ok: true });
      default:
        return fail('Unknown action');
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not update that commission');
  }
}
