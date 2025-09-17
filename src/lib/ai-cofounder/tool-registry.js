/**
 * Tool Registry System
 * 
 * Expandable tool system for the AI Cofounder
 * Start with core tools, add more as needed
 */

import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Base Tool Class
 */
class Tool {
  constructor(name, description) {
    this.name = name;
    this.description = description;
    this.enabled = true;
  }

  async execute(params) {
    throw new Error('Tool must implement execute method');
  }
}

/**
 * Email Tool - Send emails via Resend
 */
class EmailTool extends Tool {
  constructor() {
    super('send_email', 'Send emails to prospects and customers');
  }

  async execute(params) {
    const { to, subject, message, from } = params;
    
    try {
      const result = await resend.emails.send({
        from: from || 'AI Cofounder <ai@launchfly.com>',
        to,
        subject,
        text: message,
        html: message.replace(/\n/g, '<br>')
      });

      return {
        success: true,
        messageId: result.data?.id,
        message: 'Email sent successfully'
      };
    } catch (error) {
      console.error('Email send error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Website Tool - Update website content
 */
class WebsiteTool extends Tool {
  constructor(businessId) {
    super('update_website', 'Update website content and settings');
    this.businessId = businessId;
  }

  async execute(params) {
    const { section, content, type = 'text' } = params;
    
    try {
      // Get current business data
      const { data: business } = await supabase
        .from('businesses')
        .select('business_data')
        .eq('id', this.businessId)
        .single();

      if (!business) {
        return { success: false, error: 'Business not found' };
      }

      // Update the specific section
      const updatedData = { ...business.business_data };
      
      switch (section) {
        case 'hero':
          updatedData.hero = { ...updatedData.hero, ...content };
          break;
        case 'pricing':
          updatedData.pricing = content;
          break;
        case 'products':
          updatedData.products = content;
          break;
        case 'tagline':
          updatedData.tagline = content;
          break;
        default:
          updatedData[section] = content;
      }

      // Save updated data
      const { error } = await supabase
        .from('businesses')
        .update({ business_data: updatedData })
        .eq('id', this.businessId);

      if (error) throw error;

      return {
        success: true,
        message: `Updated ${section} successfully`
      };
    } catch (error) {
      console.error('Website update error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Metrics Tool - Analyze business metrics
 */
class MetricsTool extends Tool {
  constructor(businessId) {
    super('analyze_metrics', 'Analyze business performance metrics');
    this.businessId = businessId;
  }

  async execute(params) {
    const { timeframe = '7d', metrics = ['revenue', 'conversions'] } = params;
    
    try {
      // Calculate date range
      const days = parseInt(timeframe) || 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get sales data
      const { data: sales } = await supabase
        .from('sales')
        .select('amount, created_at')
        .eq('business_id', this.businessId)
        .gte('created_at', startDate.toISOString());

      // Get activity data
      const { data: activities } = await supabase
        .from('ai_activities')
        .select('type, metadata')
        .eq('business_id', this.businessId)
        .gte('created_at', startDate.toISOString());

      // Calculate metrics
      const totalRevenue = sales?.reduce((sum, sale) => sum + sale.amount, 0) || 0;
      const totalSales = sales?.length || 0;
      const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;
      
      // Count conversions
      const conversions = activities?.filter(a => 
        a.type === 'email_replied' || a.type === 'meeting_booked'
      ).length || 0;

      return {
        success: true,
        metrics: {
          revenue: totalRevenue,
          sales: totalSales,
          avgOrderValue,
          conversions,
          conversionRate: activities?.length > 0 ? (conversions / activities.length * 100).toFixed(2) : 0
        },
        timeframe,
        period: `Last ${days} days`
      };
    } catch (error) {
      console.error('Metrics analysis error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Content Tool - Generate content
 */
class ContentTool extends Tool {
  constructor() {
    super('generate_content', 'Generate marketing content and copy');
  }

  async execute(params) {
    const { type, topic, length = 'short', tone = 'professional' } = params;
    
    try {
      const prompts = {
        'email': `Write a ${length} ${tone} email about ${topic}`,
        'social': `Write a ${tone} social media post about ${topic}. Keep it engaging and under 280 characters.`,
        'blog': `Write a ${length} blog post intro about ${topic} in a ${tone} tone.`,
        'ad': `Write a compelling ad copy about ${topic}. Include a clear CTA.`
      };

      const prompt = prompts[type] || `Write ${type} content about ${topic}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a skilled copywriter.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: length === 'short' ? 150 : 500,
        temperature: 0.7
      });

      return {
        success: true,
        content: response.choices[0].message.content,
        type,
        tokens: response.usage?.total_tokens
      };
    } catch (error) {
      console.error('Content generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Database Tool - Query and update database
 */
class DatabaseTool extends Tool {
  constructor(businessId) {
    super('database', 'Query and update database records');
    this.businessId = businessId;
  }

  async execute(params) {
    const { action, table, data, filters } = params;
    
    try {
      let query = supabase.from(table);
      
      // Add business_id filter for safety
      if (!['users', 'businesses'].includes(table)) {
        filters.business_id = this.businessId;
      }

      switch (action) {
        case 'select':
          query = query.select(data || '*');
          for (const [key, value] of Object.entries(filters || {})) {
            query = query.eq(key, value);
          }
          const { data: selectData, error: selectError } = await query;
          if (selectError) throw selectError;
          return { success: true, data: selectData };

        case 'insert':
          const { error: insertError } = await query.insert({ ...data, business_id: this.businessId });
          if (insertError) throw insertError;
          return { success: true, message: 'Record inserted' };

        case 'update':
          query = query.update(data);
          for (const [key, value] of Object.entries(filters || {})) {
            query = query.eq(key, value);
          }
          const { error: updateError } = await query;
          if (updateError) throw updateError;
          return { success: true, message: 'Record updated' };

        default:
          return { success: false, error: 'Invalid database action' };
      }
    } catch (error) {
      console.error('Database operation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Tool Registry - Manages all available tools
 */
export class ToolRegistry {
  constructor(businessId) {
    this.businessId = businessId;
    this.tools = new Map();
    
    // Register core tools
    this.registerCoreTools();
  }

  /**
   * Register the core tools that are always available
   */
  registerCoreTools() {
    // Always available tools
    this.register(new EmailTool());
    this.register(new WebsiteTool(this.businessId));
    this.register(new MetricsTool(this.businessId));
    this.register(new ContentTool());
    this.register(new DatabaseTool(this.businessId));
    
    // Optional tools (register only if API keys exist)
    if (process.env.OPENAI_API_KEY && process.env.ENABLE_IMAGE_GENERATION === 'true') {
      this.register(new ImageTool());
    }
  }

  /**
   * Register a new tool
   */
  register(tool) {
    this.tools.set(tool.name, tool);
  }

  /**
   * Check if a tool is available
   */
  has(toolName) {
    return this.tools.has(toolName) && this.tools.get(toolName).enabled;
  }

  /**
   * Use a tool
   */
  async use(toolName, params) {
    if (!this.has(toolName)) {
      throw new Error(`Tool ${toolName} is not available`);
    }

    const tool = this.tools.get(toolName);
    
    // Log tool usage for monitoring
    console.log(`Using tool: ${toolName}`, { params });
    
    try {
      const result = await tool.execute(params);
      
      // Record successful tool usage
      await this.recordUsage(toolName, true);
      
      return result;
    } catch (error) {
      // Record failed tool usage
      await this.recordUsage(toolName, false, error.message);
      throw error;
    }
  }

  /**
   * List all available tools
   */
  listAvailable() {
    return Array.from(this.tools.values())
      .filter(tool => tool.enabled)
      .map(tool => tool.name);
  }

  /**
   * Get tool descriptions
   */
  getDescriptions() {
    const descriptions = {};
    for (const [name, tool] of this.tools.entries()) {
      if (tool.enabled) {
        descriptions[name] = tool.description;
      }
    }
    return descriptions;
  }

  /**
   * Enable/disable a tool
   */
  setEnabled(toolName, enabled) {
    if (this.tools.has(toolName)) {
      this.tools.get(toolName).enabled = enabled;
    }
  }

  /**
   * Record tool usage for analytics
   */
  async recordUsage(toolName, success, error = null) {
    try {
      await supabase
        .from('tool_usage')
        .insert({
          business_id: this.businessId,
          tool_name: toolName,
          success,
          error,
          created_at: new Date().toISOString()
        });
    } catch (err) {
      console.error('Error recording tool usage:', err);
    }
  }
}

/**
 * Optional Image Tool (only if enabled)
 */
class ImageTool extends Tool {
  constructor() {
    super('generate_image', 'Generate images using DALL-E');
    this.enabled = process.env.ENABLE_IMAGE_GENERATION === 'true';
  }

  async execute(params) {
    if (!this.enabled) {
      return {
        success: false,
        error: 'Image generation is disabled to save costs'
      };
    }

    const { prompt, size = '1024x1024' } = params;
    
    try {
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size,
        quality: 'standard'
      });

      return {
        success: true,
        url: response.data[0].url,
        cost: 0.04 // Approximate cost for tracking
      };
    } catch (error) {
      console.error('Image generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

