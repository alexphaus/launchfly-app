import type { ActionStatus, Capacity, Goal, OpportunityStatus, SourceKey } from '@/lib/copilot/types';

export type Tab = 'today' | 'opps' | 'growth' | 'you';

export type SheetState =
  | { kind: 'capacity' }
  | { kind: 'action'; id: string }
  | { kind: 'opp'; id: string }
  | { kind: 'lesson'; id: string }
  | { kind: 'goal'; id?: string }
  | { kind: 'reset' };

export interface Actions {
  openSheet(s: SheetState): void;
  closeSheet(): void;
  setTab(t: Tab): void;
  runBrief(reason?: string): Promise<void>;
  addNote(content: string, regenerate: boolean): Promise<void>;
  setOppStatus(id: string, status: OpportunityStatus): Promise<void>;
  setActionStatus(id: string, status: ActionStatus): Promise<void>;
  requestSource(key: SourceKey): Promise<void>;
  saveGoal(patch: Partial<Goal> & { id?: string; title?: string }): Promise<void>;
  setCapacity(c: Capacity): Promise<void>;
  resetDevice(): Promise<void>;
}
