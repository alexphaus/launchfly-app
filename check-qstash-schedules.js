require('dotenv').config({ path: '.env.local' });

(async () => {
  const qstashToken = process.env.QSTASH_TOKEN;
  const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
  console.log('Using QStash base:', qstashBase);

  // List all schedules
  const res = await fetch(qstashBase + '/v2/schedules', {
    headers: { Authorization: 'Bearer ' + qstashToken },
  });
  const schedules = await res.json();
  
  if (!Array.isArray(schedules)) {
    console.log('ERROR:', JSON.stringify(schedules).substring(0, 300));
    return;
  }

  console.log('Total schedules:', schedules.length);
  for (const s of schedules) {
    const dest = s.destination || '';
    let bodyParsed = null;
    if (s.body) {
      try { bodyParsed = JSON.parse(Buffer.from(s.body, 'base64').toString()); } catch {}
      if (!bodyParsed) try { bodyParsed = JSON.parse(s.body); } catch {}
    }
    console.log('---');
    console.log('ID:', s.scheduleId, '| Cron:', s.cron);
    console.log('Dest:', dest.substring(0, 140));
    if (bodyParsed) console.log('Body:', JSON.stringify(bodyParsed).substring(0, 200));
  }
})();
