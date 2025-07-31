#!/usr/bin/env node

/**
 * Debug script for business generation issues
 * Run with: node debug-generation.js
 */

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function debugGeneration() {
  console.log('🔍 Debugging Business Generation Issues\n');

  // Test 1: Check environment variables
  console.log('1. Environment Variables:');
  const envVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'OPENAI_API_KEY',
  ];
  
  for (const envVar of envVars) {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: ${process.env[envVar].substring(0, 20)}...`);
    } else {
      console.log(`❌ ${envVar}: Missing`);
    }
  }

  // Test 2: Database connectivity
  console.log('\n2. Database Connectivity:');
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, stage')
      .eq('stage', 'error')
      .limit(5);
    
    if (error) throw error;
    console.log(`✅ Database connected. Found ${data.length} error sessions`);
    
    if (data.length > 0) {
      console.log('Recent error sessions:');
      data.forEach(session => {
        console.log(`   Session ${session.id}: ${session.stage}`);
      });
    }
  } catch (error) {
    console.log(`❌ Database error: ${error.message}`);
  }

  // Test 3: OpenAI API connectivity
  console.log('\n3. OpenAI API Connectivity:');
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say 'API connection working' in JSON format." }
      ],
      response_format: { type: "json_object" },
      max_tokens: 50
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    console.log(`✅ OpenAI API connected: ${JSON.stringify(result)}`);
  } catch (error) {
    console.log(`❌ OpenAI API error: ${error.message}`);
    if (error.code) {
      console.log(`   Error code: ${error.code}`);
    }
  }

  // Test 4: Test business analysis with sample data
  console.log('\n4. Testing Business Analysis:');
  try {
    const testUserData = {
      name: "Test User",
      skills: "Web development and design",
      businessType: "Service-based business",
      goal: "Make $3000 per month",
      preferences: "Work remotely"
    };

    console.log('Testing with sample user data...');
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are a brilliant business strategist that finds profitable opportunities based on people's skills." 
        },
        { 
          role: "user", 
          content: `As a business strategist, analyze these skills and preferences to identify the most profitable business opportunity:
          
          Name: ${testUserData.name}
          Skills/Interests: ${testUserData.skills}
          Business Type: ${testUserData.businessType}
          Goal: ${testUserData.goal}
          Preferences: ${testUserData.preferences}
          
          Find a specific, profitable market niche that:
          1. Matches their skills
          2. Has proven customer demand
          3. Can be quickly validated
          4. Has low competition or a unique angle
          5. Can generate revenue quickly
          
          Return a JSON object with:
          {
            "businessName": "Creative and memorable business name",
            "niche": "Specific target market",
            "problem": "Clear problem being solved",
            "solution": "How this business solves it",
            "uniqueAdvantage": "What makes this opportunity special",
            "profitPotential": "Estimated monthly revenue range",
            "validationStrategy": "How to quickly test this business idea",
            "confidence": 0.85
          }`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000
    });
    
    const opportunity = JSON.parse(response.choices[0].message.content);
    console.log('✅ Business analysis successful:');
    console.log(`   Business Name: ${opportunity.businessName}`);
    console.log(`   Niche: ${opportunity.niche}`);
    console.log(`   Confidence: ${opportunity.confidence}`);
  } catch (error) {
    console.log(`❌ Business analysis error: ${error.message}`);
    console.log('   Full error:', error);
  }

  // Test 5: Check recent sessions with errors
  console.log('\n5. Recent Error Sessions:');
  try {
    const { data: errorSessions, error } = await supabase
      .from('sessions')
      .select(`
        id, 
        stage, 
        progress, 
        created_at,
        businesses!inner(
          id,
          name,
          form_data,
          status
        )
      `)
      .eq('stage', 'error')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (error) throw error;
    
    if (errorSessions.length > 0) {
      console.log(`Found ${errorSessions.length} recent error sessions:`);
      errorSessions.forEach((session, index) => {
        console.log(`\n   ${index + 1}. Session ${session.id}:`);
        console.log(`      Stage: ${session.stage}`);
        console.log(`      Progress: ${session.progress}%`);
        console.log(`      Business: ${session.businesses.name}`);
        console.log(`      Business Status: ${session.businesses.status}`);
        console.log(`      Created: ${new Date(session.created_at).toLocaleString()}`);
        if (session.businesses.form_data) {
          console.log(`      User: ${session.businesses.form_data.name || 'Unknown'}`);
          console.log(`      Skills: ${session.businesses.form_data.skills || 'Unknown'}`);
        }
      });
    } else {
      console.log('✅ No recent error sessions found');
    }
  } catch (error) {
    console.log(`❌ Error checking sessions: ${error.message}`);
  }

  console.log('\n🏁 Debug completed. If you see errors above, those are likely causing the generation failures.');
}

debugGeneration().catch(console.error);
