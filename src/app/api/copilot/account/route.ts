// src/app/api/copilot/account/route.ts
// Delete the account, for real.
//
// "Forget device" cleared a cookie and left every row in place, which is not
// deletion and could not be described as such to anybody — it is the reason the
// app had no privacy policy worth publishing. This is the other one: the rows go.
//
// Guarded by a typed confirmation rather than a second tap. There is no undo and
// no soft-delete window, because a product that keeps your data for thirty days
// after you asked it not to has not done what you asked.

import { NextResponse } from 'next/server';
import { deleteAccount } from '@/lib/copilot/store';
import { clearSessionCookie } from '@/lib/copilot/session';
import { NO_STORE, fail, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

export const CONFIRM_WORD = 'DELETE';

export async function DELETE(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  // Not a formality: this endpoint is one fetch away from any script running in
  // the page, and the word is the only thing standing between a mis-wired button
  // and somebody's whole funnel.
  if (typeof b.confirm !== 'string' || b.confirm.trim().toUpperCase() !== CONFIRM_WORD) {
    return fail(`Type ${CONFIRM_WORD} to confirm`);
  }
  try {
    await deleteAccount(auth.pid);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not delete the account');
  }
  // Sign the device out in the same response. Leaving a cookie pointing at a
  // profile that no longer exists produces a 401 loop rather than a sign-in.
  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  clearSessionCookie(res);
  return res;
}

export async function POST(req: Request) {
  return DELETE(req);
}
