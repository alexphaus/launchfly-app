#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function runMigration() {
  console.log('Running platform subscriptions migration...');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '20250116_platform_subscriptions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { 
      sql: migrationSQL 
    });
    
    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
    
    console.log('✅ Platform subscriptions migration completed successfully!');
    console.log('The following changes were made:');
    console.log('- Created platform_subscriptions table');
    console.log('- Added indexes for better query performance');
    console.log('- Added paid_plan_session_id column to businesses table');
    
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();
