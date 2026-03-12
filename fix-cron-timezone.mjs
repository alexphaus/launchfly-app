import 'dotenv/config';

const token = process.env.QSTASH_TOKEN;
const url = process.env.QSTASH_URL;
const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';
const targetUrl = `https://app.launchfly.ai/api/assistants/trigger?businessId=${businessId}`;

// Step 1: Delete old schedule
const del = await fetch(`${url}/v2/schedules/scd_6dkTeNC1zVV8P6X6pZvHMy2VNhey`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}` },
});
console.log('Delete old:', del.status);

// Step 2: Create new with correct timezone
const res = await fetch(`${url}/v2/schedules/${targetUrl}`, {
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

const data = await res.json();
console.log('Create status:', res.status);
console.log('Response:', JSON.stringify(data, null, 2));

if (data.scheduleId) {
  // Step 3: Verify
  const check = await fetch(`${url}/v2/schedules/${data.scheduleId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const info = await check.json();
  console.log('\nNext fire:', new Date(info.nextScheduleTime).toISOString());
  console.log('Schedule ID:', data.scheduleId);
}
