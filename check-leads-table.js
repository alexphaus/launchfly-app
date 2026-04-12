const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  // Check if table already exists
  const { data, error } = await sb.from('leads').select('id').limit(1);
  if (!error) {
    console.log('leads table already exists');
    return;
  }
  console.log('leads table does not exist:', error.message);
  
  // Try to create via Supabase Management API or direct SQL
  // Since we can't run raw SQL via supabase-js, we'll create the table
  // by inserting a row and letting Supabase auto-create... nope, that won't work.
  // Let's use the Supabase SQL Editor API instead.
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1];
  console.log('Project ref:', projectRef);
  console.log('Please run the migration SQL in Supabase Dashboard > SQL Editor');
  console.log('File: db/migrations/20260412_leads_table.sql');
}

run();
