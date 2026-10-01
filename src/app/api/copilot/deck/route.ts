// src/app/api/copilot/deck/route.ts
// The Swipe tab (lib/copilot/deck.ts, deckstore.ts). One card at a time:
//
// POST action=draft   kind, id, via             the message for the card
//      action=reach   kind, id, via, body, subject  the right swipe
//      action=sent    id (the draft's action), via, body, subject   back from their app: it went
//      action=unsent  id                         back from their app: it did not
//      action=posted  kind, id, via              a reply posted, or sent through a site
//      action=skip    kind, id                   not for me
//
// None of them answers with the home payload. A swipe is a flick, and fifty
// reads behind each one is how a deck starts to feel like a form; the tab asks
// for the home once, after the last swipe in a burst.
import { DeckRefusal, postedDeckCard, reachDeckCard, sentDeckCard, skipDeckCard, unsentDeckCard, writeDeckDraft, type DeckKind } from '@/lib/copilot/deckstore';
import type { ReachVia } from '@/lib/copilot/deck';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

const KINDS: DeckKind[] = ['business', 'draft', 'find'];
const VIAS: ReachVia[] = ['whatsapp', 'sms', 'call', 'email', 'site', 'post'];
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  const kind = KINDS.find((k) => k === b.kind) ?? null;
  const via = VIAS.find((v) => v === b.via) ?? null;
  const id = str(b.id);
  if (!id) return fail('Which card?');
  try {
    switch (b.action) {
      case 'draft':
        if (!kind || !via) return fail('Which card, and which way?');
        return json({ ok: true, draft: await writeDeckDraft(auth.pid, kind, id, via) });
      case 'reach': {
        if (!kind || !via) return fail('Which card, and which way?');
        const body = typeof b.body === 'string' ? b.body : '';
        return json({ ok: true, reach: await reachDeckCard(auth.pid, kind, id, { via, body, subject: str(b.subject) }) });
      }
      case 'sent':
        if (!via) return fail('Which way did it go?');
        await sentDeckCard(auth.pid, id, { via, body: typeof b.body === 'string' ? b.body : undefined, subject: str(b.subject) });
        return json({ ok: true });
      case 'unsent':
        await unsentDeckCard(auth.pid, id);
        return json({ ok: true });
      case 'posted':
        if (!kind || !via) return fail('Which card, and which way?');
        await postedDeckCard(auth.pid, kind, id, via);
        return json({ ok: true });
      case 'skip':
        if (!kind) return fail('Which card?');
        await skipDeckCard(auth.pid, kind, id);
        return json({ ok: true });
      default:
        return fail('Unknown action');
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not do that.', e instanceof DeckRefusal ? 400 : 500);
  }
}
