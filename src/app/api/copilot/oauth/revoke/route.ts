// src/app/api/copilot/oauth/revoke/route.ts
// RFC 7009: a client ending its own connection, as when the person removes the
// connector in Claude. The connection then leaves the list under You → Claude,
// as one ended from the app does.
import { revokeToken } from '@/lib/copilot/connector';
import { OPEN_CORS, readForm } from '@/lib/copilot/http';
import { basicAuth } from '@/lib/copilot/oauth';

export const runtime = 'nodejs';

const headers = { ...OPEN_CORS, 'cache-control': 'no-store' };

export async function POST(req: Request) {
  const r = await revokeToken(await readForm(req), basicAuth(req.headers.get('authorization')));
  if (r.ok) return new Response(null, { status: 200, headers });
  if (r.err.status >= 500) console.error('[copilot] oauth revoke failed', r.err.description);
  return Response.json({ error: r.err.error, error_description: r.err.description }, { status: r.err.status, headers });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OPEN_CORS });
}
