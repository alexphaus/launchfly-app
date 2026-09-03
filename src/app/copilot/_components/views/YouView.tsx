'use client';
import { useEffect, useState } from 'react';
import { CAPACITY_META, type HomeData, type SourceKey } from '@/lib/copilot/types';
import { goalProgress, relTime } from '../format';
import type { Actions } from '../shared';

const SOURCE_META: Record<SourceKey, { label: string; sub: string }> = {
  calendar: { label: 'Calendar', sub: 'Sharpens focus-window and nudge timing' },
  crm: { label: 'Business notes / CRM', sub: 'Improves client and lead matching' },
  finance: { label: 'Finances', sub: 'Keeps pricing and runway guidance current' },
};

export default function YouView({ home, actions, briefing }: { home: HomeData; actions: Actions; briefing: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const connected = home.sources.filter((s) => s.status === 'connected').length;

  return (
    <>
      <div className="cp-section"><span className="lead">Goals</span><button className="link" onClick={() => actions.openSheet({ kind: 'goal' })}>+ Add</button></div>
      {home.goals.length ? home.goals.map((g) => {
        const p = goalProgress(g);
        return (
          <button key={g.id} className="cp-card cp-goal" onClick={() => actions.openSheet({ kind: 'goal', id: g.id })}>
            <div className="top"><span className="name">{g.title}</span><span className="pct">{p.pct !== null ? `${p.pct}%` : g.horizon_days ? `${g.horizon_days}D` : '—'}</span></div>
            <div className="track"><div className="cp-fill" style={{ width: `${p.pct ?? 0}%` }} /></div>
            <div className="sub">{p.label}</div>
          </button>
        );
      }) : (
        <div className="cp-empty"><b>No active goal</b>Ranking runs on your profile alone. Add one so matches point somewhere.</div>
      )}

      <div className="cp-section"><span className="lead">Context sources</span><span className="count">foundation for later</span></div>
      <div className="cp-list">
        {home.sources.map((s) => (
          <div key={s.source_key} className="cp-ctx">
            <div><div className="l">{SOURCE_META[s.source_key].label}</div><div className="s">{SOURCE_META[s.source_key].sub}</div></div>
            {s.status === 'connected' ? <span className="cp-connect blue">Connected</span>
              : s.status === 'requested' ? <span className="cp-connect ghost">Requested</span>
              : <button className="cp-connect" onClick={() => actions.requestSource(s.source_key)}>Connect</button>}
          </div>
        ))}
      </div>
      <div className="cp-note">
        {connected === 0
          ? `Nothing is connected yet — matches run on what you tell the copilot directly (${home.contextCount} item${home.contextCount === 1 ? '' : 's'} so far). Each source you add sharpens ranking, it doesn't unlock new tabs.`
          : `${connected} source${connected === 1 ? '' : 's'} connected, ${home.contextCount} context items in total.`}
      </div>

      <div className="cp-section"><span className="lead">Copilot</span></div>
      <div className="cp-list">
        <div className="cp-ctx">
          <div><div className="l">Agent</div><div className="s">{home.lastRun ? `${home.lastRun.agent}${home.lastRun.status === 'error' ? ' · failed' : ''} · ${mounted ? relTime(home.lastRun.finished_at) : '…'}` : 'No run yet'}</div></div>
          <button className="cp-connect" disabled={briefing} onClick={() => actions.runBrief('manual')}>{briefing ? 'Running' : 'Run again'}</button>
        </div>
        <div className="cp-ctx">
          <div><div className="l">Capacity</div><div className="s">{CAPACITY_META[home.profile.capacity].sub}</div></div>
          <button className="cp-connect ghost" onClick={() => actions.openSheet({ kind: 'capacity' })}>{CAPACITY_META[home.profile.capacity].label}</button>
        </div>
        <div className="cp-ctx">
          <div><div className="l">{home.profile.name}</div><div className="s">{home.profile.headline ?? 'No headline yet'}{home.profile.location ? ` · ${home.profile.location}` : ''}</div></div>
          <button className="cp-connect ghost" onClick={() => actions.openSheet({ kind: 'reset' })}>Forget device</button>
        </div>
      </div>
      <div className="cp-note">Signed in on this device only. Account sync and real connectors come next; the data model is ready for both.</div>
    </>
  );
}
