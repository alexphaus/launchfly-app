'use client';
// The Log money page (src/app/copilot2/log): the keypad, the balance above it,
// and a way into the Money tab. It stays up after a move, cleared for the next.
// Moves go through the same outbox as the tab (bookLocal.ts), so one logged
// here with no signal is sent from here, or from the tab, whichever opens next.
// The mic is here too (VoiceLog.tsx): what it hears fills the pad in place.
import { useCallback, useEffect, useRef, useState } from 'react';
import { bookMoney } from '@/lib/copilot/money/book';
import { parseSpoken, type SpokenMove } from '@/lib/copilot/money/spoken';
import type { EntryDefault, LogScreenData } from '@/lib/copilot/money/bookstore';
import { post } from '../api';
import { useOutbox } from './bookLocal';
import EntryPad from './EntryPad';
import { UnsentMoves } from './MoneyTab';
import { useVoice, VoiceButton, VoiceLive } from './VoiceLog';

export default function LogScreen({ pid, data, failed }: { pid: string; data: LogScreenData | null; failed: string | null }) {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((m: string) => {
    setToast(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  const [balance, setBalance] = useState(data?.balance ?? null);
  const [safe, setSafe] = useState(data?.safe ?? null);
  // Today as the phone's clock has it in the person's zone: the page may be
  // the copy the phone kept for offline (public/sw.js), drawn on another day.
  const [today, setToday] = useState(data?.today ?? '');
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    try {
      const t = new Intl.DateTimeFormat('en-CA', { timeZone: data?.timezone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      if (/^\d{4}-\d{2}-\d{2}$/.test(t) && t > (data?.today ?? '')) setToday(t);
    } catch { /* a zone the phone does not know: the server's today stands */ }
    const set = () => setOffline(!navigator.onLine);
    set();
    window.addEventListener('online', set);
    window.addEventListener('offline', set);
    return () => { window.removeEventListener('online', set); window.removeEventListener('offline', set); };
  }, [data?.timezone, data?.today]);
  const [entry, setEntry] = useState<EntryDefault>(data?.entry ?? null);
  const outbox = useOutbox(pid, {
    extra: () => ({ reply: 'balance' }),
    onSent: (d) => {
      if (typeof d.balance === 'number') setBalance(d.balance);
      if (d.safe !== undefined) setSafe(d.safe as typeof safe);
    },
    say,
  });

  // A move said: the pad is drawn again from it (its key), since a pad reads what it starts from once.
  const [spoken, setSpoken] = useState<{ n: number; move: SpokenMove } | null>(null);
  const voice = useVoice({
    onHeard: (text) => { if (data) setSpoken({ n: Date.now(), move: parseSpoken(text, { categories: data.categories, today: today || data.today }) }); },
    // The pad is already on the page: saying why is all there is to do.
    onFailed: (why) => say(why),
  });
  const logging = !failed && !!data?.ready && !!data.started;

  const onEntry = useCallback(async (code: string): Promise<EntryDefault | undefined> => {
    try {
      const r = await post<{ entry: EntryDefault }>('/money/book', { action: 'entry', currency: code });
      setEntry(r.entry);
      return r.entry;
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not keep that currency.');
      return undefined;
    }
  }, [say]);

  return (
    <div className="cp-frame cp2-frame cp2-log">
      <header className="cp-header">
        <div>
          <h1>Log money</h1>
          {voice.listening
            ? <VoiceLive voice={voice} />
            : data?.started && balance != null && <p>{offline ? 'Offline · ' : ''}{bookMoney(balance, data.currency)} in your book{offline ? ' when last online' : ''}</p>}
        </div>
        <div className="cp-header-right">
          {/* Without recognition there is no + here: the pad is the page. */}
          {logging && voice.supported && <VoiceButton voice={voice} onType={() => undefined} />}
          <a className="cp-capacity" href="/copilot2?tab=money">Money tab</a>
        </div>
      </header>
      <main className="cp-content cp2-log-main">
        {failed || !data ? (
          <div className="cp-card cp2-bk-msg">
            <div className="cp-error">{failed ?? 'Could not open your book.'}</div>
            <button className="cp-btn" onClick={() => window.location.reload()}>Try again</button>
          </div>
        ) : !data.ready ? (
          <div className="cp-card cp2-bk-msg"><p>{data.notReady}</p></div>
        ) : !data.started ? (
          <div className="cp-card cp2-bk-msg">
            <h2 className="cp2-bk-h">Start your money book first</h2>
            <p>Say what you have on the Money tab once. Every move you log here counts from it.</p>
            <a className="cp-btn primary" href="/copilot2?tab=money">Open the Money tab</a>
          </div>
        ) : (
          <>
            <UnsentMoves list={outbox.unsent} sending={outbox.sending} onRetry={() => void outbox.flush()} onRemove={outbox.remove} />
            <EntryPad
              key={spoken?.n ?? 0}
              spoken={spoken?.move}
              variant="page"
              currency={data.currency}
              entry={entry}
              onEntry={onEntry}
              enteredReady={data.enteredReady}
              safe={safe}
              categories={data.categories}
              today={today || data.today}
              onSubmit={(body, said) => outbox.log(body, said)}
            />
          </>
        )}
      </main>
      {toast && <div className="cp-toast" role="status">{toast}</div>}
    </div>
  );
}
