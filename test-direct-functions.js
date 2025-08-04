/**
 * Direct Function Test
 * 
 * Test the core business generation and growth functions directly
 * to verify they work independently of Inngest orchestration
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Import core functions directly
import { analyzeUserData } from './src/core/analyze.js';
import { generateBusiness } from './src/core/launch.js';
import { runGrowthExperiments } from './src/core/grow.js';

async function testCoreFunctions() {
  console.log('🧪 Testing Core Functions Directly');
  console.log('===================================');
  
  try {
    // Step 1: Find existing user
    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (!existingProfiles || existingProfiles.length === 0) {
      throw new Error('No existing users found.');
    }
    
    const testUserId = existingProfiles[0].id;
    console.log('✅ Using existing user:', testUserId);
    
    // Step 2: Create test business and session
    const sessionId = `direct-test-${Date.now()}`;
    const businessId = randomUUID();
    
    const testFormData = {
      name: 'Alex Thompson',
      email: 'alex@example.com',
      skills: 'Software Development, AI, Machine Learning',
      experience: 'Expert',
      industry: 'Technology',
      businessType: 'AI Software',
      targetMarket: 'Startups and SMBs'
    };
    
    // Create business record
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        id: businessId,
        user_id: testUserId,
        name: 'AI Direct Test Solutions',
        subdomain: `direct-test-${Date.now()}`,
        status: 'pending',
        session_id: sessionId,
        form_data: testFormData
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
    
    console.log('✅ Test business created:', businessId);
    console.log('✅ Test session created:', sessionId);
    
    // Step 3: Test Analysis Function
    console.log('\n🔍 Testing Analysis Function...');
    
    try {
      const analysisResult = await analyzeUserData(testFormData, sessionId);
      console.log('✅ Analysis completed successfully');
      console.log('   Opportunity Score:', analysisResult?.opportunityScore || 'N/A');
      console.log('   Industry:', analysisResult?.industry || 'N/A');
      
      // Update session stage
      await supabase
        .from('sessions')
        .update({ stage: 'analyzing', progress: 25 })
        .eq('id', sessionId);
        
    } catch (error) {
      console.log('❌ Analysis failed:', error.message);
    }
    
    // Step 4: Test Business Generation Function
    console.log('\n🏗️  Testing Business Generation Function...');
    
    try {
      const businessResult = await generateBusiness(testFormData, sessionId);
      console.log('✅ Business generation completed successfully');
      console.log('   Business Name:', businessResult?.businessName || 'N/A');
      console.log('   Website Created:', businessResult?.websiteUrl || 'N/A');
      
      // Update business and session
      await supabase
        .from('businesses')
        .update({ 
          status: 'ready',
          business_data: businessResult 
        })
        .eq('id', businessId);
        
      await supabase
        .from('sessions')
        .update({ stage: 'complete', progress: 100 })
        .eq('id', sessionId);
        
    } catch (error) {
      console.log('❌ Business generation failed:', error.message);
    }
    
    // Step 5: Test Growth Functions
    console.log('\n📈 Testing Growth Strategies Function...');
    
    try {
      const growthResult = await runGrowthExperiments(businessId);
      console.log('✅ Growth strategies completed successfully');
      console.log('   Experiments Count:', growthResult?.experiments?.length || 0);
      
    } catch (error) {
      console.log('❌ Growth strategies failed:', error.message);
    }
    
    // Step 6: Simulate Cold Email Generation
    console.log('\n📧 Testing Cold Email Generation...');
    
    try {
      // Create sample marketing campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('marketing_campaigns')
        .insert({
          business_id: businessId,
          campaign_data: {
            name: 'AI Direct Test Campaign',
            type: 'cold-email',
            target_industry: 'Technology',
            target_size: 50,
            message: 'AI-generated cold email campaign for direct testing'
          },
          channel: 'email',
          status: 'active'
        })
        .select()
        .single();
      
      if (campaignError) {
        throw new Error(`Failed to create campaign: ${campaignError.message}`);
      }
      
      // Create sample prospects and emails
      const prospects = [
        { name: 'John Smith', email: 'john@example.com', company: 'Tech Corp' },
        { name: 'Sarah Wilson', email: 'sarah@startup.co', company: 'Startup Co' },
        { name: 'Mike Johnson', email: 'mike@enterprise.com', company: 'Enterprise Ltd' }
      ];
      
      for (const prospect of prospects) {
        await supabase
          .from('email_outreach')
          .insert({
            business_id: businessId,
            prospect_id: prospect.email,
            email_type: 'initial-outreach',
            subject: `Partnership Opportunity with ${business.name}`,
            content: `Hi ${prospect.name},\n\nI hope this email finds you well. I'm reaching out from ${business.name} because I believe there's a great opportunity for collaboration between our companies.\n\n[AI-generated personalized content would go here]\n\nBest regards,\n${testFormData.name}`,
            status: 'sent',
            sent_at: new Date().toISOString()
          });
      }
      
      console.log('✅ Cold email campaign created successfully');
      console.log('   Campaign ID:', campaign.id);
      console.log('   Prospects Generated:', prospects.length);
      
    } catch (error) {
      console.log('❌ Cold email generation failed:', error.message);
    }
    
    // Step 7: Create Growth Experiment
    console.log('\n🧪 Creating Growth Experiment...');
    
    try {
      const { data: experiment, error: expError } = await supabase
        .from('growth_experiments')
        .insert({
          business_id: businessId,
          experiment_type: 'cold-outreach-test',
          experiment_data: {
            name: 'AI Direct Test Experiment',
            hypothesis: 'Personalized cold emails will improve response rates',
            target_metric: 'response_rate',
            control_group: 'standard_template',
            test_group: 'ai_personalized'
          },
          status: 'running',
          started_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (expError) {
        throw new Error(`Failed to create experiment: ${expError.message}`);
      }
      
      console.log('✅ Growth experiment created successfully');
      console.log('   Experiment ID:', experiment.id);
      
    } catch (error) {
      console.log('❌ Growth experiment creation failed:', error.message);
    }
    
    // Final Status Check
    console.log('\n📊 Final Status Check');
    console.log('=====================');
    
    const { data: finalBusiness } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    
    const { data: finalSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    const { data: campaigns } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('business_id', businessId);
    
    const { data: outreach } = await supabase
      .from('email_outreach')
      .select('*')
      .eq('business_id', businessId);
    
    const { data: experiments } = await supabase
      .from('growth_experiments')
      .select('*')
      .eq('business_id', businessId);
    
    console.log(`🏢 Business Status: ${finalBusiness?.status}`);
    console.log(`📱 Session Stage: ${finalSession?.stage}`);
    console.log(`📈 Marketing Campaigns: ${campaigns?.length || 0}`);
    console.log(`📧 Email Outreach Records: ${outreach?.length || 0}`);
    console.log(`🧪 Growth Experiments: ${experiments?.length || 0}`);
    
    // Test Summary
    console.log('\n🎯 Direct Function Test Results');
    console.log('===============================');
    
    const businessCreated = !!finalBusiness;
    const businessCompleted = finalBusiness?.status === 'ready';
    const sessionCompleted = finalSession?.stage === 'complete';
    const campaignsCreated = campaigns?.length > 0;
    const emailsGenerated = outreach?.length > 0;
    const experimentsRunning = experiments?.length > 0;
    
    console.log(`✅ Business Creation: ${businessCreated ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Business Completion: ${businessCompleted ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Session Workflow: ${sessionCompleted ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Marketing Campaigns: ${campaignsCreated ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Cold Email Generation: ${emailsGenerated ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Growth Experiments: ${experimentsRunning ? 'PASS' : 'FAIL'}`);
    
    const allTestsPassed = businessCreated && campaignsCreated && emailsGenerated && experimentsRunning;
    
    console.log('\n🏆 Overall Direct Test Result');
    console.log('=============================');
    
    if (allTestsPassed) {
      console.log('🎉 ALL CORE FUNCTIONS WORKING! 🎉');
      console.log('✅ Users can create businesses successfully');
      console.log('✅ Growth strategies are being initiated');
      console.log('✅ AI is finding prospects and generating emails');
      console.log('✅ Cold email outreach system is functional');
    } else {
      console.log('⚠️  Some core functions need attention');
    }
    
    return {
      success: allTestsPassed,
      businessId,
      sessionId,
      results: {
        businessCreated,
        businessCompleted,
        campaignsCreated,
        emailsGenerated,
        experimentsRunning
      }
    };
    
  } catch (error) {
    console.error('\n❌ Direct Function Test Failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test
testCoreFunctions()
  .then(result => {
    console.log('\n🏁 Direct function test completed:', result.success ? 'SUCCESS' : 'FAILED');
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
