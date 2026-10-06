'use client';
// Ask your own record — out loud, typed, or tapped — and hear the answer.
//
// What was asked is matched to the list the app can count (lib/copilot/asked.ts):
// by its own rules first, by a model only where there is one and the rules could
// not tell, and a model only ever picks the question. The answer is counted
// here, from the rows the screens count — the home as it is loaded, the Path's
// and Proof's own derivation, the book a month at a time — so what is said back
// is what the Money tab and the Path show. Asked out loud, it is read out loud.
//
// What cannot be counted is said to be so, and goes to a model that reasons:
// the copy for Claude carries the question with the record. Below the asking,
// ask.ts's five, counted over everything, as the sheet always had them.
import { useEffect, useRef, useState } from 'react';
import {
  ASKED, ASKED_CHIPS, answerAsked, matchAsked, monthsOf, spanOf,
  type Answer, type Asked, type AskedId, type AskedInput, type BookMonthIn,
} from '@/lib/copilot/asked';
import type { AskAnswer } from '@/lib/copilot/ask';
import { LINK_LABEL } from '@/lib/copilot/business';
import { passLine, resultLine } from '@/lib/copilot/lab';
import { ASK_LABEL } from '@/lib/copilot/today';
import type { HomeData } from '@/lib/copilot/types';
import { get, post } from './api';
import type { Actions } from './shared';
import { useDerived, type Derived } from './v2/derive';
import { BOOK_VIEW_KEY, local } from './v2/bookLocal';
import { canSpeak, useSpeech } from './v2/Speak';
import { useVoice } from './v2/VoiceLog';
import { IconMic } from './v2/icons2';

const MONEY: AskedId[] = ['spent', 'received', 'safe', 'balance'];
const SERVER: AskedId[] = ['segments', 'drafts', 'calls', 'stood_down', 'worth'];

/** Everything an answer is counted from that the home already holds, read the way the screens read it. */
function homeInput(home: HomeData, d: Derived): AskedInput {
  const lab = d.proof.lab;
  const cur = lab.current;
  const fin = home.profile.finance ?? {};
  return {
    today: home.recent.today,
    timezone: home.profile.timezone,
    now: d.path.now ? { title: d.path.now.title, why: d.path.now.why, size: d.path.now.size } : null,
    asks: d.path.also.map((x) => ({ kind: ASK_LABEL[x.kind], title: x.title })),
    bet: cur ? { belief: cur.bet.belief, part: LINK_LABEL[cur.bet.part], day: cur.day, days: cur.bet.days, result: resultLine(cur), pass: passLine(cur.bet, cur.last) } : null,
    checkpointDue: lab.checkpoint.due,
    goals: d.path.goals.map((g) => ({ title: g.title, status: g.status, horizon: g.horizon, verdict: g.verdict ?? null })),
    outlook: d.path.verdict ? { title: d.path.verdict.title, line: d.path.verdict.line } : null,
    runway: {
      months: home.metrics.runway_months, cash: fin.cash ?? null, outPerMonth: fin.monthly_burn ?? null, currency: fin.currency ?? null,
      cashFrom: fin.source?.cash ?? null, outFrom: fin.source?.monthly_burn ?? null,
    },
    talks: home.lab?.talks ?? [],
    intros: d.proof.intros.map((x) => ({ who: x.talk.who, days: x.days, said: x.talk.said })),
    wins: home.wins ?? [],
    salesCurrency: d.currency,
    sentAt: home.recent.sentAt ?? [],
    replies: home.recent.outcomes.filter((o) => o.kind === 'reply').map((o) => o.occurred_at),
    metrics: { windowDays: home.metrics.window_days, sent: home.metrics.sent, replies: home.metrics.replies },
    focus: home.recent.focus,
    unreadable: [...home.recent.unreadable, ...(home.lab?.unreadable ? [`bets and conversations (${home.lab.unreadable})`] : [])],
  };
}

/** The book's months a question needs, in the currency the Money tab shows; why not, when it cannot be opened. */
async function bookMonths(months: string[]): Promise<BookMonthIn[] | string> {
  const view = local.get(BOOK_VIEW_KEY);
  try {
    const got = await Promise.all(months.map((m) => get<{ book: BookMonthIn }>(`/money/book?month=${m}${view ? `&view=${encodeURIComponent(view)}` : ''}`)));
    return got.map((r) => r.book);
  } catch (e) {
    return e instanceof Error ? e.message : 'Could not open your book.';
  }
}

export default function AskSheet({ home, heard, actions }: { home: HomeData; heard?: string; actions: Actions }) {
  const d = useDerived(home);
  const speech = useSpeech();
  const [q, setQ] = useState(heard ?? '');
  const [asked, setAsked] = useState<Asked | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  /** Why it could not be counted: nothing on the list matched, or the model said why. */
  const [uncounted, setUncounted] = useState<string | null>(null);
  const [busy, setBusy] = useState<'matching' | 'counting' | null>(null);
  const [answers, setAnswers] = useState<AskAnswer[] | null>(null);
  const [answersError, setAnswersError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  // The latest question wins: an answer to an earlier one landing late must not replace it.
  const seq = useRef(0);
  const answersRef = useRef<Promise<AskAnswer[] | string> | null>(null);

  // ask.ts's five: loaded once, both for the list below and for a question that is one of them.
  const loadAnswers = () => {
    answersRef.current ??= actions.askRows().then((r) => (r.ok ? r.answers ?? [] : r.error ?? 'Could not count that'));
    return answersRef.current;
  };
  useEffect(() => {
    let live = true;
    void loadAnswers().then((r) => {
      if (!live) return;
      if (typeof r === 'string') return setAnswersError(r);
      setAnswers(r);
      // Asked something, the list stays shut: the answer is the point. Opened to browse, the first opens itself.
      if (!heard) setOpen(r[0]?.id ?? null);
    });
    return () => { live = false; };
    // actions is rebuilt every render and this is a one-shot load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Counts one matched question from the rows, and says it when it was asked aloud. */
  const count = async (a: Asked, aloud: boolean, mine: number) => {
    setBusy('counting');
    const input = homeInput(home, d);
    if (MONEY.includes(a.id)) {
      const span = a.id === 'spent' || a.id === 'received' ? spanOf(a.period ?? ASKED[a.id].period!, input.today) : { from: input.today, to: input.today };
      input.book = await bookMonths(monthsOf(span));
    }
    if (SERVER.includes(a.id)) input.answers = await loadAnswers();
    if (mine !== seq.current) return;
    const out = answerAsked(a, input);
    setAnswer(out);
    setBusy(null);
    if (aloud && canSpeak()) speech.speak(out.say);
  };

  const ask = async (text: string, how: 'voice' | 'typed' | 'tap', tapped?: AskedId) => {
    const mine = ++seq.current;
    speech.stop();
    setAnswer(null); setUncounted(null); setError(null); setCopied(null);
    const said = text.trim();
    if (!said && !tapped) return;
    let a: Asked | null = tapped ? { id: tapped, period: null, about: null, by: 'tap' } : matchAsked(said);
    if (!a && home.ai) {
      setBusy('matching');
      try {
        const r = await post<{ asked: Asked | null; why: string | null }>('/asked', { heard: said });
        if (mine !== seq.current) return;
        a = r.asked;
        if (!a) setUncounted(r.why ?? 'That is not a question the app can count.');
      } catch (e) {
        if (mine !== seq.current) return;
        setUncounted(`The question could not be worked out: ${e instanceof Error ? e.message : String(e)}.`);
      }
    }
    if (!a) {
      setBusy(null);
      setUncounted((u) => u ?? 'That is not a question the app can count.');
      if (how === 'voice' && canSpeak()) speech.speak('That is not something I can count. Copy it for Claude, below.');
      return;
    }
    setAsked(a);
    await count(a, how === 'voice', mine);
  };

  // Asked into the header's mic: answered as the sheet opens.
  useEffect(() => {
    if (heard) void ask(heard, 'voice');
    // One question, asked once: a new one opens a new sheet (sheetKey).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const voice = useVoice({
    onHeard: (text) => { setQ(text); void ask(text, 'voice'); },
    onFailed: (why) => setError(why),
  });

  const copy = async () => {
    setCopying(true); setCopied(null); setError(null);
    const r = await actions.handoff();
    if (!r.ok || !r.text) { setCopying(false); return setError(r.error ?? 'Could not gather your context'); }
    // The question goes with the record, so one paste asks it.
    const question = q.trim() && !answer ? q.trim() : null;
    const text = question ? `${r.text}\n\nMy question: ${question}` : r.text;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(`${text.length.toLocaleString()} characters copied${question ? ', your question at the end' : ''}. Paste it into anything.`);
    } catch {
      // Clipboard access is refused outright in some embedded browsers, and a
      // button that silently does nothing is the worst outcome — the user pastes
      // stale clipboard content into a model and blames the answer.
      setError('This browser would not let the page write to the clipboard. Open the app in Safari or Chrome directly and try again.');
    }
    setCopying(false);
  };

  return (
    <>
      <h3>Ask your own record</h3>
      <p className="desc">
        Ask out loud, type it, or tap a question. Every answer is counted from rows you made{speech.supported ? ', and read back to you when you ask out loud' : ''}.
      </p>

      <form className="cp-askit-bar" onSubmit={(e) => { e.preventDefault(); void ask(q, 'typed'); }}>
        {voice.supported && (
          <button
            type="button" className={`cp-askit-mic${voice.listening ? ' on' : ''}`} onClick={voice.toggle}
            aria-pressed={voice.listening} aria-label={voice.listening ? 'Stop listening' : 'Ask out loud'}
          >
            <IconMic />
          </button>
        )}
        <input
          className="cp-input sm cp-askit-input" value={voice.listening ? voice.interim : q} onChange={(e) => setQ(e.target.value)}
          placeholder={voice.listening ? 'Listening…' : 'How much did I spend this week?'} aria-label="Your question" maxLength={300}
        />
        <button type="submit" className="cp-btn sm" disabled={!q.trim() || !!busy}>Ask</button>
      </form>
      {error && <div className="cp-note">{error}</div>}

      {busy && <p className="cp-askit-busy">{busy === 'matching' ? 'Working out the question…' : 'Counting…'}</p>}
      {answer && (
        <div className={`cp-askit-answer${answer.thin ? ' thin' : ''}`} aria-live="polite">
          <span className="cp-askit-asked">{answer.asked}{asked?.by === 'model' ? ' · understood by AI' : ''}</span>
          <b className="cp-askit-title">{answer.title}</b>
          {answer.lines.map((l, n) => <span key={n} className="cp-askit-line">{l}</span>)}
          {answer.counted && <span className="cp-askit-counted">{answer.counted}</span>}
          {speech.supported && (
            <button className="cp-btn sm cp-askit-say" onClick={() => (speech.speaking ? speech.stop() : speech.speak(answer.say))}>
              {speech.speaking ? 'Stop' : 'Read it aloud'}
            </button>
          )}
          {speech.error && <span className="cp-askit-line">{speech.error}</span>}
        </div>
      )}
      {uncounted && (
        <div className="cp-askit-answer thin">
          {q.trim() && <span className="cp-askit-asked">“{q.trim()}”</span>}
          <b className="cp-askit-title">{uncounted}</b>
          <span className="cp-askit-line">It answers the questions below by counting. Anything that needs judgement, copy for Claude at the bottom: your question goes with it.</span>
        </div>
      )}

      <p className="cp-label cp-askit-label">Questions it can count</p>
      <div className="cp-askit-chips">
        {ASKED_CHIPS.map((id) => (
          <button key={id} className="cp-askit-chip" disabled={!!busy} onClick={() => { setQ(ASKED[id].q); void ask(ASKED[id].q, 'tap', id); }}>
            {ASKED[id].q}
          </button>
        ))}
      </div>

      <p className="cp-label cp-askit-label">Counted over everything</p>
      {answersError && <div className="cp-note">{answersError}</div>}
      {!answers && !answersError && <p className="desc">Counting…</p>}
      {answers?.map((a) => (
        <div key={a.id}>
          <button className={`cp-option ${open === a.id ? 'active' : ''}`} onClick={() => setOpen(open === a.id ? null : a.id)}>
            <div><div className="ct">{a.q}</div><div className="cs">{a.headline}</div></div>
          </button>
          {open === a.id && (
            <div className="cp-list" style={{ marginTop: 8 }}>
              {a.rows.map((r, n) => (
                <div key={`${a.id}-${n}`} className="cp-ctx">
                  <div><div className="l">{r.label}</div>{r.note && <div className="s">{r.note}</div>}</div>
                  <span className="cp-connect ghost">{r.value}</span>
                </div>
              ))}
              {/* Never an empty card. Three bugs in this codebase shared the shape
                  of a component failing, the failure being swallowed, and the
                  screen reporting calm — a blank answer here would be that
                  shape in the one feature whose job is to tell the truth. */}
              {a.thin && <div className="cp-note">{a.thin}</div>}
            </div>
          )}
        </div>
      ))}

      <div className="cp-section" style={{ marginTop: 16 }}><span className="lead">Anything else</span></div>
      <p className="desc">
        These are what this app can answer by counting. For everything else, take the whole
        record and ask something that can actually reason — your working file, your funnel, every
        call it made and what you did about it, what you have stood down, what is running.
      </p>
      <button className="cp-btn primary block" disabled={copying} onClick={() => void copy()}>
        {copying ? 'Gathering…' : q.trim() && !answer ? 'Copy it with your question' : 'Copy everything it knows'}
      </button>
      {copied && <div className="cp-note">{copied}</div>}
      <p className="cp-help">
        Your rows are yours. If a general model does better with all of this than this app does
        without it, that is worth knowing — and it is the reason this button exists.
      </p>
    </>
  );
}

