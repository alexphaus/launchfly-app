'use client';
// The tab shell at /copilot2 — called the four-tab shell from its first
// release, five tabs now. One question per tab:
//
//   Path      where am I, and what moves it: what was done above, "you are
//             here" with the one thing to do now, what comes next below
//   Swipe     who is worth contacting — one at a time, the message written,
//             right sends it
//   Proof     is the business proven, and what is being bet to find out: the
//             offer and its verdict, the chain of parts each with a state from
//             the rows, one bet at a time judged by them, the assets the
//             business sells with, and its history
//   Money     where did it go: log a move, the list under the balance, the
//             calendar (MoneyTab.tsx says why this is a tab and not a sheet)
//   You       how am I doing: money, runway, deep work, the week read back,
//             goals, settings
//
// The Path replaced Today: the call, what moved and what comes next are one
// stream on a time axis (lib/copilot/pathway.ts).
//
// Proof (ProofTab.tsx) replaced Work and the Lab. Work said which part of the
// business was weak; the Lab was where a bet on that part was written down and
// judged. Two tabs asked one question in two places — the verdict on one, the
// bet that moves it on the other — and a checkpoint on the Lab read its
// decision back against a chain drawn on Work. Its owner asked for one tab, for
// a business that does not sell by outreach as much as one that does, with
// ideas a model writes so it is not the same tab every week, the assets as
// things with versions, and the history in one place. Every name either tab had
// still lands on it.
//
// Why a second layout rather than a rework of the first. The two-tab app was
// built by removing things, one argued step at a time, and every step was right
// on its own; the sum was an app its owner opened and found "too many things,
// nothing that stands out, the purpose lost". Rebuilding the surface in place
// would throw away the only comparison worth having. So the data, the routes,
// the sheets and every action are shared — useCopilot — and only the arrangement
// is new. Both can be installed and lived with; the one that gets opened wins.
//
// Swipe (SwipeTab.tsx) replaced Matches, a filtered list of the same people,
// after one release side by side: its owner lived with both and kept the deck.
// What the list did that a deck does not — who is waiting, who replied, every
// draft at once with a way to clear them — is the outreach sheet (Outreach.tsx).
// Every way into Matches still lands: its tab names open Swipe, its New opens
// Swipe, and its other pills open the sheet on the same stage.
//
// The header's corner is the mic (VoiceLog.tsx): say what happened from any
// tab and the sheet for it opens filled in — a move in the book, as it always
// did, or a conversation, a sale, a meeting, a change to the offer, a note for
// the plan (lib/copilot/tell.ts sorts; TellSheets.tsx says what it heard and
// who sorted it). Keeping it is still a tap. Ask a question — "how much did I
// spend this week?" — and the Ask sheet answers it, counted from the rows and
// read aloud (lib/copilot/asked.ts). It held the capacity pill, a setting
// shown on every screen and changed about never; that is in You → Settings.
import { useCallback, useRef, useState } from 'react';
import type { MatchStage } from '@/lib/copilot/matches';
import { nightlyInFlight, nightlyView } from '@/lib/copilot/nightly';
import { askedOutright, clearlyMoney, readByRules } from '@/lib/copilot/tell';
import type { HomeData } from '@/lib/copilot/types';
import { greeting } from '../format';
import Sheet from '../Sheet';
import SheetContent from '../SheetContent';
import type { Tab2 } from '../shared';
import { sheetKey, useCopilot } from '../useCopilot';
import { useDerived } from './derive';
import { IconMoney, IconPath, IconProof, IconSwipe, IconYou } from './icons2';
import PathTab from './PathTab';
import ProofTab from './ProofTab';
import MoneyTab, { BookFab, BookSheet, MoneyTabGuard, useBook } from './MoneyTab';
import YouTab from './YouTab';
import SwipeTab from './SwipeTab';
import { useVoice, VoiceButton, VoiceLive } from './VoiceLog';
import { openReading } from './TellSheets';

const TABS: Tab2[] = ['path', 'swipe', 'proof', 'money', 'you'];
const LABEL: Record<Tab2, string> = { path: 'Path', swipe: 'Swipe', proof: 'Proof', money: 'Money', you: 'You' };
const ICON: Record<Tab2, () => React.ReactElement> = { path: IconPath, swipe: IconSwipe, proof: IconProof, money: IconMoney, you: IconYou };
/** After the last move logged in a burst, the rest of the app re-reads runway once, not once per coffee. */
const HOME_AFTER_BOOK_MS = 4_000;
/**
 * Every tab name either shell has ever used, mapped onto this one. A push or an
 * installed shortcut carrying `?tab=working` lands somewhere sensible here too,
 * and so does Today, which the Path replaced.
 */
const ALIAS: Record<string, Tab2> = {
  path: 'path', today: 'path', now: 'path',
  // Matches was a tab until Swipe replaced it; a shortcut or a push naming it opens the deck.
  matches: 'swipe', pipeline: 'swipe', opportunities: 'swipe', signals: 'swipe',
  swipe: 'swipe', deck: 'swipe', triage: 'swipe',
  // Work and the Lab were tabs until Proof replaced both; a shortcut or a push naming either opens it.
  proof: 'proof', work: 'proof', business: 'proof', assets: 'proof', history: 'proof',
  lab: 'proof', bets: 'proof', bet: 'proof', experiments: 'proof', tests: 'proof',
  money: 'money', book: 'money', cash: 'money',
  you: 'you', working: 'you',
};

export default function CopilotApp2({ initial }: { initial: HomeData }) {
  const { home, tab, setTab, actions, sheet, sheetOpen, dismissSheets, briefing, finding, toast, mainRef, say, refresh, arrival, clearArrival } =
    useCopilot<Tab2>(initial, { initialTab: 'path', alias: ALIAS });
  // A logged move changes runway, which the other tabs read off the home load.
  const homeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMoved = useCallback(() => {
    if (homeTimer.current) clearTimeout(homeTimer.current);
    homeTimer.current = setTimeout(() => {
      refresh().catch((e: unknown) => say(`Logged, but the other tabs did not update: ${e instanceof Error ? e.message : String(e)}`));
    }, HOME_AFTER_BOOK_MS);
  }, [refresh, say]);
  const book = useBook(home.profile.id, say, onMoved);
  // The mic opens the book's sheet from any tab, so the book loads as it starts
  // listening: by the time the words are in, the categories they are read
  // against usually are too. The sheet says "Opening your book…" when not.
  const logMove = (heard?: string) => {
    if (!book.book) void book.load();
    book.openEntry(heard ? { kind: 'add', heard } : { kind: 'add' });
  };
  // The book's own sheet, from a sort or the chooser: whatever sheet asked goes first.
  const openMoney = (heard: string) => { dismissSheets(); logMove(heard); };
  // What the mic heard while it is being sorted, under the greeting: a second
  // of waiting is a second of reading the words back.
  const [sorting, setSorting] = useState<string | null>(null);
  const tells = useRef(0);
  const tell = async (heard: string) => {
    // Something said after a sort began is the one that counts: the older one's answer is dropped.
    const n = ++tells.current;
    setSorting(null);
    const today = home.recent.today;
    const categories = book.book?.categories;
    // A question the Ask sheet can count is answered there at once, counted and
    // read aloud: it waits on no sort, and "can I spend 500 today?" carries an
    // amount and is still not logged.
    if (askedOutright(heard)) return actions.openSheet({ kind: 'ask', heard });
    // Said like a money move, the book opens at once, as the corner always
    // did: the commonest thing said into it waits on no model.
    if (clearlyMoney(heard, today, categories)) return logMove(heard);
    // No model on this server: the app's own rules sort it here, with no round trip to be told so.
    if (!home.ai) return openReading({ meta: { heard, by: 'rules', why: null }, told: readByRules(heard, today, categories) }, { actions, openMoney });
    setSorting(heard);
    const r = await actions.tell(heard, categories);
    if (n !== tells.current) return;
    setSorting(null);
    // The sort did not come back at all — offline, a failed request: the rules
    // sort it, and the sheet says why (invariant 13). What was said is never lost.
    openReading(
      r.ok && r.reading
        ? r.reading
        : { meta: { heard, by: 'rules', why: `The sort did not come back (${r.error ?? 'no answer'}), so the app’s own rules sorted it.` }, told: readByRules(heard, today, categories) },
      { actions, openMoney },
    );
  };
  const voice = useVoice({
    onStart: () => { if (!book.book) void book.load(); },
    onHeard: (text) => void tell(text),
    onFailed: (why, type) => { say(why); if (type) logMove(); },
  });
  const d = useDerived(home);
  const status = d.status[tab];
  const nightly = home.nightly?.run && nightlyInFlight(home.nightly.run, new Date()) ? nightlyView(home.nightly.run, new Date()) : null;
  // Where the Path and the week's review send someone about their matches: the
  // new ones to the deck, everyone already written to into the outreach sheet,
  // on the stage that was asked for — "send the drafts" lands on To send.
  const openMatches = (s: MatchStage) => {
    if (s === 'new') setTab('swipe');
    else actions.openSheet({ kind: 'outreach', stage: s });
  };

  return (
    <div className={`cp-frame cp2-frame${tab === 'swipe' ? ' cp2-swiping' : ''}`}>
      {/* No header on Swipe: the card is the screen, as a deck of cards has to be to be read at a glance. */}
      {tab !== 'swipe' && <header className="cp-header">
        <div className="cp2-header-text">
          <h1>{greeting(home.profile.timezone, home.profile.name)}</h1>
          {/* Tab-aware, and nothing when there is nothing true to say. While the mic is open, what it hears. */}
          {voice.listening
            ? <VoiceLive voice={voice} hint="Listening… say what happened, or ask" />
            : sorting ? <p className="cp2-voice-live" aria-live="polite">Sorting… &ldquo;{sorting}&rdquo;</p>
            : status && <p>{status}</p>}
        </div>
        <div className="cp-header-right">
          <VoiceButton voice={voice} onType={() => logMove()} label="Say what happened, or ask" />
        </div>
      </header>}

      <main className="cp-content" ref={mainRef}>
        {/* The nightly pass runs for minutes after its tap has returned, so it is
            said on every tab, not only on the row that started it. */}
        {nightly?.state === 'running'
          ? <div className="cp-banner"><span className="dot" />Nightly run · {nightly.stepN ? `${nightly.stepN} of ${nightly.of} · ` : ''}{nightly.doing}</div>
          : (briefing || finding) && <div className="cp-banner"><span className="dot" />{finding ? 'Finding real matches' : 'Building today’s call'}</div>}
        {tab === 'path' && <PathTab home={home} d={d} actions={actions} briefing={briefing} finding={finding} openMatches={openMatches} />}
        {tab === 'swipe' && <SwipeTab home={home} d={d} actions={actions} finding={finding} say={say} refresh={refresh} />}
        {tab === 'proof' && <ProofTab home={home} d={d} actions={actions} briefing={briefing} />}
        {tab === 'money' && <MoneyTabGuard><MoneyTab book={book} actions={actions} say={say} arrival={arrival} clearArrival={clearArrival} /></MoneyTabGuard>}
        {tab === 'you' && <YouTab home={home} d={d} actions={actions} openMatches={openMatches} />}
      </main>

      <nav className="cp-nav cp2-nav" aria-label="Sections">
        {TABS.map((t) => {
          const Icon = ICON[t];
          // One count, on the one tab where it is an ask: what needs you today.
          const badge = t === 'path' ? d.asks.length : 0;
          return (
            <button
              key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)} aria-current={tab === t ? 'page' : undefined}
              // The tab's name first, then the count — read the other way round,
              // a screen reader announced "3 need you Today".
              aria-label={badge > 0 && tab !== t ? `${LABEL[t]}, ${badge} need${badge === 1 ? 's' : ''} you` : undefined}
            >
              <span className="cp2-navicon"><Icon />{badge > 0 && tab !== t && <i className="cp2-badge" aria-hidden>{badge}</i>}</span>
              {LABEL[t]}
            </button>
          );
        })}
      </nav>

      {tab === 'money' && <BookFab book={book} />}

      <Sheet open={sheetOpen} onClose={dismissSheets}>
        {sheet && <SheetContent key={sheetKey(sheet)} sheet={sheet} home={home} actions={actions} briefing={briefing} openMoney={openMoney} />}
      </Sheet>
      <Sheet open={!!book.entry} onClose={book.closeEntry}>
        <MoneyTabGuard><BookSheet book={book} /></MoneyTabGuard>
      </Sheet>

      {toast && <div className="cp-toast" role="status">{toast}</div>}
    </div>
  );
}
