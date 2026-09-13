// src/app/copilot/_components/CommissionThread.tsx
// What is being worked on, where it stands, and what is stopping it.
//
// The complaint this answers, in the words it was made in: "when I'm walking
// and open the app, all I see is some advice cards and a run agent button that
// changes nothing." Every other section on Now is an ask. This one is a report
// — the only place in the product that says what happened while nobody was
// looking, rather than what to do next.
//
// So the order inside the card is deliberate: what it got done, then what is
// blocked on you. Not the reverse. A thread that leads with its ask is another
// advice card with extra steps.

import { AUTHORITY } from '@/lib/copilot/commission';
import type { CommissionThread as Thread } from '@/lib/copilot/types';
import type { Actions } from './shared';
import { relTime } from './format';

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
        const ask = t.report.yours[0];
        const draft = c.status === 'draft';
        return (
          <button key={c.id} className={`cp-thread ${c.status}`} onClick={() => actions.openSheet({ kind: 'commission', id: c.id })}>
            <div className="hd">
              <span className="ob">{c.objective}</span>
              {/* Only ever a count of what is new. A dot that means "look at me"
                  without saying how much is the same nag every notification
                  badge is. */}
              {t.report.fresh > 0 && <span className="fresh">{t.report.fresh} new</span>}
            </div>
            <div className="ln">{t.line}</div>

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

            {draft && (
              <div className="grant">
                <div className="au">{AUTHORITY[c.authority].label} — {AUTHORITY[c.authority].blurb}</div>
                {/* Approving is one tap, but not from here: the plan is on the
                    sheet and granting authority without reading the plan is the
                    thing this whole layer exists to avoid. */}
                <span className="go">Read the plan and approve →</span>
              </div>
            )}
          </button>
        );
      })}
    </>
  );
}
