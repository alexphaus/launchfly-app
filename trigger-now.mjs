import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

const QSTASH_BASE = process.env.QSTASH_URL;
const TOKEN = process.env.QSTASH_TOKEN;
const triggerUrl = 'https://app.launchfly.ai/api/assistants/trigger?businessId=06203464-2b76-4468-8d2e-6630ab0ed71a';

console.log('Triggering daily_schedule now (post-deploy)...');
const res = await fetch(`${QSTASH_BASE}/v2/publish/${triggerUrl}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    businessId: '06203464-2b76-4468-8d2e-6630ab0ed71a',
    event: 'daily_schedule',
    ruleId: 'rule_lf_daily_prospecting',
  }),
});
const data = await res.json();
console.log('Trigger result:', data.messageId ? 'OK ✅' : JSON.stringify(data));
console.log('\nPipeline running:');
console.log('  1. Apify search for "home renovation contractors near me" in "Kuala Lumpur, Malaysia" (~60-120s)');
console.log('  2. Dedup + fan-out prospect_found events via QStash');
console.log('  3. For each lead: stagger_outreach → ask_ai → send_whatsapp');
console.log('\nCheck results in ~3 minutes...');
