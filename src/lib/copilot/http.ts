// src/lib/copilot/http.ts
// Tiny helpers shared by the copilot route handlers.

import { NextResponse } from 'next/server';
import { currentProfileId } from './session';

export const NO_STORE = { 'cache-control': 'private, no-store' } as const;

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

/** Resolve the signed-in profile or return null (caller responds 401). */
export async function profileIdOr401(): Promise<{ pid: string } | { res: NextResponse }> {
  const pid = await currentProfileId();
  return pid ? { pid } : { res: fail('Not signed in', 401) };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try { return ((await req.json()) ?? {}) as Record<string, unknown>; } catch { return {}; }
}

/**
 * Headers for the Claude connector's protocol endpoints (discovery, OAuth, MCP).
 * Any origin may call them: none of them reads the session cookie — a token in
 * the request is the only credential — so a browser-based MCP client, the MCP
 * Inspector among them, can reach them without opening anything a cookie guards.
 */
export const OPEN_CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id, last-event-id',
  'access-control-expose-headers': 'www-authenticate, mcp-session-id',
  'access-control-max-age': '86400',
} as const;

/** A form-urlencoded or JSON body, as the OAuth endpoints take either. Never throws: an unreadable body is an empty one, refused by what reads it. */
export async function readForm(req: Request): Promise<Record<string, string>> {
  const raw = await req.text().catch(() => '');
  if ((req.headers.get('content-type') ?? '').includes('application/json')) {
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}
