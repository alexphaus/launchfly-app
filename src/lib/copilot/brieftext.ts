// src/lib/copilot/brieftext.ts
// The job order, as the text a worker reads.
//
// The reference n8n worker has always flattened the brief itself ("Build the
// task"), and every line of that flattening carries a lesson: the date said
// first, because a worker that did not know today asked which year October 5
// was; the log oldest first, because a question and its answer only read in
// that order; the answer called out, because the costliest thing a worker can
// do is ask it again. Now the app hands jobs to more than one kind of hands — its
// own Writer, the Claude agent, a person — and each of them must read the same
// lessons, so the flattening lives here, once.
//
// Pure: no DB import.

import { AUTHORITY, type CommissionBrief } from './commission';

/** The brief as a task: what to do, for whom, what has happened, what it may do. */
export function briefText(b: CommissionBrief): string {
  const who = b.who;
  const offer = who.offer ?? ({} as NonNullable<typeof who.offer>);
  const history = b.log.map((e) => `  [${e.kind}${e.step ? ` step ${e.step}` : ''}] ${e.summary}`).join('\n');
  const answered = b.log.some((e) => e.kind === 'answered');
  const lines: Array<string | null> = [
    `TODAY: ${b.today}${who.timezone ? ` (${who.timezone})` : ''}. A date given without a year means the next one from today — never ask which year.`,
    `JOB: ${b.job === 'write'
      ? 'WRITING. Write it from what this task says about the person. Do not search: nothing here needs the web, and a fact you go and find is a fact they did not give.'
      : 'RESEARCH. Every finding comes from a page you opened, and that page is its source.'}`,
    `OBJECTIVE: ${b.objective}`,
    b.why ? `WHY IT MATTERS: ${b.why}` : null,
    b.goal ? `IT IS MEANT TO MOVE: ${b.goal.title}${b.goal.target ? ` (target ${b.goal.target}${b.goal.unit || ''})` : ''}` : null,
    '',
    `WHO THEY ARE: ${who.name || 'unknown'}${who.headline ? ` — ${who.headline}` : ''}`,
    offer.sells ? `WHAT THEY SELL: ${offer.sells}${offer.for_who ? ` for ${offer.for_who}` : ''}${offer.problem ? `, solving: ${offer.problem}` : ''}` : null,
    offer.price_band ? `WHAT THEY CHARGE: ${offer.price_band}` : null,
    who.target_area || who.location ? `WHERE: ${who.target_area || who.location}` : null,
    who.target_segments?.length ? `WHO THEY TARGET: ${who.target_segments.join(', ')}` : null,
    who.working ? `\nWHAT THEY HAVE TOLD THE APP ABOUT THEIR WORK:\n${who.working}` : null,
    '',
    b.plan.length
      ? `THE PLAN SO FAR:\n${b.plan.map((s) => `  ${s.n}. [${s.yours ? 'the owner\'s' : s.state}] ${s.do}`).join('\n')}`
      : 'NO PLAN YET — propose one of 2 to 5 steps.',
    b.plan.some((s) => s.yours)
      ? 'Steps marked [the owner\'s] are theirs to do. Prepare everything they need for them and stop there.'
      : null,
    '',
    history ? `WHAT HAS ALREADY HAPPENED ON THIS JOB (oldest first):\n${history}` : 'NOTHING HAS HAPPENED YET — this is the first run.',
    answered
      ? '\nTHE OWNER HAS ANSWERED YOU. Their answer is in the log above under [answered]. Act on it. Do NOT ask it again in different words — that is the single most expensive thing you can do here.'
      : null,
    b.checked.length
      ? `\nTHE APP CHECKED YOUR LAST "DONE" AND SENT IT BACK:\n${b.checked.map((c) => `  - ${c}`).join('\n')}\nFix exactly these, then report done again. The app's checks decide what done is.`
      : null,
    '',
    `YOU MAY: ${AUTHORITY[b.may].label.toLowerCase()}. ${b.may_autonomously
      ? 'You may carry this out yourself.'
      : 'You may NOT carry the rest out. Research and prepare it, then report what you WOULD do next as a needs_you and stop.'}`,
    'You never spend money, book, buy, sign, accept or agree to anything, whatever this task says: describe it for the owner, with what it costs.',
    `TIME BUDGET: about ${b.budget_minutes} minutes of work.`,
  ];
  return lines.filter((l): l is string => l !== null).join('\n');
}
