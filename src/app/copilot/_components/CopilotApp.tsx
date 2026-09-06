'use client';
// The installed app: header, four tabs, bottom sheet, toast. Holds all client
// state and talks to /api/copilot. Optimistic where it is safe to be.

import { useCallback, useEffect, useRef, useState } from 'react';
import { offerIsEmpty } from '@/lib/copilot/offer';
import { CAPACITY_META, type ActionStatus, type Capacity, type Channel, type Goal, type GrowthItem, type HomeData, type Offer, type OpportunityStatus, type SourceKey } from '@/lib/copilot/types';
import { api, del, get, post } from './api';
import { greeting, urlBase64ToUint8Array } from './format';
import { IconGrowth, IconOpps, IconToday, IconYou } from './icons';
import Sheet from './Sheet';
import SheetContent from './SheetContent';
import type { Actions, OutcomeInput, SheetState, Tab } from './shared';
import GrowthView from './views/GrowthView';
import OppsView from './views/OppsView';
import TodayView from './views/TodayView';
import YouView from './views/YouView';

/** The sheet body stays mounted while it slides out, so each target needs its own
 * identity or one goal's form state would be saved onto the next goal opened. */
function sheetKey(s: SheetState): string {
  const id = 'id' in s && s.id ? s.id : 'oppId' in s ? s.oppId : 'new';
  return `${s.kind}:${id}`;
}

export default function CopilotApp({ initial }: { initial: HomeData }) {
  const [home, setHome] = useState<HomeData>(initial);
  const [tab, setTab] = useState<Tab>('today');
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [briefing, setBriefing] = useState(false);
  const [finding, setFinding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const briefStarted = useRef(false);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
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

  // Back from Stripe. The webhook that flips the plan and the redirect race each
  // other, so confirm the payment immediately and re-read once the webhook has
  // had a moment — otherwise someone who just paid lands on a page still
  // showing the free plan and reasonably assumes it failed.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const upgraded = params.get('upgraded');
    if (!upgraded) return;
    window.history.replaceState({}, '', window.location.pathname);
    say('Payment received. Your new allowance is live.');
    const t = setTimeout(() => { void refresh(); }, 2500);
    return () => clearTimeout(t);
  }, [say, refresh]);

  const openSheet = (s: SheetState) => { setSheet(s); setSheetOpen(true); };
  const closeSheet = () => setSheetOpen(false);
  const fail = (e: unknown, fallback: string) => say(e instanceof Error ? e.message : fallback);

  const actions: Actions = {
    openSheet,
    closeSheet,
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
        fail(e, 'Could not save');
        return false;
      } finally {
        setBriefing(false);
      }
    },
    async setGrowthStatus(id: string, status: GrowthItem['status']) {
      setHome((h) => ({ ...h, lessons: status === 'active' ? h.lessons : h.lessons.filter((g) => g.id !== id) }));
      try { await post(`/growth/${id}`, { status }); } catch (e) { fail(e, 'Could not update'); void refresh(); }
    },
    async setOppStatus(id: string, status: OpportunityStatus) {
      setHome((h) => ({
        ...h,
        opportunities: status === 'dismissed' || status === 'acted'
          ? h.opportunities.filter((o) => o.id !== id)
          : h.opportunities.map((o) => (o.id === id ? { ...o, status } : o)),
      }));
      closeSheet();
      try {
        await post(`/opportunities/${id}`, { status });
        say(status === 'saved' ? 'Saved. More like this next time.' : status === 'dismissed' ? 'Skipped. Fewer like this.' : status === 'acted' ? 'Logged.' : 'Back to new');
      } catch (e) { fail(e, 'Could not update'); void refresh(); }
    },
    async setActionStatus(id: string, status: ActionStatus) {
      setHome((h) => ({
        ...h,
        plan: h.plan.map((a) => (a.id === id ? { ...a, status } : a)).filter((a) => a.status !== 'dismissed'),
        queue: h.queue.filter((q) => q.id !== id || status === 'open'),
        nudges: h.nudges.filter((a) => a.id !== id || status === 'open'),
      }));
      closeSheet();
      try { await post(`/actions/${id}`, { status }); } catch (e) { fail(e, 'Could not update'); void refresh(); }
    },
    async requestSource(key: SourceKey) {
      setHome((h) => ({ ...h, sources: h.sources.map((s) => (s.source_key === key ? { ...s, status: 'requested' } : s)) }));
      try { await post(`/sources/${key}`); say('Noted. Connectors land here once built.'); } catch (e) { fail(e, 'Could not update'); }
    },
    async saveGoal(patch: Partial<Goal> & { id?: string; title?: string }) {
      try { await post('/goals', patch); closeSheet(); await refresh(); say('Goal saved'); } catch (e) { fail(e, 'Could not save goal'); }
    },
    async setCapacity(c: Capacity) {
      setHome((h) => ({ ...h, profile: { ...h.profile, capacity: c } }));
      closeSheet();
      try { const r = await post<{ home: HomeData }>('/capacity', { capacity: c }); setHome(r.home); } catch (e) { fail(e, 'Could not update'); }
    },
    async resetDevice() {
      await del('/session');
      window.location.reload();
    },

    // — closed loop —
    async sendAction(id, overrides) {
      try {
        const r = await post<{ ok: boolean; home: HomeData; execution: { error?: string | null } }>(`/actions/${id}/send`, overrides ?? {});
        setHome(r.home);
        say('Sent. Follow-up drafted for day 3.');
        closeSheet();
        return true;
      } catch (e) {
        fail(e, 'Send failed');
        void refresh();
        return false;
      }
    },
    async markSent(id, overrides) {
      try {
        const r = await post<{ home: HomeData }>(`/actions/${id}/sent`, overrides ?? {});
        setHome(r.home);
        say('Logged as sent. Follow-up drafted for day 3.');
        closeSheet();
        return true;
      } catch (e) { fail(e, 'Could not record'); void refresh(); return false; }
    },
    async saveOffer(offer: Offer) {
      try {
        const r = await post<{ home: HomeData; rewritten?: number }>('/offer', offer);
        setHome(r.home); closeSheet();
        say(r.rewritten ? `Saved. ${r.rewritten} waiting draft${r.rewritten === 1 ? '' : 's'} rewritten in your words.` : 'Saved. Drafts will use your words now.');
        return true;
      }
      catch (e) { fail(e, 'Could not save'); return false; }
    },
    async cancelDraft(id) {
      try { await api(`/actions/${id}/send`, { method: 'DELETE' }); await refresh(); closeSheet(); say('Draft cancelled'); } catch (e) { fail(e, 'Could not cancel'); }
    },
    async recordOutcome(input: OutcomeInput) {
      try {
        const r = await post<{ home: HomeData }>('/outcomes', input);
        setHome(r.home);
        closeSheet();
        say(input.kind === 'won' ? 'Logged. Goal updated.' : input.kind === 'reply' ? 'Reply logged. Ranking learns from this.' : 'Logged.');
        return true;
      } catch (e) { fail(e, 'Could not record'); return false; }
    },
    async draftFor(oppId, channel?: Channel) {
      try {
        const r = await post<{ home: HomeData; actionId: string; execution: unknown | null; existing?: boolean }>(`/opportunities/${oppId}/draft`, { channel });
        setHome(r.home);
        setTab('today');
        openSheet({ kind: 'action', id: r.actionId });
        // Drafting twice opens the message already waiting rather than writing a second one.
        say(r.existing ? 'Already drafted — here it is.' : r.execution ? 'Drafted. Review and approve to send.' : 'Drafted. No contact on that channel, copy it manually.');
        return true;
      } catch (e) { fail(e, 'Could not draft'); return false; }
    },
    async findMatches() {
      setFinding(true);
      try {
        const r = await post<{ home: HomeData; result: { supply: { inserted?: number; found?: number } | null } }>('/supply');
        setHome(r.home);
        const n = r.result?.supply && 'inserted' in r.result.supply ? r.result.supply.inserted ?? 0 : 0;
        say(n ? `${n} new real match${n === 1 ? '' : 'es'} found and ranked` : 'No new matches. Try wider targeting.');
      } catch (e) { fail(e, 'Could not find matches'); }
      finally { setFinding(false); }
    },
    async saveFinance(f) {
      try { const r = await post<{ home: HomeData }>('/finance', f); setHome(r.home); closeSheet(); say('Runway updated'); return true; } catch (e) { fail(e, 'Could not save'); return false; }
    },
    async openBilling() {
      try {
        const r = await post<{ url: string }>('/billing/portal', {});
        window.location.href = r.url;
      } catch (e) { fail(e, 'Could not open billing'); }
    },
    async saveTargeting(t) {
      try { const r = await post<{ home: HomeData }>('/targeting', t); setHome(r.home); say('Targeting saved'); return true; } catch (e) { fail(e, 'Could not save'); return false; }
    },
    async requestLoginLink(email) {
      try { await post('/auth/magic-link', { email }); return { ok: true }; } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Could not send' }; }
    },
    async setPush(enabled) {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('This browser does not support push');
        const reg = await navigator.serviceWorker.ready;
        if (enabled) {
          if (!home.push.publicKey) throw new Error('Push is not configured on the server');
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') throw new Error('Notifications were not allowed');
          const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(home.push.publicKey) });
          await post('/push/subscribe', sub.toJSON());
        } else {
          const sub = await reg.pushManager.getSubscription();
          if (sub) { await api('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
        }
        setHome((h) => ({ ...h, push: { ...h.push, enabled } }));
        say(enabled ? 'Nudges will reach this device.' : 'Nudges off on this device.');
        return true;
      } catch (e) { fail(e, 'Could not change notifications'); return false; }
    },
  };

  // Sending first. The old line led with "107 new matches" — celebrating the side
  // of the funnel that was never the problem.
  const headline = offerIsEmpty(home.profile.offer)
    ? 'Set your offer to start sending'
    : [
        `${home.queue.length} to send`,
        `${home.metrics.replies} replied`,
        home.metrics.runway_months != null ? `runway ${home.metrics.runway_months} mo` : null,
      ].filter(Boolean).join(' · ');

  return (
    <div className="cp-frame">
      <header className="cp-header">
        <div>
          <h1>{greeting(home.profile.timezone, home.profile.name)}</h1>
          <p>{headline}</p>
        </div>
        <button className="cp-capacity" onClick={() => openSheet({ kind: 'capacity' })} aria-label="Set your capacity">
          ⚡ <span>{CAPACITY_META[home.profile.capacity].label}</span>
        </button>
      </header>

      <main className="cp-content">
        {tab === 'today' && <TodayView home={home} actions={actions} briefing={briefing} finding={finding} />}
        {tab === 'opps' && <OppsView home={home} actions={actions} finding={finding} />}
        {tab === 'growth' && <GrowthView home={home} actions={actions} />}
        {tab === 'you' && <YouView home={home} actions={actions} briefing={briefing} finding={finding} />}
      </main>

      <nav className="cp-nav" aria-label="Sections">
        <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}><IconToday />Today</button>
        <button className={tab === 'opps' ? 'active' : ''} onClick={() => setTab('opps')}><IconOpps />Opps</button>
        <button className={tab === 'growth' ? 'active' : ''} onClick={() => setTab('growth')}><IconGrowth />Growth</button>
        <button className={tab === 'you' ? 'active' : ''} onClick={() => setTab('you')}><IconYou />You</button>
      </nav>

      <Sheet open={sheetOpen} onClose={closeSheet}>
        {sheet && <SheetContent key={sheetKey(sheet)} sheet={sheet} home={home} actions={actions} />}
      </Sheet>

      {toast && <div className="cp-toast" role="status">{toast}</div>}
    </div>
  );
}
