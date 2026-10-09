// src/app/api/copilot/page/route.ts
// Your page, from the app's side (lib/copilot/livepage.ts): put a landing page's
// version online with what it asks for, or take it offline. Signed in only —
// the page is the account's, and its address is the one in the payload.
//
//   POST publish   { asset, n?, ask? }  that version online; the ask the page last
//                                       had is kept when none is sent
//        off       {}                   offline: the address says it is not online

import { assetsFromEvents } from '@/lib/copilot/assets';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';
import { PAGE_LIVE, PAGE_OFF, lastAskOf, livePageOf, normalizeAsk, publishRefusal } from '@/lib/copilot/livepage';
import { getProfile, insertPageEvent, loadAssetEvents, loadHome, loadPageState } from '@/lib/copilot/store';

export const runtime = 'nodejs';

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  try {
    // Read before either write: a page whose state cannot be read is not one to change blind.
    const state = await loadPageState(auth.pid);
    const live = livePageOf(state);
    if (b.action === 'off') {
      if (!live) return fail('Your page is not online.');
      await insertPageEvent(auth.pid, PAGE_OFF, {});
      return json({ ok: true, home: await loadHome(auth.pid) });
    }
    if (b.action !== 'publish') return fail('Unknown action');
    const [profile, events] = await Promise.all([getProfile(auth.pid), loadAssetEvents(auth.pid)]);
    if (!profile) return fail('Not found', 404);
    if (events.unreadable) return fail(`Your assets could not be read just now: ${events.unreadable}`, 503);
    // Whole, every body: the home payload trims older versions' text.
    const asset = assetsFromEvents(events.rows, profile.offer).find((a) => a.id === b.asset) ?? null;
    const n = typeof b.n === 'number' && Number.isInteger(b.n) ? b.n : asset?.current.n ?? null;
    const version = asset && n != null ? asset.versions.find((v) => v.n === n) ?? null : null;
    const refused = publishRefusal(asset, version);
    if (refused) return fail(refused);
    // A new version goes up with the button the page last had — online now, or
    // before it was taken offline — unless a new one is sent.
    const last = live?.ask ?? lastAskOf(state);
    const ask = b.ask != null ? normalizeAsk(obj(b.ask)) : last ? { ok: true as const, value: last } : null;
    if (!ask) return fail('What should the page ask for: WhatsApp, email or a link?');
    if (!ask.ok) return fail(ask.error);
    await insertPageEvent(auth.pid, PAGE_LIVE, { asset: asset!.id, n: version!.n, ask: ask.value });
    return json({ ok: true, home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not save that', 500);
  }
}
