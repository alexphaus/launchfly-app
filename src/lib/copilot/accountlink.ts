// src/lib/copilot/accountlink.ts
// The fetching half of connecting an account (accounts.ts is the pure half):
// discovery, registration, the code exchange, and the vault the credential
// goes into. Every network answer is parsed by accounts.ts before it is used,
// and every failure comes back as a sentence the sheet can say.

import { hostState } from './linkcheck';
import { managedClient } from './managed';
import {
  ACCOUNT_CONNECTED, ACCOUNT_VAULT, authServerMetadataUrls, credentialFromTokens, parseAuthServerMetadata, parseRegistration, parseResourceMetadata,
  registrationBody, resourceMetadataUrls, slugFor, type Account, type AuthServer, type PendingConnect,
} from './accounts';
import { recordWork } from './workstore';

const T_MS = 8_000;
const MAX_HOPS = 3;

/** A test deployment may point accounts at a local stand-in; nothing else may. */
export const allowLocal = () => process.env.COPILOT_ACCOUNTS_ALLOW_LOCAL === '1';

/**
 * A fetch of an address that came from a person or from a server they named —
 * so held like the link checker's: https, a host whose DNS answer is not a
 * private network, and redirects followed by hand, each hop checked again, and
 * only for reads. Without this, "connect an account" is a way to make this
 * server request whatever sits on its own network.
 */
async function safeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let at = url;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const u = new URL(at);
    const local = allowLocal() && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
    if (!local) {
      if (u.protocol !== 'https:') throw new Error('only https addresses are used to sign in');
      const where = await hostState(u.hostname);
      if (where === 'private') throw new Error('that address points inside a private network');
      if (where !== 'ok') throw new Error('that address could not be found');
    }
    const r = await fetch(at, { ...init, redirect: 'manual', signal: AbortSignal.timeout(T_MS) });
    const next = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && next && (init.method ?? 'GET') === 'GET') {
      at = new URL(next, at).toString();
      continue;
    }
    return r;
  }
  throw new Error('too many redirects');
}

async function getJson(url: string): Promise<unknown | null> {
  try {
    const r = await safeFetch(url, { headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch {
    return null;
  }
}

/**
 * Who authorizes this MCP server, and with what scopes: its protected-resource
 * metadata at the well-known address, or the one its 401 names
 * (`WWW-Authenticate: Bearer resource_metadata="…"`, RFC 9728 §5.1).
 */
export async function discover(server: string): Promise<{ as: AuthServer; scopes: string[] } | { why: string }> {
  let prm: { servers: string[]; scopes: string[] } | null = null;
  for (const u of resourceMetadataUrls(server)) {
    prm = parseResourceMetadata(await getJson(u));
    if (prm) break;
  }
  if (!prm) {
    try {
      const r = await safeFetch(server, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{}' });
      const named = r.headers.get('www-authenticate')?.match(/resource_metadata="([^"]+)"/)?.[1];
      if (named) prm = parseResourceMetadata(await getJson(named));
    } catch { /* said below */ }
  }
  if (!prm) return { why: 'That address did not say how to sign in to it. If the service gives you a token for its MCP server, paste that instead.' };
  for (const issuer of prm.servers) {
    for (const u of authServerMetadataUrls(issuer)) {
      const as = parseAuthServerMetadata(await getJson(u), { allowLocal: allowLocal() });
      if (as) return { as, scopes: prm.scopes };
    }
  }
  return { why: 'Its sign-in server could not be read, or it does not support the secure kind of sign-in (PKCE) this app uses.' };
}

/** The app, registered with the account's sign-in server as a public client. */
export async function register(as: AuthServer, redirect: string): Promise<{ clientId: string } | { why: string }> {
  if (!as.register) return { why: 'That service does not let apps register themselves, so it cannot be connected this way. Paste a token instead, if it gives you one.' };
  try {
    const r = await safeFetch(as.register, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(registrationBody(redirect)) });
    const reg = parseRegistration(await r.json().catch(() => null));
    if (!r.ok || !reg) return { why: `Its sign-in server would not register this app (${r.status}).` };
    return reg;
  } catch (e) {
    return { why: `Its sign-in server did not answer: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** The code, exchanged for tokens at the token endpoint — PKCE, no client secret, the token bound to this server. */
export async function exchange(p: PendingConnect, code: string): Promise<unknown> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code', code, redirect_uri: p.redirect, client_id: p.clientId, code_verifier: p.verifier, resource: p.server,
  });
  const r = await safeFetch(p.tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body });
  return r.json().catch(() => ({ error: `the sign-in server answered ${r.status}` }));
}

/** The person's vault: theirs alone, made the first time they connect anything. */
export async function ensureVault(pid: string, existing: string | null): Promise<string> {
  if (existing) return existing;
  const v = await managedClient().beta.vaults.create({ display_name: 'Copilot: one person\'s accounts' });
  await recordWork(pid, ACCOUNT_VAULT, { vault: v.id, commission_id: null });
  return v.id;
}

/**
 * The credential, into the vault, and the account recorded — no token on this
 * side: the vault holds it, write-only, and injects it outside the agent's
 * sandbox. Returns the account as the sheet lists it.
 */
export async function keep(pid: string, vault: string, params: { display_name: string; auth: Record<string, unknown> }, a: { server: string; name: string; how: 'oauth' | 'token'; taken: ReadonlySet<string>; refreshes: boolean }): Promise<Account> {
  const cred = await managedClient().beta.vaults.credentials.create(vault, params as unknown as Parameters<ReturnType<typeof managedClient>['beta']['vaults']['credentials']['create']>[1]);
  const slug = slugFor(a.name, a.taken);
  await recordWork(pid, ACCOUNT_CONNECTED, { id: cred.id, vault, server: a.server, name: a.name, slug, how: a.how, refreshes: a.refreshes, commission_id: null });
  return { id: cred.id, vault, name: a.name, server: a.server, slug, how: a.how, at: new Date().toISOString() };
}

export { credentialFromTokens };
