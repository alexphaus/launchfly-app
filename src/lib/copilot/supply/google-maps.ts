// src/lib/copilot/supply/google-maps.ts
// Adapter over the existing Apify Google Maps scraper: finds businesses in the
// user's target segments and area. Costs Apify credits, so it runs from the
// cron and the "Find new matches" button, never on onboarding.

import { getApifyToken, searchGoogleMaps } from '@/lib/apify';
import type { Profile } from '../types';
import { normalizePhone, type SupplyAdapter, type SupplyCandidate } from './types';

const MAX_SEGMENTS_PER_RUN = 3;
const SEGMENT_TIMEOUT_MS = 90_000;
/** Below this there is no point starting a scrape that cannot finish. */
const MIN_SEGMENT_MS = 8_000;

export const googleMapsAdapter: SupplyAdapter = {
  key: 'google_maps',
  label: 'Google Maps',
  billable: true,
  async available(profile) {
    if (!profile.target_segments.length || !(profile.target_area || profile.location)) return false;
    try { await getApifyToken(profile.linked_business_id ?? undefined); return true; } catch { return false; }
  },
  async discover(profile: Profile, { limit, deadline }) {
    const location = profile.target_area || profile.location!;
    const perSegment = Math.max(5, Math.floor(limit / Math.min(MAX_SEGMENTS_PER_RUN, profile.target_segments.length)));
    const out: SupplyCandidate[] = [];
    for (const segment of profile.target_segments.slice(0, MAX_SEGMENTS_PER_RUN)) {
      // Three segments at up to 90s each is four and a half minutes, and the
      // proxy in front of this gives up long before that. Stop between segments
      // and hand back what was found; the next run picks up where this left off,
      // because the upsert dedupes on (profile, source, external_id).
      const left = deadline ? deadline - Date.now() : SEGMENT_TIMEOUT_MS;
      if (left <= MIN_SEGMENT_MS) break;
      const leads = await searchGoogleMaps({ query: segment, location, maxResults: perSegment, businessId: profile.linked_business_id ?? undefined, timeoutMs: Math.min(SEGMENT_TIMEOUT_MS, left) });
      for (const l of leads) {
        if (!l.placeId) continue;
        const pains: string[] = [];
        if (!l.website) pains.push('no_website');
        if ((l.reviewsCount ?? 0) < 10) pains.push('few_reviews');
        if ((l.rating ?? 5) < 4) pains.push('low_rating');
        const phone = normalizePhone(l.phone);
        out.push({
          source: 'google_maps',
          external_id: l.placeId,
          type: 'client',
          title: l.title,
          summary: [
            `${l.categoryName || segment} in ${l.city || location}.`,
            l.rating ? `${l.rating}★ from ${l.reviewsCount ?? 0} reviews.` : 'No reviews yet.',
            pains.length ? `Pain: ${pains.map((p) => p.replace(/_/g, ' ')).join(', ')}.` : null,
            phone ? null : 'No phone listed.',
          ].filter(Boolean).join(' '),
          url: `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(l.placeId)}`,
          contact: { whatsapp: phone ?? undefined, website: l.website || undefined },
          data: { segment, rating: l.rating, reviews_count: l.reviewsCount, address: l.address, city: l.city, category: l.categoryName, pain_signals: pains },
          effort: 'medium',
        });
      }
    }
    return out;
  },
};
