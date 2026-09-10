import type { PipelineStage } from '@/lib/copilot/pipeline';
import type { ActionStatus, Capacity, Channel, Goal, GrowthItem, Offer, OpportunityStatus, OutcomeKind, SourceKey } from '@/lib/copilot/types';

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

export type SheetState =
  | { kind: 'capacity' }
  | { kind: 'action'; id: string }
  | { kind: 'opp'; id: string }
  | { kind: 'lesson'; id: string }
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
  | { kind: 'stage'; stage: PipelineStage };

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
  setTab(t: Tab): void;
  runBrief(reason?: string): Promise<void>;
  /** Resolves false when the save failed, so callers can keep the user's text. */
  addNote(content: string, regenerate: boolean): Promise<boolean>;
  setOppStatus(id: string, status: OpportunityStatus): Promise<void>;
  setActionStatus(id: string, status: ActionStatus): Promise<void>;
  setGrowthStatus(id: string, status: GrowthItem['status']): Promise<void>;
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
  answerCall(response: 'did' | 'rejected' | 'wrong'): Promise<boolean>;
  /** One triage card: draft an opener for it, or dismiss it. */
  triage(id: string, action: 'draft' | 'skip'): Promise<boolean>;
  /** A Move is finished work: say it is done, or that it is not for you. */
  answerMove(id: string, status: 'done' | 'dismissed'): Promise<boolean>;
  requestLoginLink(email: string): Promise<{ ok: boolean; error?: string }>;
  setPush(enabled: boolean): Promise<boolean>;
}
