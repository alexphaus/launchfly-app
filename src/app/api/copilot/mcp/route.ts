// src/app/api/copilot/mcp/route.ts
// The MCP server Claude connects to: Streamable HTTP, answered as plain JSON
// (no event stream — every tool answers in one response), stateless (no
// session id), and read-only unless the person let it propose — which writes
// to an inbox in the app and never to the record (lib/copilot/mcp.ts says why).
//
// Every request needs a token, initialize included: there is nothing here
// worth reading without the person's account. Without one the answer is a 401
// carrying the resource_metadata pointer, which is the only thing that starts
// Claude's sign-in — a 200 with an error in it would show "please sign in" as
// text and never offer the button. A token for a connection ended in the app is
// refused on its next call, whatever its expiry says.
//
// This route never reads the session cookie: the token is the only credential,
// which is why any origin may call it (http.ts OPEN_CORS).
import { appBaseUrl } from '@/lib/copilot/auth';
import { authorizeCall } from '@/lib/copilot/connector';
import { OPEN_CORS } from '@/lib/copilot/http';
import { handleBody, headerVersionOk, parseError } from '@/lib/copilot/mcp';
import { canPropose, resourceUrl, wwwAuthenticate } from '@/lib/copilot/oauth';
import { runTool } from './read';

export const runtime = 'nodejs';
export const maxDuration = 60;

const headers = { ...OPEN_CORS, 'cache-control': 'no-store' };

export async function POST(req: Request) {
  const base = appBaseUrl(req);
  const auth = await authorizeCall(req.headers.get('authorization'), resourceUrl(base));
  if (!auth.ok) {
    if (auth.status === 503) {
      console.error('[copilot] mcp ledger unreadable', auth.description);
      return Response.json({ error: 'temporarily_unavailable', error_description: auth.description }, { status: 503, headers });
    }
    const presented = req.headers.has('authorization');
    return Response.json({ error: 'invalid_token', error_description: auth.description }, {
      status: 401,
      headers: { ...headers, 'www-authenticate': wwwAuthenticate(base, presented ? { error: 'invalid_token', description: auth.description } : undefined) },
    });
  }
  if (!headerVersionOk(req.headers.get('mcp-protocol-version'))) {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Unsupported MCP-Protocol-Version' } }, { status: 400, headers });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json(parseError(), { status: 400, headers }); }
  // Proposing only where the person ticked it when they connected (oauth.ts SCOPE_PROPOSE).
  const propose = canPropose(auth.scope);
  const out = await handleBody(body, { propose, call: (name, args) => runTool(name, args, { pid: auth.pid, grant: auth.grant, propose }) });
  if (out.status === 202) return new Response(null, { status: 202, headers });
  return Response.json(out.json, { headers });
}

/** No event stream is offered here, which Streamable HTTP says to answer with a 405. */
export function GET() {
  return new Response(null, { status: 405, headers: { ...headers, allow: 'POST, OPTIONS' } });
}

/** No sessions to end. */
export function DELETE() {
  return new Response(null, { status: 405, headers: { ...headers, allow: 'POST, OPTIONS' } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OPEN_CORS });
}
