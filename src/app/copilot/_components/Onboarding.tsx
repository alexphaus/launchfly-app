'use client';
// Three screens, under a minute. Who you are, what you are going for, how to hunt.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CAPACITY_META, OPPORTUNITY_TYPES, type Capacity, type GoalMetric, type OpportunityType } from '@/lib/copilot/types';
import { post } from './api';
import { TYPE_PLURAL } from './format';

const METRICS: Array<{ v: GoalMetric; l: string }> = [{ v: 'currency', l: 'Money' }, { v: 'number', l: 'Count' }, { v: 'percent', l: 'Percent' }, { v: 'none', l: 'Just a goal' }];
const HORIZONS = [30, 90, 180];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [headline, setHeadline] = useState('');
  const [location, setLocation] = useState('');
  const [goalTitle, setGoalTitle] = useState('');
  const [metric, setMetric] = useState<GoalMetric>('currency');
  const [unit, setUnit] = useState('$');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [horizon, setHorizon] = useState(90);
  const [notes, setNotes] = useState('');
  const [hunt, setHunt] = useState<OpportunityType[]>([...OPPORTUNITY_TYPES]);
  const [capacity, setCapacity] = useState<Capacity>('moderate');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canNext = step === 0 ? name.trim().length > 0 : step === 1 ? goalTitle.trim().length > 0 : hunt.length > 0;

  const toggleHunt = (t: OpportunityType) => setHunt((h) => (h.includes(t) ? h.filter((x) => x !== t) : [...h, t]));

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await post('/onboard', {
        name, headline, location,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        goal: { title: goalTitle, metric, unit: metric === 'none' ? undefined : unit, target_value: target === '' ? undefined : Number(target), current_value: current === '' ? undefined : Number(current), horizon_days: horizon },
        capacity, hunt_types: hunt, notes,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <div className="cp-frame">
      <div className="cp-ob">
        <div className="cp-ob-head">
          <div className="cp-wordmark">COPILOT</div>
          <div className="cp-steps">{[0, 1, 2].map((i) => <span key={i} className={i < step ? 'done' : i === step ? 'on' : ''} />)}</div>
        </div>

        <div className="cp-ob-body">
          {error && <div className="cp-error">{error}</div>}

          {step === 0 && (
            <>
              <h2>Let&apos;s set you up.</h2>
              <p className="sub">Three quick screens. You can change everything later.</p>
              <div className="cp-field"><label className="cp-label">What should I call you?</label><input className="cp-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" maxLength={80} /></div>
              <div className="cp-field"><label className="cp-label">What do you do? One line.</label><input className="cp-input" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Build WhatsApp booking automations for small agencies" maxLength={160} /><div className="cp-help">This single line drives most of the first matches. Be concrete.</div></div>
              <div className="cp-field"><label className="cp-label">Where are you based? (optional)</label><input className="cp-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Palawan, PH" maxLength={80} /></div>
            </>
          )}

          {step === 1 && (
            <>
              <h2>What are you going for?</h2>
              <p className="sub">One goal is enough. Ranking points at it.</p>
              <div className="cp-field"><label className="cp-label">Goal</label><input className="cp-input" autoFocus value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="Monthly revenue" maxLength={120} /></div>
              <div className="cp-field"><label className="cp-label">Measured as</label>
                <div className="cp-chips">{METRICS.map((m) => <button key={m.v} className={`cp-fchip ${metric === m.v ? 'active' : ''}`} onClick={() => setMetric(m.v)}>{m.l}</button>)}</div>
              </div>
              {metric !== 'none' && (
                <div className="cp-field"><label className="cp-label">Now / Target{metric !== 'percent' && ' / Unit'}</label>
                  <div className="cp-input-row">
                    <input className="cp-input" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="1500" />
                    <input className="cp-input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="2000" />
                    {metric !== 'percent' && <input className="cp-input" style={{ maxWidth: 84 }} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={metric === 'currency' ? '$' : 'clients'} maxLength={12} />}
                  </div>
                </div>
              )}
              <div className="cp-field"><label className="cp-label">Horizon</label>
                <div className="cp-chips">{HORIZONS.map((h) => <button key={h} className={`cp-fchip ${horizon === h ? 'active' : ''}`} onClick={() => setHorizon(h)}>{h} days</button>)}</div>
              </div>
              <div className="cp-field"><label className="cp-label">Anything I should know? (optional)</label><textarea className="cp-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Leaving the country in 6 weeks. Best clients so far came from referrals. Hate cold calls." maxLength={1000} /></div>
            </>
          )}

          {step === 2 && (
            <>
              <h2>How should I hunt?</h2>
              <p className="sub">Pick what counts as an opportunity, and how much room you have today.</p>
              <div className="cp-field"><label className="cp-label">Look for</label>
                <div className="cp-chips">{OPPORTUNITY_TYPES.map((t) => <button key={t} className={`cp-fchip ${hunt.includes(t) ? 'active' : ''}`} onClick={() => toggleHunt(t)}>{TYPE_PLURAL[t]}</button>)}</div>
                <div className="cp-help">Clients pay you. People hire, refer or partner. Services you could offer or buy. Communities where buyers are. Signals are market shifts worth reading.</div>
              </div>
              <div className="cp-field"><label className="cp-label">Capacity today</label>
                {(Object.keys(CAPACITY_META) as Capacity[]).map((c) => (
                  <button key={c} className={`cp-option ${capacity === c ? 'active' : ''}`} onClick={() => setCapacity(c)}>
                    <div><div className="ct">{CAPACITY_META[c].label}</div><div className="cs">{CAPACITY_META[c].sub}</div></div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="cp-ob-foot">
          {step > 0 && <button className="cp-btn" disabled={busy} onClick={() => setStep((s) => s - 1)}>Back</button>}
          {step < 2
            ? <button className="cp-btn primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continue</button>
            : <button className="cp-btn primary" disabled={!canNext || busy} onClick={finish}>{busy ? 'Building your first brief…' : 'Start my copilot'}</button>}
        </div>
      </div>
    </div>
  );
}
