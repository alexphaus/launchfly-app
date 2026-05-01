import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type ToolLogEntry } from './workflow-runner';

export interface GraphNode {
  label: string; // e.g., 'Supplier', 'Concept', 'Preference', 'Person'
  name: string;
  properties: Record<string, any>;
}

export interface GraphEdge {
  source_name: string;
  source_label: string;
  target_name: string;
  target_label: string;
  relation: string; // e.g., 'HAS_PREFERENCE', 'SUPPLIES', 'IS_A'
  properties: Record<string, any>;
}

export interface FlatMemory {
  content: string;
  category: string;
  importance: number;
}

export interface ExtractedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  flat_memories: FlatMemory[]; // Always extracted as backward-compatible fallback
}

/**
 * Asynchronously extracts entities and relationships from a completed task.
 * 
 * DUAL-WRITE STRATEGY:
 * 1. Always saves flat ai_memories (backward compatible, works without graph migration)
 * 2. Attempts to save graph nodes/edges (fails silently if tables don't exist)
 */
export async function consolidateMemoryGraph(
  goal: string,
  toolLog: ToolLogEntry[],
  finalResult: string,
  businessId: string,
  providerConfig: { name: string; baseURL: string; model: string; },
  apiKey: string
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  const toolSummary = toolLog.slice(-10).map(t =>
    `${t.tool}(${JSON.stringify(t.args).substring(0, 80)}) → ${String(t.result).substring(0, 100)}`
  ).join('\n');

  try {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey, baseURL: providerConfig.baseURL });
    
    // Prompt extracts BOTH flat memories AND graph entities in one LLM call
    const reflection = await client.chat.completions.create({
      model: providerConfig.model,
      messages: [
        { 
          role: 'system', 
          content: `You are an expert Knowledge Graph builder reviewing a completed agent task.
Extract important entities (nodes) and their relationships (edges).
Also extract 1-3 key flat learnings worth remembering.
Focus on: new contacts, suppliers, prices, owner preferences, and workflows.

Return a strictly valid JSON object matching this schema:
{
  "flat_memories": [{"content": "Human-readable learning", "category": "supplier|decision|pattern|preference|market_insight|tool_recipe|general", "importance": 0.5}],
  "nodes": [{"label": "Supplier|Preference|Concept|Person", "name": "Exact Name", "properties": {"key": "value"}}],
  "edges": [{"source_name": "Name1", "source_label": "Label1", "target_name": "Name2", "target_label": "Label2", "relation": "UPPERCASE_RELATION", "properties": {}}]
}
Return {"flat_memories": [], "nodes": [], "edges": []} if nothing is worth saving. Output ONLY JSON.` 
        },
        { 
          role: 'user', 
          content: `Goal: ${goal}\n\nTool log:\n${toolSummary}\n\nFinal result: ${finalResult.substring(0, 500)}` 
        },
      ],
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const reflectionText = reflection.choices[0]?.message?.content?.trim() || '{"flat_memories":[],"nodes":[],"edges":[]}';
    let graph: ExtractedGraph = { nodes: [], edges: [], flat_memories: [] };
    
    try {
      graph = JSON.parse(reflectionText.replace(/^```json?\n?|\n?```$/g, ''));
    } catch (err) {
      console.error(`[memory-consolidator] LLM returned non-JSON:`, reflectionText);
      return;
    }

    // ── LAYER 1: Always save flat memories (backward compatible) ──
    if (graph.flat_memories && graph.flat_memories.length > 0) {
      const embedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
      
      for (const mem of graph.flat_memories.slice(0, 3)) {
        if (!mem.content || mem.content.length < 10) continue;
        try {
          const embRes = await embedClient.embeddings.create({
            model: 'text-embedding-3-small',
            input: mem.content.substring(0, 8000),
          });
          const embedding = embRes.data[0]?.embedding;

          await supabase.from('ai_memories').insert({
            business_id: businessId,
            content: mem.content,
            category: mem.category || 'general',
            importance_score: mem.importance || 0.5,
            embedding: embedding || null,
            metadata: { source: 'auto_reflection' },
          });
        } catch (memErr) {
          console.warn(`[memory-consolidator] Flat memory save failed:`, memErr);
        }
      }
      console.log(`[memory-consolidator] Saved ${Math.min(graph.flat_memories.length, 3)} flat memories.`);
    }

    // ── LAYER 2: Attempt graph upserts (fails gracefully if tables missing) ──
    if (!graph.nodes || graph.nodes.length === 0) {
      console.log(`[memory-consolidator] No graph nodes extracted.`);
      return;
    }

    console.log(`[memory-consolidator] Extracted ${graph.nodes.length} nodes and ${graph.edges?.length || 0} edges.`);

    const embedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    
    await Promise.all(graph.nodes.map(async (node) => {
      try {
        const textToEmbed = `Label: ${node.label}\nName: ${node.name}\nProperties: ${JSON.stringify(node.properties)}`;
        const embRes = await embedClient.embeddings.create({
          model: 'text-embedding-3-small',
          input: textToEmbed,
        });
        const embedding = embRes.data[0]?.embedding;

        const { error: nodeErr } = await supabase.rpc('upsert_ai_node', {
          p_business_id: businessId,
          p_label: node.label,
          p_name: node.name,
          p_properties: node.properties,
          p_embedding: embedding
        });

        if (nodeErr) {
          // Graph tables may not exist — this is expected pre-migration
          if (nodeErr.message?.includes('does not exist') || nodeErr.code === '42883') {
            console.warn(`[memory-consolidator] Graph tables not deployed. Flat memories saved successfully.`);
            return; // Stop attempting graph ops
          }
          console.error(`[memory-consolidator] Error upserting node ${node.name}:`, nodeErr);
        }
      } catch (embErr) {
        console.error(`[memory-consolidator] Error embedding node ${node.name}:`, embErr);
      }
    }));

    // Upsert edges
    if (graph.edges && graph.edges.length > 0) {
      for (const edge of graph.edges) {
        try {
          const { data: sourceData } = await supabase.from('ai_nodes').select('id').eq('business_id', businessId).eq('label', edge.source_label).eq('name', edge.source_name).single();
          const { data: targetData } = await supabase.from('ai_nodes').select('id').eq('business_id', businessId).eq('label', edge.target_label).eq('name', edge.target_name).single();
          
          if (sourceData && targetData) {
            await supabase.rpc('upsert_ai_edge', {
              p_business_id: businessId,
              p_source_id: sourceData.id,
              p_target_id: targetData.id,
              p_relation: edge.relation,
              p_properties: edge.properties || {}
            });
          } else {
             console.warn(`[memory-consolidator] Edge resolution failed for ${edge.source_name} -> ${edge.target_name}. Missing node in DB.`);
          }
        } catch (edgeErr) {
          // Silently handle if ai_nodes table doesn't exist
          if (String(edgeErr).includes('does not exist')) return;
          console.error(`[memory-consolidator] Error upserting edge:`, edgeErr);
        }
      }
    }

  } catch (err) {
    console.warn(`[memory-consolidator] Memory consolidation failed:`, err);
  }
}
