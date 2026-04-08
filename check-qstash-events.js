require('dotenv').config({ path: '.env.local' });

(async () => {
  const qstashToken = process.env.QSTASH_TOKEN;
  const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';

  // Check recent QStash events/logs for Bisumaria schedules
  const scheduleIds = [
    'scd_5KT3JHJHBLnFRqb8Hi1m3YXYV9pg', // market scout (Sun)
    'scd_6DZTr84riPidJCFoLrgu9fbu1ru1',  // trends (Wed)
  ];

  for (const schedId of scheduleIds) {
    console.log('=== Schedule:', schedId, '===');
    // Get schedule details
    const detRes = await fetch(qstashBase + '/v2/schedules/' + schedId, {
      headers: { Authorization: 'Bearer ' + qstashToken },
    });
    if (detRes.ok) {
      const det = await detRes.json();
      console.log('Cron:', det.cron, '| Paused:', det.isPaused, '| Created:', det.createdAt);
      console.log('Last run:', det.lastRunAt || 'never');
      console.log('Retries:', det.retries);
    } else {
      console.log('Failed to get details:', detRes.status);
    }
    console.log('');
  }

  // Check QStash events/messages log
  console.log('=== Recent QStash events ===');
  const eventsRes = await fetch(qstashBase + '/v2/events?count=20', {
    headers: { Authorization: 'Bearer ' + qstashToken },
  });
  if (eventsRes.ok) {
    const eventsData = await eventsRes.json();
    const events = eventsData.events || eventsData;
    if (Array.isArray(events)) {
      for (const e of events) {
        const isBisu = (e.url || e.destination || '').includes('9187ade5');
        if (isBisu || (e.scheduleId && scheduleIds.includes(e.scheduleId))) {
          console.log('  Time:', e.time || e.createdAt, '| State:', e.state);
          console.log('  URL:', (e.url || e.destination || '').substring(0, 120));
          console.log('  ScheduleId:', e.scheduleId);
          console.log('  Response:', e.responseStatus, e.responseBody?.substring(0, 200));
          console.log('');
        }
      }
    } else {
      console.log('Events response:', JSON.stringify(eventsData).substring(0, 300));
    }
  } else {
    console.log('Events fetch failed:', eventsRes.status, await eventsRes.text().catch(() => ''));
  }

  // Also check DLQ (dead letter queue)
  console.log('\n=== QStash DLQ (failed messages) ===');
  const dlqRes = await fetch(qstashBase + '/v2/dlq?count=10', {
    headers: { Authorization: 'Bearer ' + qstashToken },
  });
  if (dlqRes.ok) {
    const dlqData = await dlqRes.json();
    const msgs = dlqData.messages || dlqData;
    if (Array.isArray(msgs) && msgs.length > 0) {
      for (const m of msgs) {
        console.log('  MessageId:', m.messageId, '| DlqId:', m.dlqId);
        console.log('  URL:', (m.url || m.destination || '').substring(0, 120));
        console.log('  ResponseStatus:', m.responseStatus);
        console.log('  ResponseBody:', (m.responseBody || '').substring(0, 200));
        console.log('  Created:', m.createdAt);
        console.log('');
      }
    } else {
      console.log('DLQ:', JSON.stringify(dlqData).substring(0, 300));
    }
  } else {
    console.log('DLQ fetch failed:', dlqRes.status);
  }
})();
