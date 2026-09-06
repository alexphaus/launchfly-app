'use client';
// The real businesses, grouped by where each one actually is. No count of
// untouched matches anywhere — a pile you have not looked at is not a pipeline.
import { useEffect, useState } from 'react';
import { STAGE_LABEL, groupPipeline, type PipelineStage } from '@/lib/copilot/pipeline';
import type { HomeData, PipelineRow } from '@/lib/copilot/types';
import { OUTCOME_LABEL, relTime, sourceLabel } from '../format';
import type { Actions } from '../shared';

/** Stages folded by default: the long tail that has not been worked yet. */
const FOLDED: PipelineStage[] = ['not_drafted'];

export default function PipelineView({ home, actions, finding }: { home: HomeData; actions: Actions; finding: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const groups = groupPipeline(home.pipeline);
  const inferred = home.opportunities.filter((o) => o.source_kind === 'inferred');
  const targeted = home.profile.target_segments.length > 0;
  const b = home.billing;
  const worked = home.pipeline.filter((r) => r.stage !== 'not_drafted').length;

  return (
    <>
      <div className="cp-section">
        <span className="lead">Pipeline</span>
        <span className="count">{worked ? `${worked} in play` : 'nothing in play yet'}</span>
        <button className="link" disabled={finding || b.matches.remaining === 0} onClick={() => actions.findMatches()} style={{ marginLeft: 10 }}>
          {finding ? 'Finding…' : b.matches.remaining === 0 ? 'No matches left' : `Find new · ${b.matches.remaining} left`}
        </button>
      </div>

      {home.pipeline.length === 0 && (
        <div className="cp-empty">
          <b>No real businesses yet</b>
          {targeted
            ? <>Matches come from Google Maps for your segments and area. <button className="cp-textlink" disabled={finding} onClick={() => actions.findMatches()}>{finding ? 'Finding…' : 'Find matches'}</button></>
            : <>Tell the copilot who you sell to and where, then it can find real businesses. <button className="cp-textlink" onClick={() => actions.openSheet({ kind: 'targeting' })}>Set targeting</button></>}
        </div>
      )}

      {groups.map(({ stage, rows }) => {
        const folded = FOLDED.includes(stage) && !open[stage];
        return (
          <div key={stage}>
            <div className="cp-section sub">
              <span className="lead">{STAGE_LABEL[stage]}</span>
              <span className="count">{rows.length}</span>
              {FOLDED.includes(stage) && (
                <button className="link" style={{ marginLeft: 10 }} onClick={() => setOpen((o) => ({ ...o, [stage]: !o[stage] }))}>{folded ? 'Show' : 'Hide'}</button>
              )}
            </div>
            {!folded && (
              <div className="cp-list">
                {rows.map((r) => <Row key={r.opportunity.id} r={r} mounted={mounted} onOpen={() => actions.openSheet({ kind: 'opp', id: r.opportunity.id })} />)}
              </div>
            )}
          </div>
        );
      })}

      {inferred.length > 0 && (
        <>
          <div className="cp-section sub">
            <span className="lead">Inferred ideas</span>
            <span className="count">{inferred.length}</span>
            <button className="link" style={{ marginLeft: 10 }} onClick={() => setOpen((o) => ({ ...o, inferred: !o.inferred }))}>{open.inferred ? 'Hide' : 'Show'}</button>
          </div>
          {open.inferred && (
            <div className="cp-list">
              {inferred.map((o) => (
                <button key={o.id} className="cp-prow" onClick={() => actions.openSheet({ kind: 'opp', id: o.id })}>
                  <div className="cp-pmain"><div className="t">{o.title}</div><div className="s">{o.reason}</div></div>
                  <span className="cp-badge inferred">Inferred</span>
                </button>
              ))}
            </div>
          )}
          <div className="cp-note">The agent&apos;s guesses, not real listings. They never outrank a business with a phone number.</div>
        </>
      )}

      {home.pipeline.length > 0 && (
        <div className="cp-note">
          Last supply run {mounted ? relTime(home.supplyLastRun) : '…'}. The daily cron pulls new matches, reconciles replies and rebuilds the brief.
          {' '}{b.matches.used} of {b.matches.limit} matches used this month.
        </div>
      )}
    </>
  );
}

function Row({ r, mounted, onOpen }: { r: PipelineRow; mounted: boolean; onOpen: () => void }) {
  const o = r.opportunity;
  const e = r.execution;
  const d = (o.data ?? {}) as Record<string, unknown>;
  const segment = [d.segment, d.service_type, d.category].find((v) => typeof v === 'string' && v.trim()) as string | undefined;
  const meta = r.stage === 'sent' && e?.sent_at ? `sent ${mounted ? relTime(e.sent_at) : '…'}`
    : r.stage === 'to_send' && e?.approval_state === 'failed' ? 'send failed'
    : r.stage === 'to_send' ? 'draft waiting'
    : r.stage === 'not_drafted' ? (o.contact?.whatsapp || o.contact?.email ? 'has a contact' : 'no phone or email')
    : o.last_outcome ? OUTCOME_LABEL[o.last_outcome].toLowerCase() : '';
  return (
    <button className="cp-prow" onClick={onOpen}>
      <div className="cp-pmain">
        <div className="t">{o.title}</div>
        <div className="s">{[segment, meta, sourceLabel(o.source)].filter(Boolean).join(' · ')}</div>
      </div>
      <span className="cp-score">{o.score}%</span>
    </button>
  );
}
