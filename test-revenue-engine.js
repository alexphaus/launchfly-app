// test-revenue-engine.js
// Simple test script to validate revenue engine components

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Launchfly Revenue Engine Implementation\n');

// Test 1: Check if all required files exist
const requiredFiles = [
  'src/lib/email-health/preflight.ts',
  'src/lib/email-health/compliance.ts', 
  'src/lib/email-health/ramp.ts',
  'src/lib/senders/resend.ts',
  'src/lib/events.ts',
  'src/lib/links.ts',
  'src/lib/payments/stripe.ts',
  'src/lib/manual-override.ts',
  'src/lib/offer-validate.ts',
  'src/lib/prospects/index.ts',
  'src/lib/prospects/seedCsv.ts',
  'src/app/api/unsubscribe/[token]/route.ts',
  'src/app/api/r/[slug]/route.ts',
  'src/app/api/stripe/webhook/route.ts',
  'src/app/api/metrics/[businessId]/route.ts',
  'src/app/api/health.json/route.ts',
  'supabase/migrations/2025XXXX_engine.sql',
  'scripts/e2e-seed.ts',
  'data/seeds/logo-design.csv'
];

console.log('📁 Checking file structure...');
let filesExist = 0;
for (const file of requiredFiles) {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`${exists ? '✅' : '❌'} ${file}`);
  if (exists) filesExist++;
}

console.log(`\n📊 File Structure: ${filesExist}/${requiredFiles.length} files found (${Math.round(filesExist/requiredFiles.length*100)}%)\n`);

// Test 2: Check environment variables structure
console.log('🔧 Checking environment configuration...');
const envExample = fs.readFileSync(path.join(__dirname, '.env.example'), 'utf8');
const requiredEnvVars = [
  'RESEND_API_KEY',
  'SENDER_EMAIL', 
  'DAILY_SEND_CAP',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_KEY'
];

let envConfigured = 0;
for (const envVar of requiredEnvVars) {
  const mentioned = envExample.includes(envVar) || process.env[envVar];
  console.log(`${mentioned ? '✅' : '❌'} ${envVar}`);
  if (mentioned) envConfigured++;
}

console.log(`\n📊 Environment: ${envConfigured}/${requiredEnvVars.length} variables configured (${Math.round(envConfigured/requiredEnvVars.length*100)}%)\n`);

// Test 3: Check database schema
console.log('🗄️  Checking database schema...');
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const requiredTables = [
  'campaigns',
  'emails', 
  'clicks',
  'email_replies',
  'suppression_list',
  'prospects',
  'businesses'
];

let tablesFound = 0;
for (const table of requiredTables) {
  const found = schema.includes(`CREATE TABLE public.${table}`) || schema.includes(`create table if not exists public.${table}`);
  console.log(`${found ? '✅' : '❌'} ${table} table`);
  if (found) tablesFound++;
}

console.log(`\n📊 Database Schema: ${tablesFound}/${requiredTables.length} tables found (${Math.round(tablesFound/requiredTables.length*100)}%)\n`);

// Test 4: Check CSV data
console.log('📋 Checking test data...');
try {
  const csvData = fs.readFileSync(path.join(__dirname, 'data/seeds/logo-design.csv'), 'utf8');
  const lines = csvData.trim().split('\n');
  const hasHeader = lines[0].includes('name,email,company');
  const hasData = lines.length > 1;
  console.log(`${hasHeader ? '✅' : '❌'} CSV header format`);
  console.log(`${hasData ? '✅' : '❌'} CSV test data (${lines.length - 1} prospects)`);
} catch (e) {
  console.log('❌ CSV file not found or readable');
}

// Test 5: Check package.json scripts
console.log('\n⚙️  Checking NPM scripts...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const requiredScripts = ['e2e:seed', 'dev', 'build'];
let scriptsFound = 0;
for (const script of requiredScripts) {
  const found = packageJson.scripts && packageJson.scripts[script];
  console.log(`${found ? '✅' : '❌'} ${script} script`);
  if (found) scriptsFound++;
}

// Summary
console.log('\n🎯 REVENUE ENGINE TEST SUMMARY');
console.log('=====================================');
const overallScore = Math.round(((filesExist/requiredFiles.length) + (envConfigured/requiredEnvVars.length) + (tablesFound/requiredTables.length) + (scriptsFound/requiredScripts.length)) / 4 * 100);

console.log(`📁 File Structure:     ${Math.round(filesExist/requiredFiles.length*100)}%`);
console.log(`🔧 Environment:        ${Math.round(envConfigured/requiredEnvVars.length*100)}%`);
console.log(`🗄️  Database Schema:    ${Math.round(tablesFound/requiredTables.length*100)}%`);
console.log(`⚙️  NPM Scripts:        ${Math.round(scriptsFound/requiredScripts.length*100)}%`);
console.log(`\n🏆 OVERALL SCORE:      ${overallScore}%`);

if (overallScore >= 90) {
  console.log('🎉 Excellent! Revenue engine is well implemented.');
} else if (overallScore >= 75) {
  console.log('✅ Good! Revenue engine has solid implementation with minor gaps.');
} else if (overallScore >= 60) {
  console.log('⚠️  Fair. Revenue engine has basic structure but needs work.');
} else {
  console.log('❌ Poor. Revenue engine implementation has significant gaps.');
}

console.log('\n📖 Next steps:');
console.log('1. Start dev server: npm run dev');
console.log('2. Run seed test: npm run e2e:seed');
console.log('3. Test endpoints: curl http://localhost:3000/api/health.json');
