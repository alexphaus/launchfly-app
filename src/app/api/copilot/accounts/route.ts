// src/app/api/copilot/accounts/route.ts
// The person's own accounts: list, start connecting one, give one a token, remove one.
//
// A connect is two legs. This route finds who signs the account in (its MCP
// server's metadata), registers the app there, seals the PKCE verifier into a
// short-lived cookie and answers with the consent screen's address; the
// callback route finishes it. No token ever passes through this app's
// database: the credential goes straight into the person's vault at Anthropic.

import { NextResponse } from 'next/server';
import { ACCOUNT_REMOVED, CONNECT_TTL_S, MAX_ACCOUNTS, authorizeUrl, credentialFromBearer, mcpUrlOk, pkceVerifier, sealConnect } from '@/lib/copilot/accounts';
import { allowLocal, discover, ensureVault, keep, register } from '@/lib/copilot/accountlink';
import { registry } from '@/lib/copilot/hands';
import { managedClient } from '@/lib/copilot/managed';
import { randomId } from '@/lib/copilot/oauth';
import { accountsKey } from '@/lib/copilot/session';
import { loadHome } from '@/lib/copilot/store';
import { loadAccounts, recordWork } from '@/lib/copilot/workstore';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CONNECT_COOKIE = 'cp_acct';

const origin = () => (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');

export async function GET() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const a = await loadAccounts(auth.pid);
  return json({ ok: true, accounts: a.accounts.map((x) => ({ id: x.id, name: x.name, server: x.server, how: x.how, at: x.at })), unreadable: a.unreadable });
}

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  // Invariant 7: an account is connected only where something can send through it.
  if (!registry().workers.some((w) => w.via === 'managed')) {
    return fail('Connecting an account needs the Claude agent on this server: it is what sends through it.');
  }
  const current = await loadAccounts(auth.pid);
  if (current.unreadable) return fail(`Your accounts could not be read just now: ${current.unreadable}`);

  try {
    if (b.action === 'remove') {
      const a = current.accounts.find((x) => x.id === b.id);
      if (!a) return fail('No such account.');
      // Archived at the vault first: the record says removed only once nothing
      // can go out from it any more.
      await managedClient().beta.vaults.credentials.archive(a.id, { vault_id: a.vault });
      await recordWork(auth.pid, ACCOUNT_REMOVED, { id: a.id });
      return json({ ok: true, home: await loadHome(auth.pid) });
    }

    const server = typeof b.server === 'string' ? b.server.trim() : '';
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 40) : '';
    if (!mcpUrlOk(server, { allowLocal: allowLocal() })) return fail('That needs to be the account\'s MCP server address, starting https://.');
    if (!name) return fail('Give it a name you will recognise, like "My Gmail".');
    if (current.accounts.length >= MAX_ACCOUNTS) return fail(`${MAX_ACCOUNTS} accounts is the most: remove one first.`);
    if (current.accounts.some((x) => x.server === server)) return fail('That account is already connected.');
    const taken = new Set(current.accounts.map((x) => x.slug));

    if (b.action === 'token') {
      const token = typeof b.token === 'string' ? b.token.trim() : '';
      if (token.length < 8 || token.length > 8000) return fail('That does not look like a token.');
      const vault = await ensureVault(auth.pid, current.vault);
      await keep(auth.pid, vault, credentialFromBearer(server, name, token), { server, name, how: 'token', taken, refreshes: false });
      return json({ ok: true, home: await loadHome(auth.pid) });
    }

    if (b.action !== 'start') return fail('Unknown action');
    if (!origin()) return fail('NEXT_PUBLIC_APP_URL is not set, so the account has nowhere to send you back to.');
    const redirect = `${origin()}/api/copilot/accounts/callback`;
    const found = await discover(server);
    if ('why' in found) return fail(found.why);
    const reg = await register(found.as, redirect);
    if ('why' in reg) return fail(reg.why);
    const state = randomId();
    const verifier = pkceVerifier();
    const sealed = sealConnect({
      pid: auth.pid, server, name, clientId: reg.clientId, tokenUrl: found.as.token, verifier, state, redirect,
      exp: Math.floor(Date.now() / 1000) + CONNECT_TTL_S,
    }, accountsKey());
    const res = NextResponse.json({ ok: true, go: authorizeUrl(found.as, { clientId: reg.clientId, redirect, state, verifier, scope: found.scopes.join(' '), resource: server }) });
    res.cookies.set(CONNECT_COOKIE, sealed, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      path: '/api/copilot/accounts', maxAge: CONNECT_TTL_S,
    });
    return res;
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not connect that');
  }
}
