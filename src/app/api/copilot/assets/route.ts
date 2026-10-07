// src/app/api/copilot/assets/route.ts
// The business's assets: offer, demo, script, landing page, workflow, price
// test (lib/copilot/assets.ts). Every write is a version or a put-away; nothing
// is edited in place, so the history is the list of what was written.
//
//   GET  ?id=        one asset whole, every version with its body
//   POST add         a new asset, by you: a link, a text, or both
//        version     its next version, by you
//        draft       a draft by AI: a new asset, or the next version of one
//        retire      put it away; restore brings it back
//        adopt       make a version of the offer the AI wrote your offer
//        proof       make a demo's link the proof your messages carry
//
// The offer itself is changed through /api/copilot/offer, where every draft is
// rewritten from it; adopt and proof go through the same function for that
// reason.

import { randomUUID } from 'node:crypto';
import {
  ASSET_RESTORED, ASSET_RETIRED, ASSET_VERSION, DRAFT_ASK_MAX, OFFER_ASSET,
  assetsFromEvents, isAssetKind, normalizeAssetInput, offerFields,
} from '@/lib/copilot/assets';
import { ProofModelError, ProofRefusal, draftAsset } from '@/lib/copilot/proofai';
import { getProfile, insertAssetEvent, loadAssetEvents, loadHome, setOffer } from '@/lib/copilot/store';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
// A draft waits on a model for up to 25s, and an adopted offer rewrites the drafts waiting to be sent.
export const maxDuration = 90;

const str = (v: unknown, max = 64) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export async function GET(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const id = str(new URL(req.url).searchParams.get('id'));
  if (!id) return fail('Which asset?');
  const [profile, events] = await Promise.all([getProfile(auth.pid), loadAssetEvents(auth.pid)]);
  if (!profile) return fail('Not found', 404);
  // A read that failed is said, not answered with an asset that has no versions.
  if (events.unreadable) return fail(`Could not read your assets just now: ${events.unreadable}`, 503);
  const asset = assetsFromEvents(events.rows, profile.offer).find((a) => a.id === id);
  if (!asset) return fail('That asset is gone.', 404);
  return json({ ok: true, asset });
}

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  const home = await loadHome(auth.pid);
  if (!home) return fail('Not found', 404);
  // Writing a version on top of a history that could not be read would number it wrong.
  if (home.assets?.unreadable) return fail(`Your assets could not be read just now, so nothing new is written over them: ${home.assets.unreadable}`, 503);
  const assets = home.assets?.assets ?? [];
  const betId = str(b.bet);
  if (betId && !(home.lab?.bets ?? []).some((v) => v.bet.id === betId)) return fail('That test is not in your record.');

  try {
    switch (b.action) {
      case 'add': {
        const v = normalizeAssetInput(obj(b.asset));
        if (!v.ok) return fail(v.error);
        const id = randomUUID();
        await insertAssetEvent(auth.pid, ASSET_VERSION, { asset: id, kind: v.value.kind, by: 'you', title: v.value.title, body: v.value.body, url: v.value.url, note: v.value.note, bet: betId });
        return json({ ok: true, id, home: await loadHome(auth.pid) });
      }
      case 'version': {
        const target = assets.find((a) => a.id === str(b.id));
        if (!target) return fail('That asset is gone.');
        if (target.id === OFFER_ASSET) return fail('The offer is changed on its own sheet, where every draft is rewritten from it.');
        const v = normalizeAssetInput({ ...obj(b.asset), title: str(obj(b.asset).title, 80) ?? target.title }, target.kind);
        if (!v.ok) return fail(v.error);
        await insertAssetEvent(auth.pid, ASSET_VERSION, { asset: target.id, kind: target.kind, by: 'you', title: v.value.title, body: v.value.body, url: v.value.url, note: v.value.note, bet: betId });
        return json({ ok: true, id: target.id, home: await loadHome(auth.pid) });
      }
      case 'draft': {
        const kind = isAssetKind(b.kind) ? b.kind : undefined;
        const r = await draftAsset(auth.pid, { kind, asset: str(b.id) ?? undefined, bet: betId ?? undefined, ask: str(b.ask, DRAFT_ASK_MAX) ?? undefined });
        return json({ ok: true, id: r.asset, version: r.version, home: await loadHome(auth.pid) });
      }
      case 'retire':
      case 'restore': {
        const target = assets.find((a) => a.id === str(b.id));
        if (!target) return fail('That asset is gone.');
        if (target.id === OFFER_ASSET) return fail('The offer cannot be put away: every message is written from it.');
        await insertAssetEvent(auth.pid, b.action === 'retire' ? ASSET_RETIRED : ASSET_RESTORED, { asset: target.id });
        return json({ ok: true, id: target.id, home: await loadHome(auth.pid) });
      }
      case 'adopt': {
        const offerAsset = assets.find((a) => a.id === OFFER_ASSET);
        const version = offerAsset?.versions.find((v) => v.id === str(b.version));
        if (!version?.offer?.sells) return fail('That version of the offer is gone.');
        // The person's way buyers find them is theirs, not the model's: kept as it is.
        const { rewritten } = await setOffer(auth.pid, { ...offerFields(version.offer), found_by: home.profile.offer?.found_by }, {
          by: version.by, note: `Made your offer from v${version.n}`, bet: version.bet, model: version.model,
        });
        return json({ ok: true, rewritten, home: await loadHome(auth.pid) });
      }
      case 'proof': {
        const target = assets.find((a) => a.id === str(b.id));
        const url = target?.current.url;
        if (!target || target.kind !== 'demo' || !url) return fail('Only a demo with a link can be the proof your messages carry.');
        const { rewritten } = await setOffer(auth.pid, { ...home.profile.offer, proof_url: url }, { note: `Proof link from the demo "${target.title}"` });
        return json({ ok: true, rewritten, home: await loadHome(auth.pid) });
      }
      default:
        return fail('Unknown action');
    }
  } catch (e) {
    if (e instanceof ProofRefusal) return fail(e.message);
    if (e instanceof ProofModelError) return fail(e.message, 502);
    return fail(e instanceof Error ? e.message : 'Could not save that', 500);
  }
}
