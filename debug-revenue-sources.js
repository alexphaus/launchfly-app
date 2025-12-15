
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkRevenue() {
  console.log('Checking revenue sources...');

  // 1. Check Orders
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, total_amount, created_at, status, stripe_session_id')
    .eq('status', 'fulfilled');
    
  if (ordersError) console.error('Orders Error:', ordersError);
  
  console.log('\n--- ORDERS TABLE ---');
  console.log(`Count: ${orders?.length || 0}`);
  let ordersTotal = 0;
  orders?.forEach(o => {
    console.log(`- $${o.total_amount} (${o.created_at}) [Session: ${o.stripe_session_id}]`);
    ordersTotal += Number(o.total_amount) || 0;
  });
  console.log(`Total from Orders: $${ordersTotal}`);

  // 2. Check Platform Subscriptions
  const { data: subs, error: subsError } = await supabase
    .from('platform_subscriptions')
    .select('id, amount, stripe_session_id, payment_status, created_at, plan')
    .eq('payment_status', 'completed');

  if (subsError) console.error('Subs Error:', subsError);

  console.log('\n--- PLATFORM SUBSCRIPTIONS TABLE ---');
  console.log(`Count: ${subs?.length || 0}`);
  let subsTotal = 0;
  subs?.forEach(s => {
    console.log(`- $${s.amount} (${s.created_at}) Plan: ${s.plan} [Session: ${s.stripe_session_id}]`);
    subsTotal += Number(s.amount) || 0;
  });
  console.log(`Total from Subscriptions: $${subsTotal}`);

  // 3. Calculate Merged Total (Logic from Analytics Page)
  const processedSessions = new Set();
  let grandTotal = 0;

  orders?.forEach(o => {
    grandTotal += (Number(o.total_amount) || 0);
    if (o.stripe_session_id) processedSessions.add(o.stripe_session_id);
  });

  subs?.forEach(s => {
    if (s.stripe_session_id && !processedSessions.has(s.stripe_session_id)) {
      grandTotal += (Number(s.amount) || 0);
      processedSessions.add(s.stripe_session_id);
      console.log(`  -> Added unique subscription: $${s.amount}`);
    } else {
      console.log(`  -> Skipped duplicate subscription (already in orders): $${s.amount}`);
    }
  });

  console.log('\n--- FINAL CALCULATION ---');
  console.log(`Grand Total displayed on Dashboard: $${grandTotal}`);
}

checkRevenue();
