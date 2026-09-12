// src/app/api/copilot/actions/[id]/opened/route.ts
// Somebody tapped "Open in WhatsApp".
//
// Deliberately the smallest possible endpoint: it records a tap and returns, and
// it never returns the home payload. It is called by sendBeacon as the page goes
// to the background, where there is no time for a round trip and no UI left to
// update — and where a slow response would mean the tap is simply lost.
//
// It does NOT mark anything sent. See markOpened.

import { clearOpened, markOpened } from '@/lib/copilot/store';
import { NO_STORE, profileIdOr401 } from '@/lib/copilot/http';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { id } = await ctx.params;
  await markOpened(auth.pid, id);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

/**
 * "No, that one did not go." Clears the mark so the question stops being asked,
 * and leaves the draft in the queue where it still belongs.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { id } = await ctx.params;
  await clearOpened(auth.pid, id);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
