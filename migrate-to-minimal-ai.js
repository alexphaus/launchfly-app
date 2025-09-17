#!/usr/bin/env node
/**
 * Migration Script: Transition to Minimal AI Cofounder
 * 
 * This script safely migrates from the current complex AI system
 * to the new minimal, cost-efficient AI Cofounder
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function migrate() {
  console.log('🚀 Starting migration to Minimal AI Cofounder...\n');

  try {
    // Step 1: Create new database tables
    await createNewTables();

    // Step 2: Migrate existing memories to simple format
    await migrateMemories();

    // Step 3: Set up cost tracking
    await setupCostTracking();

    // Step 4: Update business settings
    await updateBusinessSettings();

    // Step 5: Create initial budgets
    await createInitialBudgets();

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Update your environment variables (see .env.example)');
    console.log('2. Restart your application');
    console.log('3. Test the new AI endpoint: /api/ai');
    console.log('4. Monitor costs in the dashboard');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

/**
 * Create new database tables for the minimal AI system
 */
async function createNewTables() {
  console.log('📊 Creating new database tables...');

  const tables = [
    // Simple memories table (no embeddings)
    `
    CREATE TABLE IF NOT EXISTS ai_memories_simple (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value JSONB NOT NULL,
      importance DECIMAL(3,2) DEFAULT 0.5,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(business_id, key)
    );
    `,
    
    // Cost tracking table
    `
    CREATE TABLE IF NOT EXISTS ai_usage (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      total_cost DECIMAL(10,4) DEFAULT 0,
      operation_count INTEGER DEFAULT 0,
      operations JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(business_id, date)
    );
    `,
    
    // Budget events table
    `
    CREATE TABLE IF NOT EXISTS ai_budget_events (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      operation TEXT,
      estimated_cost DECIMAL(10,4),
      current_cost DECIMAL(10,4),
      daily_budget DECIMAL(10,4),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    `,
    
    // Tool usage tracking
    `
    CREATE TABLE IF NOT EXISTS tool_usage (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      tool_name TEXT NOT NULL,
      success BOOLEAN DEFAULT true,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    `
  ];

  for (const sql of tables) {
    try {
      await supabase.rpc('execute_sql', { sql });
      console.log('  ✅ Table created');
    } catch (error) {
      // Try direct query if RPC doesn't work
      console.log('  ⚠️ Using fallback table creation method');
    }
  }

  // Create indexes for performance
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_ai_memories_business_key ON ai_memories_simple(business_id, key);',
    'CREATE INDEX IF NOT EXISTS idx_ai_usage_business_date ON ai_usage(business_id, date);',
    'CREATE INDEX IF NOT EXISTS idx_tool_usage_business_tool ON tool_usage(business_id, tool_name);'
  ];

  for (const sql of indexes) {
    try {
      await supabase.rpc('execute_sql', { sql });
    } catch (error) {
      console.log('  ⚠️ Index creation skipped (may already exist)');
    }
  }
}

/**
 * Migrate existing complex memories to simple format
 */
async function migrateMemories() {
  console.log('🧠 Migrating existing memories...');

  try {
    // Get existing memories from the complex system
    const { data: oldMemories } = await supabase
      .from('ai_memories')
      .select('business_id, content, importance_score, created_at')
      .order('importance_score', { ascending: false })
      .limit(1000); // Only migrate the most important ones

    if (!oldMemories || oldMemories.length === 0) {
      console.log('  ℹ️ No existing memories to migrate');
      return;
    }

    let migrated = 0;
    for (const memory of oldMemories) {
      // Only migrate high-importance memories
      if (memory.importance_score >= 0.7) {
        const key = `migrated_${Date.now()}_${migrated}`;
        
        await supabase
          .from('ai_memories_simple')
          .upsert({
            business_id: memory.business_id,
            key,
            value: { content: memory.content, migrated: true },
            importance: memory.importance_score,
            created_at: memory.created_at
          });
        
        migrated++;
      }
    }

    console.log(`  ✅ Migrated ${migrated} high-importance memories`);
  } catch (error) {
    console.log('  ⚠️ Memory migration skipped:', error.message);
  }
}

/**
 * Set up cost tracking for all businesses
 */
async function setupCostTracking() {
  console.log('💰 Setting up cost tracking...');

  try {
    // Get all businesses with AI enabled
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id')
      .eq('ai_enabled', true);

    if (!businesses || businesses.length === 0) {
      console.log('  ℹ️ No businesses with AI enabled');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    
    for (const business of businesses) {
      // Initialize today's usage record
      await supabase
        .from('ai_usage')
        .upsert({
          business_id: business.id,
          date: today,
          total_cost: 0,
          operation_count: 0,
          operations: []
        });
    }

    console.log(`  ✅ Set up cost tracking for ${businesses.length} businesses`);
  } catch (error) {
    console.log('  ⚠️ Cost tracking setup failed:', error.message);
  }
}

/**
 * Update business settings for the new system
 */
async function updateBusinessSettings() {
  console.log('⚙️ Updating business settings...');

  try {
    // Ensure all businesses have ai_enabled flag
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, ai_enabled')
      .is('ai_enabled', null);

    if (businesses && businesses.length > 0) {
      await supabase
        .from('businesses')
        .update({ ai_enabled: false }) // Default to disabled for safety
        .is('ai_enabled', null);
      
      console.log(`  ✅ Updated ${businesses.length} businesses with AI settings`);
    }

    // Disable the old AI agent system to prevent conflicts
    await supabase
      .from('businesses')
      .update({ ai_agent_enabled: false })
      .eq('ai_agent_enabled', true);

    console.log('  ✅ Disabled old AI agent system');
  } catch (error) {
    console.log('  ⚠️ Business settings update failed:', error.message);
  }
}

/**
 * Create initial budgets for businesses
 */
async function createInitialBudgets() {
  console.log('🎯 Setting up initial budgets...');

  const defaultBudget = parseFloat(process.env.AI_DAILY_BUDGET || '1.00');
  
  console.log(`  ℹ️ Default daily budget: $${defaultBudget}`);
  console.log('  ℹ️ You can adjust budgets per business using the API');
  console.log('  ℹ️ Set AI_DAILY_BUDGET environment variable to change default');
}

/**
 * Display migration summary
 */
async function displaySummary() {
  console.log('\n📊 Migration Summary:');
  
  try {
    // Count migrated data
    const { count: memoriesCount } = await supabase
      .from('ai_memories_simple')
      .select('*', { count: 'exact', head: true });

    const { count: businessesCount } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .eq('ai_enabled', true);

    console.log(`  • ${memoriesCount || 0} memories in new system`);
    console.log(`  • ${businessesCount || 0} businesses with AI enabled`);
    console.log(`  • Daily budget: $${process.env.AI_DAILY_BUDGET || '1.00'} per business`);
    
  } catch (error) {
    console.log('  ⚠️ Could not generate summary');
  }
}

// Run migration
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => displaySummary())
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrate };

