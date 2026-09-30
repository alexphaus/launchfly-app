'use client';
// The four-tab shell at /copilot2 — five tabs since Money, the name kept. One
// question per tab:
//
//   Path      where am I, and what moves it: what was done above, "you are
//             here" with the one thing to do now, what comes next below
//   Matches   who is worth contacting — everything it found, filtered
//   Work      what am I building: the offer, the path to money, the agents
//             running parts of it, the projects handed over
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
import { useCallback, useRef, useState } from 'react';
import type { MatchStage } from '@/lib/copilot/matches';
import { nightlyInFlight, nightlyView } from '@/lib/copilot/nightly';
import { CAPACITY_META, type HomeData } from '@/lib/copilot/types';
import { greeting } from '../format';
import Sheet from '../Sheet';
import SheetContent from '../SheetContent';
import type { Tab2 } from '../shared';
import { sheetKey, useCopilot } from '../useCopilot';
import { useDerived } from './derive';
import { IconMatches, IconMoney, IconPath, IconWork, IconYou } from './icons2';
import PathTab from './PathTab';
import MatchesTab from './MatchesTab';
import WorkTab from './WorkTab';
import MoneyTab, { BookFab, BookSheet, MoneyTabGuard, useBook } from './MoneyTab';
import YouTab from './YouTab';

const TABS: Tab2[] = ['path', 'matches', 'work', 'money', 'you'];
const LABEL: Record<Tab2, string> = { path: 'Path', matches: 'Matches', work: 'Work', money: 'Money', you: 'You' };
const ICON: Record<Tab2, () => React.ReactElement> = { path: IconPath, matches: IconMatches, work: IconWork, money: IconMoney, you: IconYou };
/** After the last move logged in a burst, the rest of the app re-reads runway once, not once per coffee. */
const HOME_AFTER_BOOK_MS = 4_000;
/**
 * Every tab name either shell has ever used, mapped onto this one. A push or an
 * installed shortcut carrying `?tab=working` lands somewhere sensible here too,
 * and so does Today, which the Path replaced.
 */
const ALIAS: Record<string, Tab2> = {
  path: 'path', today: 'path', now: 'path',
  matches: 'matches', pipeline: 'matches', opportunities: 'matches', signals: 'matches',
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
  const d = useDerived(home);
  const status = d.status[tab];
  const nightly = home.nightly?.run && nightlyInFlight(home.nightly.run, new Date()) ? nightlyView(home.nightly.run, new Date()) : null;
  // Which pill Matches shows. Held here so the Path can open it on the right one:
  // "send the drafts" lands on To send, in context, rather than in a sheet. You
  // opens it too: a reply on the week's review is followed up on Replied.
  const [matchStage, setMatchStage] = useState<MatchStage>('new');
  const openMatches = (s: MatchStage) => { setMatchStage(s); setTab('matches'); };

  return (
    <div className="cp-frame cp2-frame">
      <header className="cp-header">
        <div>
          <h1>{greeting(home.profile.timezone, home.profile.name)}</h1>
          {/* Tab-aware, and nothing when there is nothing true to say. */}
          {status && <p>{status}</p>}
        </div>
        <div className="cp-header-right">
          <button className="cp-capacity" onClick={() => actions.openSheet({ kind: 'capacity' })} aria-label="Set your capacity">
            ⚡ <span>{CAPACITY_META[home.profile.capacity].label}</span>
          </button>
        </div>
      </header>

      <main className="cp-content" ref={mainRef}>
        {/* The nightly pass runs for minutes after its tap has returned, so it is
            said on every tab, not only on the row that started it. */}
        {nightly?.state === 'running'
          ? <div className="cp-banner"><span className="dot" />Nightly run · {nightly.stepN ? `${nightly.stepN} of ${nightly.of} · ` : ''}{nightly.doing}</div>
          : (briefing || finding) && <div className="cp-banner"><span className="dot" />{finding ? 'Finding real matches' : 'Building today’s call'}</div>}
        {tab === 'path' && <PathTab home={home} d={d} actions={actions} briefing={briefing} finding={finding} openMatches={openMatches} />}
        {tab === 'matches' && <MatchesTab home={home} d={d} actions={actions} finding={finding} stage={matchStage} onStage={setMatchStage} />}
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
      {/* Taller than the other sheets, and over the nav: the keypad needs the room the nav's clearance took. */}
      <Sheet open={!!book.entry} onClose={book.closeEntry} className="cp2-bk-sheet">
        <MoneyTabGuard><BookSheet book={book} /></MoneyTabGuard>
      </Sheet>

      {toast && <div className="cp-toast" role="status">{toast}</div>}
    </div>
  );
}
