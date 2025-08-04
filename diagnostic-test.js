/**
 * Comprehensive Diagnostic Test
 * 
 * This test will check every component of the pipeline in detail:
 * 1. Database operations
 * 2. API endpoint responses
 * 3. Inngest event processing
 * 4. Core function execution
 * 5. Real-time data flow
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

const API_BASE = 'http://localhost:3000';

async function comprehensiveDiagnostic() {
  console.log('🔬 COMPREHENSIVE DIAGNOSTIC TEST');
  console.log('=================================');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  const testResults = {
    database: {},
    api: {},
    inngest: {},
    core: {},
    realtime: {}
  };

  try {
    // ===== PHASE 1: DATABASE DIAGNOSTICS =====
    console.log('📊 PHASE 1: Database Diagnostics');
    console.log('=================================');

    // Test database connectivity
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (profileError) {
      throw new Error(`Database connection failed: ${profileError.message}`);
    }

    testResults.database.connectivity = '✅ PASS';
    console.log('✅ Database connectivity: PASS');

    if (!profiles || profiles.length === 0) {
      throw new Error('No users found in database');
    }

    const testUserId = profiles[0].id;
    testResults.database.userExists = '✅ PASS';
    console.log('✅ Test user available:', testUserId);

    // Check all required tables
    const requiredTables = ['businesses', 'sessions', 'marketing_campaigns', 'email_outreach', 'growth_experiments'];
    for (const table of requiredTables) {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        testResults.database[`${table}_table`] = `❌ FAIL: ${error.message}`;
        console.log(`❌ Table ${table}: FAIL`);
      } else {
        testResults.database[`${table}_table`] = '✅ PASS';
        console.log(`✅ Table ${table}: PASS`);
      }
    }

    // ===== PHASE 2: API ENDPOINT DIAGNOSTICS =====
    console.log('\n🌐 PHASE 2: API Endpoint Diagnostics');
    console.log('====================================');

    // Test Inngest endpoint
    const inngestResponse = await fetch(`${API_BASE}/api/inngest`, {
      method: 'GET'
    });
    
    if (!inngestResponse.ok) {
      testResults.api.inngest_endpoint = `❌ FAIL: ${inngestResponse.status}`;
      console.log('❌ Inngest endpoint: FAIL');
    } else {
      const inngestData = await inngestResponse.json();
      testResults.api.inngest_endpoint = '✅ PASS';
      testResults.api.inngest_functions = inngestData.function_count || 0;
      console.log('✅ Inngest endpoint: PASS');
      console.log(`   Functions registered: ${inngestData.function_count}`);
      console.log(`   Has event key: ${inngestData.has_event_key}`);
      console.log(`   Has signing key: ${inngestData.has_signing_key}`);
    }

    // Test test-inngest endpoint
    const testInngestResponse = await fetch(`${API_BASE}/api/test-inngest`, {
      method: 'GET'
    });

    if (!testInngestResponse.ok) {
      testResults.api.test_inngest = `❌ FAIL: ${testInngestResponse.status}`;
      console.log('❌ Test Inngest endpoint: FAIL');
    } else {
      const testData = await testInngestResponse.json();
      testResults.api.test_inngest = '✅ PASS';
      console.log('✅ Test Inngest endpoint: PASS');
      console.log(`   Inngest configured: ${testData.inngestStatus?.configured}`);
    }

    // ===== PHASE 3: CREATE TEST BUSINESS =====
    console.log('\n🏗️  PHASE 3: Create Test Business');
    console.log('=================================');

    const sessionId = `diagnostic-${Date.now()}`;
    const businessId = randomUUID();

    const testBusinessData = {
      id: businessId,
      user_id: testUserId,
      name: 'Diagnostic Test Business',
      subdomain: `diagnostic-${Date.now()}`,
      status: 'pending',
      session_id: sessionId,
      form_data: {
        name: 'Test Entrepreneur',
        email: 'test@diagnostic.com',
        skills: 'Business Strategy, Marketing',
        experience: 'Professional',
        industry: 'Technology',
        businessType: 'SaaS',
        targetMarket: 'Small businesses'
      }
    };

    // Create business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert(testBusinessData)
      .select()
      .single();

    if (businessError) {
      testResults.database.business_creation = `❌ FAIL: ${businessError.message}`;
      throw new Error(`Business creation failed: ${businessError.message}`);
    }

    testResults.database.business_creation = '✅ PASS';
    console.log('✅ Business created:', businessId);

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
      testResults.database.session_creation = `❌ FAIL: ${sessionError.message}`;
      throw new Error(`Session creation failed: ${sessionError.message}`);
    }

    testResults.database.session_creation = '✅ PASS';
    console.log('✅ Session created:', sessionId);

    // ===== PHASE 4: TEST BUSINESS GENERATION WORKFLOW =====
    console.log('\n⚡ PHASE 4: Business Generation Workflow');
    console.log('=======================================');

    // Trigger business generation
    const generateResponse = await fetch(`${API_BASE}/api/generate-business`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        businessId,
        formData: testBusinessData.form_data
      })
    });

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      testResults.api.business_generation = `❌ FAIL: ${generateResponse.status} - ${errorText}`;
      console.log('❌ Business generation API: FAIL');
    } else {
      const generateResult = await generateResponse.json();
      testResults.api.business_generation = generateResult.success ? '✅ PASS' : `❌ FAIL: ${generateResult.error}`;
      console.log('✅ Business generation API: PASS');
    }

    // ===== PHASE 5: MONITOR REAL-TIME CHANGES =====
    console.log('\n⏱️  PHASE 5: Real-time Change Monitoring');
    console.log('========================================');

    console.log('Monitoring database changes for 60 seconds...');
    
    let monitoringAttempts = 0;
    const maxMonitoringAttempts = 12; // 60 seconds / 5 seconds = 12 attempts
    let lastBusinessData = null;
    let lastSessionData = null;

    while (monitoringAttempts < maxMonitoringAttempts) {
      monitoringAttempts++;
      
      // Check business changes
      const { data: currentBusiness } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();

      // Check session changes
      const { data: currentSession } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      const businessChanged = JSON.stringify(currentBusiness) !== JSON.stringify(lastBusinessData);
      const sessionChanged = JSON.stringify(currentSession) !== JSON.stringify(lastSessionData);

      console.log(`\n📊 Monitor Check #${monitoringAttempts} (${new Date().toLocaleTimeString()})`);
      console.log('---------------------------------------------------');
      console.log(`Business Status: ${currentBusiness?.status || 'unknown'}`);
      console.log(`Session Stage: ${currentSession?.stage || 'unknown'}`);
      console.log(`Session Progress: ${currentSession?.progress || 0}%`);
      console.log(`Business Data: ${currentBusiness?.business_data ? 'PRESENT' : 'NULL'}`);
      
      if (businessChanged) {
        console.log('🔄 Business data changed!');
        if (currentBusiness?.business_data) {
          console.log('   ✅ Business data now populated');
          testResults.realtime.business_data_populated = '✅ PASS';
        }
      }
      
      if (sessionChanged) {
        console.log('🔄 Session data changed!');
        if (currentSession?.stage !== 'pending') {
          console.log(`   ✅ Session progressed to: ${currentSession.stage}`);
          testResults.realtime.session_progress = '✅ PASS';
        }
      }

      // Check if business generation completed
      if (currentBusiness?.status === 'ready' || currentSession?.stage === 'complete') {
        console.log('🎉 Business generation completed!');
        testResults.realtime.generation_completed = '✅ PASS';
        break;
      }

      // Check if business generation failed
      if (currentBusiness?.status === 'failed' || currentSession?.stage === 'error') {
        console.log('❌ Business generation failed');
        testResults.realtime.generation_completed = '❌ FAIL';
        break;
      }

      lastBusinessData = currentBusiness;
      lastSessionData = currentSession;

      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // ===== PHASE 6: DETAILED STATUS CHECK =====
    console.log('\n🔍 PHASE 6: Detailed Status Analysis');
    console.log('====================================');

    // Final status check
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

    console.log('Final Business Data:');
    console.log('-------------------');
    console.log(`Status: ${finalBusiness?.status}`);
    console.log(`Business Data: ${finalBusiness?.business_data ? 'PRESENT' : 'NULL'}`);
    if (finalBusiness?.business_data) {
      const data = finalBusiness.business_data;
      console.log(`  Business Name: ${data.businessName || 'missing'}`);
      console.log(`  Industry: ${data.industry || 'missing'}`);
      console.log(`  Website URL: ${data.websiteUrl || 'missing'}`);
      console.log(`  Products: ${data.products?.length || 0} items`);
    }

    console.log('\nFinal Session Data:');
    console.log('------------------');
    console.log(`Stage: ${finalSession?.stage}`);
    console.log(`Progress: ${finalSession?.progress}%`);
    console.log(`Inngest Job ID: ${finalSession?.inngest_job_id || 'none'}`);

    // Check for any marketing activities
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

    console.log('\nMarketing Activities:');
    console.log('--------------------');
    console.log(`Campaigns: ${campaigns?.length || 0}`);
    console.log(`Email Outreach: ${outreach?.length || 0}`);
    console.log(`Experiments: ${experiments?.length || 0}`);

    // ===== PHASE 7: INNGEST EVENTS ANALYSIS =====
    console.log('\n🔄 PHASE 7: Inngest Events Analysis');
    console.log('===================================');

    // Test individual Inngest triggers
    const inngestTests = [
      {
        name: 'Business Generation Test',
        action: 'test-business-generation',
        businessId
      },
      {
        name: 'Growth Strategy Test',
        action: 'test-growth-strategy',
        businessId
      },
      {
        name: 'Cold Email Test',
        action: 'test-cold-email',
        businessId
      }
    ];

    for (const test of inngestTests) {
      const response = await fetch(`${API_BASE}/api/test-inngest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: test.action,
          businessId: test.businessId
        })
      });

      if (!response.ok) {
        testResults.inngest[test.action] = `❌ FAIL: ${response.status}`;
        console.log(`❌ ${test.name}: FAIL`);
      } else {
        const result = await response.json();
        testResults.inngest[test.action] = result.success ? '✅ PASS' : `❌ FAIL: ${result.error}`;
        console.log(`✅ ${test.name}: ${result.success ? 'PASS' : 'FAIL'}`);
      }
    }

    // ===== FINAL ASSESSMENT =====
    console.log('\n🏆 FINAL DIAGNOSTIC ASSESSMENT');
    console.log('===============================');

    const issues = [];
    const warnings = [];

    // Check for critical issues
    if (finalBusiness?.status === 'pending') {
      issues.push('❌ CRITICAL: Business status stuck at "pending"');
    }

    if (!finalBusiness?.business_data) {
      issues.push('❌ CRITICAL: Business data is NULL');
    }

    if (finalSession?.stage === 'pending') {
      issues.push('❌ CRITICAL: Session stage stuck at "pending"');
    }

    if (finalSession?.progress === 0) {
      warnings.push('⚠️  WARNING: Session progress not updating');
    }

    if (campaigns?.length === 0 && outreach?.length === 0) {
      warnings.push('⚠️  WARNING: No marketing activities generated');
    }

    console.log('\nISSUES FOUND:');
    if (issues.length === 0) {
      console.log('✅ No critical issues detected');
    } else {
      issues.forEach(issue => console.log(issue));
    }

    console.log('\nWARNINGS:');
    if (warnings.length === 0) {
      console.log('✅ No warnings');
    } else {
      warnings.forEach(warning => console.log(warning));
    }

    // Environment check
    console.log('\n🔧 ENVIRONMENT CHECK:');
    console.log('=====================');
    console.log(`OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ SET' : '❌ MISSING'}`);
    console.log(`Inngest Event Key: ${process.env.INNGEST_EVENT_KEY ? '✅ SET' : '❌ MISSING'}`);
    console.log(`Inngest Signing Key: ${process.env.INNGEST_SIGNING_KEY ? '✅ SET' : '❌ MISSING'}`);
    console.log(`Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ SET' : '❌ MISSING'}`);
    console.log(`Supabase Service Key: ${process.env.SUPABASE_SERVICE_KEY ? '✅ SET' : '❌ MISSING'}`);

    return {
      success: issues.length === 0,
      testResults,
      issues,
      warnings,
      businessId,
      sessionId,
      finalBusiness,
      finalSession
    };

  } catch (error) {
    console.error('\n💥 DIAGNOSTIC FAILED:', error.message);
    console.error('Stack trace:', error.stack);
    return {
      success: false,
      error: error.message,
      testResults
    };
  }
}

// Run the comprehensive diagnostic
comprehensiveDiagnostic()
  .then(result => {
    console.log('\n📋 DIAGNOSTIC SUMMARY');
    console.log('=====================');
    console.log(`Overall Result: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
    if (result.issues?.length > 0) {
      console.log(`Critical Issues: ${result.issues.length}`);
    }
    if (result.warnings?.length > 0) {
      console.log(`Warnings: ${result.warnings.length}`);
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal diagnostic error:', error);
    process.exit(1);
  });
