#!/usr/bin/env node

// test-simulation.js - Run various simulations to debug the stuck dashboard

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

async function runTest(name, testFn) {
  log(colors.blue, `\n🧪 ${name}`);
  log(colors.blue, '━'.repeat(50));
  try {
    await testFn();
    log(colors.green, `✅ ${name} - PASSED`);
  } catch (error) {
    log(colors.red, `❌ ${name} - FAILED: ${error.message}`);
  }
}

async function checkServer(url, name) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      log(colors.green, `✅ ${name} is running`);
      return true;
    } else {
      log(colors.red, `❌ ${name} responded with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    log(colors.red, `❌ ${name} is not running: ${error.message}`);
    return false;
  }
}

async function runQuickDiagnostic() {
  try {
    const response = await fetch('http://localhost:3000/api/test/simulate-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'quick' })
    });
    
    const result = await response.json();
    
    log(colors.bold, '\n📊 DIAGNOSTIC RESULTS:');
    console.log('━'.repeat(50));
    
    result.steps?.forEach(step => {
      if (step.includes('✅')) {
        log(colors.green, step);
      } else {
        log(colors.yellow, step);
      }
    });
    
    if (result.errors?.length > 0) {
      log(colors.red, '\n🚨 ERRORS FOUND:');
      result.errors.forEach(error => log(colors.red, error));
    }
    
    if (result.recommendations?.length > 0) {
      log(colors.yellow, '\n💡 RECOMMENDATIONS:');
      result.recommendations.forEach(rec => log(colors.yellow, rec));
    }
    
    return result.success;
  } catch (error) {
    log(colors.red, `❌ Diagnostic failed: ${error.message}`);
    return false;
  }
}

async function runFullSimulation() {
  try {
    const response = await fetch('http://localhost:3000/api/test/simulate-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'full' })
    });
    
    const result = await response.json();
    
    log(colors.bold, '\n🚀 FULL SIMULATION RESULTS:');
    console.log('━'.repeat(50));
    
    result.steps?.forEach(step => {
      if (step.includes('✅')) {
        log(colors.green, step);
      } else if (step.includes('❌')) {
        log(colors.red, step);
      } else {
        log(colors.yellow, step);
      }
    });
    
    if (result.success) {
      log(colors.green, `\n🎉 SIMULATION SUCCESSFUL!`);
      log(colors.blue, `📍 Test session created: ${result.sessionId}`);
      log(colors.blue, `🌐 Monitor at: http://localhost:3000/dashboard/${result.sessionId}`);
      
      if (result.inngest?.eventId) {
        log(colors.blue, `📨 Inngest event ID: ${result.inngest.eventId}`);
        log(colors.blue, `🔍 Check Inngest dashboard: http://localhost:8288`);
      }
    } else {
      log(colors.red, '\n🚨 SIMULATION FAILED');
      result.errors?.forEach(error => log(colors.red, error));
    }
    
    return result;
  } catch (error) {
    log(colors.red, `❌ Full simulation failed: ${error.message}`);
    return null;
  }
}

async function testExistingSession(sessionId) {
  try {
    const response = await fetch(`http://localhost:3000/api/debug/session-status?sessionId=${sessionId}`);
    const result = await response.json();
    
    log(colors.bold, `\n🔍 SESSION STATUS: ${sessionId}`);
    console.log('━'.repeat(50));
    
    if (result.session?.found) {
      log(colors.green, `✅ Session exists`);
      log(colors.blue, `📊 Stage: ${result.session.data?.stage || 'unknown'}`);
      log(colors.blue, `⏰ Created: ${result.session.data?.created_at || 'unknown'}`);
    } else {
      log(colors.red, `❌ Session not found`);
    }
    
    if (result.business?.found) {
      log(colors.green, `✅ Business record exists`);
      log(colors.blue, `📈 Status: ${result.business.data?.status || 'unknown'}`);
    } else {
      log(colors.red, `❌ Business record not found`);
    }
    
    result.diagnosis?.forEach(diag => {
      if (diag.includes('✅')) {
        log(colors.green, diag);
      } else if (diag.includes('❌')) {
        log(colors.red, diag);
      } else {
        log(colors.yellow, diag);
      }
    });
    
    if (result.recommendations?.length > 0) {
      log(colors.yellow, '\n💡 RECOMMENDATIONS:');
      result.recommendations.forEach(rec => log(colors.yellow, rec));
    }
    
    return result;
  } catch (error) {
    log(colors.red, `❌ Session test failed: ${error.message}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'diagnostic';
  
  log(colors.bold, '🔬 LAUNCHFLY DEBUG SIMULATION');
  log(colors.bold, '━'.repeat(50));
  
  // Test 1: Check if servers are running
  await runTest('Server Status Check', async () => {
    const nextjs = await checkServer('http://localhost:3000/api/debug/session-status', 'Next.js');
    const inngest = await checkServer('http://localhost:8288/health', 'Inngest');
    
    if (!nextjs) {
      throw new Error('Next.js server not running. Run: npm run dev');
    }
    
    if (!inngest) {
      log(colors.yellow, '⚠️  Inngest dev server not running');
      log(colors.yellow, '💡 Start with: npx inngest-cli@latest dev');
    }
  });
  
  if (command === 'diagnostic' || command === 'quick') {
    // Test 2: Quick diagnostic
    await runTest('Quick Diagnostic', runQuickDiagnostic);
  }
  
  if (command === 'full') {
    // Test 3: Full simulation
    await runTest('Full Simulation', runFullSimulation);
  }
  
  if (command === 'session' && args[1]) {
    // Test 4: Check existing session
    await runTest(`Session Check: ${args[1]}`, () => testExistingSession(args[1]));
  }
  
  // Final recommendations
  log(colors.bold, '\n🎯 NEXT STEPS:');
  console.log('━'.repeat(50));
  log(colors.blue, '1. If Inngest is not running:');
  log(colors.yellow, '   npx inngest-cli@latest dev');
  log(colors.blue, '2. If database tables are missing:');
  log(colors.yellow, '   Run database-migration.sql in Supabase');
  log(colors.blue, '3. Monitor a test session:');
  log(colors.yellow, '   node test-simulation.js full');
  log(colors.blue, '4. Check your stuck session:');
  log(colors.yellow, '   node test-simulation.js session business-cu2zyotm');
}

// Handle different commands
if (require.main === module) {
  main().catch(error => {
    log(colors.red, `❌ Test suite failed: ${error.message}`);
    process.exit(1);
  });
}