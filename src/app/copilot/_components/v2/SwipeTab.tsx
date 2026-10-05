'use client';
// Swipe: the matches one at a time, the whole screen each, with the message
// already written on the card. Right sends it; left is not for me.
//
// lib/copilot/deck.ts says why a deck works here when the first one did not:
// "yes" is the send itself, not a draft to go and send later. This file is the
// hand on it.
//
//   - The card carries everything the old Matches list sent its owner away to
//     open ("little info on each card, then open it"): the photo, what the
//     place is and where, every reason it was picked, the post itself for a
//     find, and how they can actually be reached. It reaches to the foot of the
//     screen, the buttons and the nav frosted over it, and reads like a
//     profile: up and down scrolls it, sideways moves the card.
//   - The message is written for the card before it is shown — the card on
//     screen and the next two — so by the time a thumb reaches one it is there.
//     One the model did not write says who did, and why.
//   - Right is the send: from the person's own number or address when they
//     connected one; otherwise their own WhatsApp, texts, phone or mail opens
//     with it in, and the deck asks whether it went when they are back. A reply
//     to a post is copied and the post opened.
//   - Left is not for me, and can be taken back until the next card is
//     answered. The star is later: to the back of the pile.
//   - Every gesture is a button too (triage.ts: a deck answerable only by
//     dragging is unusable one-handed or with assistive tech).
//
// The deck keeps its own order for the session, so a home refresh behind it —
// asked for once, after the last swipe in a burst — never reshuffles the card
// under the thumb.
//
// This tab replaced Matches. What the list did that a deck does not — who is
// waiting, who replied, the drafts as a list with a way to clear them — is the
// outreach sheet (Outreach.tsx), one tap from the top of the deck.
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { VIA_LABEL, deckCards, reachLink, type DeckCard, type DeckDraft, type DeckReach, type ReachVia } from '@/lib/copilot/deck';
import { outreachLine, tintOf } from '@/lib/copilot/matches';
import { PLANS } from '@/lib/copilot/plans';
import type { HomeData } from '@/lib/copilot/types';
import { api } from '../api';
import type { Actions, SheetState } from '../shared';
import { useShell } from '../shell';
import { local } from './bookLocal';
import type { Derived } from './derive';
import { IconChevron, IconCross, IconExternal, IconPhone, IconSend, IconStar, IconUndo, MatchGlyph } from './icons2';

/** The card on screen and this many after it have their message written ahead. */
const PREFETCH = 2;
/** "Not for me" can be taken back until the next card is answered, or this long. */
const UNDO_MS = 8_000;
/** After the last swipe in a burst, the rest of the app reads the account once. */
const REFRESH_AFTER_MS = 3_000;
/** How far a card is dragged before letting go answers it. */
const SWIPE_PX = 100;
/** A flick: let go moving at least this fast (px/ms) after at least 30px. Gesture libraries settle near 0.3–0.5. */
const FLICK = 0.4;
/** Degrees of tilt per pixel dragged, about the card's centre. */
const TILT = 1 / 18;
/** How much of the thumb's up-and-down the card follows mid-swipe: some, so it is held, not on a rail. */
const FOLLOW_Y = 0.3;
/** The spring back when a drag is let go short. */
const SETTLE_MS = 280;
/** Small controls on the card stay controls: a drag never starts on them. */
const NO_DRAG = 'a, textarea, input, select, .cp2-swp-vias, .cp2-swp-meta, .cp2-swp-msg.err, .cp2-swp-more';
/** Messages the model wrote are kept on this phone this long, so a reload does not write them again. */
const DRAFT_CACHE_MS = 3 * 86_400_000;
const DRAFT_CACHE_MAX = 120;

type DraftState =
  | { state: 'loading' }
  | ({ state: 'ready' } & DeckDraft)
  | { state: 'error'; error: string };

interface Pending {
  card: DeckCard;
  via: ReachVia;
  body: string;
  subject: string | null;
  link: string | null;
  /** The draft it became; none for a post or a website. */
  reach: Promise<DeckReach> | null;
  /** Said on the question: why their number did not send it, why it did not save. */
  error: string | null;
  busy: boolean;
  /** For a post or a site: whether the reply made it to the clipboard. */
  copied: boolean | null;
  /** False when their own number was to send it and did not: nothing has opened yet, so sending it is the first thing offered. */
  opened: boolean;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** A sentence ending in a name that ends in a full stop: "Infinity Pest Control Ents.", not "Ents..". */
const said = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
const post = <T,>(body: Record<string, unknown>, keepalive = false) =>
  api<T>('/deck', { method: 'POST', body: JSON.stringify(body), keepalive });

/* ─── Messages kept on the phone ──────────────────────────────────────────── */

type Cached = DeckDraft & { at: number; sig: string };
const cacheKey = (pid: string) => `cp2.swipe.drafts.${pid}`;

function readDraftCache(pid: string, sig: string): Record<string, Cached> {
  try {
    const raw = JSON.parse(local.get(cacheKey(pid)) ?? '{}') as Record<string, Cached>;
    const now = Date.now();
    // Written from another offer is written from nothing the person says now.
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => v && typeof v.body === 'string' && v.sig === sig && now - v.at < DRAFT_CACHE_MS));
  } catch { return {}; }
}

function writeDraftCache(pid: string, sig: string, key: string, d: DeckDraft): void {
  const all = readDraftCache(pid, sig);
  all[key] = { ...d, at: Date.now(), sig };
  const kept = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, DRAFT_CACHE_MAX);
  local.set(cacheKey(pid), JSON.stringify(Object.fromEntries(kept)));
}

/* ─── The tab ─────────────────────────────────────────────────────────────── */

export default function SwipeTab({ home, d, actions, finding, say, refresh }: {
  home: HomeData; d: Derived; actions: Actions; finding: boolean; say: (m: string) => void; refresh: () => Promise<void>;
}) {
  const shell = useShell();
  const pid = home.profile.id;
  const offerSig = useMemo(() => JSON.stringify(home.profile.offer ?? {}), [home.profile.offer]);
  const cards = useMemo(() => deckCards({
    now: d.now, today: home.recent.today, items: d.good, toSend: d.stages.to_send, queue: home.queue, pipeline: home.pipeline, moves: home.moves,
  }), [d, home]);

  // The session's pile: its order, and every card it has dealt, kept even once
  // a refresh no longer returns it (the one on screen, one being asked about).
  const store = useRef(new Map<string, DeckCard>());
  const [order, setOrder] = useState<string[]>([]);
  const [gone, setGoneState] = useState<Set<string>>(() => new Set());
  const goneRef = useRef(gone);
  goneRef.current = gone;
  // What was answered this session is remembered on the phone too: the tab is
  // unmounted by a trip to another tab, and the home it comes back to can be a few
  // seconds older than the answers — a card skipped on the way out is not dealt
  // again while the refresh behind it lands.
  const goneKey = `cp2.swipe.gone.${pid}`;
  useEffect(() => {
    try {
      const raw = JSON.parse(window.sessionStorage.getItem(goneKey) ?? 'null') as { day: string; keys: string[] } | null;
      if (raw && raw.day === home.recent.today && Array.isArray(raw.keys)) setGoneState(new Set(raw.keys));
    } catch { /* nothing kept: the server's answers are the record */ }
  }, [goneKey, home.recent.today]);
  const setGone = (f: (g: Set<string>) => Set<string>) => setGoneState((g) => {
    const n = f(g);
    try { window.sessionStorage.setItem(goneKey, JSON.stringify({ day: home.recent.today, keys: [...n].slice(-200) })); } catch { /* on screen only */ }
    return n;
  });
  const orderRef = useRef(order);
  orderRef.current = order;
  useEffect(() => {
    const before = new Map(store.current);
    for (const c of cards) store.current.set(c.key, c);
    const prev = orderRef.current;
    const live = new Set(cards.map((c) => c.key));
    const known = new Set(prev);
    const next = [...prev];
    const added: string[] = [];
    const swaps: Array<[string, string]> = [];
    for (const c of cards) {
      if (known.has(c.key)) continue;
      // A business swiped right this session comes back from the server as a
      // draft in To send. It is the same person: while still in the pile (it
      // did not go, and was put back) the draft takes its place, keeping the
      // way picked and the words typed; once answered, it is not dealt again.
      const was = c.kind === 'draft' && c.oppId ? prev.find((k) => k !== c.key && before.get(k)?.oppId === c.oppId) : undefined;
      if (was) {
        if (!goneRef.current.has(was)) { next[next.indexOf(was)] = c.key; swaps.push([was, c.key]); }
        continue;
      }
      added.push(c.key);
    }
    const showing = next.find((k) => !goneRef.current.has(k));
    setOrder([...next.filter((k) => live.has(k) || k === showing), ...added]);
    if (!swaps.length) return;
    const move = <T,>(m: Record<string, T>): Record<string, T> => {
      const out = { ...m };
      for (const [from, to] of swaps) {
        for (const key of Object.keys(m)) {
          if (key === from || key.startsWith(`${from}|`)) { out[to + key.slice(from.length)] = m[key]; delete out[key]; }
        }
      }
      return out;
    };
    setViaOf(move); setHint(move); setEdits(move); setDrafts(move);
  }, [cards]);

  const live = order.filter((k) => !gone.has(k) && store.current.has(k));
  const current = live[0] ? store.current.get(live[0]) ?? null : null;
  const next = live[1] ? store.current.get(live[1]) ?? null : null;

  const [viaOf, setViaOf] = useState<Record<string, ReachVia>>({});
  const viaFor = useCallback((c: DeckCard): ReachVia | null => viaOf[c.key] ?? c.reach[0]?.via ?? null, [viaOf]);
  const [hint, setHint] = useState<Record<string, string>>({});

  /* The messages */
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const [edits, setEdits] = useState<Record<string, string>>({});
  const dk = (c: DeckCard, v: ReachVia) => `${c.key}|${v}`;

  const loadDraft = useCallback(async (c: DeckCard, v: ReachVia, force = false) => {
    const k = `${c.key}|${v}`;
    const have = draftsRef.current[k];
    if (!force && have && have.state !== 'error') return;
    if (!force) {
      const cached = readDraftCache(pid, offerSig)[k];
      if (cached) { setDrafts((m) => ({ ...m, [k]: { state: 'ready', body: cached.body, subject: cached.subject, from: cached.from, note: cached.note } })); return; }
    }
    setDrafts((m) => ({ ...m, [k]: { state: 'loading' } }));
    try {
      const r = await post<{ draft: DeckDraft }>({ action: 'draft', kind: c.kind, id: c.id, via: v });
      setDrafts((m) => ({ ...m, [k]: { state: 'ready', ...r.draft } }));
      if (r.draft.from === 'model') writeDraftCache(pid, offerSig, k, r.draft);
    } catch (e) {
      setDrafts((m) => ({ ...m, [k]: { state: 'error', error: msg(e) } }));
    }
  }, [pid, offerSig]);

  const ahead = live.slice(0, 1 + PREFETCH).join(',');
  useEffect(() => {
    if (d.noOffer) return;
    for (const k of ahead.split(',').filter(Boolean)) {
      const c = store.current.get(k);
      const v = c ? viaFor(c) : null;
      if (c && v) void loadDraft(c, v);
    }
  }, [ahead, viaFor, loadDraft, d.noOffer]);

  /* Refresh the rest of the app once a burst of swipes is over */
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settle = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refresh().catch((e: unknown) => say(`Saved, but the other tabs did not update: ${msg(e)}`));
    }, REFRESH_AFTER_MS);
  }, [refresh, say]);

  /* Leaving cards: the one answered flies off while the next is already there */
  const cardRef = useRef<HTMLDivElement | null>(null);
  const underRef = useRef<HTMLDivElement | null>(null);
  const ghostsRef = useRef<HTMLDivElement | null>(null);
  /** Where the drag last put the card, so it leaves from there, at the speed it was thrown. */
  const heldRef = useRef({ dx: 0, dy: 0, vx: 0 });
  /**
   * The card answered flies off from where the thumb let it go, looking as it
   * did: a copy of the card itself, scrolled to where it was being read, so a
   * message checked at the foot of the card does not jump back to the photo on
   * its way out. React deals the next card the same frame; the copy lives in a
   * box React renders empty and never touches, and removes itself.
   */
  const leave = (dir: 'left' | 'right' | 'up') => {
    const el = cardRef.current;
    const box = ghostsRef.current;
    const held = heldRef.current;
    heldRef.current = { dx: 0, dy: 0, vx: 0 };
    // The card underneath is the same element React deals next (one key), so
    // it keeps the size the drag had brought it to: let it finish growing.
    const u = underRef.current;
    if (u) { u.style.transition = 'transform .22s ease-out, opacity .22s ease-out'; u.style.transform = ''; u.style.opacity = ''; }
    if (!el || !box || typeof el.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ghost = el.cloneNode(true) as HTMLDivElement;
    ghost.classList.add('cp2-swp-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('inert', '');
    ghost.style.transition = 'none';
    // A button press leaves with its answer stamped on, as a drag would have.
    if (dir !== 'up') ghost.style.setProperty(dir === 'right' ? '--cp2-swp-yes' : '--cp2-swp-no', '1');
    box.appendChild(ghost);
    const read = el.querySelector('.cp2-swp-scroll');
    const copy = ghost.querySelector('.cp2-swp-scroll');
    if (read && copy) copy.scrollTop = read.scrollTop;
    const from = el.style.transform || 'translate3d(0, 0, 0)';
    const w = box.clientWidth || 400;
    const side = dir === 'right' ? 1 : -1;
    const to = dir === 'up'
      ? 'translate3d(0, -105%, 0) scale(0.92)'
      : `translate3d(${side * w * 1.4}px, ${held.dy + 40}px, 0) rotate(${side * 22}deg)`;
    // Thrown hard, it goes as fast as it was thrown; let go from a slow drag, at a pace the eye follows.
    const left = Math.max(0, w * 1.4 - Math.abs(held.dx));
    const ms = Math.abs(held.vx) > FLICK ? Math.max(160, Math.min(320, left / Math.abs(held.vx))) : 320;
    const anim = ghost.animate(
      [{ transform: from, opacity: 1 }, { transform: to, opacity: dir === 'up' ? 0 : 0.85 }],
      { duration: ms, easing: 'cubic-bezier(.25,.6,.45,1)', fill: 'forwards' },
    );
    const done = () => ghost.remove();
    anim.onfinish = done;
    anim.oncancel = done;
  };
  const markGone = (key: string) => setGone((g) => new Set(g).add(key));
  const redeal = (key: string, where: 'front' | 'back') => {
    setGone((g) => { const n = new Set(g); n.delete(key); return n; });
    setOrder((o) => (where === 'front' ? [key, ...o.filter((k) => k !== key)] : [...o.filter((k) => k !== key), key]));
  };

  // The session's count — the number this tab is judged by (sends, not swipes)
  // — kept for the day on this phone, so going to another tab and back does
  // not start it again from nothing.
  const statsKey = `cp2.swipe.stats.${pid}`;
  const [stats, setStatsState] = useState<{ sent: number; skipped: number }>({ sent: 0, skipped: 0 });
  useEffect(() => {
    try {
      const raw = JSON.parse(window.sessionStorage.getItem(statsKey) ?? 'null') as { sent: number; skipped: number; day: string } | null;
      if (raw && raw.day === home.recent.today) setStatsState({ sent: raw.sent, skipped: raw.skipped });
    } catch { /* a phone that keeps nothing starts at nothing */ }
  }, [statsKey, home.recent.today]);
  const setStats = (f: (s: { sent: number; skipped: number }) => { sent: number; skipped: number }) => setStatsState((s) => {
    const n = f(s);
    try { window.sessionStorage.setItem(statsKey, JSON.stringify({ ...n, day: home.recent.today })); } catch { /* kept on screen only */ }
    return n;
  });

  /* Not for me, with a way back */
  const [skipping, setSkipping] = useState<{ card: DeckCard; timer: ReturnType<typeof setTimeout> } | null>(null);
  const skippingRef = useRef(skipping);
  skippingRef.current = skipping;
  const commitSkip = useCallback((card: DeckCard, keepalive = false) => {
    post({ action: 'skip', kind: card.kind, id: card.id }, keepalive)
      .then(() => settle())
      .catch((e: unknown) => {
        say(`“Not for me” on ${card.title} did not save: ${msg(e)}`);
        setGone((g) => { const n = new Set(g); n.delete(card.key); return n; });
      });
  }, [say, settle]);
  const flushSkip = () => {
    const s = skippingRef.current;
    if (!s) return;
    clearTimeout(s.timer);
    setSkipping(null);
    commitSkip(s.card);
  };
  // Leaving the tab with a "not for me" still in its window saves it on the way out.
  useEffect(() => () => {
    const s = skippingRef.current;
    if (s) { clearTimeout(s.timer); commitSkip(s.card, true); }
  }, [commitSkip]);

  /* Did it go? */
  const [pending, setPending] = useState<Pending | null>(null);

  const [editing, setEditing] = useState<string | null>(null);

  const goLeft = (card: DeckCard) => {
    if (pending) return;
    flushSkip();
    leave('left');
    markGone(card.key);
    setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
    const timer = setTimeout(() => {
      setSkipping((cur) => (cur?.card.key === card.key ? null : cur));
      commitSkip(card);
    }, UNDO_MS);
    setSkipping({ card, timer });
  };

  const undo = () => {
    const s = skippingRef.current;
    if (!s) return;
    clearTimeout(s.timer);
    setSkipping(null);
    redeal(s.card.key, 'front');
    setStats((st) => ({ ...st, skipped: Math.max(0, st.skipped - 1) }));
  };

  const goLater = (card: DeckCard) => {
    if (pending) return;
    flushSkip();
    leave('up');
    setOrder((o) => [...o.filter((k) => k !== card.key), card.key]);
  };

  /** Right. Returns false when there is nothing to send yet, and the card springs back. */
  const goRight = (card: DeckCard): boolean => {
    if (pending) return false;
    const v = viaFor(card);
    if (!v) {
      // A find with nothing to reply on: right keeps it, as Keep did on the list.
      flushSkip();
      leave('right');
      markGone(card.key);
      post({ action: 'posted', kind: card.kind, id: card.id, via: 'post' })
        .then(() => { settle(); say('Kept.'); })
        .catch((e: unknown) => { say(`Not kept: ${msg(e)}`); redeal(card.key, 'front'); });
      return true;
    }
    const k = dk(card, v);
    const dr = drafts[k];
    const body = (edits[k] ?? (dr?.state === 'ready' ? dr.body : '')).trim();
    if (!body) {
      say(edits[k] !== undefined ? 'The message is empty — write it, or tap Rewrite.'
        : dr?.state === 'error' ? 'This one has no message yet — tap Try again on it.' : 'Still writing this one — a second.');
      return false;
    }
    const subject = dr?.state === 'ready' ? dr.subject : null;
    const reach = card.reach.find((r) => r.via === v);
    if (!reach) return false;
    const owned = card.kind !== 'find' && ((v === 'whatsapp' && home.channels.whatsapp) || (v === 'email' && home.channels.email));
    const records = card.kind !== 'find' && v !== 'site';
    const reachCall = () => post<{ reach: DeckReach }>({ action: 'reach', kind: card.kind, id: card.id, via: v, body, subject }, true).then((r) => r.reach);
    flushSkip();

    if (owned) {
      leave('right');
      markGone(card.key);
      reachCall()
        .then((r) => {
          if (r.mode === 'sent') {
            setStats((s) => ({ ...s, sent: s.sent + 1 }));
            say(said(`Sent from your ${v === 'email' ? 'address' : 'number'} to ${card.title}`));
            settle();
            return;
          }
          // Their number did not send it. Said, and their own app is still the way.
          setPending({ card, via: v, body, subject, link: r.link, reach: Promise.resolve(r), error: r.error ?? null, busy: false, copied: null, opened: false });
        })
        .catch((e: unknown) => { say(`Not sent: ${msg(e)}`); redeal(card.key, 'front'); });
      return true;
    }

    // Their own app. The copy and the open happen inside the gesture — a phone
    // allows neither after a wait — and the record is sent with keepalive, so it
    // survives the page going to the background as WhatsApp opens.
    const link = reachLink(reach, { body, subject });
    let copied: Promise<boolean> | null = null;
    if (v === 'post' || v === 'site') {
      copied = navigator.clipboard?.writeText ? navigator.clipboard.writeText(body).then(() => true, () => false) : Promise.resolve(false);
    }
    if (link) openLink(link);
    leave('right');
    markGone(card.key);
    const reachP = records ? reachCall() : null;
    reachP?.catch(() => { /* said on the question, where it can be retried */ });
    setPending({ card, via: v, body, subject, link, reach: reachP, error: null, busy: false, copied: null, opened: true });
    if (copied) void copied.then((ok) => setPending((p) => (p && p.card.key === card.key ? { ...p, copied: ok } : p)));
    return true;
  };

  const confirmWent = async () => {
    const p = pending;
    if (!p) return;
    setPending({ ...p, busy: true, error: null });
    try {
      if (!p.reach) {
        await post({ action: 'posted', kind: p.card.kind, id: p.card.id, via: p.via });
      } else {
        const r = await p.reach;
        if (!r.actionId) throw new Error('The draft was not saved, so there is nothing to mark sent.');
        await post({ action: 'sent', id: r.actionId, via: p.via, body: p.body, subject: p.subject });
      }
      setPending(null);
      setStats((s) => ({ ...s, sent: s.sent + 1 }));
      say(p.via === 'call' ? said(`Logged the call to ${p.card.title}`) : p.reach ? said(`Logged as sent to ${p.card.title}`) : 'Logged. It is in your record.');
      settle();
    } catch (e) {
      setPending({ ...p, busy: false, error: `Not saved: ${msg(e)}` });
    }
  };

  const retryReach = () => {
    const p = pending;
    if (!p) return;
    const again = post<{ reach: DeckReach }>({ action: 'reach', kind: p.card.kind, id: p.card.id, via: p.via, body: p.body, subject: p.subject }).then((r) => r.reach);
    again.catch(() => {});
    setPending({ ...p, reach: again, error: null });
  };

  const confirmNot = async () => {
    const p = pending;
    if (!p) return;
    setPending(null);
    let actionId: string | null = null;
    try { actionId = p.reach ? (await p.reach).actionId : null; } catch { /* nothing was saved to take back */ }
    if (actionId) post({ action: 'unsent', id: actionId }).catch((e: unknown) => say(`Could not clear it: ${msg(e)}`));
    // Not on WhatsApp is the usual reason a message to a Maps number does not
    // go: the same number is offered the next way, on the same card, at once.
    const nextVia = p.via === 'whatsapp' ? p.card.reach.find((r) => r.via === 'sms' || r.via === 'call')?.via : undefined;
    if (nextVia) {
      setViaOf((m) => ({ ...m, [p.card.key]: nextVia }));
      setHint((m) => ({ ...m, [p.card.key]: `Not on WhatsApp? ${nextVia === 'sms' ? 'Text' : 'Call'} the same number.` }));
      redeal(p.card.key, 'front');
    } else {
      redeal(p.card.key, 'back');
      say('Put back — it comes round again after the rest.');
    }
    settle();
  };

  /* Keys, for a desk */
  const currentRef = useRef(current);
  currentRef.current = current;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (editing || t?.closest('input, textarea, select')) return;
      // A sheet opened over the deck has the keys, not the card under it.
      if (document.querySelector('.cp-sheet.open')) return;
      const c = currentRef.current;
      if (!c) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); goRight(c); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goLeft(c); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /*
   * The drag, straight onto the card's style: sixty re-renders a second is not
   * a gesture.
   *
   * Why it once moved a little and sprang back on a phone. touch-action is read
   * from the element touched up to the nearest scroller, and stops there: pan-y
   * on the card said nothing about a touch inside the card's own scroller, so
   * the browser took the sideways pan as its own after a few pixels, fired
   * pointercancel, and the cancel put the card back. pan-y now sits on the
   * scroller (copilot.css), and the touch guard below covers a browser that
   * decides on the first touchmove instead.
   */
  const dragRef = useRef<{ x: number; y: number; id: number; on: boolean; lx: number; lt: number; vx: number } | null>(null);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const setDrag = (dx: number, dy: number, animate = false) => {
    heldRef.current = { ...heldRef.current, dx, dy };
    const ease = animate ? `transform ${SETTLE_MS}ms cubic-bezier(.2,.9,.3,1.12), opacity ${SETTLE_MS}ms ease` : 'none';
    const el = cardRef.current;
    if (el) {
      el.style.transition = ease;
      el.style.transform = dx || dy ? `translate3d(${dx}px, ${dy}px, 0) rotate(${dx * TILT}deg)` : '';
      el.style.setProperty('--cp2-swp-yes', String(Math.max(0, Math.min(1, dx / SWIPE_PX))));
      el.style.setProperty('--cp2-swp-no', String(Math.max(0, Math.min(1, -dx / SWIPE_PX))));
    }
    // The next card comes forward as this one goes, so letting go finds it already in place.
    const under = underRef.current;
    if (under) {
      const p = Math.min(1, Math.abs(dx) / SWIPE_PX);
      under.style.transition = ease;
      under.style.transform = p ? `translate3d(0, ${12 * (1 - p)}px, 0) scale(${0.95 + 0.05 * p})` : '';
      under.style.opacity = p ? String(0.75 + 0.25 * p) : '';
    }
  };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (editing || pending || e.button > 0) return;
    // The message is most of the card, and a thumb lands on it: a swipe that
    // starts there is still a swipe (a tap still edits it — a drag captured by
    // the card never clicks the message).
    if ((e.target as HTMLElement).closest(NO_DRAG)) return;
    const t = performance.now();
    dragRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false, lx: e.clientX, lt: t, vx: 0 };
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = dragRef.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.on) {
      // Sideways is a swipe; up and down is reading the card.
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { dragRef.current = null; return; }
      if (Math.abs(dx) < 8) return;
      s.on = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    // Speed over the last moves, not the whole drag: a flick at the end of a
    // slow drag is a flick, and a thumb that stopped before letting go is not.
    const t = performance.now();
    const dt = t - s.lt;
    if (dt > 0) {
      s.vx = 0.7 * ((e.clientX - s.lx) / dt) + 0.3 * s.vx;
      s.lx = e.clientX;
      s.lt = t;
      heldRef.current.vx = s.vx;
    }
    setDrag(dx, dy * FOLLOW_Y);
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = dragRef.current;
    dragRef.current = null;
    if (!s?.on || !current) return;
    const dx = e.clientX - s.x;
    const vx = performance.now() - s.lt > 90 ? 0 : s.vx;
    heldRef.current.vx = vx;
    // Past the line and not being pulled back, or thrown that way.
    const right = (dx > SWIPE_PX && vx > -FLICK) || (dx > 30 && vx > FLICK);
    const left = (dx < -SWIPE_PX && vx < FLICK) || (dx < -30 && vx < -FLICK);
    if (right && goRight(current)) return;
    if (left) { goLeft(current); return; }
    setDrag(0, 0, true);
  };
  const onCancel = () => { if (dragRef.current?.on) setDrag(0, 0, true); dragRef.current = null; };

  // The touch guard. Safari on an older iPhone decides whether a touch scrolls
  // on its first touchmove and does not read pan-y inside a scroller: a touch
  // that starts sideways is the card's, said by cancelling its scroll. The
  // pointer events that move the card keep coming either way, and up and down
  // is left alone, so the card still scrolls.
  const dealt = current?.key;
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    let from: { x: number; y: number } | null = null;
    let sideways: boolean | null = null;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      const off = e.touches.length !== 1 || editingRef.current || pendingRef.current || (e.target as HTMLElement).closest(NO_DRAG);
      from = !off && t ? { x: t.clientX, y: t.clientY } : null;
      sideways = null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!from || !t) return;
      if (sideways === null) {
        const ax = Math.abs(t.clientX - from.x);
        const ay = Math.abs(t.clientY - from.y);
        if (ax < 3 && ay < 3) return;
        sideways = ax > ay;
      }
      if (sideways && e.cancelable) e.preventDefault();
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [dealt]);

  /* ─── What is on screen ─────────────────────────────────────────────────── */

  const remaining = live.length;
  const b = home.billing;
  // Who is waiting and who replied — the list's other pills — one tap from the deck.
  const entry = outreachLine({ to_send: d.stages.to_send.length, waiting: d.stages.waiting.length, replied: d.stages.replied.length });
  const top = (
    <div className="cp2-swp-top">
      <div className="cp2-swp-tally">
        <b>{d.noOffer ? 'Swipe' : remaining ? `${remaining} to go` : 'All done'}</b>
        {/* The frame's "finding" banner is under the deck, so the deck says it. */}
        <span>{finding ? 'Looking for more…' : stats.sent ? `${stats.sent} sent` : d.noOffer || !remaining ? '' : 'Right sends · left skips'}</span>
      </div>
      {entry && (
        <button className={`cp2-swp-outbtn${entry.replied ? ' hot' : ''}`} onClick={() => actions.openSheet({ kind: 'outreach', stage: entry.stage })}>
          <span>{entry.label}</span><IconChevron />
        </button>
      )}
    </div>
  );

  if (d.noOffer) {
    return (
      <div className="cp2-swp">
        {top}
        <div className="cp2-swp-empty">
          <b>One thing first</b>
          <p>Every message on these cards is written from what you sell. Say it in a sentence and the deck fills.</p>
          <button className="cp-btn primary" onClick={() => actions.openSheet({ kind: 'offer' })}>Say what you sell</button>
        </div>
      </div>
    );
  }

  const faceOf = (c: DeckCard) => {
    const fv = viaFor(c);
    const fk = fv ? dk(c, fv) : null;
    return {
      via: fv,
      key: fk,
      owned: c.kind !== 'find' && ((fv === 'whatsapp' && home.channels.whatsapp) || (fv === 'email' && home.channels.email)),
      draft: fk ? drafts[fk] : undefined,
      edited: fk ? edits[fk] : undefined,
      hint: hint[c.key] ?? null,
    };
  };
  // The record behind a card — notes, history, every field — as the list's chevron opened it.
  const moreOf = (c: DeckCard): SheetState | null =>
    c.oppId ? { kind: 'opp', id: c.oppId }
    : c.kind === 'business' ? { kind: 'opp', id: c.id }
    : c.kind === 'draft' ? { kind: 'action', id: c.id }
    : c.answer === 'move' ? { kind: 'move', id: c.id }
    : null;
  const f = current ? faceOf(current) : null;
  const v = f?.via ?? null;
  const k = f?.key ?? null;
  const owned = !!f?.owned;
  const yes = !v ? 'Keep' : owned ? 'Send' : VIA_LABEL[v];
  const more = current ? moreOf(current) : null;
  const nf = next ? faceOf(next) : null;
  const setAside = d.feed.filter((i) => i.below).length;
  const canLook = d.searching && !finding && b.matches.remaining > 0;
  const walled = b.matches.remaining === 0 && b.effective !== 'operator';
  const none = () => {};

  return (
    <div className="cp2-swp">
      {top}
      <div className="cp2-swp-stack">
        {/* The next card whole, not a picture of one: a drag uncovers what will be there. */}
        {next && nf && (
          <div key={next.key} ref={underRef} className="cp2-swp-card cp2-swp-under" aria-hidden inert>
            <div className="cp2-swp-scroll">
              <Hero card={next} />
              <Face
                card={next} via={nf.via} owned={nf.owned} draft={nf.draft} edited={nf.edited} hint={nf.hint} editing={false}
                onVia={none} onEdit={none} onEditing={none} onRewrite={none} onMore={null}
              />
            </div>
          </div>
        )}
        {current ? (
          <div
            key={current.key}
            ref={cardRef}
            className="cp2-swp-card"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}
          >
            <span className="cp2-swp-stamp yes" aria-hidden>{yes}</span>
            <span className="cp2-swp-stamp no" aria-hidden>Not for me</span>
            <div className="cp2-swp-scroll">
              <Hero card={current} />
              <Face
                card={current}
                via={v}
                owned={owned}
                draft={f?.draft}
                edited={f?.edited}
                hint={f?.hint ?? null}
                editing={editing === k}
                onVia={(nv) => { setViaOf((m) => ({ ...m, [current.key]: nv })); setHint((m) => ({ ...m, [current.key]: '' })); }}
                onEdit={(text) => k && setEdits((m) => ({ ...m, [k]: text }))}
                onEditing={(on) => setEditing(on ? k : null)}
                onRewrite={() => { if (!v || !k) return; setEdits((m) => { const n = { ...m }; delete n[k]; return n; }); void loadDraft(current, v, true); }}
                onMore={more ? () => actions.openSheet(more) : null}
              />
            </div>
          </div>
        ) : (
          <div className="cp2-swp-empty">
            {finding ? (
              <><b>Looking now</b><p>Real listings and real pages, not a sample — the first pass takes a minute.</p></>
            ) : stats.sent || stats.skipped ? (
              <><b>That is everyone for now</b><p>{stats.sent} sent, {stats.skipped} not for you. New ones arrive as the app finds them.</p></>
            ) : !d.searching ? (
              // Said rather than shown as a quiet morning: nothing on this server
              // can search yet, and the Scout under Agents on Proof names what is missing.
              <><b>Nothing can look for you yet</b><p>Web search is not set up on this server. The Scout, under Agents on Proof, says what is missing.</p></>
            ) : (
              // "Every night" only while the nightly job is running; the Path says when it is not.
              <><b>Nothing worth your time yet</b><p>{setAside ? `It went through ${setAside} and none were worth a message. ` : ''}{d.done.stale ? 'New ones land here as they are found.' : 'It keeps looking every night, and new ones land here.'}</p></>
            )}
            {canLook && <button className="cp-btn primary" onClick={() => void actions.findMatches()}>Look for more now</button>}
            {walled && (
              <div className="cp2-swp-wall">
                <b>Out of matches</b>
                <p>You have used all {b.matches.limit} on {PLANS[b.effective].name} this month. Everything else keeps running on what you already have — only new supply stops.</p>
                <a className="cp-btn primary block" href={`${shell}/pricing`}>
                  See plans — {PLANS[b.effective === 'free' ? 'pro' : 'operator'].limits.matchesPerMonth.toLocaleString()} a month
                </a>
              </div>
            )}
          </div>
        )}
        <div className="cp2-swp-ghosts" ref={ghostsRef} aria-hidden />
      </div>

      {/* Frosted over the foot of the card: the buttons and the nav sit on the card, not under it. */}
      {current && <div className="cp2-swp-veil" aria-hidden />}

      {current && (
        <div className="cp2-swp-bar">
          <button className="cp2-swp-act sm" onClick={undo} disabled={!skipping} aria-label="Take back the last not-for-me"><i><IconUndo /></i><span>Undo</span></button>
          <button className="cp2-swp-act no" onClick={() => goLeft(current)} disabled={!!pending} aria-label={`Not for me: ${current.title}`}><i><IconCross /></i><span>Skip</span></button>
          <button className="cp2-swp-act sm" onClick={() => goLater(current)} disabled={!!pending} aria-label="Later: to the back of the pile"><i><IconStar /></i><span>Later</span></button>
          <button className="cp2-swp-act yes" onClick={() => goRight(current)} disabled={!!pending} aria-label={`${yes}: ${current.title}`}>
            <i>{v === 'call' ? <IconPhone /> : <IconSend />}</i><span>{yes}</span>
          </button>
          <a
            className={`cp2-swp-act sm${current.link ? '' : ' off'}`} href={current.link ?? undefined} target="_blank" rel="noreferrer"
            aria-label={`Look ${current.title} up`} aria-disabled={!current.link}
            onClick={(e) => { if (!current.link) e.preventDefault(); }}
          >
            <i><IconExternal /></i><span>Look up</span>
          </a>
        </div>
      )}

      {skipping && !pending && (
        <div className="cp2-swp-undo" role="status">
          <span>Not for me: {skipping.card.title}</span>
          <button onClick={undo}>Undo</button>
        </div>
      )}

      {pending && (
        <div className="cp2-swp-ask" role="dialog" aria-label="Did it go?">
          <div className="cp2-swp-askcard">
            <b>{askLine(pending)}</b>
            {pending.error && <p className="cp2-swp-askerr">{pending.error}</p>}
            {pending.copied === true && <p className="cp2-swp-askhint">Your reply is copied — paste it there.</p>}
            {pending.copied === false && (
              <p className="cp2-swp-askhint">It could not be copied on this phone. Here it is: <span className="cp2-swp-asktext">{pending.body}</span></p>
            )}
            {!pending.opened && pending.link && (
              <a
                className="cp-btn primary block" href={pending.link} target={/^https?:/i.test(pending.link) ? '_blank' : undefined} rel="noreferrer"
                onClick={() => setPending((p) => (p ? { ...p, opened: true } : p))}
              >
                Send it from {VIA_LABEL[pending.via]}
              </a>
            )}
            <div className="cp2-swp-askbtns">
              <button className="cp-btn primary" disabled={pending.busy} onClick={() => void confirmWent()}>
                {pending.busy ? 'Saving…' : pending.via === 'call' ? 'Talked to them' : pending.via === 'post' ? 'Posted' : 'It went'}
              </button>
              <button className="cp-btn" disabled={pending.busy} onClick={() => void confirmNot()}>
                {pending.via === 'call' ? 'No answer' : 'It didn’t'}
              </button>
            </div>
            {pending.error?.startsWith('Not saved') && pending.reach && <button className="cp2-swp-again" onClick={retryReach}>Save the draft again</button>}
            {pending.opened && pending.link && (
              <a className="cp2-swp-again" href={pending.link} target={/^https?:/i.test(pending.link) ? '_blank' : undefined} rel="noreferrer">
                {AGAIN[pending.via]}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Open the person's own app with the message in. A page opens in a new tab; a
 * phone, a text or a mail is a link clicked, which a phone hands to the app for
 * that scheme — called inside the swipe, since a phone opens neither after a
 * wait.
 */
function openLink(link: string): void {
  if (/^https?:/i.test(link)) { window.open(link, '_blank', 'noopener'); return; }
  const a = document.createElement('a');
  a.href = link;
  a.rel = 'noreferrer';
  a.click();
}

const AGAIN: Record<ReachVia, string> = {
  whatsapp: 'Open WhatsApp again', sms: 'Open your texts again', call: 'Call again', email: 'Open your email again',
  site: 'Open their site again', post: 'Open the post again',
};

function askLine(p: Pending): string {
  if (p.via === 'call') return `Did you get through to ${p.card.title}?`;
  if (p.via === 'post') return 'Did you post your reply?';
  if (p.via === 'site') return `Did you send it through ${p.card.title}’s site?`;
  return `Did it go to ${p.card.title}?`;
}

/* ─── The card ────────────────────────────────────────────────────────────── */

/** The top of a card: the photo, or a tint with initials; what it is over it. */
function Hero({ card }: { card: DeckCard }) {
  const [broken, setBroken] = useState(false);
  const badge = card.followUp ? 'Follow-up' : card.kind === 'draft' ? 'To send' : card.fresh ? 'New' : null;
  return (
    <div className={`cp2-swp-hero t${tintOf(card.title)}${card.image && !broken ? ' photo' : ''}`}>
      {card.image && !broken
        ? <img src={card.image} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} draggable={false} />
        : <span className="cp2-swp-mono" aria-hidden>{card.initials || <MatchGlyph group={card.group} />}</span>}
      {badge && <span className="cp2-swp-badge">{badge}</span>}
      <div className="cp2-swp-title">
        <h2>{card.title}</h2>
        {card.sub && <p>{card.sub}</p>}
      </div>
    </div>
  );
}

/** How they can be reached, in words. A landline says so, since that is why a WhatsApp never went. */
function reachLine(card: DeckCard): string | null {
  const vias = card.reach.map((r) => r.via);
  if (!vias.length) return card.kind === 'find' ? 'Nothing to reply on — keep it or skip it' : null;
  if (vias[0] === 'post') return `Reply on ${card.source ?? 'the post'}`;
  const phone = vias.includes('sms') ? 'Mobile · WhatsApp or text' : vias.includes('whatsapp') ? 'Phone · WhatsApp or call' : vias.includes('call') ? 'Landline · call only' : null;
  const other = [vias.includes('email') ? 'email' : null, vias.includes('site') ? 'website' : null].filter(Boolean).join(', ');
  if (phone) return other ? `${phone} · ${other}` : phone;
  return vias.includes('email') ? `Email${vias.includes('site') ? ' · website' : ''}` : 'Website only · their contact form';
}

const MESSAGE_LABEL: Record<ReachVia, string> = {
  whatsapp: 'Your WhatsApp', sms: 'Your text', call: 'What to say when they pick up', email: 'Your email',
  site: 'For their contact form — copied when you swipe right', post: 'Your reply — copied when you swipe right',
};

function Face({ card, via, owned, draft, edited, hint, editing, onVia, onEdit, onEditing, onRewrite, onMore }: {
  card: DeckCard; via: ReachVia | null; owned: boolean; draft: DraftState | undefined; edited: string | undefined; hint: string | null; editing: boolean;
  onVia: (v: ReachVia) => void; onEdit: (text: string) => void; onEditing: (on: boolean) => void; onRewrite: () => void;
  /** The record behind the card, when there is one: a feed's find carries all of itself on the card. */
  onMore: (() => void) | null;
}) {
  const reach = reachLine(card);
  const vias = [...new Set(card.reach.map((r) => r.via))];
  const text = edited ?? (draft?.state === 'ready' ? draft.body : '');
  return (
    <div className="cp2-swp-body">
      {(card.facts.length > 0 || reach) && (
        <div className="cp2-swp-facts">
          {card.facts.map((f) => <span key={f}>{f}</span>)}
          {reach && <span className="reach">{reach}</span>}
        </div>
      )}

      {card.why.length > 0 && (
        <section className="cp2-swp-sec">
          <h3>Why this one</h3>
          {card.why.map((w, i) => <p key={i}>{w}</p>)}
        </section>
      )}

      {card.post && (
        <section className="cp2-swp-sec">
          <h3>{card.source ? `The post · ${card.source}` : 'The post'}</h3>
          <blockquote className="cp2-swp-post">{card.post}</blockquote>
        </section>
      )}

      {via && (
        <section className="cp2-swp-sec cp2-swp-msgsec">
          <h3>{MESSAGE_LABEL[via]}</h3>
          {vias.length > 1 && (
            <div className="cp2-swp-vias" role="group" aria-label="How it goes">
              {vias.map((x) => (
                <button key={x} className={x === via ? 'on' : ''} aria-pressed={x === via} onClick={() => onVia(x)}>{VIA_LABEL[x]}</button>
              ))}
            </div>
          )}
          {hint && <p className="cp2-swp-hint">{hint}</p>}
          {draft?.state === 'error' ? (
            <div className="cp2-swp-msg err">
              <p>Could not write this one: {draft.error}</p>
              <button className="cp-btn sm" onClick={onRewrite}>Try again</button>
            </div>
          ) : !draft || draft.state === 'loading' ? (
            <div className="cp2-swp-msg wait" aria-live="polite">
              <i /><i /><i />
              <span>Writing it for {card.title}…</span>
            </div>
          ) : editing ? (
            <textarea
              className="cp2-swp-edit" value={text} autoFocus rows={Math.min(12, Math.max(4, Math.ceil(text.length / 38)))}
              onChange={(e) => onEdit(e.target.value)} onBlur={() => onEditing(false)} aria-label="Edit the message"
            />
          ) : (
            <button className="cp2-swp-msg" onClick={() => onEditing(true)} aria-label="Edit the message">
              {draft.subject && via === 'email' && <b className="cp2-swp-subj">{draft.subject}</b>}
              <span>{text}</span>
            </button>
          )}
          {draft?.state === 'ready' && !editing && (
            <div className="cp2-swp-meta">
              <span>
                {edited !== undefined ? 'Your words' : draft.from === 'model' ? (card.kind === 'find' ? 'Written for this post' : `Written for ${card.title}`) : draft.note ?? 'Written from your offer'}
                {owned ? ' · sends from your own number' : ''}
              </span>
              <button onClick={onRewrite}>Rewrite</button>
            </div>
          )}
        </section>
      )}

      {onMore && (
        <button className="cp2-swp-more" onClick={onMore}>
          <span>More about {card.title}</span><IconChevron />
        </button>
      )}
    </div>
  );
}
