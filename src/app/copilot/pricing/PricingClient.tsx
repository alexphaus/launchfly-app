'use client';
// The pricing page. Works signed out (a link you can send someone) and signed
// in (shows the current plan and upgrades in place).

import { useState } from 'react';
import {
  CURRENCY, PLANS, PLAN_ORDER, monthlyEquivalent, savingsPercent,
  type BillingPeriod, type Plan, type PlanKey,
} from '@/lib/copilot/plans';

export interface PricingState {
  signedIn: boolean;
  currentPlan: PlanKey | null;
  /** True when a lapsed subscription has dropped them to free limits. */
  lapsed: boolean;
  checkoutReady: boolean;
}

export default function PricingClient({ state }: { state: PricingState }) {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [busy, setBusy] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (plan: PlanKey) => {
    if (plan === 'free') { window.location.href = '/copilot'; return; }
    if (!state.signedIn) { window.location.href = '/copilot'; return; }
    setBusy(plan);
    setError(null);
    try {
      const r = await fetch('/api/copilot/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan, period }),
      });
      const data = await r.json();
      if (!r.ok || !data.url) throw new Error(data.error || 'Could not start checkout');
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout');
      setBusy(null);
    }
  };

  const manage = async () => {
    setBusy('free');
    try {
      const r = await fetch('/api/copilot/billing/portal', { method: 'POST' });
      const data = await r.json();
      if (!r.ok || !data.url) throw new Error(data.error || 'Could not open billing');
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open billing');
      setBusy(null);
    }
  };

  return (
    <div className="cp-frame">
      <main className="cp-content cp-pricing">
        <header className="cp-price-head">
          <h1>Find the work.<br />Not the leads.</h1>
          <p>
            The copilot searches for real businesses that match what you sell, drafts the opener, and
            tracks what came back. You approve and send. Nothing goes out by itself.
          </p>
        </header>

        {state.lapsed && (
          <div className="cp-card cp-price-alert">
            <b>Your plan lapsed.</b> Everything you have built is still here — your matches, funnel and
            history. Only new supply stopped. Pick a plan below to turn it back on.
          </div>
        )}

        <div className="cp-toggle" role="tablist" aria-label="Billing period">
          {(['monthly', 'yearly'] as BillingPeriod[]).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={period === p}
              className={period === p ? 'on' : ''}
              onClick={() => setPeriod(p)}
            >
              {p === 'monthly' ? 'Monthly' : `Yearly · ${savingsPercent(PLANS.pro)}% off`}
            </button>
          ))}
        </div>

        {PLAN_ORDER.map((key) => (
          <PlanCard
            key={key}
            plan={PLANS[key]}
            period={period}
            state={state}
            busy={busy === key}
            onPick={() => start(key)}
            onManage={manage}
          />
        ))}

        {error && <div className="cp-card cp-price-alert">{error}</div>}

        {!state.checkoutReady && (
          <div className="cp-note">
            Checkout is not switched on yet, so the buttons above will not charge anyone. The free plan works now.
          </div>
        )}

        <div className="cp-section"><span className="lead">What counts as a match</span></div>
        <div className="cp-card cp-price-faq">
          <p>
            <b>A match is one real business or listing the copilot found for you</b> — a name, a contact
            and a reason it fits your offer. Duplicates you have already been shown never count twice,
            and a search that finds nothing costs you nothing.
          </p>
          <p>
            <b>Sending is always free and always yours.</b> On every plan, drafts open pre-filled in your
            own WhatsApp or mail app, so messages come from you rather than from a server. Paid plans add
            sending directly from your own verified address when you want it.
          </p>
          <p>
            <b>Nothing is deleted if you stop paying.</b> Your matches, funnel, outcomes and history stay.
            You drop back to the free allowance for new supply, and that is the only thing that changes.
          </p>
          <p>
            <b>Cancel from inside the app,</b> any time, in two taps. Yearly plans are refunded pro rata
            if the copilot is not finding you anything.
          </p>
        </div>

        <div className="cp-note" style={{ marginBottom: 32 }}>
          Prices in {CURRENCY === '$' ? 'USD' : CURRENCY}. Payments and cards are handled by Stripe — this
          app never sees a card number. <a href="/copilot">Back to the app →</a>
        </div>
      </main>
    </div>
  );
}

function PlanCard({ plan, period, state, busy, onPick, onManage }: {
  plan: Plan; period: BillingPeriod; state: PricingState; busy: boolean; onPick: () => void; onManage: () => void;
}) {
  const isCurrent = state.currentPlan === plan.key && !state.lapsed;
  const price = monthlyEquivalent(plan, period);
  const paid = plan.key !== 'free';

  return (
    <div className={`cp-card cp-plan ${plan.recommended ? 'pick' : ''} ${isCurrent ? 'current' : ''}`}>
      <div className="cp-plan-top">
        <div>
          <div className="cp-plan-name">{plan.name}</div>
          <div className="cp-plan-tag">{plan.tagline}</div>
        </div>
        {plan.recommended && !isCurrent && <span className="cp-plan-badge">Start here</span>}
        {isCurrent && <span className="cp-plan-badge on">Your plan</span>}
      </div>

      <div className="cp-plan-price">
        <span className="amount">{CURRENCY}{price}</span>
        <span className="per">
          {!paid ? 'forever, no card' : period === 'yearly' ? `/month, ${CURRENCY}${plan.price.yearly} billed yearly` : '/month'}
        </span>
      </div>

      <ul className="cp-plan-features">
        {plan.features.map((f, i) => <li key={i}>{f}</li>)}
      </ul>

      {isCurrent && paid ? (
        <button className="cp-plan-cta ghost" disabled={busy} onClick={onManage}>
          {busy ? 'Opening…' : 'Manage billing'}
        </button>
      ) : isCurrent ? (
        <a className="cp-plan-cta ghost" href="/copilot">Open the app</a>
      ) : (
        <button
          className={`cp-plan-cta ${plan.recommended ? 'primary' : ''}`}
          disabled={busy || (paid && !state.checkoutReady)}
          onClick={onPick}
        >
          {busy ? 'Opening…'
            : !paid ? 'Start free'
            : !state.signedIn ? `Start with ${plan.name}`
            : `Upgrade to ${plan.name}`}
        </button>
      )}
    </div>
  );
}
