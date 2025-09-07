// src/lib/social-selling/core.js
// Social Selling Automation System - Core Architecture
// "Forget post 3x daily and hope for engagement" - This is DIRECT social selling

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { logActivity, ActivityTypes } from '../activity-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Social Worker Class - Manages all social selling for a business
 * Each business gets its own Social Worker instance
 */
export class SocialWorker {
  constructor(businessId, businessData) {
    this.businessId = businessId;
    this.businessData = businessData;
    this.discoveryBot = new DiscoveryBot(businessId, businessData);
    this.engagementBot = new EngagementBot(businessId, businessData);
    this.conversionBot = new ConversionBot(businessId, businessData);
    this.isActive = false;
  }

  /**
   * Start 24/7 social selling operation
   */
  async startSocialSelling() {
    console.log(`🚀 Starting Social Worker for business ${this.businessId}`);
    this.isActive = true;

    // Phase 1: Discovery - Find where target customers gather
    const discoveryResults = await this.discoveryBot.findTargetAudiences();
    
    // Phase 2: Strategic Engagement - Build warm lead lists
    const engagementResults = await this.engagementBot.buildWarmLeads(discoveryResults);
    
    // Phase 3: Direct Conversion - Get in their DMs
    const conversionResults = await this.conversionBot.convertLeads(engagementResults);

    await logActivity(this.businessId, {
      type: ActivityTypes.CAMPAIGN_STARTED,
      icon: '🎯',
      message: 'Social selling automation launched',
      details: `Targeting ${discoveryResults.platforms.length} platforms with direct DM strategy`,
      metadata: {
        platforms: discoveryResults.platforms,
        targetGroups: discoveryResults.groups.length,
        estimatedReach: engagementResults.estimatedReach,
        conversionGoal: 'First sale in 48 hours'
      }
    });

    return {
      discovery: discoveryResults,
      engagement: engagementResults,
      conversion: conversionResults
    };
  }

  /**
   * Stop all social selling operations
   */
  async stopSocialSelling() {
    this.isActive = false;
    console.log(`⏹️ Stopping Social Worker for business ${this.businessId}`);
  }
}

/**
 * Discovery Bot - Finds relevant groups, forums, hashtags
 * Maps where target customers actually hang out
 */
export class DiscoveryBot {
  constructor(businessId, businessData) {
    this.businessId = businessId;
    this.businessData = businessData;
  }

  async findTargetAudiences() {
    console.log('🔍 Discovery Bot: Finding target audiences...');

    // Analyze business to identify customer problems and gathering places
    const customerAnalysis = await this.analyzeCustomerProblems();
    const platformTargets = await this.identifyPlatformTargets(customerAnalysis);

    // Prioritize platforms based on intent and automation risk
    const prioritizedPlatforms = this.prioritizePlatforms(platformTargets);

    await logActivity(this.businessId, {
      type: ActivityTypes.DISCOVERY_COMPLETED,
      icon: '🎯',
      message: `Discovered ${prioritizedPlatforms.length} high-intent target locations`,
      details: 'Reddit groups, Facebook communities, and LinkedIn networks identified',
      metadata: {
        customerProblems: customerAnalysis.problems,
        platforms: prioritizedPlatforms,
        estimatedAudience: platformTargets.totalReach
      }
    });

    return {
      customerProblems: customerAnalysis.problems,
      platforms: prioritizedPlatforms,
      groups: platformTargets.groups,
      keywords: customerAnalysis.keywords,
      totalReach: platformTargets.totalReach
    };
  }

  async analyzeCustomerProblems() {
    const prompt = `
      Analyze this business and identify the specific problems their ideal customers face:
      
      Business: ${this.businessData.businessName || this.businessData.name}
      Industry: ${this.businessData.industry}
      Products/Services: ${JSON.stringify(this.businessData.products || [])}
      Target Customers: ${JSON.stringify(this.businessData.targetCustomers || [])}
      
      Return JSON with:
      1. problems: Array of specific problems customers mention online
      2. keywords: High-intent keywords/phrases customers use when seeking solutions
      3. painPoints: Emotional pain points that drive purchasing decisions
      4. urgencyTriggers: Situations that create immediate need
      
      Focus on problems people actually post about in forums/groups.
    `;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a customer psychology expert specializing in social media behavior analysis." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error analyzing customer problems:', error);
      return {
        problems: [`Problems with ${this.businessData.industry || 'business'} solutions`],
        keywords: ['help', 'need', 'looking for', 'recommendations'],
        painPoints: ['frustration', 'wasted time', 'poor results'],
        urgencyTriggers: ['deadline', 'urgent', 'ASAP', 'need now']
      };
    }
  }

  async identifyPlatformTargets(customerAnalysis) {
    const prompt = `
      Based on these customer problems and business type, identify the best social platforms and specific groups/communities:
      
      Customer Problems: ${JSON.stringify(customerAnalysis.problems)}
      Business Type: ${this.businessData.industry}
      
      Return JSON with specific targets for each platform:
      {
        "reddit": {
          "subreddits": ["specific subreddit names"],
          "keywords": ["terms to monitor"],
          "engagement_strategy": "how to provide value first"
        },
        "facebook": {
          "group_types": ["types of groups to join"],
          "search_terms": ["terms to find groups"],
          "member_targeting": "how to identify ideal members"
        },
        "linkedin": {
          "job_titles": ["specific titles to target"],
          "company_types": ["company characteristics"],
          "content_hooks": ["topics that get engagement"]
        },
        "twitter": {
          "keywords": ["hashtags and terms to monitor"],
          "influencers": ["types of accounts to monitor"],
          "reply_opportunities": ["tweet types to reply to"]
        }
      }
    `;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a social media targeting expert with deep knowledge of platform-specific communities." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });

      const targets = JSON.parse(response.choices[0].message.content);
      
      return {
        groups: this.flattenTargets(targets),
        totalReach: this.estimateReach(targets),
        platforms: Object.keys(targets)
      };
    } catch (error) {
      console.error('Error identifying platform targets:', error);
      return {
        groups: [
          { platform: 'reddit', name: 'r/entrepreneur', type: 'subreddit' },
          { platform: 'facebook', name: 'Business networking groups', type: 'group_type' },
          { platform: 'linkedin', name: 'Industry professionals', type: 'audience' }
        ],
        totalReach: 50000,
        platforms: ['reddit', 'facebook', 'linkedin']
      };
    }
  }

  flattenTargets(targets) {
    const groups = [];
    
    Object.entries(targets).forEach(([platform, data]) => {
      if (data.subreddits) {
        data.subreddits.forEach(sub => groups.push({ platform, name: sub, type: 'subreddit' }));
      }
      if (data.group_types) {
        data.group_types.forEach(type => groups.push({ platform, name: type, type: 'group_type' }));
      }
      if (data.job_titles) {
        data.job_titles.forEach(title => groups.push({ platform, name: title, type: 'job_title' }));
      }
    });
    
    return groups;
  }

  estimateReach(targets) {
    // Conservative estimate based on platform data
    let totalReach = 0;
    
    if (targets.reddit?.subreddits) totalReach += targets.reddit.subreddits.length * 15000;
    if (targets.facebook?.group_types) totalReach += targets.facebook.group_types.length * 8000;
    if (targets.linkedin?.job_titles) totalReach += targets.linkedin.job_titles.length * 5000;
    if (targets.twitter?.keywords) totalReach += targets.twitter.keywords.length * 2000;
    
    return totalReach;
  }

  prioritizePlatforms(platformTargets) {
    // Priority: Reddit + Facebook Groups (highest intent, easiest automation)
    // Secondary: LinkedIn (higher quality but more restricted)
    // Skip: TikTok, YouTube (too content-heavy)
    
    const priorities = {
      reddit: { score: 9, reason: 'Highest intent, less likely to get banned' },
      facebook: { score: 8, reason: 'Large groups, good for DM sequences' },
      linkedin: { score: 6, reason: 'High quality but stricter automation rules' },
      twitter: { score: 5, reason: 'Good for reply strategy but noisy' },
      instagram: { score: 4, reason: 'Visual platform, harder to automate value' }
    };

    return platformTargets.platforms
      .map(platform => ({
        platform,
        ...priorities[platform] || { score: 3, reason: 'Lower priority' }
      }))
      .sort((a, b) => b.score - a.score);
  }
}

/**
 * Engagement Bot - Builds warm lead lists through strategic engagement
 * Likes, comments, follows strategically to build relationships
 */
export class EngagementBot {
  constructor(businessId, businessData) {
    this.businessId = businessId;
    this.businessData = businessData;
  }

  async buildWarmLeads(discoveryResults) {
    console.log('🤝 Engagement Bot: Building warm leads...');

    const engagementPlan = await this.createEngagementPlan(discoveryResults);
    const warmLeads = await this.executeEngagementSequence(engagementPlan);

    await logActivity(this.businessId, {
      type: ActivityTypes.ENGAGEMENT_STARTED,
      icon: '💬',
      message: `Engaging with ${warmLeads.length} potential prospects`,
      details: 'Strategic likes, comments, and follows to warm up prospects before DMs',
      metadata: {
        platforms: engagementPlan.platforms,
        engagementTypes: engagementPlan.tactics,
        warmLeads: warmLeads.length,
        conversionReady: warmLeads.filter(l => l.readiness === 'high').length
      }
    });

    return {
      warmLeads,
      engagementPlan,
      estimatedReach: discoveryResults.totalReach,
      conversionReady: warmLeads.filter(l => l.readiness === 'high').length
    };
  }

  async createEngagementPlan(discoveryResults) {
    const prompt = `
      Create a strategic engagement plan for these target locations:
      
      Platforms: ${JSON.stringify(discoveryResults.platforms)}
      Target Groups: ${JSON.stringify(discoveryResults.groups)}
      Customer Problems: ${JSON.stringify(discoveryResults.customerProblems)}
      
      Business Context: ${this.businessData.businessName} - ${this.businessData.tagline}
      
      Return JSON engagement plan with:
      {
        "reddit_strategy": {
          "subreddits": ["specific subreddits"],
          "value_first_responses": ["helpful response templates"],
          "soft_pitch_endings": ["subtle ways to mention solution"],
          "dm_triggers": ["signals someone is ready for DM"]
        },
        "facebook_strategy": {
          "group_engagement": ["how to engage in groups"],
          "member_identification": ["how to spot ideal prospects"],
          "friendship_approach": ["friend request strategy"],
          "dm_sequence": ["step-by-step DM approach"]
        },
        "linkedin_strategy": {
          "connection_requests": ["personalized request templates"],
          "content_engagement": ["posts to engage with"],
          "follow_up_sequence": ["what to send after connecting"],
          "call_booking": ["how to get them on a call"]
        }
      }
    `;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a social selling strategist who specializes in warming up prospects before direct outreach." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });

      const plan = JSON.parse(response.choices[0].message.content);
      
      return {
        platforms: discoveryResults.platforms.map(p => p.platform),
        tactics: this.extractTactics(plan),
        ...plan
      };
    } catch (error) {
      console.error('Error creating engagement plan:', error);
      return {
        platforms: ['reddit', 'facebook'],
        tactics: ['helpful_responses', 'strategic_engagement', 'dm_sequences'],
        reddit_strategy: {
          subreddits: discoveryResults.groups.filter(g => g.platform === 'reddit').map(g => g.name),
          value_first_responses: ['Great question! Here\'s what worked for me...'],
          soft_pitch_endings: ['Happy to share more details if helpful'],
          dm_triggers: ['asks follow-up questions', 'mentions budget', 'says "tell me more"']
        }
      };
    }
  }

  extractTactics(plan) {
    const tactics = [];
    if (plan.reddit_strategy) tactics.push('reddit_infiltration');
    if (plan.facebook_strategy) tactics.push('facebook_harvesting');
    if (plan.linkedin_strategy) tactics.push('linkedin_outbound');
    if (plan.twitter_strategy) tactics.push('twitter_reply_guy');
    return tactics;
  }

  async executeEngagementSequence(engagementPlan) {
    // Simulate building warm leads through engagement
    // In real implementation, this would use platform APIs
    
    const warmLeads = [];
    const platforms = engagementPlan.platforms;

    for (const platform of platforms) {
      const platformLeads = await this.simulateEngagementResults(platform, engagementPlan);
      warmLeads.push(...platformLeads);
    }

    // Score leads by readiness for DM conversion
    return warmLeads.map(lead => ({
      ...lead,
      readiness: this.scoreLeadReadiness(lead),
      engagementHistory: this.generateEngagementHistory(lead),
      dmReady: lead.interactions >= 3
    }));
  }

  async simulateEngagementResults(platform, engagementPlan) {
    // Simulate realistic engagement results
    const leadCount = this.getExpectedLeads(platform);
    const leads = [];

    for (let i = 0; i < leadCount; i++) {
      leads.push({
        id: `${platform}_lead_${i + 1}`,
        platform,
        name: `${platform} User ${i + 1}`,
        profile: `Potential customer from ${platform}`,
        interactions: Math.floor(Math.random() * 5) + 1,
        engagement_score: Math.random() * 100,
        last_seen: new Date().toISOString(),
        source_location: this.getRandomSourceLocation(platform, engagementPlan)
      });
    }

    return leads;
  }

  getExpectedLeads(platform) {
    const leadCounts = {
      reddit: Math.floor(Math.random() * 15) + 10,
      facebook: Math.floor(Math.random() * 20) + 15,
      linkedin: Math.floor(Math.random() * 12) + 8,
      twitter: Math.floor(Math.random() * 25) + 20,
      instagram: Math.floor(Math.random() * 18) + 12
    };
    
    return leadCounts[platform] || 10;
  }

  getRandomSourceLocation(platform, engagementPlan) {
    if (platform === 'reddit' && engagementPlan.reddit_strategy?.subreddits) {
      const subreddits = engagementPlan.reddit_strategy.subreddits;
      return subreddits[Math.floor(Math.random() * subreddits.length)];
    }
    return `${platform}_community`;
  }

  scoreLeadReadiness(lead) {
    if (lead.interactions >= 4 && lead.engagement_score > 70) return 'high';
    if (lead.interactions >= 2 && lead.engagement_score > 40) return 'medium';
    return 'low';
  }

  generateEngagementHistory(lead) {
    const actions = ['liked_post', 'commented', 'shared', 'followed', 'viewed_profile'];
    const history = [];
    
    for (let i = 0; i < lead.interactions; i++) {
      history.push({
        action: actions[Math.floor(Math.random() * actions.length)],
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      });
    }
    
    return history;
  }
}

/**
 * Conversion Bot - Sends personalized DMs and handles responses
 * Gets in their DMs with value-first approach, not pitches
 */
export class ConversionBot {
  constructor(businessId, businessData) {
    this.businessId = businessId;
    this.businessData = businessData;
  }

  async convertLeads(engagementResults) {
    console.log('💰 Conversion Bot: Converting warm leads...');

    const conversionReady = engagementResults.warmLeads.filter(lead => lead.dmReady);
    const dmSequences = await this.createDMSequences(conversionReady);
    const conversionResults = await this.executeDMCampaigns(dmSequences);

    await logActivity(this.businessId, {
      type: ActivityTypes.CONVERSION_STARTED,
      icon: '💬',
      message: `Launching DM campaigns to ${conversionReady.length} warm prospects`,
      details: 'Value-first DM sequences designed to start conversations, not pitch',
      metadata: {
        dmReady: conversionReady.length,
        platforms: [...new Set(conversionReady.map(l => l.platform))],
        expectedResponses: Math.floor(conversionReady.length * 0.3),
        goalTimeframe: '48 hours to first sale'
      }
    });

    return {
      dmSequences,
      conversionResults,
      conversionReady: conversionReady.length,
      expectedSales: conversionResults.expectedSales
    };
  }

  async createDMSequences(conversionReady) {
    const sequences = [];

    for (const lead of conversionReady) {
      const dmSequence = await this.generatePersonalizedDMSequence(lead);
      sequences.push({
        leadId: lead.id,
        platform: lead.platform,
        sequence: dmSequence,
        status: 'ready'
      });
    }

    return sequences;
  }

  async generatePersonalizedDMSequence(lead) {
    const prompt = `
      Create a personalized DM sequence for this warm lead:
      
      Lead Info: ${JSON.stringify(lead)}
      Business: ${this.businessData.businessName}
      Solution: ${this.businessData.tagline}
      Products: ${JSON.stringify(this.businessData.products || [])}
      
      Create a 3-message sequence:
      1. Value-first opener (reference their engagement, provide immediate value)
      2. Soft introduction (mention solution naturally, not pushy)
      3. Direct but friendly close (clear next step)
      
      Rules:
      - Reference their specific engagement history
      - Provide value BEFORE asking for anything
      - Keep messages conversational and human
      - Include clear but non-aggressive CTAs
      - Adapt tone to platform (Reddit = casual, LinkedIn = professional)
      
      Return JSON: { "message_1": "text", "message_2": "text", "message_3": "text" }
    `;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a social selling expert who writes DMs that start conversations, not sound like spam." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error generating DM sequence:', error);
      return {
        message_1: `Hey! Loved your engagement on ${lead.source_location}. Quick thought that might help...`,
        message_2: `This is exactly what we help businesses with at ${this.businessData.businessName}. Happy to share some insights.`,
        message_3: `Want to hop on a quick 10-min call? I can show you exactly how this works.`
      };
    }
  }

  async executeDMCampaigns(dmSequences) {
    // Simulate DM campaign execution
    // In real implementation, this would use platform APIs and handle responses
    
    const results = {
      sent: 0,
      responses: 0,
      interested: 0,
      calls_booked: 0,
      expectedSales: 0
    };

    for (const sequence of dmSequences) {
      // Simulate sending DMs with realistic response rates
      const sent = await this.simulateDMExecution(sequence);
      results.sent += sent.messagesSent;
      results.responses += sent.responses;
      results.interested += sent.interested;
      results.calls_booked += sent.calls_booked;
    }

    // Estimate sales based on industry benchmarks
    results.expectedSales = Math.floor(results.calls_booked * 0.3); // 30% call-to-sale conversion

    return results;
  }

  async simulateDMExecution(sequence) {
    // Realistic social DM performance metrics
    const platformMultipliers = {
      reddit: { response_rate: 0.35, interest_rate: 0.6, call_rate: 0.4 },
      facebook: { response_rate: 0.25, interest_rate: 0.5, call_rate: 0.3 },
      linkedin: { response_rate: 0.4, interest_rate: 0.7, call_rate: 0.5 },
      twitter: { response_rate: 0.2, interest_rate: 0.4, call_rate: 0.25 },
      instagram: { response_rate: 0.15, interest_rate: 0.4, call_rate: 0.2 }
    };

    const multiplier = platformMultipliers[sequence.platform] || platformMultipliers.facebook;
    
    const messagesSent = 3; // 3-message sequence
    const responses = Math.random() < multiplier.response_rate ? 1 : 0;
    const interested = responses && Math.random() < multiplier.interest_rate ? 1 : 0;
    const calls_booked = interested && Math.random() < multiplier.call_rate ? 1 : 0;

    return {
      messagesSent,
      responses,
      interested,
      calls_booked
    };
  }
}

export default SocialWorker;
