import { executionsForActions, markSentManually } from '@/lib/copilot/execution';
import { loadHome } from '@/lib/copilot/store';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

/**
 * "I sent it." The user opened the pre-filled link in their own WhatsApp or
 * mail client and sent the message themselves. Records it exactly like an API
 * send so follow-ups, reply detection and metrics all still work.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { id } = await ctx.params;
  const body = await readJson(req);
  const exec = (await executionsForActions(auth.pid, [id]))[id];
  if (!exec) return fail('This action has no draft', 404);
  try {
    const result = await markSentManually(auth.pid, exec.id, {
      body: typeof body.body === 'string' ? body.body.slice(0, 4000) : undefined,
      subject: typeof body.subject === 'string' ? body.subject.slice(0, 200) : undefined,
    });
    return json({ ok: true, execution: result, home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not record', 400);
  }
}
