'use client';
// An intro that says what this is, then three screens under a minute: who you
// are, what you are going for, who you sell to.
//
// The intro exists because /copilot is the link people get sent. Landing a
// stranger straight on "What should I call you?" asks them to fill in a form for
// something nobody has explained yet.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PLANS } from '@/lib/copilot/plans';
import { CAPACITY_META, OPPORTUNITY_TYPES, type Capacity, type GoalMetric, type OpportunityType } from '@/lib/copilot/types';
import { post } from './api';
import { TYPE_PLURAL } from './format';

const METRICS: Array<{ v: GoalMetric; l: string }> = [{ v: 'currency', l: 'Money' }, { v: 'number', l: 'Count' }, { v: 'percent', l: 'Percent' }, { v: 'none', l: 'Just a goal' }];
const HORIZONS = [30, 90, 180];

export default function Onboarding() {
  const router = useRouter();
  const [intro, setIntro] = useState(true);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [headline, setHeadline] = useState('');
  const [location, setLocation] = useState('');
  const [goalTitle, setGoalTitle] = useState('');
  const [metric, setMetric] = useState<GoalMetric>('currency');
  const [unit, setUnit] = useState('$');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [horizon, setHorizon] = useState(90);
  const [notes, setNotes] = useState('');
  const [sells, setSells] = useState('');
  const [forWho, setForWho] = useState('');
  const [problem, setProblem] = useState('');
  const [proof, setProof] = useState('');
  const [segments, setSegments] = useState('');
  const [area, setArea] = useState('');
  const [hunt, setHunt] = useState<OpportunityType[]>([...OPPORTUNITY_TYPES]);
  const [capacity, setCapacity] = useState<Capacity>('moderate');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A sign-in link for an email we do not know yet lands here with ?email=.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const e = q.get('email'); if (e) { setEmail(e); setIntro(false); }
    if (q.get('start') === '1') setIntro(false);
  }, []);
  useEffect(() => { if (!area && location) setArea(location); }, [location, area]);
  useEffect(() => { if (!segments && forWho) setSegments(forWho); }, [forWho, segments]);

  const canNext = step === 0 ? name.trim().length > 0 : step === 1 ? goalTitle.trim().length > 0 : sells.trim().length > 0 && hunt.length > 0;
  const toggleHunt = (t: OpportunityType) => setHunt((h) => (h.includes(t) ? h.filter((x) => x !== t) : [...h, t]));

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await post('/onboard', {
        name, email: email.trim() || undefined, headline, location,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        goal: { title: goalTitle, metric, unit: metric === 'none' ? undefined : unit, target_value: target === '' ? undefined : Number(target), current_value: current === '' ? undefined : Number(current), horizon_days: horizon },
        capacity, hunt_types: hunt, notes,
        target_segments: segments, target_area: area,
        offer: { sells, for_who: forWho, problem, proof_url: proof.trim() || undefined },
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
          {!intro && <div className="cp-steps">{[0, 1, 2].map((i) => <span key={i} className={i < step ? 'done' : i === step ? 'on' : ''} />)}</div>}
        </div>

        <div className="cp-ob-body">
          {error && <div className="cp-error">{error}</div>}

          {intro && (
            <div className="cp-intro">
              <h1>Find the work.<br />Not the leads.</h1>
              <p className="sub">
                Tell it what you sell and who buys it. Every morning it brings real businesses that
                fit, an opener already drafted for each one, and the honest number on what came back.
              </p>
              <ol className="cp-intro-steps">
                <li><b>It looks.</b> Real businesses in your area, matched against your offer — not a list you scrape yourself.</li>
                <li><b>It drafts.</b> Each match arrives with an opener written from your offer, ready to review.</li>
                <li><b>You send.</b> It opens in your own WhatsApp or mail app. Nothing goes out by itself, ever.</li>
                <li><b>It measures.</b> Replies, meetings and wins go back in, and it tells you where you are losing.</li>
              </ol>
              <p className="cp-intro-plan">
                Free is {PLANS.free.limits.matchesPerMonth} real matches a month and the whole engine —
                no card, nothing to cancel. <a href="/copilot/pricing">See the plans →</a>
              </p>
            </div>
          )}

          {!intro && step === 0 && (
            <>
              <h2>Let&apos;s set you up.</h2>
              <p className="sub">Three quick screens. You can change everything later.</p>
              <div className="cp-field"><label className="cp-label">What should I call you?</label><input className="cp-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" maxLength={80} /></div>
              <div className="cp-field"><label className="cp-label">What do you do? One line.</label><input className="cp-input" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Build WhatsApp booking automations for small agencies" maxLength={160} /><div className="cp-help">This line is used in the messages the copilot drafts for you. Be concrete.</div></div>
              <div className="cp-field"><label className="cp-label">Where are you based? (optional)</label><input className="cp-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Puerto Princesa, Palawan" maxLength={80} /></div>
              <div className="cp-field"><label className="cp-label">Email (optional)</label><input className="cp-input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" maxLength={120} /><div className="cp-help">Lets you sign in on another device and recover this copilot. You can add it later.</div></div>
            </>
          )}

          {!intro && step === 1 && (
            <>
              <h2>What are you going for?</h2>
              <p className="sub">One goal is enough. Ranking points at it, and wins you log move it.</p>
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

          {!intro && step === 2 && (
            <>
              <h2>What do you sell, and to whom?</h2>
              <p className="sub">This is what makes matches real and messages sound like you.</p>
              <div className="cp-field"><label className="cp-label">I sell / I build</label><input className="cp-input" autoFocus value={sells} onChange={(e) => setSells(e.target.value)} placeholder="WhatsApp booking automations" maxLength={120} /></div>
              <div className="cp-field"><label className="cp-label">For</label><input className="cp-input" value={forWho} onChange={(e) => setForWho(e.target.value)} placeholder="resorts and tour operators" maxLength={120} /></div>
              <div className="cp-field"><label className="cp-label">The problem it solves</label><input className="cp-input" value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="enquiries arrive after hours and go unanswered" maxLength={240} /><div className="cp-help">Every drafted message is built from this. Say it the way your customer would feel it.</div></div>
              <div className="cp-field"><label className="cp-label">One link that proves it (optional)</label><input className="cp-input" type="url" inputMode="url" value={proof} onChange={(e) => setProof(e.target.value)} placeholder="https://…" maxLength={300} /></div>
              <div className="cp-field"><label className="cp-label">Where to look for them</label>
                <div className="cp-input-row">
                  <input className="cp-input" value={segments} onChange={(e) => setSegments(e.target.value)} placeholder="resort, dive shop" maxLength={240} />
                  <input className="cp-input" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Palawan" maxLength={80} />
                </div>
                <div className="cp-help">Business type and area, searched on Google Maps. Leave blank if your clients are not local — the copilot will run on what you tell it instead.</div>
              </div>
              <div className="cp-field"><label className="cp-label">Also look for</label>
                <div className="cp-chips">{OPPORTUNITY_TYPES.map((t) => <button key={t} className={`cp-fchip ${hunt.includes(t) ? 'active' : ''}`} onClick={() => toggleHunt(t)}>{TYPE_PLURAL[t]}</button>)}</div>
              </div>
              <div className="cp-help" style={{ marginBottom: 14 }}>
                You start on Free: {PLANS.free.limits.matchesPerMonth} real matches a month, no card.
                Nothing is sent without you tapping send. <a href="/copilot/pricing">Plans →</a>
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
          {intro && <a className="cp-btn" href="/copilot/login" style={{ textDecoration: 'none' }}>Sign in</a>}
          {intro && <button className="cp-btn primary" onClick={() => setIntro(false)}>Start free</button>}
          {!intro && step > 0 && <button className="cp-btn" disabled={busy} onClick={() => setStep((s) => s - 1)}>Back</button>}
          {!intro && step === 0 && <a className="cp-btn" href="/copilot/login" style={{ textDecoration: 'none' }}>Sign in</a>}
          {!intro && (step < 2
            ? <button className="cp-btn primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continue</button>
            : <button className="cp-btn primary" disabled={!canNext || busy} onClick={finish}>{busy ? 'Finding matches & building your brief…' : 'Start my copilot'}</button>)}
        </div>
      </div>
    </div>
  );
}
