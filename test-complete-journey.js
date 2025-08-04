/**
 * Complete Journey Test: Tally Form → Cold Outreach
 * 
 * This test simulates the entire user journey and identifies where the workflow gets stuck.
 * It provides detailed debugging information at each step.
 */

const { createClient } = require('@supabase/supabase-js');
const { nanoid } = require('nanoid');
const fs = require('fs');

// Load environment variables manually
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  if (line.includes('=') && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BASE_URL = process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || 'http://localhost:3000';

// Test user data
const TEST_USER_EMAIL = 'weferin@gmail.com';
const TEST_USER_DATA = {
  name: 'Test User',
  email: TEST_USER_EMAIL,
  skills: 'Web development, digital marketing, content creation',
  businessType: 'Digital consulting and online services',
  goal: 'Build a profitable online business that generates passive income',
  preferences: 'Focus on scalable digital products and automated marketing'
};

let sessionId;
let businessId;
let startTime;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function logWithTimestamp(message, data = null) {
  const elapsed = startTime ? (Date.now() - startTime) / 1000 : 0;
  console.log(`[${elapsed.toFixed(1)}s] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function cleanupPreviousTests() {
  logWithTimestamp('🧹 Cleaning up previous test data...');
  
  try {
    // Delete sessions and businesses for test email
    const { data: existingBusinesses } = await supabase
      .from('businesses')
      .select('id, session_id')
      .like('form_data->>email', TEST_USER_EMAIL);

    if (existingBusinesses?.length > 0) {
      for (const business of existingBusinesses) {
        // Delete session
        if (business.session_id) {
          await supabase
            .from('sessions')
            .delete()
            .eq('id', business.session_id);
        }
        
        // Delete business
        await supabase
          .from('businesses')
          .delete()
          .eq('id', business.id);
      }
      
      logWithTimestamp(`✅ Cleaned up ${existingBusinesses.length} previous test records`);
    }
    
    // Delete auth user if exists
    try {
      const { data: users } = await supabase.auth.admin.listUsers();
      const testUser = users.users.find(u => u.email === TEST_USER_EMAIL);
      if (testUser) {
        await supabase.auth.admin.deleteUser(testUser.id);
        logWithTimestamp('✅ Cleaned up test user account');
      }
    } catch (error) {
      // User might not exist, that's ok
    }
    
  } catch (error) {
    logWithTimestamp('⚠️ Cleanup warning:', error.message);
  }
}

async function simulateTallyWebhook() {
  logWithTimestamp('📝 Step 1: Simulating Tally form submission...');
  
  sessionId = `test-${nanoid()}`;
  
  const tallyPayload = {
    data: {
      fields: [
        { label: "Name", value: TEST_USER_DATA.name },
        { label: "Email", value: TEST_USER_DATA.email },
        { label: "What are your main skills or interests?", value: TEST_USER_DATA.skills },
        { label: "What type of business are you most interested in?", value: TEST_USER_DATA.businessType },
        { label: "What's your business goal?", value: TEST_USER_DATA.goal },
        { label: "Any special preferences or ideas you have?", value: TEST_USER_DATA.preferences },
        { label: "plan", value: "Starter" },
        { label: "sessionID", value: sessionId }
      ]
    }
  };

  try {
    const response = await fetch(`${BASE_URL}/api/webhook/tally`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tallyPayload)
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`Tally webhook failed: ${result.error}`);
    }

    logWithTimestamp('✅ Tally webhook successful', { sessionId, result });
    
    // Wait a moment for database writes to complete
    await delay(2000);
    
    return result;
  } catch (error) {
    logWithTimestamp('❌ Tally webhook failed', error.message);
    throw error;
  }
}

async function waitForDatabaseRecords() {
  logWithTimestamp('⏳ Step 2: Waiting for database records to be created...');
  
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    try {
      // Check for session
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (session) {
        logWithTimestamp('✅ Session record found', { 
          stage: session.stage, 
          progress: session.progress 
        });

        // Check for business
        const { data: business, error: businessError } = await supabase
          .from('businesses')
          .select('*')
          .eq('session_id', sessionId)
          .single();

        if (business) {
          businessId = business.id;
          logWithTimestamp('✅ Business record found', { 
            id: business.id,
            status: business.status,
            name: business.name 
          });
          
          return { session, business };
        }
      }
      
      attempts++;
      logWithTimestamp(`⏳ Waiting for records... (attempt ${attempts}/${maxAttempts})`);
      await delay(2000);
      
    } catch (error) {
      logWithTimestamp(`⚠️ Database check attempt ${attempts} failed:`, error.message);
      attempts++;
      await delay(2000);
    }
  }
  
  throw new Error('Database records not created after maximum attempts');
}

async function triggerBusinessGeneration() {
  logWithTimestamp('🚀 Step 3: Triggering business generation...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/generate-business`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId,
        businessId: businessId,
        formData: TEST_USER_DATA
      })
    });

    let result;
    const responseText = await response.text();
    
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      logWithTimestamp('❌ Response parse error:', {
        status: response.status,
        statusText: response.statusText,
        responseText: responseText.substring(0, 500) + '...'
      });
      throw new Error(`API returned non-JSON response: ${responseText.substring(0, 200)}`);
    }
    
    if (!response.ok) {
      throw new Error(`Business generation failed: ${result.error || response.statusText}`);
    }

    logWithTimestamp('✅ Business generation triggered', result);
    return result;
    
  } catch (error) {
    logWithTimestamp('❌ Business generation trigger failed', error.message);
    throw error;
  }
}

async function monitorGenerationProgress() {
  logWithTimestamp('👀 Step 4: Monitoring generation progress...');
  
  let attempts = 0;
  const maxAttempts = 180; // 3 minutes with 1-second intervals
  let lastStage = '';
  let lastProgress = 0;
  let stageStartTime = Date.now();
  const stageTimeouts = {
    'pending': 30000,      // 30 seconds
    'analyzing': 60000,    // 1 minute  
    'researching': 60000,  // 1 minute
    'building': 300000,    // 5 minutes (this is where it usually fails)
    'finalizing': 60000    // 1 minute
  };
  
  while (attempts < maxAttempts) {
    try {
      // Get latest session data
      const { data: session } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      // Get latest business data
      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();

      if (session) {
        // Check if stage changed
        if (session.stage !== lastStage) {
          if (lastStage) {
            const stageElapsed = Date.now() - stageStartTime;
            logWithTimestamp(`⏱️ Stage '${lastStage}' completed in ${(stageElapsed/1000).toFixed(1)}s`);
          }
          
          lastStage = session.stage;
          stageStartTime = Date.now();
          logWithTimestamp(`🔄 Stage changed to: ${session.stage}`, {
            progress: session.progress,
            businessStatus: business?.status
          });
        }
        
        // Check for stage timeout
        const stageElapsed = Date.now() - stageStartTime;
        const stageTimeout = stageTimeouts[session.stage] || 120000;
        
        if (stageElapsed > stageTimeout) {
          logWithTimestamp(`⚠️ TIMEOUT: Stage '${session.stage}' has been running for ${(stageElapsed/1000).toFixed(1)}s (timeout: ${stageTimeout/1000}s)`);
          
          // Get more detailed business data to see what's stuck
          if (business?.business_data) {
            logWithTimestamp('📊 Current business data:', {
              businessName: business.business_data.businessName,
              logo: business.business_data.logo,
              theme: !!business.business_data.theme,
              products: !!business.business_data.products,
              marketing: !!business.business_data.marketing
            });
          }
          
          throw new Error(`Generation stuck in ${session.stage} stage for too long`);
        }
        
        // Check for completion
        if (session.stage === 'complete') {
          logWithTimestamp('🎉 Generation completed successfully!', {
            finalProgress: session.progress,
            finalStatus: business?.status,
            businessData: business?.business_data ? 'Present' : 'Missing'
          });
          
          return { session, business };
        }
        
        // Check for error
        if (session.stage === 'error') {
          logWithTimestamp('❌ Generation failed with error stage', {
            businessStatus: business?.status
          });
          throw new Error('Generation entered error state');
        }
        
        // Log progress changes
        if (session.progress !== lastProgress) {
          lastProgress = session.progress;
          logWithTimestamp(`📈 Progress: ${session.progress}%`);
        }
        
        // Log detailed business data during building stage
        if (session.stage === 'building' && business?.business_data) {
          const bd = business.business_data;
          logWithTimestamp('🔍 Building stage details:', {
            businessName: !!bd.businessName,
            logo: !!bd.logo,
            theme: !!bd.theme,
            products: !!bd.products,
            marketing: !!bd.marketing,
            targetCustomers: !!bd.targetCustomers
          });
        }
      }
      
      attempts++;
      await delay(1000); // Check every second
      
    } catch (error) {
      if (error.message.includes('Generation stuck') || error.message.includes('Generation failed')) {
        throw error;
      }
      
      logWithTimestamp(`⚠️ Monitor attempt ${attempts} failed:`, error.message);
      attempts++;
      await delay(1000);
    }
  }
  
  throw new Error('Generation monitoring timed out after maximum attempts');
}

async function checkGrowthStrategies() {
  logWithTimestamp('📈 Step 5: Checking growth strategies activation...');
  
  try {
    // Wait a bit for growth strategies to be triggered
    await delay(10000);
    
    // Check for marketing campaigns
    const { data: campaigns } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('business_id', businessId);
    
    logWithTimestamp('📊 Marketing campaigns:', { count: campaigns?.length || 0 });
    
    // Check for email outreach
    const { data: emails } = await supabase
      .from('email_outreach')
      .select('*')
      .eq('business_id', businessId);
    
    logWithTimestamp('📧 Email outreach records:', { count: emails?.length || 0 });
    
    // Check business for growth data
    const { data: business } = await supabase
      .from('businesses')
      .select('growth_data, latest_email_campaign')
      .eq('id', businessId)
      .single();
    
    logWithTimestamp('🎯 Growth data status:', {
      hasGrowthData: !!business?.growth_data,
      hasEmailCampaign: !!business?.latest_email_campaign
    });
    
    return {
      campaigns: campaigns || [],
      emails: emails || [],
      business
    };
    
  } catch (error) {
    logWithTimestamp('⚠️ Growth strategies check failed:', error.message);
    return null;
  }
}

async function triggerGrowthStrategies() {
  logWithTimestamp('🚀 Step 6: Manually triggering growth strategies...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/growth/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: businessId
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`Growth strategies failed: ${result.error}`);
    }

    logWithTimestamp('✅ Growth strategies triggered', result);
    
    // Wait for growth strategies to process
    await delay(15000);
    
    return result;
    
  } catch (error) {
    logWithTimestamp('❌ Growth strategies trigger failed', error.message);
    return null;
  }
}

async function verifyFullJourney() {
  logWithTimestamp('🎯 Step 7: Verifying complete journey...');
  
  try {
    // Get final session state
    const { data: finalSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    // Get final business state  
    const { data: finalBusiness } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    // Get growth activities
    const { data: campaigns } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('business_id', businessId);

    const { data: emails } = await supabase
      .from('email_outreach')
      .select('*')
      .eq('business_id', businessId);

    const journeyStatus = {
      session: {
        stage: finalSession?.stage,
        progress: finalSession?.progress,
        completed: finalSession?.stage === 'complete'
      },
      business: {
        status: finalBusiness?.status,
        hasBusinessData: !!finalBusiness?.business_data,
        hasGrowthData: !!finalBusiness?.growth_data,
        subdomain: finalBusiness?.subdomain
      },
      growth: {
        campaignCount: campaigns?.length || 0,
        emailCount: emails?.length || 0,
        coldOutreachActive: (emails?.length || 0) > 0
      }
    };

    logWithTimestamp('📊 Complete Journey Status:', journeyStatus);
    
    // Determine success
    const isSuccessful = (
      finalSession?.stage === 'complete' &&
      finalBusiness?.business_data &&
      (emails?.length || 0) > 0
    );

    logWithTimestamp(isSuccessful ? '🎉 JOURNEY SUCCESSFUL!' : '⚠️ JOURNEY INCOMPLETE');
    
    return journeyStatus;
    
  } catch (error) {
    logWithTimestamp('❌ Journey verification failed:', error.message);
    throw error;
  }
}

async function runCompleteJourneyTest() {
  startTime = Date.now();
  
  console.log('🚀 COMPLETE JOURNEY TEST: Tally Form → Cold Outreach');
  console.log('========================================================');
  console.log(`📧 Test Email: ${TEST_USER_EMAIL}`);
  console.log(`🕐 Started at: ${new Date().toISOString()}`);
  console.log('');

  try {
    // Step 1: Cleanup
    await cleanupPreviousTests();
    
    // Step 2: Simulate tally form submission
    await simulateTallyWebhook();
    
    // Step 3: Wait for database records
    await waitForDatabaseRecords();
    
    // Step 4: Trigger business generation
    await triggerBusinessGeneration();
    
    // Step 5: Monitor progress with detailed logging
    await monitorGenerationProgress();
    
    // Step 6: Check if growth strategies activated automatically
    await checkGrowthStrategies();
    
    // Step 7: Manually trigger growth strategies if needed
    await triggerGrowthStrategies();
    
    // Step 8: Verify complete journey
    const journeyStatus = await verifyFullJourney();
    
    const totalTime = (Date.now() - startTime) / 1000;
    logWithTimestamp(`✅ TEST COMPLETED in ${totalTime.toFixed(1)}s`);
    
    return journeyStatus;
    
  } catch (error) {
    const totalTime = (Date.now() - startTime) / 1000;
    logWithTimestamp(`❌ TEST FAILED after ${totalTime.toFixed(1)}s:`, error.message);
    
    // Try to get current state for debugging
    try {
      const { data: session } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();

      logWithTimestamp('🔍 Debug Info at Failure:', {
        sessionStage: session?.stage,
        sessionProgress: session?.progress,
        businessStatus: business?.status,
        hasBusinessData: !!business?.business_data,
        businessDataKeys: business?.business_data ? Object.keys(business.business_data) : []
      });
      
    } catch (debugError) {
      logWithTimestamp('⚠️ Could not fetch debug info:', debugError.message);
    }
    
    throw error;
  }
}

// Run the test
runCompleteJourneyTest()
  .then(result => {
    console.log('\n🎯 Final Result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  });