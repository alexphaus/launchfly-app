'use client';
import { useRef, useState } from 'react';
import { CAPACITY_META, type Capacity, type Goal, type GoalMetric, type HomeData } from '@/lib/copilot/types';
import { TYPE_LABEL } from './format';
import type { Actions, SheetState } from './shared';

export default function SheetContent({ sheet, home, actions }: { sheet: SheetState; home: HomeData; actions: Actions }) {
  switch (sheet.kind) {
    case 'capacity': return <CapacitySheet current={home.profile.capacity} onPick={actions.setCapacity} />;
    case 'action': return <ActionSheet home={home} id={sheet.id} actions={actions} />;
    case 'opp': return <OppSheet home={home} id={sheet.id} actions={actions} />;
    case 'lesson': return <LessonSheet home={home} id={sheet.id} actions={actions} />;
    case 'goal': return <GoalSheet goal={home.goals.find((g) => g.id === sheet.id)} actions={actions} />;
    case 'reset': return <ResetSheet actions={actions} />;
  }
}

function CapacitySheet({ current, onPick }: { current: Capacity; onPick: (c: Capacity) => void }) {
  return (
    <>
      <h3>Set your capacity</h3>
      <p className="desc">Matches and today&apos;s plan re-rank instantly to fit what you actually have right now.</p>
      {(Object.keys(CAPACITY_META) as Capacity[]).map((c) => (
        <button key={c} className={`cp-option ${current === c ? 'active' : ''}`} onClick={() => onPick(c)}>
          <div><div className="ct">{CAPACITY_META[c].label}</div><div className="cs">{CAPACITY_META[c].sub}</div></div>
        </button>
      ))}
    </>
  );
}

function ActionSheet({ home, id, actions }: { home: HomeData; id: string; actions: Actions }) {
  const found = home.plan.find((x) => x.id === id) ?? home.nudges.find((x) => x.id === id);
  const snap = useRef(found);
  if (found) snap.current = found;
  const a = snap.current;
  const [copied, setCopied] = useState(false);
  if (!a) return <p className="desc">Gone.</p>;
  const copy = async () => {
    try { await navigator.clipboard.writeText(a.ai_draft ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  return (
    <>
      <div className="meta">
        {a.kind === 'plan' && <span className={`cp-chip ${a.owner}`}>{a.owner === 'ai' ? 'AI drafted' : 'Needs you'}</span>}
        {a.kind === 'nudge' && <span className={`cp-chip ${a.urgency === 'urgent' ? 'done' : 'you'}`}>{a.due_label ?? a.urgency}</span>}
        {a.minutes ? <span className="cp-chip you">{a.minutes} min</span> : null}
      </div>
      <h3>{a.title}</h3>
      {a.detail && <p className="desc">{a.detail}</p>}
      {a.ai_draft && (
        <>
          <div className="cp-draft-label"><span>Draft, ready to review</span><button className="cp-textlink" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button></div>
          <div className="cp-draft">{a.ai_draft}</div>
        </>
      )}
      <div className="cp-btn-row">
        {a.status !== 'done' && <button className="cp-btn primary" onClick={() => actions.setActionStatus(a.id, 'done')}>Done</button>}
        {a.status === 'done' && <button className="cp-btn" onClick={() => actions.setActionStatus(a.id, 'open')}>Reopen</button>}
        <button className="cp-btn" onClick={() => actions.setActionStatus(a.id, 'dismissed')}>Skip</button>
      </div>
    </>
  );
}

function OppSheet({ home, id, actions }: { home: HomeData; id: string; actions: Actions }) {
  const found = home.opportunities.find((x) => x.id === id);
  const snap = useRef(found);
  if (found) snap.current = found;
  const o = snap.current;
  if (!o) return <p className="desc">Gone.</p>;
  return (
    <>
      <div className="meta">
        <span className={`cp-tag ${o.status === 'saved' ? 'saved' : ''}`}>{TYPE_LABEL[o.type]}</span>
        <span className="cp-score">{o.score}% match</span>
        <span className="cp-chip you">{o.effort} effort</span>
        {o.source && <span className="cp-chip you">{o.source}</span>}
      </div>
      <h3>{o.title}</h3>
      <p className="desc">{o.reason}</p>
      {o.value_label && <div className="cp-mvalue" style={{ marginBottom: 6 }}>{o.value_label}</div>}
      <p className="cp-help">Fit from the agent: {o.fit_score}. Final score blends your goals, capacity and what you saved or skipped.</p>
      {o.url && <a className="cp-btn dark block" style={{ marginTop: 12 }} href={o.url} target="_blank" rel="noreferrer">Open source</a>}
      <div className="cp-btn-row">
        {o.status === 'saved'
          ? <button className="cp-btn" onClick={() => actions.setOppStatus(o.id, 'new')}>Unsave</button>
          : <button className="cp-btn primary" onClick={() => actions.setOppStatus(o.id, 'saved')}>Save</button>}
        <button className="cp-btn" onClick={() => actions.setOppStatus(o.id, 'dismissed')}>Skip</button>
        <button className="cp-btn dark" onClick={() => actions.setOppStatus(o.id, 'acted')}>I acted</button>
      </div>
    </>
  );
}

function LessonSheet({ home, id, actions }: { home: HomeData; id: string; actions: Actions }) {
  const l = home.lessons.find((x) => x.id === id);
  const [busy, setBusy] = useState(false);
  if (!l) return <p className="desc">Gone.</p>;
  const done = async () => {
    setBusy(true);
    await actions.addNote(`Completed lesson: ${l.title}`, false);
    actions.closeSheet();
  };
  return (
    <>
      <div className="meta">{l.minutes ? <span className="cp-chip you">{l.minutes} min</span> : null}<span className="cp-chip ai">Worth learning</span></div>
      <h3>{l.title}</h3>
      {l.note && <p className="desc">{l.note}</p>}
      {l.url && <a className="cp-btn dark block" href={l.url} target="_blank" rel="noreferrer">Open</a>}
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy} onClick={done}>I learned this</button>
        <button className="cp-btn" onClick={actions.closeSheet}>Later</button>
      </div>
    </>
  );
}

const METRICS: Array<{ v: GoalMetric; l: string }> = [{ v: 'currency', l: 'Money' }, { v: 'number', l: 'Count' }, { v: 'percent', l: 'Percent' }, { v: 'none', l: 'Just a goal' }];

function GoalSheet({ goal, actions }: { goal: Goal | undefined; actions: Actions }) {
  const [title, setTitle] = useState(goal?.title ?? '');
  const [metric, setMetric] = useState<GoalMetric>(goal?.metric ?? 'currency');
  const [unit, setUnit] = useState(goal?.unit ?? (goal ? '' : '$'));
  const [target, setTarget] = useState(goal?.target_value?.toString() ?? '');
  const [current, setCurrent] = useState(goal?.current_value?.toString() ?? '');
  const [note, setNote] = useState(goal?.note ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    await actions.saveGoal({ id: goal?.id, title, metric, unit: metric === 'none' ? '' : unit, target_value: target === '' ? undefined : Number(target), current_value: current === '' ? undefined : Number(current), note });
    setBusy(false);
  };
  return (
    <>
      <h3>{goal ? 'Update goal' : 'New goal'}</h3>
      <p className="desc">Goals drive ranking. Keep the number honest and the copilot stays useful.</p>
      <div className="cp-field"><label className="cp-label">Goal</label><input className="cp-input sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Monthly revenue" /></div>
      <div className="cp-field"><label className="cp-label">Measured as</label>
        <div className="cp-chips">{METRICS.map((m) => <button key={m.v} className={`cp-fchip ${metric === m.v ? 'active' : ''}`} onClick={() => setMetric(m.v)}>{m.l}</button>)}</div>
      </div>
      {metric !== 'none' && (
        <div className="cp-field"><label className="cp-label">Now / Target{metric !== 'percent' && ' / Unit'}</label>
          <div className="cp-input-row">
            <input className="cp-input sm" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="0" />
            <input className="cp-input sm" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="2000" />
            {metric !== 'percent' && <input className="cp-input sm" style={{ maxWidth: 80 }} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={metric === 'currency' ? '$' : 'clients'} />}
          </div>
        </div>
      )}
      <div className="cp-field"><label className="cp-label">Why it matters (optional)</label><input className="cp-input sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Close before relocation" /></div>
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy || !title.trim()} onClick={save}>Save</button>
        {goal && <button className="cp-btn" disabled={busy} onClick={() => actions.saveGoal({ id: goal.id, status: 'done' })}>Mark done</button>}
      </div>
    </>
  );
}

function ResetSheet({ actions }: { actions: Actions }) {
  return (
    <>
      <h3>Forget this device?</h3>
      <p className="desc">Your copilot data stays in the database, but this device will start at onboarding again. There is no account recovery yet, so only do this if you mean it.</p>
      <div className="cp-btn-row">
        <button className="cp-btn dark" onClick={actions.resetDevice}>Forget device</button>
        <button className="cp-btn" onClick={actions.closeSheet}>Keep</button>
      </div>
    </>
  );
}
