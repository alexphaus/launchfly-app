'use client';
// The installed app: header, two tabs, bottom sheet, toast. State and every
// call to /api/copilot live in useCopilot, which the four-tab shell at
// /copilot2 shares, so the two layouts cannot drift on what an action does.
//
// Two tabs, because there are two questions: what do I do, and is it working.
// Pipeline was the third and every part of it already existed somewhere else —
// its queue was Today's queue counted again, its deck is one card on Now, and
// its stage groups are what the funnel on Working opens into. "You" was settings
// with goals bolted on, so it lives behind the header avatar.

import { offerIsEmpty } from '@/lib/copilot/offer';
import { statusLine } from '@/lib/copilot/decision';
import { CAPACITY_META, type HomeData } from '@/lib/copilot/types';
import { greeting } from './format';
import { IconNow, IconWorking } from './icons';
import Sheet from './Sheet';
import SheetContent from './SheetContent';
import type { Tab } from './shared';
import { sheetKey, useCopilot } from './useCopilot';
import WorkingView from './views/WorkingView';
import NowView from './views/NowView';

const TABS: Tab[] = ['now', 'working'];
const TAB_LABEL: Record<Tab, string> = { now: 'Now', working: 'Working?' };
/** Older installed shells and already-delivered pushes deep-link the old names. */
const TAB_ALIAS: Record<string, Tab> = { today: 'now', pipeline: 'now', signals: 'working', now: 'now', working: 'working' };

export default function CopilotApp({ initial }: { initial: HomeData }) {
  const { home, tab, setTab, actions, sheet, sheetOpen, dismissSheets, briefing, finding, toast, mainRef } =
    useCopilot<Tab>(initial, { initialTab: 'now', alias: TAB_ALIAS, afterDraft: 'now' });

  // What is waiting, across every kind of work — not just drafts. "12 to send"
  // was an accurate line about a product nobody wanted to open: it described the
  // one action the app could produce rather than the reason to look at it.
  //
  // Once the call carries the instruction, repeating it here is the fourth time
  // the same sentence appears above the fold. The header goes back to being the
  // status line it was built to be — and a status line is one number. See
  // statusLine() for why it is specifically the one the call is graded on.
  const headline = offerIsEmpty(home.profile.offer) && !home.decision && !home.moves.length
    ? 'Set your offer to start sending'
    : statusLine(home.metrics, home.decision, home.queue.length);

  return (
    <div className="cp-frame">
      <header className="cp-header">
        <div>
          <h1>{greeting(home.profile.timezone, home.profile.name)}</h1>
          {/* Nothing true to add beats filler under a greeting. */}
          {headline && <p>{headline}</p>}
        </div>
        <div className="cp-header-right">
          <button className="cp-capacity" onClick={() => actions.openSheet({ kind: 'capacity' })} aria-label="Set your capacity">
            ⚡ <span>{CAPACITY_META[home.profile.capacity].label}</span>
          </button>
          <button className="cp-avatar" onClick={() => actions.openSheet({ kind: 'you' })} aria-label="You: goals, offer, targeting, plan, account">
            {(home.profile.name.trim()[0] ?? '?').toUpperCase()}
          </button>
        </div>
      </header>

      <main className="cp-content" ref={mainRef}>
        {tab === 'now' && <NowView home={home} actions={actions} briefing={briefing} finding={finding} />}
        {tab === 'working' && <WorkingView home={home} actions={actions} finding={finding} />}
      </main>

      <nav className="cp-nav" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'now' ? <IconNow /> : <IconWorking />}
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>

      <Sheet open={sheetOpen} onClose={dismissSheets}>
        {sheet && <SheetContent key={sheetKey(sheet)} sheet={sheet} home={home} actions={actions} briefing={briefing} />}
      </Sheet>

      {toast && <div className="cp-toast" role="status">{toast}</div>}
    </div>
  );
}
