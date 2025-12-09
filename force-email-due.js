
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.SUPABASE_SERVICE_KEY
);

async function forceEmailsDue() {
  console.log('🔍 Finding "Montgomery Roofing"...');

  // 1. Find the business
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('id, name')
    .ilike('name', '%Montgomery Roofing%')
    .limit(1);

  if (bizError || !businesses || businesses.length === 0) {
    console.error('❌ Business not found. Please check the name.');
    return;
  }

  const business = businesses[0];
  console.log(`✅ Found business: ${business.name} (ID: ${business.id})`);

  // 2. Update customers to make emails due NOW
  console.log('⚡ Updating all leads to be due for email immediately...');
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: updated, error: updateError } = await supabase
    .from('customers')
    .update({ 
      next_email_at: oneHourAgo,
      // Ensure they are in the sequence
      status: 'lead',
      source: 'lead_magnet',
      accepts_marketing: true
    })
    .eq('business_id', business.id)
    .lt('email_sequence_day', 5) // Only those who haven't finished
    .select();

  if (updateError) {
    console.error('❌ Error updating customers:', updateError);
  } else {
    console.log(`✅ Successfully updated ${updated.length} leads.`);
    console.log('   Their next email is now set to "1 hour ago".');
    console.log('👉 Run the processor now: http://localhost:3000/api/email-sequence/process');
  }
}

forceEmailsDue();
