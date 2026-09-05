import { cancelExecution, executionsForActions, sendExecution } from '@/lib/copilot/execution';
import { loadHome } from '@/lib/copilot/store';
import { rateLimit } from '@/lib/copilot/limits';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Approve and send the draft attached to an action. Body may carry edited text. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const rl = await rateLimit(`copilot:send:${auth.pid}`, 40, 86400);
  if (!rl.ok) return fail('You have sent 40 messages today. That is the daily cap — it protects your number from being flagged.', 429);
  const { id } = await ctx.params;
  const body = await readJson(req);
  const exec = (await executionsForActions(auth.pid, [id]))[id];
  if (!exec) return fail('This action has no send-ready draft', 404);
  try {
    const result = await sendExecution(auth.pid, exec.id, {
      body: typeof body.body === 'string' ? body.body.slice(0, 4000) : undefined,
      subject: typeof body.subject === 'string' ? body.subject.slice(0, 200) : undefined,
    });
    return json({ ok: result.approval_state === 'sent', execution: result, home: await loadHome(auth.pid) }, result.approval_state === 'sent' ? 200 : 502);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Send failed', 400);
  }
}

/** Cancel a draft so it never sends. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { id } = await ctx.params;
  const exec = (await executionsForActions(auth.pid, [id]))[id];
  if (!exec) return fail('Not found', 404);
  await cancelExecution(auth.pid, exec.id);
  return json({ ok: true });
}
