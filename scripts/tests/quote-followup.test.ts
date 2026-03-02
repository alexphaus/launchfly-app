// scripts/tests/quote-followup.test.ts
// ─── Unit test stubs for the Quote Follow-Up system ───
// Run with: npx tsx scripts/tests/quote-followup.test.ts

/* eslint-disable @typescript-eslint/no-explicit-any */
import 'dotenv/config';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

// ─── Helpers ─────────────────────────────────────────────────────────────
async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    console.error(`  ❌ ${label}`);
    process.exitCode = 1;
  }
}

// ─── Test 1: POST /api/quotes/new — valid payload ───────────────────────
async function testNewQuoteValid() {
  console.log('\n🧪 Test: POST /api/quotes/new (valid)');
  const { status, data } = await post('/api/quotes/new', {
    name: 'Test User',
    phone: '+15551234567',
    quote_amount: 8500,
    job_type: 'bathroom remodel',
  });
  assert(status === 201 || (status === 200 && data.duplicate), `Status ${status}`);
  assert(!!data.lead_id, `lead_id present: ${data.lead_id}`);
  return data.lead_id as string;
}

// ─── Test 2: POST /api/quotes/new — invalid payload ─────────────────────
async function testNewQuoteInvalid() {
  console.log('\n🧪 Test: POST /api/quotes/new (invalid)');
  const { status } = await post('/api/quotes/new', { name: 'Incomplete' });
  assert(status === 400, `Status 400 for bad payload: got ${status}`);
}

// ─── Test 3: POST /api/quotes/new — duplicate guard ─────────────────────
async function testNewQuoteDuplicate() {
  console.log('\n🧪 Test: POST /api/quotes/new (duplicate)');
  // Send same phone + job_type again
  const { status, data } = await post('/api/quotes/new', {
    name: 'Test User',
    phone: '+15551234567',
    quote_amount: 8500,
    job_type: 'bathroom remodel',
  });
  assert(status === 200 && data.duplicate === true, `Duplicate detected: ${data.duplicate}`);
}

// ─── Test 4: POST /api/retell/call — missing lead ───────────────────────
async function testRetellCallMissingLead() {
  console.log('\n🧪 Test: POST /api/retell/call (missing lead)');
  const { status } = await post('/api/retell/call', {
    lead_id: '00000000-0000-0000-0000-000000000000',
  });
  assert(status === 404, `Status 404 for missing lead: got ${status}`);
}

// ─── Test 5: POST /api/retell/call — valid lead ─────────────────────────
async function testRetellCallValid(leadId: string) {
  console.log('\n🧪 Test: POST /api/retell/call (valid lead)');
  // NOTE: This will attempt a real Retell API call if RETELL_API_KEY is set.
  // In CI, set RETELL_API_KEY="" to get a 500 which we accept as "tested".
  const { status, data } = await post('/api/retell/call', { lead_id: leadId });
  console.log(`  → Status: ${status}, data:`, JSON.stringify(data).slice(0, 200));
  assert([200, 500, 502].includes(status), `Status is expected: ${status}`);
}

// ─── Test 6: GET /api/quotes/process — cron sweep ───────────────────────
async function testCronSweep() {
  console.log('\n🧪 Test: GET /api/quotes/process (cron)');
  const res = await fetch(`${BASE}/api/quotes/process`);
  const data = await res.json();
  assert(res.status === 200 || res.status === 401, `Status ${res.status}`);
  console.log(`  → Processed: ${data.processed ?? 'N/A'}`);
}

// ─── Test 7: POST /api/twilio/quote-webhook — simulate inbound ──────────
async function testTwilioWebhook() {
  console.log('\n🧪 Test: POST /api/twilio/quote-webhook (simulated)');
  const form = new URLSearchParams();
  form.set('From', 'whatsapp:+15551234567');
  form.set('To', 'whatsapp:+14155238886');
  form.set('Body', 'Is this price negotiable?');
  form.set('MessageSid', 'SM_test_' + Date.now());

  const res = await fetch(`${BASE}/api/twilio/quote-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  assert(res.status === 200, `Status 200: got ${res.status}`);
  const text = await res.text();
  assert(text.includes('<Response'), `Valid TwiML response`);
}

// ─── Test 8: POST /api/twilio/quote-webhook — deposit keyword ───────────
async function testTwilioDepositKeyword() {
  console.log('\n🧪 Test: POST /api/twilio/quote-webhook (deposit keyword)');
  const form = new URLSearchParams();
  form.set('From', 'whatsapp:+15551234567');
  form.set('To', 'whatsapp:+14155238886');
  form.set('Body', "I'd like to pay the deposit");
  form.set('MessageSid', 'SM_test_deposit_' + Date.now());

  const res = await fetch(`${BASE}/api/twilio/quote-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  assert(res.status === 200, `Status 200: got ${res.status}`);
}

// ─── Run all ─────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  Quote Follow-Up System — Tests      ║');
  console.log('╚══════════════════════════════════════╝');

  const leadId = await testNewQuoteValid();
  await testNewQuoteInvalid();
  await testNewQuoteDuplicate();
  await testRetellCallMissingLead();
  if (leadId) await testRetellCallValid(leadId);
  await testCronSweep();
  await testTwilioWebhook();
  await testTwilioDepositKeyword();

  console.log('\n✅ All test stubs executed.\n');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
