'use client';
// The business behind the Path, on You: how it makes money, the team running
// parts of it, the projects it finished, and the brief for Claude.
//
// These were the Work tab. The Path took the parts that change every day — the
// call, what moved, what comes next, the projects under way — and what is left
// here is the machine itself, which you look at when you want to see how the
// whole thing is doing rather than what to do next. Every count is still the
// funnel's and every agent state is still when it last ran (lib/copilot/machine.ts):
// nothing moved here was redrawn.
import { useState } from 'react';
import { AGENT_STATE_LABEL, type Agent, type MachineStage } from '@/lib/copilot/machine';
import { shortDay } from '../format';
import type { HomeData } from '@/lib/copilot/types';
import { splitThreads } from '@/lib/copilot/commission';
import type { Actions } from '../shared';
import { AgentGlyph, IconChevron, IconExternal } from './icons2';

/* ─── How it makes money ──────────────────────────────────────────────────── */

const OWNER_LABEL = { ai: 'AI', you: 'You', both: 'AI + you' } as const;

export function Machine({ stages, actions }: { stages: MachineStage[]; actions: Actions }) {
  const open = (s: MachineStage) => {
    if (s.key === 'find') actions.openSheet({ kind: 'targeting' });
    else if (s.key === 'reach') actions.openSheet({ kind: 'stage', stage: 'to_send' });
    else if (s.key === 'convert') actions.openSheet({ kind: 'stage', stage: 'replied' });
    else actions.openSheet({ kind: 'stage', stage: 'won' });
  };
  return (
    <>
      <div className="cp-section"><span className="lead">How it makes money</span><span className="count">counted from your rows</span></div>
      <ol className="cp-list cp2-flow">
        {stages.map((s, i) => (
          <li key={s.key} className={`cp2-step ${s.weak ? 'weak' : ''}`}>
            <button className="cp2-step-btn" onClick={() => open(s)}>
              <span className="cp2-step-rail" aria-hidden><span className="cp2-step-n">{i + 1}</span></span>
              <span className="cp2-step-body">
                <span className="cp2-step-top">
                  <span className="cp2-step-name">{s.label}</span>
                  <span className="cp2-step-count">{s.countLabel}</span>
                </span>
                <span className="cp2-step-who">
                  <span className={`cp2-owner ${s.owner}`}>{OWNER_LABEL[s.owner]}</span>
                  {s.who !== 'You' && <span>{s.who}</span>}
                </span>
                <span className="cp2-step-detail">{s.detail}</span>
                {s.weak && <span className="cp2-step-weak">{s.weak}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

/* ─── Your team ───────────────────────────────────────────────────────────── */

export function Team({ agents, actions, briefing }: { agents: Agent[]; actions: Actions; briefing: boolean }) {
  const working = agents.filter((a) => a.state === 'working').length;
  const open = (a: Agent) => {
    if (a.key === 'scout') actions.openSheet({ kind: 'targeting' });
    else if (a.key === 'watcher') actions.openSheet({ kind: 'watchlist' });
    else if (a.key === 'writer') actions.openSheet(a.state === 'setup' ? { kind: 'offer' } : { kind: 'queue' });
    else if (a.key === 'researcher') actions.openSheet({ kind: 'handover' });
  };
  return (
    <>
      <div className="cp-section"><span className="lead">Your team</span><span className="count">{working} of {agents.length} working</span></div>
      <div className="cp-list cp2-rows cp2-team">
        {agents.map((a) => {
          const body = (
            <>
              <span className={`cp2-agent ${a.key}`}><AgentGlyph agent={a.key} /></span>
              <span className="cp2-row-main">
                <span className="cp2-agent-top">
                  <span className="t">{a.name}</span>
                  {/* The word travels with the dot — a colour alone is not a status. */}
                  <span className={`cp2-state ${a.state}`}><i />{AGENT_STATE_LABEL[a.state]}</span>
                </span>
                <span className="s">{a.role}</span>
                <span className="cp2-agent-line">{a.line}</span>
              </span>
            </>
          );
          // The Planner is the one agent a tap cannot configure — it runs on the
          // nightly schedule — so its row carries the one thing you can do: run it now.
          return a.key === 'planner' ? (
            <div key={a.key} className="cp2-row">
              {body}
              <button className="cp-connect ghost" disabled={briefing} onClick={() => void actions.runBrief('manual')}>{briefing ? 'Running' : 'Run now'}</button>
            </div>
          ) : (
            <button key={a.key} className="cp2-row" onClick={() => open(a)}>{body}<IconChevron /></button>
          );
        })}
      </div>
    </>
  );
}

/* ─── Projects ────────────────────────────────────────────────────────────── */

/**
 * What stays here of Projects: the way to hand something over, and what came
 * back from the ones that finished. The ones under way and the work it offers to
 * take on are on the Path, beside the call — one place each.
 */
export function Projects({ home, actions }: { home: HomeData; actions: Actions }) {
  const [showDone, setShowDone] = useState(false);
  const jobs = splitThreads(home.commissions ?? []);
  return (
    <>
      <div className="cp-section" id="cp2-projects">
        <span className="lead">Projects</span>
        <button className="cp-connect" onClick={() => actions.openSheet({ kind: 'handover' })}>Hand one over</button>
      </div>
      {!home.workerConnected && (
        <div className="cp-note">No worker is connected to this server, so a project you hand over is written down but nothing picks it up. Set <code>COPILOT_JOBS_URL</code>.</div>
      )}
      {jobs.finished.length > 0 ? (
        <>
          <button className="cp2-more" onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Hide finished' : `${jobs.finished.length} finished`}
          </button>
          {showDone && (
            <div className="cp-list cp2-rows">
              {jobs.finished.map((t) => (
                <button key={t.commission.id} className="cp2-row" onClick={() => actions.openSheet({ kind: 'commission', id: t.commission.id })}>
                  <span className="cp2-row-main">
                    <span className="t cp2-clamp2">{t.commission.objective}</span>
                    <span className="s cp2-clamp2">
                      {t.commission.status === 'done' ? 'Finished' : 'Called off'}
                      {t.commission.closed_at ? ` ${shortDay(t.commission.closed_at.slice(0, 10))}` : ''}
                      {/* The owner's verdict, which is the only part worth reading later. */}
                      {t.commission.outcome ? ` · ${t.commission.outcome}` : ' · no verdict recorded'}
                    </span>
                  </span>
                  <IconChevron />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="cp-note">Give it something you would otherwise do yourself — research, a comparison, a shortlist, a first draft. It works on it overnight with a plan you approve, reports every step on the Path, and never contacts anyone or spends anything.</p>
      )}
    </>
  );
}

/* ─── Build with Claude ───────────────────────────────────────────────────── */

/**
 * The work a chat does better than this app: writing, planning, designing.
 *
 * DIRECTION.md already decided this app does not compete with a model on
 * building — it exports what it knows. What was missing was the export being
 * somewhere you would think to use it. The brief is the handoff route's text,
 * unchanged: the working file with its two sources still distinct, the funnel,
 * every call and what came of it, what is stood down — and no contact details,
 * because the destination is a third party.
 *
 * The tasks only add a first line. None of them states a number; every number
 * the model sees comes from the brief under it.
 */
const TASKS = {
  onepager: { label: 'Sales one-pager', ask: 'Write a one-page sales sheet I can send to a prospect, in my own voice.' },
  onboarding: { label: 'Client onboarding', ask: 'Plan how I take a new client from the first yes to delivered, step by step.' },
  pricing: { label: 'Pricing check', ask: 'Tell me whether what I charge is the problem, from what has closed and what has not.' },
  automate: { label: 'Automate a step', ask: 'Find the step in how I work that costs me the most time, and design a simple automation for it.' },
} as const;
type TaskKey = keyof typeof TASKS;
const DEFAULT_ASK = 'Look at everything below and tell me the one thing to build or change next.';

export function BuildWithClaude({ actions }: { actions: Actions }) {
  const [task, setTask] = useState<TaskKey | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'copied' | 'ready' | 'error'>('idle');
  const [note, setNote] = useState<string | null>(null);

  const compose = (text: string) =>
    `${task ? TASKS[task].ask : DEFAULT_ASK}\n\nEverything my own app knows about my business is below. Use only what it says, and where it does not say, ask me rather than guess.\n\n${text}`;

  const copy = async (text: string) => {
    const body = compose(text);
    try {
      await navigator.clipboard.writeText(body);
      setState('copied');
      setNote(`${body.length.toLocaleString()} characters copied. Open Claude and paste it in.`);
    } catch {
      // Safari refuses a clipboard write that is not inside the tap, and the
      // first tap spent itself fetching. The brief is loaded now, so the next
      // tap is a clean gesture — say so instead of failing quietly.
      setState('ready');
      setNote('Your brief is ready. Tap Copy once more to put it on your clipboard.');
    }
  };

  const go = async () => {
    if (brief) return copy(brief);
    setState('loading'); setNote(null);
    const r = await actions.handoff();
    if (!r.ok || !r.text) { setState('error'); setNote(r.error ?? 'Could not gather what it knows'); return; }
    setBrief(r.text);
    await copy(r.text);
  };

  return (
    <>
      <div className="cp-section"><span className="lead">Build with Claude</span></div>
      <div className="cp-card cp2-claude">
        <p className="cp2-lede">
          Take the whole business into a chat: your offer, how you work, the funnel, every call it made and
          what came of it. One brief, pasted — so the answer is about your business, not a business.
        </p>
        <div className="cp-chips">
          {(Object.keys(TASKS) as TaskKey[]).map((k) => (
            <button key={k} className={`cp-fchip ${task === k ? 'active' : ''}`} onClick={() => setTask(task === k ? null : k)}>{TASKS[k].label}</button>
          ))}
        </div>
        <div className="cp-btn-row">
          <button className="cp-btn primary" disabled={state === 'loading'} onClick={() => void go()}>
            {state === 'loading' ? 'Gathering…' : state === 'ready' ? 'Copy' : state === 'copied' ? 'Copy again' : 'Copy the brief'}
          </button>
          <a className="cp-btn" href="https://claude.ai/new" target="_blank" rel="noreferrer">Open Claude <IconExternal /></a>
        </div>
        {note && <p className={`cp-help ${state === 'error' ? 'cp2-err' : ''}`}>{note}</p>}
      </div>
    </>
  );
}
