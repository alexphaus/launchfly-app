/**
 * Complete Workflow Test
 * 
 * This script tests the entire workflow from user creation to cold email outreach
 * by creating real database records and triggering the Inngest workflows.
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
    // Step 1: Create test user profile first
    const userId = randomUUID();
    const sessionId = `test-session-${Date.now()}`;
    const businessId = randomUUID();
    
    // Create a test profile (this may need auth.users entry, but let's try)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: 'test@example.com',
        full_name: 'Test User',
        plan: 'trial'
      })
      .select()
      .single();
    
    if (profileError) {
      console.log('⚠️  Profile creation failed (expected):', profileError.message);
      console.log('📝 Using existing user for test...');
      
      // Let's find an existing user to use for the test
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);
      
      if (!existingProfiles || existingProfiles.length === 0) {
        throw new Error('No existing users found. Please create a user first or use a different approach.');
      }
      
      const existingUserId = existingProfiles[0].id;
      console.log('✅ Using existing user:', existingUserId);
      
      // Use existing user ID
      const existingUserId = existingProfiles[0].id;
      console.log('✅ Using existing user:', existingUserId);
      
      // Update variables  
      const finalUserId = existingUserId;
    } else {
      console.log('✅ Created test profile:', userId);
    }
    
    // Step 2: Create a test business
    const sessionId = `test-session-${Date.now()}`;
    const businessId = randomUUID();
    const userId = randomUUID(); // Need a user_id for businesses table
    
    // Create business first since sessions need business_id
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        id: businessId,
        user_id: userId,
        name: 'Test Tech Solutions',
        subdomain: `test-tech-${Date.now()}`,
        status: 'pending',
        session_id: sessionId,
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
    
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        id: sessionId,
        business_id: businessId,
        stage: 'pending',
        progress: 0
      })
      .select()
      .single();
    
    if (sessionError) {
      throw new Error(`Failed to create session: ${sessionError.message}`);
    }
    
    console.log('✅ Step 1: Created test session:', sessionId);
    console.log('✅ Step 1: Created test business:', businessId);
    
    // Step 2: Trigger business generation workflow
    console.log('🔄 Step 2: Triggering business generation workflow...');
    
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      skills: 'Marketing, Sales',
      experience: 'Professional',
      industry: 'Technology'
    };
    
    await sendEvent(EventTypes.BUSINESS_GENERATION_STARTED, {
      sessionId,
      businessId,
      userData,
      formData: userData,
      triggeredAt: new Date().toISOString(),
      source: 'workflow-test'
    });
    
    console.log('✅ Step 2: Business generation workflow triggered');
    
    // Wait a moment for the workflow to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Trigger growth strategy workflow
    console.log('🔄 Step 3: Triggering growth strategy workflow...');
    
    await sendEvent(EventTypes.GROWTH_STRATEGY_STARTED, {
      businessId,
      businessData: business,
      strategies: ['customer-acquisition', 'cold-outreach'],
      triggeredAt: new Date().toISOString(),
      source: 'workflow-test'
    });
    
    console.log('✅ Step 3: Growth strategy workflow triggered');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 4: Trigger cold email campaign
    console.log('🔄 Step 4: Triggering cold email campaign...');
    
    await sendEvent(EventTypes.COLD_EMAIL_CAMPAIGN_STARTED, {
      businessId,
      businessData: business,
      campaign: {
        type: 'workflow-test',
        targetSize: 10,
        industry: 'Technology'
      },
      triggeredAt: new Date().toISOString(),
      source: 'workflow-test'
    });
    
    console.log('✅ Step 4: Cold email campaign triggered');
    
    // Step 5: Check database for any workflow results
    console.log('🔍 Step 5: Checking database for workflow results...');
    
    // Check session status
    const { data: updatedSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    // Check business status  
    const { data: updatedBusiness } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    
    console.log('📊 Session status:', updatedSession?.stage || 'unknown');
    console.log('📊 Business status:', updatedBusiness?.status || 'unknown');
    
    // Step 6: Check for any marketing records that might have been created
    const { data: marketingCampaigns } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('business_id', businessId);
    
    const { data: emailOutreach } = await supabase
      .from('email_outreach')
      .select('*')
      .eq('business_id', businessId);
    
    console.log('📧 Marketing campaigns created:', marketingCampaigns?.length || 0);
    console.log('📧 Email outreach records:', emailOutreach?.length || 0);
    
    // Final summary
    console.log('');
    console.log('🎉 Workflow Test Summary');
    console.log('========================');
    console.log(`Session ID: ${sessionId}`);
    console.log(`Business ID: ${businessId}`);
    console.log(`Session Stage: ${updatedSession?.stage}`);
    console.log(`Business Status: ${updatedBusiness?.status}`);
    console.log(`Workflow Events Sent: 3`);
    console.log('');
    console.log('✅ All workflow events have been triggered successfully!');
    console.log('');
    console.log('📝 Next Steps:');
    console.log('1. The Inngest workflows are now processing in the background');
    console.log('2. Check your Inngest dashboard for real-time execution');
    console.log('3. Monitor the database for workflow results');
    console.log('4. Check console logs for detailed execution traces');
    
    return {
      success: true,
      sessionId,
      businessId,
      eventsTriggered: 3
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
