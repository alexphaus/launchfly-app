import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log('🔍 DEBUG: Checking fulfillment for recent sales...');

const saleIds = [
  '0c415e6c-45f5-4e67-9832-39dda656467d',
  'ce995df6-6890-4dfe-b7a8-6b17a6399bcc',
  '47ee1699-183b-4720-8311-db1cb2b682d2'
];

console.log('\n=== CHECKING FULFILLMENT RECORDS ===');
const { data: fulfillments, error: fulfillmentError } = await supabase
  .from('fulfillments')
  .select('*')
  .in('sale_id', saleIds);

if (fulfillmentError) {
  console.error('❌ Error fetching fulfillments:', fulfillmentError);
} else if (!fulfillments || fulfillments.length === 0) {
  console.log('❌ NO FULFILLMENT RECORDS FOUND!');
  console.log('   This confirms the webhook is NOT triggering fulfillment.');
} else {
  console.log(`✅ Found ${fulfillments.length} fulfillment records:`);
  fulfillments.forEach(f => {
    console.log(`  - Sale ID: ${f.sale_id}, Status: ${f.status}, Created: ${new Date(f.created_at).toLocaleString()}`);
  });
}

console.log('\n=== CHECKING FULFILLMENT CONTENT ===');
const { data: content, error: contentError } = await supabase
  .from('fulfillment_content')
  .select('*')
  .eq('recipient_email', 'axpg31@gmail.com');

if (contentError) {
  console.error('❌ Error fetching content:', contentError);
} else if (!content || content.length === 0) {
  console.log('❌ NO FULFILLMENT CONTENT FOUND!');
} else {
  console.log(`✅ Found ${content.length} content records:`);
  content.forEach(c => {
    console.log(`  - Content ID: ${c.id}, Type: ${c.content_type}, Email Sent: ${c.email_sent}, Created: ${new Date(c.created_at).toLocaleString()}`);
  });
}
