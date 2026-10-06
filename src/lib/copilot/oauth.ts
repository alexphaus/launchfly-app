// src/lib/copilot/oauth.ts
// Claude, signed in: the OAuth the connector needs, and no table for it.
//
// Claude reaches the MCP endpoint (api/copilot/mcp) from Anthropic's servers
// and signs in the way the MCP authorization spec says: it reads two discovery
// documents, registers itself (Dynamic Client Registration), sends the person
// here with a PKCE challenge, swaps the code for tokens, and refreshes them on
// its own. Everything it is handed is a signed token, so registering stores
// nothing and a code or a token is checked by its signature. The database holds
// only what has to be single-use or revocable — a grant, the refresh token it is
// on, a revocation, and a code typed in from the app — as copilot_events rows
// (connector.ts), the way the Lab is kept without a migration.
//
// Who may ask is decided by where the answer goes. A client registers the
// addresses it wants the code sent to, and only Claude's callback or a loopback
// address on the person's own computer (Claude Code) is accepted. The consent
// screen names the app from that address, never from the name a client gives
// itself: anyone can register calling themselves "Claude", and nobody but Claude
// receives what is sent to claude.ai.
//
// Pure — no DB import — so copilot-core.test.ts covers the parts that decide who
// gets in: what a redirect may be, what a code is bound to, what a refresh may
// return, and what the documents promise.

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** The one scope: read the record. Writing waits for its own scope and its own consent. */
export const SCOPE_READ = 'copilot.read';
/**
 * What the authorization server lists. offline_access is there because Claude
 * asks for exactly what is listed, and a refresh token is how a connection
 * outlives the hour its access token does.
 */
export const AS_SCOPES = [SCOPE_READ, 'offline_access'] as const;

/** Where the MCP server answers. The resource Claude is told about is this, on the app's own origin. */
export const MCP_PATH = '/api/copilot/mcp';
/** The page that asks the person, which is the authorization endpoint. */
export const CONSENT_PATH = '/copilot2/connect';

/** A code is spent within seconds of the tap; five minutes covers a slow network and nothing else. */
export const CODE_TTL_S = 300;
/** An hour: every call is also checked against the grant, so a disconnect does not wait for this to run out. */
export const ACCESS_TTL_S = 3600;
/** A connection nobody has used in this long has to be made again. Each refresh moves it. */
export const REFRESH_TTL_DAYS = 90;
/**
 * How long the refresh token just replaced still answers, with the same new
 * one. Claude gives a refresh 30 seconds: a reply lost on the way back would
 * otherwise read as a stolen token being replayed and end the connection, which
 * it did for nobody but the person waiting on it.
 */
export const REFRESH_GRACE_S = 60;
/** A code shown in the app lasts long enough to walk to a laptop, and works once. */
export const PAIR_TTL_S = 600;

/** The events the ledger is kept in (connector.ts). */
export const MCP_GRANT = 'mcp_grant';
export const MCP_REFRESH = 'mcp_refresh';
export const MCP_REVOKE = 'mcp_revoke';
export const MCP_SEEN = 'mcp_seen';
export const MCP_PAIR = 'mcp_pair';
export const MCP_EVENTS = [MCP_GRANT, MCP_REFRESH, MCP_REVOKE, MCP_SEEN, MCP_PAIR] as const;

/**
 * Claude's own callback, for claude.ai, Desktop, mobile and Cowork. claude.com
 * is listed beside it because Anthropic's documentation names it as the next
 * home of the same callback.
 */
export const CLAUDE_CALLBACKS = ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'] as const;

/* ─── Signed tokens ───────────────────────────────────────────────────────── */

type Kind = 'cpc' | 'cpa' | 'cpt' | 'cpr';
/**
 * One key per use, from one secret: a client id cannot be passed off as a code,
 * nor a code as a token, because each is signed with a key the others never see.
 */
function keyFor(master: Buffer, use: Kind | 'secret' | 'next' | 'csrf' | 'pair'): Buffer {
  return createHmac('sha256', master).update(`copilot-oauth:${use}`).digest();
}
const mac = (key: Buffer, s: string) => createHmac('sha256', key).update(s).digest();

/** A payload, signed: `kind.body.signature`, all base64url. Deterministic, so the same payload signs to the same token. */
export function seal(kind: Kind, payload: object, master: Buffer): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${kind}.${body}.${mac(keyFor(master, kind), `${kind}.${body}`).toString('base64url')}`;
}

/** The payload, if this server signed it for this use and it has not run out; null for anything else. */
export function unseal<T extends object>(kind: Kind, token: unknown, master: Buffer, nowS: number): T | null {
  if (typeof token !== 'string' || token.length > 8192) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== kind) return null;
  const expected = mac(keyFor(master, kind), `${kind}.${parts[1]}`);
  const given = Buffer.from(parts[2], 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let p: unknown;
  try { p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { return null; }
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const exp = (p as { exp?: unknown }).exp;
  if (exp !== undefined && (typeof exp !== 'number' || exp <= nowS)) return null;
  return p as T;
}

export const randomId = () => randomBytes(16).toString('base64url');
const sha = (s: string) => createHash('sha256').update(s).digest('base64url');
const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/* ─── Where a code may be sent ────────────────────────────────────────────── */

function parseUrl(s: unknown): URL | null {
  if (typeof s !== 'string' || !s || s.length > 500) return null;
  try { return new URL(s); } catch { return null; }
}

/** http on this computer: Claude Code listens on a port it picks per session. */
function isLoopback(u: URL): boolean {
  return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]');
}

/**
 * Whether a code may ever be sent here: Claude's callback, a loopback address,
 * or one the operator added (COPILOT_OAUTH_REDIRECTS, exact). Anything else is
 * refused at registration and again at the consent screen, so a page somewhere
 * cannot register itself and collect a code.
 */
export function redirectAllowed(uri: unknown, extra: readonly string[] = []): boolean {
  const u = parseUrl(uri);
  if (!u || u.hash || u.username || u.password) return false;
  if ((CLAUDE_CALLBACKS as readonly string[]).includes(u.href)) return true;
  if (extra.some((e) => parseUrl(e)?.href === u.href)) return true;
  return isLoopback(u);
}

/**
 * The address asked for, against the ones registered: exactly, except a
 * loopback address, whose port is ignored (RFC 8252 7.3). Claude Code registers
 * `http://localhost/callback` and comes back on whichever port it got.
 */
export function redirectMatches(registered: readonly string[], requested: unknown): boolean {
  const q = parseUrl(requested);
  if (!q || q.hash) return false;
  return registered.some((r) => {
    const reg = parseUrl(r);
    if (!reg) return false;
    if (isLoopback(reg) && isLoopback(q)) return reg.hostname === q.hostname && reg.pathname === q.pathname && reg.search === q.search;
    return reg.href === q.href;
  });
}

/**
 * Who is asking, by where the answer goes. A loopback address can be any
 * program on the computer, so it is named as that, and the screen says only to
 * allow it if the person started it.
 */
export function askerOf(redirect: string): { name: string; host: string; local: boolean } {
  const u = parseUrl(redirect);
  if (!u) return { name: 'An unknown app', host: '', local: false };
  if (isLoopback(u)) return { name: 'An app on this computer', host: u.hostname, local: true };
  if (u.hostname === 'claude.ai' || u.hostname === 'claude.com') return { name: 'Claude', host: u.hostname, local: false };
  return { name: u.hostname, host: u.hostname, local: false };
}

/* ─── Clients ─────────────────────────────────────────────────────────────── */

export type AuthMethod = 'none' | 'client_secret_post' | 'client_secret_basic';
const AUTH_METHODS: AuthMethod[] = ['none', 'client_secret_post', 'client_secret_basic'];

/** What a client id carries: its addresses, the name it gave, how it authenticates, when it registered. */
export interface ClientInfo { r: string[]; n: string; m: AuthMethod; t: number }
export type Client = ClientInfo & { id: string };

const NAME_MAX = 80;
const cleanName = (v: unknown) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, NAME_MAX) : '');

export type RegisterResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: 'invalid_redirect_uri' | 'invalid_client_metadata'; description: string };

/**
 * Dynamic Client Registration (RFC 7591), with nothing stored: the client id is
 * the registration, signed. Claude registers as a public client and proves
 * itself with PKCE; a client that asks for a secret gets one derived from its
 * id, so it can be checked without being kept.
 */
export function registerClient(body: unknown, c: { master: Buffer; nowS: number; extra?: readonly string[] }): RegisterResult {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const uris = Array.isArray(b.redirect_uris) ? b.redirect_uris : [];
  if (!uris.length || uris.length > 5 || !uris.every((u) => typeof u === 'string')) {
    return { ok: false, error: 'invalid_redirect_uri', description: 'Give one to five redirect_uris.' };
  }
  const refused = (uris as string[]).find((u) => !redirectAllowed(u, c.extra));
  if (refused) {
    return { ok: false, error: 'invalid_redirect_uri', description: `${refused} is not an address this server sends codes to: Claude's callback or a loopback address only.` };
  }
  const grants = b.grant_types === undefined ? ['authorization_code'] : b.grant_types;
  if (!Array.isArray(grants) || !grants.every((g) => g === 'authorization_code' || g === 'refresh_token')) {
    return { ok: false, error: 'invalid_client_metadata', description: 'Only the authorization_code and refresh_token grants are supported.' };
  }
  const types = b.response_types === undefined ? ['code'] : b.response_types;
  if (!Array.isArray(types) || !types.every((t) => t === 'code')) {
    return { ok: false, error: 'invalid_client_metadata', description: 'Only the code response type is supported.' };
  }
  const asked = b.token_endpoint_auth_method;
  if (asked !== undefined && !AUTH_METHODS.includes(asked as AuthMethod)) {
    return { ok: false, error: 'invalid_client_metadata', description: `token_endpoint_auth_method must be one of ${AUTH_METHODS.join(', ')}.` };
  }
  // A public client unless one asked otherwise: Claude's is public, and PKCE is
  // what proves a code is being redeemed by whoever asked for it.
  const m = (asked as AuthMethod | undefined) ?? 'none';
  const info: ClientInfo = { r: uris as string[], n: cleanName(b.client_name) || 'An MCP client', m, t: c.nowS };
  const id = seal('cpc', info, c.master);
  return {
    ok: true,
    body: {
      client_id: id,
      client_id_issued_at: c.nowS,
      client_name: info.n,
      redirect_uris: info.r,
      // Both, whatever was asked: the refresh token is how the connection lasts,
      // and RFC 7591 lets the server say what it registered.
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: m,
      ...(m === 'none' ? {} : { client_secret: clientSecret(id, c.master), client_secret_expires_at: 0 }),
    },
  };
}

export function clientOf(id: unknown, master: Buffer): Client | null {
  if (typeof id !== 'string') return null;
  const info = unseal<ClientInfo>('cpc', id, master, 0);
  if (!info || !Array.isArray(info.r) || !info.r.every((u) => typeof u === 'string') || typeof info.n !== 'string' || !AUTH_METHODS.includes(info.m)) return null;
  return { ...info, id };
}

export function clientSecret(id: string, master: Buffer): string {
  return mac(keyFor(master, 'secret'), id).toString('base64url');
}

/** Short and fixed-length, so a code or token can name its client without carrying the whole id. */
export const clientRef = (id: string) => sha(id).slice(0, 22);

/* ─── Resources and scopes ────────────────────────────────────────────────── */

export function resourceUrl(base: string): string {
  return `${base.replace(/\/+$/, '')}${MCP_PATH}`;
}

/** Two resource URLs name the same server: scheme, host and port as URL parses them, the path without a trailing slash. */
export function sameResource(a: unknown, b: unknown): boolean {
  const x = parseUrl(a), y = parseUrl(b);
  if (!x || !y || x.hash || y.hash) return false;
  return x.protocol === y.protocol && x.host === y.host && x.pathname.replace(/\/+$/, '') === y.pathname.replace(/\/+$/, '') && x.search === y.search;
}

/**
 * The scope granted, whatever was asked. Unknown scopes grant nothing and are
 * not refused (RFC 6749 lets the server issue less than asked), so a client that
 * also asks for `openid` still connects, and the token says what it can do.
 */
export function grantedScope(_asked: unknown): string {
  return SCOPE_READ;
}

/* ─── The authorization request ───────────────────────────────────────────── */

export interface AuthorizeRequest {
  client: Client;
  /** Where the code goes, as asked and checked. */
  redirect: string;
  state: string | null;
  challenge: string;
  scope: string;
  resource: string;
}

export type AuthorizeCheck =
  | { ok: true; req: AuthorizeRequest }
  /** Nowhere safe to send the person back to: said on the page instead (RFC 6749 4.1.2.1). */
  | { ok: false; show: string }
  /** Sent back to the client with an error, which Claude shows. */
  | { ok: false; redirect: string };

const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
const STATE_MAX = 1000;

/** The redirect with an error on it, carrying the state back so the client can match it. */
export function errorRedirect(redirect: string, error: string, description: string, state: string | null): string {
  const u = new URL(redirect);
  u.searchParams.set('error', error);
  u.searchParams.set('error_description', description);
  if (state) u.searchParams.set('state', state);
  return u.toString();
}

/** The redirect with the code on it. */
export function codeRedirect(redirect: string, code: string, state: string | null): string {
  const u = new URL(redirect);
  u.searchParams.set('code', code);
  if (state) u.searchParams.set('state', state);
  return u.toString();
}

/**
 * The authorization request, checked in the order RFC 6749 asks: the client and
 * where it wants the answer first, because until both check out there is nowhere
 * safe to send an error; then everything else, sent back as an error Claude can
 * show. PKCE with S256 is required of every client, as the MCP spec requires.
 */
export function checkAuthorize(q: Record<string, unknown>, c: { master: Buffer; resource: string; extra?: readonly string[] }): AuthorizeCheck {
  const client = clientOf(q.client_id, c.master);
  if (!client) return { ok: false, show: 'This request did not come from an app this server registered. Start again from Claude.' };
  const asked = typeof q.redirect_uri === 'string' && q.redirect_uri ? q.redirect_uri : null;
  // Without one, the only registered address — never a guess among several,
  // and never a loopback one, whose port only the request can say.
  const only = client.r.length === 1 ? parseUrl(client.r[0]) : null;
  const redirect = asked ?? (only && !isLoopback(only) ? client.r[0] : null);
  if (!redirect || !redirectMatches(client.r, redirect) || !redirectAllowed(redirect, c.extra)) {
    return { ok: false, show: 'The address this request wants to send you back to is not one its app registered, so nothing was sent. Start again from Claude.' };
  }
  const state = typeof q.state === 'string' && q.state ? q.state : null;
  if (state && state.length > STATE_MAX) return { ok: false, redirect: errorRedirect(redirect, 'invalid_request', 'state is too long', null) };
  const back = (error: string, description: string) => ({ ok: false as const, redirect: errorRedirect(redirect, error, description, state) });
  if (q.response_type !== 'code') return back('unsupported_response_type', 'Only response_type=code is supported.');
  if (q.code_challenge_method !== 'S256' || typeof q.code_challenge !== 'string' || !CHALLENGE.test(q.code_challenge)) {
    return back('invalid_request', 'PKCE is required, with code_challenge_method=S256.');
  }
  if (q.resource !== undefined && q.resource !== '' && !sameResource(q.resource, c.resource)) {
    return back('invalid_target', `This server's resource is ${c.resource}.`);
  }
  return { ok: true, req: { client, redirect, state, challenge: q.code_challenge, scope: grantedScope(q.scope), resource: c.resource } };
}

/* ─── Codes and tokens ────────────────────────────────────────────────────── */

export interface CodePayload {
  sub: string;
  /** clientRef of the client it was issued to. */
  cid: string;
  ru: string;
  cc: string;
  sc: string;
  res: string;
  /** The grant it starts, if redeemed. */
  jti: string;
  exp: number;
}

export function issueCode(req: AuthorizeRequest, sub: string, c: { master: Buffer; nowS: number; jti?: string }): string {
  const p: CodePayload = { sub, cid: clientRef(req.client.id), ru: req.redirect, cc: req.challenge, sc: req.scope, res: req.resource, jti: c.jti ?? randomId(), exp: c.nowS + CODE_TTL_S };
  return seal('cpa', p, c.master);
}

export interface AccessPayload { sub: string; g: string; sc: string; aud: string; cid: string; exp: number }
export interface RefreshPayload { sub: string; g: string; sc: string; aud: string; cid: string; jti: string; exp: number }

/** A refresh token's last day, at midnight UTC: two requests rotating it at once sign the same token. */
export function refreshExp(nowS: number): number {
  return Math.floor((nowS + REFRESH_TTL_DAYS * 86_400) / 86_400) * 86_400;
}

/** The refresh token after this one, decided by this one: two refreshes racing compute the same successor. */
export function nextRefreshJti(jti: string, master: Buffer): string {
  return mac(keyFor(master, 'next'), jti).toString('base64url').slice(0, 22);
}

export interface TokenSet { access_token: string; token_type: 'Bearer'; expires_in: number; refresh_token: string; scope: string }

/** The token response. The refresh token is passed in, because a replayed refresh has to return the same one. */
export function tokenSet(g: { sub: string; grant: string; scope: string; aud: string; cid: string }, refresh: { jti: string; exp: number }, c: { master: Buffer; nowS: number }): TokenSet {
  const access: AccessPayload = { sub: g.sub, g: g.grant, sc: g.scope, aud: g.aud, cid: g.cid, exp: c.nowS + ACCESS_TTL_S };
  const rt: RefreshPayload = { sub: g.sub, g: g.grant, sc: g.scope, aud: g.aud, cid: g.cid, jti: refresh.jti, exp: refresh.exp };
  return { access_token: seal('cpt', access, c.master), token_type: 'Bearer', expires_in: ACCESS_TTL_S, refresh_token: seal('cpr', rt, c.master), scope: g.scope };
}

export const accessOf = (token: unknown, master: Buffer, nowS: number) => {
  const p = unseal<AccessPayload>('cpt', token, master, nowS);
  return p && typeof p.sub === 'string' && typeof p.g === 'string' && typeof p.exp === 'number' ? p : null;
};

export function pkceMatches(verifier: unknown, challenge: string): boolean {
  if (typeof verifier !== 'string' || !VERIFIER.test(verifier)) return false;
  return same(createHash('sha256').update(verifier).digest('base64url'), challenge);
}

/* ─── The token endpoint ──────────────────────────────────────────────────── */

export interface TokenError { status: number; error: string; description: string }
const tokenError = (error: string, description: string, status = 400): { ok: false; err: TokenError } => ({ ok: false, err: { status, error, description } });

/** `Authorization: Basic` as RFC 6749 2.3.1 writes it: each half form-encoded, then base64. */
export function basicAuth(header: string | null): { id: string; secret: string } | null {
  const m = header?.match(/^Basic\s+([A-Za-z0-9+/=_-]+)\s*$/i);
  if (!m) return null;
  const raw = Buffer.from(m[1], 'base64').toString('utf8');
  const i = raw.indexOf(':');
  if (i < 0) return null;
  try {
    return { id: decodeURIComponent(raw.slice(0, i).replace(/\+/g, ' ')), secret: decodeURIComponent(raw.slice(i + 1).replace(/\+/g, ' ')) };
  } catch {
    return null;
  }
}

/** The client a token request is from, authenticated the way it registered. A secret is never accepted in place of the method asked. */
export function authenticateClient(form: Record<string, unknown>, basic: { id: string; secret: string } | null, master: Buffer): { ok: true; client: Client } | { ok: false; err: TokenError } {
  const id = basic?.id ?? (typeof form.client_id === 'string' ? form.client_id : '');
  const client = clientOf(id, master);
  if (!client) return tokenError('invalid_client', 'Unknown client: register again.', 401);
  if (client.m === 'none') return { ok: true, client };
  const secret = client.m === 'client_secret_basic' ? basic?.secret : typeof form.client_secret === 'string' ? form.client_secret : undefined;
  if (!secret || !same(secret, clientSecret(client.id, master))) return tokenError('invalid_client', 'The client secret does not match.', 401);
  return { ok: true, client };
}

/** A code swap, checked against everything the code was bound to. Whether the code was already spent is the ledger's to say (connector.ts). */
export function checkCodeGrant(form: Record<string, unknown>, client: Client, c: { master: Buffer; nowS: number }): { ok: true; code: CodePayload } | { ok: false; err: TokenError } {
  const code = unseal<CodePayload>('cpa', form.code, c.master, c.nowS);
  if (!code || typeof code.exp !== 'number') return tokenError('invalid_grant', 'The code is not valid or has expired. Connect again.');
  if (code.cid !== clientRef(client.id)) return tokenError('invalid_grant', 'The code was issued to another client.');
  if (typeof form.redirect_uri === 'string' && form.redirect_uri && form.redirect_uri !== code.ru) return tokenError('invalid_grant', 'redirect_uri does not match the one the code was sent to.');
  if (!pkceMatches(form.code_verifier, code.cc)) return tokenError('invalid_grant', 'code_verifier does not match the code_challenge.');
  if (form.resource !== undefined && form.resource !== '' && !sameResource(form.resource, code.res)) return tokenError('invalid_target', 'resource does not match the one authorized.');
  return { ok: true, code };
}

/** A refresh, checked against its token alone. Whether the token is the current one is the ledger's to say (refreshStep). */
export function checkRefreshGrant(form: Record<string, unknown>, client: Client, c: { master: Buffer; nowS: number }): { ok: true; rt: RefreshPayload } | { ok: false; err: TokenError } {
  const rt = unseal<RefreshPayload>('cpr', form.refresh_token, c.master, c.nowS);
  if (!rt || typeof rt.jti !== 'string' || typeof rt.exp !== 'number') return tokenError('invalid_grant', 'The refresh token is not valid or has expired. Connect again.');
  if (rt.cid !== clientRef(client.id)) return tokenError('invalid_grant', 'The refresh token was issued to another client.');
  if (typeof form.scope === 'string' && form.scope.trim()) {
    const asked = form.scope.trim().split(/\s+/).filter((s) => s !== 'offline_access');
    if (asked.some((s) => !rt.sc.split(' ').includes(s))) return tokenError('invalid_scope', 'A refresh cannot add scope.');
  }
  if (form.resource !== undefined && form.resource !== '' && !sameResource(form.resource, rt.aud)) return tokenError('invalid_target', 'resource does not match the one authorized.');
  return { ok: true, rt };
}

export interface RefreshRow { id: number; jti: string; exp: number; at: string }

export type RefreshStep =
  /** The token is the current one: its successor is written (unless a racing refresh already did) and it is removed. */
  | { kind: 'rotate'; next: { jti: string; exp: number }; insert: boolean; remove: number[] }
  /** It was replaced moments ago: the same successor again, so a reply lost on the way does not end the connection. */
  | { kind: 'replay'; next: { jti: string; exp: number } }
  /** Replaced long ago, or never current: somebody is replaying it, and the grant ends. */
  | { kind: 'reuse' };

/**
 * What a refresh may return, from the grant's refresh rows. Rotation is what
 * OAuth 2.1 asks of a public client, and the successor is computed from the
 * token rather than drawn at random, so two refreshes racing write and return
 * the same one instead of the second ending the grant.
 */
export function refreshStep(rows: RefreshRow[], jti: string, next: string, c: { nowS: number }): RefreshStep {
  const current = rows.filter((r) => r.jti === jti);
  const successor = rows.find((r) => r.jti === next);
  if (current.length) {
    return { kind: 'rotate', next: { jti: next, exp: successor?.exp ?? refreshExp(c.nowS) }, insert: !successor, remove: current.map((r) => r.id) };
  }
  if (successor && c.nowS * 1000 - Date.parse(successor.at) <= REFRESH_GRACE_S * 1000) {
    return { kind: 'replay', next: { jti: successor.jti, exp: successor.exp } };
  }
  return { kind: 'reuse' };
}

/* ─── The ledger ──────────────────────────────────────────────────────────── */

export interface LedgerRow { id: number; event_type: string; payload: Record<string, unknown>; created_at: string }

export interface Connection {
  grant: string;
  /** Who it is, by where its codes went (askerOf), and the name it gave itself. */
  name: string;
  host: string;
  client: string;
  at: string;
  scope: string;
  /** The last read, how many there have been, and the last one that failed and why. */
  seen: { at: string; tool: string | null; n: number; error: string | null } | null;
}

const str = (v: unknown) => (typeof v === 'string' ? v : null);

/** Whether a grant is live: made, and not revoked since. */
export function grantLive(rows: LedgerRow[], grant: string): boolean {
  return rows.some((r) => r.event_type === MCP_GRANT && r.payload.grant === grant)
    && !rows.some((r) => r.event_type === MCP_REVOKE && r.payload.grant === grant);
}

/** The live connections, newest first, each with its last read. */
export function connectionsOf(rows: LedgerRow[]): Connection[] {
  const revoked = new Set(rows.filter((r) => r.event_type === MCP_REVOKE).map((r) => str(r.payload.grant)));
  // One row per grant, rewritten on each read; two reads racing can leave two, and the later read is the one to show.
  const seen = new Map<string | null, Record<string, unknown>>();
  for (const r of rows) {
    if (r.event_type !== MCP_SEEN) continue;
    const had = seen.get(str(r.payload.grant));
    if (!had || String(r.payload.at ?? '') > String(had.at ?? '')) seen.set(str(r.payload.grant), r.payload);
  }
  return rows
    .filter((r) => r.event_type === MCP_GRANT && typeof r.payload.grant === 'string' && !revoked.has(r.payload.grant))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((r) => {
      const s = seen.get(r.payload.grant as string);
      return {
        grant: r.payload.grant as string,
        name: str(r.payload.name) ?? 'An app',
        host: str(r.payload.host) ?? '',
        client: str(r.payload.client) ?? '',
        at: r.created_at,
        scope: str(r.payload.scope) ?? SCOPE_READ,
        seen: s && typeof s.at === 'string' ? { at: s.at, tool: str(s.tool), n: typeof s.n === 'number' ? s.n : 1, error: str(s.error) } : null,
      };
    });
}

/* ─── A code typed in from the app ────────────────────────────────────────── */

/**
 * No 0/O, 1/I/L or U: read off a phone and typed on a laptop, a code that can
 * be misread is a code that fails for no reason the person can see.
 */
const PAIR_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const PAIR_LENGTH = 8;

/** "K7QM-3TXD". Drawn without bias: a byte past the last whole run of the alphabet is drawn again. */
export function newPairCode(rand: (n: number) => Buffer = randomBytes): string {
  const limit = 256 - (256 % PAIR_ALPHABET.length);
  let out = '';
  while (out.length < PAIR_LENGTH) {
    for (const b of rand(PAIR_LENGTH * 2)) {
      if (b < limit && out.length < PAIR_LENGTH) out += PAIR_ALPHABET[b % PAIR_ALPHABET.length];
    }
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/** What was typed, as the code it means: case, spaces and dashes are the typist's, not the code's. Null when it cannot be one. */
export function normalizePair(typed: unknown): string | null {
  if (typeof typed !== 'string') return null;
  const s = typed.toUpperCase().replace(/[\s-]/g, '');
  return s.length === PAIR_LENGTH && [...s].every((ch) => PAIR_ALPHABET.includes(ch)) ? s : null;
}

/** How a code is kept: keyed, so a copy of the table is not a list of codes to try. */
export function pairHash(code: string, master: Buffer): string {
  return mac(keyFor(master, 'pair'), code).toString('hex');
}

/* ─── The consent form ────────────────────────────────────────────────────── */

/**
 * Ties the consent form to the account it was shown to and the request it was
 * shown for. The session cookie is SameSite=Lax, so a form posted from another
 * site arrives signed out anyway; this is the second lock, not the only one.
 */
export function consentToken(pid: string, req: Pick<AuthorizeRequest, 'client' | 'redirect' | 'challenge' | 'state'>, master: Buffer): string {
  return mac(keyFor(master, 'csrf'), [pid, req.client.id, req.redirect, req.challenge, req.state ?? ''].join('\n')).toString('base64url');
}

export function consentTokenMatches(given: unknown, pid: string, req: Pick<AuthorizeRequest, 'client' | 'redirect' | 'challenge' | 'state'>, master: Buffer): boolean {
  return typeof given === 'string' && same(given, consentToken(pid, req, master));
}

/* ─── What the server tells a client ──────────────────────────────────────── */

/** RFC 9728: the resource, and the one authorization server Claude will use (it reads only the first). */
export function protectedResourceMetadata(base: string) {
  const b = base.replace(/\/+$/, '');
  return {
    resource: resourceUrl(b),
    authorization_servers: [b],
    scopes_supported: [SCOPE_READ],
    bearer_methods_supported: ['header'],
    resource_name: 'Copilot',
  };
}

/**
 * RFC 8414. No client ID metadata documents: supporting them means fetching
 * whatever URL a client names, and DCR needs nothing fetched or stored.
 */
export function authServerMetadata(base: string) {
  const b = base.replace(/\/+$/, '');
  return {
    issuer: b,
    authorization_endpoint: `${b}${CONSENT_PATH}`,
    token_endpoint: `${b}/api/copilot/oauth/token`,
    registration_endpoint: `${b}/api/copilot/oauth/register`,
    revocation_endpoint: `${b}/api/copilot/oauth/revoke`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: AUTH_METHODS,
    revocation_endpoint_auth_methods_supported: AUTH_METHODS,
    scopes_supported: [...AS_SCOPES],
  };
}

/** Where the protected resource metadata is, for this server's MCP path (RFC 9728 3.1: the path goes after the well-known name). */
export function resourceMetadataUrl(base: string): string {
  return `${base.replace(/\/+$/, '')}/.well-known/oauth-protected-resource${MCP_PATH}`;
}

/**
 * The 401's header. Claude starts sign-in only on a 401 that carries it, and
 * takes the scope to ask for from here.
 */
export function wwwAuthenticate(base: string, err?: { error: 'invalid_token'; description: string }): string {
  const parts = [`resource_metadata="${resourceMetadataUrl(base)}"`, `scope="${SCOPE_READ}"`];
  if (err) parts.unshift(`error="${err.error}"`, `error_description="${err.description.replace(/["\\]/g, '')}"`);
  return `Bearer ${parts.join(', ')}`;
}
