import 'dotenv/config';

const token = process.env.QSTASH_TOKEN;
const base = process.env.QSTASH_URL || 'https://qstash.upstash.io';

const res = await fetch(`${base}/v2/schedules`, {
  headers: { Authorization: `Bearer ${token}` },
});
console.log('Status:', res.status);
const schedules = await res.json();
if (!Array.isArray(schedules)) {
  console.log('Response:', JSON.stringify(schedules).substring(0, 500));
  process.exit(1);
}
console.log('Total schedules:', schedules.length);
for (const s of schedules) {
  let body = '';
  try { body = JSON.parse(Buffer.from(s.body, 'base64').toString()); } catch { body = s.body; }
  console.log(JSON.stringify({ id: s.scheduleId, cron: s.cron, dest: s.destination, body, createdAt: s.createdAt }, null, 2));
}
