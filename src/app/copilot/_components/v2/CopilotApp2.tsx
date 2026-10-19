'use client';
// The tab shell at /copilot2 — called the four-tab shell from its first
// release, three tabs now, and You behind the avatar. One question per tab:
//
//   Decide    what waits on me: one deck, every decision a card — today's call,
//             a project that stopped to ask, an introduction, what Claude
//             proposed, the posts a bet found — and then the people worth a
//             message. Right does it, left puts it off (lib/copilot/decide.ts).
//             Its key is still `swipe`.
//   System    what runs, and what it has proven: the count that proves the
//             business, the five parts, the workflow on trial with who runs each
//             step and what each has produced, and every workflow tried. Its key
//             is still `proof`; it was Engine, which was Proof.
//   Money     where did it go: log a move, the list under the balance, the
//             calendar (MoneyTab.tsx says why this is a tab and not a sheet)
//
// You — the numbers, the week read back, goals, records, settings — is a screen
// the avatar in the header opens, on every tab. It is visited, not lived in.
//
// Why Path went. The day's work was spread over three screens: the call, the
// move and "Needs you" on Path; the bet's move and the people it found on
// Engine; the businesses on Swipe. Its owner's verdict on Engine was that half
// of it was things Swipe could do, and their counts said the rest: of the calls
// carried out, none moved the number it named, and 27 were never done. A plan
// and "what to do today" are what a chat with the whole record does better
// (DIRECTION.md, the survival test); what only this app has is the rows that
// wait on the person, and those are Decide's cards now. The plan is still drawn
// — the call is picked from it, and Claude reads it over the connector — so
// opening the app draws it when it is due, as opening Path did (usePlanDraw).
//
// Proof (ProofTab.tsx) replaced Work and the Lab, and Swipe (SwipeTab.tsx)
// replaced Matches, each after its owner lived with both: every name any of
// them had still lands somewhere sensible (ALIAS).
//
// Why a second layout rather than a rework of the first. The two-tab app was
// built by removing things, one argued step at a time, and every step was right
// on its own; the sum was an app its owner opened and found "too many things,
// nothing that stands out, the purpose lost". Rebuilding the surface in place
// would throw away the only comparison worth having. So the data, the routes,
// the sheets and every action are shared — useCopilot — and only the arrangement
// is new. Both can be installed and lived with; the one that gets opened wins.
//
// The header's corner is the mic (VoiceLog.tsx): say what happened from any
// tab and the sheet for it opens filled in — a move in the book, as it always
// did, or a conversation, a sale, a meeting, a change to the offer, a note for
// the plan (lib/copilot/tell.ts sorts; TellSheets.tsx says what it heard and
// who sorted it). Keeping it is still a tap. Ask a question — "how much did I
// spend this week?" — and the Ask sheet answers it, counted from the rows and
// read aloud (lib/copilot/asked.ts). Beside it, the avatar opens You.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchStage } from '@/lib/copilot/matches';
import { nightlyInFlight, nightlyView } from '@/lib/copilot/nightly';
import { askedOutright, clearlyMoney, readByRules } from '@/lib/copilot/tell';
import type { HomeData } from '@/lib/copilot/types';
import Sheet from '../Sheet';
import SheetContent from '../SheetContent';
import type { Actions, Tab2 } from '../shared';
import { sheetKey, useCopilot } from '../useCopilot';
import { useDerived, type Derived } from './derive';
import { IconMoney, IconSwipe, IconSystem, IconYou } from './icons2';
import ProofTab from './ProofTab';
import MoneyTab, { BookFab, BookSheet, MoneyTabGuard, useBook } from './MoneyTab';
import YouTab from './YouTab';
import SwipeTab from './SwipeTab';
import { useVoice, VoiceButton, VoiceLive } from './VoiceLog';
import { openReading } from './TellSheets';

/** The nav. You is not on it: the avatar in the header opens it. */
const TABS: Tab2[] = ['swipe', 'proof', 'money'];
// The tabs are called Decide and System; their keys stay `swipe` and `proof`,
// because every route, shortcut, push and file that names them already does
// (ALIAS below maps every name onto them).
const LABEL: Record<Tab2, string> = { swipe: 'Decide', proof: 'System', money: 'Money', you: 'You' };
const ICON: Record<Tab2, () => React.ReactElement> = { swipe: IconSwipe, proof: IconSystem, money: IconMoney, you: IconYou };
/** After the last move logged in a burst, the rest of the app re-reads runway once, not once per coffee. */
const HOME_AFTER_BOOK_MS = 4_000;
/**
 * Every tab name either shell has ever used, mapped onto this one. A push or an
 * installed shortcut carrying `?tab=working` lands somewhere sensible here too,
 * and so does Path, whose call and asks are Decide's cards now.
 */
const ALIAS: Record<string, Tab2> = {
  // Path, and Today before it: the day's call and what needs you, which Decide deals.
  path: 'swipe', today: 'swipe', now: 'swipe',
  decide: 'swipe', inbox: 'swipe', needs: 'swipe',
  // Matches was a tab until Swipe replaced it, and Swipe is now Decide; a shortcut or a push naming any of them opens the deck.
  matches: 'swipe', pipeline: 'swipe', opportunities: 'swipe', signals: 'swipe',
  swipe: 'swipe', deck: 'swipe', triage: 'swipe',
  // Work and the Lab were tabs until Proof replaced both, Proof became Engine and Engine is System; any of them opens it.
  proof: 'proof', engine: 'proof', system: 'proof', work: 'proof', business: 'proof', assets: 'proof', history: 'proof',
  lab: 'proof', bets: 'proof', bet: 'proof', experiments: 'proof', tests: 'proof', workflow: 'proof',
  money: 'money', book: 'money', cash: 'money',
  you: 'you', working: 'you',
};

/**
 * Draw the plan when opening the app finds the person said something it has not
 * heard — a goal, a note, a changed day — or there is no plan yet. Path did this
 * on opening; with Path gone the shell does, because the call Decide deals is
 * picked from the plan, and a plan that never redraws is a call that never
 * changes. Once per thing said: the key is what was due and the plan it was due
 * against, so a draw that fails to start is not retried on every render.
 * roadmapDue already holds off for an hour after a failed draw, and the route
 * caps the day.
 */
function usePlanDraw(home: HomeData, d: Derived, actions: Actions) {
  const asked = useRef<string | null>(null);
  const due = d.path.planDue;
  const key = due ? `${due}:${home.roadmap?.current?.id ?? ''}:${home.roadmap?.latest?.id ?? ''}:${home.contextCount}:${home.goals.length}` : null;
  useEffect(() => {
    if (!due || !key || asked.current === key) return;
    asked.current = key;
    void actions.drawRoadmap(due);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** You, in the header's corner on every tab: the person's initial, or the glyph before there is a name. */
function MeButton({ home, on, onOpen }: { home: HomeData; on: boolean; onOpen: () => void }) {
  const initial = home.profile.name?.trim().charAt(0).toUpperCase() || null;
  return (
    <button className={`cp2-me-btn${on ? ' on' : ''}`} onClick={onOpen} aria-label="You: your numbers, goals and settings" aria-current={on ? 'page' : undefined}>
      {initial ?? <IconYou />}
    </button>
  );
}

export default function CopilotApp2({ initial }: { initial: HomeData }) {
  const { home, tab, setTab, actions, sheet, sheetOpen, dismissSheets, briefing, finding, toast, mainRef, say, refresh, arrival, clearArrival } =
    useCopilot<Tab2>(initial, { initialTab: 'swipe', alias: ALIAS });
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
  // What the mic heard while it is being sorted, under the title: a second
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
  usePlanDraw(home, d, actions);
  const status = d.status[tab];
  const nightly = home.nightly?.run && nightlyInFlight(home.nightly.run, new Date()) ? nightlyView(home.nightly.run, new Date()) : null;
  // Where the week's review sends someone about their matches: the new ones to
  // the deck, everyone already written to into the outreach sheet, on the stage
  // that was asked for — "send the drafts" lands on To send.
  const openMatches = (s: MatchStage) => {
    if (s === 'new') setTab('swipe');
    else actions.openSheet({ kind: 'outreach', stage: s });
  };
  // The header's corner, on every tab: the mic, then You. Decide draws it in its own top line.
  const corner = (
    <>
      <VoiceButton voice={voice} onType={() => logMove()} label="Say what happened, or ask" />
      <MeButton home={home} on={tab === 'you'} onOpen={() => setTab('you')} />
    </>
  );
  // While the mic is open, what it hears; while it is sorted, the words being sorted.
  const live = voice.listening
    ? <VoiceLive voice={voice} hint="Listening… say what happened, or ask" />
    : sorting ? <p className="cp2-voice-live" aria-live="polite">Sorting… &ldquo;{sorting}&rdquo;</p>
    : null;

  return (
    <div className={`cp-frame cp2-frame${tab === 'swipe' ? ' cp2-swiping' : ''}${tab === 'money' ? ' cp2-booking' : ''}`}>
      {/* No header on Decide: the card is the screen, as a deck of cards has to be to be read at a glance. Its top line carries the corner. */}
      {tab !== 'swipe' && <header className="cp-header">
        <div className="cp2-header-text">
          <h1>{LABEL[tab]}</h1>
          {/* Tab-aware, and nothing when there is nothing true to say. While the mic is open, what it hears. */}
          {live ?? (status && <p>{status}</p>)}
        </div>
        <div className="cp-header-right">{corner}</div>
      </header>}

      <main className="cp-content" ref={mainRef}>
        {/* The nightly pass runs for minutes after its tap has returned, so it is
            said on every tab, not only on the row that started it. */}
        {nightly?.state === 'running'
          ? <div className="cp-banner"><span className="dot" />Nightly run · {nightly.stepN ? `${nightly.stepN} of ${nightly.of} · ` : ''}{nightly.doing}</div>
          : (briefing || finding) && <div className="cp-banner"><span className="dot" />{finding ? 'Finding real matches' : 'Building today’s call'}</div>}
        {tab === 'swipe' && <SwipeTab home={home} d={d} actions={actions} finding={finding} briefing={briefing} say={say} refresh={refresh} corner={corner} live={live} />}
        {tab === 'proof' && <ProofTab home={home} d={d} actions={actions} briefing={briefing} />}
        {tab === 'money' && <MoneyTabGuard><MoneyTab book={book} actions={actions} say={say} arrival={arrival} clearArrival={clearArrival} /></MoneyTabGuard>}
        {tab === 'you' && <YouTab home={home} d={d} actions={actions} openMatches={openMatches} briefing={briefing} />}
      </main>

      <nav className="cp-nav cp2-nav" aria-label="Sections">
        {TABS.map((t) => {
          const Icon = ICON[t];
          // One count, on the one tab where it is an ask: what waits on you. The posts a bet found are leads, as businesses are, and not counted.
          const badge = t === 'swipe' ? d.decideNeeds : 0;
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

      {tab === 'money' && <BookFab book={book} scroller={mainRef} />}

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
