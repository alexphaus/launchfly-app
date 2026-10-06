'use client';
// Reading an answer aloud, with the phone's own voice (the Web Speech API's
// speechSynthesis): nothing sent anywhere, nothing to pay per word, and on a
// phone that has none the answer is still on the screen. A question asked out
// loud is answered out loud; one typed or tapped waits for the button.
//
// A voice that fails says so on the card (invariant 13): a silent phone after
// "Read it aloud" reads as an app that did nothing.
import { useCallback, useEffect, useRef, useState } from 'react';

export interface Speech {
  /** False where the browser has no voice: the card has no button, and nothing is promised. */
  supported: boolean;
  speaking: boolean;
  /** Why the last answer could not be read aloud. */
  error: string | null;
  speak: (text: string) => void;
  stop: () => void;
}

/**
 * The answers are written in English, so they are read in English: a phone set
 * to Filipino reading an English sentence in a Filipino voice is harder to
 * follow than the screen. Its own English, where it has one.
 */
function speechLang(): string {
  const l = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';
  return /^en\b/i.test(l) ? l : 'en-US';
}

/**
 * Whether this browser has a voice, asked at the moment of speaking. The hook's
 * `supported` is set after the first render, and a question asked into the
 * header's mic is answered in that first render: read from state it was always
 * false, and the spoken question got a silent answer.
 */
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

export function useSpeech(): Speech {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The utterance being read, so an old one ending does not stop the flag for a new one.
  const current = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(canSpeak());
    // A sheet closed mid-sentence stops talking with it.
    return () => { try { window.speechSynthesis?.cancel(); } catch { /* nothing was speaking */ } };
  }, []);

  const stop = useCallback(() => {
    current.current = null;
    try { window.speechSynthesis?.cancel(); } catch { /* nothing was speaking */ }
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') {
      setError('This browser cannot read aloud. The answer is on the screen.');
      return;
    }
    synth.cancel();
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = speechLang();
    current.current = u;
    u.onend = () => { if (current.current === u) { current.current = null; setSpeaking(false); } };
    u.onerror = (e) => {
      if (current.current !== u) return;
      current.current = null;
      setSpeaking(false);
      // Cut off by the next answer or by Stop: not a failure.
      if (e.error !== 'interrupted' && e.error !== 'canceled') setError(`It could not be read aloud (${e.error}). The answer is on the screen.`);
    };
    setError(null);
    setSpeaking(true);
    synth.speak(u);
  }, []);

  return { supported, speaking, error, speak, stop };
}
