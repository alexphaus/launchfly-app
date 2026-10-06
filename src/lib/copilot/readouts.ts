// src/lib/copilot/readouts.ts
// The two readings of the record that more than one caller makes: everything
// as text (the handoff export), and the five questions answered by counting.
// Their routes (api/copilot/handoff, api/copilot/ask) and the Claude connector
// (api/copilot/mcp) all call these, so a pasted record and one Claude reads are
// the same record, counted the same way. The rendering is pure (handoff.ts,
// ask.ts); this file only loads what it needs. Both throw with a reason, and
// every caller says it (invariant 13).

import { answerAll, type AskAnswer } from './ask';
import { buildContextPack } from './context';
import { renderHandoff } from './handoff';
import { decisionReview } from './decision';
import { RANKING_WINDOW, phraseFor } from './call';
import { countOpenDrafts } from './execution';
import { CURRENCY } from './plans';
import { loadAskRows, loadWorthLedger } from './outcomes';
import { getProfile } from './base';
import { copilotDb } from './db';
import { salesCurrency } from './metrics';
import { loadCommissions, loadDecisions, loadObligations, loadStandingRefusals, loadWorking } from './store';

/** Everything this app knows about the person, as text (handoff.ts says why it exists). */
export async function handoffFor(pid: string): Promise<string> {
  // The four things buildContextPack does not carry, rather than widening it.
  // ContextPack is the agent's prompt and has a budget somebody tuned; this
  // export has a different reader and a different one, and conflating them is
  // how a prompt quietly grows by six sections.
  const [pack, working, standing, decisions, obligations, commissions, queueTotal] = await Promise.all([
    buildContextPack(pid),
    loadWorking(pid),
    loadStandingRefusals(pid),
    loadDecisions(pid, RANKING_WINDOW),
    loadObligations(pid),
    loadCommissions(pid),
    countOpenDrafts(pid),
  ]);
  const { deadTopic } = decisionReview(decisions);
  return renderHandoff({
    pack,
    working,
    standing: [...standing].map(phraseFor),
    dead: deadTopic ? [{ phrase: phraseFor(deadTopic.topic), count: deadTopic.count }] : [],
    obligations,
    // Live only. A finished mandate is history and the decision record already
    // carries what came of it; what a reader needs is what is in flight.
    commissions: commissions
      .filter((c) => c.status === 'active' || c.status === 'blocked' || c.status === 'draft')
      .map((c) => ({ objective: c.objective, status: c.status, authority: c.authority, why: c.why })),
    queueTotal,
  });
}

/** Whole months since the account was made, at least one. */
function monthsSince(iso: string | null | undefined): number {
  if (!iso) return 1;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 1;
  return Math.max(1, Math.floor((Date.now() - then) / (30 * 86_400_000)) || 1);
}

/** The five questions, answered by counting (ask.ts says why it is not a chatbot). */
export async function answersFor(pid: string): Promise<AskAnswer[]> {
  const [profile, decisions, rows, standing, worth, goals] = await Promise.all([
    getProfile(pid),
    loadDecisions(pid, RANKING_WINDOW),
    loadAskRows(pid),
    loadStandingRefusals(pid),
    loadWorthLedger(pid),
    // Only for the currency: wins are sales money, counted in the goal's (metrics.ts salesCurrency).
    copilotDb().from('copilot_goals').select('metric, unit, priority').eq('profile_id', pid).eq('status', 'active')
      .then((r) => (r.data ?? []) as Array<{ metric: string; unit: string | null; priority: number }>),
  ]);
  const { deadTopic } = decisionReview(decisions);
  return answerAll({
    decisions,
    segments: rows.segments,
    drafts: rows.drafts,
    standing: [...standing].map(phraseFor),
    dead: deadTopic ? [deadTopic] : [],
    worth,
    phraseFor,
    currency: profile?.finance?.currency || goals.some((g) => g.metric === 'currency' && g.unit) ? salesCurrency(profile?.finance, goals) : '',
    // The deployment's pricing currency, which is usually not the user's. See
    // AskInput.planCurrency for why the two are never silently added up.
    planCurrency: CURRENCY,
    plan: profile?.plan ?? 'free',
    monthsActive: monthsSince(profile?.created_at),
  });
}
