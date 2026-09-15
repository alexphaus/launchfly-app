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
// The second time it went wrong was subtler and worse. A worker whose search
// tool was returning 500s produced a card reading "NEEDS YOU", identical to one
// holding a real question — so a morning with three handed-over jobs showed
// three things the user had apparently failed to do, two of which were an
// outage. The section stopped being a report and became a fault list. A
// breakage now says it is a breakage and offers the only thing that helps,
// which is another go.

import { blockedOn, commissionChip, commissionTerms } from '@/lib/copilot/commission';
import type { CommissionThread as Thread } from '@/lib/copilot/types';
import type { Actions } from './shared';
import { relTime } from './format';

/** One dot per planned step, filled as they finish. */
function Steps({ done, total }: { done: number; total: number }) {
  // Nothing until something moves. Four hollow circles and "0 of 4 done" on a
  // job that died on its first tool call is a progress report about no
  // progress — and it implied a run was under way when none was.
  if (!total || done < 1) return null;
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
  // Finished jobs live in the sheet, not on Today. A card that says "done"
  // for a fortnight is the screen congratulating itself.
  const live = threads.filter((t) => t.commission.status !== 'done' && t.commission.status !== 'stopped');

  return (
    <>
      <div className="cp-section">
        <span className="lead">Working on</span>
        {/* The entry point. It used to exist only inside a saved goal's sheet,
            four taps down, so the only way to hand work over was to already
            know it was there — and an account with no goal had no way in at
            all, with nothing anywhere saying so. */}
        <button className="cp-connect" onClick={() => actions.openSheet({ kind: 'handover' })}>
          Hand something over
        </button>
      </div>

      {!live.length && (
        <p className="cp-help" style={{ marginTop: -4 }}>
          Nothing running. Hand over something you would otherwise do yourself — research, a
          comparison, a shortlist — and read what comes back.
        </p>
      )}

      {live.map((t) => {
        const c = t.commission;
        const chip = commissionChip(c, t.report);
        const waiting = blockedOn(c, t.report);
        // Only while it is actually stopped on one. `yours` is every question
        // ever raised, so an answered job went on showing the question it had
        // already been given the answer to.
        const ask = waiting === 'you' ? t.report.yours[0] : null;
        const fault = waiting === 'worker' ? t.report.stopped[0] : null;
        return (
          <button key={c.id} className={`cp-thread ${c.status}${fault ? ' fault' : ''}`} onClick={() => actions.openSheet({ kind: 'commission', id: c.id })}>
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

            {/* A breakage, said once and plainly. Not dressed as a question,
                because nobody can answer a 500. */}
            {fault && (
              <>
                <div className="ev broke"><span className="tx">{fault.summary}</span><span className="ag">{relTime(fault.at)}</span></div>
                <div className="go">Open it and try again →</div>
              </>
            )}

            {/* What it got done. Two lines, newest first — enough to tell
                whether it is worth keeping, not a transcript. */}
            {!fault && t.report.did.slice(0, 2).map((e) => (
              <div key={e.id} className="ev">
                <span className={`dot ${e.kind}`} />
                <span className="tx">{e.summary}</span>
                <span className="ag">{relTime(e.at)}</span>
              </div>
            ))}

            {/* The only ask on the card, and it comes last. */}
            {ask && <div className="ask">{ask.summary}</div>}

            {c.status === 'draft' && <div className="go">Read it and approve →</div>}
            {c.status === 'active' && !t.report.did.length && (
              <div className="terms quiet">Nothing back yet. Open it to hand it over now.</div>
            )}
          </button>
        );
      })}
    </>
  );
}
