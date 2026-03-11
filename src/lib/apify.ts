// src/lib/apify.ts
// ═══════════════════════════════════════════════════════════════════════════
// Apify Google Maps Scraper Integration
//
// Runs a synchronous scraper call on Apify and returns parsed business data.
// Uses the "compass/crawler-google-places" actor (most popular Google Maps scraper).
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const APIFY_BASE = 'https://api.apify.com/v2';

export interface ScrapedLead {
  title: string;
  phone: string;
  website: string;
  rating: number;
  reviewsCount: number;
  address: string;
  city: string;
  categoryName: string;
  placeId: string;
}

/** Get Apify API token from business config or env fallback */
export async function getApifyToken(businessId?: string): Promise<string> {
  if (businessId) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
      );
      const { data } = await supabase
        .from('businesses')
        .select('prospecting_config')
        .eq('id', businessId)
        .single();

      const cfg = data?.prospecting_config;
      if (cfg?.apifyToken) return cfg.apifyToken;
    } catch {
      // Fall through to env
    }
  }

  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error('No Apify API token — set per-business config or APIFY_API_TOKEN env var');
  return token;
}

/**
 * Run the Google Maps scraper and return filtered results.
 * Uses synchronous run (waits for completion, up to 120s).
 */
export async function searchGoogleMaps(opts: {
  query: string;
  location: string;
  maxResults?: number;
  businessId?: string;
}): Promise<ScrapedLead[]> {
  const { query, location, maxResults = 50, businessId } = opts;
  const token = await getApifyToken(businessId);

  const searchTerms = [`${query} in ${location}`];

  // Run actor synchronously (blocks until done, max 120s timeout)
  const res = await fetch(
    `${APIFY_BASE}/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray: searchTerms,
        maxCrawledPlacesPerSearch: maxResults,
        language: 'en',
        // Only get essential fields to minimize cost
        includeWebResults: false,
        includeHistogram: false,
        includeOpeningHours: false,
        includePeopleAlsoSearch: false,
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Apify API error ${res.status}: ${errText.substring(0, 200)}`);
  }

  const results = (await res.json()) as Record<string, unknown>[];

  // Parse and filter — only keep businesses with phone numbers
  const leads: ScrapedLead[] = [];
  for (const r of results) {
    const phone = (r.phone as string) || '';
    if (!phone) continue; // Skip businesses without phone

    leads.push({
      title: (r.title as string) || '',
      phone,
      website: (r.website as string) || '',
      rating: Number(r.totalScore) || 0,
      reviewsCount: Number(r.reviewsCount) || 0,
      address: (r.address as string) || '',
      city: (r.city as string) || location,
      categoryName: (r.categoryName as string) || query,
      placeId: (r.placeId as string) || '',
    });
  }

  return leads;
}
