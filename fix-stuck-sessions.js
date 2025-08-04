#!/usr/bin/env node

/**
 * Session Status Recovery Tool
 * 
 * This tool checks for stuck sessions and businesses and fixes their status
 * when they have valid business data but are stuck in intermediate states.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function findStuckSessions() {
  console.log('🔍 Scanning for stuck sessions...\n');
  
  // Find sessions that are stuck in intermediate stages
  const { data: stuckSessions, error } = await supabase
    .from('sessions')
    .select(`
      *,
      businesses (*)
    `)
    .in('stage', ['pending', 'queued', 'analyzing', 'generating', 'researching', 'building'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching sessions:', error);
    return;
  }

  if (!stuckSessions || stuckSessions.length === 0) {
    console.log('✅ No stuck sessions found.');
    return;
  }

  console.log(`Found ${stuckSessions.length} sessions in intermediate stages:`);
  console.log('=' + '='.repeat(60));

  let fixedCount = 0;

  for (const session of stuckSessions) {
    const business = session.businesses[0];
    if (!business) continue;

    const isStuck = (
      // Session is in intermediate stage
      ['pending', 'queued', 'analyzing', 'generating', 'researching', 'building'].includes(session.stage) &&
      // But business has data (meaning generation completed)
      business.business_data &&
      // And it's been more than 5 minutes since last update
      new Date() - new Date(session.updated_at) > 5 * 60 * 1000
    );

    console.log(`\n📋 Session: ${session.id}`);
    console.log(`   Stage: ${session.stage} (${session.progress}%)`);
    console.log(`   Business Status: ${business.status}`);
    console.log(`   Has Data: ${business.business_data ? 'YES' : 'NO'}`);
    console.log(`   Updated: ${new Date(session.updated_at).toLocaleString()}`);

    if (isStuck) {
      console.log('   🔧 FIXING: Session appears stuck...');
      
      try {
        // Fix business status
        await supabase
          .from('businesses')
          .update({
            status: 'ready',
            updated_at: new Date().toISOString()
          })
          .eq('id', business.id);

        // Fix session status
        await supabase
          .from('sessions')
          .update({
            stage: 'complete',
            progress: 100,
            updated_at: new Date().toISOString()
          })
          .eq('id', session.id);

        console.log('   ✅ FIXED: Status updated to complete');
        fixedCount++;
        
      } catch (fixError) {
        console.log('   ❌ ERROR: Failed to fix -', fixError.message);
      }
    } else {
      console.log('   ⏳ IN PROGRESS: Session appears to be actively processing');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`🏆 SUMMARY: Fixed ${fixedCount} stuck sessions`);
  
  if (fixedCount > 0) {
    console.log('\n💡 TIP: Refresh any open dashboard pages to see the updates');
  }
}

async function checkSpecificSession(sessionId) {
  if (!sessionId) {
    console.log('❌ Please provide a session ID');
    return;
  }

  console.log(`🔍 Checking session: ${sessionId}\n`);

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError) {
    console.log('❌ Session not found:', sessionError.message);
    return;
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (businessError) {
    console.log('❌ Business not found:', businessError.message);
    return;
  }

  console.log('📊 Current Status:');
  console.log(`   Session Stage: ${session.stage}`);
  console.log(`   Session Progress: ${session.progress}%`);
  console.log(`   Business Status: ${business.status}`);
  console.log(`   Business Data: ${business.business_data ? 'PRESENT' : 'MISSING'}`);
  console.log(`   Last Updated: ${new Date(session.updated_at).toLocaleString()}`);

  // Check if stuck
  const isStuck = (
    ['pending', 'queued', 'analyzing', 'generating', 'researching', 'building'].includes(session.stage) &&
    business.business_data &&
    new Date() - new Date(session.updated_at) > 5 * 60 * 1000
  );

  if (isStuck) {
    console.log('\n⚠️  Session appears stuck. Fix it? (y/n)');
    
    // For now, auto-fix since this is a diagnostic tool
    console.log('🔧 Auto-fixing...');
    
    await supabase
      .from('businesses')
      .update({
        status: 'ready',
        updated_at: new Date().toISOString()
      })
      .eq('id', business.id);

    await supabase
      .from('sessions')
      .update({
        stage: 'complete',
        progress: 100,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id);

    console.log('✅ Session fixed! Status updated to complete.');
  } else {
    console.log('\n✅ Session status looks normal.');
  }
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];

if (command === 'check' && args[1]) {
  // Check specific session: node fix-stuck-sessions.js check session_id
  checkSpecificSession(args[1]);
} else if (command === 'scan' || !command) {
  // Scan all: node fix-stuck-sessions.js scan
  findStuckSessions();
} else {
  console.log('Usage:');
  console.log('  node fix-stuck-sessions.js scan          # Scan all sessions');
  console.log('  node fix-stuck-sessions.js check <id>    # Check specific session');
}
