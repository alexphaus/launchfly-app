// src/lib/copilot/metrics.ts
// Pure computation of the numbers the read must cite. No database access here;
// store.ts loads the rows, this turns them into Metrics. Fully unit-testable.

import type { Execution, Finance, Metrics, Opportunity, Outcome } from './types';

export interface MetricsInput {
  executions: Array<Pick<Execution, 'approval_state' | 'sent_at' | 'created_at'>>;
  outcomes: Array<Pick<Outcome, 'kind' | 'amount' | 'occurred_at'>>;
  opportunities: Array<Pick<Opportunity, 'status' | 'source_kind'>>;
  finance: Finance;
  windowDays?: number;
  now?: Date;
}

export function computeRunwayMonths(f: Finance): number | null {
  if (!f || !f.monthly_burn || f.monthly_burn <= 0 || f.cash == null) return null;
  return Math.round((f.cash / f.monthly_burn) * 10) / 10;
}

export function computeMetrics(input: MetricsInput): Metrics {
  const windowDays = input.windowDays ?? 30;
  const now = input.now ?? new Date();
  const since = now.getTime() - windowDays * 86_400_000;
  const inWindow = (iso: string | null | undefined) => !!iso && new Date(iso).getTime() >= since;

  const sent = input.executions.filter((e) => e.approval_state === 'sent' && inWindow(e.sent_at)).length;
  const awaiting_approval = input.executions.filter((e) => e.approval_state === 'needs_approval' || e.approval_state === 'approved').length;

  const recent = input.outcomes.filter((o) => inWindow(o.occurred_at));
  const count = (k: Outcome['kind']) => recent.filter((o) => o.kind === k).length;
  const replies = count('reply');
  const meetings = count('meeting');
  const won = count('won');
  const lost = count('lost');
  const won_amount = recent.filter((o) => o.kind === 'won').reduce((sum, o) => sum + (o.amount ?? 0), 0);

  const pipeline = {
    new: input.opportunities.filter((o) => o.status === 'new').length,
    saved: input.opportunities.filter((o) => o.status === 'saved').length,
    sourced: input.opportunities.filter((o) => o.source_kind === 'sourced' && (o.status === 'new' || o.status === 'saved')).length,
    inferred: input.opportunities.filter((o) => o.source_kind === 'inferred' && (o.status === 'new' || o.status === 'saved')).length,
  };

  return {
    window_days: windowDays,
    sent,
    replies,
    reply_rate: sent > 0 ? Math.round((replies / sent) * 1000) / 1000 : null,
    meetings,
    won,
    won_amount,
    lost,
    awaiting_approval,
    pipeline,
    runway_months: computeRunwayMonths(input.finance),
  };
}

/** One-line, human version for the agent prompt and the starter insight. */
export function describeMetrics(m: Metrics, currency = '$'): string {
  const parts: string[] = [];
  if (m.sent > 0) parts.push(`${m.sent} sent, ${m.replies} repl${m.replies === 1 ? 'y' : 'ies'} (${Math.round((m.reply_rate ?? 0) * 100)}%) in the last ${m.window_days} days`);
  else parts.push(`nothing sent in the last ${m.window_days} days`);
  if (m.meetings) parts.push(`${m.meetings} meeting${m.meetings === 1 ? '' : 's'}`);
  if (m.won) parts.push(`${m.won} won for ${currency}${m.won_amount.toLocaleString()}`);
  if (m.lost) parts.push(`${m.lost} lost`);
  parts.push(`${m.pipeline.sourced} real match${m.pipeline.sourced === 1 ? '' : 'es'} in the pipeline`);
  if (m.awaiting_approval) parts.push(`${m.awaiting_approval} draft${m.awaiting_approval === 1 ? '' : 's'} waiting for approval`);
  if (m.runway_months != null) parts.push(`${m.runway_months} months of runway`);
  return parts.join('; ');
}
