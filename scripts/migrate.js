#!/usr/bin/env node

/**
 * Migration runner for Supabase
 * Run this to create the sales table in your Supabase database
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function runMigration() {
  try {
    console.log('🚀 Running migration: create_sales_table.sql');
    
    const migrationPath = path.join(__dirname, '..', 'migrations', 'create_sales_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('Sales table created with proper indexes and RLS policies.');
    
  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    process.exit(1);
  }
}

// Alternative approach if exec_sql is not available
async function runMigrationAlternative() {
  try {
    console.log('🚀 Creating sales table...');
    
    // Create the table directly
    const { error } = await supabase.from('sales').select('*').limit(1);
    
    if (error && error.code === '42P01') { // Table doesn't exist
      console.log('Table does not exist. Please run the SQL manually in your Supabase dashboard:');
      console.log('');
      
      const migrationPath = path.join(__dirname, '..', 'migrations', 'create_sales_table.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      console.log(migrationSQL);
      console.log('');
      console.log('After running the SQL, your Stripe payments will be tracked properly.');
    } else {
      console.log('✅ Sales table already exists or is accessible.');
    }
    
  } catch (error) {
    console.error('❌ Error checking table:', error.message);
  }
}

if (require.main === module) {
  runMigrationAlternative();
}
