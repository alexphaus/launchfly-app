import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

/**
 * Nightly cron job to decay importance_score of old memories.
 * If a memory falls below 0.2, it is automatically archived.
 */
export async function pruneMemories() {
  const supabase = getSupabase();
  
  console.log('[memory-pruner] Starting nightly memory prune...');
  
  // 1. Decay memories older than 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: oldMemories, error: err1 } = await supabase
    .from('ai_memories')
    .select('id, importance_score')
    .eq('archived', false)
    .lt('updated_at', thirtyDaysAgo.toISOString());
    
  if (err1) {
    console.error('[memory-pruner] Error fetching old memories:', err1);
  } else if (oldMemories && oldMemories.length > 0) {
    let decayedCount = 0;
    let archivedCount = 0;
    
    for (const mem of oldMemories) {
      const newScore = (mem.importance_score || 0.5) * 0.9; // 10% decay
      if (newScore < 0.2) {
        await supabase
          .from('ai_memories')
          .update({ archived: true, importance_score: newScore, updated_at: new Date().toISOString() })
          .eq('id', mem.id);
        archivedCount++;
      } else {
        await supabase
          .from('ai_memories')
          .update({ importance_score: newScore, updated_at: new Date().toISOString() })
          .eq('id', mem.id);
        decayedCount++;
      }
    }
    console.log(`[memory-pruner] Decayed ${decayedCount} memories. Archived ${archivedCount} memories.`);
  } else {
    console.log('[memory-pruner] No old memories to decay.');
  }
  
  // Note: Node merging using LLM could be implemented here for advanced pruning.
  // For Phase 1 MVP, we focus on scalar decay to prevent unbounded growth.
  
  console.log('[memory-pruner] Nightly prune complete.');
}
