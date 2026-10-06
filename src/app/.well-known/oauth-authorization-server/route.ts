// src/app/.well-known/oauth-authorization-server/route.ts
// RFC 8414: where to register, where to send the person, and where to swap a
// code for tokens. The issuer is the app's own origin, so this is the path a
// client looks it up at.
import { appBaseUrl } from '@/lib/copilot/auth';
import { OPEN_CORS } from '@/lib/copilot/http';
import { authServerMetadata } from '@/lib/copilot/oauth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return Response.json(authServerMetadata(appBaseUrl(req)), { headers: { ...OPEN_CORS, 'cache-control': 'no-store' } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OPEN_CORS });
}
