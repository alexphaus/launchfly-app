#!/usr/bin/env node

/**
 * Test the exact business generation flow that happens after Tally form submission
 * Run with: node test-generation-flow.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testGenerationFlow() {
  console.log('🧪 Testing Complete Business Generation Flow\n');

  // Create test user data similar to what comes from Tally
  const testUserData = {
    name: "Test User",
    email: "test@example.com",
    skills: "Web design and marketing",
    businessType: "Digital services",
    goal: "Generate $3000 monthly income",
    preferences: "Work with small businesses",
    plan: "Starter"
  };

  const sessionId = `test_session_${Date.now()}`;
  console.log(`📋 Test Session ID: ${sessionId}`);
  console.log(`👤 Test User: ${testUserData.name} (${testUserData.email})`);

  try {
    // Step 1: Create a test business record (simulating what Tally webhook does)
    console.log('\n1. Creating business record...');
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Test UUID
        name: 'Test Business Generation',
        subdomain: `test-${Date.now()}`,
        status: 'pending',
        form_data: testUserData,
        session_id: sessionId
      })
      .select()
      .single();

    if (businessError) throw businessError;
    console.log(`✅ Business created: ${business.id}`);

    // Step 2: Create session record
    console.log('\n2. Creating session record...');
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        id: sessionId,
        business_id: business.id,
        stage: 'pending',
        progress: 0
      });

    if (sessionError) throw sessionError;
    console.log('✅ Session created');

    // Step 3: Call the generation API (simulating dashboard trigger)
    console.log('\n3. Starting business generation API call...');
    
    const startTime = Date.now();
    const response = await fetch('http://localhost:3002/api/generate-business', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId,
        businessId: business.id,
        formData: testUserData
      })
    });

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`⏱️  API call completed in ${duration}s`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Generation successful!');
    console.log(`🏢 Business Name: ${result.businessData?.businessName}`);
    console.log(`🎯 Niche: ${result.businessData?.tagline}`);
    console.log(`🛍️  Products: ${result.businessData?.products?.length || 0}`);

    // Step 4: Verify final state
    console.log('\n4. Verifying final state...');
    const { data: finalSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    const { data: finalBusiness } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', business.id)
      .single();

    console.log(`📊 Final Session Stage: ${finalSession.stage} (${finalSession.progress}%)`);
    console.log(`🏪 Final Business Status: ${finalBusiness.status}`);
    console.log(`🌐 Website URL: ${finalBusiness.subdomain}.launchfly.ai`);

    if (finalSession.stage === 'complete' && finalBusiness.status === 'ready') {
      console.log('\n🎉 SUCCESS: Complete business generation flow working!');
    } else {
      console.log('\n⚠️  WARNING: Flow completed but with unexpected state');
    }

    // Cleanup
    console.log('\n5. Cleaning up test data...');
    await supabase.from('sessions').delete().eq('id', sessionId);
    await supabase.from('businesses').delete().eq('id', business.id);
    console.log('✅ Cleanup completed');

  } catch (error) {
    console.error('\n❌ Generation flow failed:');
    console.error('Error message:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
    }

    // Try to check the session state even if generation failed
    try {
      const { data: errorSession } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      
      if (errorSession) {
        console.log(`\n📊 Session state at error: ${errorSession.stage} (${errorSession.progress}%)`);
      }
    } catch (checkError) {
      console.log('Could not check session state');
    }
  }
}

testGenerationFlow().catch(console.error);
