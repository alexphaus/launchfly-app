
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

async function fastForward() {
  // Get the most recent customer
  const { data: customers } = await supabase
    .from('customers')
    .select('id, email, email_sequence_day')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!customers || customers.length === 0) {
    console.log('No customers found.');
    return;
  }

  const customer = customers[0];
  console.log(`⏩ Fast-forwarding sequence for: ${customer.email}`);
  console.log(`   Current Day: ${customer.email_sequence_day}`);

  // Set next_email_at to 1 hour ago so it's due NOW
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('customers')
    .update({ next_email_at: oneHourAgo })
    .eq('id', customer.id);

  if (error) {
    console.error('❌ Error updating customer:', error);
  } else {
    console.log('✅ Successfully updated! The next email is now due.');
    console.log('👉 Go to /api/email-sequence/process to trigger it.');
  }
}

fastForward();
