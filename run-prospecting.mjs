// Run Apify locally (no Vercel timeout) then dispatch leads to the trigger endpoint
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const APIFY_BASE = 'https://api.apify.com/v2';
const token = process.env.APIFY_API_TOKEN;
const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';

const query = 'home renovation contractors near me';
const location = 'Kuala Lumpur, Malaysia';
const maxResults = 50;

console.log(`Searching: "${query}" in "${location}" (max ${maxResults})...`);

// Start Apify run
const startRes = await fetch(
  `${APIFY_BASE}/acts/compass~crawler-google-places/runs?token=${encodeURIComponent(token)}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      searchStringsArray: [`${query} in ${location}`],
      maxCrawledPlacesPerSearch: maxResults,
      language: 'en',
      includeWebResults: false,
      includeHistogram: false,
      includeOpeningHours: false,
      includePeopleAlsoSearch: false,
    }),
  },
);

const run = await startRes.json();
const runId = run.data.id;
const datasetId = run.data.defaultDatasetId;
console.log(`Run started: ${runId}`);

// Poll until done
let status = 'RUNNING';
while (status === 'RUNNING' || status === 'READY') {
  const waitRes = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}?token=${encodeURIComponent(token)}&waitForFinish=60`,
  );
  const runData = await waitRes.json();
  status = runData.data.status;
  console.log(`Status: ${status}`);
}

// Fetch results
const dataRes = await fetch(
  `${APIFY_BASE}/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&format=json`,
);
const results = await dataRes.json();

// Filter — only businesses with phone numbers
const leads = results
  .filter(r => r.phone)
  .map(r => ({
    title: r.title || '',
    phone: r.phone,
    website: r.website || '',
    rating: r.totalScore || 0,
    reviewsCount: r.reviewsCount || 0,
    address: r.address || '',
    city: r.city || location,
    categoryName: r.categoryName || query,
    placeId: r.placeId || '',
  }));

console.log(`\nFound ${results.length} total, ${leads.length} with phone numbers`);
leads.forEach((l, i) => console.log(`  ${i+1}. ${l.title} | ${l.phone} | ${l.categoryName}`));

// Now dispatch each as prospect_found to the trigger endpoint
const cap = 15;
console.log(`\n--- Dispatching ${Math.min(leads.length, cap)} leads to trigger endpoint ---`);
let sent = 0;
for (let idx = 0; idx < Math.min(leads.length, cap); idx++) {
  const lead = leads[idx];
  const res = await fetch(
    `https://app.launchfly.ai/api/assistants/trigger?businessId=${businessId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'prospect_found',
        phone: lead.phone,
        name: lead.title,
        metadata: {
          source: 'apify_prospecting',
          rating: String(lead.rating),
          reviews: String(lead.reviewsCount),
          website: lead.website,
          address: lead.address,
          city: lead.city,
          category: lead.categoryName,
          place_id: lead.placeId,
          stagger_index: idx,
        },
      }),
    },
  );
  const result = await res.json();
  const detail = result.actions?.[0]?.detail || '';
  console.log(`  ${++sent}. ${lead.title.substring(0, 40)} → ${detail}`);
  
  if (detail.includes('Daily cap reached')) {
    console.log('  ⛔ Daily cap reached — stopping');
    break;
  }
  
  // Small delay between sends to avoid hammering
  await new Promise(r => setTimeout(r, 1000));
}

console.log(`\n✓ Done. Dispatched ${sent} leads.`);
