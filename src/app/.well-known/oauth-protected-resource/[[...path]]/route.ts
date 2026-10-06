// src/app/.well-known/oauth-protected-resource/[[...path]]/route.ts
// RFC 9728: what the MCP server is and who signs people in to it. Claude reads
// it from the 401's resource_metadata pointer, or probes for it here: the
// path-suffixed form for /api/copilot/mcp first, then the bare one. Any other
// path names a resource this server does not have.
import { appBaseUrl } from '@/lib/copilot/auth';
import { OPEN_CORS } from '@/lib/copilot/http';
import { MCP_PATH, protectedResourceMetadata } from '@/lib/copilot/oauth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const path = (await ctx.params).path ?? [];
  if (path.length && `/${path.join('/')}` !== MCP_PATH) {
    return Response.json({ error: 'not_found' }, { status: 404, headers: OPEN_CORS });
  }
  return Response.json(protectedResourceMetadata(appBaseUrl(req)), { headers: { ...OPEN_CORS, 'cache-control': 'no-store' } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OPEN_CORS });
}
