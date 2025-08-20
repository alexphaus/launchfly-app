// src/lib/social-selling/orchestrator.js
// Social Selling Orchestrator - Manages all platforms and coordinates campaigns

import { SocialWorker } from './core';
import RedditInfiltrationBot from './platforms/reddit';
import FacebookGroupHarvestingBot from './platforms/facebook';
import LinkedInOutboundBot from './platforms/linkedin';
import TwitterReplyGuyBot from './platforms/twitter';
import InstagramDMCampaignBot from './platforms/instagram';
import { logActivity, ActivityTypes } from '../activity-logger';

/**
 * Social Selling Orchestrator
 * Coordinates all social selling platforms for maximum impact
 * Prioritizes Reddit + Facebook Groups as recommended
 */
export class SocialSellingOrchestrator {
  constructor(businessId, businessData) {
    this.businessId = businessId;
    this.businessData = businessData;
    this.activePlatforms = new Map();
    this.campaignResults = {};
    this.isRunning = false;
  }

  /**
   * Launch comprehensive social selling campaign
   * Starts with Reddit + Facebook Groups (highest intent, easiest automation)
   */
  async launchSocialSelling(options = {}) {
    console.log('🚀 Launching Social Selling Campaign...');
    
    this.isRunning = true;
    const startTime = Date.now();

    // Phase 1: Platform Prioritization (Reddit + Facebook first)
    const platformPriority = this.determinePlatformPriority(options);
    
    // Phase 2: Launch Primary Platforms (Reddit + Facebook)
    const primaryResults = await this.launchPrimaryPlatforms(platformPriority.primary);
    
    // Phase 3: Launch Secondary Platforms (LinkedIn, Twitter, Instagram)
    const secondaryResults = await this.launchSecondaryPlatforms(platformPriority.secondary);
    
    // Phase 4: Cross-Platform Optimization
    const optimizationResults = await this.optimizeCrossPlatform(primaryResults, secondaryResults);

    const totalResults = {
      ...primaryResults,
      ...secondaryResults,
      optimization: optimizationResults,
      campaign_duration: Date.now() - startTime,
      platforms_active: this.activePlatforms.size,
      estimated_first_sale: this.estimateFirstSale(primaryResults, secondaryResults)
    };

    this.campaignResults = totalResults;

    await logActivity(this.businessId, {
      type: ActivityTypes.SOCIAL_SELLING_CAMPAIGN_LAUNCHED,
      icon: '🎯',
      message: `Social selling campaign active on ${this.activePlatforms.size} platforms`,
      details: 'Reddit + Facebook Groups leading strategy, LinkedIn/Twitter/Instagram supporting',
      metadata: {
        platforms_active: Array.from(this.activePlatforms.keys()),
        primary_platforms: platformPriority.primary,
        estimated_first_sale: totalResults.estimated_first_sale,
        total_reach: this.calculateTotalReach(totalResults),
        campaign_goal: 'First sale in 48 hours through direct social selling'
      }
    });

    return totalResults;
  }

  /**
   * Determine platform priority based on business type and goals
   */
  determinePlatformPriority(options) {
    const businessType = this.analyzeBusinessType();
    const customPriority = options.platformPriority || [];

    let primary = ['reddit', 'facebook']; // Default: highest intent, least likely to get banned
    let secondary = ['linkedin', 'twitter', 'instagram'];

    // Adjust based on business type
    if (businessType.isB2BServices) {
      primary = ['reddit', 'linkedin'];
      secondary = ['facebook', 'twitter', 'instagram'];
    } else if (businessType.isVisualBusiness) {
      primary = ['instagram', 'facebook'];
      secondary = ['reddit', 'twitter', 'linkedin'];
    } else if (businessType.isTechSaaS) {
      primary = ['reddit', 'twitter'];
      secondary = ['linkedin', 'facebook', 'instagram'];
    }

    // Apply custom priority if specified
    if (customPriority.length > 0) {
      primary = customPriority.slice(0, 2);
      secondary = customPriority.slice(2);
    }

    return { primary, secondary, businessType };
  }

  analyzeBusinessType() {
    const industry = (this.businessData.industry || '').toLowerCase();
    const products = JSON.stringify(this.businessData.products || []).toLowerCase();
    const businessName = (this.businessData.businessName || '').toLowerCase();
    
    const isB2BServices = /consult|b2b|enterprise|saas|agency|professional services|audit|advisory/i.test(`${industry} ${products}`);
    const isVisualBusiness = /design|photography|art|creative|visual|brand|logo|graphic/i.test(`${industry} ${products}`);
    const isTechSaaS = /tech|software|saas|app|platform|digital|automation/i.test(`${industry} ${products}`);
    const isLocalBusiness = /local|dental|clinic|repair|spa|fitness|landscap|clean|restaurant/i.test(`${industry} ${products}`);

    return {
      isB2BServices,
      isVisualBusiness,
      isTechSaaS,
      isLocalBusiness,
      primaryCategory: this.determinePrimaryCategory(isB2BServices, isVisualBusiness, isTechSaaS, isLocalBusiness)
    };
  }

  determinePrimaryCategory(isB2B, isVisual, isTech, isLocal) {
    if (isB2B) return 'b2b_services';
    if (isVisual) return 'visual_business';
    if (isTech) return 'tech_saas';
    if (isLocal) return 'local_business';
    return 'general_business';
  }

  /**
   * Launch primary platforms (Reddit + Facebook Groups by default)
   */
  async launchPrimaryPlatforms(primaryPlatforms) {
    console.log('🎯 Launching primary platforms for maximum impact...');

    const results = {};

    for (const platform of primaryPlatforms) {
      try {
        const platformResult = await this.launchPlatform(platform, { priority: 'primary' });
        results[platform] = platformResult;
        
        // Mark platform as active
        this.activePlatforms.set(platform, {
          bot: platformResult.bot,
          status: 'active',
          priority: 'primary',
          launched_at: new Date().toISOString()
        });

        await logActivity(this.businessId, {
          type: ActivityTypes.PLATFORM_LAUNCHED,
          icon: this.getPlatformIcon(platform),
          message: `${this.getPlatformName(platform)} social selling activated`,
          details: `Primary platform targeting high-intent prospects`,
          metadata: {
            platform,
            priority: 'primary',
            estimated_reach: platformResult.estimatedReach || 0,
            strategy: this.getPlatformStrategy(platform)
          }
        });

        // Wait between platform launches to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 5000));

      } catch (error) {
        console.error(`Error launching ${platform}:`, error);
        results[platform] = { error: error.message };
      }
    }

    return results;
  }

  /**
   * Launch secondary platforms for additional reach
   */
  async launchSecondaryPlatforms(secondaryPlatforms) {
    console.log('📈 Launching secondary platforms for expanded reach...');

    const results = {};

    // Launch secondary platforms with slight delay to let primary platforms establish
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay

    for (const platform of secondaryPlatforms) {
      try {
        const platformResult = await this.launchPlatform(platform, { priority: 'secondary' });
        results[platform] = platformResult;
        
        // Mark platform as active
        this.activePlatforms.set(platform, {
          bot: platformResult.bot,
          status: 'active',
          priority: 'secondary',
          launched_at: new Date().toISOString()
        });

        await logActivity(this.businessId, {
          type: ActivityTypes.PLATFORM_LAUNCHED,
          icon: this.getPlatformIcon(platform),
          message: `${this.getPlatformName(platform)} social selling activated`,
          details: `Secondary platform for expanded reach`,
          metadata: {
            platform,
            priority: 'secondary',
            estimated_reach: platformResult.estimatedReach || 0,
            strategy: this.getPlatformStrategy(platform)
          }
        });

        // Wait between secondary platform launches
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (error) {
        console.error(`Error launching ${platform}:`, error);
        results[platform] = { error: error.message };
      }
    }

    return results;
  }

  /**
   * Launch individual platform
   */
  async launchPlatform(platform, options = {}) {
    switch (platform) {
      case 'reddit':
        return await this.launchReddit(options);
      case 'facebook':
        return await this.launchFacebook(options);
      case 'linkedin':
        return await this.launchLinkedIn(options);
      case 'twitter':
        return await this.launchTwitter(options);
      case 'instagram':
        return await this.launchInstagram(options);
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  }

  async launchReddit(options) {
    const bot = new RedditInfiltrationBot(this.businessId, this.businessData);
    const targetSubreddits = await this.generateRedditTargets();
    const result = await bot.startMonitoring(targetSubreddits);
    
    return {
      bot,
      platform: 'reddit',
      strategy: 'infiltration',
      targets: targetSubreddits,
      estimatedReach: targetSubreddits.length * 15000, // 15K average per subreddit
      ...result
    };
  }

  async launchFacebook(options) {
    const bot = new FacebookGroupHarvestingBot(this.businessId, this.businessData);
    const targetGroupTypes = await this.generateFacebookTargets();
    const result = await bot.startHarvesting(targetGroupTypes);
    
    return {
      bot,
      platform: 'facebook',
      strategy: 'group_harvesting',
      targets: targetGroupTypes,
      estimatedReach: result.estimatedConversions * 100, // Estimate based on conversions
      ...result
    };
  }

  async launchLinkedIn(options) {
    const bot = new LinkedInOutboundBot(this.businessId, this.businessData);
    const targetJobTitles = await this.generateLinkedInTargets();
    const result = await bot.startOutbound(targetJobTitles);
    
    return {
      bot,
      platform: 'linkedin',
      strategy: 'outbound',
      targets: targetJobTitles,
      estimatedReach: result.estimatedPipeline * 50, // Estimate based on pipeline
      ...result
    };
  }

  async launchTwitter(options) {
    const bot = new TwitterReplyGuyBot(this.businessId, this.businessData);
    const { keywords, accounts } = await this.generateTwitterTargets();
    const result = await bot.startReplyGuy(keywords, accounts);
    
    return {
      bot,
      platform: 'twitter',
      strategy: 'reply_guy',
      targets: { keywords, accounts },
      estimatedReach: result.estimatedReach || 50000,
      ...result
    };
  }

  async launchInstagram(options) {
    const bot = new InstagramDMCampaignBot(this.businessId, this.businessData);
    const targetCompetitors = await this.generateInstagramTargets();
    const result = await bot.startDMCampaign(targetCompetitors);
    
    return {
      bot,
      platform: 'instagram',
      strategy: 'dm_campaign',
      targets: targetCompetitors,
      estimatedReach: result.estimatedReach || 10000,
      ...result
    };
  }

  /**
   * Generate platform-specific targets based on business data
   */
  async generateRedditTargets() {
    const industry = this.businessData.industry || 'business';
    const baseSubreddits = ['entrepreneur', 'startups', 'smallbusiness'];
    
    const industryMap = {
      'marketing': ['marketing', 'digitalmarketing', 'socialmedia', 'advertising'],
      'logo design': ['design', 'logodesign', 'graphic_design', 'branding'],
      'web development': ['webdev', 'programming', 'webdesign', 'coding'],
      'consulting': ['consulting', 'freelance', 'business', 'productivity'],
      'fitness': ['fitness', 'personaltraining', 'nutrition', 'health'],
      'real estate': ['realestate', 'investing', 'realestateinvesting', 'property']
    };

    const industrySubreddits = industryMap[industry.toLowerCase()] || [];
    return [...baseSubreddits, ...industrySubreddits].slice(0, 8); // Max 8 subreddits
  }

  async generateFacebookTargets() {
    const industry = this.businessData.industry || 'business';
    const baseTypes = ['business_networking', 'entrepreneurs'];
    
    const industryTypes = [`${industry}_professionals`, 'target_customer_groups'];
    if (industry.includes('local')) {
      industryTypes.push('local_business');
    }

    return [...baseTypes, ...industryTypes].slice(0, 4); // Max 4 group types
  }

  async generateLinkedInTargets() {
    const industry = this.businessData.industry || 'business';
    const baseJobTitles = ['CEO', 'Founder', 'Director'];
    
    const industryMap = {
      'marketing': ['Marketing Director', 'CMO', 'VP of Marketing', 'Marketing Manager'],
      'sales': ['VP of Sales', 'Sales Director', 'Head of Sales', 'Sales Manager'],
      'consulting': ['Management Consultant', 'Strategy Director', 'Business Analyst'],
      'technology': ['CTO', 'VP of Engineering', 'Tech Lead', 'Product Manager'],
      'finance': ['CFO', 'Finance Director', 'Controller', 'Financial Analyst']
    };

    const industryTitles = industryMap[industry.toLowerCase()] || ['Business Owner', 'Operations Manager'];
    return [...baseJobTitles, ...industryTitles].slice(0, 6); // Max 6 job titles
  }

  async generateTwitterTargets() {
    const industry = this.businessData.industry || 'business';
    const baseKeywords = ['business growth', 'entrepreneur', 'startup'];
    const baseAccounts = [
      { handle: 'business_guru', niche: 'business', follower_count: 50000 },
      { handle: 'startup_advisor', niche: 'startups', follower_count: 75000 }
    ];

    const industryKeywords = [industry, `${industry} tips`, `${industry} strategy`];
    
    return {
      keywords: [...baseKeywords, ...industryKeywords].slice(0, 8),
      accounts: baseAccounts
    };
  }

  async generateInstagramTargets() {
    const industry = this.businessData.industry || 'business';
    
    return [
      {
        handle: `${industry}_expert`,
        follower_count: 25000,
        niche: industry
      },
      {
        handle: `${industry}_tips`,
        follower_count: 15000,
        niche: industry
      }
    ];
  }

  /**
   * Optimize cross-platform performance
   */
  async optimizeCrossPlatform(primaryResults, secondaryResults) {
    console.log('⚡ Optimizing cross-platform performance...');

    const allResults = { ...primaryResults, ...secondaryResults };
    const optimization = {
      top_performing_platform: this.identifyTopPerformer(allResults),
      resource_reallocation: this.calculateResourceReallocation(allResults),
      cross_platform_synergies: this.identifySynergies(allResults),
      performance_adjustments: this.generatePerformanceAdjustments(allResults)
    };

    await logActivity(this.businessId, {
      type: ActivityTypes.CROSS_PLATFORM_OPTIMIZATION,
      icon: '⚡',
      message: 'Cross-platform optimization completed',
      details: 'Resource reallocation based on early performance indicators',
      metadata: optimization
    });

    return optimization;
  }

  identifyTopPerformer(results) {
    let topPlatform = 'reddit'; // Default
    let topScore = 0;

    Object.entries(results).forEach(([platform, result]) => {
      if (result.error) return;

      // Score based on estimated reach and conversion potential
      const reach = result.estimatedReach || 0;
      const conversions = result.estimatedConversions || result.conversionReady || 0;
      const score = reach + (conversions * 100); // Weight conversions heavily

      if (score > topScore) {
        topScore = score;
        topPlatform = platform;
      }
    });

    return { platform: topPlatform, score: topScore };
  }

  calculateResourceReallocation(results) {
    // Recommend resource shifts based on performance
    const recommendations = [];

    Object.entries(results).forEach(([platform, result]) => {
      if (result.error) {
        recommendations.push({
          platform,
          action: 'pause',
          reason: 'Technical issues detected'
        });
        return;
      }

      const performance = this.assessPlatformPerformance(result);
      
      if (performance === 'high') {
        recommendations.push({
          platform,
          action: 'increase_activity',
          reason: 'High conversion potential detected'
        });
      } else if (performance === 'low') {
        recommendations.push({
          platform,
          action: 'reduce_activity',
          reason: 'Low engagement, reallocate resources'
        });
      }
    });

    return recommendations;
  }

  assessPlatformPerformance(result) {
    const reach = result.estimatedReach || 0;
    const conversions = result.estimatedConversions || result.conversionReady || 0;
    
    if (conversions > 5 || reach > 20000) return 'high';
    if (conversions < 2 && reach < 5000) return 'low';
    return 'medium';
  }

  identifySynergies(results) {
    // Identify opportunities for cross-platform synergies
    const synergies = [];

    // Reddit + LinkedIn synergy
    if (results.reddit && results.linkedin && !results.reddit.error && !results.linkedin.error) {
      synergies.push({
        platforms: ['reddit', 'linkedin'],
        opportunity: 'Share Reddit insights in LinkedIn content',
        potential_impact: 'High'
      });
    }

    // Facebook + Instagram synergy
    if (results.facebook && results.instagram && !results.facebook.error && !results.instagram.error) {
      synergies.push({
        platforms: ['facebook', 'instagram'],
        opportunity: 'Cross-platform Facebook group and Instagram follower targeting',
        potential_impact: 'Medium'
      });
    }

    return synergies;
  }

  generatePerformanceAdjustments(results) {
    return {
      message_frequency: 'Increase on high-performing platforms',
      targeting_refinement: 'Focus on highest-engagement audiences',
      content_optimization: 'A/B test messaging based on platform response rates',
      timing_optimization: 'Adjust posting times based on engagement patterns'
    };
  }

  /**
   * Get real-time campaign status
   */
  getCampaignStatus() {
    const status = {
      is_running: this.isRunning,
      active_platforms: Array.from(this.activePlatforms.keys()),
      platform_details: {},
      total_reach: 0,
      estimated_conversions: 0
    };

    this.activePlatforms.forEach((details, platform) => {
      status.platform_details[platform] = {
        status: details.status,
        priority: details.priority,
        launched_at: details.launched_at,
        uptime: Date.now() - new Date(details.launched_at).getTime()
      };
    });

    if (this.campaignResults) {
      status.total_reach = this.calculateTotalReach(this.campaignResults);
      status.estimated_conversions = this.calculateTotalConversions(this.campaignResults);
    }

    return status;
  }

  calculateTotalReach(results) {
    return Object.values(results).reduce((total, result) => {
      if (result.error) return total;
      return total + (result.estimatedReach || 0);
    }, 0);
  }

  calculateTotalConversions(results) {
    return Object.values(results).reduce((total, result) => {
      if (result.error) return total;
      return total + (result.estimatedConversions || result.conversionReady || 0);
    }, 0);
  }

  estimateFirstSale(primaryResults, secondaryResults) {
    // Based on typical social selling performance
    const totalConversions = this.calculateTotalConversions({ ...primaryResults, ...secondaryResults });
    
    if (totalConversions >= 5) return '24-48 hours';
    if (totalConversions >= 3) return '48-72 hours';
    if (totalConversions >= 1) return '3-5 days';
    return '5-7 days';
  }

  /**
   * Stop all social selling activities
   */
  async stopAllCampaigns() {
    console.log('⏹️ Stopping all social selling campaigns...');

    const stopPromises = Array.from(this.activePlatforms.entries()).map(async ([platform, details]) => {
      try {
        if (details.bot && typeof details.bot.stop === 'function') {
          await details.bot.stop();
        }
        this.activePlatforms.delete(platform);
        
        await logActivity(this.businessId, {
          type: ActivityTypes.PLATFORM_STOPPED,
          icon: '⏹️',
          message: `${this.getPlatformName(platform)} social selling stopped`,
          details: 'Platform campaign terminated',
          metadata: { platform }
        });
      } catch (error) {
        console.error(`Error stopping ${platform}:`, error);
      }
    });

    await Promise.all(stopPromises);
    this.isRunning = false;

    await logActivity(this.businessId, {
      type: ActivityTypes.SOCIAL_SELLING_CAMPAIGN_STOPPED,
      icon: '⏹️',
      message: 'All social selling campaigns stopped',
      details: 'Complete social selling automation paused',
      metadata: {
        platforms_stopped: Array.from(this.activePlatforms.keys()).length,
        campaign_duration: this.campaignResults?.campaign_duration || 0
      }
    });

    return { stopped: true, platforms_stopped: stopPromises.length };
  }

  /**
   * Helper methods for platform information
   */
  getPlatformIcon(platform) {
    const icons = {
      reddit: '🔴',
      facebook: '📘',
      linkedin: '💼',
      twitter: '🐦',
      instagram: '📸'
    };
    return icons[platform] || '📱';
  }

  getPlatformName(platform) {
    const names = {
      reddit: 'Reddit',
      facebook: 'Facebook Groups',
      linkedin: 'LinkedIn',
      twitter: 'Twitter/X',
      instagram: 'Instagram'
    };
    return names[platform] || platform;
  }

  getPlatformStrategy(platform) {
    const strategies = {
      reddit: 'Infiltration & value-first responses',
      facebook: 'Group harvesting & DM sequences',
      linkedin: 'Outbound connection requests & follow-ups',
      twitter: 'Reply guy strategy & engagement DMs',
      instagram: 'Competitor follower targeting & DM campaigns'
    };
    return strategies[platform] || 'Direct social selling';
  }
}

export default SocialSellingOrchestrator;
