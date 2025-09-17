/**
 * Lightweight Memory System
 * 
 * Simple key-value memory without expensive embeddings
 * Only remembers what's important (importance >= 0.8)
 * Uses pattern matching instead of vector search
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export class LightweightMemory {
  constructor(businessId) {
    this.businessId = businessId;
    this.cache = new Map(); // In-memory cache for current session
    this.size = 0;
  }

  /**
   * Remember something important
   * @param {string} key - Memory key
   * @param {any} value - Memory value
   * @param {number} importance - How important is this? (0-1)
   */
  async remember(key, value, importance = 0.5) {
    // Only remember important things to save costs
    if (importance < 0.8) {
      // Store in temporary cache only
      this.cache.set(key, { value, importance, timestamp: Date.now() });
      return;
    }

    try {
      // Store in database for important memories
      await supabase
        .from('ai_memories_simple')
        .upsert({
          business_id: this.businessId,
          key,
          value: JSON.stringify(value),
          importance,
          created_at: new Date().toISOString()
        });

      // Also cache locally
      this.cache.set(key, { value, importance, timestamp: Date.now() });
      this.size++;

      // Clean up old memories if too many (keep last 100)
      if (this.size > 100) {
        await this.cleanup();
      }
    } catch (error) {
      console.error('Error storing memory:', error);
    }
  }

  /**
   * Recall memories matching a pattern
   * @param {string} pattern - Pattern to match
   * @returns {Array} Matching memories
   */
  async recall(pattern) {
    try {
      // Check cache first
      const cachedResults = [];
      for (const [key, memory] of this.cache.entries()) {
        if (key.toLowerCase().includes(pattern.toLowerCase())) {
          cachedResults.push({
            key,
            ...memory
          });
        }
      }

      // If we have enough cached results, return them
      if (cachedResults.length >= 3) {
        return cachedResults
          .sort((a, b) => b.importance - a.importance)
          .slice(0, 5);
      }

      // Otherwise, check database
      const { data } = await supabase
        .from('ai_memories_simple')
        .select('*')
        .eq('business_id', this.businessId)
        .ilike('key', `%${pattern}%`)
        .order('importance', { ascending: false })
        .limit(5);

      if (!data) return cachedResults;

      // Parse stored values
      const dbResults = data.map(memory => ({
        key: memory.key,
        value: JSON.parse(memory.value),
        importance: memory.importance,
        timestamp: new Date(memory.created_at).getTime()
      }));

      // Combine and deduplicate
      const allResults = [...cachedResults, ...dbResults];
      const unique = Array.from(
        new Map(allResults.map(item => [item.key, item])).values()
      );

      return unique
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 5);
    } catch (error) {
      console.error('Error recalling memories:', error);
      return [];
    }
  }

  /**
   * Get a specific memory
   * @param {string} key - Memory key
   * @returns {any} Memory value or null
   */
  async get(key) {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key).value;
    }

    try {
      const { data } = await supabase
        .from('ai_memories_simple')
        .select('value')
        .eq('business_id', this.businessId)
        .eq('key', key)
        .single();

      if (data) {
        const value = JSON.parse(data.value);
        // Cache it for future use
        this.cache.set(key, { value, importance: 0.5, timestamp: Date.now() });
        return value;
      }
    } catch (error) {
      console.error('Error getting memory:', error);
    }

    return null;
  }

  /**
   * Check if a memory exists
   * @param {string} key - Memory key
   * @returns {boolean} True if memory exists
   */
  async has(key) {
    if (this.cache.has(key)) {
      return true;
    }

    try {
      const { data } = await supabase
        .from('ai_memories_simple')
        .select('key')
        .eq('business_id', this.businessId)
        .eq('key', key)
        .single();

      return !!data;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear old memories to save space
   */
  async cleanup() {
    try {
      // Get all memories
      const { data } = await supabase
        .from('ai_memories_simple')
        .select('key, importance, created_at')
        .eq('business_id', this.businessId)
        .order('created_at', { ascending: false });

      if (!data || data.length <= 100) return;

      // Keep only the 100 most recent important memories
      const toDelete = data
        .slice(100)
        .filter(m => m.importance < 0.9) // Never delete very important memories
        .map(m => m.key);

      if (toDelete.length > 0) {
        await supabase
          .from('ai_memories_simple')
          .delete()
          .eq('business_id', this.businessId)
          .in('key', toDelete);

        console.log(`Cleaned up ${toDelete.length} old memories`);
      }

      this.size = Math.min(data.length, 100);
    } catch (error) {
      console.error('Error cleaning up memories:', error);
    }
  }

  /**
   * Get all memories for export/backup
   */
  async exportAll() {
    try {
      const { data } = await supabase
        .from('ai_memories_simple')
        .select('*')
        .eq('business_id', this.businessId)
        .order('importance', { ascending: false });

      return data?.map(m => ({
        key: m.key,
        value: JSON.parse(m.value),
        importance: m.importance,
        created_at: m.created_at
      })) || [];
    } catch (error) {
      console.error('Error exporting memories:', error);
      return [];
    }
  }

  /**
   * Clear all memories (use with caution)
   */
  async clearAll() {
    try {
      await supabase
        .from('ai_memories_simple')
        .delete()
        .eq('business_id', this.businessId);

      this.cache.clear();
      this.size = 0;
      
      console.log('All memories cleared');
    } catch (error) {
      console.error('Error clearing memories:', error);
    }
  }
}

