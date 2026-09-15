// src/app/copilot/_components/CommissionThread.tsx
// One handed-over job, as a card. The zones it renders into are Now's.
//
// The complaint this answers, in the words it was made in: "when I'm walking
// and open the app, all I see is some advice cards and a run agent button that
// changes nothing." Handed-over work is the only thing in the product that
// reports rather than asks — the only answer to "what happened while I was not
// looking".
//
// Which is why it stopped owning a section of its own. A job is not one kind of
// thing on this screen: one waiting on an answer belongs with everything else
// that needs a person, and one quietly making progress belongs with everything
// else that happened overnight. Grouping them together under "Working on"
// meant the screen alternated between asking and reporting four times going
// down the page — see splitThreads.
//
// The other thing that went wrong here was subtler. A worker whose search tool
// was returning 500s produced a card reading "NEEDS YOU", identical to one
// holding a real question — so a morning with three jobs showed three things
// the user had apparently failed to do, two of which were an outage. A
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

export function JobCard({ thread, actions }: { thread: Thread; actions: Actions }) {
  const c = thread.commission;
  const chip = commissionChip(c, thread.report);
  const waiting = blockedOn(c, thread.report);
  // Only while it is actually stopped on one. `yours` is every question ever
  // raised, so an answered job went on showing the question it had already been
  // given the answer to.
  const ask = waiting === 'you' ? thread.report.yours[0] : null;
  const fault = waiting === 'worker' ? thread.report.stopped[0] : null;

  return (
    <button
      className={`cp-thread ${c.status}${fault ? ' fault' : ''}`}
      onClick={() => actions.openSheet({ kind: 'commission', id: c.id })}
    >
      <div className="hd">
        <span className={`chip ${chip.tone}`}>{chip.label}</span>
        {/* Only ever a count of what is new. A dot that means "look at me"
            without saying how much is the same nag every notification badge is. */}
        {thread.report.fresh > 0 && <span className="fresh">{thread.report.fresh} new</span>}
      </div>

      <div className="ob">{c.objective}</div>

      {c.status === 'draft'
        ? <div className="terms">{commissionTerms(c)}</div>
        : <Steps done={thread.report.progress.done} total={thread.report.progress.total} />}

      {/* A breakage, said once and plainly. Not dressed as a question, because
          nobody can answer a 500. */}
      {fault && (
        <>
          <div className="ev broke"><span className="tx">{fault.summary}</span><span className="ag">{relTime(fault.at)}</span></div>
          <div className="go">Open it and try again →</div>
        </>
      )}

      {/* What it got done. Two lines, newest first — enough to tell whether it
          is worth keeping, not a transcript. */}
      {!fault && thread.report.did.slice(0, 2).map((e) => (
        <div key={e.id} className="ev">
          <span className={`dot ${e.kind}`} />
          <span className="tx">{e.summary}</span>
          <span className="ag">{relTime(e.at)}</span>
        </div>
      ))}

      {/* The only ask on the card, and it comes last. */}
      {ask && <div className="ask">{ask.summary}</div>}

      {c.status === 'draft' && <div className="go">Read it and approve →</div>}
      {c.status === 'active' && !thread.report.did.length && (
        <div className="terms quiet">Nothing back yet. Open it to hand it over now.</div>
      )}
    </button>
  );
}

export default function JobList({ threads, actions }: { threads: Thread[]; actions: Actions }) {
  return <>{threads.map((t) => <JobCard key={t.commission.id} thread={t} actions={actions} />)}</>;
}
