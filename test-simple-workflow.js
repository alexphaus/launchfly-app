/**
 * Complete Workflow Test (Simplified)
 * 
 * This script tests the entire workflow using existing users
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { sendEvent, EventTypes } from './src/lib/inngest.js';
import { randomUUID } from 'crypto';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function runCompleteWorkflowTest() {
  console.log('🚀 Starting Complete Workflow Test');
  console.log('====================================');
  
  try {
    // Step 1: Find existing user to use for test
    console.log('🔍 Finding existing user for test...');
    
    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (!existingProfiles || existingProfiles.length === 0) {
      throw new Error('No existing users found. Please create a user first through the app.');
    }
    
    const testUserId = existingProfiles[0].id;
    console.log('✅ Using existing user:', testUserId);
    
    // Step 2: Create test business and session
    const testSessionId = `test-session-${Date.now()}`;
    const testBusinessId = randomUUID();
    
    console.log('🏗️  Creating test business and session...');
    
    // Create business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        id: testBusinessId,
        user_id: testUserId,
        name: 'Test Tech Solutions',
        subdomain: `test-tech-${Date.now()}`,
        status: 'pending',
        session_id: testSessionId,
        form_data: {
          name: 'Test User',
          email: 'test@example.com',
          skills: 'Marketing, Sales',
          experience: 'Professional',
          industry: 'Technology'
        },
        business_data: {
          businessName: 'Test Tech Solutions',
          industry: 'Technology',
          painPoint: 'Low productivity',
          valueProposition: 'Increase productivity by 40%',
          targetMarket: 'Small businesses'
        }
      })
      .select()
      .single();
    
    if (businessError) {
      throw new Error(`Failed to create business: ${businessError.message}`);
    }
    
    // Create session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        id: testSessionId,
        business_id: testBusinessId,
        stage: 'pending',
        progress: 0
      })
      .select()
      .single();
    
    if (sessionError) {
      throw new Error(`Failed to create session: ${sessionError.message}`);
    }
    
    console.log('✅ Created test business:', testBusinessId);
    console.log('✅ Created test session:', testSessionId);
    
    // Step 3: Trigger business generation workflow
    console.log('🔄 Triggering business generation workflow...');
    
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      skills: 'Marketing, Sales',
      experience: 'Professional',
      industry: 'Technology'
    };
    
    await sendEvent(EventTypes.BUSINESS_GENERATION_STARTED, {
      sessionId: testSessionId,
      businessId: testBusinessId,
      userData,
      formData: userData,
      triggeredAt: new Date().toISOString(),
      source: 'workflow-test'
    });
    
    console.log('✅ Business generation workflow triggered');
    
    // Step 4: Trigger growth strategy workflow
    console.log('🔄 Triggering growth strategy workflow...');
    
    await sendEvent(EventTypes.GROWTH_STRATEGY_STARTED, {
      businessId: testBusinessId,
      businessData: business,
      strategies: ['customer-acquisition', 'cold-outreach'],
      triggeredAt: new Date().toISOString(),
      source: 'workflow-test'
    });
    
    console.log('✅ Growth strategy workflow triggered');
    
    // Step 5: Trigger cold email campaign
    console.log('🔄 Triggering cold email campaign...');
    
    await sendEvent(EventTypes.COLD_EMAIL_CAMPAIGN_STARTED, {
      businessId: testBusinessId,
      businessData: business,
      campaign: {
        type: 'workflow-test',
        targetSize: 10,
        industry: 'Technology'
      },
      triggeredAt: new Date().toISOString(),
      source: 'workflow-test'
    });
    
    console.log('✅ Cold email campaign triggered');
    
    // Step 6: Monitor initial results
    console.log('🔍 Checking initial database state...');
    
    // Wait a moment for events to be processed
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check session status
    const { data: updatedSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', testSessionId)
      .single();
    
    // Check business status  
    const { data: updatedBusiness } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', testBusinessId)
      .single();
    
    console.log('📊 Session stage:', updatedSession?.stage || 'unknown');
    console.log('📊 Business status:', updatedBusiness?.status || 'unknown');
    
    // Check for any Inngest jobs
    const { data: inngestJobs } = await supabase
      .from('inngest_jobs')
      .select('*')
      .eq('business_id', testBusinessId);
    
    console.log('⚙️  Inngest jobs created:', inngestJobs?.length || 0);
    
    if (inngestJobs && inngestJobs.length > 0) {
      inngestJobs.forEach((job, index) => {
        console.log(`   Job ${index + 1}: ${job.job_type} - ${job.status}`);
      });
    }
    
    // Final summary
    console.log('');
    console.log('🎉 Workflow Test Summary');
    console.log('========================');
    console.log(`✅ Test User ID: ${testUserId}`);
    console.log(`✅ Test Session ID: ${testSessionId}`);
    console.log(`✅ Test Business ID: ${testBusinessId}`);
    console.log(`📧 Events Triggered: 3`);
    console.log(`⚙️  Jobs Created: ${inngestJobs?.length || 0}`);
    console.log('');
    console.log('🚀 Workflow orchestration is now running in the background!');
    console.log('');
    console.log('📝 Next Steps:');
    console.log('1. Check your Next.js dev server console for Inngest execution logs');
    console.log('2. Monitor the database for real-time updates');
    console.log('3. Use the monitoring script for detailed progress tracking:');
    console.log(`   node monitor-workflow.js ${testSessionId} ${testBusinessId}`);
    
    return {
      success: true,
      sessionId: testSessionId,
      businessId: testBusinessId,
      userId: testUserId,
      eventsTriggered: 3,
      jobsCreated: inngestJobs?.length || 0
    };
    
  } catch (error) {
    console.error('❌ Workflow test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test
runCompleteWorkflowTest()
  .then(result => {
    console.log('');
    console.log('Test completed:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
