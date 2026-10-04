'use client';
// Work: the business, as a chain of bets — and everything else hangs off it.
//
//   What you sell        the offer in the owner's words, and the verdict: proven
//                        or not, the bar and the count against it, and the
//                        experiments run on it
//   How it makes money   who buys → how they hear → how they say yes → what they
//                        pay → how you deliver. Each part is a bet with a state
//                        from the rows and the rule that gave it; the weak link
//                        opens with what would move it
//   In the works         one box to hand anything over, suggestions from the
//                        weak link, and the projects — a question answered on
//                        the card, a breakage retried on the card
//   Built                what the business has to work with, by whom: the gaps
//                        first, then what was made most recently
//   Agents               one line; the roster folds under it
//
// Why it was rebuilt, in its owner's words: Work was "stale", the path to money
// "generic", the team "too heavy for a status", and Build with Claude "could be
// input text for handover". The want was the tab that knows how the business
// makes money — the proven system and how everything is connected, the assets
// built by AI and by you, suggestions that pay, experiments — run by an app that
// suggests, works, and asks only when it must. lib/copilot/business.ts has the
// rules, and why they are the app's own thresholds and no new ones.
//
// What it is not. Four drafts of a better Work met one verdict before this:
// static sections competing for attention, content you could get elsewhere. So
// there is one spine, not five sections. The offer is the chain's subject, the
// working file's lines are its claims, the funnel's counts are its evidence, the
// agents sit on the part each one runs, and the projects and what they built are
// what moves it. And it moves: a part's verdict changes as rows land, and the
// tab says so the next time you look.
import { useEffect, useRef, useState } from 'react';
import {
  LINK_STATE_LABEL, changeLine, chainChanges, parseSeenChain, snapshotChain, suggestedAsks,
  type BuiltRow, type BusinessLink, type ChainChange, type LinkKey, type LinkMove, type SeenChain,
} from '@/lib/copilot/business';
import { AGENT_STATE_LABEL, type Agent } from '@/lib/copilot/machine';
import { ANGLE_LABEL, STATE_WORDS, latestMarks } from '@/lib/copilot/experiment';
import { MAX_ACTIVE_COMMISSIONS, OBJECTIVE_MAX, blockedOn, commissionChip, splitThreads } from '@/lib/copilot/commission';
import type { CommissionThread, HomeData } from '@/lib/copilot/types';
import { shortDay } from '../format';
import type { Actions } from '../shared';
import { MoveCard } from '../views/NowView';
import type { Derived } from './derive';
import { AgentGlyph, IconChevron, IconExternal } from './icons2';
import { MoveNote, MoveRow, agentIsFull, orChat, useBrief, useMove, type Brief } from './MoveKit';

export default function WorkTab({ home, d, actions, briefing }: { home: HomeData; d: Derived; actions: Actions; briefing: boolean }) {
  const seen = useSeen(home, d);
  const brief = useBrief(actions);
  const full = agentIsFull(home);
  return (
    <>
      <Product home={home} d={d} actions={actions} changes={seen.changes} />
      <Chain d={d} actions={actions} brief={brief} full={full} />
      <InTheWorks home={home} d={d} actions={actions} brief={brief} full={full} />
      <Built home={home} d={d} actions={actions} brief={brief} seenAt={seen.at} full={full} />
      <Agents agents={d.team} line={d.work.team} actions={actions} briefing={briefing} />
    </>
  );
}

/* ─── Since you last looked ───────────────────────────────────────────────── */

/**
 * What this device last saw: each part's verdict and when. Read once per visit,
 * so what moved stays said while you look; written back every time the chain
 * changes. In an effect, never during render — the server has no storage, and a
 * first paint that differed from its render would not hydrate. A convenience
 * about the screen: nothing is decided from it, so storage that keeps nothing
 * costs only the "moved" line.
 */
function useSeen(home: HomeData, d: Derived): { changes: ChainChange[]; at: string | null } {
  const key = `cp2.work.seen:${home.profile.id}`;
  const prior = useRef<SeenChain | null | undefined>(undefined);
  const [out, setOut] = useState<{ changes: ChainChange[]; at: string | null }>({ changes: [], at: null });
  const { links } = d.work.chain;
  const signature = links.map((l) => `${l.key}:${l.state}`).join(',');
  useEffect(() => {
    if (prior.current === undefined) {
      let raw: string | null = null;
      try { raw = window.localStorage.getItem(key); } catch { /* storage refused: no memory, said by nothing moving */ }
      try { prior.current = parseSeenChain(raw ? JSON.parse(raw) : null); } catch { prior.current = null; }
    }
    setOut({ changes: chainChanges(prior.current ?? null, links), at: prior.current?.at ?? null });
    try { window.localStorage.setItem(key, JSON.stringify(snapshotChain(home.generatedAt, links))); } catch { /* as above */ }
    // Keyed on the verdicts and on when the read was made: a refresh with the
    // same verdicts still moves "last looked" on, or the next visit would call
    // things new that were on screen this time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, key, home.generatedAt]);
  return out;
}

/* ─── What you sell, and whether it is proven ─────────────────────────────── */

function Product({ home, d, actions, changes }: { home: HomeData; d: Derived; actions: Actions; changes: ChainChange[] }) {
  const o = home.profile.offer ?? {};
  const v = d.work.chain.verdict;
  if (!o.sells?.trim()) {
    return (
      <div className="cp-card cp2-product">
        <div className="cp-eyebrow">What you sell</div>
        <h2 className="cp2-product-name">Not written down yet</h2>
        <p className="cp2-lede">Every part below is tested against this. With nothing here it writes nothing — a message from a blank offer is not yours.</p>
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
      <div className={`cp2-bz-verdict ${v.proven ? 'proven' : ''}`}>
        <span className="cp2-bz-verdict-t">{v.title}</span>
        <span className="cp2-bz-verdict-s">{v.line}</span>
      </div>
      {/* The tab moving, said: a part whose verdict changed since this device last looked. */}
      {changes.length > 0 && (
        <p className="cp2-bz-moved">
          Since you last looked: {changes.slice(0, 2).map(changeLine).join('; ')}{changes.length > 2 ? `; and ${changes.length - 2} more` : ''}.
        </p>
      )}
      <Experiments home={home} d={d} actions={actions} />
    </div>
  );
}

/**
 * The record of what was tried on this business: the plan's experiment being
 * tried or offered, every verdict it got, and what the person wrote they tried
 * before the app. One line folded; the Path is where an experiment is started
 * and graded, so this is the ledger, not a second copy of the card.
 */
function Experiments({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const [open, setOpen] = useState(false);
  const plan = d.path.plan;
  const running = plan.state === 'ready' ? plan.experiment : null;
  const ended = [...latestMarks(home.roadmap?.experiments ?? []).values()]
    .filter((m) => m.state !== 'started')
    .sort((a, b) => b.at.localeCompare(a.at));
  const tried = d.work.said.tried ?? [];
  const graded = ended.filter((m) => m.state === 'worked' || m.state === 'failed' || m.state === 'unclear');
  const worked = graded.filter((m) => m.state === 'worked').length;
  if (!running && !ended.length && !tried.length) return null;
  const parts = [
    running ? (running.stage === 'trying' ? '1 running' : '1 offered') : null,
    graded.length ? `${graded.length} tested, ${worked} worked` : null,
    tried.length ? `${tried.length} you tried before` : null,
  ].filter(Boolean).join(' · ');
  return (
    <div className="cp2-bz-tests">
      <button className="cp2-bz-tests-btn" aria-expanded={open} onClick={() => setOpen((x) => !x)}>
        <span className="cp2-row-main">
          <span className="t">Experiments</span>
          <span className="s">{parts}</span>
        </span>
        <IconChevron />
      </button>
      {open && (
        <div className="cp2-bz-tests-list">
          {running && (
            <button className="cp2-bz-test" onClick={() => actions.setTab('path')}>
              <i className="cp2-bz-test-chip live">{running.stage === 'trying' ? 'Trying' : 'Offered'}</i>
              <span className="cp2-bz-test-t">{running.exp.title}</span>
              <span className="cp2-bz-test-s">{running.stage === 'trying' ? `Check on ${shortDay(running.checkOn)} · on the Path` : 'Start it on the Path'}</span>
            </button>
          )}
          {ended.map((m) => (
            <div key={m.id} className="cp2-bz-test">
              <i className={`cp2-bz-test-chip ${m.state}`}>{STATE_WORDS[m.state][0].toUpperCase()}{STATE_WORDS[m.state].slice(1)}</i>
              <span className="cp2-bz-test-t">{m.title || m.id}</span>
              <span className="cp2-bz-test-s">{[m.angle ? ANGLE_LABEL[m.angle] : null, shortDay(m.at.slice(0, 10))].filter(Boolean).join(' · ')}</span>
            </div>
          ))}
          {tried.map((t, i) => (
            <div key={`tried-${i}`} className="cp2-bz-test">
              <i className="cp2-bz-test-chip you">You tried</i>
              <span className="cp2-bz-test-t">{t}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── How it makes money ──────────────────────────────────────────────────── */

const RUNNER_LABEL = { ai: 'AI', you: 'You', both: 'AI + you' } as const;

function Chain({ d, actions, brief, full }: { d: Derived; actions: Actions; brief: Brief; full: boolean }) {
  const { links, weak, verdict } = d.work.chain;
  // The weak link opens by itself; after a tap, the person decides what is open.
  const [picked, setPicked] = useState<LinkKey | null | undefined>(undefined);
  const open = picked === undefined ? weak : picked;
  const move = useMove(actions, brief);
  const weakLabel = weak ? links.find((l) => l.key === weak)?.label : null;
  return (
    <>
      <div className="cp-section">
        <span className="lead">How it makes money</span>
        <span className="count">{weakLabel ? `weak link: ${weakLabel.toLowerCase()}` : verdict.proven ? 'everything that sells works' : 'from your rows'}</span>
      </div>
      <ol className="cp-list cp2-bz-chain">
        {links.map((l, i) => (
          <li key={l.key} className={`cp2-bz-part ${l.state}${open === l.key ? ' open' : ''}`}>
            <button className="cp2-bz-part-btn" aria-expanded={open === l.key} onClick={() => setPicked(open === l.key ? null : l.key)}>
              <span className="cp2-bz-rail" aria-hidden><span className="cp2-bz-n">{i + 1}</span></span>
              <span className="cp2-bz-body">
                <span className="cp2-bz-top">
                  <span className="cp2-bz-name">{l.label}</span>
                  {/* The word travels with the dot — a colour alone is not a verdict. */}
                  <span className={`cp2-bz-state ${l.state}`}><i />{LINK_STATE_LABEL[l.state]}</span>
                </span>
                {l.what && <span className={`cp2-bz-what${open === l.key ? '' : ' cp2-clamp2'}`}>{l.what}</span>}
                {l.facts && <span className="cp2-bz-facts">{l.facts}</span>}
              </span>
            </button>
            {open === l.key && <Part link={l} weak={weak === l.key} move={move} full={full} />}
          </li>
        ))}
      </ol>
    </>
  );
}

function Part({ link: l, weak, move, full }: { link: BusinessLink; weak: boolean; move: ReturnType<typeof useMove>; full: boolean }) {
  return (
    <div className="cp2-bz-detail">
      {weak && <span className="cp2-bz-weak">The weak link</span>}
      <p className="cp2-bz-why">{l.why}</p>
      {l.more.map((m) => <p key={m} className="cp2-bz-more">{m}</p>)}
      {/* Who runs it, where an agent does some of it. A part that is yours alone needs no line saying so. */}
      {l.runner.by !== 'you' && (
        <span className="cp2-bz-runner">
          <span className={`cp2-owner ${l.runner.by}`}>{RUNNER_LABEL[l.runner.by]}</span>
          {l.runner.name}
        </span>
      )}
      {/* An agent that stopped is said on the part of the business it stopped. */}
      {l.runner.problem && <p className="cp2-bz-problem">{l.runner.problem}</p>}
      {l.moves.length > 0 && (
        <div className="cp2-bz-moves">
          {l.moves.map((raw) => {
            const m = orChat(raw, full);
            return (
              <div key={m.key}>
                <MoveRow m={m} rerouted={m.by !== raw.by} busy={move.busy === m.key} onRun={() => void move.run(m, l.why)} />
                {move.note?.key === m.key && <MoveNote note={move.note} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── In the works ────────────────────────────────────────────────────────── */

function InTheWorks({ home, d, actions, brief, full }: { home: HomeData; d: Derived; actions: Actions; brief: Brief; full: boolean }) {
  const jobs = splitThreads(home.commissions ?? []);
  const live = [...jobs.needsYou, ...jobs.running];
  // What the app offers to take on. The one on the call is on the Path already.
  const offers = home.moves.filter((m) => m.artifact?.kind === 'plan');
  return (
    <>
      <div className="cp-section">
        <span className="lead">In the works</span>
        {d.work.waiting > 0 && <span className="count">{d.work.waiting} waiting on you</span>}
      </div>
      <Composer home={home} d={d} actions={actions} brief={brief} full={full} />
      {live.length > 0 && (
        <div className="cp2-projects">
          {live.map((t) => <Project key={t.commission.id} thread={t} actions={actions} />)}
        </div>
      )}
      {offers.map((m) => (
        <div key={m.id} className="cp2-offer">
          <div className="cp2-offer-label">It offers to take this on</div>
          <MoveCard move={m} actions={actions} />
        </div>
      ))}
      {!live.length && !offers.length && (
        <p className="cp2-bz-quiet">
          Nothing handed over. It researches, compares and drafts while you do something else, reports every step here, and never contacts anyone or spends anything.
        </p>
      )}
    </>
  );
}

/**
 * Build with Claude, turned into the way in: one box for anything you would
 * otherwise do yourself. Handed over, it is a project your agent runs once you
 * approve it; copied, it is the first line of everything the app knows, for a
 * chat. The chips are the chain's own suggestions, the weak link's first, and a
 * tap fills the box rather than sending — it is still yours to edit.
 */
function Composer({ home, d, actions, brief, full }: { home: HomeData; d: Derived; actions: Actions; brief: Brief; full: boolean }) {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<LinkMove | null>(null);
  const [busy, setBusy] = useState<'hand' | 'copy' | null>(null);
  const [note, setNote] = useState<{ text: string; bad: boolean; claude: boolean } | null>(null);
  const asks = suggestedAsks(d.work.chain);
  const why = picked ? d.work.chain.links.find((l) => l.moves.some((m) => m.key === picked.key))?.why : undefined;

  const handOver = async () => {
    const objective = text.trim();
    if (!objective) return;
    // Said before the tap rather than cut by the server: a project's objective
    // has a limit and a chat does not.
    if (objective.length > OBJECTIVE_MAX) return setNote({ text: `A project's brief is ${OBJECTIVE_MAX} characters at most — shorten it, or copy it for Claude.`, bad: true, claude: false });
    setBusy('hand'); setNote(null);
    const r = await actions.createCommission({ objective, why: why?.slice(0, 300), authority: 'read' });
    setBusy(null);
    if (!r.ok) return setNote({ text: r.error ?? 'Could not hand that over', bad: true, claude: false });
    setText(''); setPicked(null);
    if (r.id) actions.openSheet({ kind: 'commission', id: r.id });
  };
  const copy = async () => {
    setBusy('copy'); setNote(null);
    const r = await brief.copy(text.trim() || null);
    setBusy(null);
    setNote({ text: r.note, bad: false, claude: r.ok });
  };

  return (
    <div className="cp-card cp2-bz-compose">
      <textarea
        // Grows with what is in it, so a suggestion is read whole before it is handed over.
        className="cp-input sm" rows={text ? Math.min(6, Math.max(3, Math.ceil(text.length / 34))) : 2} value={text}
        aria-label="What should it build, find or work out?"
        placeholder="What should it build, find or work out?"
        onChange={(e) => { setText(e.target.value); setNote(null); if (picked && e.target.value !== picked.ask) setPicked(null); }}
      />
      {asks.length > 0 && (
        <div className="cp-chips">
          {asks.map((m) => (
            <button key={m.key} className={`cp-fchip ${picked?.key === m.key ? 'active' : ''}`}
              onClick={() => { setText(m.ask ?? m.label); setPicked(m); setNote(null); }}>{m.label}</button>
          ))}
        </div>
      )}
      <div className="cp-btn-row">
        <button className={`cp-btn ${home.workerConnected ? 'primary' : ''}`} disabled={!text.trim() || busy !== null || full} onClick={() => void handOver()}>
          {busy === 'hand' ? 'Writing it…' : 'Hand it over'}
        </button>
        <button className={`cp-btn ${home.workerConnected ? '' : 'primary'}`} disabled={busy !== null} onClick={() => void copy()}>
          {busy === 'copy' ? 'Gathering…' : 'Copy for Claude'}
        </button>
      </div>
      {note && <MoveNote note={note} />}
      {/* Said before the tap, not after it: three projects is the cap the server keeps. */}
      {full && !note && <p className="cp-help">{MAX_ACTIVE_COMMISSIONS} projects are on the go. Finish or stop one to hand over another.</p>}
      {!home.workerConnected && !full && !note && (
        <p className="cp-help">No worker is connected to this server, so a project you hand over is written down but nothing picks it up. Copy it for Claude instead, or set <code>COPILOT_JOBS_URL</code>.</p>
      )}
    </div>
  );
}

/**
 * One project, small enough that three fit on a screen. The card used to be one
 * big button, which meant a question could only be answered by opening the
 * project, scrolling past its plan and typing there — so the commonest thing a
 * project wants, an answer, cost the most taps. Now the question has a box on
 * the card, and a breakage its retry; everything else is one tap into the sheet.
 */
function Project({ thread, actions }: { thread: CommissionThread; actions: Actions }) {
  const c = thread.commission;
  const r = thread.report;
  const chip = commissionChip(c, r);
  const waiting = blockedOn(c, r);
  const ask = waiting === 'you' ? r.yours[0] ?? null : null;
  const fault = waiting === 'worker' ? r.stopped[0] ?? null : null;
  const last = r.did[0] ?? null;
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = () => actions.openSheet({ kind: 'commission', id: c.id });

  const send = async () => {
    if (!answer.trim()) return;
    setBusy(true); setError(null);
    const res = await actions.commissionAction(c.id, 'unblock', undefined, answer.trim());
    setBusy(false);
    if (!res.ok) return setError(res.error ?? 'Could not send that');
    setAnswer('');
  };
  // Unblock, then hand it straight back — the sheet's retry, on the card. A
  // stopped job is not due, so running alone would report nothing to do.
  const retry = async () => {
    setBusy(true); setError(null);
    const res = await actions.commissionAction(c.id, 'unblock');
    if (!res.ok) { setBusy(false); return setError(res.error ?? 'Could not restart it'); }
    const run = await actions.runCommissionsNow();
    setBusy(false);
    if (!run.ok) setError(run.error ?? 'Restarted, but it could not be handed over just now');
  };

  return (
    <div className={`cp2-bz-job ${chip.tone}`}>
      <button className="cp2-bz-job-head" onClick={open}>
        <span className="cp2-bz-job-top">
          <span className={`cp2-bz-chip ${chip.tone}`}>{c.status === 'draft' ? 'Waiting for your OK' : chip.label}</span>
          {r.progress.total > 0 && c.status !== 'draft' && <span className="cp2-bz-job-n">{r.progress.done} of {r.progress.total} done</span>}
          {r.fresh > 0 && <span className="cp2-bz-job-new">{r.fresh} new</span>}
        </span>
        <span className="cp2-bz-job-ob">{c.objective}</span>
        {/* What it got done last — one line, enough to tell whether it is worth keeping. */}
        {!fault && !ask && last && <span className="cp2-bz-job-did">{last.summary}</span>}
        {c.status === 'active' && !last && <span className="cp2-bz-job-did quiet">Nothing back yet.</span>}
      </button>
      {ask && (
        <div className="cp2-bz-ask">
          <p className="cp2-bz-ask-q">{ask.summary}</p>
          <div className="cp2-bz-ask-row">
            <input
              className="cp-input sm" value={answer} maxLength={300} placeholder="Your answer" aria-label={`Answer: ${ask.summary}`}
              onChange={(e) => { setAnswer(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
            />
            <button className="cp-btn primary sm" disabled={busy || !answer.trim()} onClick={() => void send()}>{busy ? 'Sending' : 'Send'}</button>
          </div>
        </div>
      )}
      {/* A breakage, said once and plainly, with the one useful thing: another go. Nobody can answer a 500. */}
      {fault && (
        <div className="cp2-bz-fault">
          <p>{fault.summary}</p>
          <button className="cp-btn sm" disabled={busy} onClick={() => void retry()}>{busy ? 'Trying again…' : 'Try again'}</button>
        </div>
      )}
      {c.status === 'draft' && <button className="cp2-bz-job-go" onClick={open}>Read it and approve →</button>}
      {error && <p className="cp-help cp2-err">{error}</p>}
    </div>
  );
}

/* ─── Built ───────────────────────────────────────────────────────────────── */

const SHOW_BUILT = 5;

function Built({ home, d, actions, brief, seenAt, full }: { home: HomeData; d: Derived; actions: Actions; brief: Brief; seenAt: string | null; full: boolean }) {
  const [all, setAll] = useState(false);
  const move = useMove(actions, brief);
  const rows = d.work.built;
  const shown = all ? rows : rows.slice(0, SHOW_BUILT);
  const byAi = rows.filter((r) => !r.gap && r.by !== 'you').length;
  const byYou = rows.filter((r) => !r.gap && r.by !== 'ai').length;
  const closed = home.commissions.some((t) => t.commission.status === 'done' || t.commission.status === 'stopped');
  const go = (r: BuiltRow) => {
    const o = r.open;
    if ('sheet' in o) actions.openSheet({ kind: o.sheet });
    else if ('commission' in o) actions.openSheet({ kind: 'commission', id: o.commission });
    else if ('tab' in o) actions.setTab(o.tab);
  };
  return (
    <>
      <div className="cp-section">
        <span className="lead">Built</span>
        <span className="count">{[byAi ? `${byAi} with AI` : null, byYou ? `${byYou} by you` : null].filter(Boolean).join(' · ')}</span>
      </div>
      <div className="cp-list cp2-rows cp2-bz-built">
        {shown.map((r) => {
          const fresh = !!seenAt && !!r.at && r.at > seenAt;
          const main = (
            <span className="cp2-row-main">
              <span className="t cp2-clamp2">{r.title}{fresh && <i className="cp2-bz-new">New</i>}</span>
              <span className="s cp2-clamp2">{r.line}</span>
            </span>
          );
          const who = <span className={`cp2-owner ${r.by}`}>{r.by === 'you' ? 'You' : r.by === 'both' ? 'You + AI' : r.byName}</span>;
          if (r.gap) {
            const m = r.move ? orChat(r.move, full) : null;
            return (
              <div key={r.key} className="cp2-row cp2-bz-gap">
                <button className="cp2-bz-gap-main" onClick={() => go(r)}>{main}</button>
                {m
                  ? <button className="cp-connect" disabled={move.busy === m.key} onClick={() => void move.run(m, 'Proof is what a price is believed on.')}>{move.busy === m.key ? '…' : m.by === 'claude' ? 'Ask Claude' : 'Have it drafted'}</button>
                  : <button className="cp-connect blue" onClick={() => go(r)}>Add it</button>}
              </div>
            );
          }
          if ('href' in r.open) {
            return <a key={r.key} className="cp2-row" href={r.open.href} target="_blank" rel="noreferrer">{main}{who}<IconExternal /></a>;
          }
          return <button key={r.key} className="cp2-row" onClick={() => go(r)}>{main}{who}</button>;
        })}
      </div>
      {move.note && <div className="cp2-bz-built-note"><MoveNote note={move.note} /></div>}
      {rows.length > SHOW_BUILT && (
        <button className="cp2-more" onClick={() => setAll((x) => !x)}>{all ? 'Show fewer' : `Show ${rows.length - SHOW_BUILT} more`}</button>
      )}
      {/* A read that failed is not "nothing was built" (invariant 13). */}
      {home.built?.unreadable && closed && <div className="cp-note">Could not read what the projects produced, so the counts beside them may be short: {home.built.unreadable}</div>}
    </>
  );
}

/* ─── Agents ──────────────────────────────────────────────────────────────── */

/**
 * The team, as one line. Each agent's work is already on the part of the
 * business it runs; what is left for a roster is whether each is well, and
 * that fits on a line — with every one that is not named on it. The rows fold
 * under it, the Planner's Run now among them.
 */
function Agents({ agents, line, actions, briefing }: { agents: Agent[]; line: { line: string; trouble: number }; actions: Actions; briefing: boolean }) {
  const [open, setOpen] = useState(false);
  const go = (a: Agent) => {
    if (a.key === 'scout') actions.openSheet({ kind: 'targeting' });
    else if (a.key === 'watcher') actions.openSheet({ kind: 'watchlist' });
    else if (a.key === 'writer') actions.openSheet(a.state === 'setup' ? { kind: 'offer' } : { kind: 'queue' });
    else if (a.key === 'researcher') actions.openSheet({ kind: 'handover' });
  };
  return (
    <>
      <div className="cp-section"><span className="lead">Agents</span></div>
      <div className="cp-list cp2-rows cp2-team">
        <button className="cp2-row cp2-bz-team" aria-expanded={open} onClick={() => setOpen((x) => !x)}>
          <span className="cp2-row-main">
            <span className={`s ${line.trouble ? 'cp2-bz-team-bad' : ''}`}>{line.line}</span>
          </span>
          <IconChevron />
        </button>
        {open && agents.map((a) => {
          const body = (
            <>
              <span className={`cp2-agent ${a.key}`}><AgentGlyph agent={a.key} /></span>
              <span className="cp2-row-main">
                <span className="cp2-agent-top">
                  <span className="t">{a.name}</span>
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
            <button key={a.key} className="cp2-row" onClick={() => go(a)}>{body}<IconChevron /></button>
          );
        })}
      </div>
    </>
  );
}
