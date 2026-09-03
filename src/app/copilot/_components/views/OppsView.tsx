'use client';
import { useState } from 'react';
import { OPPORTUNITY_TYPES, type HomeData, type OpportunityType } from '@/lib/copilot/types';
import { TYPE_LABEL, TYPE_PLURAL } from '../format';
import type { Actions } from '../shared';

type Filter = 'all' | 'saved' | OpportunityType;

export default function OppsView({ home, actions }: { home: HomeData; actions: Actions }) {
  const [filter, setFilter] = useState<Filter>('all');
  const list = home.opportunities.filter((o) => filter === 'all' ? true : filter === 'saved' ? o.status === 'saved' : o.type === filter);
  const fresh = list.filter((o) => o.status === 'new').length;
  const saved = home.opportunities.filter((o) => o.status === 'saved').length;
  const hasAgent = home.lastRun && home.lastRun.agent !== 'starter';

  return (
    <>
      <div className="cp-filters">
        <button className={`cp-fchip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        {saved > 0 && <button className={`cp-fchip ${filter === 'saved' ? 'active' : ''}`} onClick={() => setFilter('saved')}>Saved</button>}
        {OPPORTUNITY_TYPES.map((t) => (
          <button key={t} className={`cp-fchip ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>{TYPE_PLURAL[t]}</button>
        ))}
      </div>
      <div className="cp-section"><span className="lead">Matched for you</span>{fresh > 0 && <span className="count">{fresh} new</span>}</div>

      {list.length ? (
        <div className="cp-list">
          {list.map((o) => (
            <button key={o.id} className="cp-match" onClick={() => actions.openSheet({ kind: 'opp', id: o.id })}>
              <div className="cp-mtop"><span className={`cp-tag ${o.status === 'saved' ? 'saved' : ''}`}>{o.status === 'saved' ? 'Saved · ' : ''}{TYPE_LABEL[o.type]}</span><span className="cp-score">{o.score}% match</span></div>
              <div className="cp-mtitle">{o.title}</div>
              <div className="cp-mreason">{o.reason}</div>
              <div className="cp-mbottom">
                <div className="cp-mvalue">{o.value_label ?? (o.type === 'community' ? 'Join' : o.type === 'signal' ? 'Read' : 'Open')}</div>
                <div className="cp-track"><div className="cp-fill" style={{ width: `${o.score}%` }} /></div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="cp-empty">
          <b>{filter === 'all' ? 'No matches yet' : `No ${filter === 'saved' ? 'saved' : TYPE_PLURAL[filter as OpportunityType].toLowerCase()} yet`}</b>
          {hasAgent
            ? 'The agent ranks new matches every day. Add context on Today to give it more to work with.'
            : 'Matches appear once an agent is connected. Right now the copilot runs on your onboarding answers only. Your notes are already being stored for it.'}
        </div>
      )}
      {list.length > 0 && <div className="cp-note">Save what fits, skip what doesn&apos;t. Every choice reweights the next ranking.</div>}
    </>
  );
}
