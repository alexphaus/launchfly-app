// src/lib/social-selling/platforms/instagram.js
// Instagram DM Campaign Strategy - Find competitors' followers, engage first, then DM with value

import { logActivity, ActivityTypes } from '../../activity-logger';

/**
 * Instagram DM Campaign Bot
 * Find competitors' followers
 * Engage with their posts first (like, comment)
 * DM with "noticed you follow [competitor], thought you might like..."
 * Convert in DMs, not comments
 */
export class InstagramDMCampaignBot {
  constructor(businessId, businessData) {
    this.businessId = businessId;
    this.businessData = businessData;
    this.targetCompetitors = [];
    this.harvestedFollowers = [];
    this.isDMCampaigning = false;
  }

  /**
   * Start Instagram DM campaign operation
   */
  async startDMCampaign(targetCompetitors) {
    console.log('📸 Starting Instagram DM campaign...');
    
    this.isDMCampaigning = true;
    this.targetCompetitors = targetCompetitors;

    // Phase 1: Identify competitor followers
    const competitorFollowers = await this.identifyCompetitorFollowers(targetCompetitors);
    
    // Phase 2: Engage with their content strategically
    const engagementResults = await this.executeStrategicEngagement(competitorFollowers);
    
    // Phase 3: Launch value-based DM campaigns
    const dmCampaignResults = await this.launchValueDMCampaigns(engagementResults.engaged_followers);
    
    // Phase 4: Convert conversations in DMs
    const conversionResults = await this.convertDMConversations(dmCampaignResults);

    await logActivity(this.businessId, {
      type: ActivityTypes.INSTAGRAM_DM_CAMPAIGN_STARTED,
      icon: '📸',
      message: `Instagram DM campaign targeting ${competitorFollowers.length} competitor followers`,
      details: 'Strategic engagement followed by value-first DM outreach',
      metadata: {
        competitor_accounts: targetCompetitors.length,
        followers_identified: competitorFollowers.length,
        engagement_targets: engagementResults.engaged_followers.length,
        dm_campaigns_sent: dmCampaignResults.sent,
        expected_conversions: conversionResults.estimated_conversions
      }
    });

    return {
      competitorFollowers,
      engagementResults,
      dmCampaignResults,
      conversionResults,
      estimatedReach: competitorFollowers.length
    };
  }

  /**
   * Identify and analyze competitor followers
   */
  async identifyCompetitorFollowers(targetCompetitors) {
    console.log('🔍 Identifying competitor followers...');

    const allFollowers = [];

    for (const competitor of targetCompetitors) {
      const followers = await this.analyzeCompetitorFollowers(competitor);
      allFollowers.push(...followers);
    }

    // Filter and score followers for targeting
    const qualifiedFollowers = this.filterAndScoreFollowers(allFollowers);
    this.harvestedFollowers = qualifiedFollowers;

    await logActivity(this.businessId, {
      type: ActivityTypes.COMPETITOR_FOLLOWERS_IDENTIFIED,
      icon: '👥',
      message: `Identified ${qualifiedFollowers.length} high-value competitor followers`,
      details: 'Filtered by engagement level, account type, and relevance indicators',
      metadata: {
        total_found: allFollowers.length,
        qualified: qualifiedFollowers.length,
        competitors_analyzed: targetCompetitors.length,
        avg_follower_engagement: Math.round(qualifiedFollowers.reduce((sum, f) => sum + f.engagement_score, 0) / qualifiedFollowers.length),
        filter_criteria: ['real_accounts', 'active_users', 'relevant_interests', 'engagement_level']
      }
    });

    return qualifiedFollowers;
  }

  async analyzeCompetitorFollowers(competitor) {
    console.log(`📊 Analyzing followers of @${competitor.handle}...`);

    // Simulate analyzing competitor's follower base
    const followerCount = Math.floor(competitor.follower_count * 0.1); // Analyze 10% of followers
    const followers = [];

    for (let i = 0; i < Math.min(followerCount, 200); i++) { // Max 200 per competitor
      followers.push({
        id: `ig_follower_${competitor.handle}_${i + 1}`,
        username: `${competitor.handle}_follower_${i + 1}`,
        display_name: `Follower ${i + 1}`,
        competitor_source: competitor.handle,
        account_type: this.generateAccountType(),
        follower_count: Math.floor(Math.random() * 10000) + 100,
        following_count: Math.floor(Math.random() * 5000) + 50,
        post_count: Math.floor(Math.random() * 500) + 20,
        bio: this.generateBio(competitor.niche),
        engagement_patterns: this.generateEngagementPatterns(),
        interests: this.generateInterests(competitor.niche),
        activity_level: this.generateActivityLevel(),
        relevance_indicators: this.generateRelevanceIndicators(competitor.niche),
        last_active: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    return followers;
  }

  generateAccountType() {
    const types = ['personal', 'business', 'creator'];
    const weights = [0.6, 0.3, 0.1]; // Most are personal accounts
    
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < types.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return types[i];
      }
    }
    
    return 'personal';
  }

  generateBio(niche) {
    const bioTemplates = {
      'marketing': [
        '🚀 Digital marketer helping brands grow',
        '📈 Marketing strategist & growth hacker',
        '💡 Content creator & marketing tips',
        '🎯 Helping businesses reach their audience'
      ],
      'fitness': [
        '💪 Fitness enthusiast & personal trainer',
        '🏃‍♀️ Marathon runner & wellness coach',
        '🥗 Healthy lifestyle advocate',
        '🔥 Transforming lives through fitness'
      ],
      'business': [
        '👔 Entrepreneur & business owner',
        '💼 CEO building the next big thing',
        '📊 Business consultant & advisor',
        '🚀 Startup founder sharing the journey'
      ],
      'design': [
        '🎨 Creative designer & visual storyteller',
        '✏️ Graphic designer bringing ideas to life',
        '🖌️ Artist & design enthusiast',
        '💻 UI/UX designer crafting experiences'
      ]
    };

    const templates = bioTemplates[niche] || bioTemplates['business'];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  generateEngagementPatterns() {
    return {
      likes_posts: Math.random() < 0.8, // 80% like posts
      comments_frequently: Math.random() < 0.3, // 30% comment frequently
      shares_stories: Math.random() < 0.4, // 40% share to stories
      saves_posts: Math.random() < 0.6, // 60% save posts
      engagement_time: this.generateEngagementTime()
    };
  }

  generateEngagementTime() {
    const times = ['morning', 'afternoon', 'evening', 'night'];
    return times[Math.floor(Math.random() * times.length)];
  }

  generateInterests(niche) {
    const interestSets = {
      'marketing': ['digital marketing', 'social media', 'content creation', 'entrepreneurship', 'business growth'],
      'fitness': ['workout', 'nutrition', 'wellness', 'personal training', 'healthy lifestyle'],
      'business': ['entrepreneurship', 'startups', 'leadership', 'innovation', 'business strategy'],
      'design': ['graphic design', 'branding', 'creative work', 'visual arts', 'typography']
    };

    const baseInterests = interestSets[niche] || interestSets['business'];
    const interestCount = Math.floor(Math.random() * 3) + 2; // 2-4 interests
    
    return baseInterests.slice(0, interestCount);
  }

  generateActivityLevel() {
    const levels = ['low', 'medium', 'high', 'very_high'];
    const weights = [0.2, 0.4, 0.3, 0.1]; // Most are medium activity
    
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < levels.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return levels[i];
      }
    }
    
    return 'medium';
  }

  generateRelevanceIndicators(niche) {
    const indicators = [];
    const possibleIndicators = [
      'follows_business_accounts',
      'engages_with_educational_content',
      'shares_industry_posts',
      'comments_on_tips',
      'saves_helpful_content',
      'mentions_challenges',
      'asks_questions',
      'tags_friends_in_relevant_posts'
    ];

    const indicatorCount = Math.floor(Math.random() * 4) + 2; // 2-5 indicators

    for (let i = 0; i < indicatorCount; i++) {
      const indicator = possibleIndicators[Math.floor(Math.random() * possibleIndicators.length)];
      if (!indicators.includes(indicator)) {
        indicators.push(indicator);
      }
    }

    return indicators;
  }

  filterAndScoreFollowers(followers) {
    return followers
      .filter(follower => this.meetsQualificationCriteria(follower))
      .map(follower => ({
        ...follower,
        engagement_score: this.calculateEngagementScore(follower),
        targeting_priority: this.calculateTargetingPriority(follower)
      }))
      .sort((a, b) => b.targeting_priority - a.targeting_priority)
      .slice(0, 500); // Top 500 followers across all competitors
  }

  meetsQualificationCriteria(follower) {
    // Filter out low-quality accounts
    const hasMinPosts = follower.post_count >= 10;
    const hasReasonableFollowing = follower.following_count < follower.follower_count * 5; // Not following way too many
    const isActive = ['medium', 'high', 'very_high'].includes(follower.activity_level);
    const hasRelevantBio = follower.bio.length > 10;

    return hasMinPosts && hasReasonableFollowing && isActive && hasRelevantBio;
  }

  calculateEngagementScore(follower) {
    let score = 50; // Base score

    // Activity level
    const activityBonus = {
      'low': 0,
      'medium': 10,
      'high': 20,
      'very_high': 30
    };
    score += activityBonus[follower.activity_level] || 0;

    // Engagement patterns
    if (follower.engagement_patterns.likes_posts) score += 10;
    if (follower.engagement_patterns.comments_frequently) score += 15;
    if (follower.engagement_patterns.shares_stories) score += 10;
    if (follower.engagement_patterns.saves_posts) score += 12;

    // Relevance indicators
    score += follower.relevance_indicators.length * 5;

    // Account type bonus (business accounts are more valuable)
    if (follower.account_type === 'business') score += 15;
    else if (follower.account_type === 'creator') score += 10;

    // Follower count sweet spot (not too big, not too small)
    if (follower.follower_count >= 500 && follower.follower_count <= 10000) score += 10;

    return Math.min(score, 100); // Cap at 100
  }

  calculateTargetingPriority(follower) {
    let priority = follower.engagement_score;

    // Boost for high-value indicators
    if (follower.relevance_indicators.includes('follows_business_accounts')) priority += 10;
    if (follower.relevance_indicators.includes('mentions_challenges')) priority += 15;
    if (follower.relevance_indicators.includes('asks_questions')) priority += 12;

    // Recency boost
    const daysSinceActive = (Date.now() - new Date(follower.last_active)) / (1000 * 60 * 60 * 24);
    if (daysSinceActive < 2) priority += 10;
    else if (daysSinceActive < 5) priority += 5;

    return priority;
  }

  /**
   * Execute strategic engagement before DMing
   */
  async executeStrategicEngagement(followers) {
    console.log('💝 Executing strategic engagement...');

    const engagementTargets = followers.slice(0, 100); // Top 100 followers
    const engagementResults = {
      targeted: engagementTargets.length,
      engaged_with: 0,
      engaged_followers: [],
      engagement_types: {
        likes: 0,
        comments: 0,
        story_views: 0
      }
    };

    for (const follower of engagementTargets) {
      const engagement = await this.engageWithFollower(follower);
      
      if (engagement.success) {
        engagementResults.engaged_with++;
        engagementResults.engaged_followers.push({
          ...follower,
          engagement_history: engagement.actions,
          warm_level: engagement.warm_level
        });

        // Track engagement types
        engagement.actions.forEach(action => {
          if (engagementResults.engagement_types[action.type] !== undefined) {
            engagementResults.engagement_types[action.type]++;
          }
        });
      }

      // Realistic delay between engagements
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10000 + 5000)); // 5-15 second delay
    }

    await logActivity(this.businessId, {
      type: ActivityTypes.STRATEGIC_ENGAGEMENT_COMPLETED,
      icon: '💝',
      message: `Strategically engaged with ${engagementResults.engaged_with} competitor followers`,
      details: 'Likes, comments, and story views to warm up prospects before DMing',
      metadata: {
        targeted: engagementResults.targeted,
        engaged_with: engagementResults.engaged_with,
        engagement_rate: `${Math.round(engagementResults.engaged_with / engagementResults.targeted * 100)}%`,
        engagement_breakdown: engagementResults.engagement_types,
        warm_prospects_ready: engagementResults.engaged_followers.filter(f => f.warm_level === 'high').length
      }
    });

    return engagementResults;
  }

  async engageWithFollower(follower) {
    const engagementPlan = this.createEngagementPlan(follower);
    const actions = [];
    let warmLevel = 'low';

    for (const plannedAction of engagementPlan) {
      const action = await this.executeEngagementAction(plannedAction, follower);
      if (action.success) {
        actions.push(action);
      }

      // Small delay between actions
      await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 1000)); // 1-4 second delay
    }

    // Determine warm level based on engagement success
    if (actions.length >= 3) warmLevel = 'high';
    else if (actions.length >= 2) warmLevel = 'medium';

    return {
      success: actions.length > 0,
      actions,
      warm_level: warmLevel
    };
  }

  createEngagementPlan(follower) {
    const plan = [];

    // Always start with likes (least intrusive)
    plan.push({ type: 'like', target: 'recent_posts', count: Math.floor(Math.random() * 3) + 2 }); // 2-4 likes

    // Add comment if follower seems receptive
    if (follower.engagement_patterns.comments_frequently) {
      plan.push({ type: 'comment', target: 'recent_post', content: 'value_focused' });
    }

    // View stories if they're active
    if (follower.activity_level === 'high' || follower.activity_level === 'very_high') {
      plan.push({ type: 'story_view', count: Math.floor(Math.random() * 3) + 1 }); // 1-3 story views
    }

    return plan;
  }

  async executeEngagementAction(plannedAction, follower) {
    const successRates = {
      'like': 0.95, // Likes almost always work
      'comment': 0.7, // Comments sometimes don't get through
      'story_view': 0.9 // Story views usually work
    };

    const success = Math.random() < successRates[plannedAction.type];

    if (success) {
      return {
        type: plannedAction.type,
        success: true,
        timestamp: new Date().toISOString(),
        details: this.generateActionDetails(plannedAction, follower)
      };
    }

    return { success: false };
  }

  generateActionDetails(plannedAction, follower) {
    switch (plannedAction.type) {
      case 'like':
        return {
          posts_liked: plannedAction.count,
          post_types: ['recent_posts', 'business_content'],
          impact: 'positive_signal'
        };
      case 'comment':
        return {
          comment_text: this.generateValueComment(follower),
          post_type: 'business_related',
          impact: 'high_engagement_signal'
        };
      case 'story_view':
        return {
          stories_viewed: plannedAction.count,
          story_types: ['recent_activity', 'business_content'],
          impact: 'awareness_signal'
        };
      default:
        return {};
    }
  }

  generateValueComment(follower) {
    const templates = [
      'This is so helpful! 🙌',
      'Great insights! Thanks for sharing 💡',
      'Needed to see this today 🔥',
      'This resonates so much! 💯',
      'Exactly what I was looking for! 🎯',
      'Love this perspective! ✨'
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Launch value-based DM campaigns
   */
  async launchValueDMCampaigns(engagedFollowers) {
    console.log('📨 Launching value-based DM campaigns...');

    const dmTargets = engagedFollowers.filter(f => f.warm_level !== 'low').slice(0, 50); // Top 50 warm prospects
    const dmResults = {
      targeted: dmTargets.length,
      sent: 0,
      delivered: 0,
      responses: 0,
      interested: []
    };

    for (const target of dmTargets) {
      const dmResult = await this.sendValueDM(target);
      
      if (dmResult.sent) {
        dmResults.sent++;
        
        if (dmResult.delivered) {
          dmResults.delivered++;
          
          if (dmResult.response) {
            dmResults.responses++;
            
            if (dmResult.interested) {
              dmResults.interested.push(target);
            }
          }
        }
      }

      // Realistic delay between DMs to avoid being flagged
      await new Promise(resolve => setTimeout(resolve, Math.random() * 20000 + 30000)); // 30-50 second delay
    }

    await logActivity(this.businessId, {
      type: ActivityTypes.VALUE_DMS_SENT,
      icon: '📩',
      message: `Sent ${dmResults.sent} value-first DMs to warmed competitors' followers`,
      details: 'Personalized messages referencing competitor relationship and providing immediate value',
      metadata: {
        targeted: dmResults.targeted,
        sent: dmResults.sent,
        delivery_rate: `${Math.round(dmResults.delivered / dmResults.sent * 100)}%`,
        response_rate: `${Math.round(dmResults.responses / dmResults.delivered * 100)}%`,
        interested: dmResults.interested.length,
        strategy: 'competitor_follower_outreach'
      }
    });

    return dmResults;
  }

  async sendValueDM(target) {
    const dmMessage = await this.generateValueDM(target);
    const deliveryRate = this.calculateDeliveryRate(target);
    const responseRate = this.calculateResponseRate(target, dmMessage);

    const result = {
      sent: true,
      delivered: Math.random() < deliveryRate,
      response: false,
      interested: false,
      message: dmMessage
    };

    if (result.delivered) {
      result.response = Math.random() < responseRate;
      
      if (result.response) {
        result.interested = Math.random() < 0.65; // 65% of responders are interested
      }
    }

    return result;
  }

  async generateValueDM(target) {
    const businessName = this.businessData.businessName || this.businessData.name;
    const competitorHandle = target.competitor_source;
    
    const templates = [
      `Hey! Noticed you follow @${competitorHandle} - love their content too! 🙌 I actually put together a quick guide on [relevant topic] that might be right up your alley. Want me to send it over? No strings attached!`,
      
      `Hi! Saw you're connected to @${competitorHandle} and thought you might appreciate this: [specific value]. It's something most people in [industry] overlook but makes a huge difference. Hope it helps! 💡`,
      
      `Hey! Fellow @${competitorHandle} follower here! 👋 Quick question: are you dealing with [relevant challenge]? I just created a simple framework that usually helps with this exact thing.`,
      
      `Hi! Love that you follow @${competitorHandle} - clearly you're interested in [relevant area]! I actually just finished a [resource type] that dives deeper into this stuff. Would you find that helpful?`,
      
      `Hey! Noticed you engage with @${competitorHandle}'s content about [topic]. I work with people facing similar challenges and thought you might find this insight useful: [specific tip]. Let me know what you think! 🚀`
    ];

    let message = templates[Math.floor(Math.random() * templates.length)];
    
    // Personalize the message
    message = this.personalizeDMMessage(message, target);
    
    return message;
  }

  personalizeDMMessage(message, target) {
    const personalizations = {
      '[relevant topic]': this.getRelevantTopic(target),
      '[specific value]': this.getSpecificValue(target),
      '[industry]': this.getIndustryContext(target),
      '[relevant challenge]': this.getRelevantChallenge(target),
      '[relevant area]': this.getRelevantArea(target),
      '[resource type]': this.getResourceType(target),
      '[topic]': this.getTopic(target),
      '[specific tip]': this.getSpecificTip(target)
    };

    let personalizedMessage = message;
    Object.entries(personalizations).forEach(([placeholder, replacement]) => {
      personalizedMessage = personalizedMessage.replace(placeholder, replacement);
    });

    return personalizedMessage;
  }

  getRelevantTopic(target) {
    const topics = {
      'marketing': 'customer acquisition',
      'fitness': 'workout optimization',
      'business': 'business growth',
      'design': 'brand building'
    };
    
    const interest = target.interests[0] || 'business';
    return topics[interest] || 'business optimization';
  }

  getSpecificValue(target) {
    const values = [
      'a 5-minute daily routine that most successful people use',
      'a simple framework that usually increases results by 30%',
      'a strategy that worked for 80% of people I shared it with',
      'an insight that completely changed how I approach this'
    ];
    
    return values[Math.floor(Math.random() * values.length)];
  }

  getIndustryContext(target) {
    const interest = target.interests[0] || 'business';
    return interest === 'business' ? 'your space' : `the ${interest} space`;
  }

  getRelevantChallenge(target) {
    const challenges = {
      'marketing': 'getting consistent leads',
      'fitness': 'staying motivated',
      'business': 'scaling efficiently',
      'design': 'finding ideal clients'
    };
    
    const interest = target.interests[0] || 'business';
    return challenges[interest] || 'growing your business';
  }

  getRelevantArea(target) {
    const interest = target.interests[0] || 'business';
    return interest === 'business' ? 'business growth' : interest;
  }

  getResourceType(target) {
    const types = ['checklist', 'guide', 'framework', 'case study', 'template'];
    return types[Math.floor(Math.random() * types.length)];
  }

  getTopic(target) {
    const interest = target.interests[0] || 'business';
    return interest === 'business' ? 'growth strategies' : interest;
  }

  getSpecificTip(target) {
    const tips = [
      'Focus on one channel until it works, then add the second',
      'Test your biggest assumption first, not your safest bet',
      'Measure inputs, not just outputs',
      'Optimize for speed of learning over perfection'
    ];
    
    return tips[Math.floor(Math.random() * tips.length)];
  }

  calculateDeliveryRate(target) {
    let rate = 0.75; // Base 75% delivery rate

    // Higher engagement followers more likely to receive DMs
    if (target.warm_level === 'high') rate += 0.15;
    else if (target.warm_level === 'medium') rate += 0.10;

    // Account type impact
    if (target.account_type === 'business') rate += 0.10;

    // Activity level impact
    if (target.activity_level === 'very_high') rate += 0.05;

    return Math.min(rate, 0.95); // Cap at 95%
  }

  calculateResponseRate(target, message) {
    let rate = 0.25; // Base 25% response rate for Instagram DMs

    // Warm level impact
    if (target.warm_level === 'high') rate += 0.20;
    else if (target.warm_level === 'medium') rate += 0.10;

    // Engagement patterns impact
    if (target.engagement_patterns.comments_frequently) rate += 0.15;

    // Account type impact
    if (target.account_type === 'business') rate += 0.10;

    // Message quality impact
    if (message.includes('No strings attached') || message.includes('Hope it helps')) rate += 0.05;

    return Math.min(rate, 0.60); // Cap at 60%
  }

  /**
   * Convert DM conversations
   */
  async convertDMConversations(dmCampaignResults) {
    console.log('💰 Converting DM conversations...');

    const interestedProspects = dmCampaignResults.interested;
    const conversionResults = {
      conversation_started: interestedProspects.length,
      calls_booked: 0,
      sales_made: 0,
      estimated_conversions: 0
    };

    for (const prospect of interestedProspects) {
      const conversion = await this.attemptConversion(prospect);
      
      if (conversion.call_booked) {
        conversionResults.calls_booked++;
      }
      
      if (conversion.sale_made) {
        conversionResults.sales_made++;
      }
    }

    // Estimate total conversions based on pipeline
    conversionResults.estimated_conversions = Math.floor(conversionResults.calls_booked * 0.35); // 35% call-to-sale rate

    await logActivity(this.businessId, {
      type: ActivityTypes.DM_CONVERSIONS_COMPLETED,
      icon: '💰',
      message: `DM conversations converted: ${conversionResults.calls_booked} calls booked`,
      details: 'Direct conversion in DMs without redirecting to external forms',
      metadata: {
        conversations_started: conversionResults.conversation_started,
        calls_booked: conversionResults.calls_booked,
        conversion_rate: `${Math.round(conversionResults.calls_booked / conversionResults.conversation_started * 100)}%`,
        estimated_sales: conversionResults.estimated_conversions,
        avg_time_to_convert: '3-5 message exchanges'
      }
    });

    return conversionResults;
  }

  async attemptConversion(prospect) {
    const conversionRate = this.calculateConversionRate(prospect);
    
    return {
      call_booked: Math.random() < conversionRate,
      sale_made: Math.random() < (conversionRate * 0.35), // 35% of bookings convert to sales
      conversation_quality: this.assessConversationQuality(prospect)
    };
  }

  calculateConversionRate(prospect) {
    let rate = 0.30; // Base 30% conversion rate for interested prospects

    // Targeting priority boost
    if (prospect.targeting_priority > 90) rate += 0.20;
    else if (prospect.targeting_priority > 80) rate += 0.15;
    else if (prospect.targeting_priority > 70) rate += 0.10;

    // Account type boost
    if (prospect.account_type === 'business') rate += 0.15;

    // Engagement score boost
    if (prospect.engagement_score > 85) rate += 0.10;

    return Math.min(rate, 0.65); // Cap at 65%
  }

  assessConversationQuality(prospect) {
    const qualityFactors = [
      'high_engagement',
      'specific_questions',
      'budget_mentioned',
      'timeline_discussed',
      'clear_need_identified'
    ];

    const qualityCount = Math.floor(Math.random() * 3) + 2; // 2-4 quality factors
    return qualityFactors.slice(0, qualityCount);
  }

  /**
   * Stop Instagram DM campaign operation
   */
  async stopDMCampaign() {
    this.isDMCampaigning = false;
    console.log('⏹️ Stopped Instagram DM campaign');
    
    await logActivity(this.businessId, {
      type: ActivityTypes.INSTAGRAM_DM_CAMPAIGN_STOPPED,
      icon: '⏹️',
      message: 'Instagram DM campaign stopped',
      details: 'All competitor follower targeting and DM automation paused',
      metadata: {
        platform: 'instagram',
        competitors_monitored: this.targetCompetitors.length,
        followers_harvested: this.harvestedFollowers.length
      }
    });
  }
}

export default InstagramDMCampaignBot;
