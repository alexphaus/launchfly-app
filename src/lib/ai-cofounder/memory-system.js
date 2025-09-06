/**
 * Advanced Memory System for AI Cofounder
 * 
 * This system provides:
 * - Long-term memory with vector embeddings
 * - Context-aware retrieval
 * - Learning from successes and failures
 * - Cross-business intelligence sharing
 * - Integration with Revenue Graph Database for proven patterns
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { getCentralAIBrain } from '../central-ai-brain/orchestrator.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class AIMemorySystem {
  constructor(businessId) {
    this.businessId = businessId;
    this.shortTermMemory = new Map(); // For current session
    this.workingMemory = []; // For current task context
    this.revenueGraph = null; // Lazy loaded connection to Revenue Graph
  }

  /**
   * Store a memory with vector embedding for semantic search
   */
  async remember(memory) {
    try {
      // Generate embedding for semantic search
      const embedding = await this.generateEmbedding(memory.content);
      
      // Categorize memory type
      const category = await this.categorizeMemory(memory.content);
      
      // Store in vector database
      const { data, error } = await supabase
        .from('ai_memories')
        .insert({
          business_id: this.businessId,
          content: memory.content,
          category: category,
          context: memory.context || {},
          embedding: embedding,
          importance_score: memory.importance || 0.5,
          success_indicator: memory.success || null,
          timestamp: new Date().toISOString(),
          metadata: {
            source: memory.source || 'observation',
            confidence: memory.confidence || 0.8,
            related_entities: memory.entities || [],
            actionable: memory.actionable || false
          }
        });

      if (error) throw error;

      // Update short-term memory
      this.shortTermMemory.set(memory.key || Date.now(), {
        ...memory,
        embedding,
        category
      });

      // Learn from this memory if it's a result
      if (memory.result) {
        await this.learnFromOutcome(memory);
      }

      return data;
    } catch (error) {
      console.error('Error storing memory:', error);
      throw error;
    }
  }

  /**
   * Retrieve relevant memories based on context
   */
  async recall(query, options = {}) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search vector database for similar memories
      const { data: memories, error } = await supabase.rpc('search_memories', {
        query_embedding: queryEmbedding,
        business_id: this.businessId,
        match_threshold: options.threshold || 0.7,
        match_count: options.limit || 10
      });

      if (error) throw error;

      // Combine with short-term memory
      const recentMemories = Array.from(this.shortTermMemory.values())
        .filter(m => this.calculateSimilarity(m.embedding, queryEmbedding) > 0.7);

      // Rank by relevance and recency
      const rankedMemories = this.rankMemories([...memories, ...recentMemories], query);

      // Extract insights from memories
      const insights = await this.extractInsights(rankedMemories, query);

      return {
        memories: rankedMemories,
        insights,
        confidence: this.calculateConfidence(rankedMemories)
      };
    } catch (error) {
      console.error('Error recalling memories:', error);
      return { memories: [], insights: null, confidence: 0 };
    }
  }

  /**
   * Learn from outcomes to improve future decisions
   */
  async learnFromOutcome(outcome) {
    try {
      // Analyze what worked or didn't work
      const analysis = await this.analyzeOutcome(outcome);
      
      // Update strategy patterns
      await supabase
        .from('ai_learning_patterns')
        .upsert({
          business_id: this.businessId,
          pattern_type: analysis.patternType,
          condition: analysis.condition,
          action: analysis.action,
          outcome: analysis.outcome,
          success_rate: analysis.successRate,
          confidence: analysis.confidence,
          last_updated: new Date().toISOString()
        });

      // Share learnings with other businesses if successful
      if (analysis.successRate > 0.8 && analysis.confidence > 0.7) {
        await this.shareLearningSystems(analysis);
      }

      return analysis;
    } catch (error) {
      console.error('Error learning from outcome:', error);
    }
  }

  /**
   * Get context-aware recommendations based on memory and Revenue Graph
   */
  async getRecommendations(context) {
    try {
      // Initialize Revenue Graph connection if needed
      if (!this.revenueGraph) {
        const centralBrain = getCentralAIBrain();
        if (centralBrain) {
          this.revenueGraph = centralBrain.revenueAnalyzer;
        }
      }
      
      // Recall relevant memories
      const { memories, insights } = await this.recall(context.query || context.situation);
      
      // Find similar successful patterns from this business
      const { data: patterns } = await supabase
        .from('ai_learning_patterns')
        .select('*')
        .eq('business_id', this.businessId)
        .gte('success_rate', 0.7)
        .order('success_rate', { ascending: false })
        .limit(5);
      
      // Get proven strategies from Revenue Graph
      let revenueGraphStrategies = [];
      if (this.revenueGraph) {
        // Get business context for Revenue Graph lookup
        const { data: business } = await supabase
          .from('businesses')
          .select('business_data')
          .eq('id', this.businessId)
          .single();
        
        if (business) {
          const businessType = business.business_data?.businessType || 'service';
          const industry = business.business_data?.industry || 'general';
          
          revenueGraphStrategies = await this.revenueGraph.getBestStrategiesForBusiness(
            businessType,
            industry
          );
        }
      }

      // Generate recommendations using GPT-4 with integrated intelligence
      const recommendations = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `You are an AI business strategist with perfect memory and access to proven revenue patterns. 
                     Use past experiences, successful patterns, and Revenue Graph intelligence to recommend actions.
                     Prioritize strategies that have worked for similar businesses.`
          },
          {
            role: "user",
            content: `Context: ${JSON.stringify(context)}
                     
                     Relevant memories: ${JSON.stringify(memories.slice(0, 5))}
                     
                     Insights: ${JSON.stringify(insights)}
                     
                     Successful patterns (this business): ${JSON.stringify(patterns)}
                     
                     Proven strategies (Revenue Graph): ${JSON.stringify(revenueGraphStrategies.slice(0, 3))}
                     
                     Provide 3-5 specific, actionable recommendations that:
                     1. Are based on what has worked before (either for this business or similar ones)
                     2. Leverage proven Revenue Graph patterns
                     3. Can be executed autonomously
                     4. Include confidence scores and expected outcomes
                     5. Specify which system should execute them (acquisition engine, growth engine, etc.)`
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(recommendations.choices[0].message.content);
      
      // Add Revenue Graph confidence boost
      if (revenueGraphStrategies.length > 0) {
        result.revenueGraphBacked = true;
        result.confidence = Math.min(0.95, (result.confidence || 0.7) * 1.2);
      }
      
      return result;
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return { recommendations: [], confidence: 0 };
    }
  }

  /**
   * Consolidate and compress memories periodically
   */
  async consolidateMemories() {
    try {
      // Get all memories for this business
      const { data: memories } = await supabase
        .from('ai_memories')
        .select('*')
        .eq('business_id', this.businessId)
        .order('timestamp', { ascending: false })
        .limit(1000);

      // Group similar memories
      const clusters = await this.clusterMemories(memories);
      
      // Create consolidated insights
      for (const cluster of clusters) {
        const insight = await this.synthesizeCluster(cluster);
        
        // Store as higher-level memory
        await this.remember({
          content: insight.summary,
          category: 'consolidated_insight',
          importance: 0.9,
          context: {
            source_memories: cluster.map(m => m.id),
            synthesis_date: new Date().toISOString()
          }
        });
      }

      // Archive old detailed memories
      const cutoffDate = new Date();
      cutoffDate.setDays(cutoffDate.getDate() - 30);
      
      await supabase
        .from('ai_memories')
        .update({ archived: true })
        .eq('business_id', this.businessId)
        .lt('timestamp', cutoffDate.toISOString());

      return { consolidated: clusters.length, archived: memories.length };
    } catch (error) {
      console.error('Error consolidating memories:', error);
    }
  }

  /**
   * Share successful learnings with other businesses
   */
  async shareLearningSystems(learning) {
    try {
      // Anonymize and generalize the learning
      const generalizedLearning = {
        pattern_type: learning.patternType,
        industry: learning.industry || 'general',
        success_metric: learning.successMetric,
        confidence: learning.confidence,
        applicable_conditions: learning.conditions
      };

      // Store in shared knowledge base
      await supabase
        .from('shared_ai_knowledge')
        .insert({
          learning: generalizedLearning,
          contributor_id: this.businessId,
          verified: false,
          timestamp: new Date().toISOString()
        });

    } catch (error) {
      console.error('Error sharing learning:', error);
    }
  }

  /**
   * Access collective intelligence from all businesses
   */
  async accessCollectiveIntelligence(query) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search shared knowledge base
      const { data: sharedKnowledge } = await supabase.rpc('search_shared_knowledge', {
        query_embedding: queryEmbedding,
        match_threshold: 0.75,
        match_count: 20
      });

      // Filter by verification and success rate
      const validKnowledge = sharedKnowledge.filter(k => 
        k.verified || k.success_count > 5
      );

      return validKnowledge;
    } catch (error) {
      console.error('Error accessing collective intelligence:', error);
      return [];
    }
  }

  // Helper methods
  async generateEmbedding(text) {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text
    });
    return response.data[0].embedding;
  }

  async categorizeMemory(content) {
    const categories = [
      'customer_interaction',
      'market_insight',
      'competitor_analysis',
      'revenue_event',
      'strategy_decision',
      'product_feedback',
      'operational_metric',
      'failure_lesson',
      'success_pattern'
    ];

    // Use GPT to categorize
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `Categorize this business memory into one of: ${categories.join(', ')}`
        },
        {
          role: "user",
          content: content
        }
      ],
      temperature: 0.3
    });

    return response.choices[0].message.content.toLowerCase().replace(/[^a-z_]/g, '');
  }

  calculateSimilarity(embedding1, embedding2) {
    // Cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  rankMemories(memories, query) {
    return memories.sort((a, b) => {
      // Factor in relevance, recency, and importance
      const scoreA = (a.similarity || 0) * 0.5 + 
                    (a.importance_score || 0) * 0.3 +
                    (1 / (Date.now() - new Date(a.timestamp).getTime())) * 0.2;
      const scoreB = (b.similarity || 0) * 0.5 + 
                    (b.importance_score || 0) * 0.3 +
                    (1 / (Date.now() - new Date(b.timestamp).getTime())) * 0.2;
      return scoreB - scoreA;
    });
  }

  async extractInsights(memories, query) {
    if (memories.length === 0) return null;

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "Extract key insights and patterns from these memories."
        },
        {
          role: "user",
          content: `Query: ${query}\n\nMemories: ${JSON.stringify(memories.slice(0, 10))}\n\nProvide actionable insights.`
        }
      ],
      temperature: 0.6
    });

    return response.choices[0].message.content;
  }

  calculateConfidence(memories) {
    if (memories.length === 0) return 0;
    
    // Based on number of relevant memories and their quality
    const avgImportance = memories.reduce((sum, m) => sum + (m.importance_score || 0), 0) / memories.length;
    const recencyFactor = memories.some(m => 
      new Date(m.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ) ? 1.2 : 1;
    
    return Math.min(0.95, (memories.length / 10) * avgImportance * recencyFactor);
  }

  async analyzeOutcome(outcome) {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "Analyze this business outcome and extract learning patterns."
        },
        {
          role: "user",
          content: JSON.stringify(outcome)
        }
      ],
      temperature: 0.4,
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  }

  async clusterMemories(memories) {
    // Simple clustering based on embedding similarity
    const clusters = [];
    const used = new Set();

    for (const memory of memories) {
      if (used.has(memory.id)) continue;
      
      const cluster = [memory];
      used.add(memory.id);

      for (const other of memories) {
        if (used.has(other.id)) continue;
        
        const similarity = this.calculateSimilarity(
          memory.embedding,
          other.embedding
        );
        
        if (similarity > 0.85) {
          cluster.push(other);
          used.add(other.id);
        }
      }

      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  async synthesizeCluster(cluster) {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "Synthesize these related memories into a single insight."
        },
        {
          role: "user",
          content: JSON.stringify(cluster.map(m => m.content))
        }
      ],
      temperature: 0.5,
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  }
}
