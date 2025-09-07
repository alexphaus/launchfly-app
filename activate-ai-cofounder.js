#!/usr/bin/env node
/**
 * Quick script to activate Enhanced AI Cofounder for a business
 * This will fix the optimization errors and enable the new AI system
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function activateAICofounder() {
  console.log('🤖 Activating Enhanced AI Cofounder...\n');

  try {
    // Get the most recent business
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    if (!businesses || businesses.length === 0) {
      console.log('❌ No businesses found. Create a business first.');
      return;
    }

    console.log('📋 Found businesses:');
    businesses.forEach((business, index) => {
      console.log(`  ${index + 1}. ${business.business_data?.businessName || 'Unnamed'} (${business.id})`);
    });

    // Use the first (most recent) business
    const business = businesses[0];
    console.log(`\n🎯 Activating AI Cofounder for: ${business.business_data?.businessName || 'Unnamed Business'}`);
    console.log(`   Business ID: ${business.id}\n`);

    // Initialize Enhanced AI Cofounder
    console.log('1️⃣ Initializing Enhanced AI Cofounder...');
    const initResponse = await fetch('http://localhost:3000/api/ai-cofounder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: business.id,
        action: 'initialize'
      })
    });

    const initResult = await initResponse.json();
    
    if (initResult.success) {
      console.log('✅ AI Cofounder initialized successfully!');
      console.log(`   Integrations: ${Object.entries(initResult.integrations || {})
        .map(([key, value]) => `${key}=${value ? '✅' : '❌'}`)
        .join(', ')}`);
    } else {
      console.log('❌ Initialization failed:', initResult.error);
      return;
    }

    // Start the AI Cofounder
    console.log('\n2️⃣ Starting AI Cofounder...');
    const startResponse = await fetch('http://localhost:3000/api/ai-cofounder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: business.id,
        action: 'start'
      })
    });

    const startResult = await startResponse.json();
    
    if (startResult.success) {
      console.log('✅ AI Cofounder started successfully!');
    } else {
      console.log('❌ Start failed:', startResult.error);
    }

    // Get integrated status
    console.log('\n3️⃣ Checking integrated status...');
    const statusResponse = await fetch(`http://localhost:3000/api/ai-cofounder?businessId=${business.id}&action=integrated-status`);
    const statusResult = await statusResponse.json();

    if (statusResponse.ok) {
      console.log('✅ System Status:');
      console.log(`   AI Cofounder: ${statusResult.aiCofounder?.running ? '🟢 Running' : '🔴 Stopped'}`);
      console.log(`   Mode: ${statusResult.aiCofounder?.state?.mode || 'Unknown'}`);
      console.log(`   Focus: ${statusResult.aiCofounder?.state?.focus || 'Unknown'}`);
      
      const integrations = statusResult.integrations || {};
      console.log('\n🔗 Integrations:');
      console.log(`   Central AI Brain: ${integrations.centralBrain?.active ? '✅' : '❌'}`);
      console.log(`   Revenue Graph: ${integrations.revenueGraph?.active ? '✅' : '❌'}`);
      console.log(`   Guarantee Engine: ${integrations.guaranteeEngine?.active ? '✅' : '❌'}`);
      console.log(`   Growth Engine: ${integrations.growthEngine?.active ? '✅' : '❌'}`);
    }

    // Trigger a thinking cycle
    console.log('\n4️⃣ Triggering initial thinking cycle...');
    const thinkResponse = await fetch('http://localhost:3000/api/ai-cofounder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: business.id,
        action: 'think'
      })
    });

    const thinkResult = await thinkResponse.json();
    
    if (thinkResult.success) {
      console.log('✅ AI Cofounder is now thinking and making decisions!');
    } else {
      console.log('⚠️  Thinking cycle had issues:', thinkResult.error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 ACTIVATION COMPLETE!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Visit your dashboard to see the Enhanced AI Cofounder');
    console.log('2. The old optimization errors should be gone');
    console.log('3. AI will now actively work on growing your business');
    console.log('');
    console.log(`Dashboard URL: http://localhost:3000/dashboard/[your-session-id]`);
    console.log(`Business ID: ${business.id}`);

  } catch (error) {
    console.error('❌ Error activating AI Cofounder:', error);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure your dev server is running (npm run dev)');
    console.log('2. Check environment variables are set');
    console.log('3. Verify database migrations are complete');
  }
}

// Run the activation
activateAICofounder().then(() => {
  console.log('\n✨ Activation script complete!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
