// src/lib/copilot/supply/types.ts
// A supply adapter turns an external source into candidates. Adding a source
// means adding one file that implements this and registering it in index.ts.

import type { Contact, Effort, OpportunityType, Profile } from '../types';

export interface SupplyCandidate {
  source: string;               // adapter key, e.g. 'hunter', 'google_maps'
  external_id: string;          // stable id in the source; dedupes across runs
  type: OpportunityType;
  title: string;
  summary: string;              // factual, becomes the initial reason
  url?: string | null;
  contact: Contact;
  data: Record<string, unknown>;
  effort?: Effort;
  value_label?: string;
}

export interface SupplyAdapter {
  key: string;
  label: string;
  /** False when the adapter cannot run in this deployment (missing token etc.). */
  available(profile: Profile): boolean | Promise<boolean>;
  discover(profile: Profile, opts: { limit: number }): Promise<SupplyCandidate[]>;
}

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7) return null;
  // Philippine local mobile (09xx) → international 63
  if (digits.length === 11 && digits.startsWith('09')) return `63${digits.slice(1)}`;
  return digits;
}

/** 0..80 deterministic fit. Leaves headroom so the agent's ranking still matters. */
export function heuristicFit(profile: Pick<Profile, 'target_segments' | 'target_area' | 'headline'>, c: SupplyCandidate): number {
  let s = 50;
  const hay = `${c.title} ${c.summary} ${JSON.stringify(c.data)}`.toLowerCase();
  if (profile.target_segments.some((seg) => seg && hay.includes(seg.toLowerCase()))) s += 15;
  if (profile.target_area && hay.includes(profile.target_area.toLowerCase())) s += 10;
  if (c.contact.whatsapp) s += 10;
  else if (c.contact.email) s += 5;
  const pains = Array.isArray(c.data.pain_signals) ? (c.data.pain_signals as unknown[]).length : 0;
  if (pains > 0) s += Math.min(8, pains * 3);
  return Math.max(0, Math.min(80, Math.round(s)));
}
