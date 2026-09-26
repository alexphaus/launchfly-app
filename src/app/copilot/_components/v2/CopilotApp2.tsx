'use client';
// The three-tab shell at /copilot2. One question per tab:
//
//   Path      where am I, and what moves it: what was done above, "you are
//             here" with the one thing to do now, what comes next below
//   Matches   who is worth contacting — everything it found, filtered
//   You       how is it going: money, runway, deep work, the path to money and
//             the team running it, the week read back, goals, settings
//
// It was four — Today and Work beside each other — until the owner's verdict on
// every draft of Work was that it could be had "from today's call, the You tab
// or the handover". Today and Work were two halves of one question, and on a
// time axis they are one stream. See lib/copilot/pathway.ts.
//
// Why a second layout rather than a rework of the first. The two-tab app was
// built by removing things, one argued step at a time, and every step was right
// on its own; the sum was an app its owner opened and found "too many things,
// nothing that stands out, the purpose lost". Rebuilding the surface in place
// would throw away the only comparison worth having. So the data, the routes,
// the sheets and every action are shared — useCopilot — and only the arrangement
// is new. Both can be installed and lived with; the one that gets opened wins.
import { useState } from 'react';
import type { MatchStage } from '@/lib/copilot/matches';
import { CAPACITY_META, type HomeData } from '@/lib/copilot/types';
import { greeting } from '../format';
import Sheet from '../Sheet';
import SheetContent from '../SheetContent';
import type { Tab2 } from '../shared';
import { sheetKey, useCopilot } from '../useCopilot';
import { useDerived } from './derive';
import { IconMatches, IconPath, IconYou } from './icons2';
import PathTab from './PathTab';
import MatchesTab from './MatchesTab';
import YouTab from './YouTab';

const TABS: Tab2[] = ['path', 'matches', 'you'];
const LABEL: Record<Tab2, string> = { path: 'Path', matches: 'Matches', you: 'You' };
const ICON: Record<Tab2, () => React.ReactElement> = { path: IconPath, matches: IconMatches, you: IconYou };
/**
 * Every tab name either shell has ever used, mapped onto this one. A push or an
 * installed shortcut carrying `?tab=working` lands somewhere sensible here too,
 * and so do the two tabs the Path replaced.
 */
const ALIAS: Record<string, Tab2> = {
  path: 'path', today: 'path', now: 'path', work: 'path',
  matches: 'matches', pipeline: 'matches', opportunities: 'matches', signals: 'matches',
  you: 'you', working: 'you',
};

export default function CopilotApp2({ initial }: { initial: HomeData }) {
  const { home, tab, setTab, actions, sheet, sheetOpen, dismissSheets, briefing, finding, toast, mainRef } =
    useCopilot<Tab2>(initial, { initialTab: 'path', alias: ALIAS });
  const d = useDerived(home);
  const status = d.status[tab];
  // Which pill Matches shows. Held here so the Path can open it on the right one:
  // "send the drafts" lands on To send, in context, rather than in a sheet.
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
        {(briefing || finding) && <div className="cp-banner"><span className="dot" />{finding ? 'Finding real matches' : 'Building today’s call'}</div>}
        {tab === 'path' && <PathTab home={home} d={d} actions={actions} briefing={briefing} finding={finding} openMatches={openMatches} />}
        {tab === 'matches' && <MatchesTab home={home} d={d} actions={actions} finding={finding} stage={matchStage} onStage={setMatchStage} />}
        {tab === 'you' && <YouTab home={home} d={d} actions={actions} briefing={briefing} />}
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

      <Sheet open={sheetOpen} onClose={dismissSheets}>
        {sheet && <SheetContent key={sheetKey(sheet)} sheet={sheet} home={home} actions={actions} briefing={briefing} />}
      </Sheet>

      {toast && <div className="cp-toast" role="status">{toast}</div>}
    </div>
  );
}
