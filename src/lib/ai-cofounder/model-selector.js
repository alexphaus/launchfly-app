/**
 * Model Selector
 * 
 * Intelligently selects the cheapest AI model that can handle the task
 * Helps reduce costs by 90%+ compared to always using GPT-4
 */

export class ModelSelector {
  constructor() {
    // Model costs per 1K tokens (approximate)
    this.costs = {
      'gpt-3.5-turbo': 0.002,
      'gpt-4o-mini': 0.00015,
      'gpt-4o': 0.01,
      'gpt-4': 0.03,
      'dall-e-3': 40.0 // Per image, not per token
    };

    // Task to model mapping (use cheapest that works)
    this.taskModels = {
      // Simple tasks - use cheapest
      'classify': process.env.AI_CLASSIFY_MODEL || 'gpt-3.5-turbo',
      'decide': process.env.AI_DECIDE_MODEL || 'gpt-3.5-turbo',
      'summarize': process.env.AI_SUMMARIZE_MODEL || 'gpt-3.5-turbo',
      'extract': process.env.AI_EXTRACT_MODEL || 'gpt-3.5-turbo',
      
      // Content generation - cheap but capable
      'generate_copy': process.env.AI_COPY_MODEL || 'gpt-3.5-turbo',
      'generate_email': process.env.AI_EMAIL_MODEL || 'gpt-3.5-turbo',
      'generate_social': process.env.AI_SOCIAL_MODEL || 'gpt-3.5-turbo',
      
      // Analysis - slightly better model
      'analyze': process.env.AI_ANALYZE_MODEL || 'gpt-4o-mini',
      'strategize': process.env.AI_STRATEGY_MODEL || 'gpt-4o-mini',
      'plan': process.env.AI_PLANNING_MODEL || 'gpt-4o-mini',
      
      // Complex tasks - use better models only when needed
      'negotiate': process.env.AI_NEGOTIATE_MODEL || 'gpt-4o-mini',
      'close_deal': process.env.AI_CLOSE_MODEL || 'gpt-4o',
      'create_business': process.env.AI_CREATE_MODEL || 'gpt-4o-mini',
      
      // Vision and image
      'vision': process.env.AI_VISION_MODEL || 'gpt-4o-mini',
      'generate_image': 'dall-e-3'
    };

    // Fallback model if task not found
    this.defaultModel = process.env.AI_DEFAULT_MODEL || 'gpt-3.5-turbo';
  }

  /**
   * Get the best model for a task
   * @param {string} task - The task type
   * @returns {string} Model name
   */
  getModel(task) {
    return this.taskModels[task] || this.defaultModel;
  }

  /**
   * Estimate cost for a task
   * @param {string} task - The task type
   * @param {number} estimatedTokens - Estimated tokens (default 500)
   * @returns {number} Estimated cost in dollars
   */
  estimateCost(task, estimatedTokens = 500) {
    const model = this.getModel(task);
    
    // Special case for image generation
    if (model === 'dall-e-3') {
      return 0.04; // Fixed cost per image
    }
    
    const costPer1k = this.costs[model] || this.costs[this.defaultModel];
    return (estimatedTokens / 1000) * costPer1k;
  }

  /**
   * Get model based on importance/urgency
   * @param {number} importance - 0-1 scale
   * @returns {string} Model name
   */
  getModelByImportance(importance) {
    if (importance >= 0.9) {
      return 'gpt-4o'; // High importance = best model
    } else if (importance >= 0.7) {
      return 'gpt-4o-mini'; // Medium-high importance
    } else if (importance >= 0.5) {
      return 'gpt-3.5-turbo'; // Medium importance
    } else {
      return 'gpt-3.5-turbo'; // Low importance = cheapest
    }
  }

  /**
   * Override model for specific task
   * @param {string} task - Task type
   * @param {string} model - Model to use
   */
  setTaskModel(task, model) {
    this.taskModels[task] = model;
  }

  /**
   * Get all task-model mappings
   * @returns {Object} Task to model mappings
   */
  getMappings() {
    return { ...this.taskModels };
  }

  /**
   * Calculate token count (rough estimate)
   * @param {string} text - Text to count
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Get model recommendations based on budget
   * @param {number} dailyBudget - Daily budget in dollars
   * @returns {Object} Recommended model settings
   */
  getRecommendationsForBudget(dailyBudget) {
    if (dailyBudget < 1) {
      // Ultra low budget - use cheapest models only
      return {
        classify: 'gpt-3.5-turbo',
        generate: 'gpt-3.5-turbo',
        analyze: 'gpt-3.5-turbo',
        images: false,
        maxTokens: 100
      };
    } else if (dailyBudget < 5) {
      // Low budget - mostly cheap models
      return {
        classify: 'gpt-3.5-turbo',
        generate: 'gpt-3.5-turbo',
        analyze: 'gpt-4o-mini',
        images: false,
        maxTokens: 200
      };
    } else if (dailyBudget < 20) {
      // Medium budget - balanced
      return {
        classify: 'gpt-3.5-turbo',
        generate: 'gpt-4o-mini',
        analyze: 'gpt-4o-mini',
        images: true,
        maxTokens: 500
      };
    } else {
      // High budget - use best models
      return {
        classify: 'gpt-4o-mini',
        generate: 'gpt-4o',
        analyze: 'gpt-4o',
        images: true,
        maxTokens: 1000
      };
    }
  }
}