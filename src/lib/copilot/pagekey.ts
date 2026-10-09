// src/lib/copilot/pagekey.ts
// The page's address: the account it belongs to, packed short, and a signature
// over it (livepage.ts says what the page is for).
//
// Signed rather than looked up. A short random name would need a search across
// every account's rows on every open — copilot_events is indexed by account,
// not by anything a stranger could hold — and a signature lets the page route go
// straight to the one account it names, while nobody can make an address for an
// account by guessing. One page per account, so the address never changes while
// the version behind it does: a link already shared keeps working.
//
// Server-only, because it signs — livepage.ts stays importable from the screens.

import { createHmac, timingSafeEqual } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID = /^[\w-]{1,64}$/;

const mac = (key: Buffer, pid: string) => createHmac('sha256', key).update(`page:${pid}`).digest('base64url').slice(0, 12);

/** A uuid as 22 characters, anything else as itself in base64url, marked so it unpacks the same way. */
function pack(pid: string): string {
  return UUID.test(pid) ? `u${Buffer.from(pid.replace(/-/g, ''), 'hex').toString('base64url')}` : `s${Buffer.from(pid, 'utf8').toString('base64url')}`;
}

function unpack(s: string): string | null {
  if (!/^[us][A-Za-z0-9_-]{1,90}$/.test(s)) return null;
  const raw = Buffer.from(s.slice(1), 'base64url');
  if (s[0] === 'u') {
    if (raw.length !== 16) return null;
    const h = raw.toString('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  const id = raw.toString('utf8');
  return ID.test(id) ? id : null;
}

/** The code at the end of the page's address. */
export function pageCode(pid: string, key: Buffer): string {
  return `${pack(pid)}.${mac(key, pid)}`;
}

/** The account a code names, when this server signed it; null for anything else. */
export function readPageCode(code: unknown, key: Buffer): string | null {
  if (typeof code !== 'string' || code.length > 120) return null;
  const parts = code.split('.');
  if (parts.length !== 2) return null;
  const pid = unpack(parts[0]);
  if (!pid) return null;
  const want = Buffer.from(mac(key, pid));
  const got = Buffer.from(parts[1]);
  return want.length === got.length && timingSafeEqual(want, got) ? pid : null;
}

/** The page's address for an origin. */
export function pageUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/p/${code}`;
}
