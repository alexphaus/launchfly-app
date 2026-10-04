// src/app/api/copilot/lab/route.ts
// The Lab's writes: open a bet, call one off, log a conversation, forget one,
// and answer the checkpoint. Each is validated by lib/copilot/lab.ts and stored
// as an event. A verdict is never posted here — there is no "mark it passed" —
// because it is computed from the rows on every load (invariant 10's reasoning:
// a bet the person could pass by tapping would be graded by the one person
// most hoping it passes).

import { todayIso } from '@/lib/copilot/db';
import { LAB_BET, LAB_CHECKPOINT, LAB_STOP, LAB_TALK, NOTE_MAX, betPrice, normalizeBet, normalizeCheckpoint, normalizeTalk } from '@/lib/copilot/lab';
import { salesCurrency } from '@/lib/copilot/metrics';
import { deleteLabTalk, getProfile, insertLabEvent, loadHome } from '@/lib/copilot/store';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const profile = await getProfile(auth.pid);
  if (!profile) return fail('Not found', 404);
  const b = await readJson(req);
  // "Today" is the person's: a bet opened at 11pm in Manila begins on the Manila date.
  const today = todayIso(profile.timezone);

  try {
    switch (b.action) {
      case 'open': {
        const home = await loadHome(auth.pid);
        if (!home) return fail('Not found', 404);
        // Refused rather than guessed: with the Lab unreadable, a second bet
        // could open beside one already running, and both would share every send.
        if (home.lab?.unreadable) return fail(`The Lab could not be read just now, so a new bet cannot be opened safely: ${home.lab.unreadable}`);
        if (home.lab?.bets.some((x) => x.state === 'running')) return fail('A bet is running. Let it finish, or call it off, before the next one.');
        // The offer's price as it stands now, kept on the bet: a price changed
        // next week must not rewrite whether this one passed.
        const v = normalizeBet(obj(b.bet), { today, ...betPrice(home.profile.offer?.price_band, salesCurrency(home.profile.finance, home.goals)) });
        if (!v.ok) return fail(v.error);
        await insertLabEvent(auth.pid, LAB_BET, { ...v.value });
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'stop': {
        const id = typeof b.id === 'string' ? b.id : '';
        const home = await loadHome(auth.pid);
        const bet = home?.lab?.bets.find((x) => x.bet.id === id);
        if (!bet || bet.state !== 'running') return fail('That bet is not running.');
        const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, NOTE_MAX) : null;
        await insertLabEvent(auth.pid, LAB_STOP, { bet: id, note });
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'talk': {
        const v = normalizeTalk(obj(b.talk), today);
        if (!v.ok) return fail(v.error);
        await insertLabEvent(auth.pid, LAB_TALK, { ...v.value });
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'forget': {
        await deleteLabTalk(auth.pid, String(b.id ?? ''));
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'checkpoint': {
        const v = normalizeCheckpoint(obj(b.checkpoint), today);
        if (!v.ok) return fail(v.error);
        await insertLabEvent(auth.pid, LAB_CHECKPOINT, { ...v.value });
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      default:
        return fail('Unknown action');
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not save that', 500);
  }
}
