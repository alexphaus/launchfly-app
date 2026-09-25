'use client';
// Matches: who is worth contacting, from the night it is found to the reply.
//
// The morning this tab is for: you wake up, it went looking overnight, and here
// is who it found — businesses to pitch, gigs and roles to answer, people worth
// meeting, signals worth reading. See lib/copilot/matches.ts for what is kept
// out, and why a poor fit is folded rather than listed.
//
// Four stages across the top — New, To send, Waiting, Replied — and one shown at
// a time. The send queue used to be a card above the list: the largest thing on
// the screen whatever it held, so one draft outweighed sixty matches. As a stage
// it is one tap away and sized by what is in it. The bar is hidden until there is
// a second stage to show, so a new account sees a list, not an empty pipeline.
//
// Every card leads with a tile — the listing's photo when it came with one,
// initials otherwise — and a line saying what it is and where, because a list is
// scanned before it is read, and "Dental laboratory · Toledo, OH" says in one
// glance what sixty cards labelled "M" never did.
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
import {
  MATCH_GROUPS, MATCH_GROUP_LABEL, MATCH_STAGES, MATCH_STAGE_LABEL, tintOf,
  type MatchGroup, type MatchItem, type MatchStage, type StageCard,
} from '@/lib/copilot/matches';
import { PLANS } from '@/lib/copilot/plans';
import type { HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';
import { useShell } from '../shell';
import { QueueClear } from '../views/NowView';
import type { Derived } from './derive';
import { IconChevron, IconExternal, MatchGlyph } from './icons2';

/** Past this the list folds. Twenty is a morning's worth; two hundred is a database. */
const PAGE = 20;

export default function MatchesTab({ home, d, actions, finding }: { home: HomeData; d: Derived; actions: Actions; finding: boolean }) {
  const [picked, setPicked] = useState<MatchStage>('new');
  const count: Record<MatchStage, number> = {
    new: d.counts.all,
    to_send: d.stages.to_send.length,
    waiting: d.stages.waiting.length,
    replied: d.stages.replied.length,
  };
  // A stage emptied by the last answer — the last draft sent — falls back to
  // New, rather than leaving an empty list under a tab that has left the bar.
  const stage: MatchStage = picked !== 'new' && count[picked] === 0 ? 'new' : picked;
  const bar = MATCH_STAGES.filter((s) => s === 'new' || count[s] > 0);

  return (
    <>
      {bar.length > 1 && (
        <div className="cp2-stagebar" role="tablist" aria-label="Where they are">
          {bar.map((s) => (
            <button key={s} role="tab" aria-selected={stage === s} className={stage === s ? 'on' : ''} onClick={() => setPicked(s)}>
              {MATCH_STAGE_LABEL[s]} <span className="n">{count[s]}</span>
            </button>
          ))}
        </div>
      )}
      {stage === 'new'
        ? <NewMatches home={home} d={d} actions={actions} finding={finding} onSendFirst={() => setPicked('to_send')} />
        : <StageList stage={stage} home={home} d={d} actions={actions} />}
    </>
  );
}

function NewMatches({ home, d, actions, finding, onSendFirst }: { home: HomeData; d: Derived; actions: Actions; finding: boolean; onSendFirst: () => void }) {
  const shell = useShell();
  const [group, setGroup] = useState<'all' | MatchGroup>('all');
  const [shown, setShown] = useState(PAGE);
  const [showPoor, setShowPoor] = useState(false);
  const [confirmFind, setConfirmFind] = useState(false);
  // A chip whose last item was just answered disappears from the row, so it
  // cannot stay selected — that left an empty list under no active chip.
  const active: 'all' | MatchGroup = group !== 'all' && d.counts.by[group] === 0 ? 'all' : group;
  const items = active === 'all' ? d.good : d.good.filter((i) => i.group === active);
  // One kind of thing is not a filter: "All 60 · Clients 60" was two chips
  // saying the same number.
  const groups = MATCH_GROUPS.filter((g) => d.counts.by[g] > 0);
  const b = home.billing;
  const { what, where } = d.looking;
  // Targeting only drives businesses. Feed finds arrive without it, so a
  // missing segment must not hide them — somebody watching job feeds with no
  // businesses to pitch would otherwise have finds on Today and nowhere to open them.
  const noTargeting = !what || !where;

  const find = () => (d.queueBacked && !confirmFind ? setConfirmFind(true) : void actions.findMatches());

  return (
    <>
      {/* The search, always in view. It is the one input on this tab that decides
          everything under it, and it was invisible: a segment of "m" searched
          nightly and the only trace on screen was a letter on every card. */}
      {!noTargeting && (
        <button className="cp2-lookfor" onClick={() => actions.openSheet({ kind: 'targeting' })}>
          <span className="cp2-lookfor-l">Looking for</span>
          <span className="cp2-lookfor-v"><b>{what}</b> in <b>{where}</b></span>
          <span className="cp2-lookfor-c">Change</span>
        </button>
      )}

      {groups.length > 1 && (
        <div className="cp2-chips" role="tablist" aria-label="Filter matches">
          <button role="tab" aria-selected={active === 'all'} className={`cp-fchip ${active === 'all' ? 'active' : ''}`} onClick={() => { setGroup('all'); setShown(PAGE); }}>
            All <span className="n">{d.counts.all}</span>
          </button>
          {groups.map((g) => (
            <button key={g} role="tab" aria-selected={active === g} className={`cp-fchip ${active === g ? 'active' : ''}`} onClick={() => { setGroup(g); setShown(PAGE); }}>
              {MATCH_GROUP_LABEL[g]} <span className="n">{d.counts.by[g]}</span>
            </button>
          ))}
        </div>
      )}

      {/* The ranker already says so in each card's reason; this says it once, at
          the top, with the cause and the fix. Sixty poor fits under "Matched for
          you" is a search pointed at the wrong world, not a busy night. */}
      {d.fit.majority && (
        <div className="cp-card cp2-poorfit">
          <div className="cp-eyebrow">Mostly poor fits</div>
          <p className="cp2-lede">
            It judged {d.fit.weak} of {d.fit.judged} a poor fit for what you sell. That is usually the search, not the market
            {what && where ? <> — right now it looks for <b>{what}</b> in <b>{where}</b>.</> : '.'}
          </p>
          <button className="cp-btn primary block" onClick={() => actions.openSheet({ kind: 'targeting' })}>Change what it looks for</button>
        </div>
      )}

      {/* No heading over nothing: with every find folded as a poor fit, the card
          above has already said what there is. */}
      {(items.length > 0 || !d.fit.majority) && (
        <div className="cp-section">
          <span className="lead">Matched for you</span>
          <span className="count">{d.counts.fresh ? `${d.counts.fresh} new` : ''}</span>
        </div>
      )}

      {items.length ? (
        <>
          {noTargeting && (
            <div className="cp-note">
              No businesses are being searched for yet — these came from sources you watch.
              {' '}<button className="cp-textlink" onClick={() => actions.openSheet({ kind: 'targeting' })}>Choose who to look for</button>
            </div>
          )}
          {items.slice(0, shown).map((i) => <MatchCard key={i.id} item={i} d={d} actions={actions} onSendFirst={onSendFirst} />)}
          {items.length > shown && (
            <button className="cp2-more" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, items.length - shown)} more of {items.length}</button>
          )}
        </>
      ) : noTargeting && !d.poor.length ? (
        <div className="cp-card">
          <div className="cp-eyebrow">Nothing to look for yet</div>
          <p className="cp2-lede">Say which kinds of business you sell to, and where. It goes and finds real ones every night.</p>
          <button className="cp-btn primary block cp-call-do" onClick={() => actions.openSheet({ kind: 'targeting' })}>Choose who to look for</button>
        </div>
      ) : d.fit.majority ? null : (
        <div className="cp-empty">
          {finding
            ? <><b>Looking now</b>{what} in {where}. Real listings, not a sample — the first pass takes a minute.</>
            : d.poor.length
            ? <><b>Nothing that fits yet</b>What it found, it judged a poor fit for what you sell. They are folded below.</>
            : <><b>Nothing new to judge</b>Everything it found has been answered. The next pass runs tonight, or look now.</>}
        </div>
      )}

      {/* Folded, never dropped: a ranker can be wrong, and the reason on each card
          says why it thought so. Under "All" only — a chip filters the list. */}
      {d.poor.length > 0 && active === 'all' && (
        showPoor ? (
          <>
            <div className="cp-section">
              <span className="lead">Poor fits</span>
              <span className="count">{d.poor.length}</span>
            </div>
            {d.poor.slice(0, PAGE).map((i) => <MatchCard key={i.id} item={i} d={d} actions={actions} onSendFirst={onSendFirst} />)}
            {d.poor.length > PAGE && <div className="cp-note">Showing {PAGE} of {d.poor.length}. Change what it looks for rather than scrolling these.</div>}
          </>
        ) : (
          <button className="cp2-more" onClick={() => setShowPoor(true)}>
            Show {d.poor.length} poor fit{d.poor.length === 1 ? '' : 's'}
          </button>
        )
      )}

      {!noTargeting && (
        <div className="cp2-findrow">
          {confirmFind ? (
            <div className="cp-note">
              {d.queueCount} drafts are still waiting, the oldest {d.oldestDays} days. New matches will not change what happens to those.
              {' '}<button className="cp-textlink" onClick={() => { setConfirmFind(false); void actions.findMatches(); }}>Find more anyway</button>
            </div>
          ) : (
            <button className="cp-btn block" disabled={finding || b.matches.remaining === 0} onClick={find}>
              {finding ? 'Looking…' : b.matches.remaining === 0 ? 'No matches left this month' : 'Find more now'}
            </button>
          )}
          <p className="cp-help">
            {b.matches.remaining.toLocaleString()} match{b.matches.remaining === 1 ? '' : 'es'} left this month.
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

/** To send, Waiting or Replied: the businesses at that stage, each with the one thing that moves it. */
function StageList({ stage, home, d, actions }: { stage: Exclude<MatchStage, 'new'>; home: HomeData; d: Derived; actions: Actions }) {
  const [shown, setShown] = useState(PAGE);
  const cards = d.stages[stage];
  const n = cards.length;
  return (
    <>
      {stage === 'to_send' ? (
        <div className="cp2-stagehead">
          <p className="cp2-lede">
            {n} written and not sent{d.oldestDays > 0 ? `, the oldest ${d.oldestDays} day${d.oldestDays === 1 ? '' : 's'}` : ''}.
            {' '}Each one goes from your own WhatsApp or email, so it comes from you.
          </p>
          <button className="cp-btn primary block" onClick={() => actions.openSheet({ kind: 'queue' })}>
            {n === 1 ? 'Open it and send' : 'Send them, one at a time'}
          </button>
        </div>
      ) : (
        <p className="cp2-stagenote">
          {stage === 'waiting'
            ? 'Sent, and nothing back yet. Oldest first — the one closest to going cold.'
            : 'They answered. Log what happened next, so the record can count it.'}
        </p>
      )}

      {cards.slice(0, shown).map((c) => <StageCardView key={c.key} card={c} actions={actions} />)}
      {n > shown && <button className="cp2-more" onClick={() => setShown((x) => x + PAGE)}>Show {Math.min(PAGE, n - shown)} more of {n}</button>}

      {stage === 'to_send' && <div className="cp2-stagefoot"><QueueClear home={home} actions={actions} /></div>}
    </>
  );
}

function StageCardView({ card, actions }: { card: StageCard; actions: Actions }) {
  const [busy, setBusy] = useState(false);
  const open = () => {
    if (card.draftId) actions.openSheet({ kind: 'action', id: card.draftId });
    else if (card.oppId) actions.openSheet({ kind: 'opp', id: card.oppId });
  };
  const replied = async () => {
    if (!card.oppId) return;
    setBusy(true);
    try { await actions.recordOutcome({ kind: 'reply', opportunity_id: card.oppId }); } finally { setBusy(false); }
  };
  return (
    <div className="cp-card cp2-match">
      <div className="cp2-match-head">
        <MatchThumb image={card.image} initials={card.initials} title={card.title} group="clients" />
        <button className="cp2-match-id" onClick={open}>
          <span className="cp2-match-title">{card.title}</span>
          {card.sub && <span className="cp2-match-sub">{card.sub}</span>}
          <span className={`cp2-match-status ${card.stage}`}>{card.status}</span>
        </button>
      </div>
      {/* The clamp is on the inner span: on the padded box itself a third line
          shows through the bottom padding. */}
      {card.preview && <p className="cp2-match-draft"><span>{card.preview}</span></p>}
      <div className="cp2-match-acts">
        {card.stage === 'to_send' && <button className="cp-btn primary" onClick={open}>Open and send</button>}
        {card.stage === 'waiting' && <button className="cp-btn" disabled={busy} onClick={() => void replied()}>{busy ? 'Logging…' : 'They replied'}</button>}
        {card.stage === 'replied' && <button className="cp-btn primary" onClick={open}>What happened?</button>}
        <button className="cp2-more-info" onClick={open} aria-label={`More about ${card.title}`}><IconChevron /></button>
      </div>
    </div>
  );
}

/**
 * One match. What it is, why it is here, and the one or two things to do about
 * it — in the card, so the answer leaves with the thing it was about.
 */
function MatchCard({ item, d, actions, onSendFirst }: { item: MatchItem; d: Derived; actions: Actions; onSendFirst: () => void }) {
  const [busy, setBusy] = useState(false);
  const [gated, setGated] = useState(false);
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  // A deck card from a feed has no sheet behind it — its whole content is on the
  // card — so its head is text, not a button that does nothing.
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

  const id = (
    <>
      <span className="cp2-match-title">{item.title}</span>
      {item.sub && <span className="cp2-match-sub">{item.sub}</span>}
      {item.facts && <span className="cp2-match-facts">{item.facts}</span>}
    </>
  );

  return (
    <div className={`cp-card cp2-match ${item.fresh ? 'fresh' : ''}`}>
      <div className="cp2-match-head">
        <MatchThumb image={item.image} initials={item.initials} title={item.title} group={item.group} />
        {openable ? <button className="cp2-match-id" onClick={open}>{id}</button> : <div className="cp2-match-id">{id}</div>}
        {(item.fresh || item.saved) && <span className={`cp2-new ${item.saved && !item.fresh ? 'saved' : ''}`}>{item.fresh ? 'New' : 'Saved'}</span>}
      </div>
      {item.reason && <p className="cp2-match-reason">{item.reason}</p>}

      {gated && (
        <div className="cp-note cp2-gate">
          {d.queueCount} drafts are already written, the oldest {d.oldestDays} days. Another will not make them go out.
          {' '}<button className="cp-textlink" onClick={() => { setGated(false); onSendFirst(); }}>Send those first</button>
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

/**
 * The tile at the head of a card: the listing's photo when it came with one,
 * initials on a tint otherwise, and a glyph for a find whose title is a sentence.
 * A photo that fails to load falls back to the initials rather than leaving a
 * broken-image box — the tile is for recognising a card, and a box is the same
 * on every card.
 */
function MatchThumb({ image, initials, title, group }: { image: string | null; initials: string; title: string; group: MatchGroup }) {
  const [broken, setBroken] = useState(false);
  if (image && !broken) {
    return <img className="cp2-mthumb" src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <span className={`cp2-mthumb t${tintOf(title)}`} aria-hidden>{initials || <MatchGlyph group={group} />}</span>;
}
