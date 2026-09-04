'use client';
import { useEffect, useState } from 'react';
import { OPPORTUNITY_TYPES, type HomeData, type OpportunityType } from '@/lib/copilot/types';
import { OUTCOME_LABEL, TYPE_LABEL, TYPE_PLURAL } from '../format';
import type { Actions } from '../shared';

type Filter = 'all' | 'real' | 'saved' | OpportunityType;

export default function OppsView({ home, actions, finding }: { home: HomeData; actions: Actions; finding: boolean }) {
  const [filter, setFilter] = useState<Filter>('all');
  const saved = home.opportunities.filter((o) => o.status === 'saved').length;
  const real = home.opportunities.filter((o) => o.source_kind === 'sourced').length;
  useEffect(() => { if (filter === 'saved' && saved === 0) setFilter('all'); }, [filter, saved]);

  const list = home.opportunities.filter((o) =>
    filter === 'all' ? true : filter === 'real' ? o.source_kind === 'sourced' : filter === 'saved' ? o.status === 'saved' : o.type === filter);
  const fresh = list.filter((o) => o.status === 'new').length;
  const targeted = home.profile.target_segments.length > 0;

  return (
    <>
      <div className="cp-filters">
        <button className={`cp-fchip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        <button className={`cp-fchip ${filter === 'real' ? 'active' : ''}`} onClick={() => setFilter('real')}>Real{real ? ` ${real}` : ''}</button>
        {saved > 0 && <button className={`cp-fchip ${filter === 'saved' ? 'active' : ''}`} onClick={() => setFilter('saved')}>Saved</button>}
        {OPPORTUNITY_TYPES.map((t) => (
          <button key={t} className={`cp-fchip ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>{TYPE_PLURAL[t]}</button>
        ))}
      </div>
      <div className="cp-section">
        <span className="lead">Matched for you</span>
        {fresh > 0 && <span className="count">{fresh} new</span>}
        <button className="link" disabled={finding} onClick={() => actions.findMatches()} style={{ marginLeft: 10 }}>{finding ? 'Finding…' : 'Find new'}</button>
      </div>

      {list.length ? (
        <div className="cp-list">
          {list.map((o) => (
            <button key={o.id} className="cp-match" onClick={() => actions.openSheet({ kind: 'opp', id: o.id })}>
              <div className="cp-mtop">
                <span className="cp-tags">
                  <span className={`cp-tag ${o.status === 'saved' ? 'saved' : ''}`}>{o.status === 'saved' ? 'Saved · ' : ''}{TYPE_LABEL[o.type]}</span>
                  <span className={`cp-badge ${o.source_kind === 'sourced' ? 'real' : 'inferred'}`}>{o.source_kind === 'sourced' ? 'Real' : 'Inferred'}</span>
                  {o.last_outcome && <span className={`cp-badge ${o.last_outcome === 'won' ? 'won' : 'outcome'}`}>{OUTCOME_LABEL[o.last_outcome]}</span>}
                </span>
                <span className="cp-score">{o.score}% match</span>
              </div>
              <div className="cp-mtitle">{o.title}</div>
              <div className="cp-mreason">{o.reason}</div>
              <div className="cp-mbottom">
                <div className="cp-mvalue">{o.value_label ?? (o.contact?.whatsapp || o.contact?.email ? 'Draft' : o.type === 'community' ? 'Join' : o.type === 'signal' ? 'Read' : 'Open')}</div>
                <div className="cp-track"><div className="cp-fill" style={{ width: `${o.score}%` }} /></div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="cp-empty">
          <b>{filter === 'all' ? 'No matches yet' : `No ${filter === 'saved' ? 'saved' : filter === 'real' ? 'real' : TYPE_PLURAL[filter as OpportunityType].toLowerCase()} matches yet`}</b>
          {targeted
            ? <>Real matches come from your prospect pipeline and Google Maps for your segments. <button className="cp-textlink" disabled={finding} onClick={() => actions.findMatches()}>{finding ? 'Finding…' : 'Find new matches'}</button></>
            : <>Tell the copilot who you sell to and where, then it can find real businesses. <button className="cp-textlink" onClick={() => actions.openSheet({ kind: 'targeting' })}>Set targeting</button></>}
        </div>
      )}
      {list.length > 0 && <div className="cp-note">Real matches are actual businesses with a contact. Inferred ones are the agent&apos;s guesses and rank below them. Save, skip and outcomes reweight the next ranking.</div>}
    </>
  );
}
