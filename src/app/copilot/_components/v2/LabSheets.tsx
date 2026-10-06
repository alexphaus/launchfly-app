'use client';
// The bets' sheets: start a bet, log a conversation, follow up an
// introduction, and the conversations in full. They were the Lab's; Proof
// (ProofTab.tsx) is the screen now, and lib/copilot/lab.ts has the rules.
//
// A bet is written here and nowhere else, and only before it starts. The line
// it has to reach, what it counts and its last day are said back in one
// sentence before the button — the pass line — because a line set after the
// result is in is not a test, it is a description.
import { useState } from 'react';
import { LINK_KEYS, LINK_LABEL, type LinkKey } from '@/lib/copilot/business';
import { shiftDay } from '@/lib/copilot/focus';
import {
  BELIEF_MAX, COMMITMENTS, COMMITMENT_LABEL, DEFAULT_BET_DAYS, INTRO_DAYS, INTRO_LINK_DAYS, INTRO_STATE_LABEL, METRIC, PLANNED_MAX, PLAY_BY_KEY, PROBLEMS, PROBLEM_LABEL,
  SAID_MAX, TALK_BACK_DAYS, TALK_ROLES, TALK_ROLE_LABEL, TARGET_MAX, TRIES_FOR, UNIT_MAX, WHO_MAX,
  asksProblem, betPrice, countedFrom, dayWords, daysBetween, introSources, introState, metricWords, metricsFor, passLine, playFor, roleOf, spanWords,
  suggestBelief, talkCounts,
  type Commitment, type IntroClose, type IntroOutcome, type LabMetric, type Problem, type Talk, type TalkRole,
} from '@/lib/copilot/lab';
import { salesCurrency } from '@/lib/copilot/metrics';
import { FOUND_BY_LABEL } from '@/lib/copilot/offer';
import { foundOf } from '@/lib/copilot/proof';
import { whenLabel } from '@/lib/copilot/review';
import { beliefOfSeed, hostOf, ideaOfSeed, plainLines, type Seed } from '@/lib/copilot/seed';
import { derive } from './derive';
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

/** The record a conversation is read against: the others (who introduced whom) and how each introduction went. */
interface TalkRecord { talks: Talk[]; intros: Record<string, IntroClose> | undefined }

/**
 * One conversation: who, when, how it ended, who they were to the business,
 * and — where somebody opened the door — who did. An introduction offered in it
 * says where it stands, and is the way into it.
 */
export function TalkRow({ talk: t, today, record, onForget, onIntro }: {
  talk: Talk; today: string; record: TalkRecord; onForget?: () => void; onIntro?: () => void;
}) {
  const role = roleOf(t);
  const from = t.via ? record.talks.find((x) => x.id === t.via) ?? null : null;
  const intro = introState(t, record.talks, record.intros, today);
  const line = [
    TALK_ROLE_LABEL[role],
    asksProblem(role) ? HAS[t.problem] : null,
    from ? (from.who ? `Introduced by ${from.who}` : 'Through an introduction') : null,
  ].filter(Boolean).join(' · ');
  return (
    <div className="cp2-lab-talk">
      <div className="cp2-lab-talk-top">
        <b className="cp2-clamp1">{t.who || 'Someone'}</b>
        <span className="cp2-lab-talk-when">{talkDay(t.on, today)}</span>
        <span className={`cp2-lab-ended-as ${t.commitment}`}>{ENDED[t.commitment]}</span>
        {onForget && <button className="cp2-x" onClick={onForget} aria-label={`Remove the conversation with ${t.who || 'someone'}, ${talkDay(t.on, today)}`}>×</button>}
      </div>
      <span className="cp2-lab-talk-s">{line}</span>
      {t.said && <p className="cp2-lab-said">&ldquo;{t.said}&rdquo;</p>}
      {intro && (
        onIntro
          ? <button className={`cp2-pf-introst ${intro}`} onClick={onIntro}>{INTRO_STATE_LABEL[intro]} →</button>
          : <span className={`cp2-pf-introst ${intro}`}>{INTRO_STATE_LABEL[intro]}</span>
      )}
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
 * experiment, words shared from another app, or from scratch on a part. A play
 * or an idea fixes what it counts; the line, the plan and the length are still
 * the person's to set.
 *
 * Words shared in (seed.ts) are the play, never the belief: they ride along as
 * what to do, and the belief is the person's — prefilled only when the whole
 * share is one sentence that fits, so a chat's reply is never what they said.
 *
 * Any of them can be kept for later instead of started, and a kept test opens
 * here again as it was kept — its belief, its count, its line — to be started
 * or taken off the shelf. A test is kept only from this sheet, so every entry has
 * the person's own belief and a line they set before it: no test, no entry.
 */
export function BetSheet({ home, playKey, part: asked, ideaKey, experiment, seed, shelfId, actions }: {
  home: HomeData; playKey?: string; part?: LinkKey; ideaKey?: string; experiment?: BetFromExperiment; seed?: Seed; shelfId?: string; actions: Actions;
}) {
  const found = foundOf(home).value;
  const shelved = shelfId ? home.lab?.shelf?.find((e) => e.id === shelfId) ?? null : null;
  const catalogue = playKey ?? shelved?.play ? PLAY_BY_KEY.get((playKey ?? shelved?.play)!) ?? null : null;
  const play = catalogue ? playFor(catalogue, found) : null;
  const idea = !play && ideaKey && asked ? home.lab?.ideas?.[asked]?.ideas.find((x) => x.key === ideaKey) ?? null : null;
  // What the bet starts from, when it starts from something that fixes the count.
  const fixed = play ?? idea;
  // A play a model or a share wrote, kept with its words, and what a kept test starts from: as it was kept.
  const keptIdea = shelved && !play ? shelved.idea : null;
  const basis = shelved ?? fixed;
  const today = home.recent.today;
  const offer = home.profile.offer ?? {};
  const { price, priceLabel } = betPrice(offer.price_band, salesCurrency(home.profile.finance, home.goals));
  const allowed = metricsFor(found);
  /** A custom bet's first count, by the part: the number that part lives or dies by, among the ones this business can keep. */
  const firstMetric = (k: LinkKey): LabMetric => {
    const m = PART_METRIC[k] === 'paid_at_price' && price == null ? 'paid' : PART_METRIC[k];
    return allowed.includes(m) ? m : 'logged';
  };
  // Words shared in start on the weak link, as the picker on Proof does: the sheet is not told which part they are about.
  const sharedPart = seed && !asked && !shelved && !experiment ? derive(home).proof.chain.weak : null;
  const first: LinkKey = basis?.part ?? experiment?.part ?? asked ?? sharedPart ?? 'who';
  const [part, setPart] = useState<LinkKey>(first);
  // A first draft from the offer, for the person to make theirs. Rewritten
  // with the part until they type in it; never after. Words they shared are
  // theirs already: a draft written from the offer would put other words in
  // their mouth, so the field holds the share or nothing.
  const [belief, setBelief] = useState(() => (shelved ? shelved.belief : seed ? beliefOfSeed(seed) : suggestBelief(first, offer, priceLabel, found)));
  const [typed, setTyped] = useState(!!seed || !!shelved);
  const [metric, setMetric] = useState<LabMetric>(basis?.metric ?? firstMetric(first));
  const [unit, setUnit] = useState(basis?.unit ?? (found ? UNIT_FOR[found] : 'sign-ups'));
  const [target, setTarget] = useState(basis?.target ?? 2);
  const [tries, setTries] = useState<{ metric: LabMetric; planned: number } | null>(basis?.tries ?? null);
  const [days, setDays] = useState(basis?.days ?? experiment?.days ?? DEFAULT_BET_DAYS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const running = home.lab?.bets.find((b) => b.state === 'running') ?? null;
  const needsPrice = !!METRIC[metric].priced && price == null;
  const needsUnit = metric === 'logged' && !unit.trim();
  const dayChoices = [...new Set([...DAY_CHOICES, basis?.days ?? experiment?.days ?? DEFAULT_BET_DAYS])].sort((a, b) => a - b);
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
  // Where the play came from, kept on the bet: a play the catalogue does not
  // hold is said by its own words, so the bet can say what it ran.
  const playFrom = () => (idea
    ? { label: idea.label, how: idea.how, from: idea.book ? `AI, after ${idea.book}` : 'AI, from your record', prep: idea.prep }
    : experiment ? { label: experiment.title, how: experiment.test, from: 'Your plan' } : seed ? ideaOfSeed(seed) : keptIdea);
  const start = async () => {
    setBusy(true); setError(null);
    const r = await actions.lab({
      action: 'open',
      bet: { part, belief: belief.trim(), play: play?.key ?? null, idea: playFrom(), metric, unit: shownUnit, target, tries, days, experiment: experiment?.id ?? null, shelf: shelved?.id ?? null },
    });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'Could not start it');
    actions.closeSheet();
  };
  // Kept, not started: the same test, held to the same rules, with nothing counting until it is started.
  const keep = async () => {
    setBusy(true); setError(null);
    const r = await actions.lab({
      action: 'shelve',
      bet: { part, belief: belief.trim(), play: play?.key ?? null, idea: playFrom(), metric, unit: shownUnit, target, tries, days },
    });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'Could not keep it');
    actions.closeSheet();
  };

  return (
    <>
      {play && <div className="cp2-lab-sheet-book">{play.book}</div>}
      {idea && <div className="cp2-lab-sheet-book">By AI{idea.book ? ` · after ${idea.book}` : ', from your record'}</div>}
      {experiment && <div className="cp2-lab-sheet-book">From your plan</div>}
      {seed && <div className="cp2-lab-sheet-book">From another app</div>}
      {keptIdea && <div className="cp2-lab-sheet-book">{keptIdea.from}</div>}
      {shelved && !play && !keptIdea && <div className="cp2-lab-sheet-book">From your shelf</div>}
      <h3>{play?.label ?? idea?.label ?? keptIdea?.label ?? experiment?.title ?? (seed ? 'An idea you shared' : shelved ? 'A test you kept' : 'Your own bet')}</h3>
      <p className="desc">
        {play?.how ?? idea?.how ?? keptIdea?.how ?? (experiment
          ? `${experiment.test} It worked if: ${experiment.watch.replace(/[.!?\s]+$/, '')}. As a bet, the rows judge it instead of a tap, and the plan hears the verdict.`
          : seed
          ? 'Say what you believe, pick the count that would show it, and set the line. Nothing starts until you tap.'
          : 'A belief, a count that could prove it wrong, and a day. Written before it starts, so the result cannot move the line.')}
      </p>
      {seed && <SharedWords seed={seed} />}

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
          placeholder={seed ? 'What would have to be true for this to work?' : undefined}
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
      {/* The plan's experiment already waits in the plan, and a kept test already waits on the shelf: neither needs keeping twice. */}
      {!experiment && !shelved && (
        <>
          <button className="cp-btn block cp2-lab-keep" disabled={busy || !belief.trim() || needsPrice || needsUnit} onClick={() => void keep()}>
            Keep for later
          </button>
          <p className="cp-help">Kept as written, on your shelf. Nothing counts until you start it, and one bet runs at a time.</p>
        </>
      )}
      <p className="cp-help">Only what happens from today counts. Nobody marks it passed: it passes when the count reaches the line.</p>
    </>
  );
}

/**
 * What was shared, above the belief it is meant to inform: read-only and said to
 * be the source, so the words in the field below are the person's and these are
 * what a bet will carry as its play. A reply long enough to be cut says it was.
 */
function SharedWords({ seed }: { seed: Seed }) {
  const lines = plainLines(seed.text);
  return (
    <div className="cp2-seed">
      <span className="cp2-seed-k">What you shared</span>
      {lines.length > 0 && <p className="cp2-seed-text">{lines.join('\n')}</p>}
      {seed.url && <a className="cp2-seed-link" href={seed.url} target="_blank" rel="noopener noreferrer">{hostOf(seed.url)}</a>}
      <p className="cp-help">
        It stays with the bet as the play. Your belief is the box below, in your words.
        {seed.cut ? ' It was long, so only the first part was read.' : ''}
      </p>
    </div>
  );
}

/* ─── Log a conversation ──────────────────────────────────────────────────── */

/**
 * One conversation, logged the day it happens. Who they were is a tap, and
 * defaults to a buyer, because that is what most are and what every one was
 * before there was a choice. `via` opens it as the conversation an
 * introduction led to; any introduction on record can be picked here too.
 */
export function TalkSheet({ home, via: viaAsked, actions }: { home: HomeData; via?: string; actions: Actions }) {
  const today = home.recent.today;
  const yesterday = shiftDay(today, -1);
  const record: TalkRecord = { talks: home.lab?.talks ?? [], intros: home.lab?.intros };
  const [who, setWho] = useState('');
  const [role, setRole] = useState<TalkRole>('buyer');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [said, setSaid] = useState('');
  const [on, setOn] = useState(today);
  const [other, setOther] = useState(false);
  const [via, setVia] = useState<string | null>(viaAsked ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logged, setLogged] = useState(0);

  // The introductions this conversation could have come through, for its day:
  // moved to a day before the one picked, the pick no longer applies, and the
  // chips say so by showing none chosen. The one the sheet was opened for
  // leads, so six newer ones cannot push it off.
  const possible = introSources(record.talks, record.intros, on);
  const sources = [...possible.filter((t) => t.id === viaAsked), ...possible.filter((t) => t.id !== viaAsked)].slice(0, 6);
  const through = via && sources.some((t) => t.id === via) ? via : null;
  const opened = viaAsked ? record.talks.find((t) => t.id === viaAsked) ?? null : null;

  const save = async () => {
    if (!commitment) return;
    setBusy(true); setError(null);
    const r = await actions.lab({
      action: 'talk',
      talk: {
        on, who: who.trim() || undefined, role, problem: asksProblem(role) ? problem ?? 'unasked' : 'unasked', commitment,
        said: said.trim() || undefined, via: through ?? undefined,
      },
    });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'Could not log that');
    // Kept open, on the same day: a week of calls is usually logged in one sitting.
    setWho(''); setRole('buyer'); setProblem(null); setCommitment(null); setSaid(''); setVia(null); setLogged((n) => n + 1);
  };

  return (
    <>
      {/* Said while it is the pick: tapped "No", or logged and reset for the next, it is just a log. */}
      {opened && through === opened.id && <div className="cp2-lab-sheet-book">Through {opened.who ? `${opened.who}’s` : 'an'} introduction</div>}
      <h3>Log a conversation</h3>
      <p className="desc">
        One conversation, with someone who could buy or someone close to the money. The app cannot hear your calls, so this is your count, kept apart from the ones it takes itself.
      </p>

      <div className="cp-field">
        <label className="cp-label" htmlFor="cp2-lab-who">Who — optional</label>
        <input id="cp2-lab-who" className="cp-input sm" value={who} maxLength={WHO_MAX} onChange={(e) => setWho(e.target.value)} placeholder="Maria, Sunrise Dental" />
      </div>

      <div className="cp-field">
        <label className="cp-label">Who they were</label>
        <div className="cp-chips">
          {TALK_ROLES.map((r) => (
            <button key={r} className={`cp-fchip ${role === r ? 'active' : ''}`} aria-pressed={role === r} onClick={() => setRole(r)}>{TALK_ROLE_LABEL[r]}</button>
          ))}
        </div>
        <p className="cp-help">Only &ldquo;Could buy&rdquo; counts toward who buys. The rest know what a buyer will not tell a stranger.</p>
      </div>

      {sources.length > 0 && (
        <div className="cp-field">
          <label className="cp-label">Came through an introduction?</label>
          <div className="cp-chips">
            <button className={`cp-fchip ${!through ? 'active' : ''}`} aria-pressed={!through} onClick={() => setVia(null)}>No</button>
            {sources.map((t) => (
              <button key={t.id} className={`cp-fchip ${through === t.id ? 'active' : ''}`} aria-pressed={through === t.id} onClick={() => setVia(t.id)}>
                {t.who || 'Someone'} · {dayWords(t.on)}
              </button>
            ))}
          </div>
        </div>
      )}

      {asksProblem(role) && (
        <div className="cp-field">
          <label className="cp-label">Do they have the problem?</label>
          <div className="cp-chips">
            {PROBLEMS.map((p) => (
              <button key={p} className={`cp-fchip ${problem === p ? 'active' : ''}`} aria-pressed={problem === p} onClick={() => setProblem(problem === p ? null : p)}>{PROBLEM_LABEL[p]}</button>
            ))}
          </div>
        </div>
      )}

      <div className="cp-field">
        <label className="cp-label">How did it end?</label>
        <div className="cp-chips">
          {COMMITMENTS.map((c) => (
            <button key={c} className={`cp-fchip ${commitment === c ? 'active' : ''}`} aria-pressed={commitment === c} onClick={() => setCommitment(c)}>{COMMITMENT_LABEL[c]}</button>
          ))}
        </div>
        <p className="cp-help">
          {commitment === 'intro'
            ? `It waits on your Path${on === today ? ' from tomorrow' : ''} until you follow it up.`
            : 'A compliment is Nothing. Another call, an intro or money is a commitment, the only result The Mom Test counts.'}
        </p>
      </div>

      <div className="cp-field">
        <label className="cp-label" htmlFor="cp2-lab-said">Their words — optional</label>
        <textarea id="cp2-lab-said" className="cp-input sm cp2-lab-belief-in" rows={2} maxLength={SAID_MAX} value={said} onChange={(e) => setSaid(e.target.value)} placeholder="We lose two bookings a week to missed calls" />
        {/* Said only where a model is on the server: a promise about AI with no model behind it is invariant 7's. */}
        <p className="cp-help">
          {home.ai
            ? 'Word for word. The ideas and drafts AI writes for you start from them, and it is the best first line a message ever gets.'
            : 'Worth keeping word for word: it is the best first line a message ever gets.'}
        </p>
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

/* ─── An introduction ─────────────────────────────────────────────────────── */

/**
 * An introduction somebody offered: what they said, and the three ways it can
 * go. Logging the conversation it led to closes it by itself; "I asked for it"
 * takes it off the Path while the other side does their part; "It fell
 * through" closes it for good. Whether it happened is never asked after the
 * fact — a conversation logged through it is the answer.
 */
export function IntroSheet({ home, talkId, actions }: { home: HomeData; talkId: string; actions: Actions }) {
  const today = home.recent.today;
  const record: TalkRecord = { talks: home.lab?.talks ?? [], intros: home.lab?.intros };
  const [busy, setBusy] = useState<IntroOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = record.talks.find((x) => x.id === talkId) ?? null;
  if (!t || t.commitment !== 'intro') {
    return (
      <>
        <h3>That introduction is gone</h3>
        <p className="desc">The conversation it was offered in is no longer in your log. It may have been removed.</p>
      </>
    );
  }
  const state = introState(t, record.talks, record.intros, today) ?? 'open';
  const led = record.talks.filter((x) => x.via === t.id);
  // Past INTRO_LINK_DAYS no conversation can say it came through it, so the
  // sheet does not offer to log one.
  const linkable = daysBetween(t.on, today) <= INTRO_LINK_DAYS && state !== 'dropped';
  const close = async (outcome: IntroOutcome) => {
    setBusy(outcome); setError(null);
    const r = await actions.lab({ action: 'intro', intro: { talk: t.id, outcome } });
    setBusy(null);
    if (!r.ok) return setError(r.error ?? 'Could not save that');
    actions.closeSheet();
  };
  const said: Record<typeof state, string> = {
    open: 'Ask for it before they forget offering: one line on who you want to meet and why, written so they can forward it as it stands.',
    asked: 'You asked for it. Log the conversation when it happens, or say it fell through.',
    led: `It led to ${led.length === 1 ? 'a conversation' : `${led.length} conversations`}: ${led.map((x) => x.who || 'someone').join(', ')}.`,
    dropped: 'It fell through.',
    lapsed: `Offered more than ${INTRO_DAYS} days ago and never followed up, so it has left your Path.${linkable ? ' A conversation through it can still be logged.' : ''}`,
  };
  return (
    <>
      <div className="cp2-lab-sheet-book">Offered {offeredWhen(t.on, today)} · {TALK_ROLE_LABEL[roleOf(t)]}</div>
      <h3>{t.who ? `The intro ${t.who} offered` : 'An intro you were offered'}</h3>
      {t.said && <p className="cp2-lab-said cp2-pf-introsaid">&ldquo;{t.said}&rdquo;</p>}
      <p className="desc">{said[state]}</p>
      {error && <div className="cp-error">{error}</div>}
      {linkable && (
        <button className="cp-btn primary block" disabled={busy !== null} onClick={() => actions.openSheet({ kind: 'talk', via: t.id })}>
          {state === 'led' ? 'Log another it led to' : 'Log the conversation it led to'}
        </button>
      )}
      {(state === 'open' || state === 'asked' || state === 'lapsed') && (
        <div className="cp-btn-row">
          {state === 'open' && <button className="cp-btn" disabled={busy !== null} onClick={() => void close('asked')}>{busy === 'asked' ? 'Saving…' : 'I asked for it'}</button>}
          <button className="cp-btn" disabled={busy !== null} onClick={() => void close('dropped')}>{busy === 'dropped' ? 'Saving…' : 'It fell through'}</button>
        </div>
      )}
      {linkable && <p className="cp-help">A conversation logged through it closes it here, and keeps who opened the door.</p>}
    </>
  );
}

/** "today", "yesterday", "on Mon", "on 2 Oct": after "Offered". */
function offeredWhen(on: string, today: string): string {
  const d = talkDay(on, today);
  return d === 'Today' || d === 'Yesterday' ? d.toLowerCase() : `on ${d}`;
}

/* ─── All of them ─────────────────────────────────────────────────────────── */

export function TalksSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const talks = home.lab?.talks ?? [];
  const record: TalkRecord = { talks, intros: home.lab?.intros };
  const today = home.recent.today;
  const c = talkCounts(talks, today);
  const [error, setError] = useState<string | null>(null);
  const forget = async (id: string) => {
    setError(null);
    const r = await actions.lab({ action: 'forget', id });
    if (!r.ok) setError(r.error ?? 'Could not remove that');
  };
  // Every one of the month's could buy: the people around the money are the
  // ones not yet heard, and the play that is a bet on hearing them is a tap away.
  const onlyBuyers = c.n >= 2 && c.by.buyer === c.n;
  const betRunning = !!home.lab?.bets.some((b) => b.state === 'running');
  return (
    <>
      <h3>Conversations</h3>
      <p className="desc">
        {c.n
          ? `${c.n} in the last ${TALK_BACK_DAYS} days: ${c.committed} ended in a commitment, ${c.have} had the problem${c.introduced ? `, ${c.introduced} came through an introduction` : ''}.`
          : `None in the last ${TALK_BACK_DAYS} days.`}
        {' '}Yours, as you logged them — the app counts none of these itself.
      </p>
      {c.n > 0 && (
        <div className="cp2-pf-who" role="list" aria-label={`Who they were, the last ${TALK_BACK_DAYS} days`}>
          {TALK_ROLES.map((r) => (
            <span key={r} role="listitem" className={`cp2-pf-who-cell${c.by[r] ? '' : ' none'}`}>
              <b>{c.by[r]}</b><span>{TALK_ROLE_LABEL[r]}</span>
            </span>
          ))}
        </div>
      )}
      {onlyBuyers && (
        <p className="cp-help cp2-pf-whohelp">
          All with people who could buy. Who sells to them, runs the work or already earns in it knows what a buyer will not say.
          {!betRunning && <>{' '}<button className="cp2-link" onClick={() => actions.openSheet({ kind: 'bet', play: 'money-five' })}>Bet on five of them</button></>}
        </p>
      )}
      <button className="cp-btn primary block" onClick={() => actions.openSheet({ kind: 'talk' })}>Log a conversation</button>
      {error && <div className="cp-error">{error}</div>}
      {talks.length > 0 && (
        <div className="cp2-lab-talklist">
          {talks.map((t) => (
            <TalkRow
              key={t.id} talk={t} today={today} record={record} onForget={() => void forget(t.id)}
              onIntro={t.commitment === 'intro' ? () => actions.openSheet({ kind: 'intro', talk: t.id }) : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
}
