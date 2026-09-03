import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/copilot/session';
import { NO_STORE } from '@/lib/copilot/http';

export const runtime = 'nodejs';

/** Forget this device. The profile stays in the database. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  clearSessionCookie(res);
  return res;
}
