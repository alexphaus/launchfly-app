// src/lib/copilot/signalkey.ts
// The count link's token: the account, the link's generation, and a signature
// over both (signal.ts says what the link is for).
//
// Server-only, because it signs — signal.ts stays importable from the screens.
// The generation is the newest `signal_link` row's: making a new link writes a
// new one, and a token naming any other generation is refused, so a link pasted
// somewhere it should not have been can be ended from the app without a
// migration or a secret of its own.

import { createHmac, timingSafeEqual } from 'node:crypto';

const GEN = /^[\w-]{8,64}$/;
const ID = /^[\w-]{1,64}$/;

const mac = (key: Buffer, pid: string, gen: string) => createHmac('sha256', key).update(`signal:${pid}:${gen}`).digest('base64url').slice(0, 32);

/** `pid.gen.signature`: what goes in the link's path. */
export function signalToken(pid: string, gen: string, key: Buffer): string {
  return `${pid}.${gen}.${mac(key, pid, gen)}`;
}

/** The account and generation a token names, when this server signed it; null for anything else. */
export function readSignalToken(token: unknown, key: Buffer): { pid: string; gen: string } | null {
  if (typeof token !== 'string' || token.length > 200) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [pid, gen, sig] = parts;
  if (!ID.test(pid) || !GEN.test(gen)) return null;
  const want = Buffer.from(mac(key, pid, gen));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? { pid, gen } : null;
}

/** The token at the end of a count link's address, or the token itself: what COPILOT_OWN_COUNT_LINK may hold. */
export function tokenOfLink(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  const m = s.match(/\/api\/copilot\/signal\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : s;
}
