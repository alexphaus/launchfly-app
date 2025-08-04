/**
 * Database Setup Check
 * 
 * This script checks if all necessary tables exist and creates them if needed
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkAndSetupDatabase() {
  console.log('🔧 Checking Database Setup');
  console.log('==========================');
  
  try {
    // Check if tables exist by trying to query them
    const tables = [
      'sessions',
      'businesses', 
      'marketing_campaigns',
      'email_outreach',
      'growth_experiments'
    ];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ Table '${table}' not found or has issues:`, error.message);
        } else {
          console.log(`✅ Table '${table}' exists and is accessible`);
        }
      } catch (err) {
        console.log(`❌ Error checking table '${table}':`, err.message);
      }
    }
    
    // Try to create sample data to test the workflow
    console.log('\n🧪 Testing basic database operations...');
    
    // Test sessions table - check existing structure first
    const testSessionId = `test-db-${Date.now()}`;
    
    // First, let's see what a session looks like
    const { data: existingSessions } = await supabase
      .from('sessions')
      .select('*')
      .limit(1);
    
    console.log('📊 Existing session structure:', existingSessions?.[0] || 'No sessions found');
    
    // Try a simple insert with minimal data
    const { data: sessionTest, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        id: testSessionId,
        stage: 'testing'
      })
      .select()
      .single();
    
    if (sessionError) {
      console.log('❌ Sessions table test failed:', sessionError.message);
    } else {
      console.log('✅ Sessions table working');
      
      // Clean up test data
      await supabase.from('sessions').delete().eq('id', testSessionId);
    }
    
    console.log('\n📊 Database check complete');
    
  } catch (error) {
    console.error('❌ Database setup check failed:', error);
  }
}

checkAndSetupDatabase()
  .then(() => {
    console.log('✅ Database check completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
