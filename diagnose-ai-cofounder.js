#!/usr/bin/env node
/**
 * Diagnostic script to identify AI Cofounder JSON parsing issues
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function diagnoseIssues() {
  console.log('🔍 Diagnosing AI Cofounder Issues...\n');

  // Check environment variables
  console.log('1️⃣ Environment Variables:');
  console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing'}`);

  // Test OpenAI API with JSON format
  console.log('\n2️⃣ Testing OpenAI JSON Response:');
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant. Always respond with valid JSON."
        },
        {
          role: "user",
          content: "Generate a simple test response with status and message fields."
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    console.log(`   Raw response: ${content}`);
    
    try {
      const parsed = JSON.parse(content);
      console.log('   ✅ JSON parsing successful');
      console.log(`   Parsed: ${JSON.stringify(parsed, null, 2)}`);
    } catch (parseError) {
      console.log('   ❌ JSON parsing failed:', parseError.message);
      console.log('   This is the root cause of your error!');
    }
  } catch (apiError) {
    console.log('   ❌ OpenAI API error:', apiError.message);
  }

  // Test database connection
  console.log('\n3️⃣ Testing Database Connection:');
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('id')
      .limit(1);

    if (error) {
      console.log('   ❌ Database error:', error.message);
    } else {
      console.log('   ✅ Database connection successful');
    }
  } catch (dbError) {
    console.log('   ❌ Database connection failed:', dbError.message);
  }

  // Check if required tables exist
  console.log('\n4️⃣ Checking Required Tables:');
  const tables = ['ai_memories', 'ai_experiments', 'businesses'];
  
  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error && error.code === '42P01') {
        console.log(`   ❌ Table '${table}' missing - run migrations`);
      } else if (error) {
        console.log(`   ⚠️  Table '${table}' error: ${error.message}`);
      } else {
        console.log(`   ✅ Table '${table}' exists`);
      }
    } catch (err) {
      console.log(`   ❌ Error checking '${table}': ${err.message}`);
    }
  }

  // Test a simple AI Cofounder API call
  console.log('\n5️⃣ Testing AI Cofounder API:');
  try {
    const testResponse = await fetch('http://localhost:3000/api/ai-cofounder', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (testResponse.ok) {
      console.log('   ✅ AI Cofounder API endpoint accessible');
    } else {
      console.log(`   ❌ API returned status: ${testResponse.status}`);
    }
  } catch (fetchError) {
    console.log('   ❌ Cannot reach API endpoint:', fetchError.message);
    console.log('   Make sure your dev server is running: npm run dev');
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎯 DIAGNOSIS COMPLETE');
  console.log('');
  console.log('Common fixes:');
  console.log('1. If OpenAI JSON parsing failed: This is likely a model issue');
  console.log('   - Try using gpt-3.5-turbo instead of gpt-4-turbo-preview');
  console.log('   - Add more explicit JSON format instructions');
  console.log('');
  console.log('2. If database tables missing:');
  console.log('   - Run: npx supabase db push');
  console.log('   - Or manually run the migration files');
  console.log('');
  console.log('3. If API not accessible:');
  console.log('   - Run: npm run dev');
  console.log('   - Check port 3000 is available');
}

// Run diagnosis
diagnoseIssues().catch(error => {
  console.error('❌ Diagnosis failed:', error);
  process.exit(1);
});
