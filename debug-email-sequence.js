
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.SUPABASE_SERVICE_KEY
);

async function checkCustomers() {
  console.log('🔍 Checking recent customers...');

  const { data: customers, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error fetching customers:', error);
    return;
  }

  if (customers.length === 0) {
    console.log('⚠️ No customers found.');
    return;
  }

  console.log('\nRecent Customers Status:');
  console.table(customers.map(c => ({
    email: c.email,
    status: c.status,
    source: c.source,
    day: c.email_sequence_day,
    marketing: c.accepts_marketing,
    next_email: c.next_email_at ? new Date(c.next_email_at).toLocaleString() : 'None'
  })));

  // Check if any are ready for processing
  const now = new Date().toISOString();
  const ready = customers.filter(c => 
    c.status === 'lead' && 
    c.source === 'lead_magnet' && 
    c.accepts_marketing && 
    c.email_sequence_day < 5 &&
    c.next_email_at <= now
  );

  console.log(`\n📊 Ready to process: ${ready.length}`);
  if (ready.length > 0) {
    console.log('These emails should be picked up by the processor:');
    ready.forEach(c => console.log(` - ${c.email}`));
  } else {
    console.log('No emails are currently due. (This explains "No emails to send")');
  }
}

checkCustomers();
