// src/app/api/copilot/oauth/token/route.ts
// The token endpoint: a code for tokens, and a refresh token for new ones.
// Form-encoded, as RFC 6749 says and Claude sends; JSON taken too. Errors are
// RFC 6749's own codes — Claude acts on invalid_grant (connect again) and
// would read anything else as a fault to retry.
import { exchangeCode, exchangeRefresh, type Exchange } from '@/lib/copilot/connector';
import { OPEN_CORS, readForm } from '@/lib/copilot/http';
import { basicAuth } from '@/lib/copilot/oauth';

export const runtime = 'nodejs';

const headers = { ...OPEN_CORS, 'cache-control': 'no-store', pragma: 'no-cache' };

export async function POST(req: Request) {
  const form = await readForm(req);
  const basic = basicAuth(req.headers.get('authorization'));
  let r: Exchange;
  if (form.grant_type === 'authorization_code') r = await exchangeCode(form, basic);
  else if (form.grant_type === 'refresh_token') r = await exchangeRefresh(form, basic);
  else return Response.json({ error: 'unsupported_grant_type', error_description: 'authorization_code or refresh_token.' }, { status: 400, headers });
  if (r.ok) return Response.json(r.body, { headers });
  if (r.err.status >= 500) console.error('[copilot] oauth token failed', r.err.description);
  return Response.json({ error: r.err.error, error_description: r.err.description }, {
    status: r.err.status,
    // RFC 6749 5.2: a client that tried Basic is told how to try again.
    headers: r.err.status === 401 && basic ? { ...headers, 'www-authenticate': 'Basic realm="copilot"' } : headers,
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OPEN_CORS });
}
