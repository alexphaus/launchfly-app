// src/app/api/copilot/connections/route.ts
// You → Claude: the address to paste into Claude, what is connected and when it
// last read, a disconnect, and a code for signing Claude in from a computer the
// app is not open on. Behind the session, like every route the app itself calls.
import { appBaseUrl } from '@/lib/copilot/auth';
import { createPairCode, listConnections, revokeGrant } from '@/lib/copilot/connector';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';
import { resourceUrl } from '@/lib/copilot/oauth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  // The address is the server's own idea of itself — the same one the
  // discovery documents name — so what is pasted into Claude is what they say.
  const url = resourceUrl(appBaseUrl(req));
  try {
    return json({ ok: true, url, connections: await listConnections(auth.pid) });
  } catch (e) {
    // The address still works; only the list could not be read, and the sheet says so.
    console.error('[copilot] connections read failed', e);
    return json({ ok: true, url, connections: [], unreadable: e instanceof Error ? e.message : String(e) });
  }
}

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  try {
    switch (b.action) {
      case 'revoke': {
        const grant = typeof b.grant === 'string' ? b.grant : '';
        // Only one of this account's own, live connections: ending a grant id
        // nobody here holds would write a row that ends nothing and say "done".
        const live = await listConnections(auth.pid);
        if (!live.some((c) => c.grant === grant)) return fail('That connection is not one of yours, or it has already ended.', 404);
        await revokeGrant(auth.pid, grant, 'you');
        return json({ ok: true, connections: await listConnections(auth.pid) });
      }
      case 'code':
        return json({ ok: true, ...(await createPairCode(auth.pid)) });
      default:
        return fail('Unknown action');
    }
  } catch (e) {
    console.error('[copilot] connections action failed', e);
    return fail(e instanceof Error ? e.message : 'Could not do that', 500);
  }
}
