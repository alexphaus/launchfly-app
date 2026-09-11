// src/app/api/copilot/watch/sources/route.ts
// Add, edit and remove the places this profile watches.
//
// The URL is normalised here rather than on the client, so a source added from
// the sheet, from onboarding or from a script all end up the same row — and so
// "r/forhire" becomes a feed URL exactly once, in code that is under test.

import { deleteWatchSource, loadHome, loadWatchSources, saveWatchSource } from '@/lib/copilot/store';
import { normalizeSourceUrl } from '@/lib/copilot/watch/catalogue';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  return json({ ok: true, sources: await loadWatchSources(auth.pid) });
}

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);

  const id = typeof b.id === 'string' ? b.id : undefined;
  const status = b.status === 'active' || b.status === 'paused' ? b.status : undefined;
  const label = typeof b.label === 'string' ? b.label.trim().slice(0, 80) : undefined;
  const intent = typeof b.intent === 'string' ? b.intent.trim().slice(0, 200) : undefined;

  try {
    // Editing an existing row: never re-normalise, because the stored URL is
    // already the fetchable one and running it through again would rewrite a
    // feed URL the user has since corrected by hand.
    if (id) {
      await saveWatchSource(auth.pid, { id, label, intent, status });
      return json({ ok: true, home: await loadHome(auth.pid) });
    }

    const raw = typeof b.url === 'string' ? b.url : '';
    const norm = normalizeSourceUrl(raw);
    if (!norm) {
      return fail(raw.includes('youtube.com/@')
        ? 'A YouTube @handle does not carry the channel id. Open the channel, copy the /channel/UC… URL, and paste that.'
        : 'That does not look like a link. Paste a feed URL, or a subreddit like r/forhire.');
    }
    // 'page' is saved but never fetched — the watcher only runs feeds. Saying so
    // is the honest answer; watching it badly is not.
    await saveWatchSource(auth.pid, { url: norm.url, label: label || norm.label, intent, kind: norm.kind });
    // The whole home, as every other mutation does: adding the first source can
    // change why the Moves list is empty, and a stale movesBlocked would tell
    // somebody nothing is plugged in seconds after they plugged something in.
    return json({ ok: true, home: await loadHome(auth.pid), note: norm.note ?? null });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not save that source');
  }
}

export async function DELETE(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('Which source?');
  await deleteWatchSource(auth.pid, id);
  return json({ ok: true, home: await loadHome(auth.pid) });
}
