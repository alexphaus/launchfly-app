'use client';
import { useEffect, useState } from 'react';
import { PLANS } from '@/lib/copilot/plans';
import { CAPACITY_META, type HomeData } from '@/lib/copilot/types';
import { goalProgress, money, relTime } from '../format';
import type { Actions } from '../shared';

// Lives in the sheet behind the header avatar: goals, offer, targeting, runway,
// plan, agent, account. Settings with the context the ranking runs on.
export default function YouView({ home, actions, briefing }: { home: HomeData; actions: Actions; briefing: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const m = home.metrics;
  const p = home.profile;
  const calendar = home.sources.find((s) => s.source_key === 'calendar');
  const b = home.billing;
  const currency = p.finance?.currency || home.goals.find((g) => g.metric === 'currency')?.unit || '$';

  return (
    <>
      <div className="cp-section"><span className="lead">Goals</span><button className="link" onClick={() => actions.openSheet({ kind: 'goal' })}>+ Add</button></div>
      {home.goals.length ? home.goals.map((g) => {
        const pr = goalProgress(g);
        return (
          <button key={g.id} className="cp-card cp-goal" onClick={() => actions.openSheet({ kind: 'goal', id: g.id })}>
            <div className="top"><span className="name">{g.title}</span><span className="pct">{pr.pct !== null ? `${pr.pct}%` : g.horizon_days ? `${g.horizon_days}D` : '—'}</span></div>
            <div className="track"><div className="cp-fill" style={{ width: `${pr.pct ?? 0}%` }} /></div>
            <div className="sub">{pr.label}{g.metric === 'currency' && m.won_amount ? ` · ${money(m.won_amount, g.unit || '$')} from logged wins` : ''}</div>
          </button>
        );
      }) : (
        <div className="cp-empty"><b>No active goal</b>Ranking runs on your profile alone. Add one so matches point somewhere.</div>
      )}

      <div className="cp-section"><span className="lead">Your offer</span><span className="count">drives every draft</span></div>
      <button className="cp-card cp-goal" onClick={() => actions.openSheet({ kind: 'offer' })}>
        <div className="top"><span className="name">{p.offer?.sells || 'What do you sell?'}</span><span className="pct">{p.offer?.sells ? 'Edit' : 'Set'}</span></div>
        <div className="sub">{p.offer?.sells ? [p.offer.for_who && `For ${p.offer.for_who}`, p.offer.price_band, p.offer.proof_url ? 'proof link set' : 'no proof link yet'].filter(Boolean).join(' · ') : 'Messages fall back to your headline and stay vague until this is filled in'}</div>
      </button>

      <div className="cp-section"><span className="lead">Targeting</span><span className="count">drives real supply</span></div>
      <button className="cp-card cp-goal" onClick={() => actions.openSheet({ kind: 'targeting' })}>
        <div className="top"><span className="name">{p.target_segments.length ? p.target_segments.join(', ') : 'Who do you sell to?'}</span><span className="pct">{p.target_segments.length ? 'Edit' : 'Set'}</span></div>
        <div className="sub">{p.target_area || p.location ? `In ${p.target_area || p.location}` : 'No area set'} · searched on Google Maps and matched against your prospect pipeline</div>
      </button>

      <div className="cp-section"><span className="lead">Context</span></div>
      <div className="cp-list">
        <div className="cp-ctx"><div><div className="l">Runway</div><div className="s">{m.runway_months != null ? `${m.runway_months} months · ${money(p.finance?.cash ?? 0, currency)} cash, ${money(p.finance?.monthly_burn ?? 0, currency)}/mo burn` : 'Two numbers. Shapes what counts as a good match.'}</div></div>
          <button className={`cp-connect ${m.runway_months != null ? 'ghost' : ''}`} onClick={() => actions.openSheet({ kind: 'finance' })}>{m.runway_months != null ? 'Edit' : 'Set'}</button></div>
        {calendar && (
          <div className="cp-ctx"><div><div className="l">Calendar</div><div className="s">Sharpens focus-window and nudge timing</div></div>
            {calendar.status === 'connected' ? <span className="cp-connect blue">Connected</span>
              : calendar.status === 'requested' ? <span className="cp-connect ghost">Requested</span>
              : <button className="cp-connect" onClick={() => actions.requestSource('calendar')}>Connect</button>}</div>
        )}
      </div>
      <div className="cp-note">{home.contextCount} context item{home.contextCount === 1 ? '' : 's'} so far. Every note, outcome and sent message sharpens ranking.</div>

      <div className="cp-section"><span className="lead">Plan</span><span className="count">{b.matches.remaining} match{b.matches.remaining === 1 ? '' : 'es'} left this month</span></div>
      <div className="cp-list">
        <div className="cp-ctx">
          <div>
            <div className="l">{PLANS[b.effective].name}{b.plan !== b.effective ? ` · ${PLANS[b.plan].name} lapsed` : ''}</div>
            <div className="s">
              {b.matches.used} of {b.matches.limit} matches used
              {b.cancelsAtPeriodEnd && b.renewsAt ? ` · ends ${mounted ? relTime(b.renewsAt) : '…'}`
                : b.renewsAt && b.effective !== 'free' ? ` · renews ${mounted ? relTime(b.renewsAt) : '…'}` : ''}
            </div>
          </div>
          {b.effective === 'free'
            ? <a className="cp-connect" href="/copilot/pricing">Upgrade</a>
            : <button className="cp-connect ghost" onClick={() => actions.openBilling()}>Manage</button>}
        </div>
        <div className="cp-ctx">
          <div><div className="l">This month</div><div className="s">Allowance resets on the 1st. Duplicates never count twice.</div></div>
          <span className="cp-connect ghost">{b.matches.used}/{b.matches.limit}</span>
        </div>
      </div>
      {b.status === 'past_due' && (
        <div className="cp-note">A payment failed, so you are on free limits for now. Everything you built is still here — fix the card and it comes straight back.</div>
      )}

      <div className="cp-section"><span className="lead">Copilot</span></div>
      <div className="cp-list">
        <div className="cp-ctx">
          <div><div className="l">Agent</div><div className="s">{home.lastRun ? `${home.lastRun.agent}${home.lastRun.status === 'error' ? ' · failed' : ''} · ${mounted ? relTime(home.lastRun.finished_at) : '…'}` : 'No run yet'}</div></div>
          <button className="cp-connect" disabled={briefing} onClick={() => actions.runBrief('manual')}>{briefing ? 'Running' : 'Run again'}</button>
        </div>
        <div className="cp-ctx">
          <div><div className="l">Capacity</div><div className="s">{CAPACITY_META[p.capacity].sub}</div></div>
          <button className="cp-connect ghost" onClick={() => actions.openSheet({ kind: 'capacity' })}>{CAPACITY_META[p.capacity].label}</button>
        </div>
        <div className="cp-ctx">
          <div><div className="l">Account</div><div className="s">{home.account.email ? `${home.account.email}${home.account.verified ? ' · verified' : ' · not verified'}` : 'This device only. Add an email to sign in elsewhere.'}{home.push.enabled ? ' · push on' : ''}</div></div>
          <button className={`cp-connect ${home.account.verified ? 'ghost' : ''}`} onClick={() => actions.openSheet({ kind: 'account' })}>{home.account.verified ? 'Manage' : 'Secure'}</button>
        </div>
        <div className="cp-ctx">
          <div><div className="l">{p.name}</div><div className="s">{p.headline ?? 'No headline yet'}{p.location ? ` · ${p.location}` : ''}</div></div>
          <button className="cp-connect ghost" onClick={() => actions.openSheet({ kind: 'reset' })}>Forget device</button>
        </div>
      </div>
      <div className="cp-note">
        {home.channels.mode === 'api'
          ? `Sending directly from your own account: WhatsApp ${home.channels.whatsapp ? 'on' : 'off'} · Email ${home.channels.email ? 'on' : 'off'}.`
          : 'Drafts open pre-filled in your own WhatsApp or mail app, so messages come from you, not from this server.'}
        {' '}Push {home.push.publicKey ? (home.push.enabled ? 'on' : 'available') : 'off'}.
      </div>
    </>
  );
}
