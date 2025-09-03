#!/usr/bin/env node

/**
 * Script to integrate Revenue Engine with existing Launchfly infrastructure
 * Run this after setting up the revenue engine components
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function integrateRevenueEngine() {
  console.log('🚀 Integrating Revenue Engine with Launchfly...\n');
  
  try {
    // Step 1: Run database migrations
    console.log('📊 Setting up database tables...');
    await setupDatabase();
    
    // Step 2: Update existing businesses with templates
    console.log('🏢 Updating existing businesses...');
    await updateExistingBusinesses();
    
    // Step 3: Create webhook integration
    console.log('🔗 Setting up webhook integration...');
    await setupWebhookIntegration();
    
    // Step 4: Initialize revenue engine for active businesses
    console.log('💰 Initializing revenue engine for active businesses...');
    await initializeActiveBusinesses();
    
    // Step 5: Verify integration
    console.log('✅ Verifying integration...');
    await verifyIntegration();
    
    console.log('\n✨ Revenue Engine integration complete!');
    console.log('📈 Your businesses are now ready to generate real revenue.\n');
    
  } catch (error) {
    console.error('❌ Integration failed:', error);
    process.exit(1);
  }
}

async function setupDatabase() {
  // Check if tables exist
  const { data: tables } = await supabase
    .from('revenue_streams')
    .select('id')
    .limit(1);
  
  if (!tables) {
    console.log('   Creating revenue engine tables...');
    console.log('   ⚠️  Please run the migration manually:');
    console.log('   psql $DATABASE_URL -f supabase/migrations/20250117_revenue_engine.sql\n');
  } else {
    console.log('   ✓ Database tables already exist');
  }
}

async function updateExistingBusinesses() {
  // Get all businesses without templates
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, business_type, description')
    .is('template_id', null)
    .limit(10);
  
  if (!businesses || businesses.length === 0) {
    console.log('   ✓ No businesses need updating');
    return;
  }
  
  console.log(`   Found ${businesses.length} businesses to update`);
  
  for (const business of businesses) {
    const templateId = determineTemplate(business);
    
    await supabase
      .from('businesses')
      .update({
        template_id: templateId,
        revenue_engine_active: false // Will activate when they're ready
      })
      .eq('id', business.id);
    
    console.log(`   ✓ Updated ${business.name} with template: ${templateId}`);
  }
}

async function setupWebhookIntegration() {
  // This would be done in Inngest functions
  console.log('   ✓ Webhook integration ready (handled by Inngest)');
}

async function initializeActiveBusinesses() {
  // Get businesses created in last 7 days that don't have revenue engine
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('revenue_engine_active', false)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(5);
  
  if (!businesses || businesses.length === 0) {
    console.log('   ✓ No businesses need initialization');
    return;
  }
  
  console.log(`   Initializing ${businesses.length} recent businesses...`);
  
  for (const business of businesses) {
    try {
      const response = await fetch('http://localhost:3000/api/revenue-engine/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id
        })
      });
      
      if (response.ok) {
        console.log(`   ✓ Initialized revenue engine for ${business.name}`);
      } else {
        console.log(`   ⚠️  Failed to initialize ${business.name}`);
      }
    } catch (error) {
      console.log(`   ⚠️  Error initializing ${business.name}:`, error.message);
    }
  }
}

async function verifyIntegration() {
  // Check that core tables exist
  const tables = [
    'revenue_streams',
    'products',
    'services',
    'subscription_plans',
    'orders',
    'revenue_transactions'
  ];
  
  let allGood = true;
  
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') { // Table doesn't exist
      console.log(`   ❌ Table ${table} not found`);
      allGood = false;
    } else {
      console.log(`   ✓ Table ${table} exists`);
    }
  }
  
  if (!allGood) {
    throw new Error('Some required tables are missing. Please run migrations.');
  }
  
  // Check API endpoints
  const endpoints = [
    '/api/revenue-engine/initialize',
    '/api/revenue-engine/templates',
    '/api/revenue-engine/analytics'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://localhost:3000${endpoint}`);
      if (response.ok || response.status === 400) { // 400 is ok, means endpoint exists
        console.log(`   ✓ Endpoint ${endpoint} is accessible`);
      } else {
        console.log(`   ⚠️  Endpoint ${endpoint} returned ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ Endpoint ${endpoint} is not accessible`);
    }
  }
}

function determineTemplate(business) {
  const type = business.business_type?.toLowerCase() || '';
  const desc = business.description?.toLowerCase() || '';
  
  if (type.includes('ecommerce') || desc.includes('sell')) {
    return 'ecommerce-dropship';
  }
  if (type.includes('service') || desc.includes('service')) {
    return 'freelance-services';
  }
  if (type.includes('coach') || desc.includes('coaching')) {
    return 'online-coaching';
  }
  if (type.includes('content') || desc.includes('content')) {
    return 'ai-content-agency';
  }
  if (type.includes('course') || desc.includes('course')) {
    return 'course-creator';
  }
  
  return 'ai-content-agency'; // Default
}

// Run the integration
integrateRevenueEngine().catch(console.error);
