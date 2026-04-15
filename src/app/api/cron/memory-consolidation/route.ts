/**
 * Memory Consolidation CRON
 * 
 * Runs weekly (Sunday 6 AM, before decay at 7 AM and reflection at 8 AM).
 * 
 * Purpose: Merge near-duplicate memories to prevent bloat.
 * For each business:
 * 1. Loads all active non-skill memories
 * 2. Groups memories with high cosine similarity (> 0.85)
 * 3. Keeps the highest-importance memory from each cluster
 * 4. Archives the duplicates with outcome='superseded'
 * 
 * No LLM calls — uses pure vector similarity for clustering.
 * Lightweight and fast. Skills/playbooks are excluded (curated by reflection-pulse).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  try {
    // Get all active businesses
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id')
      .eq('active', true)
      .limit(50);

    if (!businesses?.length) {
      return NextResponse.json({ message: 'No active businesses', consolidated: 0 });
    }

    let totalArchived = 0;
    let totalClusters = 0;

    for (const biz of businesses) {
      // Find near-duplicate pairs using the DB's vector similarity
      // This query finds pairs of memories with cosine similarity > 0.85
      const { data: duplicatePairs, error: pairErr } = await supabase.rpc('find_duplicate_memories', {
        match_business_id: biz.id,
        similarity_threshold: 0.85,
        max_pairs: 50,
      });

      if (pairErr || !duplicatePairs?.length) continue;

      // Build clusters: group connected memories via iterative union-find
      const parent = new Map<string, string>();
      const find = (id: string): string => {
        if (!parent.has(id)) parent.set(id, id);
        // Iterative path compression (avoids stack overflow on large sets)
        let root = id;
        while (parent.get(root) !== root) root = parent.get(root)!;
        // Compress path
        let current = id;
        while (parent.get(current) !== root) {
          const next = parent.get(current)!;
          parent.set(current, root);
          current = next;
        }
        return root;
      };
      const union = (a: string, b: string) => {
        parent.set(find(a), find(b));
      };

      const memoryScores = new Map<string, number>();
      const memoryRecalls = new Map<string, number>();

      for (const pair of duplicatePairs) {
        union(pair.id_a, pair.id_b);
        memoryScores.set(pair.id_a, pair.score_a);
        memoryScores.set(pair.id_b, pair.score_b);
        memoryRecalls.set(pair.id_a, pair.recall_a || 0);
        memoryRecalls.set(pair.id_b, pair.recall_b || 0);
      }

      // Group by root
      const clusters = new Map<string, string[]>();
      for (const id of parent.keys()) {
        const root = find(id);
        if (!clusters.has(root)) clusters.set(root, []);
        clusters.get(root)!.push(id);
      }

      // For each cluster, keep the best memory (highest importance, then most recalled), archive the rest
      for (const [, members] of clusters) {
        if (members.length < 2) continue;
        totalClusters++;

        // Sort: highest importance first, then most recalled
        members.sort((a, b) => {
          const scoreDiff = (memoryScores.get(b) || 0) - (memoryScores.get(a) || 0);
          if (scoreDiff !== 0) return scoreDiff;
          return (memoryRecalls.get(b) || 0) - (memoryRecalls.get(a) || 0);
        });

        // Keep first, archive rest
        const toArchive = members.slice(1);
        if (toArchive.length > 0) {
          const { error: archiveErr } = await supabase
            .from('ai_memories')
            .update({
              archived: true,
              outcome: 'superseded',
              validated_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .in('id', toArchive);

          if (!archiveErr) totalArchived += toArchive.length;
        }
      }
    }

    return NextResponse.json({
      message: 'Memory consolidation complete',
      businesses_scanned: businesses.length,
      clusters_found: totalClusters,
      memories_archived: totalArchived,
    });
  } catch (err) {
    console.error('[memory-consolidation] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
