// src/lib/copilot/connector.ts
// The Claude connector's server side: the grant ledger, codes typed in from the
// app, and the check every call to the MCP server makes.
//
// The ledger is copilot_events rows (oauth.ts MCP_EVENTS), kept small on
// purpose: one row when a connection is made, one for the refresh token it is
// on (replaced, not added to, on each refresh), one when it is ended, and one
// for its last read, rewritten in place. Rows that grew with every call would
// crowd the events other features read by recency (store.ts recentEvents).
//
// Every failure says what failed. A read that cannot be checked against the
// ledger is refused rather than let through (a connection the person ended must
// not keep reading), and a read that cannot be recorded is not made: what Claude
// reads is listed in the app, and a read the list cannot show is one the person
// cannot see (invariant 13).

import { copilotDb, describeDbError } from './db';
import { rateLimit } from './limits';
import { oauthKey } from './session';
import {
  MCP_GRANT, MCP_PAIR, MCP_REFRESH, MCP_REVOKE, MCP_SEEN, PAIR_TTL_S,
  accessOf, askerOf, authenticateClient, checkCodeGrant, checkRefreshGrant, clientRef, connectionsOf, grantLive,
  nextRefreshJti, normalizePair, pairHash, randomId, refreshExp, refreshStep, sameResource, newPairCode, tokenSet, unseal,
  type Connection, type LedgerRow, type RefreshRow, type TokenError, type TokenSet,
} from './oauth';

const nowS = () => Math.floor(Date.now() / 1000);

/** Redirect addresses the operator allows beyond Claude's and loopback, exact, comma-separated (COPILOT_OAUTH_REDIRECTS). */
export function extraRedirects(): string[] {
  return (process.env.COPILOT_OAUTH_REDIRECTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

/* ─── The ledger ──────────────────────────────────────────────────────────── */

const LEDGER = [MCP_GRANT, MCP_REFRESH, MCP_REVOKE, MCP_SEEN];

/** The ledger's rows for a person, or for one of their grants. Throws with the reason: a ledger nobody can read must not read as empty. */
export async function loadLedger(pid: string, grant?: string): Promise<LedgerRow[]> {
  let q = copilotDb().from('copilot_events').select('id, event_type, payload, created_at')
    .eq('profile_id', pid).in('event_type', LEDGER);
  if (grant) q = q.filter('payload->>grant', 'eq', grant);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error(describeDbError(error, 'Could not read your connections.'));
  return (data ?? []) as LedgerRow[];
}

async function insertRows(rows: Array<{ profile_id: string; event_type: string; payload: Record<string, unknown> }>, fallback: string): Promise<void> {
  const { error } = await copilotDb().from('copilot_events').insert(rows);
  if (error) throw new Error(describeDbError(error, fallback));
}

export async function listConnections(pid: string): Promise<Connection[]> {
  return connectionsOf(await loadLedger(pid));
}

/** Ends a connection. Its tokens stop working on their next call: every call checks the ledger. */
export async function revokeGrant(pid: string, grant: string, why: 'you' | 'client' | 'code_reuse' | 'refresh_reuse'): Promise<void> {
  await insertRows([{ profile_id: pid, event_type: MCP_REVOKE, payload: { grant, why } }], 'Could not disconnect that.');
}

/* ─── Codes typed in from the app ─────────────────────────────────────────── */

/** Codes a person can show in an hour. More is somebody pressing the button in a loop. */
const PAIR_PER_HOUR = 12;
/** Guesses one network gets in ten minutes: a code is one of 30^8, so this is a wall, not a speed bump. */
export const PAIR_TRIES = 10;

/**
 * A code for signing Claude in from a computer this phone is not: shown in the
 * app, typed on the consent screen, good once for ten minutes. Kept as a keyed
 * hash; the ones that ran out are cleared as a new one is made.
 */
export async function createPairCode(pid: string): Promise<{ code: string; expiresAt: string }> {
  const rl = await rateLimit(`copilot:mcp-pair:${pid}`, PAIR_PER_HOUR, 3600);
  if (!rl.ok) throw new Error(`${PAIR_PER_HOUR} codes shown this hour. Use the last one, or wait.`);
  const db = copilotDb();
  const cut = new Date(Date.now() - PAIR_TTL_S * 1000).toISOString();
  const old = await db.from('copilot_events').delete().eq('profile_id', pid).eq('event_type', MCP_PAIR).lt('created_at', cut);
  if (old.error) throw new Error(describeDbError(old.error, 'Could not make a code.'));
  const code = newPairCode();
  const exp = nowS() + PAIR_TTL_S;
  await insertRows([{ profile_id: pid, event_type: MCP_PAIR, payload: { hash: pairHash(code.replace('-', ''), oauthKey()), exp } }], 'Could not make a code.');
  return { code, expiresAt: new Date(exp * 1000).toISOString() };
}

/**
 * The account a typed code belongs to, spending it. The delete is the claim:
 * of two tabs submitting one code, one deletes the row and the other finds it
 * gone, so a code works once even when tapped twice.
 */
export async function claimPairCode(typed: unknown): Promise<string | null> {
  const code = normalizePair(typed);
  if (!code) return null;
  const db = copilotDb();
  const { data, error } = await db.from('copilot_events').select('id, profile_id, payload')
    .eq('event_type', MCP_PAIR).filter('payload->>hash', 'eq', pairHash(code, oauthKey())).limit(5);
  if (error) throw new Error(describeDbError(error, 'Could not check that code.'));
  for (const row of (data ?? []) as Array<{ id: number; profile_id: string; payload: { exp?: number } }>) {
    if (typeof row.payload?.exp !== 'number' || row.payload.exp <= nowS()) continue;
    const del = await db.from('copilot_events').delete().eq('id', row.id).select('id');
    if (del.error) throw new Error(describeDbError(del.error, 'Could not check that code.'));
    if (del.data?.length) return row.profile_id;
  }
  return null;
}

/* ─── The token endpoint ──────────────────────────────────────────────────── */

export type Exchange = { ok: true; body: TokenSet } | { ok: false; err: TokenError };

const serverError = (e: unknown): Exchange => ({ ok: false, err: { status: 500, error: 'server_error', description: e instanceof Error ? e.message : String(e) } });

/**
 * A code for tokens. The grant a code starts is named by the code, so a code
 * swapped twice finds its grant already made — and ends it, as RFC 6749 asks of
 * a code used twice, since one of the two is not who it was sent to.
 */
export async function exchangeCode(form: Record<string, unknown>, basic: { id: string; secret: string } | null): Promise<Exchange> {
  const key = oauthKey();
  const auth = authenticateClient(form, basic, key);
  if (!auth.ok) return auth;
  const checked = checkCodeGrant(form, auth.client, { master: key, nowS: nowS() });
  if (!checked.ok) return checked;
  const code = checked.code;
  try {
    const rows = await loadLedger(code.sub, code.jti);
    if (rows.some((r) => r.event_type === MCP_GRANT)) {
      await revokeGrant(code.sub, code.jti, 'code_reuse');
      return { ok: false, err: { status: 400, error: 'invalid_grant', description: 'This code was already used, so the connection it made has been ended. Connect again.' } };
    }
    const asker = askerOf(code.ru);
    const refresh = { jti: randomId(), exp: refreshExp(nowS()) };
    // One insert, two rows: a grant with no refresh token behind it would be a
    // connection that dies at its first refresh for no reason anyone could see.
    await insertRows([
      { profile_id: code.sub, event_type: MCP_GRANT, payload: { grant: code.jti, name: asker.name, host: asker.host, client: auth.client.n, scope: code.sc } },
      { profile_id: code.sub, event_type: MCP_REFRESH, payload: { grant: code.jti, jti: refresh.jti, exp: refresh.exp } },
    ], 'Could not save the connection.');
    return { ok: true, body: tokenSet({ sub: code.sub, grant: code.jti, scope: code.sc, aud: code.res, cid: clientRef(auth.client.id) }, refresh, { master: key, nowS: nowS() }) };
  } catch (e) {
    return serverError(e);
  }
}

/** A refresh token for new tokens, rotated (oauth.ts refreshStep). */
export async function exchangeRefresh(form: Record<string, unknown>, basic: { id: string; secret: string } | null): Promise<Exchange> {
  const key = oauthKey();
  const auth = authenticateClient(form, basic, key);
  if (!auth.ok) return auth;
  const checked = checkRefreshGrant(form, auth.client, { master: key, nowS: nowS() });
  if (!checked.ok) return checked;
  const rt = checked.rt;
  const grant = { sub: rt.sub, grant: rt.g, scope: rt.sc, aud: rt.aud, cid: rt.cid };
  try {
    const rows = await loadLedger(rt.sub, rt.g);
    if (!grantLive(rows, rt.g)) return { ok: false, err: { status: 400, error: 'invalid_grant', description: 'This connection was ended in the app. Connect again.' } };
    const refreshRows: RefreshRow[] = rows
      .filter((r) => r.event_type === MCP_REFRESH && typeof r.payload.jti === 'string' && typeof r.payload.exp === 'number')
      .map((r) => ({ id: r.id, jti: r.payload.jti as string, exp: r.payload.exp as number, at: r.created_at }));
    const step = refreshStep(refreshRows, rt.jti, nextRefreshJti(rt.jti, key), { nowS: nowS() });
    if (step.kind === 'reuse') {
      await revokeGrant(rt.sub, rt.g, 'refresh_reuse');
      return { ok: false, err: { status: 400, error: 'invalid_grant', description: 'This refresh token was already replaced, so the connection has been ended to be safe. Connect again.' } };
    }
    if (step.kind === 'rotate') {
      // The successor first, then the old one gone: a refresh racing this one
      // finds either the old row or the new, never neither.
      if (step.insert) await insertRows([{ profile_id: rt.sub, event_type: MCP_REFRESH, payload: { grant: rt.g, jti: step.next.jti, exp: step.next.exp } }], 'Could not refresh the connection.');
      const del = await copilotDb().from('copilot_events').delete().eq('profile_id', rt.sub).in('id', step.remove);
      if (del.error) throw new Error(describeDbError(del.error, 'Could not refresh the connection.'));
    }
    return { ok: true, body: tokenSet(grant, step.next, { master: key, nowS: nowS() }) };
  } catch (e) {
    return serverError(e);
  }
}

/**
 * RFC 7009. A token that is not valid, or not this client's, revokes nothing,
 * and the answer is the same 200 either way, as the RFC asks: a client learns
 * nothing about tokens it does not hold.
 */
export async function revokeToken(form: Record<string, unknown>, basic: { id: string; secret: string } | null): Promise<{ ok: true } | { ok: false; err: TokenError }> {
  const key = oauthKey();
  const auth = authenticateClient(form, basic, key);
  if (!auth.ok) return auth;
  const access = accessOf(form.token, key, nowS());
  const refresh = access ? null : unseal<{ sub: string; g: string; cid: string }>('cpr', form.token, key, nowS());
  const t = access ?? refresh;
  if (!t || t.cid !== clientRef(auth.client.id)) return { ok: true };
  try {
    const rows = await loadLedger(t.sub, t.g);
    if (grantLive(rows, t.g)) await revokeGrant(t.sub, t.g, 'client');
    return { ok: true };
  } catch (e) {
    return { ok: false, err: { status: 503, error: 'temporarily_unavailable', description: e instanceof Error ? e.message : String(e) } };
  }
}

/* ─── Each call to the MCP server ─────────────────────────────────────────── */

export type CallAuth =
  | { ok: true; pid: string; grant: string; scope: string }
  /** 401: Claude refreshes or asks the person to connect again. */
  | { ok: false; status: 401; description: string }
  /** 503: the ledger could not be read, so nothing is let through — and Claude is not sent to sign in again for a database's sake. */
  | { ok: false; status: 503; description: string };

export async function authorizeCall(authorization: string | null, resource: string): Promise<CallAuth> {
  const m = authorization?.match(/^Bearer\s+(\S+)\s*$/i);
  if (!m) return { ok: false, status: 401, description: 'Sign in to read this record.' };
  const t = accessOf(m[1], oauthKey(), nowS());
  if (!t) return { ok: false, status: 401, description: 'The access token is not valid or has expired.' };
  if (!sameResource(t.aud, resource)) return { ok: false, status: 401, description: 'The access token is for another server.' };
  let rows: LedgerRow[];
  try {
    rows = await loadLedger(t.sub, t.g);
  } catch (e) {
    return { ok: false, status: 503, description: e instanceof Error ? e.message : String(e) };
  }
  if (!grantLive(rows, t.g)) return { ok: false, status: 401, description: 'This connection was ended in the app. Connect again.' };
  return { ok: true, pid: t.sub, grant: t.g, scope: t.sc };
}

/**
 * The connection's last read, rewritten in place: when, which tool, how many
 * reads so far, and the last failure. Throws when it cannot be written, and the
 * caller does not read — the list in the app is the person's only view of what
 * Claude has read.
 */
export async function markSeen(pid: string, grant: string, tool: string, error: string | null): Promise<void> {
  const db = copilotDb();
  const { data, error: readError } = await db.from('copilot_events').select('id, payload')
    .eq('profile_id', pid).eq('event_type', MCP_SEEN).filter('payload->>grant', 'eq', grant)
    .order('created_at', { ascending: false }).limit(1);
  if (readError) throw new Error(describeDbError(readError, 'Could not record this read.'));
  const row = (data ?? [])[0] as { id: number; payload: { n?: number } } | undefined;
  const at = new Date().toISOString();
  if (row) {
    // A failure is the same read again, said: the count does not go up twice.
    const n = (typeof row.payload?.n === 'number' ? row.payload.n : 0) + (error ? 0 : 1);
    const up = await db.from('copilot_events').update({ payload: { grant, at, tool, n, error } }).eq('id', row.id);
    if (up.error) throw new Error(describeDbError(up.error, 'Could not record this read.'));
    return;
  }
  await insertRows([{ profile_id: pid, event_type: MCP_SEEN, payload: { grant, at, tool, n: error ? 0 : 1, error } }], 'Could not record this read.');
}
