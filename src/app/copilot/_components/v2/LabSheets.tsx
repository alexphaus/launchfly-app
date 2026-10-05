'use client';
// The bets' sheets: start a bet, log a conversation, and the conversations in
// full. They were the Lab's; Proof (ProofTab.tsx) is the screen now, and
// lib/copilot/lab.ts has the rules.
//
// A bet is written here and nowhere else, and only before it starts. The line
// it has to reach, what it counts and its last day are said back in one
// sentence before the button — the pass line — because a line set after the
// result is in is not a test, it is a description.
import { useState } from 'react';
import { LINK_KEYS, LINK_LABEL, type LinkKey } from '@/lib/copilot/business';
import { shiftDay } from '@/lib/copilot/focus';
import {
  BELIEF_MAX, COMMITMENTS, COMMITMENT_LABEL, DEFAULT_BET_DAYS, METRIC, PLANNED_MAX, PLAY_BY_KEY, PROBLEMS, PROBLEM_LABEL,
  SAID_MAX, TALK_BACK_DAYS, TARGET_MAX, TRIES_FOR, UNIT_MAX, WHO_MAX,
  betPrice, countedFrom, dayWords, metricWords, metricsFor, passLine, playFor, spanWords, suggestBelief, talkCounts,
  type Commitment, type LabMetric, type Problem, type Talk,
} from '@/lib/copilot/lab';
import { salesCurrency } from '@/lib/copilot/metrics';
import { FOUND_BY_LABEL } from '@/lib/copilot/offer';
import { foundOf } from '@/lib/copilot/proof';
import { whenLabel } from '@/lib/copilot/review';
import type { FoundBy, HomeData } from '@/lib/copilot/types';
import type { Actions, BetFromExperiment } from '../shared';

/** A custom bet's first count, by the part it is about: the number that part lives or dies by. */
const PART_METRIC: Record<LinkKey, LabMetric> = { who: 'committed', reach: 'replied', close: 'meetings', pay: 'paid_at_price', deliver: 'handed' };

/** How long a bet can run, in the words a person plans in. A play's own length joins them when it is none of these. */
const DAY_CHOICES = [2, 7, 10, 14, 21, 30];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Today", "Yesterday", "Mon" within the week, a date beyond it — a weekday a month back names the wrong one. */
export function talkDay(on: string, today: string): string {
  const back = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${on}T00:00:00Z`)) / 86_400_000);
  return back < 7 ? cap(whenLabel(on, today)) : dayWords(on);
}

/** How a conversation ended, as a row says it: "Nothing" is a chip's answer and reads as a shrug on a row. */
const ENDED: Record<Commitment, string> = { none: 'No commitment', time: 'Another call', intro: 'An intro', money: 'Money' };
/** The chips answer a question the row does not repeat, so the row says what it is about. */
const HAS: Record<Problem, string> = { yes: 'Has the problem', no: 'Does not have the problem', unasked: 'The problem did not come up' };

export function TalkRow({ talk: t, today, onForget }: { talk: Talk; today: string; onForget?: () => void }) {
  return (
    <div className="cp2-lab-talk">
      <div className="cp2-lab-talk-top">
        <b className="cp2-clamp1">{t.who || 'Someone'}</b>
        <span className="cp2-lab-talk-when">{talkDay(t.on, today)}</span>
        <span className={`cp2-lab-ended-as ${t.commitment}`}>{ENDED[t.commitment]}</span>
        {onForget && <button className="cp2-x" onClick={onForget} aria-label={`Remove the conversation with ${t.who || 'someone'}, ${talkDay(t.on, today)}`}>×</button>}
      </div>
      <span className="cp2-lab-talk-s">{HAS[t.problem]}</span>
      {t.said && <p className="cp2-lab-said">&ldquo;{t.said}&rdquo;</p>}
    </div>
  );
}

/** A count with a minus and a plus. Past ten a step is five: nobody plans 37 sends one tap at a time. */
export function Count({ value, min, max, onChange, label, coarse }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string; coarse?: boolean }) {
  const down = coarse && value > 10 ? 5 : 1;
  const up = coarse && value >= 10 ? 5 : 1;
  return (
    <span className="cp2-lab-count" role="group" aria-label={label}>
      <button type="button" aria-label={`Fewer: ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - down))}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={`More: ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + up))}>+</button>
    </span>
  );
}

/* ─── Start a bet ─────────────────────────────────────────────────────────── */

/**
 * The count a bet on each way buyers arrive is decided by, when the app cannot
 * see them arrive: the person's own word for it, which they can change.
 */
const UNIT_FOR: Record<FoundBy, string> = { outreach: 'bookings', inbound: 'enquiries', referrals: 'introductions', marketplace: 'enquiries', local: 'walk-ins' };

/**
 * A bet, written before it starts: from a play in the catalogue, an idea a
 * model wrote (looked up by its key among the ideas on hand), the plan's
 * experiment, or from scratch on a part. A play or an idea fixes what it
 * counts; the line, the plan and the length are still the person's to set.
 */
export function BetSheet({ home, playKey, part: asked, ideaKey, experiment, actions }: {
  home: HomeData; playKey?: string; part?: LinkKey; ideaKey?: string; experiment?: BetFromExperiment; actions: Actions;
}) {
  const found = foundOf(home).value;
  const catalogue = playKey ? PLAY_BY_KEY.get(playKey) ?? null : null;
  const play = catalogue ? playFor(catalogue, found) : null;
  const idea = !play && ideaKey && asked ? home.lab?.ideas?.[asked]?.ideas.find((x) => x.key === ideaKey) ?? null : null;
  // What the bet starts from, when it starts from something that fixes the count.
  const fixed = play ?? idea;
  const today = home.recent.today;
  const offer = home.profile.offer ?? {};
  const { price, priceLabel } = betPrice(offer.price_band, salesCurrency(home.profile.finance, home.goals));
  const allowed = metricsFor(found);
  /** A custom bet's first count, by the part: the number that part lives or dies by, among the ones this business can keep. */
  const firstMetric = (k: LinkKey): LabMetric => {
    const m = PART_METRIC[k] === 'paid_at_price' && price == null ? 'paid' : PART_METRIC[k];
    return allowed.includes(m) ? m : 'logged';
  };
  const first: LinkKey = fixed?.part ?? experiment?.part ?? asked ?? 'who';
  const [part, setPart] = useState<LinkKey>(first);
  // A first draft from the offer, for the person to make theirs. Rewritten
  // with the part until they type in it; never after.
  const [belief, setBelief] = useState(() => suggestBelief(first, offer, priceLabel, found));
  const [typed, setTyped] = useState(false);
  const [metric, setMetric] = useState<LabMetric>(fixed?.metric ?? firstMetric(first));
  const [unit, setUnit] = useState(fixed?.unit ?? (found ? UNIT_FOR[found] : 'sign-ups'));
  const [target, setTarget] = useState(fixed?.target ?? 2);
  const [tries, setTries] = useState<{ metric: LabMetric; planned: number } | null>(fixed?.tries ?? null);
  const [days, setDays] = useState(fixed?.days ?? experiment?.days ?? DEFAULT_BET_DAYS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const running = home.lab?.bets.find((b) => b.state === 'running') ?? null;
  const needsPrice = !!METRIC[metric].priced && price == null;
  const needsUnit = metric === 'logged' && !unit.trim();
  const dayChoices = [...new Set([...DAY_CHOICES, fixed?.days ?? experiment?.days ?? DEFAULT_BET_DAYS])].sort((a, b) => a - b);
  const triesFor = TRIES_FOR[metric].filter((m) => allowed.includes(m));
  const shownUnit = metric === 'logged' ? unit.trim() || null : null;

  const pickPart = (k: LinkKey) => {
    setPart(k);
    if (!typed) setBelief(suggestBelief(k, offer, priceLabel, found));
    if (!fixed) pickMetric(firstMetric(k));
  };
  const pickMetric = (m: LabMetric) => {
    setMetric(m);
    // What it takes has to be the step before it; one that no longer is, goes.
    if (tries && !TRIES_FOR[m].includes(tries.metric)) setTries(null);
  };
  const start = async () => {
    setBusy(true); setError(null);
    // Where the play came from, kept on the bet: a play the catalogue does not
    // hold is said by its own words, so the bet can say what it ran.
    const from = idea
      ? { label: idea.label, how: idea.how, from: idea.book ? `AI, after ${idea.book}` : 'AI, from your record', prep: idea.prep }
      : experiment ? { label: experiment.title, how: experiment.test, from: 'Your plan' } : null;
    const r = await actions.lab({
      action: 'open',
      bet: { part, belief: belief.trim(), play: play?.key ?? null, idea: from, metric, unit: shownUnit, target, tries, days, experiment: experiment?.id ?? null },
    });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'Could not start it');
    actions.closeSheet();
  };

  return (
    <>
      {play && <div className="cp2-lab-sheet-book">{play.book}</div>}
      {idea && <div className="cp2-lab-sheet-book">By AI{idea.book ? ` · after ${idea.book}` : ', from your record'}</div>}
      {experiment && <div className="cp2-lab-sheet-book">From your plan</div>}
      <h3>{play?.label ?? idea?.label ?? experiment?.title ?? 'Your own bet'}</h3>
      <p className="desc">
        {play?.how ?? idea?.how ?? (experiment
          ? `${experiment.test} It worked if: ${experiment.watch.replace(/[.!?\s]+$/, '')}. As a bet, the rows judge it instead of a tap, and the plan hears the verdict.`
          : 'A belief, a count that could prove it wrong, and a day. Written before it starts, so the result cannot move the line.')}
      </p>

      {!fixed && (
        <div className="cp-field">
          <label className="cp-label">Which part of the business</label>
          <div className="cp-chips">
            {LINK_KEYS.map((k) => (
              <button key={k} className={`cp-fchip ${part === k ? 'active' : ''}`} aria-pressed={part === k} onClick={() => pickPart(k)}>{LINK_LABEL[k]}</button>
            ))}
          </div>
        </div>
      )}

      <div className="cp-field">
        <label className="cp-label" htmlFor="cp2-lab-belief">What you believe</label>
        <textarea
          id="cp2-lab-belief" className="cp-input sm cp2-lab-belief-in" rows={2} maxLength={BELIEF_MAX} value={belief}
          onChange={(e) => { setBelief(e.target.value); setTyped(true); }}
        />
        <p className="cp-help">In your words, one sentence the count below could prove wrong.</p>
      </div>

      {!fixed && (
        <div className="cp-field">
          <label className="cp-label">What decides it</label>
          <div className="cp-chips">
            {allowed.map((m) => (
              <button key={m} className={`cp-fchip ${metric === m ? 'active' : ''}`} aria-pressed={metric === m} onClick={() => pickMetric(m)}>
                {m === 'logged' ? 'Something you count' : cap(metricWords(m, 2, priceLabel))}
              </button>
            ))}
          </div>
          {/* Where buyers do not come through the app's sends, its sends cannot decide anything: said, not hidden. */}
          {found && found !== 'outreach' && <p className="cp-help">Sends and replies are left out: buyers find you {FOUND_BY_LABEL[found].toLowerCase()}, not through what the app sends.</p>}
        </div>
      )}

      {metric === 'logged' && (
        <div className="cp-field">
          <label className="cp-label" htmlFor="cp2-lab-unit">What you will count</label>
          <input id="cp2-lab-unit" className="cp-input sm" value={unit} maxLength={UNIT_MAX} onChange={(e) => setUnit(e.target.value)} placeholder="sign-ups" />
          <p className="cp-help">A word or two, plural: sign-ups, enquiries, orders, walk-ins. You log them as they come in.</p>
        </div>
      )}

      <div className="cp-field">
        <label className="cp-label">The line it has to reach</label>
        <div className="cp2-lab-countrow">
          <Count value={target} min={1} max={TARGET_MAX} onChange={setTarget} label={metricWords(metric, 2, priceLabel, shownUnit)} />
          <span>{metricWords(metric, target, priceLabel, shownUnit)}</span>
        </div>
      </div>

      {triesFor.length > 0 && (
        <div className="cp-field">
          <label className="cp-label">From how many — optional</label>
          <div className="cp-chips">
            <button className={`cp-fchip ${!tries ? 'active' : ''}`} aria-pressed={!tries} onClick={() => setTries(null)}>No plan</button>
            {triesFor.map((m) => (
              <button
                key={m} className={`cp-fchip ${tries?.metric === m ? 'active' : ''}`} aria-pressed={tries?.metric === m}
                onClick={() => setTries({ metric: m, planned: tries?.planned ?? 10 })}
              >{cap(metricWords(m, 2))}</button>
            ))}
          </div>
          {tries && (
            <div className="cp2-lab-countrow">
              <Count value={tries.planned} min={1} max={PLANNED_MAX} coarse onChange={(n) => setTries({ ...tries, planned: n })} label={metricWords(tries.metric, 2)} />
              <span>{metricWords(tries.metric, tries.planned)}</span>
            </div>
          )}
        </div>
      )}

      <div className="cp-field">
        <label className="cp-label">How long</label>
        <div className="cp-chips">
          {dayChoices.map((n) => (
            <button key={n} className={`cp-fchip ${days === n ? 'active' : ''}`} aria-pressed={days === n} onClick={() => setDays(n)}>{spanWords(n)}</button>
          ))}
        </div>
      </div>

      <div className="cp2-lab-preview">
        <span className="cp2-lab-preview-k">Pass line</span>
        <b>{passLine({ metric, target, tries, priceLabel, unit: shownUnit }, shiftDay(today, days - 1))}</b>
        <span className="cp2-lab-preview-s">{countedFrom(metric, today, priceLabel, shownUnit)}</span>
      </div>

      {/* Said before the tap, with the way to fix it, rather than refused after it. */}
      {needsPrice && (
        <div className="cp-note cp2-lab-warn">
          A sale at your price needs a price, and your offer does not name one.{' '}
          <button className="cp2-link" onClick={() => actions.openSheet({ kind: 'offer' })}>Say what it costs</button>
        </div>
      )}
      {running && (
        <div className="cp-note cp2-lab-warn">
          One bet at a time: &ldquo;{running.bet.belief}&rdquo; runs until {dayWords(running.last)}. Let it finish, or call it off on Proof, first — two at once would share every count.
        </div>
      )}
      {error && <div className="cp-error">{error}</div>}

      <button className="cp-btn primary block" disabled={busy || !belief.trim() || needsPrice || needsUnit || !!running} onClick={() => void start()}>
        {busy ? 'Starting…' : 'Start the bet'}
      </button>
      <p className="cp-help">Only what happens from today counts. Nobody marks it passed: it passes when the count reaches the line.</p>
    </>
  );
}

/* ─── Log a conversation ──────────────────────────────────────────────────── */

export function TalkSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const today = home.recent.today;
  const yesterday = shiftDay(today, -1);
  const [who, setWho] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [said, setSaid] = useState('');
  const [on, setOn] = useState(today);
  const [other, setOther] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logged, setLogged] = useState(0);

  const save = async () => {
    if (!commitment) return;
    setBusy(true); setError(null);
    const r = await actions.lab({
      action: 'talk',
      talk: { on, who: who.trim() || undefined, problem: problem ?? 'unasked', commitment, said: said.trim() || undefined },
    });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'Could not log that');
    // Kept open, on the same day: a week of calls is usually logged in one sitting.
    setWho(''); setProblem(null); setCommitment(null); setSaid(''); setLogged((n) => n + 1);
  };

  return (
    <>
      <h3>Log a conversation</h3>
      <p className="desc">
        One conversation with someone who could buy. The app cannot hear your calls, so this is your count, kept apart from the ones it takes itself.
      </p>

      <div className="cp-field">
        <label className="cp-label" htmlFor="cp2-lab-who">Who — optional</label>
        <input id="cp2-lab-who" className="cp-input sm" value={who} maxLength={WHO_MAX} onChange={(e) => setWho(e.target.value)} placeholder="Maria, Sunrise Dental" />
      </div>

      <div className="cp-field">
        <label className="cp-label">Do they have the problem?</label>
        <div className="cp-chips">
          {PROBLEMS.map((p) => (
            <button key={p} className={`cp-fchip ${problem === p ? 'active' : ''}`} aria-pressed={problem === p} onClick={() => setProblem(problem === p ? null : p)}>{PROBLEM_LABEL[p]}</button>
          ))}
        </div>
      </div>

      <div className="cp-field">
        <label className="cp-label">How did it end?</label>
        <div className="cp-chips">
          {COMMITMENTS.map((c) => (
            <button key={c} className={`cp-fchip ${commitment === c ? 'active' : ''}`} aria-pressed={commitment === c} onClick={() => setCommitment(c)}>{COMMITMENT_LABEL[c]}</button>
          ))}
        </div>
        <p className="cp-help">A compliment is Nothing. Another call, an intro or money is a commitment, the only result The Mom Test counts.</p>
      </div>

      <div className="cp-field">
        <label className="cp-label" htmlFor="cp2-lab-said">Their words — optional</label>
        <textarea id="cp2-lab-said" className="cp-input sm cp2-lab-belief-in" rows={2} maxLength={SAID_MAX} value={said} onChange={(e) => setSaid(e.target.value)} placeholder="We lose two bookings a week to missed calls" />
        <p className="cp-help">Worth keeping word for word: it is the best first line a message ever gets.</p>
      </div>

      <div className="cp-field">
        <label className="cp-label">When</label>
        <div className="cp-chips">
          <button className={`cp-fchip ${!other && on === today ? 'active' : ''}`} onClick={() => { setOther(false); setOn(today); }}>Today</button>
          <button className={`cp-fchip ${!other && on === yesterday ? 'active' : ''}`} onClick={() => { setOther(false); setOn(yesterday); }}>Yesterday</button>
          <button className={`cp-fchip ${other ? 'active' : ''}`} onClick={() => { setOther(true); if (on >= yesterday) setOn(shiftDay(today, -2)); }}>Earlier</button>
        </div>
        {other && (
          <input
            type="date" className="cp-input sm cp2-lab-date" aria-label="The day it happened"
            value={on} min={shiftDay(today, -TALK_BACK_DAYS)} max={today} onChange={(e) => e.target.value && setOn(e.target.value)}
          />
        )}
      </div>

      {error && <div className="cp-error">{error}</div>}
      {logged > 0 && !error && <p className="cp-help">{logged === 1 ? 'Logged.' : `${logged} logged.`} Add the next, or Done.</p>}
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy || !commitment} onClick={() => void save()}>{busy ? 'Logging…' : commitment ? 'Log it' : 'Say how it ended'}</button>
        <button className="cp-btn" onClick={actions.closeSheet}>Done</button>
      </div>
    </>
  );
}

/* ─── All of them ─────────────────────────────────────────────────────────── */

export function TalksSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const talks = home.lab?.talks ?? [];
  const today = home.recent.today;
  const c = talkCounts(talks, today);
  const [error, setError] = useState<string | null>(null);
  const forget = async (id: string) => {
    setError(null);
    const r = await actions.lab({ action: 'forget', id });
    if (!r.ok) setError(r.error ?? 'Could not remove that');
  };
  return (
    <>
      <h3>Conversations</h3>
      <p className="desc">
        {c.n
          ? `${c.n} in the last ${TALK_BACK_DAYS} days: ${c.committed} ended in a commitment, ${c.have} had the problem.`
          : `None in the last ${TALK_BACK_DAYS} days.`}
        {' '}Yours, as you logged them — the app counts none of these itself.
      </p>
      <button className="cp-btn primary block" onClick={() => actions.openSheet({ kind: 'talk' })}>Log a conversation</button>
      {error && <div className="cp-error">{error}</div>}
      {talks.length > 0 && (
        <div className="cp2-lab-talklist">
          {talks.map((t) => <TalkRow key={t.id} talk={t} today={today} onForget={() => void forget(t.id)} />)}
        </div>
      )}
    </>
  );
}
