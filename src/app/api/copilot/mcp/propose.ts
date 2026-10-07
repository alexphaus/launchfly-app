// src/app/api/copilot/mcp/propose.ts
// The connector's two proposal tools, run for one person on a connection they
// let propose (lib/copilot/proposals.ts says what a proposal is and is not).
//
// Each is checked against the record as the app holds it now — today in the
// person's own zone, the price, how buyers find them, the shelf, what already
// waits — by the rule the person's own entry meets, and a refusal goes back to
// Claude as a tool error with the reason, so it can correct the call. A
// proposal that passes is kept in the inbox and nowhere else: not logged, not
// on the shelf, not counted.

import { betPrice } from '@/lib/copilot/lab';
import { salesCurrency } from '@/lib/copilot/metrics';
import type { ProposeToolName, ToolOutcome } from '@/lib/copilot/mcp';
import { foundOf } from '@/lib/copilot/proof';
import { openProposals, proposalLine, proposalRoom, proposeTalk, proposeTest } from '@/lib/copilot/proposals';
import { insertProposal, loadHome, loadProposals } from '@/lib/copilot/store';

export async function proposeTool(name: ProposeToolName, args: Record<string, unknown>, who: { pid: string; grant: string }): Promise<ToolOutcome> {
  const home = await loadHome(who.pid);
  if (!home) throw new Error('There is no account here any more');
  // Refused rather than checked against nothing: a shelf that did not read cannot say a test is already on it (invariant 13).
  if (home.lab?.unreadable) return { text: `The record could not be read just now, so nothing was proposed: ${home.lab.unreadable}`, isError: true };
  const stored = await loadProposals(who.pid);
  if (stored.unreadable) return { text: `What already waits could not be read just now, so nothing was proposed: ${stored.unreadable}`, isError: true };
  const today = home.recent.today;
  const open = openProposals(stored.rows, today);
  const full = proposalRoom(open);
  if (full) return { text: full, isError: true };
  const { price, priceLabel } = betPrice(home.profile.offer?.price_band, salesCurrency(home.profile.finance, home.goals));
  const ctx = { today, price, priceLabel, foundBy: foundOf(home).value, shelf: home.lab?.shelf ?? [], open };

  if (name === 'propose_conversation') {
    const r = proposeTalk(args, ctx);
    if (!r.ok) return { text: `${r.error} Nothing was proposed.`, isError: true };
    const id = await insertProposal(who.pid, { kind: 'talk', grant: who.grant, why: r.value.why, talk: r.value.talk });
    const line = proposalLine({ id, kind: 'talk', at: '', grant: who.grant, why: r.value.why, talk: r.value.talk, test: null });
    return { text: `Proposed, not logged: ${line}. It waits in their Copilot app under Needs you until they log it, change it or drop it, and counts for nothing until then.` };
  }
  const r = proposeTest(args, ctx);
  if (!r.ok) return { text: `${r.error} Nothing was proposed.`, isError: true };
  const id = await insertProposal(who.pid, { kind: 'test', grant: who.grant, why: r.value.why, test: r.value.test });
  const line = proposalLine({ id, kind: 'test', at: '', grant: who.grant, why: r.value.why, talk: null, test: r.value.test }, priceLabel);
  return { text: `Proposed, not kept: ${line}. It waits in their Copilot app under Needs you until they keep it on their shelf or drop it; only they start a bet.` };
}
