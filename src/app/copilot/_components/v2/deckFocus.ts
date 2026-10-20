'use client';
// Which chip Decide's pile is on — All, Clients, People, Projects, Bets — kept
// for the session on this phone, so a trip to another tab comes back to the same
// focus. A convenience about the screen and nothing more: storage that keeps
// nothing shows All. System writes it too, when "waiting in Decide" is tapped on
// a bet's plan, so the deck opens on the people that bet found.
import { FOCUSES, type Focus } from '@/lib/copilot/decide';

export type DeckFocus = 'all' | Focus;

const key = (pid: string) => `cp2.deck.focus.${pid}`;

export function readDeckFocus(pid: string): DeckFocus {
  try {
    const v = window.sessionStorage.getItem(key(pid));
    return v && (FOCUSES as readonly string[]).includes(v) ? (v as Focus) : 'all';
  } catch { return 'all'; }
}

export function writeDeckFocus(pid: string, f: DeckFocus): void {
  try { window.sessionStorage.setItem(key(pid), f); } catch { /* the chip still changes on screen */ }
}
