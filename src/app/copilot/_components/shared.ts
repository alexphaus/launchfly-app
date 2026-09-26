import type { PipelineStage } from '@/lib/copilot/pipeline';
import type { Discovered } from '@/lib/copilot/watch/discover';
import type { WorkingSection } from '@/lib/copilot/working';
import type { Authority } from '@/lib/copilot/commission';
import type { WorthKind } from '@/lib/copilot/worth';
import type { AskAnswer } from '@/lib/copilot/ask';
import type { ActionStatus, Capacity, Channel, Goal, Offer, OpportunityStatus, OutcomeKind, SourceKey } from '@/lib/copilot/types';

/**
 * Two tabs, because there are two questions: what do I do, and is it working.
 *
 * Pipeline was the third and it was three things, all of which already existed
 * somewhere else. Its send queue was Today's send queue read a second way (40
 * on one tab, 42 on the other). Its triage deck is one card on Now. Its stage
 * groups are what the funnel on Working now opens into — the funnel stops being
 * decoration and becomes the navigation.
 *
 * You is a sheet behind the header avatar, not a destination.
 */
export type Tab = 'now' | 'working';

/**
 * The four tabs of the shell at /copilot2, one question each: what do I do
 * today, who is worth contacting, what am I building, and how am I doing.
 *
 * Its own type rather than a widening of Tab, because the two shells are two
 * layouts over one app — a v1 screen that could be told to open `work` would
 * have nothing to render.
 */
export type Tab2 = 'path' | 'matches' | 'you';

export type SheetState =
  | { kind: 'capacity' }
  | { kind: 'action'; id: string }
  | { kind: 'opp'; id: string }
  | { kind: 'goal'; id?: string }
  | { kind: 'reset' }
  | { kind: 'finance' }
  | { kind: 'targeting' }
  | { kind: 'account' }
  | { kind: 'won'; oppId: string }
  | { kind: 'offer' }
  | { kind: 'you' }
  | { kind: 'opening'; term: string }
  /** The send queue, one draft at a time. See QueueSheet for why it is not a list. */
  | { kind: 'queue' }
  /** One funnel stage, opened: the businesses actually in it. */
  | { kind: 'stage'; stage: PipelineStage }
  /** The feeds this person watches. Where supply comes from is theirs to set. */
  | { kind: 'watchlist' }
  /** Money owed, either way. The sensor the money factor was built for. */
  | { kind: 'money' }
  /** What the app knows about this business, and what it is waiting to be told. */
  | { kind: 'working' }
  /** One mandate: its plan, its log, and the button that grants it authority. */
  | { kind: 'commission'; id: string }
  /** Hand work over without starting from a goal. */
  | { kind: 'handover' }
  /**
   * Questions about your own rows, each answered by counting — plus the one
   * escape hatch for everything the list cannot answer. See lib/copilot/ask.ts.
   */
  | { kind: 'ask' }
  /**
   * One Move, whole: the reasons, the artifact and the two answers. v2 lists
   * Moves as rows, and a row is not enough to act on — the artifact is the
   * point of a Move, and it does not fit in one line.
   */
  | { kind: 'move'; id: string }
  /** The confirm card — opened drafts, or replies with no ending — as a sheet. */
  | { kind: 'capture' }
  /** Log deep work. The one number on You that nothing else can supply. */
  | { kind: 'focus' };

export interface OutcomeInput {
  opportunity_id?: string;
  action_id?: string;
  kind: OutcomeKind;
  amount?: number;
  currency?: string;
  note?: string;
}

export interface Actions {
  /** Push a sheet. Opening one from inside another returns to the first on close. */
  openSheet(s: SheetState): void;
  /** Pop the top sheet. */
  closeSheet(): void;
  /** Each shell maps the names it knows onto its own tabs and ignores the rest. */
  setTab(t: Tab | Tab2): void;
  runBrief(reason?: string): Promise<void>;
  /** Resolves false when the save failed, so callers can keep the user's text. */
  addNote(content: string, regenerate: boolean): Promise<boolean>;
  setOppStatus(id: string, status: OpportunityStatus): Promise<void>;
  setActionStatus(id: string, status: ActionStatus): Promise<void>;
  requestSource(key: SourceKey): Promise<void>;
  /** Send the user to Stripe's hosted billing portal. */
  openBilling(): Promise<void>;
  saveGoal(patch: Partial<Goal> & { id?: string; title?: string }): Promise<void>;
  setCapacity(c: Capacity): Promise<void>;
  resetDevice(): Promise<void>;
  // — closed loop —
  sendAction(id: string, overrides?: { body?: string; subject?: string }): Promise<boolean>;
  /** Manual dispatch: the user sent it from their own app, we just record it. */
  markSent(id: string, overrides?: { body?: string; subject?: string }): Promise<boolean>;
  saveOffer(offer: Offer): Promise<boolean>;
  cancelDraft(id: string): Promise<void>;
  recordOutcome(input: OutcomeInput): Promise<boolean>;
  draftFor(oppId: string, channel?: Channel): Promise<boolean>;
  findMatches(): Promise<void>;
  saveFinance(f: { monthly_burn?: number; cash?: number; currency?: string }): Promise<boolean>;
  saveTargeting(t: { target_segments: string[]; target_area: string }): Promise<boolean>;
  /** Signals → "Stop matching <segment>": drops one segment and everything drafted for it. */
  dropSegment(segment: string): Promise<boolean>;
  /** What you did about today's call. "Ignored" is never sent — it is inferred. */
  /**
   * `permanent` turns a refusal into a standing one: stop suggesting this at
   * all, rather than not today. It writes a line into the working file's
   * `refuse` section, which is where the user can see and lift it.
   */
  answerCall(response: 'did' | 'rejected' | 'wrong', permanent?: boolean): Promise<boolean>;
  /** Cancel every open draft. Nothing is deleted; they move to `cancelled`. */
  clearQueue(): Promise<{ ok: boolean; cancelled?: number; error?: string }>;
  /** One triage card: draft an opener for it, or dismiss it. */
  triage(id: string, action: 'draft' | 'skip'): Promise<boolean>;
  /**
   * Add a place to watch. Takes whatever the user typed — "r/forhire", a
   * YouTube channel, a feed URL — and normalises it server-side. Resolves the
   * note the normaliser wrote, or the error, so the sheet can say what it did.
   */
  addWatchSource(input: { url: string; label?: string; intent?: string }): Promise<{ ok: boolean; note?: string | null; error?: string }>;
  /**
   * Search for feeds that match the offer. Every result returned has already
   * been fetched and parsed server-side, so `found` is a list of things that
   * work, not a list of things that might.
   */
  discoverSources(): Promise<{ ok: boolean; found?: Discovered[]; searched?: string[]; checked?: number; note?: string | null; error?: string }>;
  /** Add one discovered feed, by the URL that verified rather than the page. */
  addDiscovered(d: Discovered): Promise<{ ok: boolean; error?: string }>;
  /** Write or edit one line of the working file. */
  saveWorking(input: { id?: string; section?: WorkingSection; body: string }): Promise<{ ok: boolean; error?: string }>;
  /** Settle a proposal: yes makes it live, no is remembered so it stops coming back. */
  settleWorking(id: string, status: 'live' | 'declined'): Promise<{ ok: boolean; error?: string }>;
  removeWorking(id: string): Promise<void>;
  /** Write a mandate. Always created as a draft — approving is a second act. */
  createCommission(input: { objective: string; why?: string; goal_id?: string; authority?: Authority; budget_minutes?: number }): Promise<{ ok: boolean; error?: string }>;
  /** Grant authority, carry on after answering, call it off, finish, or mark read. */
  /**
   * `answer` is the user's reply to a needs_you, and only 'unblock' carries one.
   * `worth` is the close-out verdict and only 'done' and 'stop' carry one — it is
   * optional because the question can be skipped, and `note` reports a verdict
   * that was saved on the mandate but did not reach the ledger.
   */
  commissionAction(
    id: string,
    action: 'approve' | 'unblock' | 'stop' | 'done' | 'seen',
    worth?: { worth: WorthKind; amount?: number | null; note?: string | null },
    answer?: string,
  ): Promise<{ ok: boolean; error?: string; note?: string | null }>;
  /**
   * Hand the live mandates to the worker now. The nightly pass is otherwise the
   * only thing that can — commissionJob cannot fit in the brief route's budget.
   */
  runCommissionsNow(): Promise<{ ok: boolean; asked?: number; error?: string }>;
  removeWatchSource(id: string): Promise<void>;
  /**
   * Record that a deep link was opened. Fire and forget, by beacon — the page is
   * going to the background and there is no round trip to wait for.
   */
  markOpened(actionId: string): void;
  /** Answer the batch question: these went, or they did not. */
  confirmOpened(ids: string[], sent: boolean): Promise<void>;
  saveObligation(patch: { id?: string; direction?: 'in' | 'out'; counterparty?: string; amount?: number; currency?: string | null; due_on?: string; status?: 'open' | 'settled' | 'written_off'; note?: string | null }): Promise<boolean>;
  removeObligation(id: string): Promise<void>;
  /**
   * Read the watched sources now rather than at 21:00. One or two per tap —
   * see the route for why it cannot be all of them at once.
   */
  readSourcesNow(): Promise<{ ok: boolean; found?: number }>;
  /**
   * Delete the account and every row belonging to it. Not recoverable, and not
   * the same thing as resetDevice, which only clears the cookie.
   */
  deleteAccount(confirm: string): Promise<{ ok: boolean; error?: string }>;
  /** Pause a noisy source without losing it, or re-enable one that errored. */
  setWatchSourceStatus(id: string, status: 'active' | 'paused'): Promise<void>;
  /** A Move is finished work: say it is done, or that it is not for you. */
  answerMove(id: string, status: 'done' | 'dismissed'): Promise<boolean>;
  /**
   * A PROPOSED Move is the one kind you do not carry out: hand it over and the
   * app does it. Creates the mandate and grants `read` in one act — see
   * handOverMove for why that is a real approval rather than a shortcut.
   */
  handOverMove(id: string): Promise<{ ok: boolean; error?: string }>;
  /**
   * The five questions, answered by counting. A fixed list on purpose — a text
   * box here would have to be answered by a model, and a plausible invented
   * figure is worse than no figure because it gets acted on.
   */
  askRows(): Promise<{ ok: boolean; answers?: AskAnswer[]; error?: string }>;
  /**
   * Everything the app knows, as text to paste into any model. Resolves the text
   * rather than copying it, because the clipboard write has to happen inside the
   * tap handler to count as a user gesture in Safari.
   */
  handoff(): Promise<{ ok: boolean; text?: string; chars?: number; error?: string }>;
  requestLoginLink(email: string): Promise<{ ok: boolean; error?: string }>;
  setPush(enabled: boolean): Promise<boolean>;
  /**
   * Draft an opener for a match and open the draft straight away.
   *
   * Goes through the triage route rather than the plain draft route, so the
   * keep-rate still learns which segments get drafted — the Matches list is the
   * deck laid flat, and a deck that stopped recording its answers would stop
   * ordering itself.
   */
  draftFromMatch(oppId: string): Promise<boolean>;
  /** Record a block of deep work. Resolves false when it did not save. */
  logFocus(input: { minutes: number; on?: string; note?: string }): Promise<boolean>;
  removeFocus(id: string): Promise<void>;
}
