'use client';
// Matches: everything it found outside the account, laid out and filtered.
//
// The morning this tab is for: you wake up, it went looking overnight, and here
// is who it found — businesses to pitch, gigs and roles to answer, people worth
// meeting, signals worth reading. One list, chips across the top, "new" on what
// arrived since yesterday. See lib/copilot/matches.ts for what is kept out.
//
// The deck is laid flat here, and it still learns. Every business is answered
// through the triage route, so "Draft opener" and "Not for me" feed the same
// keep-rate the swipe did and the next morning's order still follows what this
// person actually drafts.
//
// The queue gate survives the move. With forty drafts written and the oldest
// days old, another draft is avoidance, not progress — but a hard block on your
// own data gets routed around, so it is the pattern "Find new" already used:
// the first tap states the trade-off, the second proceeds anyway.
import { useState } from 'react';
import { MATCH_GROUPS, MATCH_GROUP_LABEL, type MatchGroup, type MatchItem } from '@/lib/copilot/matches';
import { PLANS } from '@/lib/copilot/plans';
import type { HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';
import { useShell } from '../shell';
import { QueueClear } from '../views/NowView';
import type { Derived } from './derive';
import { IconChevron, IconExternal } from './icons2';

/** Past this the list folds. Twenty is a morning's worth; two hundred is a database. */
const PAGE = 20;

export default function MatchesTab({ home, d, actions, finding }: { home: HomeData; d: Derived; actions: Actions; finding: boolean }) {
  const shell = useShell();
  const [group, setGroup] = useState<'all' | MatchGroup>('all');
  const [shown, setShown] = useState(PAGE);
  const [confirmFind, setConfirmFind] = useState(false);
  const items = group === 'all' ? d.feed : d.feed.filter((i) => i.group === group);
  const b = home.billing;
  const segments = home.profile.target_segments;
  const where = home.profile.target_area || home.profile.location;

  const find = () => (d.queueBacked && !confirmFind ? setConfirmFind(true) : void actions.findMatches());

  return (
    <>
      {/* The queue, first: drafts already written are worth more than any match
          below, because the work of choosing and writing is already done. */}
      {d.queueCount > 0 && !d.noOffer && (
        <div className="cp-card cp2-strip">
          <div className="cp-call-top">
            <div className="cp-eyebrow">Ready to send</div>
            {d.oldestDays > 0 && <span className="cp-chip">{d.oldestDays}d oldest</span>}
          </div>
          <h2 className="cp-call-head">{d.queueCount} draft{d.queueCount === 1 ? '' : 's'} written and waiting</h2>
          <button className="cp-btn primary block" onClick={() => actions.openSheet({ kind: 'queue' })}>Send them, one at a time</button>
          <QueueClear home={home} actions={actions} />
        </div>
      )}

      {d.feed.length > 0 && (
        <div className="cp2-chips" role="tablist" aria-label="Filter matches">
          <button role="tab" aria-selected={group === 'all'} className={`cp-fchip ${group === 'all' ? 'active' : ''}`} onClick={() => { setGroup('all'); setShown(PAGE); }}>
            All <span className="n">{d.counts.all}</span>
          </button>
          {MATCH_GROUPS.filter((g) => d.counts.by[g] > 0).map((g) => (
            <button key={g} role="tab" aria-selected={group === g} className={`cp-fchip ${group === g ? 'active' : ''}`} onClick={() => { setGroup(g); setShown(PAGE); }}>
              {MATCH_GROUP_LABEL[g]} <span className="n">{d.counts.by[g]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="cp-section">
        <span className="lead">Matched for you</span>
        <span className="count">{d.counts.fresh ? `${d.counts.fresh} new` : items.length ? `${items.length}` : ''}</span>
      </div>

      {!segments.length || !where ? (
        <div className="cp-card">
          <div className="cp-eyebrow">Nothing to look for yet</div>
          <p className="cp2-lede">Say which kinds of business you sell to, and where. It goes and finds real ones every night.</p>
          <button className="cp-btn primary block cp-call-do" onClick={() => actions.openSheet({ kind: 'targeting' })}>Choose who to look for</button>
        </div>
      ) : items.length ? (
        <>
          {items.slice(0, shown).map((i) => <MatchCard key={i.id} item={i} d={d} actions={actions} />)}
          {items.length > shown && (
            <button className="cp2-more" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, items.length - shown)} more of {items.length}</button>
          )}
        </>
      ) : (
        <div className="cp-empty">
          {finding
            ? <><b>Looking now</b>{segments.slice(0, 3).join(', ')} in {where}. Real listings, not a sample — the first pass takes a minute.</>
            : group === 'all'
            ? <><b>Nothing new to judge</b>Everything it found has been answered. The next pass runs tonight, or look now.</>
            : <><b>No {MATCH_GROUP_LABEL[group as MatchGroup].toLowerCase()} right now</b>{group === 'clients' ? 'Businesses come from your targeting.' : 'These come from the sources you watch.'}{' '}
                <button className="cp-textlink" onClick={() => (group === 'clients' ? actions.openSheet({ kind: 'targeting' }) : actions.openSheet({ kind: 'watchlist' }))}>
                  {group === 'clients' ? 'Change who it looks for' : 'Add a source'}
                </button></>}
        </div>
      )}

      {segments.length > 0 && where && (
        <div className="cp2-findrow">
          {confirmFind ? (
            <div className="cp-note">
              {d.queueCount} drafts are already written and the oldest has waited {d.oldestDays} days. More matches will not make them go out.
              {' '}<button className="cp-textlink" onClick={() => { setConfirmFind(false); actions.openSheet({ kind: 'queue' }); }}>Open the queue</button>
              {' · '}<button className="cp-textlink" onClick={() => { setConfirmFind(false); void actions.findMatches(); }}>Find anyway</button>
            </div>
          ) : (
            <button className="cp-btn block" disabled={finding || b.matches.remaining === 0} onClick={find}>
              {finding ? 'Looking…' : b.matches.remaining === 0 ? 'No matches left this month' : 'Find more now'}
            </button>
          )}
          <p className="cp-help">
            {segments.slice(0, 3).join(', ')} in {where} · {b.matches.remaining.toLocaleString()} match{b.matches.remaining === 1 ? '' : 'es'} left this month.{' '}
            <button className="cp-textlink" onClick={() => actions.openSheet({ kind: 'targeting' })}>Change</button>
          </p>
        </div>
      )}

      {b.matches.remaining === 0 && b.effective !== 'operator' && (
        <div className="cp-card cp-wall">
          <div className="cp-eyebrow">Out of matches</div>
          <p>You have used all {b.matches.limit} on {PLANS[b.effective].name} this month. Everything else keeps running on what you already have — only new supply stops.</p>
          <a className="cp-btn primary block" href={`${shell}/pricing`}>
            See plans — {PLANS[b.effective === 'free' ? 'pro' : 'operator'].limits.matchesPerMonth.toLocaleString()} a month
          </a>
        </div>
      )}
    </>
  );
}

/**
 * One match. What it is, why it is here, and the one or two things to do about
 * it — in the card, so the answer leaves with the thing it was about.
 */
function MatchCard({ item, d, actions }: { item: MatchItem; d: Derived; actions: Actions }) {
  const [busy, setBusy] = useState(false);
  const [gated, setGated] = useState(false);
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  // A deck card from a feed has no sheet behind it — its whole content is on the
  // card — so its body is text, not a button that does nothing.
  const openable = item.from === 'business' || item.answer === 'move';
  const open = () => (item.from === 'business' ? actions.openSheet({ kind: 'opp', id: item.id }) : actions.openSheet({ kind: 'move', id: item.id }));
  const skip = () => act(() => (item.answer === 'move' ? actions.answerMove(item.id, 'dismissed') : actions.triage(item.id, 'skip')));
  const keep = () => act(() => (item.answer === 'move' ? actions.answerMove(item.id, 'done') : actions.triage(item.id, 'draft')));
  const draft = () => {
    // Invariant 1, at the button: with no offer there is nothing to write from.
    if (d.noOffer) return actions.openSheet({ kind: 'offer' });
    if (d.queueBacked && !gated) return setGated(true);
    setGated(false);
    return act(() => actions.draftFromMatch(item.id));
  };

  return (
    <div className={`cp-card cp2-match ${item.fresh ? 'fresh' : ''}`}>
      <div className="cp2-match-top">
        <span className="cp-eyebrow">{item.tag || MATCH_GROUP_LABEL[item.group]}</span>
        {item.fresh && <span className="cp2-new">New</span>}
        {item.saved && <span className="cp2-new saved">Saved</span>}
        <span className="cp2-via">{item.from === 'feed' ? (item.costLabel || 'From a source you watch') : item.channel === 'whatsapp' ? 'WhatsApp' : item.channel === 'email' ? 'Email' : 'Link only'}</span>
      </div>
      {openable ? (
        <button className="cp2-match-body" onClick={open}>
          <span className="cp2-match-title">{item.title}</span>
          {item.reason && <span className="cp2-match-reason">{item.reason}</span>}
        </button>
      ) : (
        <div className="cp2-match-body">
          <span className="cp2-match-title">{item.title}</span>
          {item.reason && <span className="cp2-match-reason">{item.reason}</span>}
        </div>
      )}

      {gated && (
        <div className="cp-note cp2-gate">
          {d.queueCount} drafts are already written, the oldest {d.oldestDays} days. Another will not make them go out.
          {' '}<button className="cp-textlink" onClick={() => { setGated(false); actions.openSheet({ kind: 'queue' }); }}>Send those first</button>
          {' · '}<button className="cp-textlink" onClick={draft}>Draft anyway</button>
        </div>
      )}

      <div className="cp2-match-acts">
        {item.from === 'business' ? (
          item.channel
            ? <button className="cp-btn primary" disabled={busy} onClick={draft}>{d.noOffer ? 'Set your offer first' : busy ? 'Drafting…' : 'Draft opener'}</button>
            : item.url && <a className="cp-btn primary" href={item.url} target="_blank" rel="noreferrer">Look them up <IconExternal /></a>
        ) : (
          <>
            {item.url && <a className="cp-btn primary" href={item.url} target="_blank" rel="noreferrer">Open it <IconExternal /></a>}
            <button className="cp-btn" disabled={busy} onClick={() => void keep()}>Keep</button>
          </>
        )}
        <button className="cp-btn ghost" disabled={busy} onClick={() => void skip()}>Not for me</button>
        {item.from === 'business' && <button className="cp2-more-info" onClick={open} aria-label={`More about ${item.title}`}><IconChevron /></button>}
      </div>
    </div>
  );
}
