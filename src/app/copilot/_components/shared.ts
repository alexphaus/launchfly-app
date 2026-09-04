import type { ActionStatus, Capacity, Channel, Goal, GrowthItem, OpportunityStatus, OutcomeKind, SourceKey } from '@/lib/copilot/types';

export type Tab = 'today' | 'opps' | 'growth' | 'you';

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
  | { kind: 'won'; oppId: string };

export interface OutcomeInput {
  opportunity_id?: string;
  action_id?: string;
  kind: OutcomeKind;
  amount?: number;
  currency?: string;
  note?: string;
}

export interface Actions {
  openSheet(s: SheetState): void;
  closeSheet(): void;
  setTab(t: Tab): void;
  runBrief(reason?: string): Promise<void>;
  /** Resolves false when the save failed, so callers can keep the user's text. */
  addNote(content: string, regenerate: boolean): Promise<boolean>;
  setOppStatus(id: string, status: OpportunityStatus): Promise<void>;
  setActionStatus(id: string, status: ActionStatus): Promise<void>;
  setGrowthStatus(id: string, status: GrowthItem['status']): Promise<void>;
  requestSource(key: SourceKey): Promise<void>;
  saveGoal(patch: Partial<Goal> & { id?: string; title?: string }): Promise<void>;
  setCapacity(c: Capacity): Promise<void>;
  resetDevice(): Promise<void>;
  // — closed loop —
  sendAction(id: string, overrides?: { body?: string; subject?: string }): Promise<boolean>;
  cancelDraft(id: string): Promise<void>;
  recordOutcome(input: OutcomeInput): Promise<boolean>;
  draftFor(oppId: string, channel?: Channel): Promise<boolean>;
  findMatches(): Promise<void>;
  saveFinance(f: { monthly_burn?: number; cash?: number; currency?: string }): Promise<boolean>;
  saveTargeting(t: { target_segments: string[]; target_area: string }): Promise<boolean>;
  requestLoginLink(email: string): Promise<{ ok: boolean; error?: string }>;
  setPush(enabled: boolean): Promise<boolean>;
}
