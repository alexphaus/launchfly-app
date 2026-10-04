'use client';
// The four-tab shell at /copilot2 — five tabs since Money, the name kept. One
// question per tab:
//
//   Path      where am I, and what moves it: what was done above, "you are
//             here" with the one thing to do now, what comes next below
//   Swipe     who is worth contacting — one at a time, the message written,
//             right sends it
//   Work      is the business proven, and what moves it: the offer and its
//             verdict, the chain of parts each with a state from the rows, the
//             weak link open, what is in the works and what was built
//   Money     where did it go: log a move, the list under the balance, the
//             calendar (MoneyTab.tsx says why this is a tab and not a sheet)
//   You       how am I doing: money, runway, deep work, the week read back,
//             goals, settings
//
// The Path replaced Today: the call, what moved and what comes next are one
// stream on a time axis (lib/copilot/pathway.ts). For one release it replaced
// Work as well, with the machine and the team moved under the numbers on You.
// Work came back on its owner's word — "better for separation, and has
// important features": the Path is what to do, Work is the business being
// built, and the offer, the machine, the team and the projects in full had no
// place on either of the others.
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
// The header's corner is the mic (VoiceLog.tsx): say a move from any tab and
// the add sheet opens with it filled in. It held the capacity pill, a setting
// shown on every screen and changed about never; that is in You → Settings.
import { useCallback, useRef } from 'react';
import type { MatchStage } from '@/lib/copilot/matches';
import { nightlyInFlight, nightlyView } from '@/lib/copilot/nightly';
import type { HomeData } from '@/lib/copilot/types';
import { greeting } from '../format';
import Sheet from '../Sheet';
import SheetContent from '../SheetContent';
import type { Tab2 } from '../shared';
import { sheetKey, useCopilot } from '../useCopilot';
import { useDerived } from './derive';
import { IconMoney, IconPath, IconSwipe, IconWork, IconYou } from './icons2';
import PathTab from './PathTab';
import WorkTab from './WorkTab';
import MoneyTab, { BookFab, BookSheet, MoneyTabGuard, useBook } from './MoneyTab';
import YouTab from './YouTab';
import SwipeTab from './SwipeTab';
import { useVoice, VoiceButton, VoiceLive } from './VoiceLog';

const TABS: Tab2[] = ['path', 'swipe', 'work', 'money', 'you'];
const LABEL: Record<Tab2, string> = { path: 'Path', swipe: 'Swipe', work: 'Work', money: 'Money', you: 'You' };
const ICON: Record<Tab2, () => React.ReactElement> = { path: IconPath, swipe: IconSwipe, work: IconWork, money: IconMoney, you: IconYou };
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
  work: 'work',
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
  const voice = useVoice({
    onStart: () => { if (!book.book) void book.load(); },
    onHeard: (text) => logMove(text),
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
        <div>
          <h1>{greeting(home.profile.timezone, home.profile.name)}</h1>
          {/* Tab-aware, and nothing when there is nothing true to say. While the mic is open, what it hears. */}
          {voice.listening ? <VoiceLive voice={voice} /> : status && <p>{status}</p>}
        </div>
        <div className="cp-header-right">
          <VoiceButton voice={voice} onType={() => logMove()} />
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
        {tab === 'work' && <WorkTab home={home} d={d} actions={actions} briefing={briefing} />}
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
        {sheet && <SheetContent key={sheetKey(sheet)} sheet={sheet} home={home} actions={actions} briefing={briefing} />}
      </Sheet>
      <Sheet open={!!book.entry} onClose={book.closeEntry}>
        <MoneyTabGuard><BookSheet book={book} /></MoneyTabGuard>
      </Sheet>

      {toast && <div className="cp-toast" role="status">{toast}</div>}
    </div>
  );
}
