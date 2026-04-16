// src/lib/apify.ts
// ═══════════════════════════════════════════════════════════════════════════
// Apify Google Maps Scraper Integration
//
// Runs a synchronous scraper call on Apify and returns parsed business data.
// Uses the "compass/crawler-google-places" actor (most popular Google Maps scraper).
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const APIFY_BASE = 'https://api.apify.com/v2';

export interface ScrapedReview {
  text: string;
  stars: number;
  publishedAtDate: string;
  reviewerName: string;
}

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
  reviews?: ScrapedReview[];
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
  timeoutMs?: number;
  reviewsPerPlace?: number;
}): Promise<ScrapedLead[]> {
  const { query, location, maxResults = 50, businessId, timeoutMs, reviewsPerPlace = 0 } = opts;
  const token = await getApifyToken(businessId);

  const searchTerms = [`${query} in ${location}`];

  // Step 1: Start the actor run asynchronously
  const startRes = await fetch(
    `${APIFY_BASE}/acts/compass~crawler-google-places/runs?token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray: searchTerms,
        maxCrawledPlacesPerSearch: maxResults,
        language: 'en',
        includeWebResults: false,
        includeHistogram: false,
        includeOpeningHours: false,
        includePeopleAlsoSearch: false,
        ...(reviewsPerPlace > 0 ? {
          maxReviews: reviewsPerPlace,
          reviewsSort: 'newest',
        } : {}),
      }),
    },
  );

  if (!startRes.ok) {
    const errText = await startRes.text().catch(() => '');
    throw new Error(`Apify start error ${startRes.status}: ${errText.substring(0, 200)}`);
  }

  const run = (await startRes.json()) as { data: { id: string; defaultDatasetId: string } };
  const runId = run.data.id;
  const datasetId = run.data.defaultDatasetId;

  // Step 2: Wait for run to finish (poll with waitForFinish — Apify long-polls up to the specified seconds)
  // Base waitSecs on the dynamic timeoutMs if provided, capping at 50s for Vercel 60s limit
  let waitSecs = 50; 
  if (timeoutMs) {
    waitSecs = Math.max(1, Math.floor(Math.min(timeoutMs - 2000, 50000) / 1000));
  }
  const waitRes = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}?token=${encodeURIComponent(token)}&waitForFinish=${waitSecs}`,
  );
  const runStatus = (await waitRes.json()) as { data: { status: string } };

  if (runStatus.data.status !== 'SUCCEEDED') {
    // Run still going or failed — return whatever partial results are in the dataset
    console.warn(`[apify] Run ${runId} status: ${runStatus.data.status} — fetching partial results`);
  }

  // Step 3: Fetch dataset items
  const dataRes = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&format=json`,
  );

  if (!dataRes.ok) {
    const errText = await dataRes.text().catch(() => '');
    throw new Error(`Apify dataset error ${dataRes.status}: ${errText.substring(0, 200)}`);
  }

  const results = (await dataRes.json()) as Record<string, unknown>[];

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
      reviews: Array.isArray(r.reviews)
        ? (r.reviews as Record<string, unknown>[]).slice(0, reviewsPerPlace || 0).map(rev => ({
            text: (rev.text as string) || '',
            stars: Number(rev.stars) || 0,
            publishedAtDate: (rev.publishedAtDate as string) || '',
            reviewerName: (rev.name as string) || '',
          }))
        : undefined,
    });
  }

  return leads;
}
