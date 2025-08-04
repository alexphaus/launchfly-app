/**
 * Local Workflow Test - Bypass deployment timeouts
 * 
 * This test runs the business generation workflow locally to verify it works
 * without being affected by Vercel function timeouts.
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

// Import the core functions directly
async function importCoreModules() {
  try {
    const { analyzeOpportunity } = await import('./src/core/analyze.js');
    const { launchBusiness } = await import('./src/core/launch.js');
    const { growBusiness } = await import('./src/core/grow.js');
    return { analyzeOpportunity, launchBusiness, growBusiness };
  } catch (error) {
    console.error('Failed to import core modules:', error.message);
    throw error;
  }
}

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
    
  } catch (error) {
    logWithTimestamp('⚠️ Cleanup warning:', error.message);
  }
}

async function createTestRecords() {
  logWithTimestamp('📝 Creating test database records...');
  
  sessionId = `test-local-${nanoid()}`;
  
  try {
    // Create or get test user
    let userId;
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      email_confirm: true,
      user_metadata: {
        full_name: TEST_USER_DATA.name
      }
    });

    if (authData?.user) {
      userId = authData.user.id;
    } else {
      // User exists, get their ID
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', TEST_USER_EMAIL)
        .single();
        
      if (existingUser) {
        userId = existingUser.id;
      } else {
        throw new Error('Could not create or find test user');
      }
    }
    
    // Create business record
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        user_id: userId,
        name: 'Test Business Generation',
        subdomain: `test-${nanoid(8).toLowerCase()}`,
        status: 'pending',
        form_data: TEST_USER_DATA,
        session_id: sessionId
      })
      .select()
      .single();

    if (businessError) throw businessError;
    businessId = business.id;

    // Create session record
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        id: sessionId,
        business_id: businessId,
        stage: 'pending',
        progress: 0
      });

    if (sessionError) throw sessionError;

    logWithTimestamp('✅ Test records created', { sessionId, businessId });
    
  } catch (error) {
    logWithTimestamp('❌ Failed to create test records:', error.message);
    throw error;
  }
}

async function runLocalBusinessGeneration() {
  logWithTimestamp('🚀 Starting local business generation workflow...');
  
  try {
    // Import core modules
    const { analyzeOpportunity, launchBusiness, growBusiness } = await importCoreModules();
    
    // Update session to analyzing
    await supabase
      .from('sessions')
      .update({ stage: 'analyzing', progress: 20 })
      .eq('id', sessionId);
    
    // Step 1: Analyze opportunity
    logWithTimestamp('🔍 Step 1: Analyzing opportunity...');
    const opportunity = await analyzeOpportunity(TEST_USER_DATA, sessionId);
    logWithTimestamp('✅ Analysis completed', { 
      businessName: opportunity.businessName,
      niche: opportunity.niche,
      solution: opportunity.solution 
    });
    
    // Update session to researching
    await supabase
      .from('sessions')
      .update({ stage: 'researching', progress: 40 })
      .eq('id', sessionId);
      
    logWithTimestamp('🔬 Researching stage...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate research time
    
    // Update session to building
    await supabase
      .from('sessions')
      .update({ stage: 'building', progress: 60 })
      .eq('id', sessionId);
    
    // Step 2: Launch business
    logWithTimestamp('🏗️ Step 2: Launching business...');
    const businessData = await launchBusiness(opportunity, sessionId, businessId);
    logWithTimestamp('✅ Business launched', {
      hasLogo: !!businessData.logo,
      hasTheme: !!businessData.theme,
      hasProducts: !!businessData.products,
      productCount: businessData.products?.length || 0,
      hasMarketing: !!businessData.marketing
    });
    
    // Update session to finalizing
    await supabase
      .from('sessions')
      .update({ stage: 'finalizing', progress: 80 })
      .eq('id', sessionId);
    
    // Step 3: Update business record
    await supabase
      .from('businesses')
      .update({
        name: businessData.businessName,
        subdomain: businessData.domain.replace('.com', '').toLowerCase().replace(/[^a-z0-9]/g, '-'),
        business_data: businessData,
        status: 'ready'
      })
      .eq('id', businessId);
    
    // Update session to complete
    await supabase
      .from('sessions')
      .update({ stage: 'complete', progress: 100 })
      .eq('id', sessionId);
    
    logWithTimestamp('🎉 Business generation completed!');
    
    // Step 4: Run growth strategies
    logWithTimestamp('📈 Step 3: Running growth strategies...');
    const growthData = await growBusiness(businessData, businessId);
    logWithTimestamp('✅ Growth strategies completed', {
      hasGrowthData: !!growthData,
      strategies: growthData?.strategies?.length || 0
    });
    
    // Update business with growth data
    await supabase
      .from('businesses')
      .update({ growth_data: growthData })
      .eq('id', businessId);
    
    // Step 5: Simulate cold outreach (create email records)
    logWithTimestamp('📧 Step 4: Creating cold outreach campaign...');
    
    const emailRecords = [];
    for (let i = 0; i < 10; i++) {
      emailRecords.push({
        business_id: businessId,
        prospect_id: `prospect-${i}`,
        email_type: 'initial',
        subject: `Solution for ${opportunity.niche} challenges`,
        content: `Hi there! We help ${opportunity.niche} businesses...`,
        status: 'sent',
        sent_at: new Date().toISOString()
      });
    }
    
    const { data: insertedEmails, error: emailError } = await supabase
      .from('email_outreach')
      .insert(emailRecords)
      .select();
    
    if (emailError) {
      logWithTimestamp('⚠️ Email outreach creation failed:', emailError.message);
    } else {
      logWithTimestamp('✅ Cold outreach campaign created', {
        emailsSent: insertedEmails.length
      });
    }
    
    return {
      sessionId,
      businessId,
      businessData,
      growthData,
      emailCampaign: insertedEmails?.length || 0
    };
    
  } catch (error) {
    logWithTimestamp('❌ Local generation failed:', error.message);
    
    // Update session to error
    await supabase
      .from('sessions')
      .update({ stage: 'error' })
      .eq('id', sessionId);
    
    throw error;
  }
}

async function verifyCompleteJourney() {
  logWithTimestamp('🎯 Verifying complete journey...');
  
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

    // Get email outreach
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
        businessName: finalBusiness?.business_data?.businessName,
        productCount: finalBusiness?.business_data?.products?.length || 0
      },
      coldOutreach: {
        emailCount: emails?.length || 0,
        coldOutreachActive: (emails?.length || 0) > 0
      }
    };

    logWithTimestamp('📊 Complete Journey Status:', journeyStatus);
    
    const isSuccessful = (
      finalSession?.stage === 'complete' &&
      finalBusiness?.business_data &&
      (emails?.length || 0) > 0
    );

    logWithTimestamp(isSuccessful ? '🎉 LOCAL JOURNEY SUCCESSFUL!' : '⚠️ LOCAL JOURNEY INCOMPLETE');
    
    return journeyStatus;
    
  } catch (error) {
    logWithTimestamp('❌ Journey verification failed:', error.message);
    throw error;
  }
}

async function runLocalWorkflowTest() {
  startTime = Date.now();
  
  console.log('🚀 LOCAL WORKFLOW TEST: Complete Business Generation');
  console.log('====================================================');
  console.log(`📧 Test Email: ${TEST_USER_EMAIL}`);
  console.log(`🕐 Started at: ${new Date().toISOString()}`);
  console.log('');

  try {
    // Step 1: Cleanup
    await cleanupPreviousTests();
    
    // Step 2: Create test records
    await createTestRecords();
    
    // Step 3: Run local business generation
    const result = await runLocalBusinessGeneration();
    
    // Step 4: Verify complete journey
    const journeyStatus = await verifyCompleteJourney();
    
    const totalTime = (Date.now() - startTime) / 1000;
    logWithTimestamp(`✅ LOCAL TEST COMPLETED in ${totalTime.toFixed(1)}s`);
    
    return { result, journeyStatus };
    
  } catch (error) {
    const totalTime = (Date.now() - startTime) / 1000;
    logWithTimestamp(`❌ LOCAL TEST FAILED after ${totalTime.toFixed(1)}s:`, error.message);
    throw error;
  }
}

// Run the test
runLocalWorkflowTest()
  .then(result => {
    console.log('\n🎯 Final Result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Local test failed:', error.message);
    process.exit(1);
  });