'use client';
// Outreach: everyone already written to, by where they are — To send, Waiting,
// Replied — each card with the one thing that moves it.
//
// These were three of the four pills on the Matches tab. Swipe replaced the
// tab's New: the matches one at a time, the message written, right sends it.
// A deck is the wrong shape for the rest. "They replied" is not a yes or a no
// about a card, and who you are waiting on is a list to read, not a pile to
// clear. So the rest is a sheet, opened from the top of the deck, from the
// Path's "send the drafts" and from the week's review, which is where each of
// those used to land on the tab.
//
// A draft is sent from its own card, in the person's own app, in one tap, and
// the card asks "did it go?" right there. To send keeps the one way out of a
// backlog that is never going out: "I am not sending these".
import { useMemo, useState } from 'react';
import { MATCH_STAGE_LABEL, stageCards, tintOf, type OutreachStage, type StageCard } from '@/lib/copilot/matches';
import { offerIsEmpty } from '@/lib/copilot/offer';
import type { HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';
import { QueueClear } from '../views/NowView';
import { IconChevron, MatchGlyph } from './icons2';

/** Past this the list folds. Twenty is a morning's worth; two hundred is a database. */
const PAGE = 20;
const STAGES: OutreachStage[] = ['to_send', 'waiting', 'replied'];

const LEDE: Record<OutreachStage, string> = {
  to_send: 'Written, not sent. The deck deals these too; here they are all at once.',
  waiting: 'Sent, no reply yet. Oldest first — the top one is closest to going cold.',
  replied: 'They answered. Log what happened next: a meeting, a sale, or a no.',
};

export default function OutreachSheet({ home, actions, stage: first }: { home: HomeData; actions: Actions; stage: OutreachStage }) {
  const stages = useMemo(() => {
    const s = stageCards({ now: new Date(), queue: home.queue, pipeline: home.pipeline, targetSegments: home.profile.target_segments });
    // Drafts written from a blank offer are not put in front of anyone to send
    // (invariant 1): the same gate the rest of the shell applies (derive.ts).
    return offerIsEmpty(home.profile.offer) ? { ...s, to_send: [] } : s;
  }, [home]);
  const [picked, setPicked] = useState<OutreachStage>(first);
  const count = (s: OutreachStage) => stages[s].length;
  // A stage emptied by the last answer moves on with the person answered — the
  // last draft sent to Waiting, the last "they replied" to Replied — rather than
  // leaving an empty list under its pill. Forward first, since that is where
  // they went; back only when nothing is ahead.
  const at = STAGES.indexOf(picked);
  const onward = [...STAGES.slice(at + 1), ...STAGES.slice(0, at).reverse()];
  const stage = count(picked) > 0 ? picked : onward.find((s) => count(s) > 0) ?? picked;
  const pills = STAGES.filter((s) => count(s) > 0 || s === stage);
  const [shown, setShown] = useState(PAGE);
  const cards = stages[stage];

  return (
    <div className="cp2-out">
      <h3>Outreach</h3>
      {pills.length > 1 && (
        <div className="cp2-out-pills" role="tablist" aria-label="Where they are">
          {pills.map((s) => (
            <button key={s} role="tab" aria-selected={stage === s} className={`cp-fchip ${stage === s ? 'active' : ''}`} onClick={() => { setPicked(s); setShown(PAGE); }}>
              {MATCH_STAGE_LABEL[s]} <span className="n">{count(s)}</span>
            </button>
          ))}
        </div>
      )}
      {cards.length ? (
        <>
          <p className="desc">{LEDE[stage]}</p>
          {cards.slice(0, shown).map((c) => <StageCardView key={c.key} card={c} home={home} actions={actions} />)}
          {cards.length > shown && <button className="cp2-more" onClick={() => setShown((x) => x + PAGE)}>Show {Math.min(PAGE, cards.length - shown)} more</button>}
          {stage === 'to_send' && <div className="cp2-out-foot"><QueueClear home={home} actions={actions} /></div>}
        </>
      ) : (
        <p className="desc">Nobody here yet. Everyone you message from the deck lands here, waiting, until they answer.</p>
      )}
    </div>
  );
}

function StageCardView({ card, home, actions }: { card: StageCard; home: HomeData; actions: Actions }) {
  const [busy, setBusy] = useState(false);
  // Set when the draft was opened in WhatsApp or mail. Only the person knows
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
  const via = card.channel === 'email' ? 'email' : card.via === 'sms' ? 'a text' : 'WhatsApp';

  return (
    <div className="cp-card cp2-match">
      <div className="cp2-match-head">
        <MatchThumb image={card.image} initials={card.initials} title={card.title} />
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
              <button className="cp-btn primary" disabled={busy} onClick={() => void run(() => actions.markSent(card.draftId!, undefined, { stay: true }))}>{busy ? 'Saving…' : 'Sent'}</button>
              <button className="cp-btn ghost" disabled={busy} onClick={() => setOpened(false)}>Not yet</button>
            </>
          ) : owned ? (
            <button className="cp-btn primary" disabled={busy} onClick={() => void run(() => actions.sendAction(card.draftId!, undefined, { stay: true }))}>{busy ? 'Sending…' : 'Send'}</button>
          ) : card.link ? (
            <a className="cp-btn primary" href={card.link} target="_blank" rel="noreferrer" onClick={() => { actions.markOpened(card.draftId!); setOpened(true); }}>
              {card.via === 'call' ? 'Call them' : `Send on ${via}`}
            </a>
          ) : (
            <button className="cp-btn primary" onClick={open}>Open the draft</button>
          )
        )}
        {card.stage === 'waiting' && (
          <button className="cp-btn" disabled={busy} onClick={() => void run(() => actions.recordOutcome({ kind: 'reply', opportunity_id: card.oppId! }, { stay: true }))}>
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
 * The tile at the head of a card: the listing's photo when it came with one,
 * initials on a tint otherwise. A photo that fails to load falls back to the
 * initials rather than leaving a broken-image box — the tile is for recognising
 * a card, and a box is the same on every card.
 */
function MatchThumb({ image, initials, title }: { image: string | null; initials: string; title: string }) {
  const [broken, setBroken] = useState(false);
  if (image && !broken) {
    return <img className="cp2-mthumb" src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <span className={`cp2-mthumb t${tintOf(title)}`} aria-hidden>{initials || <MatchGlyph group="clients" />}</span>;
}
