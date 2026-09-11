'use client';
// An intro that says what this is, then three screens under a minute: who you
// are, what you are going for, and where it should look.
//
// The third screen used to be "what do you sell, and who are your local
// customers", unconditionally, followed by a Google Maps scrape. That is one
// person's question. Somebody whose goal is "get a job, urgent money" answered
// it with a blank, which meant no segments, which meant no first supply, which
// meant an empty app and a fallback call telling them to set an offer they do
// not have — the user the last month of work was built for got the emptiest
// possible screen.
//
// So the GOAL decides the shape of the rest. inferIntent reads it, the chips let
// them correct it in one tap, and what they are asked next follows from that:
// selling gets the offer and the local targeting, everything else gets sources
// to watch. The chips are never hidden, so nothing is decided behind their back.
//
// The intro exists because /copilot is the link people get sent. Landing a
// stranger straight on "What should I call you?" asks them to fill in a form for
// something nobody has explained yet.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PLANS } from '@/lib/copilot/plans';
import { useShell } from './shell';
import { CAPACITY_META, type Capacity, type GoalMetric } from '@/lib/copilot/types';
import { WATCH_INTENTS, SELLING_INTENTS, inferIntent, startersFor, type WatchIntent } from '@/lib/copilot/watch/catalogue';
import { post } from './api';

const METRICS: Array<{ v: GoalMetric; l: string }> = [{ v: 'currency', l: 'Money' }, { v: 'number', l: 'Count' }, { v: 'percent', l: 'Percent' }, { v: 'none', l: 'Just a goal' }];
const HORIZONS = [30, 90, 180];

export default function Onboarding() {
  const router = useRouter();
  const shell = useShell();
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
  const [capacity, setCapacity] = useState<Capacity>('moderate');
  // Null until they reach step 2 or tap a chip, so the inferred value can keep
  // tracking the goal while they are still editing it.
  const [pickedIntent, setPickedIntent] = useState<WatchIntent | null>(null);
  const [dropped, setDropped] = useState<string[]>([]);
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

  const intent = pickedIntent ?? inferIntent(`${goalTitle} ${notes}`, { hasOffer: !!sells.trim() });
  const selling = SELLING_INTENTS.includes(intent);
  // Seeded with their own words the moment they have written them, so the search
  // feeds arrive pointed at what they actually do rather than at a placeholder.
  const starters = startersFor(intent, { term: sells.trim() || headline.trim() || null });
  const chosen = starters.filter((x) => !dropped.includes(x.url));
  const toggleSource = (url: string) => setDropped((d) => (d.includes(url) ? d.filter((u) => u !== url) : [...d, url]));

  // Somebody not selling anything has no offer to write, and forcing one is how
  // invariant 1 gets worked around with junk. They can add it later in one tap.
  const canNext = step === 0 ? name.trim().length > 0
    : step === 1 ? goalTitle.trim().length > 0
    : selling ? sells.trim().length > 0
    : chosen.length > 0;

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await post('/onboard', {
        name, email: email.trim() || undefined, headline, location,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        goal: { title: goalTitle, metric, unit: metric === 'none' ? undefined : unit, target_value: target === '' ? undefined : Number(target), current_value: current === '' ? undefined : Number(current), horizon_days: horizon },
        capacity, notes, intent,
        // Only the selling branch targets local businesses. Sending segments for
        // a job-seeker is what used to spend a paid scrape on nothing.
        target_segments: selling ? segments : '',
        target_area: selling ? area : '',
        offer: selling ? { sells, for_who: forWho, problem, proof_url: proof.trim() || undefined } : {},
        watch: chosen.map((x) => ({ url: x.url, label: x.label, intent: x.intent })),
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
              <h1>One thing to do.<br />Already done.</h1>
              <p className="sub">
                Tell it what you are trying to get to. Every morning it brings back one call — with the
                work attached, not a suggestion — and three days later it tells you whether it was right.
              </p>
              <ol className="cp-intro-steps">
                <li><b>It looks, overnight.</b> Job boards, subcontract channels, local businesses, whatever you point it at. Your goal decides which.</li>
                <li><b>It brings finished work.</b> The drafted message, the listing, the arithmetic — never &ldquo;you should consider&rdquo;.</li>
                <li><b>You decide.</b> Did it, not doing it, or wrong call. Turn something down enough times and it stops being the call.</li>
                <li><b>It marks its own homework.</b> Every call names one number, and it reads that number back three days later.</li>
              </ol>
              <p className="cp-intro-plan">
                Free is {PLANS.free.limits.matchesPerMonth} real matches a month and the whole engine —
                no card, nothing to cancel. <a href={`${shell}/pricing`}>See the plans →</a>
                <br /><a href={`${shell}/privacy`}>Privacy</a> · <a href={`${shell}/terms`}>Terms</a>
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
              <p className="sub">One goal is enough, and this is the important screen — what it looks for, and what it ranks first, both come from here.</p>
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
              <h2>How should it work for you?</h2>
              <p className="sub">Read off your goal. Change it if it guessed wrong — everything below follows from this one choice.</p>
              <div className="cp-field">
                <div className="cp-chips">{WATCH_INTENTS.map((i) => (
                  <button key={i.key} className={`cp-fchip ${intent === i.key ? 'active' : ''}`} onClick={() => setPickedIntent(i.key)}>{i.label}</button>
                ))}</div>
                <div className="cp-help">{WATCH_INTENTS.find((i) => i.key === intent)?.blurb}</div>
              </div>

              {selling && (
                <>
                  <div className="cp-field"><label className="cp-label">I sell / I build</label><input className="cp-input" autoFocus value={sells} onChange={(e) => setSells(e.target.value)} placeholder="WhatsApp booking automations" maxLength={240} /></div>
                  <div className="cp-field"><label className="cp-label">For</label><input className="cp-input" value={forWho} onChange={(e) => setForWho(e.target.value)} placeholder="resorts and tour operators" maxLength={120} /></div>
                  <div className="cp-field"><label className="cp-label">The problem it solves</label><input className="cp-input" value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="enquiries arrive after hours and go unanswered" maxLength={240} /><div className="cp-help">Every drafted message is built from this. Say it the way your customer would feel it.</div></div>
                  <div className="cp-field"><label className="cp-label">One link that proves it (optional)</label><input className="cp-input" type="url" inputMode="url" value={proof} onChange={(e) => setProof(e.target.value)} placeholder="https://…" maxLength={300} /></div>
                </>
              )}

              {intent === 'clients' && (
                <div className="cp-field"><label className="cp-label">If your customers are local, where to look</label>
                  <div className="cp-input-row">
                    <input className="cp-input" value={segments} onChange={(e) => setSegments(e.target.value)} placeholder="resort, dive shop" maxLength={240} />
                    <input className="cp-input" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Palawan" maxLength={80} />
                  </div>
                  <div className="cp-help">Business type and area, searched on Google Maps. Leave both blank if they are not — the sources below cover you either way.</div>
                </div>
              )}

              <div className="cp-field">
                <label className="cp-label">What it reads for you, every night</label>
                <div className="cp-help" style={{ marginTop: 0, marginBottom: 8 }}>
                  Anything worth your morning comes back as one move with the link attached. Tap to drop any of them; you can add your own later.
                </div>
                {starters.map((x) => {
                  const on = !dropped.includes(x.url);
                  return (
                    <button key={x.url} className={`cp-option ${on ? 'active' : ''}`} onClick={() => toggleSource(x.url)}>
                      <div><div className="ct">{x.label}</div><div className="cs">{x.intent}</div></div>
                    </button>
                  );
                })}
              </div>

              <div className="cp-field"><label className="cp-label">Capacity today</label>
                {(Object.keys(CAPACITY_META) as Capacity[]).map((c) => (
                  <button key={c} className={`cp-option ${capacity === c ? 'active' : ''}`} onClick={() => setCapacity(c)}>
                    <div><div className="ct">{CAPACITY_META[c].label}</div><div className="cs">{CAPACITY_META[c].sub}</div></div>
                  </button>
                ))}
              </div>

              <div className="cp-help" style={{ marginBottom: 14 }}>
                You start on Free: {PLANS.free.limits.matchesPerMonth} real matches a month, no card.
                Nothing is sent without you tapping send. <a href={`${shell}/pricing`}>Plans →</a>
                {' · '}<a href={`${shell}/privacy`}>Privacy</a>{' · '}<a href={`${shell}/terms`}>Terms</a>
              </div>
            </>
          )}
        </div>

        <div className="cp-ob-foot">
          {intro && <a className="cp-btn" href={`${shell}/login`} style={{ textDecoration: 'none' }}>Sign in</a>}
          {intro && <button className="cp-btn primary" onClick={() => setIntro(false)}>Start free</button>}
          {!intro && step > 0 && <button className="cp-btn" disabled={busy} onClick={() => setStep((s) => s - 1)}>Back</button>}
          {!intro && step === 0 && <a className="cp-btn" href={`${shell}/login`} style={{ textDecoration: 'none' }}>Sign in</a>}
          {!intro && (step < 2
            ? <button className="cp-btn primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continue</button>
            : <button className="cp-btn primary" disabled={!canNext || busy} onClick={finish}>{busy ? 'Finding matches & building your brief…' : 'Start my copilot'}</button>)}
        </div>
      </div>
    </div>
  );
}
