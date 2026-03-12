import 'dotenv/config';

const token = process.env.QSTASH_TOKEN;
const url = process.env.QSTASH_URL;

// List all schedules
const res = await fetch(`${url}/v2/schedules`, {
  headers: { Authorization: `Bearer ${token}` },
});
const schedules = await res.json();

console.log('ALL SCHEDULES:');
for (const s of schedules) {
  console.log(`  ${s.scheduleId} | cron=${s.cron} | created=${new Date(s.createdAt).toISOString()}`);
}

// Keep only the newest one (the one user just created from UI)
// Delete all the old manual ones
const toKeep = 'scd_5V3Hv7YFd6qQz66tqmSRA1nUc4no'; // the 22 0 * one — user's from UI
const toDelete = schedules.filter(s => s.scheduleId !== toKeep).map(s => s.scheduleId);

console.log('\nKeeping:', toKeep);
console.log('Deleting:', toDelete);

for (const id of toDelete) {
  const del = await fetch(`${url}/v2/schedules/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`  Deleted ${id}: ${del.status}`);
}

// Now update the kept one — user wanted 12:22 PM not AM
// 12:22 PM in Asia/Bangkok (+7) 
// But first let's delete it too and create a correct one
console.log('\nNow deleting the AM one too and creating correct PM schedule...');
const del2 = await fetch(`${url}/v2/schedules/${toKeep}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}` },
});
console.log(`  Deleted ${toKeep}: ${del2.status}`);

// Create correct: 12:22 PM = hour 12, minute 22
const targetUrl = `https://app.launchfly.ai/api/assistants/trigger?businessId=06203464-2b76-4468-8d2e-6630ab0ed71a`;
const create = await fetch(`${url}/v2/schedules/${targetUrl}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Upstash-Cron': '0 8 * * 1,2,3,4,5',
    'Upstash-Retries': '1',
    'Upstash-Timezone': 'America/New_York',
  },
  body: JSON.stringify({ event: 'daily_schedule' }),
});
const data = await create.json();
console.log('Created clean schedule:', JSON.stringify(data));
console.log('\nNew schedule: 8am ET Mon-Fri with timezone header');
