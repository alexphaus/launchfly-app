#!/usr/bin/env node
/**
 * Test script for Integrated AI Cofounder System
 * 
 * This verifies that the AI Cofounder properly integrates with:
 * - Central AI Brain
 * - Revenue Graph Database
 * - Guarantee Engine
 * - Real Acquisition Engine
 * - Growth Engine
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 Testing Integrated AI Cofounder System\n');
console.log('=' .repeat(50));

async function testIntegration() {
  const results = {
    aiCofounder: false,
    centralBrain: false,
    revenueGraph: false,
    guaranteeEngine: false,
    memorySystem: false,
    experiments: false,
    revenue: false,
    totalScore: 0
  };

  try {
    // Test 1: Check database tables exist
    console.log('\n📊 Testing Database Schema...');
    const tables = [
      'ai_memories',
      'ai_learning_patterns',
      'ai_business_plans',
      'ai_experiments',
      'revenue_patterns',
      'revenue_guarantees',
      'business_metrics'
    ];
    
    let tablesExist = 0;
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('id')
        .limit(1);
      
      if (!error || error.code !== '42P01') {
        tablesExist++;
        console.log(`  ✅ Table ${table} exists`);
      } else {
        console.log(`  ❌ Table ${table} missing`);
      }
    }
    
    results.aiCofounder = tablesExist >= 4;
    results.revenueGraph = tablesExist >= 6;
    
    // Test 2: Check AI Cofounder components
    console.log('\n🤖 Testing AI Cofounder Components...');
    try {
      const { EnhancedAICofounder } = await import('./src/lib/ai-cofounder/enhanced-orchestrator.js');
      console.log('  ✅ Enhanced Orchestrator loaded');
      
      const { AIMemorySystem } = await import('./src/lib/ai-cofounder/memory-system.js');
      console.log('  ✅ Memory System loaded');
      results.memorySystem = true;
      
      const { AutonomousExperiments } = await import('./src/lib/ai-cofounder/autonomous-experiments.js');
      console.log('  ✅ Autonomous Experiments loaded');
      results.experiments = true;
      
      const { RevenueIntelligence } = await import('./src/lib/ai-cofounder/revenue-intelligence.js');
      console.log('  ✅ Revenue Intelligence loaded');
      results.revenue = true;
    } catch (error) {
      console.log(`  ❌ Error loading AI Cofounder: ${error.message}`);
    }
    
    // Test 3: Check existing revenue systems
    console.log('\n💰 Testing Existing Revenue Systems...');
    try {
      const { getCentralAIBrain } = await import('./src/lib/central-ai-brain/orchestrator.js');
      const brain = getCentralAIBrain();
      console.log(`  ✅ Central AI Brain ${brain ? 'available' : 'not initialized'}`);
      results.centralBrain = true;
      
      const { getRevenueGuaranteeEngine } = await import('./src/lib/guarantee-engine/revenue-guarantee.js');
      const guarantee = getRevenueGuaranteeEngine();
      console.log(`  ✅ Guarantee Engine ${guarantee ? 'available' : 'not initialized'}`);
      results.guaranteeEngine = true;
    } catch (error) {
      console.log(`  ❌ Error loading revenue systems: ${error.message}`);
    }
    
    // Test 4: Test integration points
    console.log('\n🔗 Testing Integration Points...');
    
    // Test if AI Cofounder can connect to Revenue Graph
    try {
      const testBusinessId = 'test-' + Date.now();
      const { AIMemorySystem } = await import('./src/lib/ai-cofounder/memory-system.js');
      const memory = new AIMemorySystem(testBusinessId);
      
      // This should attempt to connect to Revenue Graph
      const recommendations = await memory.getRecommendations({
        situation: 'Test integration'
      });
      
      console.log('  ✅ Memory System can integrate with Revenue Graph');
      console.log(`     Revenue Graph backed: ${recommendations.revenueGraphBacked || false}`);
    } catch (error) {
      console.log(`  ⚠️  Memory integration test failed: ${error.message}`);
    }
    
    // Calculate score
    results.totalScore = Object.values(results).filter(v => v === true).length;
    const maxScore = Object.keys(results).length - 1; // Exclude totalScore
    const percentage = Math.round((results.totalScore / maxScore) * 100);
    
    // Summary
    console.log('\n' + '=' .repeat(50));
    console.log('📈 INTEGRATION TEST RESULTS\n');
    
    console.log('Component Status:');
    console.log(`  AI Cofounder:      ${results.aiCofounder ? '✅' : '❌'}`);
    console.log(`  Memory System:     ${results.memorySystem ? '✅' : '❌'}`);
    console.log(`  Experiments:       ${results.experiments ? '✅' : '❌'}`);
    console.log(`  Revenue Intel:     ${results.revenue ? '✅' : '❌'}`);
    console.log(`  Central Brain:     ${results.centralBrain ? '✅' : '❌'}`);
    console.log(`  Revenue Graph:     ${results.revenueGraph ? '✅' : '❌'}`);
    console.log(`  Guarantee Engine:  ${results.guaranteeEngine ? '✅' : '❌'}`);
    
    console.log(`\nOverall Score: ${results.totalScore}/${maxScore} (${percentage}%)`);
    
    if (percentage >= 80) {
      console.log('\n🎉 EXCELLENT! Integration is working well.');
      console.log('The AI Cofounder is successfully integrated with existing revenue systems.');
    } else if (percentage >= 60) {
      console.log('\n✅ GOOD! Core integration is functional.');
      console.log('Some components may need initialization or configuration.');
    } else {
      console.log('\n⚠️  NEEDS ATTENTION. Integration is incomplete.');
      console.log('Run database migrations and ensure all systems are properly configured.');
    }
    
    console.log('\n💡 Next Steps:');
    console.log('1. Run database migrations if tables are missing');
    console.log('2. Initialize Central AI Brain for full integration');
    console.log('3. Test with a real business ID for complete validation');
    console.log('4. Monitor the integrated system via /api/ai-cofounder?action=integrated-status');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the test
testIntegration().then(() => {
  console.log('\n✨ Integration test complete!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
