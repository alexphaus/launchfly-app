'use client';
// The four-tab shell at /copilot2. One question per tab:
//
//   Path      where am I, and what moves it: what was done above, "you are
//             here" with the one thing to do now, what comes next below
//   Matches   who is worth contacting — everything it found, filtered
//   Work      what am I building: the offer, the path to money, the agents
//             running parts of it, the projects handed over
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
import { useState } from 'react';
import type { MatchStage } from '@/lib/copilot/matches';
import { CAPACITY_META, type HomeData } from '@/lib/copilot/types';
import { greeting } from '../format';
import Sheet from '../Sheet';
import SheetContent from '../SheetContent';
import type { Tab2 } from '../shared';
import { sheetKey, useCopilot } from '../useCopilot';
import { useDerived } from './derive';
import { IconMatches, IconPath, IconWork, IconYou } from './icons2';
import PathTab from './PathTab';
import MatchesTab from './MatchesTab';
import WorkTab from './WorkTab';
import YouTab from './YouTab';

const TABS: Tab2[] = ['path', 'matches', 'work', 'you'];
const LABEL: Record<Tab2, string> = { path: 'Path', matches: 'Matches', work: 'Work', you: 'You' };
const ICON: Record<Tab2, () => React.ReactElement> = { path: IconPath, matches: IconMatches, work: IconWork, you: IconYou };
/**
 * Every tab name either shell has ever used, mapped onto this one. A push or an
 * installed shortcut carrying `?tab=working` lands somewhere sensible here too,
 * and so does Today, which the Path replaced.
 */
const ALIAS: Record<string, Tab2> = {
  path: 'path', today: 'path', now: 'path',
  matches: 'matches', pipeline: 'matches', opportunities: 'matches', signals: 'matches',
  work: 'work',
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
        {tab === 'work' && <WorkTab home={home} d={d} actions={actions} briefing={briefing} />}
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
