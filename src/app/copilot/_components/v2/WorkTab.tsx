'use client';
// Work: the business being built, drawn as a machine you can see into.
//
//   What you sell        the product, in the owner's words
//   How it makes money   find → reach → convert → get paid, with who runs each
//                        part and the count at each step
//   Your team            the agents, and what each last actually did
//   Projects             work handed over — the part that runs like having staff
//   Build with Claude    everything it knows, as one brief, for the work a chat
//                        does better than a request handler
//
// An illustration, not a workflow builder — its owner asked for exactly that,
// "not another n8n". What makes it more than a picture is that nothing on it is
// drawn from a template: every count is the funnel's, every agent state is when
// it last ran, and a part of the machine that is not set up says so rather than
// looking busy. See lib/copilot/machine.ts.
//
// Handed-over work finally has a home. It was a block on Now, split by whether
// it needed you, which was right for Now and meant the thing that feels most
// like having a team never had a place where you could see the team's work.
import { useState } from 'react';
import { AGENT_STATE_LABEL, type Agent, type MachineStage } from '@/lib/copilot/machine';
import { SECTIONS } from '@/lib/copilot/working';
import { shortDay } from '../format';
import type { HomeData } from '@/lib/copilot/types';
import { splitThreads } from '@/lib/copilot/commission';
import type { Actions } from '../shared';
import { JobCard } from '../CommissionThread';
import { MoveCard } from '../views/NowView';
import type { Derived } from './derive';
import { AgentGlyph, IconChevron, IconExternal } from './icons2';

export default function WorkTab({ home, d, actions, briefing }: { home: HomeData; d: Derived; actions: Actions; briefing: boolean }) {
  return (
    <>
      <Product home={home} actions={actions} />
      <Machine stages={d.machine} actions={actions} />
      <Team agents={d.team} actions={actions} briefing={briefing} />
      <Projects home={home} actions={actions} />
      <BuildWithClaude actions={actions} />
    </>
  );
}

/* ─── What you sell ───────────────────────────────────────────────────────── */

function Product({ home, actions }: { home: HomeData; actions: Actions }) {
  const o = home.profile.offer ?? {};
  const w = home.workingProgress ?? { filled: 0, total: SECTIONS.length, proposals: 0 };
  if (!o.sells?.trim()) {
    return (
      <div className="cp-card cp2-product">
        <div className="cp-eyebrow">What you sell</div>
        <h2 className="cp2-product-name">Not written down yet</h2>
        <p className="cp2-lede">Everything it drafts, researches and proposes starts from this. With nothing here it writes nothing — a message from a blank offer is not yours.</p>
        <button className="cp-btn primary block cp-call-do" onClick={() => actions.openSheet({ kind: 'offer' })}>Write your offer — three minutes</button>
      </div>
    );
  }
  return (
    <div className="cp-card cp2-product">
      <div className="cp-call-top">
        <div className="cp-eyebrow">What you sell</div>
        <button className="cp2-link" onClick={() => actions.openSheet({ kind: 'offer' })}>Edit</button>
      </div>
      <h2 className="cp2-product-name">{o.sells}</h2>
      {o.problem && <p className="cp2-product-problem">&ldquo;{o.problem}&rdquo;</p>}
      <div className="cp2-facts">
        {o.for_who && <span><b>For</b> {o.for_who}</span>}
        <span><b>Price</b> {o.price_band || 'not set'}</span>
        <span><b>Proof</b> {o.proof_url ? <a href={o.proof_url} target="_blank" rel="noreferrer">link</a> : 'none yet'}</span>
      </div>
      {/* The offer's other half. Five strings are a headline; this is the
          business behind it, and the count says how much of it is known. */}
      <button className="cp2-knows" onClick={() => actions.openSheet({ kind: 'working' })}>
        <span className="cp2-row-main">
          <span className="t">What it knows about how you work</span>
          <span className="s">{w.filled} of {w.total} written{w.proposals ? ` · ${w.proposals} counted from your rows, waiting for your yes` : ''}</span>
        </span>
        <IconChevron />
      </button>
    </div>
  );
}

/* ─── How it makes money ──────────────────────────────────────────────────── */

const OWNER_LABEL = { ai: 'AI', you: 'You', both: 'AI + you' } as const;

function Machine({ stages, actions }: { stages: MachineStage[]; actions: Actions }) {
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

function Team({ agents, actions, briefing }: { agents: Agent[]; actions: Actions; briefing: boolean }) {
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

function Projects({ home, actions }: { home: HomeData; actions: Actions }) {
  const [showDone, setShowDone] = useState(false);
  const jobs = splitThreads(home.commissions ?? []);
  const live = [...jobs.needsYou, ...jobs.running];
  // What the app offers to take on. The one on the call is on Today already.
  const offers = home.moves.filter((m) => m.artifact?.kind === 'plan');
  return (
    <>
      <div className="cp-section">
        <span className="lead">Projects</span>
        <button className="cp-connect" onClick={() => actions.openSheet({ kind: 'handover' })}>Hand one over</button>
      </div>
      {!home.workerConnected && (
        <div className="cp-note">No worker is connected to this server, so a project you hand over is written down but nothing picks it up. Set <code>COPILOT_JOBS_URL</code>.</div>
      )}

      {live.length > 0 && (
        <div className="cp2-projects">
          {live.map((t) => <JobCard key={t.commission.id} thread={t} actions={actions} />)}
        </div>
      )}

      {offers.map((m) => (
        <div key={m.id} className="cp2-offer">
          <div className="cp2-offer-label">It offers to take this on</div>
          <MoveCard move={m} actions={actions} />
        </div>
      ))}

      {!live.length && !offers.length && (
        <div className="cp-empty">
          <b>Nothing handed over</b>
          Give it something you would otherwise do yourself — research, a comparison, a shortlist, a first draft. It works on it overnight with a plan you approve, reports every step here, and never contacts anyone or spends anything.
        </div>
      )}

      {jobs.finished.length > 0 && (
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

function BuildWithClaude({ actions }: { actions: Actions }) {
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
