import 'dotenv/config';

const token = process.env.QSTASH_TOKEN;
const url = process.env.QSTASH_URL;
const targetUrl = 'https://app.launchfly.ai/api/assistants/trigger?businessId=06203464-2b76-4468-8d2e-6630ab0ed71a';

// Delete the 8am ET schedule I created
const del = await fetch(`${url}/v2/schedules/scd_5uDLnJKnVF1b1k4t2g1Z6A199e6C`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}` },
});
console.log('Deleted 8am ET schedule:', del.status);

// Create correct one: 8am Bangkok (SE Asia +7), Mon-Sun (you had all days selected)
const res = await fetch(`${url}/v2/schedules/${targetUrl}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Upstash-Cron': '0 8 * * 1,2,3,4,5',
    'Upstash-Retries': '1',
    'Upstash-Timezone': 'Asia/Bangkok',
  },
  body: JSON.stringify({ event: 'daily_schedule' }),
});
const data = await res.json();
console.log('Created:', JSON.stringify(data));
console.log('\n8:00 AM Bangkok time, Mon-Fri');

// Verify
if (data.scheduleId) {
  const check = await fetch(`${url}/v2/schedules/${data.scheduleId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const info = await check.json();
  console.log('Verified cron:', info.cron, '| dest:', info.destination?.substring(0, 60)); 
}
