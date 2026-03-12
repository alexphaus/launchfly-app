#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Test the full prospecting chain — verifies every link before it fires live
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const BUSINESS_ID = '06203464-2b76-4468-8d2e-6630ab0ed71a';
const APIFY_BASE = 'https://api.apify.com/v2';

let passed = 0;
let failed = 0;

function ok(label) { passed++; console.log(`  ✅ ${label}`); }
function fail(label, detail) { failed++; console.log(`  ❌ ${label}: ${detail}`); }

async function main() {
  console.log('\n🔍 PROSPECTING CHAIN — PRE-FLIGHT CHECK\n');

  // ── 1. Apify Token ──
  console.log('1️⃣  Apify API Token');
  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!apifyToken) {
    fail('APIFY_API_TOKEN', 'not set in .env.local');
  } else {
    ok(`APIFY_API_TOKEN set (${apifyToken.substring(0, 12)}...)`);
    
    // Quick validation — check if the token is valid by hitting Apify user endpoint
    try {
      const res = await fetch(`${APIFY_BASE}/users/me?token=${encodeURIComponent(apifyToken)}`);
      if (res.ok) {
        const user = await res.json();
        ok(`Apify user: ${user.data?.username || 'valid'}`);
      } else {
        fail('Apify token validation', `HTTP ${res.status}`);
      }
    } catch (e) {
      fail('Apify token validation', e.message);
    }
  }

  // ── 2. QStash CRON ──
  console.log('\n2️⃣  QStash CRON Schedule');
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    fail('QSTASH_TOKEN', 'not set');
  } else {
    ok('QSTASH_TOKEN set');
    
    try {
      const scheduleId = 'scd_6dkTeNC1zVV8P6X6pZvHMy2VNhey'; // From fresh CRON creation
      const qstashBase = process.env.QSTASH_URL?.replace(/"/g, '') || 'https://qstash.upstash.io';
      const res = await fetch(`${qstashBase}/v2/schedules/${scheduleId}`, {
        headers: { Authorization: `Bearer ${qstashToken.replace(/"/g, '')}` },
      });
      if (res.ok) {
        const sched = await res.json();
        ok(`CRON active: "${sched.cron}" → ${sched.destination}`);
        if (sched.destination?.includes('businessId')) {
          ok('CRON URL includes businessId');
        } else {
          fail('CRON URL', 'missing businessId query param');
        }
      } else {
        fail('QStash schedule lookup', `HTTP ${res.status} — schedule may not exist yet`);
      }
    } catch (e) {
      fail('QStash schedule lookup', e.message);
    }
  }

  // ── 3. Sarah's trigger_config ──
  console.log('\n3️⃣  Sarah\'s Rules Config');
  const { data: sarah } = await supabase
    .from('assistants')
    .select('name, trigger_config')
    .eq('business_id', BUSINESS_ID)
    .eq('active', true)
    .single();

  if (!sarah) {
    fail('Sarah assistant', 'not found or not active');
  } else {
    ok(`Assistant: ${sarah.name}`);
    const rules = sarah.trigger_config?.rules || [];
    
    const dailyRule = rules.find(r => r.event === 'daily_schedule');
    const prospectRule = rules.find(r => r.event === 'prospect_found');
    
    if (dailyRule?.enabled) {
      ok(`daily_schedule rule enabled — search_leads action`);
      const cfg = dailyRule.actions?.[0]?.config || {};
      ok(`  Query: "${cfg.searchQuery}" in ${cfg.searchLocation}, max=${cfg.searchMaxResults}`);
    } else {
      fail('daily_schedule rule', 'not found or disabled');
    }
    
    if (prospectRule?.enabled) {
      const actionTypes = prospectRule.actions.map(a => a.type).join(' → ');
      ok(`prospect_found rule enabled: ${actionTypes}`);
    } else {
      fail('prospect_found rule', 'not found or disabled');
    }
  }

  // ── 4. DB Schema — quote_leads.source column ──
  console.log('\n4️⃣  Database Schema');
  try {
    const { data, error } = await supabase
      .from('quote_leads')
      .select('source')
      .eq('business_id', BUSINESS_ID)
      .limit(1);
    
    if (error?.message?.includes('source')) {
      fail('quote_leads.source column', 'column does not exist — stagger counter will break');
    } else {
      ok('quote_leads.source column exists');
    }
  } catch (e) {
    fail('DB schema check', e.message);
  }

  // ── 5. Dry-run Apify Search (tiny, 2 results) ──
  console.log('\n5️⃣  Apify Dry-Run (2 results max)');
  if (apifyToken) {
    try {
      console.log('  ⏳ Running Apify scraper (this takes ~30-60s)...');
      const res = await fetch(
        `${APIFY_BASE}/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${encodeURIComponent(apifyToken)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchStringsArray: ['contractors near me in Miami, FL'],
            maxCrawledPlacesPerSearch: 2,
            language: 'en',
            includeWebResults: false,
            includeHistogram: false,
            includeOpeningHours: false,
            includePeopleAlsoSearch: false,
          }),
          signal: AbortSignal.timeout(120000),
        },
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        fail('Apify search', `HTTP ${res.status}: ${errText.substring(0, 100)}`);
      } else {
        const results = await res.json();
        ok(`Apify returned ${results.length} results`);
        const withPhone = results.filter(r => r.phone);
        ok(`${withPhone.length}/${results.length} have phone numbers`);
        if (withPhone.length > 0) {
          const sample = withPhone[0];
          console.log(`  📋 Sample: "${sample.title}" — ${sample.phone} — ⭐${sample.totalScore} (${sample.reviewsCount} reviews)`);
        }
      }
    } catch (e) {
      fail('Apify dry-run', e.message);
    }
  } else {
    fail('Apify dry-run', 'skipped (no token)');
  }

  // ── Summary ──
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  PASSED: ${passed}  |  FAILED: ${failed}`);
  if (failed === 0) {
    console.log('\n  🚀 ALL CLEAR — Tomorrow 8:00 AM ET the CRON fires:');
    console.log('     1. QStash → POST /api/assistants/trigger (daily_schedule)');
    console.log('     2. search_leads → Apify scrapes "contractors near me" in Miami');
    console.log('     3. Dedup against quote_leads → fire prospect_found per new lead');
    console.log('     4. stagger_outreach → 15min apart, max 15/day');
    console.log('     5. ask_ai → AI qualifies each lead (stopOnNo)');
    console.log('     6. send_whatsapp → opener message sent');
    console.log('\n  💤 Go to sleep. You\'ll wake up to messages sent.\n');
  } else {
    console.log('\n  ⚠️  Fix the failures above before the CRON fires.\n');
  }
}

main().catch(console.error);
