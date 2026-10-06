'use client';
// Everything a shell needs to run the app: the home data, the sheet stack, the
// toast, the tab, and every action against /api/copilot.
//
// Two component trees render the same app — the two-tab one at /copilot and
// /lifeos, the four-tab one at /copilot2 — and they must not disagree about
// what sending, closing a mandate or answering the call actually does. This is
// where the Actions object lives so there is exactly one of it. It was a
// closure inside CopilotApp, which would have meant a second shell copying four
// hundred lines of it and the two copies drifting the first time either changed.
//
// Optimistic where it is safe to be.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionStatus, Capacity, Channel, Goal, HomeData, Offer, OpportunityStatus, SourceKey } from '@/lib/copilot/types';
import type { Discovered } from '@/lib/copilot/watch/discover';
import type { AskAnswer } from '@/lib/copilot/ask';
import type { Connection } from '@/lib/copilot/oauth';
import { nightlyInFlight, nightlyToast, nightlyView, type NightlyRun } from '@/lib/copilot/nightly';
import { roadmapInFlight, type MarkState, type RoadmapRun } from '@/lib/copilot/roadmap';
import type { ExperimentState } from '@/lib/copilot/experiment';
import { importLine, type MoneyImport } from '@/lib/copilot/money/ledger';
import { takeSharedSeed } from './sharedSeed';

/** What answering the experiment did, said back: the next plan is what changes. */
const EXPERIMENT_SAID: Record<ExperimentState, string> = {
  started: 'Started. It asks how it went on its check date.',
  dropped: 'Set aside. The next plan knows.',
  worked: 'Noted: it worked. The next plan builds on it.',
  failed: 'Noted: it did not work. The next plan will not offer it again.',
  unclear: 'Noted. The next plan knows it was not clear either way.',
  ignored: 'Noted.',
};

/** What each bet write did, said back. A bet's verdict is never one of them: the rows give it on the next load. */
const LAB_SAID: Record<LabInput['action'], string> = {
  open: 'Bet started. Only what happens from today counts.',
  shelve: 'Kept on your shelf. Nothing counts until you start it.',
  unshelve: 'Taken off your shelf.',
  stop: 'Called off. It stays in your history.',
  talk: 'Logged.',
  intro: 'Noted. It is off your Path.',
  forget: 'Removed.',
  count: 'Counted.',
  uncount: 'Removed.',
  link: 'Tied to the bet.',
  ideas: 'New ideas, written from your record.',
  found_by: 'Saved. Proof reads your business that way now.',
  checkpoint: 'Decided. The next checkpoint reads it back.',
};

/** What each asset write did, said back. */
const ASSET_SAID: Record<AssetInput['action'], string> = {
  add: 'Added to your assets.',
  version: 'Saved as the next version.',
  draft: 'Drafted. Read it, then keep it, rewrite it or put it away.',
  retire: 'Put away. It stays in your history.',
  restore: 'Back in your assets.',
  adopt: 'That is your offer now.',
  proof: 'Your messages carry that link now.',
};
import { api, del, get, post, upload } from './api';
import { urlBase64ToUint8Array } from './format';
import { useShell } from './shell';
import type { Actions, AssetInput, LabInput, OutcomeInput, SheetState, Tab, Tab2 } from './shared';

export interface CopilotConfig<T extends Tab | Tab2> {
  /** Where the app opens. */
  initialTab: T;
  /**
   * Every name a deep link or another screen may use, mapped onto this shell's
   * tabs. Installed shells and already-delivered pushes carry old names, and a
   * tab name that maps to nothing is ignored rather than rendering a blank tab.
   */
  alias: Record<string, T>;
  /**
   * Where a freshly drafted message should be opened from. v1 jumps to Now,
   * because that is where its queue lives; v2 leaves you on the tab you drafted
   * from, because the Matches list is where the next one is.
   */
  afterDraft?: T;
}

/**
 * How the app was opened, when it was opened to do one thing: a file shared to
 * it (manifest share_target — `shared` is how many the service worker kept, or
 * 'done'/'error' from the server's fallback, with what to say in `why`), or the
 * Log money shortcut (`add`).
 */
export interface Arrival { shared: string | null; why: string | null; add: boolean }

/** The sheet body stays mounted while it slides out, so each target needs its own
 * identity or one goal's form state would be saved onto the next goal opened. */
export function sheetKey(s: SheetState): string {
  const id = 'id' in s && s.id ? s.id : 'oppId' in s ? s.oppId : 'term' in s ? s.term : 'new';
  // Two sheets of one kind opened on different things are two sheets: a bet
  // sheet opened from one play and then from another must not keep the first
  // one's line, nor a new asset the first one's kind.
  // A second question asked into the mic is a second answer, not the first one's sheet.
  const on = (['play', 'idea', 'part', 'assetKind', 'bet', 'outcome', 'via', 'talk', 'heard', 'shelf'] as const)
    .map((k) => (k in s ? String((s as Record<string, unknown>)[k] ?? '') : ''))
    .join(':');
  const exp = 'experiment' in s && s.experiment ? s.experiment.id : '';
  // Words shared in are a sheet of their own: another share is not this one's belief.
  const seed = 'seed' in s && s.seed ? `${s.seed.text.length}${s.seed.text.slice(0, 24)}${s.seed.url ?? ''}` : '';
  return `${s.kind}:${id}:${on}:${exp}:${seed}`;
}

/** The paid finders by name, for a toast that says which one failed; the rest are feeds. */
const FINDER_NAME: Record<string, string> = { web: 'the web', google_maps: 'Google Maps' };

/**
 * How often a running nightly pass is checked on. It takes minutes, so this
 * is about the step label keeping up, not about catching the end sooner.
 */
const NIGHTLY_POLL_MS = 4_000;
/** Consecutive failed checks before saying so. One is a blip; three is the connection. */
const NIGHTLY_MISSES = 3;
/** A draw is one model call, usually under a minute. */
const ROADMAP_POLL_MS = 3_000;
/** A PDF or a screenshot is one model call a few pages long. */
const IMPORT_POLL_MS = 3_000;

export function useCopilot<T extends Tab | Tab2>(initial: HomeData, cfg: CopilotConfig<T>) {
  const shell = useShell();
  const [home, setHome] = useState<HomeData>(initial);
  const [tab, setTabState] = useState<T>(cfg.initialTab);
  // Sheets stack: Goal opened from You returns to You on close. The last one
  // shown stays mounted while the sheet slides out, so the content does not
  // blank mid-animation.
  const [stack, setStack] = useState<SheetState[]>([]);
  const lastSheet = useRef<SheetState | null>(null);
  const top = stack[stack.length - 1] ?? null;
  if (top) lastSheet.current = top;
  const sheet = top ?? lastSheet.current;
  const sheetOpen = stack.length > 0;
  const [briefing, setBriefing] = useState(false);
  const [finding, setFinding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const clearArrival = useCallback(() => setArrival(null), []);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const briefStarted = useRef(false);
  // One scroll container serves all tabs, so without this a tab opens wherever
  // the last one was scrolled to.
  const mainRef = useRef<HTMLElement | null>(null);
  useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [tab]);

  // The alias lives in the caller and is a constant there, so reading it through
  // a ref keeps setTab stable without asking every caller to memoise it.
  const aliasRef = useRef(cfg.alias);
  aliasRef.current = cfg.alias;
  const setTab = useCallback((t: Tab | Tab2) => {
    const resolved = aliasRef.current[t];
    if (resolved) setTabState(resolved);
  }, []);

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
      const r = await post<{ home: HomeData; agent: string; fellBack: boolean; unsaved?: string | null }>('/brief', { reason });
      setHome(r.home);
      if (r.unsaved) say(`Today’s call did not save: ${r.unsaved}`);
      else if (r.fellBack) say('Agent unavailable, showed a starter brief');
      else if (reason === 'manual') say('Brief refreshed');
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not refresh');
    } finally {
      setBriefing(false);
    }
  }, [say]);

  const findMatches = useCallback(async (first = false) => {
    setFinding(true);
    try {
      const r = await post<{ home: HomeData; result: { supply: { inserted?: number; found?: number; partial?: boolean; perAdapter?: Record<string, { error?: string }> } | null } }>('/supply');
      setHome(r.home);
      const supply = r.result?.supply && 'inserted' in r.result.supply ? r.result.supply : null;
      const n = supply?.inserted ?? 0;
      // A finder that threw is caught per adapter so the others still run — which
      // also means a run where everything failed returns like one that found
      // nothing. With nothing new, the failure is the answer (invariant 13).
      const broke = n ? undefined : Object.entries(supply?.perAdapter ?? {}).find(([, a]) => a.error);
      const failed = broke ? `Could not search${FINDER_NAME[broke[0]] ? ` ${FINDER_NAME[broke[0]]}` : ''}: ${broke[1].error}` : null;
      // A run can stop early on purpose: scraping every segment takes minutes
      // and the request has to come back before the proxy gives up. Saying so
      // is better than looking like there was nothing left to find.
      say(supply?.partial
        ? `${n} found so far — there was not time for every search. Tap again for more.`
        : failed ? failed
        : first
        ? (n ? `${n} business${n === 1 ? '' : 'es'} found. Openers are drafted below.` : 'Nothing found yet.')
        : n ? `${n} new real match${n === 1 ? '' : 'es'} found and ranked`
        // What happened, not a setting to go and change: the search is the app's to fix.
        : supply?.found ? 'Nothing new — it had already seen everything it found.'
        : 'Nothing new turned up.');
    } catch (e) { say(e instanceof Error ? e.message : 'Could not find matches'); }
    finally { setFinding(false); }
  }, [say]);

  // "Run again": tonight's pass, now. The route only starts it, since the pass
  // runs for minutes after the response, so this just shows it has begun. The
  // effect below watches it and reloads when it ends.
  const runNightly = useCallback(async () => {
    try {
      const r = await post<{ run: NightlyRun; already?: boolean }>('/nightly');
      setHome((h) => ({ ...h, nightly: { run: r.run, unreadable: null } }));
      say(r.already
        ? 'Already running. The result lands under You when it ends.'
        : 'Running tonight’s pass now. It takes a few minutes, and you can leave the app.');
    } catch (e) { say(e instanceof Error ? e.message : 'Could not start the run'); }
  }, [say]);

  // While a pass is in flight, whoever started it (this tap, another device, or
  // the schedule), follow it: update the step as it moves, and when it ends,
  // reload everything it changed and say what came back. Keyed on the run id,
  // so a newer run replaces the one being watched rather than racing it.
  const liveNightly = home.nightly?.run && nightlyInFlight(home.nightly.run, new Date()) ? home.nightly.run.id : null;
  useEffect(() => {
    if (!liveNightly) return;
    let over = false;
    let misses = 0;
    const tick = async () => {
      let run: NightlyRun | null;
      try {
        run = (await get<{ run: NightlyRun | null }>('/nightly')).run;
        misses = 0;
      } catch (e) {
        // Said once, not swallowed: a screen that cannot reach the server would
        // otherwise read "Running" for as long as the connection is down.
        misses += 1;
        if (misses === NIGHTLY_MISSES) say(`Cannot check on the run: ${e instanceof Error ? e.message : 'no connection'}. Still trying.`);
        return;
      }
      if (over) return;
      if (run && nightlyInFlight(run, new Date())) {
        setHome((h) => ({ ...h, nightly: { run, unreadable: null } }));
        return;
      }
      // Ended: done, failed, or stopped without finishing. Stop first, so a
      // slow reload cannot overlap the next tick.
      over = true;
      clearInterval(timer);
      const said = nightlyToast(nightlyView(run, new Date()));
      try {
        await refresh();
      } catch {
        setHome((h) => ({ ...h, nightly: { run, unreadable: null } }));
        say('The run ended, but this screen could not reload. Reopen the app to see what it found.');
        return;
      }
      if (said) say(said);
    };
    const timer = setInterval(() => { void tick(); }, NIGHTLY_POLL_MS);
    return () => { over = true; clearInterval(timer); };
  }, [liveNightly, refresh, say]);

  // The Path's plan. Drawing starts a row and returns; the model answers in
  // after(), so this only records that it began. The effect below watches it.
  const drawRoadmap = useCallback(async (reason = 'manual') => {
    try {
      const r = await post<{ run: RoadmapRun; already?: boolean }>('/roadmap', { action: 'draw', reason });
      setHome((h) => (h.roadmap ? { ...h, roadmap: { ...h.roadmap, latest: r.run } } : h));
      // Only when asked. A redraw started because something changed is shown
      // on the plan itself, and a toast on opening the app is noise.
      if (reason === 'manual') say(r.already ? 'Already redrawing.' : 'Redrawing your plan. It takes about a minute.');
    } catch (e) { say(e instanceof Error ? e.message : 'Could not redraw the plan'); }
  }, [say]);

  // While a draw is in flight, follow it, and reload when it ends — the plan,
  // the move it puts first and the header all change with it.
  const liveRoadmap = home.roadmap?.latest && roadmapInFlight(home.roadmap.latest, new Date()) ? home.roadmap.latest.id : null;
  useEffect(() => {
    if (!liveRoadmap) return;
    let over = false;
    let misses = 0;
    const tick = async () => {
      let run: RoadmapRun | null;
      try {
        run = (await get<{ run: RoadmapRun | null }>('/roadmap')).run;
        misses = 0;
      } catch (e) {
        misses += 1;
        if (misses === NIGHTLY_MISSES) say(`Cannot check on the plan: ${e instanceof Error ? e.message : 'no connection'}. Still trying.`);
        return;
      }
      if (over || (run && roadmapInFlight(run, new Date()))) return;
      over = true;
      clearInterval(timer);
      try { await refresh(); } catch {
        say('The plan was redrawn, but this screen could not reload. Reopen the app to see it.');
        return;
      }
      // A failure is said here and stays on the plan; success shows itself.
      if (run?.status === 'error') say(`Could not redraw the plan: ${run.error ?? 'no reason given'}`);
    };
    const timer = setInterval(() => { void tick(); }, ROADMAP_POLL_MS);
    return () => { over = true; clearInterval(timer); };
  }, [liveRoadmap, refresh, say]);

  // A PDF or a screenshot is read in after(), so the upload returns while it is
  // still being read. Follow it — keyed on the ids being read, so a second
  // upload joins the watch rather than racing it — and reload when it lands,
  // saying what it came to, failure included.
  const readingIds = (home.money?.imports ?? []).filter((i) => i.status === 'reading').map((i) => i.id).join(',');
  useEffect(() => {
    if (!readingIds) return;
    const watched = readingIds.split(',');
    let over = false;
    let misses = 0;
    const tick = async () => {
      let imports: MoneyImport[];
      try {
        imports = (await get<{ imports: MoneyImport[] }>('/money')).imports;
        misses = 0;
      } catch (e) {
        misses += 1;
        if (misses === NIGHTLY_MISSES) say(`Cannot check on your statement: ${e instanceof Error ? e.message : 'no connection'}. Still trying.`);
        return;
      }
      if (over || imports.some((i) => watched.includes(i.id) && i.status === 'reading')) return;
      over = true;
      clearInterval(timer);
      try { await refresh(); } catch {
        say('Your statement was read, but this screen could not reload. Reopen the app to see it.');
        return;
      }
      const lines = imports.filter((i) => watched.includes(i.id)).map(importLine).filter((x): x is string => !!x);
      if (lines.length) say(lines.join(' '));
    };
    const timer = setInterval(() => { void tick(); }, IMPORT_POLL_MS);
    return () => { over = true; clearInterval(timer); };
  }, [readingIds, refresh, say]);

  // First open. A brand new account has nothing to look at, so the first thing
  // the app does is go and find some — the supply route runs the brief too, so
  // this replaces the daily brief rather than racing it. One or the other,
  // never both, and only once per mount.
  useEffect(() => {
    if (briefStarted.current) return;
    if (initial.needsFirstSupply) {
      briefStarted.current = true;
      void findMatches(true);
    } else if (initial.needsBrief) {
      briefStarted.current = true;
      void runBrief('daily');
    }
  }, [initial.needsFirstSupply, initial.needsBrief, findMatches, runBrief]);

  // The service worker, registered by the app itself. The root layout does it
  // on window load, which has usually fired by the time its afterInteractive
  // script runs, so on these pages it often never happened: turning nudges on
  // waited on `ready` forever, and a file shared to the app from the phone
  // skipped the worker that keeps it (public/sw.js). Registering the same
  // script again is a no-op when it already is.
  const swError = useRef<string | null>(null);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((e: unknown) => { swError.current = e instanceof Error ? e.message : String(e); });
  }, []);

  // Words shared from another app — a reply from Claude or Grok — open as the
  // start of a bet, with what was shared on the sheet. Read here and now: the URL
  // is cleaned below before anything else could. A failure to keep them arrives
  // as `why` and is said instead of reading a cache it never reached.
  const tookText = useRef(false);
  const takeText = useCallback(async (why: string | null) => {
    // Once: the read spends what the share kept, and development runs an effect twice.
    if (tookText.current) return;
    tookText.current = true;
    if (why) return say(why);
    const got = await takeSharedSeed();
    if (got.seed) setStack((st) => [...st, { kind: 'bet', seed: got.seed ?? undefined }]);
    else say(got.error ?? 'Nothing came through that share.');
  }, [say]);

  // Back from Stripe. The webhook that flips the plan and the redirect race each
  // other, so confirm the payment immediately and re-read once the webhook has
  // had a moment — otherwise someone who just paid lands on a page still
  // showing the free plan and reasonably assumes it failed.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const upgraded = params.get('upgraded');
    // A push can deep-link to a tab.
    const wanted = params.get('tab');
    const resolved = wanted ? aliasRef.current[wanted] : undefined;
    if (resolved) setTabState(resolved);
    // A file shared from another app, or the Log money shortcut: kept for the
    // tab that handles it, since the URL is cleaned below before it mounts.
    // Words shared are not a file and open a sheet instead (takeText).
    const shared = params.get('shared');
    if (shared === 'text') void takeText(params.get('why'));
    else if (shared || params.get('add')) {
      setArrival({ shared, why: params.get('why'), add: params.get('add') === '1' });
    }
    if (!upgraded && !wanted) return;
    window.history.replaceState({}, '', window.location.pathname);
    if (!upgraded) return;
    say('Payment received. Your new allowance is live.');
    const t = setTimeout(() => { void refresh(); }, 2500);
    return () => clearTimeout(t);
  }, [say, refresh, takeText]);

  const openSheet = (s: SheetState) => setStack((st) => [...st, s]);
  const closeSheet = () => setStack((st) => st.slice(0, -1));
  /** Overlay tap or Escape: everything goes, not just the top. */
  const dismissSheets = useCallback(() => setStack([]), []);
  const fail = (e: unknown, fallback: string) => say(e instanceof Error ? e.message : fallback);

  const actions: Actions = {
    openSheet,
    closeSheet,
    setTab,
    runBrief,
    runNightly,
    drawRoadmap,
    async markRoadmap(item: string, state: MarkState) {
      // Optimistic: a tick that waits on a round trip is a tick tapped twice.
      const mark = { item, title: '', state, at: new Date().toISOString() };
      setHome((h) => (h.roadmap ? { ...h, roadmap: { ...h.roadmap, marks: [mark, ...h.roadmap.marks] } } : h));
      try {
        const r = await post<{ home: HomeData }>('/roadmap', { action: 'mark', item, state });
        setHome(r.home);
        return true;
      } catch (e) {
        fail(e, 'Could not save that');
        void refresh();
        return false;
      }
    },
    async markExperiment(id: string, state: ExperimentState) {
      try {
        const r = await post<{ home: HomeData }>('/roadmap', { action: 'experiment', id, state });
        setHome(r.home);
        say(EXPERIMENT_SAID[state]);
      } catch (e) { fail(e, 'Could not save that'); }
    },
    async handOverStep(item: string) {
      try {
        const r = await post<{ home: HomeData; started: boolean }>('/roadmap', { action: 'handover', item });
        setHome(r.home);
        // Said as what happened: started now, or written and waiting on an approval
        // that could not be given (three already running) — never "done".
        say(r.started ? 'Handed over. It is starting now.' : 'Written. Approve it under Projects on Proof to start it.');
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not hand that over' };
      }
    },
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
      }));
      closeSheet();
      try { await post(`/actions/${id}`, { status }); } catch (e) { fail(e, 'Could not update'); void refresh(); }
    },
    async requestSource(key: SourceKey) {
      setHome((h) => ({ ...h, sources: h.sources.map((s) => (s.source_key === key ? { ...s, status: 'requested' } : s)) }));
      try { await post(`/sources/${key}`); say('Noted. Connectors land here once built.'); } catch (e) { fail(e, 'Could not update'); }
    },
    async saveGoal(patch: Partial<Goal> & { id?: string; title?: string; due_on?: string | null }) {
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
    async sendAction(id, overrides, opts) {
      try {
        const r = await post<{ ok: boolean; home: HomeData; execution: { error?: string | null } }>(`/actions/${id}/send`, overrides ?? {});
        setHome(r.home);
        say('Sent. Follow-up drafted for day 3.');
        if (!opts?.stay) closeSheet();
        return true;
      } catch (e) {
        fail(e, 'Send failed');
        void refresh();
        return false;
      }
    },
    async answerMove(id, status) {
      try {
        const r = await post<{ home: HomeData }>(`/moves/${id}`, { status });
        setHome(r.home);
        say(status === 'done' ? 'Done. Recorded.' : 'Not this one. Recorded.');
        return true;
      } catch (e) { fail(e, 'Could not record'); void refresh(); return false; }
    },
    async handOverMove(id) {
      try {
        const r = await post<{ home: HomeData }>(`/moves/${id}`, { status: 'handover' });
        setHome(r.home);
        // Says what will actually happen next, not that a row was written. The
        // worker picks it up on the nightly pass, and somebody who taps this and
        // sees "Done" will come back in ten minutes looking for a result. Names
        // no tab: both layouts use this, and they report it in different places.
        say('Handed over. It starts tonight and reports back here as it goes.');
        return { ok: true };
      } catch (e) {
        void refresh();
        return { ok: false, error: e instanceof Error ? e.message : 'Could not hand that over' };
      }
    },
    async addWatchSource(input) {
      try {
        const r = await post<{ home: HomeData; note?: string | null }>('/watch/sources', input);
        setHome(r.home);
        // The note is what the normaliser DID — "added .rss", "turned the
        // channel into its video feed". Swallowing it means the saved URL and
        // the typed one silently differ, which is how somebody ends up
        // reporting a source that "does not work" against a URL they never saw.
        say(r.note ?? 'Watching it. Anything new gets read tonight.');
        return { ok: true, note: r.note ?? null };
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Could not add that';
        return { ok: false, error };
      }
    },
    async discoverSources() {
      try {
        const r = await post<{ found: Discovered[]; searched: string[]; checked?: number; note?: string | null }>('/watch/discover', {});
        // No say() here. The results ARE the feedback, and a toast over a list
        // somebody is about to read is just something in the way.
        return { ok: true, found: r.found, searched: r.searched, checked: r.checked, note: r.note ?? null };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not search for sources' };
      }
    },
    async addDiscovered(d) {
      try {
        // Posted back to the discover route, not to /watch/sources: that one
        // re-normalises, and d.url is already the feed that parsed. Running it
        // through the normaliser again would rewrite a verified URL.
        const r = await post<{ home: HomeData }>('/watch/discover', { url: d.url, label: d.label, intent: d.intent });
        setHome(r.home);
        say(`Watching ${d.label}. It gets read tonight.`);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not add that source' };
      }
    },
    async saveWorking(input) {
      try {
        const r = await post<{ home: HomeData }>('/working', input);
        setHome(r.home);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not save that' };
      }
    },
    async settleWorking(id, status) {
      try {
        const r = await post<{ home: HomeData }>('/working', { id, status });
        setHome(r.home);
        // Only on a yes. Saying "noted" when somebody declines something is the
        // app thanking them for disagreeing with it.
        if (status === 'live') say('Noted. It goes into everything from now on.');
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not do that' };
      }
    },
    async removeWorking(id) {
      try {
        const r = await del<{ home: HomeData }>(`/working?id=${encodeURIComponent(id)}`);
        setHome(r.home);
      } catch (e) { fail(e, 'Could not remove that'); }
    },
    async createCommission(input) {
      try {
        const r = await post<{ home: HomeData; commission?: { id: string } | null }>('/commissions', input);
        setHome(r.home);
        // Says what happens next, because what happens next is nothing until
        // they approve it — and a commission that silently sits in draft looks
        // exactly like one the app ignored.
        say('Written. Read it and approve it to start.');
        // The id, so a caller can open the draft it just wrote straight onto its approve button.
        return { ok: true, id: r.commission?.id };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not hand that over' };
      }
    },
    async commissionAction(id, action, worth, answer) {
      try {
        const r = await post<{ home?: HomeData; note?: string | null; started?: boolean }>(`/commissions/${encodeURIComponent(id)}`, { action, answer, ...(worth ?? {}) });
        // 'seen' deliberately returns no home: rewriting the screen under
        // somebody who just opened the sheet moves the card out from under them.
        if (r.home) setHome(r.home);
        if (action === 'approve') say(r.started ? 'Approved. It is starting now.' : 'Approved. It runs tonight.');
        // Two different things happened, and which one decides whether the
        // worker stops asking. Saying "carrying on" for both would hide it.
        if (action === 'unblock') {
          say(answer?.trim()
            ? (r.started ? 'Sent. It carries on with your answer now.' : 'Sent. It gets your answer on the next run.')
            : 'Carrying on. It picks up tonight.');
        }
        // The toast reports whether the verdict LANDED, not merely that the
        // mandate closed. A worth answer that did not reach the ledger changes
        // nothing about what gets suggested next, and saying "noted" either way
        // is how a broken feature looks like a working one.
        if (action === 'stop' || action === 'done') {
          say(r.note ? 'Closed, but the verdict did not save.' : worth ? 'Closed, and noted.' : 'Closed.');
        }
        return { ok: true, note: r.note ?? null };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not update that' };
      }
    },
    async runCommissionsNow() {
      try {
        const r = await post<{ home: HomeData; asked: number; handed: number; skipped: string | null; error: string | null }>('/commissions/run', {});
        setHome(r.home);
        // Error first. "Handed over" used to be said even when the dispatch threw
        // and was swallowed, so a mistyped webhook URL read exactly like a worker
        // taking its time — and the only way to tell was the server log.
        say(r.error
          ? r.error
          : r.asked > 0
            ? `${r.asked} thing${r.asked === 1 ? '' : 's'} came back needing you.`
            : r.skipped
              ? r.skipped
              : 'Handed over. Nothing back yet — the worker reports when it is done.');
        return { ok: !r.error, asked: r.asked, error: r.error ?? undefined };
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Could not run it';
        say(error);
        return { ok: false, error };
      }
    },
    async deleteAccount(confirm) {
      try {
        await del('/account', { body: JSON.stringify({ confirm }) });
        // Straight to the front door. Re-rendering the app against a profile
        // that no longer exists would 401 every request and read as a crash at
        // the exact moment somebody needs to see that it worked.
        window.location.href = shell;
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not delete the account' };
      }
    },
    async readSourcesNow() {
      try {
        const r = await post<{ home: HomeData; found: number }>('/watch/run', {});
        setHome(r.home);
        say(r.found > 0
          ? `${r.found} worth keeping, waiting for you to judge.`
          : 'Read. Nothing in them worth your morning — tap again for the next two.');
        return { ok: true, found: r.found };
      } catch (e) { fail(e, 'Could not read your sources'); return { ok: false }; }
    },
    markOpened(actionId) {
      // sendBeacon, not fetch: this fires as the tab goes to the background to
      // hand off to WhatsApp, and a normal request is cancelled at exactly that
      // moment — which is how the tap went unrecorded in the first place.
      const url = `/api/copilot/actions/${encodeURIComponent(actionId)}/opened`;
      try {
        if (navigator.sendBeacon?.(url, new Blob([], { type: 'application/json' }))) return;
      } catch { /* fall through */ }
      // keepalive is the same guarantee for browsers without sendBeacon.
      void fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
    },
    async confirmOpened(ids, sent) {
      try {
        // One request per draft, but one GESTURE — which is the whole point.
        // The alternative was leaving the app and coming back N times.
        for (const id of ids) {
          if (sent) await post(`/actions/${id}/sent`, {});
          else await del(`/actions/${id}/opened`).catch(() => {});
        }
        await refresh();
        say(sent
          ? `Logged. ${ids.length === 1 ? 'That one counts' : `All ${ids.length} count`} now.`
          : 'Left them in the queue.');
      } catch (e) { fail(e, 'Could not record that'); void refresh(); }
    },
    async saveObligation(patch) {
      try {
        const r = await post<{ home: HomeData }>('/obligations', patch);
        setHome(r.home);
        say(patch.status === 'settled' ? 'Settled. The forecast just moved.' : 'Saved.');
        return true;
      } catch (e) { fail(e, 'Could not save that'); return false; }
    },
    async removeObligation(id) {
      try {
        const r = await del<{ home: HomeData }>(`/obligations?id=${encodeURIComponent(id)}`);
        setHome(r.home);
        say('Removed.');
      } catch (e) { fail(e, 'Could not remove'); void refresh(); }
    },
    async removeWatchSource(id) {
      try {
        const r = await del<{ home: HomeData }>(`/watch/sources?id=${encodeURIComponent(id)}`);
        setHome(r.home);
        say('Removed.');
      } catch (e) { fail(e, 'Could not remove'); void refresh(); }
    },
    async setWatchSourceStatus(id, status) {
      try {
        const r = await post<{ home: HomeData }>('/watch/sources', { id, status });
        setHome(r.home);
        say(status === 'paused' ? 'Paused. It stays on the list.' : 'Back on. It gets read tonight.');
      } catch (e) { fail(e, 'Could not update'); void refresh(); }
    },
    async triage(id, action) {
      try {
        const r = await post<{ home: HomeData }>(`/triage/${id}`, { action });
        setHome(r.home);
        // "Yes" on a feed card keeps it — the route marks its Move done and
        // writes nothing — so the toast is read off the queue the route returned
        // rather than assumed. It said "Drafted" for both, and a kept gig post
        // sent people to a queue with no draft in it.
        if (action === 'draft') {
          const drafted = r.home.queue.some((q) => q.opportunity_id === id || q.opp?.id === id);
          say(drafted ? 'Drafted. It is in the send queue.' : 'Kept.');
        }
        return true;
      } catch (e) { fail(e, 'Could not record'); void refresh(); return false; }
    },
    async markSent(id, overrides, opts) {
      try {
        const r = await post<{ home: HomeData }>(`/actions/${id}/sent`, overrides ?? {});
        setHome(r.home);
        say('Logged as sent. Follow-up drafted for day 3.');
        if (!opts?.stay) closeSheet();
        return true;
      } catch (e) { fail(e, 'Could not record'); void refresh(); return false; }
    },
    async saveOffer(offer: Offer, opts) {
      try {
        const r = await post<{ home: HomeData; rewritten?: number }>('/offer', { ...offer, bet: opts?.bet ?? undefined });
        setHome(r.home); closeSheet();
        say(r.rewritten ? `Saved. ${r.rewritten} waiting draft${r.rewritten === 1 ? '' : 's'} rewritten in your words.` : 'Saved. Drafts will use your words now.');
        return true;
      }
      catch (e) { fail(e, 'Could not save'); return false; }
    },
    async cancelDraft(id) {
      try { await api(`/actions/${id}/send`, { method: 'DELETE' }); await refresh(); closeSheet(); say('Draft cancelled'); } catch (e) { fail(e, 'Could not cancel'); }
    },
    async recordOutcome(input: OutcomeInput, opts) {
      try {
        const r = await post<{ home: HomeData }>('/outcomes', input);
        setHome(r.home);
        if (!opts?.stay) closeSheet();
        say(input.kind === 'won' ? 'Logged. Goal updated.' : input.kind === 'reply' ? 'Reply logged. Ranking learns from this.' : 'Logged.');
        return true;
      } catch (e) { fail(e, 'Could not record'); return false; }
    },
    async draftFor(oppId, channel?: Channel) {
      try {
        const r = await post<{ home: HomeData; actionId: string; execution: unknown | null; existing?: boolean }>(`/opportunities/${oppId}/draft`, { channel });
        setHome(r.home);
        if (cfg.afterDraft) setTabState(cfg.afterDraft);
        // The draft replaces whatever sheet asked for it; closing it should
        // land on the tab the shell names, not back on the business.
        setStack([{ kind: 'action', id: r.actionId }]);
        // Drafting twice opens the message already waiting rather than writing a second one.
        say(r.existing ? 'Already drafted — here it is.' : r.execution ? 'Drafted. Review and approve to send.' : 'Drafted. No contact on that channel, copy it manually.');
        return true;
      } catch (e) { fail(e, 'Could not draft'); return false; }
    },
    findMatches,
    async saveFinance(f) {
      try { const r = await post<{ home: HomeData }>('/finance', f); setHome(r.home); closeSheet(); say('Runway updated'); return true; } catch (e) { fail(e, 'Could not save'); return false; }
    },
    async openBilling() {
      try {
        const r = await post<{ url: string }>('/billing/portal', { shell });
        window.location.href = r.url;
      } catch (e) { fail(e, 'Could not open billing'); }
    },
    async saveTargeting(t) {
      try {
        const r = await post<{ home: HomeData; dropped?: number; ignored?: string[] }>('/targeting', t);
        setHome(r.home);
        // What the save refused is said, not swallowed: a segment that silently
        // failed to save reads as one that is being searched.
        const left = r.ignored?.length ? ` Left out ${r.ignored.map((x) => `"${x}"`).join(', ')} — one letter is not something to search for.` : '';
        say(r.dropped
          ? `Targeting saved. ${r.dropped} ${r.dropped === 1 ? 'business' : 'businesses'} from dropped segments set aside.${left}`
          : `Targeting saved.${left}`);
        return true;
      } catch (e) { fail(e, 'Could not save'); return false; }
    },
    async dropSegment(segment) {
      const key = segment.trim().toLowerCase();
      const target_segments = home.profile.target_segments.filter((s) => s.trim().toLowerCase() !== key);
      try {
        const r = await post<{ home: HomeData; dropped?: number }>('/targeting', { target_segments, target_area: home.profile.target_area ?? home.profile.location ?? '' });
        setHome(r.home);
        closeSheet();
        say(r.dropped ? `Stopped matching ${segment}. ${r.dropped} ${r.dropped === 1 ? 'business' : 'businesses'} and their drafts set aside.` : `Stopped matching ${segment}.`);
        return true;
      } catch (e) { fail(e, 'Could not update targeting'); return false; }
    },
    async answerCall(response, permanent) {
      try {
        const r = await post<{ home: HomeData; stoodDown?: string; note?: string | null }>('/decision', { response, permanent });
        setHome(r.home);
        say(r.note
          ? r.note
          : r.stoodDown
          ? 'Noted for good. It is in your working file under what you will not do — remove it there to undo.'
          : 'Recorded');
        return true;
      } catch (e) { fail(e, 'Could not record that'); return false; }
    },
    async clearQueue() {
      try {
        const r = await post<{ home: HomeData; cancelled: number }>('/queue', { action: 'clear' });
        setHome(r.home);
        say(`${r.cancelled} draft${r.cancelled === 1 ? '' : 's'} cleared. They are recorded as written and not sent.`);
        return { ok: true, cancelled: r.cancelled };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not clear the queue' };
      }
    },
    async askRows() {
      try {
        const r = await get<{ answers: AskAnswer[] }>('/ask');
        return { ok: true, answers: r.answers };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not count that' };
      }
    },
    async handoff() {
      try {
        const r = await get<{ text: string; chars: number }>('/handoff');
        return { ok: true, text: r.text, chars: r.chars };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not gather your context' };
      }
    },
    async connections() {
      try {
        const r = await get<{ url: string; connections: Connection[]; unreadable?: string | null }>('/connections');
        return { ok: true, url: r.url, connections: r.connections, unreadable: r.unreadable ?? null };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not read your connections' };
      }
    },
    async disconnect(grant) {
      try {
        const r = await post<{ connections: Connection[] }>('/connections', { action: 'revoke', grant });
        return { ok: true, connections: r.connections };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not disconnect that' };
      }
    },
    async pairCode() {
      try {
        const r = await post<{ code: string; expiresAt: string }>('/connections', { action: 'code' });
        return { ok: true, code: r.code, expiresAt: r.expiresAt };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not make a code' };
      }
    },
    async requestLoginLink(email) {
      try { await post('/auth/magic-link', { email, shell }); return { ok: true }; } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Could not send' }; }
    },
    async setPush(enabled) {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('This browser does not support push');
        // `ready` never settles without a registration: say why rather than wait forever.
        if (swError.current) throw new Error(`Notifications need the app's service worker, which did not start: ${swError.current}`);
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

    // — the four-tab shell —
    async draftFromMatch(oppId) {
      try {
        const r = await post<{ home: HomeData }>(`/triage/${oppId}`, { action: 'draft' });
        setHome(r.home);
        // Straight to the message. A match you chose to contact and a draft you
        // then have to go and find in a queue of fifty are two decisions, and
        // the second is where drafts go to wait — 61 of 70 in the live account.
        const q = r.home.queue.find((x) => x.opportunity_id === oppId || x.opp?.id === oppId);
        if (q) setStack([{ kind: 'action', id: q.id }]);
        say(q ? 'Drafted. Read it, then send it from your own app.' : 'Drafted. It is in the send queue.');
        return true;
      } catch (e) { fail(e, 'Could not draft'); void refresh(); return false; }
    },
    async logFocus(input) {
      try {
        const r = await post<{ home: HomeData }>('/focus', input);
        setHome(r.home);
        say('Logged.');
        return true;
      } catch (e) { fail(e, 'Could not log that'); return false; }
    },
    async lab(input) {
      try {
        const r = await post<{ home: HomeData }>('/lab', input);
        setHome(r.home);
        say(LAB_SAID[input.action]);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not save that' };
      }
    },
    async assets(input) {
      try {
        const r = await post<{ home: HomeData; id?: string; rewritten?: number }>('/assets', input);
        setHome(r.home);
        // An offer made theirs rewrites the drafts waiting to be sent; said, so the queue changing is not a surprise.
        say(r.rewritten ? `${ASSET_SAID[input.action]} ${r.rewritten} waiting draft${r.rewritten === 1 ? '' : 's'} rewritten from it.` : ASSET_SAID[input.action]);
        return { ok: true, id: r.id, rewritten: r.rewritten };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not save that' };
      }
    },
    async removeFocus(id) {
      try {
        const r = await del<{ home: HomeData }>(`/focus?id=${encodeURIComponent(id)}`);
        setHome(r.home);
      } catch (e) { fail(e, 'Could not remove that'); void refresh(); }
    },
    async uploadStatement(file) {
      try {
        const { status, body } = await upload<{ ok?: boolean; import?: MoneyImport; home?: HomeData }>('/money/import', file);
        // A file that was not a statement still comes back with the screen, its failure on the row.
        if (body.home) setHome(body.home);
        if (status >= 400 || body.ok === false || !body.import) {
          const error = body.error || `Could not upload that (${status})`;
          say(error);
          return { ok: false, error };
        }
        const i = body.import;
        say(i.status === 'reading'
          ? `Reading ${i.fileName ?? 'it'}. A PDF or a screenshot takes a minute; you can leave this screen.`
          : importLine(i) ?? 'Read.');
        return { ok: true, status: i.status };
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Could not upload that';
        say(error);
        return { ok: false, error };
      }
    },
    async answerMoney(answer) {
      try {
        const r = await post<{ home: HomeData; recorded?: number; attached?: number }>('/money', answer);
        setHome(r.home);
        if (answer.action === 'name') {
          const won = (r.recorded ?? 0) + (r.attached ?? 0);
          say(answer.role === 'client' && won
            ? `Named. ${won === 1 ? 'Their latest payment counts' : `${won} of their payments count`} as ${won === 1 ? 'a win' : 'wins'} now.`
            : answer.role === 'self' ? 'Noted. Money moving between your own accounts is not income or spending any more.'
            : 'Noted.');
        } else if (answer.action === 'confirm') say('Confirmed. Those rows count now.');
        else if (answer.action === 'discard') say('Removed, with the rows it brought in.');
        else if (answer.action === 'currency') say(`Counted in ${answer.currency.toUpperCase()}.`);
        else say('Deleted. Nothing read off your bank is kept.');
        return { ok: true };
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Could not save that';
        say(error);
        return { ok: false, error };
      }
    },
  };

  return {
    home, setHome, tab, setTab, actions,
    sheet, sheetOpen, dismissSheets,
    briefing, finding, toast, mainRef, say, refresh,
    arrival, clearArrival,
  };
}
