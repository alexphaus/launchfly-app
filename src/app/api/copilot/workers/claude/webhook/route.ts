// src/app/api/copilot/workers/claude/webhook/route.ts
// Where Anthropic says a Claude agent session changed.
//
// The payload is thin by design — an event type and a session id, never what
// happened — so this does one thing: verify it, answer at once, and read the
// session back (managed.ts syncSession), which acts on whatever is unanswered
// in the session's own record. A webhook is a hint, not a log: Anthropic tries
// three times and then drops it, so the nightly pass reads every live session
// back too, and a missed webhook costs a delay, never a job.
//
// Registered in the Claude Console (Manage → Webhooks) for the session.* types,
// with its signing secret in ANTHROPIC_WEBHOOK_SIGNING_KEY. It must be public
// HTTPS on 443 and must not redirect: a 3xx disables the endpoint.

import { after } from 'next/server';
import { budgetCents } from '@/lib/copilot/managedwire';
import { managedClient, managedKey, sessionCommission, syncSession } from '@/lib/copilot/managed';
import { loadCommissions } from '@/lib/copilot/store';
import { lastDispatch } from '@/lib/copilot/worklog';
import { commissionOwner, loadAccounts, loadWork } from '@/lib/copilot/workstore';
import { fail } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * The changes worth reading a session back for: it stopped, it waits on an
 * answer, it hit its cap, or its grader finished a round. Created, running and
 * renamed sessions have nothing in them to answer yet.
 */
const READ_ON = new Set([
  'session.status_idled', 'session.idled', 'session.requires_action', 'session.status_terminated',
  'session.budget_reached', 'session.outcome_evaluation_ended', 'session.thread_idled',
]);

/** Webhook ids already taken. Every retry carries the same id; a restart forgets, and the sync is safe to run twice. */
const seen: string[] = [];
const SEEN_MAX = 500;

async function readBack(sessionId: string): Promise<void> {
  const commissionId = await sessionCommission(sessionId);
  if (!commissionId) return;
  const pid = await commissionOwner(commissionId);
  if (!pid) return;
  const c = (await loadCommissions(pid, 50)).find((x) => x.id === commissionId);
  if (!c) return;
  const [{ log, unreadable }, acct] = await Promise.all([loadWork(pid, [c.id]), loadAccounts(pid)]);
  if (unreadable) throw new Error(`hand-over record unreadable: ${unreadable}`);
  // Only the session the job is with now. One the job moved on from (it ran
  // out of budget and a new one was opened) is history, not a reporter.
  if (lastDispatch(log, c.id)?.session !== sessionId) return;
  await syncSession(pid, c, sessionId, { log, accounts: acct.accounts, cents: budgetCents(c.budget_minutes, process.env) });
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_WEBHOOK_SIGNING_KEY;
  // Fail closed: an unverifiable webhook could be anybody asking this app to read a session.
  if (!key) return fail('ANTHROPIC_WEBHOOK_SIGNING_KEY is not set; refusing webhooks.', 503);
  if (!managedKey()) return fail('ANTHROPIC_API_KEY is not set.', 503);
  // The raw body, untouched: re-serialised JSON changes the bytes and breaks the signature.
  const body = await req.text();
  let event: ReturnType<ReturnType<typeof managedClient>['beta']['webhooks']['unwrap']>;
  try {
    event = managedClient().beta.webhooks.unwrap(body, { headers: Object.fromEntries(req.headers.entries()), key });
  } catch {
    return fail('Invalid signature', 400);
  }
  if (seen.includes(event.id)) return new Response(null, { status: 204 });
  seen.push(event.id);
  if (seen.length > SEEN_MAX) seen.splice(0, seen.length - SEEN_MAX);

  const type = event.data.type;
  if (READ_ON.has(type) && 'id' in event.data && typeof event.data.id === 'string') {
    const sessionId = event.data.id;
    // Answered first: Anthropic retries anything slow, and the read-back can take
    // a few calls. A failure here is retried by the nightly pass, which records
    // it on the job run where the crew shows it.
    after(async () => {
      await readBack(sessionId).catch((e: unknown) => console.error('[copilot/claude-webhook] read-back failed; the nightly pass retries it', sessionId, e));
    });
  }
  return new Response(null, { status: 204 });
}
