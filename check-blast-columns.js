const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBlastColumns() {
  // Verify columns exist by querying
  const { data, error } = await supabase
    .from('customers')
    .select('id, blast_optout, last_blast_at')
    .limit(1);
  
  if (error) {
    console.log('❌ Columns missing:', error.message);
    console.log('\nRun this SQL in Supabase SQL Editor:');
    console.log('----------------------------------------');
    console.log('ALTER TABLE customers ADD COLUMN IF NOT EXISTS blast_optout BOOLEAN DEFAULT false;');
    console.log('ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_blast_at TIMESTAMPTZ;');
    console.log('----------------------------------------');
    return false;
  }
  
  console.log('✅ blast_optout and last_blast_at columns exist!');
  return true;
}

checkBlastColumns();
