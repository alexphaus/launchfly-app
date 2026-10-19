// src/lib/copilot/decide.ts
// Decide: everything that waits on the person, as cards in one deck, ahead of
// the people worth a message.
//
// Why one deck. The tabs had drifted into two places to act: the Path held the
// call, the move and "Needs you"; Engine held the bet's move and the people a
// bet found; Swipe held the businesses. The same day's work was spread over
// three screens, and the owner's own words for Engine were that half of it was
// things Swipe could do. Path is gone, Engine is the system (what runs and what
// it has proven), and every decision is a card here: right does it, left puts it
// off. A decision is not advice — each card is a row that already waits on the
// person (a call picked, a project that stopped to ask, a conversation Claude
// proposed, a post the bet found), so the deck is filled by whatever ran
// overnight and by the chats the person had, never written for the occasion.
//
// What it is held to:
//
//   - Nothing drafts from a blank offer (invariant 1): with no offer the first
//     card is writing one, and the people worth a message are not dealt at all.
//   - The answers that grade a call are the call's own buttons. A swipe is too
//     cheap a gesture to say "I did it", and a call answered by accident teaches
//     tomorrow's call the wrong thing — so its right swipe only hands work over,
//     where the call is work the app offers to do.
//   - Warm before cold: what is lost by waiting (a project blocked on you, an
//     introduction offered, a post someone may have answered) comes before what
//     only goes stale, and the people a bet found come before the businesses.
//   - A post found is a lead, like a business: it is dealt, and it is not counted
//     on the tab's badge, which says what needs the person rather than how many
//     strangers there are.
//
// Pure: no DB import, so copilot-core.test.ts covers the order and the words.
// SwipeTab.tsx maps each card onto its action.

import type { Step } from './engine';
import type { NowMove } from './plan';
import type { AskKind, AskRow } from './today';
import type { Voice } from './voices';

export type DecideKind =
  /** Nothing is drafted from a blank offer: writing one comes first. */
  | 'offer'
  /** Today's call, answered on its own buttons. */
  | 'call'
  /** What needsYou found: a question, an introduction, a fix, a proposal, a confirm, an approval. */
  | 'ask'
  /** A post this device opened: did they answer? */
  | 'answered'
  /** A post the running bet found, where somebody said its problem. */
  | 'voice'
  /** The bet's own next step (engine.ts engineStep), where it is not a post. */
  | 'bet'
  /** The plan's step or a Move, when no call waits. */
  | 'move'
  /** Pivot or persevere: bets ended since the last answer, read on System against the parts. */
  | 'checkpoint'
  /** What a pivot on who buys left behind. */
  | 'pivot'
  /** Nothing can look for anyone yet. */
  | 'setup'
  /** No call has been picked today. */
  | 'brief';

export interface DecideCard {
  /** Stable across reloads, and never one a lead card uses ('d:' — leads are 'q:', 'o:', 'm:'). */
  key: string;
  kind: DecideKind;
  /** Over the title: what kind of decision it is. */
  eyebrow: string;
  title: string;
  detail: string | null;
  /** What the right swipe does, on its button. Null where the card's own buttons answer it. */
  right: string | null;
  /** The left swipe: to the back of the pile, or not a fit (a post, set aside for good). */
  left: 'later' | 'not_fit';
  /** Counted on the tab's badge: it waits on the person. A post found is a lead and is not. */
  needs: boolean;
  ask?: AskRow;
  voice?: Voice;
  step?: Step;
  now?: NowMove;
  /** When this device opened the post, for an `answered` card. */
  openedAt?: string;
}

export interface DecideInput {
  noOffer: boolean;
  /** Today's call waits on an answer, and is not stale against the plan (plan.ts pathNow). */
  callPending: boolean;
  /** The call is work the app offers to do: the right swipe hands it over. */
  callHandsOver: boolean;
  /** pathNow's move. Only a plan step or a Move is a card of its own; the rest are below or are leads. */
  now: NowMove | null;
  /** needsYou's rows, in its order. */
  asks: AskRow[];
  /** The bet's step (engine.ts), read with no posts opened: the posts are cards of their own. */
  step: Step | null;
  /** The running bet's people not yet talked to or set aside, newest search first. */
  voices: Voice[];
  /** Post id → when this device opened it (engine.ts parseOpened). */
  opened: Readonly<Record<string, string>>;
  pivotLeft: boolean;
  /** A checkpoint is due (lab.ts checkpointView), and how many bets ended since the last one. */
  checkpoint: { due: boolean; ended: number };
  /** Nothing is looking for businesses or people: no Maps targeting and no web search. */
  cannotSearch: boolean;
  /** No call today, and none being picked now. */
  noCall: boolean;
}

/** The order asks are dealt in: blocked work first, then what goes cold, then what waits on nothing. */
const ASK_ORDER: AskKind[] = ['question', 'intro', 'fix', 'proposal', 'confirm', 'approve'];

const ASK_EYEBROW: Record<AskKind, string> = {
  question: 'A project asks you',
  intro: 'An introduction waits',
  fix: 'Work that failed a check',
  proposal: 'Claude proposes',
  confirm: 'Did these go?',
  approve: 'Waiting for your OK',
  send: 'To send',
};

/** Each opens where it is answered: the project, the introduction, the proposals, the confirm card. */
const ASK_RIGHT: Record<AskKind, string> = {
  question: 'Answer it',
  intro: 'Follow it up',
  fix: 'See why',
  proposal: 'Look at it',
  confirm: 'Answer',
  approve: 'Read the plan',
  send: 'Send',
};

/** Steps the deck has its own cards for: the posts (each one is a card) and the offer. */
const STEP_COVERED: ReadonlySet<Step['kind']> = new Set(['reply', 'waiting', 'offer']);

/**
 * Every card that waits on the person, in the order dealt. The people worth a
 * message (deck.ts deckCards) follow them on the same pile.
 */
export function decideCards(i: DecideInput): DecideCard[] {
  const out: DecideCard[] = [];

  if (i.noOffer) {
    out.push({
      key: 'd:offer', kind: 'offer', eyebrow: 'One thing first', title: 'Write what you sell',
      detail: 'Three lines. Nothing is drafted, searched or proposed without them: a message written from a blank offer is not yours.',
      right: 'Write it', left: 'later', needs: true,
    });
  }

  if (i.callPending) {
    out.push({
      key: 'd:call', kind: 'call', eyebrow: 'Today’s call', title: '', detail: null,
      right: i.callHandsOver ? 'Hand it over' : null, left: 'later', needs: true,
    });
  }

  // Sends are the businesses on the pile itself: a card saying "3 drafts ready" over the three drafts is the drafts twice.
  const asks = i.asks.filter((a) => a.kind !== 'send');
  const byKind = (k: AskKind) => asks.filter((a) => a.kind === k).map((a): DecideCard => ({
    key: `d:${a.key}`, kind: 'ask', eyebrow: ASK_EYEBROW[k],
    // A question's title is what was asked; its detail is the project it stopped.
    title: a.title, detail: a.detail || null,
    right: ASK_RIGHT[k], left: 'later', needs: true, ask: a,
  }));

  const opened = i.voices.filter((v) => !!i.opened[v.id]);
  const fresh = i.voices.filter((v) => !i.opened[v.id]);
  for (const k of ASK_ORDER) {
    out.push(...byKind(k));
    // A post opened and not answered goes cold like an introduction: right after them.
    if (k === 'intro') {
      for (const v of opened) {
        out.push({
          key: `d:a:${v.id}`, kind: 'answered', eyebrow: 'You opened their post', title: v.title,
          detail: v.said && v.said !== v.title ? v.said : null,
          right: 'They answered', left: 'later', needs: true, voice: v, openedAt: i.opened[v.id],
        });
      }
    }
  }

  for (const v of fresh) {
    out.push({
      key: `d:v:${v.id}`, kind: 'voice', eyebrow: 'Someone said it', title: v.title,
      detail: v.said && v.said !== v.title ? v.said : null,
      right: 'Open their post', left: 'not_fit', needs: false, voice: v,
    });
  }

  if (i.step && !STEP_COVERED.has(i.step.kind)) {
    out.push({
      // Keyed on what it says: a step that changed is a new card, not one already put off.
      key: `d:bet:${i.step.kind}:${i.step.title}`, kind: 'bet', eyebrow: 'Your bet', title: i.step.title, detail: i.step.why,
      right: i.step.primary.label, left: 'later', needs: true, step: i.step,
    });
  }

  // The plan's own step or a Move, while no call waits: the call already weighed them.
  const now = !i.callPending && i.now && (i.now.kind === 'step' || i.now.kind === 'move') ? i.now : null;
  if (now) {
    out.push({
      key: `d:${now.key}`, kind: 'move', eyebrow: now.kind === 'step' ? 'Your plan' : 'Worth doing',
      title: now.title, detail: [now.why, now.size].filter(Boolean).join(' · ') || null,
      right: now.kind === 'step' ? 'Done' : 'Open it', left: 'later', needs: true, now,
    });
  }

  // With no bet running the bet's step is the checkpoint already; while one runs it is asked here, because Path asked it and System only shows it.
  if (i.checkpoint.due && i.step?.kind !== 'checkpoint') {
    out.push({
      key: `d:checkpoint:${i.checkpoint.ended}`, kind: 'checkpoint', eyebrow: 'Checkpoint', title: 'Pivot or persevere?',
      detail: `${i.checkpoint.ended} ${i.checkpoint.ended === 1 ? 'bet' : 'bets'} ended since you last decided. Answered on System, against the parts it is about.`,
      right: 'Answer it', left: 'later', needs: true,
    });
  }

  if (i.pivotLeft) {
    out.push({
      key: 'd:pivot', kind: 'pivot', eyebrow: 'Since you pivoted who buys', title: 'Still looking for the buyers you left', detail: null,
      right: 'Set them aside', left: 'later', needs: true,
    });
  }

  if (i.cannotSearch && !i.noOffer) {
    out.push({
      key: 'd:setup', kind: 'setup', eyebrow: 'Nothing can look for you yet', title: 'Choose who to look for',
      detail: 'Say which kinds of business you want, and where. The app finds real ones and writes the first message for each.',
      right: 'Choose', left: 'later', needs: true,
    });
  }

  if (i.noCall && !i.noOffer) {
    out.push({
      key: 'd:brief', kind: 'brief', eyebrow: 'Today’s call', title: 'Nothing has been weighed yet today',
      detail: 'The nightly run picks one. It has not today, so it can be picked now.',
      right: 'Pick today’s call', left: 'later', needs: true,
    });
  }

  return out;
}

/** How many wait on the person: the tab's badge. A post found is a lead, as a business is. */
export function decideCount(cards: DecideCard[]): number {
  return cards.filter((c) => c.needs).length;
}
