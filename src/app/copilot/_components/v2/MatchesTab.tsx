'use client';
// Matches: what the app found for you, already judged, one tap from done.
//
// The morning this tab is for: it went looking overnight, and here is who is
// worth writing to — businesses to pitch, gigs and roles to answer, people
// worth meeting, signals worth reading — and nothing else. What to look for is
// the app's to work out (hunting.ts plans its searches from the offer), and
// what to show is the app's to judge (matches.ts shows only what clears the
// bar). An earlier version put both on the screen — a "looking for" card, a
// sheet of searches to manage, a card explaining poor fits and a fold holding
// them — and its owner's verdict was the whole design brief for this one:
// serve, not configure.
//
// Four stages as pills — New, To send, Waiting, Replied — one shown at a time.
// A draft is sent from its own card, in the user's own app, in one tap, and
// the card asks "did it go?" right there; the one-at-a-time queue sheet was a
// second place to do the same thing, out of context.
//
// The deck is laid flat here, and it still learns: every business is answered
// through the triage route, so "Draft" and "Not for me" feed the keep-rate the
// ranker orders by. The queue gate survives too — with forty drafts written and
// the oldest days old, the first tap on Draft states the trade-off and the
// second proceeds, the pattern "Find new" already used.
import { useState } from 'react';
import { MATCH_STAGES, MATCH_STAGE_LABEL, tintOf, type MatchGroup, type MatchItem, type MatchStage, type StageCard } from '@/lib/copilot/matches';
import { PLANS } from '@/lib/copilot/plans';
import type { HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';
import { useShell } from '../shell';
import { QueueClear } from '../views/NowView';
import type { Derived } from './derive';
import { IconChevron, IconExternal, MatchGlyph } from './icons2';

/** Past this the list folds. Twenty is a morning's worth; two hundred is a database. */
const PAGE = 20;

export default function MatchesTab({ home, d, actions, finding, stage: picked, onStage }: {
  home: HomeData; d: Derived; actions: Actions; finding: boolean; stage: MatchStage; onStage: (s: MatchStage) => void;
}) {
  const count: Record<MatchStage, number> = {
    new: d.counts.all,
    to_send: d.stages.to_send.length,
    waiting: d.stages.waiting.length,
    replied: d.stages.replied.length,
  };
  // A stage emptied by the last answer — the last draft sent — falls back to
  // New, rather than leaving an empty list under a pill that has gone.
  const stage: MatchStage = picked !== 'new' && count[picked] === 0 ? 'new' : picked;
  const pills = MATCH_STAGES.filter((s) => s === 'new' || count[s] > 0);

  return (
    <>
      {pills.length > 1 && (
        <div className="cp2-chips" role="tablist" aria-label="Where they are">
          {pills.map((s) => (
            <button key={s} role="tab" aria-selected={stage === s} className={`cp-fchip ${stage === s ? 'active' : ''}`} onClick={() => onStage(s)}>
              {MATCH_STAGE_LABEL[s]} <span className="n">{count[s]}</span>
            </button>
          ))}
        </div>
      )}
      <div className="cp2-matchlist">
        {stage === 'new'
          ? <NewMatches home={home} d={d} actions={actions} finding={finding} onSendFirst={() => onStage('to_send')} />
          : <StageList stage={stage} home={home} d={d} actions={actions} />}
      </div>
    </>
  );
}

function NewMatches({ home, d, actions, finding, onSendFirst }: { home: HomeData; d: Derived; actions: Actions; finding: boolean; onSendFirst: () => void }) {
  const shell = useShell();
  const [shown, setShown] = useState(PAGE);
  const items = d.good;
  const b = home.billing;
  const setAside = d.feed.filter((i) => i.below).length;
  // Not under "say what you sell": with no offer there is nothing to draft from,
  // so a fresh look would only fill a list nobody can act on.
  const canLook = d.searching && !d.noOffer && !finding && b.matches.remaining > 0;

  return (
    <>
      {items.length ? (
        <>
          {items.slice(0, shown).map((i) => <MatchCard key={i.id} item={i} d={d} actions={actions} onSendFirst={onSendFirst} />)}
          {items.length > shown && (
            <button className="cp2-more" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, items.length - shown)} more</button>
          )}
        </>
      ) : d.noOffer ? (
        // The one thing it cannot work out: what the user sells. Everything it
        // searches for and every opener it writes is read from this.
        <div className="cp-card">
          <div className="cp-eyebrow">One thing first</div>
          <p className="cp2-lede">Say what you sell, in a sentence. It works out who would buy it, goes and finds them, and brings back only the ones worth your time.</p>
          <button className="cp-btn primary block cp-call-do" onClick={() => actions.openSheet({ kind: 'offer' })}>Say what you sell</button>
        </div>
      ) : (
        <div className="cp-empty">
          {finding
            ? <><b>Looking now</b>Real listings and real pages, not a sample — the first pass takes a minute.</>
            : !d.searching
            // Said rather than shown as a quiet morning: nothing on this server
            // can search yet, and the Scout on Work names what is missing.
            ? <><b>Nothing can look for you yet</b>Web search is not set up on this server. The Scout on Work says what is missing.</>
            // "Every night" only while the nightly job is running; Today says when it is not.
            : <><b>Nothing worth your time yet</b>{setAside ? `It went through ${setAside} and none were worth a message. ` : ''}{d.done.stale ? '' : 'It keeps looking every night.'}</>}
        </div>
      )}

      {canLook && <button className="cp2-lookmore" onClick={() => void actions.findMatches()}>Look again now</button>}

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
  return (
    <>
      {cards.slice(0, shown).map((c) => <StageCardView key={c.key} card={c} home={home} actions={actions} />)}
      {cards.length > shown && <button className="cp2-more" onClick={() => setShown((x) => x + PAGE)}>Show {Math.min(PAGE, cards.length - shown)} more</button>}
      {stage === 'to_send' && <div className="cp2-stagefoot"><QueueClear home={home} actions={actions} /></div>}
    </>
  );
}

function StageCardView({ card, home, actions }: { card: StageCard; home: HomeData; actions: Actions }) {
  const [busy, setBusy] = useState(false);
  // Set when the draft was opened in WhatsApp or mail. Only the user knows
  // whether it went, so the card asks — once, in place, the moment they are back.
  const [opened, setOpened] = useState(false);
  const open = () => {
    if (card.draftId) actions.openSheet({ kind: 'action', id: card.draftId });
    else if (card.oppId) actions.openSheet({ kind: 'opp', id: card.oppId });
  };
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  // Server sending only when this copilot owns the identity it would go out
  // under (invariant 4); otherwise the draft's own deep link, in their own app.
  const owned = !!card.channel && home.channels[card.channel];
  const via = card.channel === 'email' ? 'email' : 'WhatsApp';

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
      {card.preview && <p className="cp2-match-draft"><span>{card.preview}</span></p>}
      <div className="cp2-match-acts">
        {card.stage === 'to_send' && card.draftId && (
          opened ? (
            <>
              <span className="cp2-didit">Did it go?</span>
              <button className="cp-btn primary" disabled={busy} onClick={() => void run(() => actions.markSent(card.draftId!))}>{busy ? 'Saving…' : 'Sent'}</button>
              <button className="cp-btn ghost" disabled={busy} onClick={() => setOpened(false)}>Not yet</button>
            </>
          ) : owned ? (
            <button className="cp-btn primary" disabled={busy} onClick={() => void run(() => actions.sendAction(card.draftId!))}>{busy ? 'Sending…' : 'Send'}</button>
          ) : card.link ? (
            <a className="cp-btn primary" href={card.link} target="_blank" rel="noreferrer" onClick={() => { actions.markOpened(card.draftId!); setOpened(true); }}>
              Send on {via}
            </a>
          ) : (
            <button className="cp-btn primary" onClick={open}>Open the draft</button>
          )
        )}
        {card.stage === 'waiting' && (
          <button className="cp-btn" disabled={busy} onClick={() => void run(() => actions.recordOutcome({ kind: 'reply', opportunity_id: card.oppId! }))}>
            {busy ? 'Saving…' : 'They replied'}
          </button>
        )}
        {card.stage === 'replied' && <button className="cp-btn primary" onClick={open}>What happened?</button>}
        {!opened && <button className="cp2-more-info" onClick={open} aria-label={`More about ${card.title}`}><IconChevron /></button>}
      </div>
    </div>
  );
}

/**
 * One match: what it is, why it is worth your time, and the one thing to do
 * about it — in the card, so the answer leaves with the thing it was about.
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
    </>
  );

  return (
    <div className={`cp-card cp2-match ${item.fresh ? 'fresh' : ''}`}>
      <div className="cp2-match-head">
        <MatchThumb image={item.image} initials={item.initials} title={item.title} group={item.group} />
        {openable ? <button className="cp2-match-id" onClick={open}>{id}</button> : <div className="cp2-match-id">{id}</div>}
        {item.fresh && <span className="cp2-new">New</span>}
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
            ? <button className="cp-btn primary" disabled={busy} onClick={draft}>{d.noOffer ? 'Say what you sell first' : busy ? 'Drafting…' : `Draft ${item.channel === 'email' ? 'an email' : 'a WhatsApp'}`}</button>
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
