#!/usr/bin/env node
/**
 * Quick fix for JSON parsing errors in AI Cofounder
 * This script will help identify and resolve the "string did not match expected pattern" error
 */

import 'dotenv/config';

async function quickFix() {
  console.log('🔧 Quick Fix for AI Cofounder JSON Error\n');

  // Test 1: Check if server is running
  console.log('1️⃣ Checking if development server is running...');
  try {
    const response = await fetch('http://localhost:3000/api/ai-cofounder');
    console.log(`   ✅ Server is running (status: ${response.status})`);
  } catch (error) {
    console.log('   ❌ Server not running! Start with: npm run dev');
    console.log('   This is likely the cause of your error.');
    return;
  }

  // Test 2: Check environment variables
  console.log('\n2️⃣ Checking environment variables...');
  const requiredVars = [
    'OPENAI_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL', 
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  let missingVars = [];
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
      console.log(`   ❌ ${varName} is missing`);
    } else {
      console.log(`   ✅ ${varName} is set`);
    }
  });

  if (missingVars.length > 0) {
    console.log('\n❌ MISSING ENVIRONMENT VARIABLES');
    console.log('Add these to your .env.local file:');
    missingVars.forEach(varName => {
      console.log(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    return;
  }

  // Test 3: Simple API call
  console.log('\n3️⃣ Testing AI Cofounder API...');
  try {
    const response = await fetch('http://localhost:3000/api/ai-cofounder?businessId=test&action=status');
    const data = await response.json();
    console.log('   ✅ API call successful');
    console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
  } catch (error) {
    console.log('   ❌ API call failed:', error.message);
    if (error.message.includes('JSON')) {
      console.log('   This is the JSON parsing error you\'re experiencing!');
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎯 QUICK FIXES TO TRY:');
  console.log('');
  console.log('1. RESTART YOUR DEVELOPMENT SERVER:');
  console.log('   - Stop: Ctrl+C');
  console.log('   - Start: npm run dev');
  console.log('');
  console.log('2. CLEAR BROWSER CACHE:');
  console.log('   - Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)');
  console.log('   - Or open in incognito/private window');
  console.log('');
  console.log('3. CHECK BROWSER CONSOLE:');
  console.log('   - Open Developer Tools (F12)');
  console.log('   - Look for detailed error messages');
  console.log('');
  console.log('4. TRY MANUAL INITIALIZATION:');
  console.log('   - Go to your dashboard');
  console.log('   - Click "Retry Initialization" button');
  console.log('   - Check browser console for errors');
  console.log('');
  console.log('5. FALLBACK - USE OLD SYSTEM:');
  console.log('   - The old AI system will continue working');
  console.log('   - New AI Cofounder will retry automatically');

  console.log('\n✨ Most likely fix: Restart dev server and refresh browser!');
}

quickFix().catch(error => {
  console.error('❌ Fix script error:', error);
  console.log('\nIf this script fails, the issue is likely:');
  console.log('1. Development server not running (npm run dev)');
  console.log('2. Missing environment variables in .env.local');
  console.log('3. Network/port issues');
});
