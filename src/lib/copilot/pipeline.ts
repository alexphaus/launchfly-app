// src/lib/copilot/pipeline.ts
// The pipeline is the real businesses, grouped by where each one actually is.
// Pure: store.ts loads the rows, this decides the stage. Unit-tested.
//
// It replaces a list of 133 matches headed "107 new". A count of things you have
// not touched is not a pipeline; the seven you messaged and the two who replied
// are.

import type { Execution, OutcomeKind } from './types';

export type PipelineStage = 'to_send' | 'sent' | 'replied' | 'meeting' | 'won' | 'lost' | 'not_drafted';

/** Display order: the ones that need a tap first, the ones that are over last. */
export const STAGE_ORDER: PipelineStage[] = ['to_send', 'sent', 'replied', 'meeting', 'won', 'lost', 'not_drafted'];

export const STAGE_LABEL: Record<PipelineStage, string> = {
  to_send: 'To send',
  sent: 'Sent, awaiting reply',
  replied: 'Replied',
  meeting: 'Meeting',
  won: 'Won',
  lost: 'Lost',
  not_drafted: 'Not drafted yet',
};

const OPEN = new Set<Execution['approval_state']>(['needs_approval', 'approved', 'failed']);

/**
 * Where one business is. The latest logged outcome wins, because it is the most
 * recent thing the user told us; a send only matters when nothing has come back.
 * "No reply" implies a send happened even when the app did not do it.
 */
export function stageOf(
  opp: { last_outcome?: OutcomeKind | null },
  exec: Pick<Execution, 'approval_state'> | null | undefined,
): PipelineStage {
  switch (opp.last_outcome) {
    case 'won': return 'won';
    case 'lost': return 'lost';
    case 'meeting':
    case 'proposal': return 'meeting';
    case 'reply': return 'replied';
    case 'no_reply': return 'sent';
    default: break;
  }
  if (exec?.approval_state === 'sent') return 'sent';
  if (exec && OPEN.has(exec.approval_state)) return 'to_send';
  return 'not_drafted';
}

/** Group rows by stage in display order, dropping empty stages. */
export function groupPipeline<T extends { stage: PipelineStage }>(rows: T[]): Array<{ stage: PipelineStage; rows: T[] }> {
  const by = new Map<PipelineStage, T[]>();
  for (const r of rows) by.set(r.stage, [...(by.get(r.stage) ?? []), r]);
  return STAGE_ORDER.filter((s) => by.has(s)).map((stage) => ({ stage, rows: by.get(stage)! }));
}
