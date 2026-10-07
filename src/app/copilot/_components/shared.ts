import type { PipelineStage } from '@/lib/copilot/pipeline';
import type { Discovered } from '@/lib/copilot/watch/discover';
import type { WorkingSection } from '@/lib/copilot/working';
import type { Authority } from '@/lib/copilot/commission';
import type { WorthKind } from '@/lib/copilot/worth';
import type { AskAnswer } from '@/lib/copilot/ask';
import type { Connection } from '@/lib/copilot/oauth';
import type { MarkState } from '@/lib/copilot/roadmap';
import type { ExperimentState } from '@/lib/copilot/experiment';
import type { PayeeRole } from '@/lib/copilot/money/ledger';
import type { OutreachStage } from '@/lib/copilot/matches';
import type { AssetKind } from '@/lib/copilot/assets';
import type { LinkKey, LinkState } from '@/lib/copilot/business';
import type { BetIdea, Commitment, IntroOutcome, LabDecision, LabMetric, Problem, TalkRole } from '@/lib/copilot/lab';
import type { Seed } from '@/lib/copilot/seed';
import type { FoundBy } from '@/lib/copilot/types';
import type { Reading, ToldMeta, ToldOffer, ToldSale, ToldTalk } from '@/lib/copilot/tell';
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
 * The tabs of the shell at /copilot2, one question each: where am I and what
 * moves it, who is worth contacting, is the business proven and what is being
 * bet to find out, where did the money go, and how am I doing.
 *
 * Its own type rather than a widening of Tab, because the two shells are two
 * layouts over one app — a v1 screen that could be told to open `proof` would
 * have nothing to render.
 */
export type Tab2 = 'path' | 'swipe' | 'proof' | 'money' | 'you';

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
  /** The offer. `bet` ties the version saved here to the bet it was rewritten for. */
  | { kind: 'offer'; bet?: string; told?: { meta: ToldMeta; offer: ToldOffer } }
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
   * Questions about your own rows, each answered by counting (lib/copilot/asked.ts,
   * ask.ts), plus the one escape hatch for everything the list cannot answer.
   * `heard`: the question as it was said, when it came from the mic.
   */
  | { kind: 'ask'; heard?: string }
  /**
   * Claude, connected: the address to paste into Claude, what is connected and
   * what it last read, and a code for signing in from a computer the app is not
   * open on. lib/copilot/mcp.ts says why it reads and does not write.
   */
  | { kind: 'claude' }
  /**
   * One Move, whole: the reasons, the artifact and the two answers. v2 lists
   * Moves as rows, and a row is not enough to act on — the artifact is the
   * point of a Move, and it does not fit in one line.
   */
  | { kind: 'move'; id: string }
  /** The confirm card — opened drafts, or replies with no ending — as a sheet. */
  | { kind: 'capture' }
  /**
   * Everyone already written to — To send, Waiting, Replied — opened on one of
   * them (v2/Outreach.tsx). The Matches tab's other pills, after Swipe took New.
   */
  | { kind: 'outreach'; stage: OutreachStage }
  /** Log deep work. The one number on You that nothing else can supply. */
  | { kind: 'focus' }
  /** Bank statements: upload, what they say, who paid, and the answers only the person can give. */
  | { kind: 'bank' }
  /** Money in, opened: who paid, month by month, then the wins logged. */
  | { kind: 'moneyin' }
  /** The currency the whole app counts in (Settings). */
  | { kind: 'currency' }
  /**
   * Proof: start a bet — from a play in the catalogue, an idea a model wrote
   * (by its key, read from the ideas on hand), the plan's experiment, words
   * shared from another app (seed.ts), a test kept on the shelf (by its id), or
   * written from scratch on a part.
   */
  | { kind: 'bet'; play?: string; part?: LinkKey; idea?: string; experiment?: BetFromExperiment; seed?: Seed; shelf?: string }
  /**
   * Proof: log one conversation — The Mom Test's record of what was committed —
   * optionally as the one an introduction led to (`via`), or as one said into
   * the mic (`told`).
   */
  | { kind: 'talk'; via?: string; told?: { meta: ToldMeta; talk: ToldTalk }; proposal?: string }
  /** The Path and Proof: an introduction somebody offered, by the conversation it was offered in, and what to do about it. */
  | { kind: 'intro'; talk: string }
  /** Proof: every conversation logged, with the way to log another. */
  | { kind: 'talks' }
  /** Proof: log the person's own count for a bet ("3 sign-ups"). */
  | { kind: 'count'; bet: string }
  /** Proof: a sale or a meeting logged where no business in the app is attached to it. */
  | { kind: 'sale'; outcome: 'won' | 'meeting'; told?: { meta: ToldMeta; sale: ToldSale } }
  /** The mic: a note for the plan, in the words that were said (lib/copilot/tell.ts). */
  | { kind: 'note'; told: { meta: ToldMeta; content: string } }
  /** The mic: what was said, when it could not be told what it was — or was told wrong. The person picks. */
  | { kind: 'told'; meta: ToldMeta }
  /** Proof: the chain, whole — each part's rule, its evidence and what would move it. */
  | { kind: 'chain' }
  /** Proof: pivot one part now, without waiting for the checkpoint to come due. The parts it changes count from today. */
  | { kind: 'pivot' }
  /** Records: the count link — where forms and checkout send sign-ups, enquiries and sales (lib/copilot/signal.ts). */
  | { kind: 'signals' }
  /** What Claude proposed, each to keep, change or drop (lib/copilot/proposals.ts). */
  | { kind: 'proposals' }
  /** Proof: how buyers find the business. */
  | { kind: 'foundby' }
  /** Proof: the history, whole, by month. */
  | { kind: 'history' }
  /** Proof: one asset — by id — or a new one of a kind, optionally for a bet. */
  | { kind: 'asset'; id?: string; assetKind?: AssetKind; bet?: string }
  /** Proof: every asset, put away ones too. */
  | { kind: 'assets' }
  /** Proof: the projects — handing work over, the ones live, the ones finished. */
  | { kind: 'projects' };

/** The plan's experiment, as a bet sheet opens on it: the bet takes the experiment's verdict when it ends. */
export interface BetFromExperiment {
  id: string;
  title: string;
  test: string;
  watch: string;
  days: number;
  part: LinkKey;
}

/** The count link's addresses: each kind's, and the plain one Stripe sends to. */
export type SignalLinks = { signup: string; enquiry: string; sale: string; stripe: string };

/** What a bet can be told. A verdict is not among them: it is the rows'. */
export type LabInput =
  | {
      action: 'open';
      /** This sheet's own word for its Start tap (lab.ts isOpenNonce): a retry of it answers as the tap did, never with a second bet. */
      nonce?: string;
      bet: {
        part: LinkKey; belief: string; play: string | null; idea?: BetIdea | null; metric: LabMetric; unit?: string | null; target: number;
        tries: { metric: LabMetric; planned: number } | null; days: number; experiment?: string | null;
        /** The shelf entry it starts, which leaves the shelf with it. */
        shelf?: string | null;
      };
    }
  /** Keep a test for later: the same fields a bet has, none of what only starting decides. */
  | {
      action: 'shelve';
      bet: {
        part: LinkKey; belief: string; play: string | null; idea?: BetIdea | null; metric: LabMetric; unit?: string | null; target: number;
        tries: { metric: LabMetric; planned: number } | null; days: number;
      };
    }
  | { action: 'unshelve'; id: string }
  | { action: 'stop'; id: string; note?: string }
  /** `proposal`: the proposal it was opened from (lib/copilot/proposals.ts), which this save keeps. */
  | { action: 'talk'; talk: { on?: string; who?: string; role: TalkRole; problem: Problem; commitment: Commitment; said?: string; via?: string }; proposal?: string }
  | { action: 'intro'; intro: { talk: string; outcome: IntroOutcome } }
  | { action: 'forget'; id: string }
  | { action: 'count'; bet: string; count: { n: number; on?: string; note?: string } }
  | { action: 'uncount'; id: string }
  | { action: 'link'; bet: string; commission: string }
  | { action: 'ideas'; part: LinkKey }
  | { action: 'found_by'; found_by: FoundBy | null }
  | { action: 'checkpoint'; checkpoint: { decision: LabDecision; part?: LinkKey | null; note?: string; chain: Partial<Record<LinkKey, LinkState>> } };

/** What an asset can be told (/api/copilot/assets). Every write is a version or a put-away; nothing is edited in place. */
export type AssetInput =
  | { action: 'add'; asset: { kind: AssetKind; title?: string; url?: string; body?: string; note?: string }; bet?: string | null }
  | { action: 'version'; id: string; asset: { title?: string; url?: string; body?: string; note?: string }; bet?: string | null }
  | { action: 'draft'; kind?: AssetKind; id?: string; bet?: string | null; ask?: string }
  | { action: 'retire' | 'restore'; id: string }
  | { action: 'adopt'; version: string }
  | { action: 'proof'; id: string };

/** What the person can say about their statements. See /api/copilot/money. */
export type MoneyAnswer =
  | { action: 'confirm' | 'discard'; id: string }
  | { action: 'currency'; id: string; currency: string }
  | { action: 'name'; key: string; role: PayeeRole | null; opportunity_id?: string | null }
  | { action: 'forget'; confirm: string };

export interface OutcomeInput {
  opportunity_id?: string;
  action_id?: string;
  kind: OutcomeKind;
  amount?: number;
  currency?: string;
  note?: string;
  /** The person's day it happened, when it was not today (lib/copilot/tell.ts occurredOn). */
  on?: string;
}

export interface Actions {
  /** Push a sheet. Opening one from inside another returns to the first on close. */
  openSheet(s: SheetState): void;
  /** Pop the top sheet. */
  closeSheet(): void;
  /** Replace the top sheet: a sort corrected is the same step, not one more to go back through. */
  swapSheet(s: SheetState): void;
  /** What was said into the mic, sorted (api/copilot/tell). Reads only: the sheet it opens keeps. */
  tell(heard: string, categories?: { out: string[]; in: string[] }): Promise<{ ok: boolean; reading?: Reading; error?: string }>;
  /** Each shell maps the names it knows onto its own tabs and ignores the rest. */
  setTab(t: Tab | Tab2): void;
  runBrief(reason?: string): Promise<void>;
  /** Tonight's whole pass, now: the cron's own code path for this account. It
   *  resolves once the pass has started; the result arrives minutes later. */
  runNightly(): Promise<void>;
  /**
   * Redraw the Path's plan now. Resolves once the draw has started; the plan
   * arrives when the model answers, and the hook watches for it.
   */
  drawRoadmap(reason?: string): Promise<void>;
  /** A step or milestone of the plan done, set aside, or back on. Resolves false when it did not save. */
  markRoadmap(item: string, state: MarkState): Promise<boolean>;
  /** The plan's experiment: try it, set it aside, or say how it went. */
  markExperiment(id: string, state: ExperimentState): Promise<void>;
  /** A step the plan gave the agent, handed over and started in one tap. */
  handOverStep(item: string): Promise<{ ok: boolean; error?: string }>;
  /** Resolves false when the save failed, so callers can keep the user's text. */
  addNote(content: string, regenerate: boolean): Promise<boolean>;
  setOppStatus(id: string, status: OpportunityStatus): Promise<void>;
  setActionStatus(id: string, status: ActionStatus): Promise<void>;
  requestSource(key: SourceKey): Promise<void>;
  /** Send the user to Stripe's hosted billing portal. */
  openBilling(): Promise<void>;
  saveGoal(patch: Partial<Goal> & { id?: string; title?: string; due_on?: string | null }): Promise<void>;
  setCapacity(c: Capacity): Promise<void>;
  resetDevice(): Promise<void>;
  // — closed loop —
  // Each closes the sheet it was answered from, which is the right end for a
  // sheet about one draft. `stay` is for a list in a sheet (v2/Outreach.tsx):
  // answering one row must not close the rows still to answer.
  sendAction(id: string, overrides?: { body?: string; subject?: string }, opts?: { stay?: boolean }): Promise<boolean>;
  /** Manual dispatch: the user sent it from their own app, we just record it. */
  markSent(id: string, overrides?: { body?: string; subject?: string }, opts?: { stay?: boolean }): Promise<boolean>;
  /** `bet`: the bet this version of the offer was written for, kept in the offer's history. */
  saveOffer(offer: Offer, opts?: { bet?: string | null }): Promise<boolean>;
  cancelDraft(id: string): Promise<void>;
  recordOutcome(input: OutcomeInput, opts?: { stay?: boolean }): Promise<boolean>;
  draftFor(oppId: string, channel?: Channel): Promise<boolean>;
  findMatches(): Promise<void>;
  /** `cash_currency` / `burn_currency`: what each number was typed in, when not the main currency. `main_currency`: the whole app's, from Settings. */
  saveFinance(f: { monthly_burn?: number; cash?: number; cash_currency?: string; burn_currency?: string; main_currency?: string }): Promise<boolean>;
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
  /**
   * `bet`: the running bet's id — the project is its own, takes the slot the bet
   * keeps, and is tied to it by the server (`tied`; `untied` says why not).
   */
  createCommission(input: { objective: string; why?: string; goal_id?: string; authority?: Authority; budget_minutes?: number; bet?: string }): Promise<{ ok: boolean; error?: string; id?: string; tied?: boolean; untied?: string | null }>;
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
  /** The connector's address and the connections made with it. `unreadable` is a list that could not be read, said on the sheet. */
  connections(): Promise<{ ok: boolean; url?: string; connections?: Connection[]; unreadable?: string | null; error?: string }>;
  /** Ends one connection: its tokens stop on their next call. */
  disconnect(grant: string): Promise<{ ok: boolean; connections?: Connection[]; error?: string }>;
  /** A code to type on Claude's sign-in screen, good once for ten minutes. */
  pairCode(): Promise<{ ok: boolean; code?: string; expiresAt?: string; error?: string }>;
  /** The count link's addresses, one per kind and Stripe's; `links` null before one was made (lib/copilot/signal.ts). */
  signalLinks(): Promise<{ ok: boolean; links?: SignalLinks | null; error?: string }>;
  /** A new count link, which ends the one in use. */
  makeSignalLink(): Promise<{ ok: boolean; links?: SignalLinks; error?: string }>;
  /** Keep what Claude proposed as it stands — logged, or on the shelf — or drop it (lib/copilot/proposals.ts). */
  answerProposal(id: string, action: 'keep' | 'drop'): Promise<{ ok: boolean; error?: string }>;
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
  /**
   * Upload one statement. A CSV or OFX is read before this resolves; a PDF or a
   * screenshot resolves as soon as the reading has started, and the hook
   * watches it land.
   */
  uploadStatement(file: File): Promise<{ ok: boolean; error?: string; status?: string }>;
  /** Confirm or discard a statement, say who a payer is, or delete every row read off the bank. */
  answerMoney(answer: MoneyAnswer): Promise<{ ok: boolean; error?: string }>;
  /** Bets: open one, call one off, log or forget a conversation or a count, tie a project to one, answer the checkpoint, ask for ideas, say how buyers find you. */
  lab(input: LabInput): Promise<{ ok: boolean; error?: string }>;
  /** Assets: add one, a new version, a draft by AI, put away or bring back, make a drafted offer yours, use a demo as proof. */
  assets(input: AssetInput): Promise<{ ok: boolean; error?: string; id?: string; rewritten?: number }>;
}
