// src/lib/ai-cofounder/core.js
/**
 * AI Cofounder Core System
 * 
 * Robust, hardcoded system for lead management with LLM intelligence layer
 * Handles automated follow-ups, lead nurturing, and conversation management
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { inngest } from '../inngest/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Lead scoring and prioritization system
 */
export class LeadScoring {
  static ENGAGEMENT_WEIGHTS = {
    email_open: 5,
    email_click: 15,
    reply_received: 30,
    meeting_booked: 50,
    proposal_viewed: 40,
    website_visit: 10,
    multiple_visits: 20,
    downloaded_resource: 25
  };

  static DECAY_FACTOR = 0.95; // Daily decay for recency
  
  static async calculateScore(leadId, businessId) {
    // Get all interactions for this lead
    const { data: interactions } = await supabase
      .from('lead_interactions')
      .select('*')
      .eq('lead_id', leadId)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    let score = 0;
    const now = new Date();

    for (const interaction of interactions || []) {
      const daysSince = Math.floor((now - new Date(interaction.created_at)) / (1000 * 60 * 60 * 24));
      const weight = this.ENGAGEMENT_WEIGHTS[interaction.type] || 0;
      const decayedWeight = weight * Math.pow(this.DECAY_FACTOR, daysSince);
      score += decayedWeight;
    }

    // Boost score for recent activity
    if (interactions?.[0]) {
      const hoursSinceLastActivity = Math.floor((now - new Date(interactions[0].created_at)) / (1000 * 60 * 60));
      if (hoursSinceLastActivity < 24) score *= 1.5;
      else if (hoursSinceLastActivity < 72) score *= 1.2;
    }

    return Math.round(score);
  }

  static getTemperature(score) {
    if (score >= 80) return 'hot';
    if (score >= 50) return 'warm';
    if (score >= 20) return 'lukewarm';
    return 'cold';
  }
}

/**
 * Follow-up timing and cadence system
 */
export class FollowUpCadence {
  static CADENCES = {
    aggressive: {
      name: 'Aggressive',
      intervals: [1, 3, 7, 14, 30], // days
      maxAttempts: 5
    },
    standard: {
      name: 'Standard',
      intervals: [3, 7, 14, 30, 60],
      maxAttempts: 5
    },
    gentle: {
      name: 'Gentle',
      intervals: [7, 14, 30, 60, 90],
      maxAttempts: 5
    },
    nurture: {
      name: 'Long-term Nurture',
      intervals: [14, 30, 60, 90, 120, 180],
      maxAttempts: 6
    }
  };

  static async getNextFollowUp(leadId, businessId) {
    const { data: followUps } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('lead_id', leadId)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    const attemptCount = followUps?.length || 0;
    
    // Get lead score to determine cadence
    const score = await LeadScoring.calculateScore(leadId, businessId);
    const temperature = LeadScoring.getTemperature(score);
    
    let cadence;
    if (temperature === 'hot') cadence = this.CADENCES.aggressive;
    else if (temperature === 'warm') cadence = this.CADENCES.standard;
    else if (temperature === 'lukewarm') cadence = this.CADENCES.gentle;
    else cadence = this.CADENCES.nurture;

    if (attemptCount >= cadence.maxAttempts) {
      return null; // Max attempts reached
    }

    const daysUntilNext = cadence.intervals[attemptCount] || cadence.intervals[cadence.intervals.length - 1];
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysUntilNext);
    
    return {
      date: nextDate,
      attemptNumber: attemptCount + 1,
      cadence: cadence.name,
      temperature
    };
  }
}

/**
 * Content generation and personalization
 */
export class ContentPersonalizer {
  static async generateFollowUp(lead, business, attemptNumber, context) {
    const prompt = `
      You are an AI cofounder helping ${business.name} follow up with a lead.
      
      Lead Information:
      - Name: ${lead.name}
      - Company: ${lead.company}
      - Industry: ${lead.industry}
      - Previous interactions: ${context.previousInteractions}
      - Lead temperature: ${context.temperature}
      - Follow-up attempt: ${attemptNumber}
      
      Business Information:
      - Service: ${business.service}
      - Value proposition: ${business.value_proposition}
      
      Generate a personalized follow-up email that:
      1. References previous interactions naturally
      2. Provides NEW value (insight, resource, or perspective)
      3. Has a clear but soft call-to-action
      4. Matches the lead temperature (${context.temperature} lead needs ${context.temperature === 'hot' ? 'direct value' : 'gentle nurturing'})
      5. Is concise (under 150 words)
      
      Format as JSON with: { subject, body, cta }
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7
    });

    return JSON.parse(response.choices[0].message.content);
  }

  static async generateNurturingContent(lead, business, contentType) {
    const contentTypes = {
      case_study: 'a relevant case study showing ROI',
      insight: 'an industry insight or trend analysis',
      resource: 'a valuable resource or tool',
      tip: 'a quick actionable tip they can implement today',
      news: 'relevant industry news with your perspective'
    };

    const prompt = `
      Create ${contentTypes[contentType]} for ${lead.name} at ${lead.company}.
      
      Their industry: ${lead.industry}
      Their likely pain points: ${lead.pain_points || 'efficiency, growth, automation'}
      Our service: ${business.service}
      
      Generate valuable content that:
      1. Is genuinely helpful without selling
      2. Demonstrates expertise
      3. Is specific to their industry
      4. Takes 2-3 minutes to read
      
      Format as JSON with: { subject, preview, content, ps_message }
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8
    });

    return JSON.parse(response.choices[0].message.content);
  }
}

/**
 * Conversation Manager - Organizes and prioritizes conversations
 */
export class ConversationManager {
  static async organizeInbox(businessId) {
    // Get all leads with recent activity
    const { data: leads } = await supabase
      .from('leads')
      .select(`
        *,
        lead_interactions (
          type,
          created_at
        ),
        email_conversations (
          message_type,
          content,
          created_at
        )
      `)
      .eq('business_id', businessId)
      .order('updated_at', { ascending: false });

    const organized = {
      hot: [],      // Ready to buy, high engagement
      warm: [],     // Interested, needs nurturing
      lukewarm: [], // Some interest, long-term potential
      cold: [],     // Low engagement, needs reactivation
      dead: []      // No response after multiple attempts
    };

    for (const lead of leads || []) {
      // Calculate engagement score
      const score = await LeadScoring.calculateScore(lead.id, businessId);
      const temperature = LeadScoring.getTemperature(score);
      
      // Check for recent replies
      const hasRecentReply = lead.email_conversations?.some(
        conv => conv.message_type === 'reply' && 
        new Date(conv.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );

      // Determine status
      const followUpCount = lead.email_conversations?.filter(c => c.message_type === 'follow_up').length || 0;
      const isDeadLead = followUpCount >= 5 && !hasRecentReply;

      const enrichedLead = {
        ...lead,
        score,
        temperature,
        hasRecentReply,
        lastInteraction: lead.lead_interactions?.[0],
        needsFollowUp: !hasRecentReply && followUpCount < 5,
        dayssinceLastContact: lead.lead_interactions?.[0] 
          ? Math.floor((Date.now() - new Date(lead.lead_interactions[0].created_at)) / (1000 * 60 * 60 * 24))
          : null
      };

      if (isDeadLead) {
        organized.dead.push(enrichedLead);
      } else {
        organized[temperature].push(enrichedLead);
      }
    }

    // Sort each category by score
    Object.keys(organized).forEach(key => {
      organized[key].sort((a, b) => b.score - a.score);
    });

    return organized;
  }

  static async flagHotProspects(businessId) {
    const organized = await this.organizeInbox(businessId);
    const hotProspects = organized.hot;

    // Update database with hot prospect flags
    for (const prospect of hotProspects) {
      await supabase
        .from('leads')
        .update({ 
          status: 'hot',
          priority: 'high',
          ai_notes: `🔥 Hot prospect - Score: ${prospect.score}. Recent engagement detected. Immediate follow-up recommended.`
        })
        .eq('id', prospect.id);

      // Create notification for user
      await supabase
        .from('notifications')
        .insert({
          business_id: businessId,
          type: 'hot_lead',
          title: `🔥 Hot Lead Alert: ${prospect.name}`,
          message: `${prospect.name} from ${prospect.company} is showing high interest. They've engaged ${prospect.lead_interactions?.length || 0} times recently.`,
          data: { lead_id: prospect.id },
          priority: 'high'
        });
    }

    return hotProspects;
  }
}

/**
 * Main AI Cofounder orchestrator
 */
export class AICofounder {
  constructor(businessId) {
    this.businessId = businessId;
  }

  /**
   * Daily operations run by the AI Cofounder
   */
  async runDailyOperations() {
    console.log(`🤖 AI Cofounder starting daily operations for business ${this.businessId}`);
    
    try {
      // 1. Organize and analyze inbox
      const organizedInbox = await ConversationManager.organizeInbox(this.businessId);
      
      // 2. Flag hot prospects for immediate attention
      const hotProspects = await ConversationManager.flagHotProspects(this.businessId);
      
      // 3. Process follow-ups for each temperature segment
      await this.processFollowUps(organizedInbox);
      
      // 4. Send nurturing content to warm leads
      await this.sendNurturingContent(organizedInbox.warm);
      
      // 5. Attempt reactivation for cold leads
      await this.reactivateColdLeads(organizedInbox.cold);
      
      // 6. Generate daily report
      const report = await this.generateDailyReport(organizedInbox);
      
      // 7. Log AI activity
      await this.logActivity('daily_operations', {
        hot_leads: hotProspects.length,
        total_leads: Object.values(organizedInbox).flat().length,
        follow_ups_sent: report.followUpsSent,
        nurturing_sent: report.nurturingSent
      });

      return {
        success: true,
        report,
        organizedInbox
      };
    } catch (error) {
      console.error('AI Cofounder daily operations error:', error);
      throw error;
    }
  }

  /**
   * Process follow-ups based on lead temperature
   */
  async processFollowUps(organizedInbox) {
    const allLeads = [...organizedInbox.hot, ...organizedInbox.warm, ...organizedInbox.lukewarm];
    
    for (const lead of allLeads) {
      if (!lead.needsFollowUp) continue;
      
      const nextFollowUp = await FollowUpCadence.getNextFollowUp(lead.id, this.businessId);
      if (!nextFollowUp) continue;
      
      // Check if it's time for follow-up
      const lastContact = new Date(lead.lastInteraction?.created_at || lead.created_at);
      const daysSinceContact = Math.floor((Date.now() - lastContact) / (1000 * 60 * 60 * 24));
      
      if (daysSinceContact >= nextFollowUp.date.getDate() - new Date().getDate()) {
        // Generate personalized follow-up
        const business = await this.getBusinessData();
        const followUpContent = await ContentPersonalizer.generateFollowUp(
          lead,
          business,
          nextFollowUp.attemptNumber,
          {
            previousInteractions: lead.email_conversations?.length || 0,
            temperature: nextFollowUp.temperature
          }
        );
        
        // Schedule follow-up via Inngest
        await inngest.send({
          name: 'ai-cofounder/send-followup',
          data: {
            businessId: this.businessId,
            leadId: lead.id,
            content: followUpContent,
            attemptNumber: nextFollowUp.attemptNumber,
            temperature: nextFollowUp.temperature
          }
        });
        
        // Record follow-up
        await supabase
          .from('follow_ups')
          .insert({
            business_id: this.businessId,
            lead_id: lead.id,
            type: 'automated',
            attempt_number: nextFollowUp.attemptNumber,
            content: followUpContent,
            scheduled_for: nextFollowUp.date,
            status: 'scheduled'
          });
      }
    }
  }

  /**
   * Send valuable nurturing content to warm leads
   */
  async sendNurturingContent(warmLeads) {
    const business = await this.getBusinessData();
    const contentTypes = ['case_study', 'insight', 'resource', 'tip', 'news'];
    
    for (const lead of warmLeads.slice(0, 10)) { // Limit to 10 per day
      // Determine best content type based on lead profile
      const contentType = contentTypes[Math.floor(Math.random() * contentTypes.length)];
      
      const content = await ContentPersonalizer.generateNurturingContent(
        lead,
        business,
        contentType
      );
      
      // Schedule nurturing email
      await inngest.send({
        name: 'ai-cofounder/send-nurturing',
        data: {
          businessId: this.businessId,
          leadId: lead.id,
          content,
          contentType
        }
      });
      
      // Record nurturing activity
      await supabase
        .from('lead_nurturing')
        .insert({
          business_id: this.businessId,
          lead_id: lead.id,
          content_type: contentType,
          content,
          status: 'scheduled'
        });
    }
  }

  /**
   * Attempt to reactivate cold leads
   */
  async reactivateColdLeads(coldLeads) {
    // Select a few cold leads for reactivation
    const leadsToReactivate = coldLeads
      .filter(lead => lead.dayssinceLastContact > 30)
      .slice(0, 5);
    
    for (const lead of leadsToReactivate) {
      // Create reactivation campaign
      await inngest.send({
        name: 'ai-cofounder/reactivation-campaign',
        data: {
          businessId: this.businessId,
          leadId: lead.id,
          lastContactDays: lead.dayssinceLastContact
        }
      });
    }
  }

  /**
   * Generate daily report of AI Cofounder activities
   */
  async generateDailyReport(organizedInbox) {
    const report = {
      date: new Date().toISOString(),
      summary: {
        totalLeads: Object.values(organizedInbox).flat().length,
        hotLeads: organizedInbox.hot.length,
        warmLeads: organizedInbox.warm.length,
        coldLeads: organizedInbox.cold.length,
        deadLeads: organizedInbox.dead.length
      },
      actions: {
        followUpsSent: 0,
        nurturingSent: 0,
        reactivationAttempts: 0,
        hotProspectsFlagged: organizedInbox.hot.length
      },
      insights: [],
      recommendations: []
    };

    // Generate AI insights
    if (organizedInbox.hot.length > 0) {
      report.insights.push(`🔥 ${organizedInbox.hot.length} hot prospects ready for immediate outreach`);
      report.recommendations.push(`Contact ${organizedInbox.hot[0].name} from ${organizedInbox.hot[0].company} today - they're showing strong buying signals`);
    }

    if (organizedInbox.warm.length > 10) {
      report.insights.push(`📈 Strong pipeline with ${organizedInbox.warm.length} warm leads`);
      report.recommendations.push('Consider running a limited-time offer to convert warm leads');
    }

    // Store report
    await supabase
      .from('ai_cofounder_reports')
      .insert({
        business_id: this.businessId,
        report_type: 'daily',
        data: report
      });

    return report;
  }

  /**
   * Get business data
   */
  async getBusinessData() {
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', this.businessId)
      .single();
    
    return data;
  }

  /**
   * Log AI Cofounder activity
   */
  async logActivity(type, data) {
    await supabase
      .from('ai_activities')
      .insert({
        business_id: this.businessId,
        type: `cofounder_${type}`,
        description: `AI Cofounder performed ${type}`,
        data,
        created_at: new Date().toISOString()
      });
  }
}

// Export for use in other modules
export default AICofounder;
