import 'dotenv/config';

const qstashToken = process.env.QSTASH_TOKEN?.replace(/"/g, '');
const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';
const targetUrl = `https://app.launchfly.ai/api/assistants/trigger?businessId=${businessId}`;
const cron = '0 8 * * 1,2,3,4,5';

console.log('Creating QStash CRON schedule...');
console.log(`  Target: ${targetUrl}`);
console.log(`  CRON: ${cron} (8am ET Mon-Fri)`);

const qstashBase = process.env.QSTASH_URL?.replace(/"/g, '') || 'https://qstash.upstash.io';
console.log(`  Base: ${qstashBase}`);

// QStash API: POST /v2/schedules/{destination}
const res = await fetch(`${qstashBase}/v2/schedules/${targetUrl}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${qstashToken}`,
    'Content-Type': 'application/json',
    'Upstash-Cron': cron,
    'Upstash-Retries': '1',
  },
  body: JSON.stringify({ event: 'daily_schedule' }),
});

const data = await res.json();
console.log(`Status: ${res.status}`);
console.log('Response:', JSON.stringify(data, null, 2));

if (data.scheduleId) {
  console.log(`\nCRON created! Schedule ID: ${data.scheduleId}`);
}
