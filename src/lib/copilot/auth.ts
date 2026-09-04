// src/lib/copilot/auth.ts
// Own magic links. No password, no third-party auth config: a random token,
// its hash in copilot_login_tokens, an email via Resend, and the callback sets
// the same session cookie the app already uses. Recovery and multi-device in
// ~100 lines, and it links to the existing profile when requested from inside.

import { createHash, randomBytes } from 'crypto';
import { Resend } from 'resend';
import { copilotDb } from './db';
import { rateLimit } from './limits';
import { logEvent } from './base';

const TOKEN_TTL_MIN = 15;

export function loginConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!(process.env.COPILOT_EMAIL_FROM || process.env.FROM_EMAIL);
}

export function appBaseUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, '');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host;
  return `${proto}://${host}`;
}

const hash = (t: string) => createHash('sha256').update(t).digest('hex');
const normEmail = (e: string) => e.trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function requestMagicLink(input: { email: string; profileId?: string | null; baseUrl: string; ip?: string }): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const email = normEmail(input.email);
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'That email does not look right', status: 400 };
  if (!loginConfigured()) return { ok: false, error: 'Sign-in email is not configured on this server', status: 503 };
  const byEmail = await rateLimit(`magic:email:${email}`, 3, 15 * 60);
  if (!byEmail.ok) return { ok: false, error: 'Too many links requested. Check your inbox or wait 15 minutes.', status: 429 };
  if (input.ip) {
    const byIp = await rateLimit(`magic:ip:${input.ip}`, 10, 60 * 60);
    if (!byIp.ok) return { ok: false, error: 'Too many requests from this network. Try again later.', status: 429 };
  }

  const db = copilotDb();
  const token = randomBytes(32).toString('base64url');
  await db.from('copilot_login_tokens').insert({
    profile_id: input.profileId ?? null, email, token_hash: hash(token),
    expires_at: new Date(Date.now() + TOKEN_TTL_MIN * 60_000).toISOString(),
  });
  if (input.profileId) {
    // Linking from inside the app: remember which email this device asked for.
    await db.from('copilot_profiles').update({ pending_login_email: email }).eq('id', input.profileId);
  }

  const link = `${input.baseUrl}/api/copilot/auth/callback?token=${encodeURIComponent(token)}`;
  const from = process.env.COPILOT_EMAIL_FROM || process.env.FROM_EMAIL!;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const r = await resend.emails.send({
    from, to: email, subject: 'Your Copilot sign-in link',
    text: `Tap to sign in to Copilot:\n\n${link}\n\nThis link works once and expires in ${TOKEN_TTL_MIN} minutes. If you did not ask for it, ignore this email.`,
    html: `<p>Tap to sign in to Copilot:</p><p><a href="${link}" style="font:700 15px system-ui;background:#2B3EF0;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block">Sign in to Copilot</a></p><p style="color:#5C5D63;font:13px system-ui">This link works once and expires in ${TOKEN_TTL_MIN} minutes. If you did not ask for it, ignore this email.</p>`,
  });
  if (r.error) return { ok: false, error: `Could not send email: ${r.error.message}`, status: 502 };
  if (input.profileId) await logEvent(input.profileId, 'login_link_sent', { email });
  return { ok: true };
}

export type MagicLinkResult =
  | { kind: 'profile'; profileId: string }
  | { kind: 'new'; email: string }
  | { kind: 'invalid' };

/** Consume a token once. Links to the requesting profile, else finds the profile by email, else signals a new user. */
export async function consumeMagicLink(token: string): Promise<MagicLinkResult> {
  if (!token) return { kind: 'invalid' };
  const db = copilotDb();
  const { data: row } = await db.from('copilot_login_tokens').select('id, profile_id, email, expires_at, used_at').eq('token_hash', hash(token)).maybeSingle();
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) return { kind: 'invalid' };
  await db.from('copilot_login_tokens').update({ used_at: new Date().toISOString() }).eq('id', row.id);

  const now = new Date().toISOString();
  if (row.profile_id) {
    await db.from('copilot_profiles').update({ email: row.email, email_verified_at: now, pending_login_email: null, last_seen_at: now }).eq('id', row.profile_id);
    await logEvent(row.profile_id, 'login_link_used', { linked: true });
    return { kind: 'profile', profileId: row.profile_id };
  }
  const { data: existing } = await db.from('copilot_profiles').select('id').ilike('email', row.email).order('last_seen_at', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (existing) {
    await db.from('copilot_profiles').update({ email_verified_at: now, last_seen_at: now }).eq('id', existing.id);
    await logEvent(existing.id, 'login_link_used', { linked: false });
    return { kind: 'profile', profileId: existing.id };
  }
  return { kind: 'new', email: row.email };
}
