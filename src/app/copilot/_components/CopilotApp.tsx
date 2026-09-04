'use client';
// The installed app: header, four tabs, bottom sheet, toast. Holds all client
// state and talks to /api/copilot. Optimistic where it is safe to be.

import { useCallback, useEffect, useRef, useState } from 'react';
import { CAPACITY_META, type ActionStatus, type Capacity, type Goal, type GrowthItem, type HomeData, type OpportunityStatus, type SourceKey } from '@/lib/copilot/types';
import { del, get, post } from './api';
import { greeting } from './format';
import { IconGrowth, IconOpps, IconToday, IconYou } from './icons';
import Sheet from './Sheet';
import SheetContent from './SheetContent';
import type { Actions, SheetState, Tab } from './shared';
import GrowthView from './views/GrowthView';
import OppsView from './views/OppsView';
import TodayView from './views/TodayView';
import YouView from './views/YouView';

/** The sheet body stays mounted while it slides out, so each target needs its own
 * identity or one goal's form state would be saved onto the next goal opened. */
function sheetKey(s: SheetState): string {
  return `${s.kind}:${'id' in s && s.id ? s.id : 'new'}`;
}

export default function CopilotApp({ initial }: { initial: HomeData }) {
  const [home, setHome] = useState<HomeData>(initial);
  const [tab, setTab] = useState<Tab>('today');
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [briefing, setBriefing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const briefStarted = useRef(false);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const refresh = useCallback(async () => {
    const data = await get<HomeData>('/home');
    setHome(data);
  }, []);

  const runBrief = useCallback(async (reason = 'manual') => {
    setBriefing(true);
    try {
      const r = await post<{ home: HomeData; agent: string; fellBack: boolean }>('/brief', { reason });
      setHome(r.home);
      if (r.fellBack) say('Agent unavailable, showed a starter brief');
      else if (reason === 'manual') say('Brief refreshed');
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not refresh');
    } finally {
      setBriefing(false);
    }
  }, [say]);

  // First open of the day: build today's brief in the background.
  useEffect(() => {
    if (initial.needsBrief && !briefStarted.current) {
      briefStarted.current = true;
      void runBrief('daily');
    }
  }, [initial.needsBrief, runBrief]);

  const actions: Actions = {
    openSheet: (s) => { setSheet(s); setSheetOpen(true); },
    closeSheet: () => setSheetOpen(false),
    setTab,
    runBrief,
    async addNote(content, regenerate) {
      try {
        if (regenerate) setBriefing(true);
        await post('/context', { content, regenerate });
        await refresh();
        say(regenerate ? 'Added and re-planned' : 'Added to your context');
        return true;
      } catch (e) {
        say(e instanceof Error ? e.message : 'Could not save');
        return false;
      } finally {
        setBriefing(false);
      }
    },
    async setGrowthStatus(id: string, status: GrowthItem['status']) {
      setHome((h) => ({
        ...h,
        skills: status === 'active' ? h.skills : h.skills.filter((g) => g.id !== id),
        lessons: status === 'active' ? h.lessons : h.lessons.filter((g) => g.id !== id),
      }));
      try {
        await post(`/growth/${id}`, { status });
      } catch (e) {
        say(e instanceof Error ? e.message : 'Could not update');
        void refresh();
      }
    },
    async setOppStatus(id: string, status: OpportunityStatus) {
      setHome((h) => ({
        ...h,
        opportunities: status === 'dismissed' || status === 'acted'
          ? h.opportunities.filter((o) => o.id !== id)
          : h.opportunities.map((o) => (o.id === id ? { ...o, status } : o)),
      }));
      setSheetOpen(false);
      try {
        await post(`/opportunities/${id}`, { status });
        say(status === 'saved' ? 'Saved. More like this next time.' : status === 'dismissed' ? 'Skipped. Fewer like this.' : status === 'acted' ? 'Logged. Nice.' : 'Back to new');
      } catch (e) {
        say(e instanceof Error ? e.message : 'Could not update');
        void refresh();
      }
    },
    async setActionStatus(id: string, status: ActionStatus) {
      setHome((h) => ({
        ...h,
        plan: h.plan.map((a) => (a.id === id ? { ...a, status } : a)).filter((a) => a.status !== 'dismissed'),
        nudges: h.nudges.filter((a) => a.id !== id || status === 'open'),
      }));
      setSheetOpen(false);
      try {
        await post(`/actions/${id}`, { status });
      } catch (e) {
        say(e instanceof Error ? e.message : 'Could not update');
        void refresh();
      }
    },
    async requestSource(key: SourceKey) {
      setHome((h) => ({ ...h, sources: h.sources.map((s) => (s.source_key === key ? { ...s, status: 'requested' } : s)) }));
      try {
        await post(`/sources/${key}`);
        say('Noted. Connectors land here once built.');
      } catch (e) {
        say(e instanceof Error ? e.message : 'Could not update');
      }
    },
    async saveGoal(patch: Partial<Goal> & { id?: string; title?: string }) {
      try {
        await post('/goals', patch);
        setSheetOpen(false);
        await refresh();
        say('Goal saved');
      } catch (e) {
        say(e instanceof Error ? e.message : 'Could not save goal');
      }
    },
    async setCapacity(c: Capacity) {
      setHome((h) => ({ ...h, profile: { ...h.profile, capacity: c } }));
      setSheetOpen(false);
      try {
        const r = await post<{ home: HomeData }>('/capacity', { capacity: c });
        setHome(r.home);
      } catch (e) {
        say(e instanceof Error ? e.message : 'Could not update');
      }
    },
    async resetDevice() {
      await del('/session');
      window.location.reload();
    },
  };

  const newMatches = home.opportunities.filter((o) => o.status === 'new').length;
  const needYou = home.plan.filter((a) => a.owner === 'you' && a.status === 'open').length + home.nudges.filter((n) => n.urgency === 'urgent').length;

  return (
    <div className="cp-frame">
      <header className="cp-header">
        <div>
          <h1>{greeting(home.profile.timezone, home.profile.name)}</h1>
          <p>{newMatches} new match{newMatches === 1 ? '' : 'es'} · {needYou} need you</p>
        </div>
        <button className="cp-capacity" onClick={() => actions.openSheet({ kind: 'capacity' })} aria-label="Set your capacity">
          ⚡ <span>{CAPACITY_META[home.profile.capacity].label}</span>
        </button>
      </header>

      <main className="cp-content">
        {tab === 'today' && <TodayView home={home} actions={actions} briefing={briefing} />}
        {tab === 'opps' && <OppsView home={home} actions={actions} />}
        {tab === 'growth' && <GrowthView home={home} actions={actions} />}
        {tab === 'you' && <YouView home={home} actions={actions} briefing={briefing} />}
      </main>

      <nav className="cp-nav" aria-label="Sections">
        <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}><IconToday />Today</button>
        <button className={tab === 'opps' ? 'active' : ''} onClick={() => setTab('opps')}><IconOpps />Opps</button>
        <button className={tab === 'growth' ? 'active' : ''} onClick={() => setTab('growth')}><IconGrowth />Growth</button>
        <button className={tab === 'you' ? 'active' : ''} onClick={() => setTab('you')}><IconYou />You</button>
      </nav>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        {sheet && <SheetContent key={sheetKey(sheet)} sheet={sheet} home={home} actions={actions} />}
      </Sheet>

      {toast && <div className="cp-toast" role="status">{toast}</div>}
    </div>
  );
}
