// src/app/api/copilot/lab/route.ts
// The bets' writes: open a bet, call one off, keep a test on the shelf or take
// it off, log a conversation or a count, say how an introduction went, tie a
// project to a bet, answer the checkpoint, ask for ideas, and say how buyers find
// you. Each is validated by lib/copilot/lab.ts and stored as an event. A verdict is never posted here — there is no "mark it passed" —
// because it is computed from the rows on every load (invariant 10's
// reasoning: a bet the person could pass by tapping would be graded by the one
// person most hoping it passes).

import { after } from 'next/server';
import { todayIso } from '@/lib/copilot/db';
import { LINK_KEYS, type LinkKey } from '@/lib/copilot/business';
import {
  LAB_BET, LAB_CHECKPOINT, LAB_COUNT, LAB_INTRO, LAB_LINK, LAB_SHELF, LAB_SHELF_GONE, LAB_STOP, LAB_TALK, NOTE_MAX,
  betPrice, countRefusal, isOpenNonce, labFromEvents, normalizeBet, normalizeCheckpoint, normalizeIntroClose, normalizeShelf, normalizeTalk, normalizeTally,
  openRace, shelfRefusal,
} from '@/lib/copilot/lab';
import { foundOf } from '@/lib/copilot/proof';
import { salesCurrency } from '@/lib/copilot/metrics';
import { isFoundBy } from '@/lib/copilot/offer';
import { ProofModelError, ProofRefusal, startIdeas, writeIdeas } from '@/lib/copilot/proofai';
import { claimProposal, deleteLabTalk, deleteLabTally, getProfile, insertExperimentMark, insertLabEvent, loadHome, loadIdeaRuns, loadLabEvents, setFoundBy, unclaimProposal, withdrawLabBet } from '@/lib/copilot/store';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
// Ideas are written in after(), for up to two and a half minutes (proofai.ts):
// the tap has its answer at once, and the writing outlives it.
export const maxDuration = 300;

/**
 * GET ?ideas=1: per part, an ask for ideas still being written or failed — what
 * Proof polls while the writing runs, so it reads three kinds of row, not the
 * whole home. A failed read is an error, never "nothing being written": the
 * poller would stop watching an ask that is still going.
 */
export async function GET(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  if (new URL(req.url).searchParams.get('ideas') !== '1') return fail('Unknown read');
  try {
    return json({ ok: true, runs: await loadIdeaRuns(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not read your ideas', 500);
  }
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const RUNNING = 'A bet is running. Let it finish, or call it off, before the next one.';

/**
 * The conversations on record, for checking that an introduction named in a
 * write is one. The events alone, not the whole home: logging a call is the
 * commonest write here. Throws when they cannot be read — an introduction
 * that cannot be checked is not one to tie a conversation to.
 */
async function talksOnRecord(pid: string) {
  const events = await loadLabEvents(pid);
  if (events.unreadable) throw new Error(`Your conversations could not be read just now, so the introduction cannot be checked: ${events.unreadable}`);
  return labFromEvents(events.rows).talks;
}

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
        const nonce = isOpenNonce(b.nonce) ? b.nonce : null;
        const home = await loadHome(auth.pid);
        if (!home) return fail('Not found', 404);
        // Refused rather than guessed: with the bets unreadable, a second bet
        // could open beside one already running, and both would share every send.
        if (home.lab?.unreadable) return fail(`Your bets could not be read just now, so a new one cannot be opened safely: ${home.lab.unreadable}`);
        // A retry of a tap that already opened its bet is answered as that tap
        // was: "a bet is running" about the bet it just started reads as a failure.
        if (nonce && home.lab?.bets.some((x) => x.bet.nonce === nonce)) return json({ ok: true, home });
        if (home.lab?.bets.some((x) => x.state === 'running')) return fail(RUNNING);
        // The offer's price as it stands now, kept on the bet: a price changed
        // next week must not rewrite whether this one passed.
        const v = normalizeBet(obj(b.bet), { today, ...betPrice(home.profile.offer?.price_band, salesCurrency(home.profile.finance, home.goals)) });
        if (!v.ok) return fail(v.error);
        // A count this business cannot keep is refused here, not only hidden in the
        // sheet: a kept test can outlive the way its buyers were found.
        const off = countRefusal(v.value.metric, v.value.tries, foundOf(home).value);
        if (off) return fail(off);
        // Started from the shelf: the entry has to be one that is on it, so a tap
        // from a stale screen cannot tie a bet to a test nobody kept — and the entry
        // leaves the shelf with the bet, because the bet names it.
        const shelf = str(obj(b.bet).shelf) || null;
        if (shelf && !home.lab?.shelf?.some((e) => e.id === shelf)) return fail('That test is no longer on your shelf.');
        const id = await insertLabEvent(auth.pid, LAB_BET, { ...v.value, shelf, ...(nonce ? { nonce } : {}) });
        // Read back: the check above ran before the write, so two taps can both
        // have passed it. The second one written goes (lab.ts openRace).
        const after = await loadHome(auth.pid);
        const race = after?.lab && !after.lab.unreadable ? openRace(after.lab.bets, id) : null;
        if (race) {
          await withdrawLabBet(auth.pid, id);
          return race.same ? json({ ok: true, home: await loadHome(auth.pid) }) : fail(RUNNING);
        }
        // The plan's experiment, made a bet: it is being tried now, and the bet
        // will give it its verdict (lab.ts experimentVerdicts).
        if (v.value.experiment) {
          const marks = home.roadmap?.experiments ?? [];
          if (!marks.some((m) => m.id === v.value.experiment && m.state === 'started')) {
            await insertExperimentMark(auth.pid, { id: v.value.experiment, title: v.value.idea?.label ?? v.value.belief, angle: null, state: 'started' });
            return json({ ok: true, home: await loadHome(auth.pid) });
          }
        }
        return json({ ok: true, home: after });
      }
      case 'shelve': {
        const home = await loadHome(auth.pid);
        if (!home) return fail('Not found', 404);
        // Refused rather than guessed: with the shelf unreadable, the cap and the
        // duplicate check would pass on a shelf nobody could see.
        if (home.lab?.unreadable) return fail(`Your shelf could not be read just now, so nothing can be kept on it safely: ${home.lab.unreadable}`);
        // The same rules a bet is held to, less the day and price that belong to the
        // day it starts: a test with no line is not kept (lab.ts normalizeShelf).
        const v = normalizeShelf(obj(b.bet), { today, ...betPrice(home.profile.offer?.price_band, salesCurrency(home.profile.finance, home.goals)) });
        if (!v.ok) return fail(v.error);
        const off = countRefusal(v.value.metric, v.value.tries, foundOf(home).value);
        if (off) return fail(off);
        const no = shelfRefusal(home.lab?.shelf ?? [], v.value);
        if (no) return fail(no);
        await insertLabEvent(auth.pid, LAB_SHELF, { ...v.value });
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'unshelve': {
        const id = str(b.id);
        const home = await loadHome(auth.pid);
        if (!home) return fail('Not found', 404);
        // The read's failure, not "not on your shelf" about an entry the person can see on it (invariant 13).
        if (home.lab?.unreadable) return fail(`Your shelf could not be read just now, so nothing can be taken off it: ${home.lab.unreadable}`);
        if (!home.lab?.shelf?.some((e) => e.id === id)) return fail('That is not on your shelf.');
        await insertLabEvent(auth.pid, LAB_SHELF_GONE, { entry: id });
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'stop': {
        const id = str(b.id);
        const home = await loadHome(auth.pid);
        const bet = home?.lab?.bets.find((x) => x.bet.id === id);
        if (!bet || bet.state !== 'running') return fail('That bet is not running.');
        const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, NOTE_MAX) : null;
        await insertLabEvent(auth.pid, LAB_STOP, { bet: id, note });
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'talk': {
        const raw = obj(b.talk);
        const v = normalizeTalk(raw, today, raw.via ? await talksOnRecord(auth.pid) : []);
        if (!v.ok) return fail(v.error);
        // Opened from what Claude proposed and changed first: this save is the
        // person keeping it, so the proposal ends with it — claimed first, so a
        // second tap or the other phone keeps it once (lib/copilot/proposals.ts).
        const proposal = typeof b.proposal === 'string' && b.proposal ? b.proposal : null;
        if (proposal && !(await claimProposal(auth.pid, proposal, 'kept'))) return json({ ok: true, home: await loadHome(auth.pid) });
        try {
          await insertLabEvent(auth.pid, LAB_TALK, { ...v.value });
        } catch (e) {
          if (proposal) await unclaimProposal(auth.pid, proposal);
          throw e;
        }
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'intro': {
        // How an introduction went, in the person's words: asked for, or fell
        // through. Logging the conversation it led to says the rest.
        const v = normalizeIntroClose(obj(b.intro), await talksOnRecord(auth.pid));
        if (!v.ok) return fail(v.error);
        await insertLabEvent(auth.pid, LAB_INTRO, { ...v.value });
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'forget': {
        await deleteLabTalk(auth.pid, str(b.id));
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'count': {
        const home = await loadHome(auth.pid);
        const bet = home?.lab?.bets.find((x) => x.bet.id === str(b.bet))?.bet;
        if (!bet) return fail('That bet is not in your record.');
        const v = normalizeTally(obj(b.count), bet, today);
        if (!v.ok) return fail(v.error);
        await insertLabEvent(auth.pid, LAB_COUNT, { ...v.value });
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'uncount': {
        await deleteLabTally(auth.pid, str(b.id));
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'link': {
        const home = await loadHome(auth.pid);
        const bet = home?.lab?.bets.find((x) => x.bet.id === str(b.bet));
        const project = home?.commissions.find((t) => t.commission.id === str(b.commission));
        if (!bet || !project) return fail('That bet or that project is not in your record.');
        await insertLabEvent(auth.pid, LAB_LINK, { bet: bet.bet.id, commission: project.commission.id });
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'checkpoint': {
        const v = normalizeCheckpoint(obj(b.checkpoint), today);
        if (!v.ok) return fail(v.error);
        await insertLabEvent(auth.pid, LAB_CHECKPOINT, { ...v.value });
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'ideas': {
        const part = (LINK_KEYS as readonly string[]).includes(str(b.part)) ? (b.part as LinkKey) : null;
        if (!part) return fail('Ideas for which part of the business?');
        // Started here, written in after(): the tap returns with the ask on the
        // screen, and Proof watches it until the set or the reason lands.
        const { started } = await startIdeas(auth.pid, part);
        if (started) {
          after(async () => {
            // writeIdeas never throws: a failure is recorded where Proof reads it.
            const r = await writeIdeas(auth.pid, part);
            if (!r.ok) console.error('[copilot/lab] ideas failed', r.error);
          });
        }
        return json({ ok: true, started, home: await loadHome(auth.pid) });
      }
      case 'found_by': {
        if (b.found_by !== null && !isFoundBy(b.found_by)) return fail('How do buyers find you?');
        await setFoundBy(auth.pid, b.found_by === null ? null : b.found_by);
        return json({ ok: true, home: await loadHome(auth.pid) });
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
