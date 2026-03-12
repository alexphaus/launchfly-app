import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

const QSTASH_BASE = process.env.QSTASH_URL;
const TOKEN = process.env.QSTASH_TOKEN;

// Check the new schedule
const res = await fetch(`${QSTASH_BASE}/v2/schedules`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const schedules = await res.json();
for (const s of schedules) {
  console.log('Schedule:', s.scheduleId, 'cron:', s.cron);
  console.log('  Next fire:', new Date(s.nextScheduleTime).toISOString());
  console.log('  isPaused:', s.isPaused);
}

// Check recent events to see if the manual trigger was delivered
console.log('\n--- Recent Events ---');
const evRes = await fetch(`${QSTASH_BASE}/v2/events?count=10`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const evData = await evRes.json();
const events = Array.isArray(evData) ? evData : evData.events || [];
events.forEach(e => {
  const time = new Date(e.time).toISOString();
  console.log(time, e.state, e.url?.includes('trigger') ? 'trigger' : e.url?.substring(0, 60));
});
