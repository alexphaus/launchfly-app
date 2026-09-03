// src/lib/copilot/session.ts
// Lightweight identity: a signed httpOnly cookie carrying the profile id.
// No password, no email wall. Good enough for a personal copilot foundation;
// swap for Supabase Auth later without touching the data model.

import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'cp_session';
const ONE_YEAR = 60 * 60 * 24 * 365;

function secret(): string {
  const s = process.env.COPILOT_SESSION_SECRET || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('Copilot: set COPILOT_SESSION_SECRET (or SUPABASE_SERVICE_KEY)');
  return s;
}

function sign(profileId: string): string {
  return createHmac('sha256', secret()).update(profileId).digest('hex');
}

export function encodeSession(profileId: string): string {
  return `${profileId}.${sign(profileId)}`;
}

export function decodeSession(value: string | undefined | null): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(id);
  if (sig.length !== expected.length) return null;
  try {
    return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex')) ? id : null;
  } catch {
    return null;
  }
}

/** Read the current profile id from the request cookies (server components + route handlers). */
export async function currentProfileId(): Promise<string | null> {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}

export function setSessionCookie(res: NextResponse, profileId: string) {
  res.cookies.set(SESSION_COOKIE, encodeSession(profileId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
}
