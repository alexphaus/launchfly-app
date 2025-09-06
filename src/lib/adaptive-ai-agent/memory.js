// src/lib/adaptive-ai-agent/memory.js
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Creates an embedding for a piece of text.
 * @param {string} content The text to embed.
 * @returns {Promise<number[]>} The embedding vector.
 */
async function createEmbedding(content) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: content,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Error creating embedding:", error);
    throw error;
  }
}

/**
 * Adds a new memory to the business's memory bank.
 * @param {string} businessId The ID of the business.
 * @param {string} content The content of the memory.
 * @param {string} source The source of the memory (e.g., 'task_result', 'reflection').
 */
export async function addMemory(businessId, content, source) {
  try {
    const embedding = await createEmbedding(content);
    const { error } = await supabase.from('ai_memories').insert({
      business_id: businessId,
      content,
      embedding,
      source,
    });
    if (error) throw error;
    console.log(`💾 New memory added for business ${businessId}.`);
  } catch (error) {
    console.error("Error adding memory:", error);
  }
}

/**
 * Queries the business's memory bank for relevant information.
 * @param {string} businessId The ID of the business.
 * @param {string} queryText The text to search for.
 * @param {number} match_threshold The minimum similarity score.
 * @param {number} match_count The maximum number of memories to return.
 * @returns {Promise<Object[]>} An array of matching memories.
 */
export async function queryMemory(businessId, queryText, match_threshold = 0.7, match_count = 5) {
  try {
    const query_embedding = await createEmbedding(queryText);

    const { data: memories, error } = await supabase.rpc('match_memories', {
      query_embedding,
      p_business_id: businessId,
      match_threshold,
      match_count,
    });

    if (error) throw error;
    return memories || [];
  } catch (error) {
    console.error("Error querying memory:", error);
    return [];
  }
}
