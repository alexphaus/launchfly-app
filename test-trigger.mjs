import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

// Call the trigger endpoint directly (no QStash) to see what happens
const appUrl = 'https://app.launchfly.ai';
const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';

console.log('Directly calling trigger endpoint with prospect_found (full metadata)...');
const res = await fetch(`${appUrl}/api/assistants/trigger?businessId=${businessId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'prospect_found',
    phone: '+60123456789',
    name: 'KL Renovation Pro Sdn Bhd',
    metadata: {
      source: 'apify_prospecting',
      stagger_index: 0,
      category: 'Home renovation contractor',
      rating: '4.5',
      reviews: '23',
      city: 'Kuala Lumpur',
      website: 'https://example.com',
      address: '123 Jalan Sultan, Kuala Lumpur',
    },
  }),
});

console.log('Status:', res.status, res.statusText);
const data = await res.json();
console.log('Response:', JSON.stringify(data, null, 2));
