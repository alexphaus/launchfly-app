import { runBrief } from '@/lib/copilot/brief';
import { addContextItem, logEvent } from '@/lib/copilot/store';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 90;

/** "Tell the copilot": free text becomes a context item the agent sees next run. */
export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const body = await readJson(req);
  const content = typeof body.content === 'string' ? body.content.trim().slice(0, 2000) : '';
  if (!content) return fail('Write something first');
  const kind = ['fact', 'constraint', 'preference', 'metric', 'event'].includes(body.kind as string) ? (body.kind as string) : 'fact';
  const item = await addContextItem(auth.pid, { source: 'note', kind, content });
  await logEvent(auth.pid, 'note_added', { context_item_id: item.id, kind });
  let regenerated = false;
  if (body.regenerate === true) {
    try { await runBrief(auth.pid, { reason: 'note' }); regenerated = true; } catch (e) { console.error('[copilot] regenerate after note failed', e); }
  }
  return json({ ok: true, item, regenerated });
}
