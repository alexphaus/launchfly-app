// src/app/api/copilot/oauth/register/route.ts
// Dynamic Client Registration (RFC 7591): how Claude makes itself known before
// the person signs in. Nothing is stored — the client id is the registration,
// signed (oauth.ts registerClient) — and only Claude's callback or a loopback
// address may be registered, so nobody else can ask for a code.
import { OPEN_CORS } from '@/lib/copilot/http';
import { registerClient } from '@/lib/copilot/oauth';
import { extraRedirects } from '@/lib/copilot/connector';
import { oauthKey } from '@/lib/copilot/session';

export const runtime = 'nodejs';

const headers = { ...OPEN_CORS, 'cache-control': 'no-store' };

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_client_metadata', error_description: 'The registration must be a JSON object.' }, { status: 400, headers });
  }
  const r = registerClient(body, { master: oauthKey(), nowS: Math.floor(Date.now() / 1000), extra: extraRedirects() });
  if (!r.ok) return Response.json({ error: r.error, error_description: r.description }, { status: 400, headers });
  return Response.json(r.body, { status: 201, headers });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OPEN_CORS });
}
