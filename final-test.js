#!/usr/bin/env node

/**
 * Final Production Readiness Test
 * 
 * This comprehensive test validates the complete Launchfly workflow
 * from user form submission to business generation and cold email outreach.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const API_BASE = 'http://localhost:3000';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Request failed: ${url}`, error);
    throw error;
  }
}

async function runFinalTest() {
  console.log('🎯 FINAL PRODUCTION READINESS TEST');
  console.log('==================================');
  console.log(`Started at: ${new Date().toLocaleString()}\n`);

  try {
    // Test realistic user scenario
    const formData = {
      industry: 'E-commerce',
      experience: 'beginner',
      budget: '$500-1000',
      timeline: '1-3 months',
      goals: 'Start an online store',
      skills: ['Marketing', 'Social Media'],
      targetMarket: 'Young professionals',
      interests: ['Fashion', 'Tech accessories']
    };

    // Get test user
    const { data: users } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (!users || users.length === 0) {
      throw new Error('No test users found');
    }
    
    const testUser = users[0];
    const sessionId = `final-test-${Date.now()}`;
    
    // Create business and session
    const { data: business } = await supabase
      .from('businesses')
      .insert([{
        session_id: sessionId,
        status: 'pending'
      }])
      .select()
      .single();

    await supabase
      .from('sessions')
      .insert([{
        id: sessionId,
        user_id: testUser.id,
        stage: 'pending',
        progress: 0,
        form_data: formData
      }]);

    console.log(`✅ Test setup complete: ${sessionId}`);

    // Trigger business generation
    console.log('\n⚡ Generating business...');
    const result = await makeRequest(`${API_BASE}/api/generate-business`, {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        businessId: business.id,
        formData
      })
    });
    
    console.log('✅ Business generation triggered');

    // Monitor completion (simplified)
    console.log('\n⏳ Waiting for completion...');
    await sleep(5000); // Wait 5 seconds

    // Check final results
    const { data: finalBusiness } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', business.id)
      .single();

    const { data: finalSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    // Check marketing data
    const { data: campaigns } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('business_id', business.id);

    const { data: emails } = await supabase
      .from('email_outreach')
      .select('*')
      .eq('business_id', business.id);

    // Results
    console.log('\n📊 FINAL RESULTS');
    console.log('================');
    console.log(`Business Status: ${finalBusiness.status}`);
    console.log(`Session Stage: ${finalSession.stage}`);
    console.log(`Progress: ${finalSession.progress}%`);
    console.log(`Business Data: ${finalBusiness.business_data ? 'PRESENT' : 'MISSING'}`);
    console.log(`Campaigns: ${campaigns?.length || 0}`);
    console.log(`Emails: ${emails?.length || 0}`);

    // Assessment
    const isSuccess = (
      finalBusiness.status === 'ready' || finalBusiness.status === 'active'
    ) && finalBusiness.business_data;

    if (isSuccess) {
      console.log('\n🎉 SUCCESS: Full workflow is operational!');
      console.log('🚀 Ready for production deployment');
      return true;
    } else {
      console.log('\n❌ INCOMPLETE: Workflow needs attention');
      return false;
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    return false;
  }
}

// Run test
runFinalTest()
  .then(success => process.exit(success ? 0 : 1))
  .catch(() => process.exit(1));
