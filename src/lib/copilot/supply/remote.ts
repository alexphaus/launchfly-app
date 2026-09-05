// src/lib/copilot/supply/remote.ts
// Supply as a service. Mirrors the agent seam so the hunt for real
// opportunities can be built and iterated OUTSIDE this app — an n8n workflow,
// a small service fanning out to Exa / Apify / job boards — without redeploying.
//
//   POST $COPILOT_SUPPLY_URL
//   Authorization: Bearer $COPILOT_SUPPLY_SECRET
//   { "kind": "discover", "limit": 40, "profile": { ...what the hunt needs... } }
//   -> { "candidates": SupplyCandidate[] }   (a bare array is also accepted)
//
// Anything the remote returns is normalised and capped here; a bad adapter can
// pollute the pipeline with junk but never crash the run.

import type { Contact, Effort, OpportunityType, Profile } from '../types';
import { OPPORTUNITY_TYPES } from '../types';
import { normalizePhone, type SupplyAdapter, type SupplyCandidate } from './types';

const TIMEOUT_MS = 90_000;

export const remoteAdapter: SupplyAdapter = {
  key: 'remote',
  label: 'External supply agent',
  billable: false,
  available: () => !!process.env.COPILOT_SUPPLY_URL,
  async discover(profile: Profile, { limit }) {
    const url = process.env.COPILOT_SUPPLY_URL!;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(process.env.COPILOT_SUPPLY_SECRET ? { authorization: `Bearer ${process.env.COPILOT_SUPPLY_SECRET}` } : {}) },
        body: JSON.stringify({
          kind: 'discover',
          limit,
          profile: {
            headline: profile.headline,
            offer: profile.offer,
            location: profile.location,
            target_segments: profile.target_segments,
            target_area: profile.target_area,
            hunt_types: profile.hunt_types,
          },
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = (await res.json()) as unknown;
      const raw = Array.isArray(json) ? json : Array.isArray((json as { candidates?: unknown }).candidates) ? (json as { candidates: unknown[] }).candidates : [];
      return raw.map(normalizeCandidate).filter((c): c is SupplyCandidate => !!c).slice(0, limit);
    } finally {
      clearTimeout(t);
    }
  },
};

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

function normalizeCandidate(raw: unknown): SupplyCandidate | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title, 200);
  const external_id = str(r.external_id ?? r.id, 200);
  if (!title || !external_id) return null;   // without a stable id we cannot dedupe
  const contactIn = (r.contact && typeof r.contact === 'object' ? r.contact : {}) as Record<string, unknown>;
  const contact: Contact = {
    name: str(contactIn.name, 120),
    whatsapp: normalizePhone(str(contactIn.whatsapp ?? contactIn.phone, 40)) ?? undefined,
    email: str(contactIn.email, 160),
    website: str(contactIn.website, 500),
  };
  return {
    source: str(r.source, 40) ?? 'remote',
    external_id,
    type: OPPORTUNITY_TYPES.includes(r.type as OpportunityType) ? (r.type as OpportunityType) : 'client',
    title,
    summary: str(r.summary ?? r.reason, 400) ?? title,
    url: str(r.url, 500) ?? null,
    contact,
    data: (r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : {}) as Record<string, unknown>,
    effort: (['light', 'medium', 'deep'] as Effort[]).includes(r.effort as Effort) ? (r.effort as Effort) : 'medium',
    value_label: str(r.value_label, 40),
  };
}
