// scripts/initialize-central-brain.js
// Run this once to start managing existing businesses with Central AI Brain

import { initializeCentralAIBrain } from '../src/lib/central-ai-brain/orchestrator.js';

async function initializeForExistingBusinesses() {
  console.log('🧠 Initializing Central AI Brain for existing businesses...');
  
  try {
    // Initialize the Central AI Brain
    const brain = await initializeCentralAIBrain();
    const status = brain.getSystemStatus();
    
    console.log(`✅ Central AI Brain initialized successfully!`);
    console.log(`📊 Managing ${status.businessCount} businesses`);
    console.log(`🎯 Success rate: ${(status.metrics.successRate * 100).toFixed(1)}%`);
    console.log(`⚡ Active optimizations: ${status.metrics.activeOptimizations}`);
    
    // The brain will now automatically:
    // 1. Monitor all existing businesses
    // 2. Collect conversion data for Revenue Graph
    // 3. Apply optimizations where needed
    // 4. Cross-pollinate successful strategies
    
    console.log('\n🚀 Your existing businesses are now managed by Central AI Brain!');
    console.log('📈 Revenue intelligence will improve as more data is collected');
    console.log('🎯 Check /api/central-brain?action=status for real-time metrics');
    
  } catch (error) {
    console.error('❌ Failed to initialize Central AI Brain:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeForExistingBusinesses();
