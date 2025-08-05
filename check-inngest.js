#!/usr/bin/env node

// check-inngest.js - Quick Inngest status checker

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

async function checkInngestStatus() {
  log(colors.bold, '🔍 INNGEST STATUS CHECK');
  log(colors.bold, '━'.repeat(40));
  
  try {
    // Check if Inngest dev server is running
    const healthResponse = await fetch('http://localhost:8288/health');
    
    if (!healthResponse.ok) {
      throw new Error(`Health check failed with status: ${healthResponse.status}`);
    }
    
    log(colors.green, '✅ Inngest dev server is running');
    
    // Check registered functions
    try {
      const functionsResponse = await fetch('http://localhost:8288/api/v1/functions');
      const functions = await functionsResponse.json();
      
      log(colors.blue, `📊 Registered functions: ${functions.data?.length || 0}`);
      
      const expectedFunctions = [
        'generate-business',
        'growth-engine',
        'customer-acquisition-orchestrator',
        'daily-outreach',
        'email-response-handler',
        'campaign-optimizer',
        'weekly-performance-report'
      ];
      
      if (functions.data?.length > 0) {
        log(colors.green, '\n📋 Functions found:');
        functions.data.forEach(fn => {
          const isExpected = expectedFunctions.some(expected => fn.name.includes(expected));
          const color = isExpected ? colors.green : colors.yellow;
          log(color, `  • ${fn.name}`);
        });
        
        // Check if we have the key functions
        const hasGenerateBusiness = functions.data.some(fn => fn.name.includes('generate-business'));
        const hasGrowthEngine = functions.data.some(fn => fn.name.includes('growth-engine'));
        const hasCustomerAcquisition = functions.data.some(fn => fn.name.includes('customer-acquisition'));
        
        if (hasGenerateBusiness && hasGrowthEngine) {
          log(colors.green, '\n🎉 All core functions registered!');
        } else {
          log(colors.yellow, '\n⚠️  Some core functions missing:');
          if (!hasGenerateBusiness) log(colors.red, '  ❌ generate-business function');
          if (!hasGrowthEngine) log(colors.red, '  ❌ growth-engine function');
          if (!hasCustomerAcquisition) log(colors.red, '  ❌ customer-acquisition functions');
        }
      } else {
        log(colors.red, '❌ No functions registered');
        log(colors.yellow, '💡 Check your /api/inngest/route.js file');
      }
      
    } catch (error) {
      log(colors.yellow, `⚠️  Could not fetch function list: ${error.message}`);
    }
    
    // Check recent events
    try {
      const eventsResponse = await fetch('http://localhost:8288/api/v1/events?limit=5');
      const events = await eventsResponse.json();
      
      if (events.data?.length > 0) {
        log(colors.blue, `\n📨 Recent events: ${events.data.length}`);
        events.data.slice(0, 3).forEach(event => {
          log(colors.blue, `  • ${event.name} (${new Date(event.ts).toLocaleTimeString()})`);
        });
      } else {
        log(colors.yellow, '\n📭 No recent events found');
      }
    } catch (error) {
      log(colors.yellow, `⚠️  Could not fetch events: ${error.message}`);
    }
    
    log(colors.blue, '\n🌐 Inngest Dashboard: http://localhost:8288');
    
  } catch (error) {
    log(colors.red, '❌ Inngest dev server is NOT running');
    log(colors.yellow, '💡 Start it with: npx inngest-cli@latest dev');
    log(colors.yellow, '💡 Make sure you run it in a separate terminal');
    
    return false;
  }
  
  return true;
}

async function testEventSending() {
  log(colors.bold, '\n🚀 TESTING EVENT SENDING');
  log(colors.bold, '━'.repeat(40));
  
  try {
    const response = await fetch('http://localhost:3000/api/test/simulate-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'quick' })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        log(colors.green, '✅ Event sending test passed');
      } else {
        log(colors.red, '❌ Event sending test failed');
        result.errors?.forEach(error => log(colors.red, `  ${error}`));
      }
    } else {
      log(colors.red, `❌ Test API not responding: ${response.status}`);
    }
  } catch (error) {
    log(colors.red, `❌ Could not test event sending: ${error.message}`);
    log(colors.yellow, '💡 Make sure Next.js is running: npm run dev');
  }
}

async function main() {
  const isInngestRunning = await checkInngestStatus();
  
  if (isInngestRunning) {
    await testEventSending();
    
    log(colors.bold, '\n🎯 READY TO TEST!');
    log(colors.green, '✅ Inngest is running and ready');
    log(colors.blue, '🧪 Run full simulation: node test-simulation.js full');
    log(colors.blue, '🔍 Check your session: node test-simulation.js session business-cu2zyotm');
  } else {
    log(colors.bold, '\n🚨 ACTION NEEDED:');
    log(colors.yellow, '1. Open a new terminal');
    log(colors.yellow, '2. Run: npx inngest-cli@latest dev');
    log(colors.yellow, '3. Wait for "Functions registered" message');
    log(colors.yellow, '4. Run this script again: node check-inngest.js');
  }
}

if (require.main === module) {
  main().catch(error => {
    log(colors.red, `❌ Check failed: ${error.message}`);
    process.exit(1);
  });
}