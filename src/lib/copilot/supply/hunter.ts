// src/lib/copilot/supply/hunter.ts
// Adapter over Launchfly's own prospect pipeline (hunter_prospects): real local
// service businesses with a WhatsApp number and observed pain signals.

import { copilotDb } from '../db';
import type { Profile } from '../types';
import { normalizePhone, type SupplyAdapter, type SupplyCandidate } from './types';

interface HunterRow {
  id: string; business_name: string; service_type: string; area: string; whatsapp_number: string;
  owner_name: string | null; website_url: string | null; facebook_url: string | null; google_maps_url: string | null;
  instagram_url: string | null; email: string | null; pain_signals: string[] | null; status: string; notes: string | null; source: string | null;
}

const OPEN_STATUSES = ['new', 'opener_queued', 'opener_sent', 'replied', 'preview_sent', 'follow_up_1', 'follow_up_2', 'follow_up_3'];

export const hunterAdapter: SupplyAdapter = {
  key: 'hunter',
  label: 'Prospect pipeline',
  // hunter_prospects is Launchfly's own shared table, not per-copilot-user data.
  // Only profiles explicitly linked to a business may read it; everyone else
  // gets their supply from Google Maps and the remote adapter instead.
  available: (profile) => !!profile.linked_business_id,
  async discover(profile: Profile, { limit }) {
    if (!profile.linked_business_id) return [];   // belt and braces: never read the shared pool unscoped
    let q = copilotDb()
      .from('hunter_prospects')
      .select('id, business_name, service_type, area, whatsapp_number, owner_name, website_url, facebook_url, google_maps_url, instagram_url, email, pain_signals, status, notes, source')
      .in('status', OPEN_STATUSES)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (profile.target_segments.length) {
      // service_type ilike any segment
      q = q.or(profile.target_segments.map((s) => `service_type.ilike.%${s.replace(/[%,()]/g, '')}%`).join(','));
    }
    const { data, error } = await q;
    if (error) throw new Error(`hunter: ${error.message}`);
    return ((data ?? []) as HunterRow[]).map((r): SupplyCandidate => {
      const pains = r.pain_signals ?? [];
      const summary = [
        `${cap(r.service_type.replace(/_/g, ' '))} in ${r.area}.`,
        pains.length ? `Pain: ${pains.map((p) => p.replace(/_/g, ' ')).join(', ')}.` : null,
        r.status !== 'new' ? `Pipeline status: ${r.status.replace(/_/g, ' ')}.` : null,
        r.notes ? r.notes.slice(0, 140) : null,
      ].filter(Boolean).join(' ');
      return {
        source: 'hunter',
        external_id: r.id,
        type: 'client',
        title: r.business_name,
        summary,
        url: r.google_maps_url || r.website_url || r.facebook_url || r.instagram_url || null,
        contact: { name: r.owner_name ?? undefined, whatsapp: normalizePhone(r.whatsapp_number) ?? undefined, email: r.email ?? undefined, website: r.website_url ?? undefined },
        data: { service_type: r.service_type, area: r.area, pain_signals: pains, hunter_status: r.status, hunter_source: r.source },
        effort: 'medium',
      };
    });
  },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
