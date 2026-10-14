// src/lib/copilot/accounts.ts
// The person's own accounts, connected so work can go out under their name.
//
// `reach` has been gated since the first version on one rule (invariant 4):
// nobody sends under an identity they do not own, and this server's WhatsApp
// and Resend credentials are the operator's. The gate's own text said what would
// open it — "connect your own email or WhatsApp first" — and nothing could.
//
// What opens it now: the person connects an account of theirs that speaks MCP
// (their mail, their calendar, their CRM), through that service's own OAuth
// consent screen, and the tokens go straight into a vault at Anthropic that
// holds them for the Claude agent. This app never stores them: it records which
// account is connected and where, and the vault injects the credential outside
// the agent's sandbox, so even the agent cannot read it. Every call the agent
// makes through that account stops for the person's OK in the app
// (`always_ask`): reach under their own identity, one message at a time — never
// autonomous (AUTHORITY.reach).
//
// The connect flow is the MCP authorization spec's, as a client: the server's
// protected-resource metadata names its authorization server, whose metadata
// gives the endpoints; the app registers itself there (dynamic client
// registration), sends the person to consent with PKCE, and exchanges the code.
// A server that takes a plain bearer token instead can be given one.
//
// Pure: parsing, sealing and shaping. The routes do the fetching.

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ACCOUNT_VAULT = 'account_vault';
export const ACCOUNT_CONNECTED = 'account_connected';
export const ACCOUNT_REMOVED = 'account_removed';
export const ACCOUNT_EVENTS = [ACCOUNT_VAULT, ACCOUNT_CONNECTED, ACCOUNT_REMOVED] as const;

/** A vault holds at most 20 credentials (Managed Agents); a person needs far fewer. */
export const MAX_ACCOUNTS = 8;

export interface Account {
  /** The vault credential's id: what removing it archives. */
  id: string;
  vault: string;
  /** What the person called it: "My Gmail". */
  name: string;
  /** The MCP server it is for. The vault matches the credential to the server by this. */
  server: string;
  /** The server's name inside a session: unique, short, safe. */
  slug: string;
  how: 'oauth' | 'token';
  at: string;
}

interface Row { event_type: string; payload: unknown; created_at: string }
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const s = (v: unknown, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** The person's vault and the accounts in it, from the event rows: connected, minus removed. */
export function accountsOf(rows: Row[]): { vault: string | null; accounts: Account[] } {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  let vault: string | null = null;
  const live = new Map<string, Account>();
  for (const r of sorted) {
    const p = obj(r.payload);
    if (r.event_type === ACCOUNT_VAULT) vault = s(p.vault) ?? vault;
    if (r.event_type === ACCOUNT_CONNECTED) {
      const id = s(p.id), v = s(p.vault), server = s(p.server, 500), name = s(p.name, 40), slug = s(p.slug, 40);
      if (id && v && server && name && slug) live.set(id, { id, vault: v, name, server, slug, how: p.how === 'token' ? 'token' : 'oauth', at: r.created_at });
    }
    if (r.event_type === ACCOUNT_REMOVED) { const id = s(p.id); if (id) live.delete(id); }
  }
  return { vault, accounts: [...live.values()] };
}

const PRIVATE_V4 = /^(?:10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

/**
 * Whether an address can be an account's MCP server: https, a real public
 * hostname. The vault sends the person's token to whatever this names, so a
 * private address or a typo'd scheme is refused before anything is asked.
 */
export function mcpUrlOk(raw: unknown, opts: { allowLocal?: boolean } = {}): raw is string {
  if (typeof raw !== 'string' || raw.length > 500) return false;
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (opts.allowLocal && local) return u.protocol === 'http:' || u.protocol === 'https:';
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  const h = u.hostname.toLowerCase();
  if (local || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost') || !h.includes('.')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) && PRIVATE_V4.test(h)) return false;
  if (h.startsWith('[')) return false;
  return true;
}

/** The server's name in a session: from what the person called it, unique among theirs. */
export function slugFor(name: string, taken: ReadonlySet<string>): string {
  const base = (name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'account');
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}_${i}`;
  return slug;
}

/* ─── Discovery ───────────────────────────────────────────────────────────── */

/** Where an MCP server says who authorizes it (RFC 9728): the path-specific address first. */
export function resourceMetadataUrls(server: string): string[] {
  const u = new URL(server);
  const path = u.pathname.replace(/\/+$/, '');
  return [...new Set([
    `${u.origin}/.well-known/oauth-protected-resource${path}`,
    `${u.origin}/.well-known/oauth-protected-resource`,
  ])];
}

export function parseResourceMetadata(j: unknown): { servers: string[]; scopes: string[] } | null {
  const o = obj(j);
  const servers = Array.isArray(o.authorization_servers) ? o.authorization_servers.filter((x): x is string => mcpUrlOk(x) || (typeof x === 'string' && x.startsWith('http://localhost'))) : [];
  if (!servers.length) return null;
  const scopes = Array.isArray(o.scopes_supported) ? o.scopes_supported.filter((x): x is string => typeof x === 'string').slice(0, 20) : [];
  return { servers, scopes };
}

/** Where an authorization server describes itself (RFC 8414), then OpenID's address for the same. */
export function authServerMetadataUrls(issuer: string): string[] {
  const u = new URL(issuer);
  const path = u.pathname.replace(/\/+$/, '');
  return [...new Set([
    `${u.origin}/.well-known/oauth-authorization-server${path}`,
    `${u.origin}/.well-known/openid-configuration${path}`,
    `${u.origin}${path}/.well-known/openid-configuration`,
  ])];
}

export interface AuthServer { authorize: string; token: string; register: string | null }

export function parseAuthServerMetadata(j: unknown, opts: { allowLocal?: boolean } = {}): AuthServer | null {
  const o = obj(j);
  const ok = (v: unknown) => mcpUrlOk(v, opts);
  if (!ok(o.authorization_endpoint) || !ok(o.token_endpoint)) return null;
  // PKCE with S256 is required by the MCP spec; a server that says it does not
  // support it is one this app will not send a person to.
  const methods = Array.isArray(o.code_challenge_methods_supported) ? o.code_challenge_methods_supported : null;
  if (methods && !methods.includes('S256')) return null;
  return { authorize: o.authorization_endpoint as string, token: o.token_endpoint as string, register: ok(o.registration_endpoint) ? o.registration_endpoint as string : null };
}

/** What the app registers itself as: a public client with no secret, which is what PKCE is for. */
export function registrationBody(redirect: string) {
  return {
    client_name: 'Copilot',
    redirect_uris: [redirect],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };
}

export function parseRegistration(j: unknown): { clientId: string } | null {
  const id = s(obj(j).client_id, 300);
  return id ? { clientId: id } : null;
}

/* ─── PKCE and the pending connect ────────────────────────────────────────── */

export const pkceVerifier = () => randomBytes(32).toString('base64url');
export const pkceChallenge = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

export function authorizeUrl(as: AuthServer, p: { clientId: string; redirect: string; state: string; verifier: string; scope: string; resource: string }): string {
  const u = new URL(as.authorize);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', p.clientId);
  u.searchParams.set('redirect_uri', p.redirect);
  u.searchParams.set('state', p.state);
  u.searchParams.set('code_challenge', pkceChallenge(p.verifier));
  u.searchParams.set('code_challenge_method', 'S256');
  // RFC 8707: the token is for this server and no other.
  u.searchParams.set('resource', p.resource);
  if (p.scope) u.searchParams.set('scope', p.scope);
  return u.toString();
}

/** What the app holds between sending the person to consent and their coming back: in a sealed cookie, never a row. */
export interface PendingConnect {
  pid: string;
  server: string;
  name: string;
  clientId: string;
  /** The authorization server's token endpoint: where the code is exchanged, and where the vault refreshes. */
  tokenUrl: string;
  verifier: string;
  state: string;
  redirect: string;
  exp: number;
}

/** Ten minutes to get through a consent screen. */
export const CONNECT_TTL_S = 600;

const mac = (key: Buffer, body: string) => createHmac('sha256', key).update(`copilot-account:${body}`).digest();

export function sealConnect(p: PendingConnect, key: Buffer): string {
  const body = Buffer.from(JSON.stringify(p)).toString('base64url');
  return `${body}.${mac(key, body).toString('base64url')}`;
}

/** The pending connect, if this server sealed it, it has not run out, and it is this person's. */
export function unsealConnect(token: unknown, key: Buffer, nowS: number, pid: string): PendingConnect | null {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const want = mac(key, body);
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  let p: PendingConnect;
  try { p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as PendingConnect; } catch { return null; }
  if (!p || typeof p.exp !== 'number' || p.exp <= nowS || p.pid !== pid) return null;
  return p;
}

/* ─── The credential ──────────────────────────────────────────────────────── */

/**
 * The tokens a server handed back, as the vault credential that holds them.
 * The refresh block is what lets the vault keep the account connected; without
 * one the account works until the token runs out, and the sheet says so.
 */
export function credentialFromTokens(p: Pick<PendingConnect, 'server' | 'name' | 'clientId' | 'tokenUrl'>, tokens: unknown, nowS: number):
  { ok: true; params: { display_name: string; auth: Record<string, unknown> }; refreshes: boolean } | { ok: false; why: string } {
  const t = obj(tokens);
  const access = s(t.access_token, 8000);
  if (!access) return { ok: false, why: s(t.error_description) ?? s(t.error) ?? 'the account did not hand back a token' };
  const expiresIn = typeof t.expires_in === 'number' && t.expires_in > 0 ? t.expires_in : null;
  const refresh = s(t.refresh_token, 8000);
  return {
    ok: true,
    refreshes: !!refresh,
    params: {
      display_name: p.name,
      auth: {
        type: 'mcp_oauth',
        mcp_server_url: p.server,
        access_token: access,
        ...(expiresIn ? { expires_at: new Date((nowS + expiresIn) * 1000).toISOString() } : {}),
        ...(refresh ? { refresh: { refresh_token: refresh, client_id: p.clientId, token_endpoint: p.tokenUrl, token_endpoint_auth: { type: 'none' } } } : {}),
      },
    },
  };
}

/** A pasted bearer token, for a server that takes one instead of OAuth. */
export function credentialFromBearer(server: string, name: string, token: string) {
  return { display_name: name, auth: { type: 'static_bearer', mcp_server_url: server, token } };
}

/** The accounts a session can use, as Managed Agents MCP declarations and toolsets that stop for the person's OK on every call. */
export function sessionMcp(accounts: Account[]) {
  return {
    mcp_servers: accounts.map((a) => ({ type: 'url' as const, name: a.slug, url: a.server })),
    toolsets: accounts.map((a) => ({
      type: 'mcp_toolset' as const,
      mcp_server_name: a.slug,
      // Every call, reads included. `auto` would let a call the server judges
      // safe go out under the person's name with nobody looking, which is what
      // invariant 4 and AUTHORITY.reach exist to prevent.
      default_config: { permission_policy: { type: 'always_ask' as const } },
    })),
  };
}
