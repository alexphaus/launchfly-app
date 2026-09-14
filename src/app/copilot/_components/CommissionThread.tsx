// src/app/copilot/_components/CommissionThread.tsx
// What is being worked on, where it stands, and what is stopping it.
//
// The complaint this answers, in the words it was made in: "when I'm walking
// and open the app, all I see is some advice cards and a run agent button that
// changes nothing." Every other section on Now is an ask. This one is a report
// — the only place in the product that says what happened while nobody was
// looking, rather than what to do next.
//
// So the order inside the card is deliberate: state, then what it got done,
// then what is blocked on you. A thread that leads with its ask is another
// advice card with extra steps.
//
// The first version said everything in prose, in one grey: the state was a
// caption, progress was a phrase, and a draft carried two sentences of
// authority blurb it had already said on the sheet. This one puts the three
// things somebody reads at arm's length — is it running, how far, what does it
// want — into a chip, a row of dots and one line.

import { commissionChip, commissionTerms } from '@/lib/copilot/commission';
import type { CommissionThread as Thread } from '@/lib/copilot/types';
import type { Actions } from './shared';
import { relTime } from './format';

/** One dot per planned step, filled as they finish. */
function Steps({ done, total }: { done: number; total: number }) {
  if (!total) return null;
  return (
    <div className="cp-thread-steps">
      <span className="dots">
        {Array.from({ length: Math.min(total, 8) }, (_, i) => (
          <i key={i} className={i < done ? 'on' : ''} />
        ))}
      </span>
      <span className="n">{done} of {total} done</span>
    </div>
  );
}

export default function CommissionThread({ threads, actions }: { threads: Thread[]; actions: Actions }) {
  // Finished mandates live in the sheet, not on Today. A card that says "done"
  // for a fortnight is the screen congratulating itself.
  const live = threads.filter((t) => t.commission.status !== 'done' && t.commission.status !== 'stopped');
  if (!live.length) return null;

  return (
    <>
      <div className="cp-section">
        <span className="lead">Working on</span>
        <span className="count">{live.length === 1 ? '1 commission' : `${live.length} commissions`}</span>
      </div>
      {live.map((t) => {
        const c = t.commission;
        const chip = commissionChip(c);
        const ask = t.report.yours[0];
        return (
          <button key={c.id} className={`cp-thread ${c.status}`} onClick={() => actions.openSheet({ kind: 'commission', id: c.id })}>
            <div className="hd">
              <span className={`chip ${chip.tone}`}>{chip.label}</span>
              {/* Only ever a count of what is new. A dot that means "look at me"
                  without saying how much is the same nag every notification
                  badge is. */}
              {t.report.fresh > 0 && <span className="fresh">{t.report.fresh} new</span>}
            </div>

            <div className="ob">{c.objective}</div>

            {c.status === 'draft'
              ? <div className="terms">{commissionTerms(c)}</div>
              : <Steps done={t.report.progress.done} total={t.report.progress.total} />}

            {/* What it got done. Two lines, newest first — enough to tell
                whether the mandate is worth keeping, not a transcript. */}
            {t.report.did.slice(0, 2).map((e) => (
              <div key={e.id} className="ev">
                <span className={`dot ${e.kind}`} />
                <span className="tx">{e.summary}</span>
                <span className="ag">{relTime(e.at)}</span>
              </div>
            ))}

            {/* The only ask on the card, and it comes last. */}
            {ask && <div className="ask">{ask.summary}</div>}

            {c.status === 'draft' && <div className="go">Read the plan and approve →</div>}
            {c.status === 'active' && !t.report.did.length && (
              <div className="terms quiet">Nothing back yet. Open it to hand it over now.</div>
            )}
          </button>
        );
      })}
    </>
  );
}
