const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // 1. Check Bisumaria's daily_schedule rules
  const bizId = '9187ade5-0f06-4633-ad84-71f5e41b2680';
  const { data: biz } = await sb.from('businesses').select('automation_rules').eq('id', bizId).single();
  const rules = biz?.automation_rules || [];
  const schedRules = rules.filter(r => r.event === 'daily_schedule');
  console.log('=== BISUMARIA daily_schedule rules ===');
  console.log('Total rules:', rules.length, '| daily_schedule:', schedRules.length);
  for (const r of schedRules) {
    console.log('  Rule:', r.id, '| enabled:', r.enabled, '| schedule:', JSON.stringify(r.scheduleConfig));
    console.log('  Actions:', r.actions?.map(a => a.type).join(', '));
  }

  // Also check the old assistant trigger_config for comparison
  const { data: assistants } = await sb.from('assistants')
    .select('id, name, active, trigger_config')
    .eq('business_id', bizId);
  console.log('\n=== Bisumaria assistants with daily_schedule in trigger_config ===');
  for (const a of assistants || []) {
    const tc = a.trigger_config || {};
    const tcRules = tc.rules || [];
    const tcSched = tcRules.filter(r => r.event === 'daily_schedule');
    if (tcSched.length > 0) {
      console.log('  Assistant:', a.name, '| active:', a.active, '| daily_schedule rules:', tcSched.length);
      for (const sr of tcSched) {
        console.log('    Rule:', sr.id, '| enabled:', sr.enabled, '| qstashScheduleId:', sr.scheduleConfig?.qstashScheduleId);
      }
    }
  }

  // 2. Check ALL QStash schedules
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) { console.log('No QSTASH_TOKEN'); return; }
  const res = await fetch('https://qstash.upstash.io/v2/schedules', {
    headers: { Authorization: 'Bearer ' + qstashToken },
  });
  const schedules = await res.json();
  console.log('\n=== ALL QStash schedules ===');
  console.log('Total:', Array.isArray(schedules) ? schedules.length : 'ERROR: ' + JSON.stringify(schedules).substring(0, 200));
  if (!Array.isArray(schedules)) return;
  for (const s of schedules) {
    const dest = s.destination || '';
    let bodyParsed = null;
    if (s.body) {
      try { bodyParsed = JSON.parse(Buffer.from(s.body, 'base64').toString()); } catch {}
      if (!bodyParsed) try { bodyParsed = JSON.parse(s.body); } catch {}
    }
    const isBisu = dest.includes(bizId) || (bodyParsed && bodyParsed.businessId === bizId);
    console.log('  ID:', s.scheduleId, '| Cron:', s.cron);
    console.log('  Dest:', dest.substring(0, 120));
    console.log('  Body:', JSON.stringify(bodyParsed)?.substring(0, 200) || '(empty)');
    if (isBisu) console.log('  ** BISUMARIA **');
    console.log('');
  }

  // 3. Check Launchfly's schedules too
  const lfBizId = '06203464-2b76-4468-8d2e-6630ab0ed71a';
  const { data: lfBiz } = await sb.from('businesses').select('automation_rules').eq('id', lfBizId).single();
  const lfRules = (lfBiz?.automation_rules || []).filter(r => r.event === 'daily_schedule');
  console.log('=== LAUNCHFLY daily_schedule rules ===');
  for (const r of lfRules) {
    console.log('  Rule:', r.id, '| enabled:', r.enabled, '| qstashScheduleId:', r.scheduleConfig?.qstashScheduleId);
  }
})();
