import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const token = process.env.QSTASH_TOKEN;
const url = process.env.QSTASH_URL;

// Get more event details
const res = await fetch(`${url}/v2/events?count=30`, {
  headers: { Authorization: `Bearer ${token}` },
});
const events = await res.json();
const list = events.events || events;

console.log(`=== QStash Events (${list.length}) ===`);
list.forEach((e, i) => {
  const time = new Date(e.time).toISOString();
  const dest = e.url?.replace('https://app.launchfly.ai', '') || '?';
  console.log(`${i+1}. ${e.state.padEnd(10)} | ${time} | ${dest.substring(0, 70)} | http:${e.responseStatus || '?'} | body:${e.responseBody?.substring(0,120) || '?'}`);
});
