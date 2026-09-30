'use client';
// The mic in the header, where the capacity pill was: say a move — "coffee
// 130", "grab 240 yesterday" — and the add sheet opens with it filled in
// (money/spoken.ts reads the words). The pill was a setting read on every
// screen and changed about never; it is in You → Settings. Logging money is
// what this app is opened for several times a day, so that is what the corner
// holds.
//
// The words come from the browser's own speech recognition (the Web Speech
// API; on Android Chrome that is Google's speech service, the one the keyboard's
// mic uses): nothing to pay per minute, no audio sent to a server of ours, and
// only the words reach this app. What it heard
// is shown under the greeting as it hears it, and above the sheet it opens, and
// "Log it" is still a tap — a mishearing is caught on the screen, not in the
// book. Where the browser has no recognition the corner is a plain +.
//
// Every way it can stop is said (invariant 13): a blocked mic, no connection,
// nothing heard. Where the move can still be typed, the sheet opens for it, so
// a failed mic never costs the move.
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconMic } from './icons2';

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognition(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** The phone stops by itself after a pause; this is for one that does not. A mic nobody closed is a mic left open. */
const LISTEN_MS = 12_000;

/** Why it stopped, said so the person knows what to do next; `type` when the sheet should open to type the move instead. */
function failure(code: string, lang: string): { why: string; type: boolean } {
  switch (code) {
    case 'no-speech': return { why: 'Heard nothing. Tap the mic and say it, like “coffee 130”.', type: false };
    case 'aborted': return { why: 'The mic was closed before it heard anything. Tap it to try again.', type: false };
    case 'not-allowed':
    case 'service-not-allowed': return { why: 'The mic is not allowed for this app. Allow it in the browser’s site settings, or type this one.', type: true };
    case 'audio-capture': return { why: 'No mic could be opened. Type this one.', type: true };
    case 'network': return { why: 'Voice needs a connection. Type this one: it is kept on the phone and sent when you are back online.', type: true };
    case 'language-not-supported': return { why: `Voice does not take this phone’s language (${lang}). Type this one.`, type: true };
    default: return { why: `The mic stopped (${code}). Type this one.`, type: true };
  }
}

export interface Voice {
  /** False where the browser has no speech recognition: the button is a + that opens the sheet. */
  supported: boolean;
  listening: boolean;
  /** What it has heard so far. */
  interim: string;
  toggle: () => void;
}

export function useVoice(opts: {
  onStart?: () => void;
  onHeard: (text: string) => void;
  /** `type`: the move can still be typed, so open the sheet for it. */
  onFailed: (why: string, type: boolean) => void;
}): Voice {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const rec = useRef<Recognition | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Known only in the browser: drawn as a mic on the server, and a + a moment later where there is none.
  useEffect(() => {
    setSupported(!!recognition());
    return () => {
      const r = rec.current;
      rec.current = null;
      if (r) { r.onend = null; r.onerror = null; r.onresult = null; r.abort(); }
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = recognition();
    if (!Ctor) {
      setSupported(false);
      optsRef.current.onFailed('This browser does not take voice. Type this one.', true);
      return;
    }
    const r = new Ctor();
    const lang = navigator.language || 'en-US';
    r.lang = lang;
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;
    let text = '';
    let failed: string | null = null;
    r.onresult = (e) => {
      let fin = '';
      let mid = '';
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript; else mid += res[0].transcript;
      }
      text = `${fin} ${mid}`.trim();
      setInterim(text);
    };
    r.onerror = (e) => { failed = e.error || 'unknown'; };
    const timer = window.setTimeout(() => { try { r.stop(); } catch { /* it ended already, and onend has said how */ } }, LISTEN_MS);
    r.onend = () => {
      window.clearTimeout(timer);
      if (rec.current === r) rec.current = null;
      setListening(false);
      setInterim('');
      // Words heard before a pause ran long, or before it was closed, are still what was said.
      if (text && (!failed || failed === 'no-speech' || failed === 'aborted')) { optsRef.current.onHeard(text); return; }
      const f = failure(failed ?? 'no-speech', lang);
      optsRef.current.onFailed(f.why, f.type);
    };
    try {
      r.start();
    } catch (e) {
      window.clearTimeout(timer);
      optsRef.current.onFailed(`The mic could not start: ${e instanceof Error ? e.message : String(e)}. Type this one.`, true);
      return;
    }
    rec.current = r;
    setListening(true);
    optsRef.current.onStart?.();
  }, []);

  /** A second tap stops listening, and what was heard so far is what was said. */
  const toggle = useCallback(() => {
    const r = rec.current;
    if (r) { try { r.stop(); } catch { /* ended already: onend has tidied up */ } return; }
    start();
  }, [start]);

  return { supported, listening, interim, toggle };
}

export function VoiceButton({ voice, onType }: { voice: Voice; onType: () => void }) {
  if (!voice.supported) return <button className="cp2-voice-btn plus" onClick={onType} aria-label="Log a move">+</button>;
  return (
    <button
      className={`cp2-voice-btn${voice.listening ? ' on' : ''}`} onClick={voice.toggle}
      aria-pressed={voice.listening} aria-label={voice.listening ? 'Stop listening' : 'Say a move to log'}
    >
      <IconMic />
    </button>
  );
}

/** Under the greeting while the mic is open: the words as they are heard, so a wrong one is seen while it is said. */
export function VoiceLive({ voice }: { voice: Voice }) {
  return <p className="cp2-voice-live" aria-live="polite">{voice.interim ? `“${voice.interim}”` : 'Listening… say it like “coffee 130”'}</p>;
}
