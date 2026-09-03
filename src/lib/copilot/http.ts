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
