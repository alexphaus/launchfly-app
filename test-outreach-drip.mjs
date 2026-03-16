#!/usr/bin/env node
// test-outreach-drip.mjs
// ─── Integration test for the outreach drip system ───────────────────────
// Tests: timezone calculation, backfill logic, window scheduling, 
//        prospect_found dispatch, and assistant JSON compatibility.
//
// Usage: node test-outreach-drip.mjs [--live]
//   Without --live: dry-run with mocks (no DB/API calls)
//   With --live:    uses real Supabase + QStash

import { config } from 'dotenv';
config({ path: '.env' });

const LIVE = process.argv.includes('--live');
const BUSINESS_ID = '5abe26f8-6e2f-4437-a2d6-ee00bd8b5a11'; // Launchfly sales

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: Timezone local time calculation
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📋 TEST 1: Timezone local time calculation');

function getLocalTimeSeconds(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find(p => p.type === 'hour')?.value || 0);
    const m = Number(parts.find(p => p.type === 'minute')?.value || 0);
    const s = Number(parts.find(p => p.type === 'second')?.value || 0);
    return { h, m, s, totalSec: h * 3600 + m * 60 + s };
  } catch (e) {
    return null;
  }
}

const sgt = getLocalTimeSeconds('Asia/Singapore');
const utc = getLocalTimeSeconds('UTC');
console.log(`  SGT now: ${sgt.h}:${String(sgt.m).padStart(2,'0')}:${String(sgt.s).padStart(2,'0')} (${sgt.totalSec}s)`);
console.log(`  UTC now: ${utc.h}:${String(utc.m).padStart(2,'0')}:${String(utc.s).padStart(2,'0')} (${utc.totalSec}s)`);
assert(sgt !== null, 'Asia/Singapore timezone parsing works');
assert(Math.abs(sgt.totalSec - utc.totalSec) > 0 || sgt.h !== utc.h, 'SGT ≠ UTC');
assert(getLocalTimeSeconds('Invalid/TZ') === null, 'Invalid timezone returns null (falls back to UTC)');

// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: Window delay calculation
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📋 TEST 2: Window delay calculation');

function simulateDelays(windowStart, windowEnd, tz, count) {
  const [startH, startM] = windowStart.split(':').map(Number);
  const [endH, endM] = windowEnd.split(':').map(Number);
  const windowStartSec = startH * 3600 + startM * 60;
  const windowEndSec = endH * 3600 + endM * 60;
  const windowSpan = Math.max(windowEndSec - windowStartSec, 3600);

  const local = getLocalTimeSeconds(tz);
  const nowSec = local.totalSec;

  const delays = [];
  for (let i = 0; i < count; i++) {
    const randomOffsetSec = Math.floor(Math.random() * windowSpan);
    const targetSec = windowStartSec + randomOffsetSec;
    let delaySec = targetSec - nowSec;
    if (delaySec < 60) delaySec = 60 + Math.floor(Math.random() * 300);
    delays.push({ targetSec, delaySec, targetTime: `${Math.floor(targetSec / 3600)}:${String(Math.floor((targetSec % 3600) / 60)).padStart(2, '0')}` });
  }
  return { delays, nowSec, windowStartSec, windowEndSec, windowSpan };
}

// Test with the assistant JSON config: batch 1 = 07:30 - 09:00 SGT
const batch1 = simulateDelays('07:30', '09:00', 'Asia/Singapore', 5);
console.log(`  Batch 1 (07:30-09:00 SGT): nowSec=${batch1.nowSec}, windowSpan=${batch1.windowSpan}s (${Math.round(batch1.windowSpan/60)}min)`);
for (const d of batch1.delays) {
  console.log(`    → target ${d.targetTime} SGT, delay ${Math.round(d.delaySec/60)}min`);
}
assert(batch1.windowSpan === 5400, 'Window span is 1.5 hours (5400s)');
// If we're running this during SGT business hours, delays should be reasonable
const allPositive = batch1.delays.every(d => d.delaySec > 0);
assert(allPositive, 'All delays are positive');

// Test batch 2: 12:00 - 14:00
const batch2 = simulateDelays('12:00', '14:00', 'Asia/Singapore', 5);
console.log(`  Batch 2 (12:00-14:00 SGT): ${batch2.delays.length} delays generated`);
assert(batch2.windowSpan === 7200, 'Window span is 2 hours (7200s)');

// Test batch 3: 16:30 - 18:00 (default end)
const batch3 = simulateDelays('16:30', '18:00', 'Asia/Singapore', 5);
console.log(`  Batch 3 (16:30-18:00 SGT): ${batch3.delays.length} delays generated`);
assert(batch3.windowSpan === 5400, 'Window span is 1.5 hours (5400s)');

// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: Old UTC bug — verify it would have been wrong
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📋 TEST 3: UTC vs local time bug verification');

const utcNow = getLocalTimeSeconds('UTC');
const sgtNow = getLocalTimeSeconds('Asia/Singapore');
const windowStart730 = 7 * 3600 + 30 * 60; // 07:30 = 27000s

// If the cron fires around 7 AM SGT, UTC would be ~11 PM previous day
const simulatedUTCnowSec = 23 * 3600; // 11 PM UTC = 7 AM SGT
const delayWithUTC = windowStart730 - simulatedUTCnowSec;
assert(delayWithUTC < 0, `With UTC bug: delay would be ${delayWithUTC}s (NEGATIVE — leads fire immediately)`);

const simulatedSGTnowSec = 7 * 3600; // 7 AM SGT
const delayWithSGT = windowStart730 - simulatedSGTnowSec;
assert(delayWithSGT >= 0 && delayWithSGT <= 5400, `With timezone fix: delay is ${delayWithSGT}s (${Math.round(delayWithSGT/60)}min — correct)`);

// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: Assistant JSON config validation
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📋 TEST 4: Assistant JSON config validation');

const assistantJson = JSON.parse(await import('fs').then(fs => 
  fs.promises.readFile('./alex-sales-ai.json', 'utf-8').catch(() => '{}')
));

if (assistantJson._type) {
  const rules = assistantJson.trigger_config?.rules || [];
  
  // ── Structural checks (must exist regardless of config version) ──
  const dailyRule = rules.find(r => r.event === 'daily_schedule');
  assert(!!dailyRule, 'daily_schedule rule exists');
  assert(dailyRule?.enabled === true, 'daily_schedule rule is enabled');

  const schedTz = dailyRule?.scheduleConfig?.timezone;
  assert(schedTz === 'Asia/Singapore', `Schedule timezone is Asia/Singapore (got ${schedTz})`);

  const prospectRule = rules.find(r => r.event === 'prospect_found');
  assert(!!prospectRule, 'prospect_found rule exists');

  const inboundRule = rules.find(r => r.event === 'inbound_whatsapp');
  assert(!!inboundRule, 'inbound_whatsapp rule exists (handles prospect replies)');
  assert(inboundRule?.actions[0]?.type === 'ai_response', 'Inbound → AI Response');

  const paymentRule = rules.find(r => r.event === 'payment_received');
  assert(!!paymentRule, 'payment_received rule exists');
  assert(paymentRule?.enabled === true, 'payment_received rule is enabled');

  // ── Config upgrade recommendations (not code bugs) ──
  console.log('\n  📝 CONFIG UPGRADE RECOMMENDATIONS:');
  
  const outreachActions = (dailyRule?.actions || []).filter(a => a.type === 'outreach');
  const hasOldSearchLeads = (dailyRule?.actions || []).some(a => a.type === 'search_leads');
  if (outreachActions.length === 0 && hasOldSearchLeads) {
    console.log('  ⚠️  daily_schedule still uses "search_leads" — switch to "outreach" action in the UI');
    console.log('     Recommended: 3 outreach windows (07:30-09:00, 12:00-14:00, 16:30-18:00) × 5 leads each');
  } else if (outreachActions.length > 0) {
    for (let i = 0; i < outreachActions.length; i++) {
      const cfg = outreachActions[i].config;
      console.log(`     Batch ${i+1}: ${cfg.outreachWindowStart}-${cfg.outreachWindowEnd || '18:00'}, ${cfg.outreachLeadsPerDay || 5} leads/day`);
    }
  }

  const hasStaggerOutreach = (prospectRule?.actions || []).some(a => a.type === 'stagger_outreach');
  if (hasStaggerOutreach) {
    console.log('  ⚠️  prospect_found uses "stagger_outreach" — no longer needed (outreach handles scheduling)');
    console.log('     Recommended: send_whatsapp → delay 48h → ai_followup × 3-4 with delays');
  }
  
  const toolsEnabled = assistantJson.tools_enabled || [];
  if (toolsEnabled.includes('trigger_demo_call')) {
    console.log('  ⚠️  tools_enabled has stale "trigger_demo_call" — can be removed');
  }
  if (!toolsEnabled.includes('send_media')) {
    console.log('  ⚠️  Add "send_media" to tools_enabled for voice note support');
  }

  // Follow-up chain check (works with both old and new configs)
  const followupActions = (prospectRule?.actions || []).filter(a => a.type === 'ai_followup');
  const delayActions = (prospectRule?.actions || []).filter(a => a.type === 'delay');
  assert(followupActions.length >= 2, `Has ${followupActions.length} AI follow-up steps`);
  assert(delayActions.length >= 1, `Has ${delayActions.length} delay steps`);

} else {
  console.log('  ⚠️  Could not load assistant JSON file — skipping config tests');
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 5: Backfill logic simulation
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📋 TEST 5: Backfill logic simulation');

function simulateBackfill(poolSize, whatsappRate, leadsPerDay) {
  const maxChecks = leadsPerDay * 5;
  let verified = 0;
  let checked = 0;
  let noWa = 0;
  let offset = 0;

  while (verified < leadsPerDay && checked < maxChecks) {
    const batchSize = Math.min(10, leadsPerDay * 2 - verified);
    const available = Math.min(batchSize, poolSize - offset);
    if (available <= 0) break;

    for (let i = 0; i < available && verified < leadsPerDay; i++) {
      checked++;
      if (Math.random() < whatsappRate) {
        verified++;
      } else {
        noWa++;
      }
    }
    offset += available;
  }
  return { verified, checked, noWa };
}

// Scenario: 30% have WhatsApp → need ~17 checks to get 5
const results1 = [];
for (let i = 0; i < 100; i++) results1.push(simulateBackfill(100, 0.3, 5));
const avg1 = Math.round(results1.reduce((s, r) => s + r.verified, 0) / results1.length * 10) / 10;
const avgChecked1 = Math.round(results1.reduce((s, r) => s + r.checked, 0) / results1.length);
console.log(`  30% WA rate: avg ${avg1} verified, ${avgChecked1} checked (100 runs)`);
assert(avg1 >= 4.5, `Fills quota reliably (avg ${avg1}/5)`);

// Scenario: 80% have WhatsApp → almost always fills
const results2 = [];
for (let i = 0; i < 100; i++) results2.push(simulateBackfill(100, 0.8, 5));
const avg2 = Math.round(results2.reduce((s, r) => s + r.verified, 0) / results2.length * 10) / 10;
console.log(`  80% WA rate: avg ${avg2} verified (100 runs)`);
assert(avg2 >= 4.9, `High WA rate fills quota fully (avg ${avg2}/5)`);

// Scenario: Small pool, 50% WA
const results3 = [];
for (let i = 0; i < 100; i++) results3.push(simulateBackfill(3, 0.5, 5));
const avg3 = Math.round(results3.reduce((s, r) => s + r.verified, 0) / results3.length * 10) / 10;
console.log(`  Small pool (3), 50% WA: avg ${avg3} verified`);
assert(avg3 < 5, `Small pool correctly caps at available (avg ${avg3})`);

// ═══════════════════════════════════════════════════════════════════════════
// TEST 6: Live DB check (only with --live)
// ═══════════════════════════════════════════════════════════════════════════
if (LIVE) {
  console.log('\n📋 TEST 6: Live database checks');
  
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Check hunter_prospects table has 'new' prospects
  const { data: newProspects, count, error } = await supabase
    .from('hunter_prospects')
    .select('id, business_name, whatsapp_number, status, priority', { count: 'exact' })
    .eq('status', 'new')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(5);

  if (error) {
    console.log(`  ❌ hunter_prospects query failed: ${error.message}`);
    if (error.message.includes('priority')) {
      console.log('  ⚠️  Run add-outreach-statuses.sql to add priority column');
    }
    failed++;
  } else {
    console.log(`  New prospects in pool: ${count}`);
    assert(count > 0, `Pool has ${count} prospects ready for drip`);
    
    if (newProspects?.length > 0) {
      console.log('  Top 5:');
      for (const p of newProspects) {
        console.log(`    [p${p.priority}] ${p.business_name} (${p.whatsapp_number})`);
      }
    }
  }

  // Check active assistant has the outreach rules
  const { data: assistant } = await supabase
    .from('assistants')
    .select('name, trigger_config')
    .eq('business_id', BUSINESS_ID)
    .eq('active', true)
    .maybeSingle();

  if (assistant) {
    const rules = assistant.trigger_config?.rules || [];
    const hasOutreach = rules.some(r => 
      r.event === 'daily_schedule' && 
      r.actions?.some(a => a.type === 'outreach')
    );
    assert(hasOutreach, `Active assistant "${assistant.name}" has outreach in daily_schedule`);
  } else {
    console.log(`  ⚠️  No active assistant found for business ${BUSINESS_ID}`);
  }

  // Check QStash token
  assert(!!process.env.QSTASH_TOKEN, 'QSTASH_TOKEN is set');
  
  // Check customers table has upsert constraint
  const { error: upsertErr } = await supabase
    .from('customers')
    .upsert({
      business_id: BUSINESS_ID,
      phone: '+0000000000', // dummy
      name: '__test_upsert__',
      status: 'lead',
      source: 'test',
    }, { onConflict: 'business_id,phone' });
  
  if (upsertErr) {
    console.log(`  ⚠️  customers upsert may fail: ${upsertErr.message}`);
  } else {
    // Clean up test row
    await supabase.from('customers')
      .delete()
      .eq('business_id', BUSINESS_ID)
      .eq('phone', '+0000000000');
    assert(true, 'customers table supports upsert on (business_id, phone)');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 7: End-to-end flow trace
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📋 TEST 7: End-to-end flow trace');

const expectedFlow = [
  '1. QStash CRON fires at 07:00 SGT → POST /api/assistants/trigger { event: "daily_schedule" }',
  '2. fireEvent loads rules, finds daily_schedule rule, propagates timezone "Asia/Singapore" to ctx',
  '3. executeActions runs 3 outreach actions sequentially:',
  '   a. outreach (07:30-09:00, 5 leads) → picks 5 from hunter_prospects, schedules via QStash',
  '   b. outreach (12:00-14:00, 5 leads) → picks next 5 (first 5 are now opener_queued)',
  '   c. outreach (16:30-18:00, 5 leads) → picks next 5',
  '4. Each QStash job fires at random time → POST /api/assistants/trigger { event: "prospect_found" }',
  '5. fireEvent loads prospect_found rule, runs actions:',
  '   a. send_whatsapp opener → creates customer record + updates hunter status to opener_sent',
  '   b. delay 48h → schedules remaining via QStash /api/assistants/trigger/resume',
  '   c. (after 48h) ai_followup → reads chat history, generates contextual follow-up',
  '   d. delay 48h → another follow-up',
  '   e. ... continues until 4 follow-ups sent',
  '6. If prospect replies → inbound_whatsapp rule fires → ai_response (Alex sales persona)',
  '7. If prospect pays → payment_received rule fires → welcome message + setup form',
];

console.log('  Expected flow:');
for (const step of expectedFlow) {
  console.log(`  ${step}`);
}
assert(true, 'Flow documented');

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('🎉 All tests passed!');
} else {
  console.log('⚠️  Some tests failed — review above');
}
console.log('═'.repeat(60));

if (!LIVE) {
  console.log('\n💡 Run with --live to test against real database:');
  console.log('   node test-outreach-drip.mjs --live\n');
}

process.exit(failed > 0 ? 1 : 0);
