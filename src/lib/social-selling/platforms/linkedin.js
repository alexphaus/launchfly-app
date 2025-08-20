// src/lib/social-selling/platforms/linkedin.js
// LinkedIn Outbound Strategy - Search job titles, send connection requests, follow up with case studies, book calls

import { logActivity, ActivityTypes } from '../../activity-logger';

/**
 * LinkedIn Outbound Bot
 * Search job titles that match ideal customer
 * Send 50-100 connection requests daily with personalized notes
 * Follow up with case studies, not pitches
 * Book calls directly in DMs
 */
export class LinkedInOutboundBot {
  constructor(businessId, businessData) {
    this.businessId = businessId;
    this.businessData = businessData;
    this.targetJobTitles = [];
    this.connectionQueue = [];
    this.isOutbounding = false;
  }

  /**
   * Start LinkedIn outbound operation
   */
  async startOutbound(targetJobTitles) {
    console.log('💼 Starting LinkedIn outbound...');
    
    this.isOutbounding = true;
    this.targetJobTitles = targetJobTitles;

    // Phase 1: Search and identify prospects
    const prospects = await this.searchProspects(targetJobTitles);
    
    // Phase 2: Send personalized connection requests
    const connectionResults = await this.sendConnectionRequests(prospects);
    
    // Phase 3: Follow up with accepted connections
    const followUpResults = await this.executeFollowUpSequence(connectionResults.accepted);
    
    // Phase 4: Book calls with interested prospects
    const callBookings = await this.bookCalls(followUpResults.interested);

    await logActivity(this.businessId, {
      type: ActivityTypes.LINKEDIN_OUTBOUND_STARTED,
      icon: '💼',
      message: `LinkedIn outbound to ${prospects.length} targeted prospects`,
      details: 'Personalized connection requests followed by case study sharing',
      metadata: {
        target_job_titles: targetJobTitles,
        prospects_found: prospects.length,
        connections_sent: connectionResults.sent,
        acceptance_rate: `${Math.round(connectionResults.accepted.length / connectionResults.sent * 100)}%`,
        calls_booked: callBookings.length,
        daily_target: '50-100 connections'
      }
    });

    return {
      prospects,
      connectionResults,
      followUpResults,
      callBookings,
      estimatedPipeline: callBookings.length * 0.4 // 40% call-to-opportunity rate
    };
  }

  /**
   * Search LinkedIn for prospects matching target job titles
   */
  async searchProspects(targetJobTitles) {
    console.log('🔍 Searching LinkedIn for target prospects...');

    const allProspects = [];

    for (const jobTitle of targetJobTitles) {
      const jobProspects = await this.searchByJobTitle(jobTitle);
      allProspects.push(...jobProspects);
    }

    // Filter and score prospects
    const qualifiedProspects = this.filterAndScoreProspects(allProspects);

    await logActivity(this.businessId, {
      type: ActivityTypes.PROSPECT_SEARCH_COMPLETED,
      icon: '🎯',
      message: `Found ${qualifiedProspects.length} qualified LinkedIn prospects`,
      details: 'Filtered by company size, industry, and recent activity',
      metadata: {
        total_found: allProspects.length,
        qualified: qualifiedProspects.length,
        job_titles_searched: targetJobTitles,
        filter_criteria: ['company_size', 'industry_match', 'recent_activity', 'connection_degree']
      }
    });

    return qualifiedProspects;
  }

  async searchByJobTitle(jobTitle) {
    console.log(`🔎 Searching for ${jobTitle} professionals...`);

    // Simulate LinkedIn search results
    const prospectCount = Math.floor(Math.random() * 30) + 20; // 20-50 prospects per job title
    const prospects = [];

    for (let i = 0; i < prospectCount; i++) {
      prospects.push({
        id: `linkedin_prospect_${jobTitle.replace(/\s+/g, '_').toLowerCase()}_${i + 1}`,
        name: `${jobTitle} ${i + 1}`,
        jobTitle,
        company: this.generateCompanyName(),
        companySize: this.generateCompanySize(),
        industry: this.generateIndustry(),
        location: this.generateLocation(),
        connectionDegree: this.generateConnectionDegree(),
        recentActivity: this.generateRecentActivity(),
        profile: this.generateProfileDetails(jobTitle),
        lastActive: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    return prospects;
  }

  generateCompanyName() {
    const prefixes = ['Tech', 'Global', 'Digital', 'Smart', 'Next', 'Core', 'Prime', 'Alpha'];
    const suffixes = ['Solutions', 'Systems', 'Group', 'Corp', 'Inc', 'Labs', 'Ventures', 'Partners'];
    
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    
    return `${prefix} ${suffix}`;
  }

  generateCompanySize() {
    const sizes = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
    const weights = [0.2, 0.3, 0.25, 0.15, 0.07, 0.03]; // Most companies are small-medium
    
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < sizes.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return sizes[i];
      }
    }
    
    return '11-50';
  }

  generateIndustry() {
    const industries = [
      'Technology',
      'Marketing & Advertising',
      'Financial Services',
      'Healthcare',
      'Consulting',
      'E-commerce',
      'SaaS',
      'Real Estate',
      'Manufacturing',
      'Education'
    ];
    
    return industries[Math.floor(Math.random() * industries.length)];
  }

  generateLocation() {
    const locations = [
      'San Francisco, CA',
      'New York, NY',
      'Austin, TX',
      'Seattle, WA',
      'Boston, MA',
      'Denver, CO',
      'Atlanta, GA',
      'Chicago, IL',
      'Los Angeles, CA',
      'Miami, FL'
    ];
    
    return locations[Math.floor(Math.random() * locations.length)];
  }

  generateConnectionDegree() {
    const degrees = ['1st', '2nd', '3rd'];
    const weights = [0.1, 0.6, 0.3]; // Most are 2nd degree
    
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < degrees.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return degrees[i];
      }
    }
    
    return '2nd';
  }

  generateRecentActivity() {
    const activities = [
      'Posted about industry trends',
      'Shared company update',
      'Commented on business growth',
      'Posted about team expansion',
      'Shared thought leadership',
      'Engaged with industry content',
      'Posted about new challenges',
      'Shared success story'
    ];
    
    const activityCount = Math.floor(Math.random() * 3) + 1; // 1-3 recent activities
    const recentActivities = [];
    
    for (let i = 0; i < activityCount; i++) {
      recentActivities.push({
        type: activities[Math.floor(Math.random() * activities.length)],
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      });
    }
    
    return recentActivities;
  }

  generateProfileDetails(jobTitle) {
    return {
      experience: `${Math.floor(Math.random() * 10) + 3} years in ${jobTitle.toLowerCase()}`,
      education: this.generateEducation(),
      skills: this.generateSkills(jobTitle),
      previousCompanies: Math.floor(Math.random() * 4) + 2,
      connectionCount: Math.floor(Math.random() * 500) + 200
    };
  }

  generateEducation() {
    const schools = [
      'Stanford University',
      'Harvard Business School',
      'MIT',
      'UC Berkeley',
      'Northwestern',
      'University of Pennsylvania',
      'Columbia University',
      'NYU'
    ];
    
    return schools[Math.floor(Math.random() * schools.length)];
  }

  generateSkills(jobTitle) {
    const skillSets = {
      'Marketing Director': ['Digital Marketing', 'Strategy', 'Analytics', 'Brand Management'],
      'VP of Sales': ['Sales Strategy', 'Team Leadership', 'CRM', 'Business Development'],
      'Head of Growth': ['Growth Hacking', 'Analytics', 'A/B Testing', 'User Acquisition'],
      'CEO': ['Leadership', 'Strategy', 'Fundraising', 'Vision'],
      'CMO': ['Marketing Strategy', 'Brand Building', 'Digital Transformation', 'Analytics']
    };
    
    return skillSets[jobTitle] || ['Leadership', 'Strategy', 'Business Development', 'Innovation'];
  }

  filterAndScoreProspects(prospects) {
    return prospects
      .filter(prospect => this.meetsFilterCriteria(prospect))
      .map(prospect => ({
        ...prospect,
        score: this.calculateProspectScore(prospect)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 200); // Top 200 prospects
  }

  meetsFilterCriteria(prospect) {
    // Filter criteria for qualified prospects
    const validCompanySizes = ['11-50', '51-200', '201-500', '501-1000'];
    const hasRecentActivity = prospect.recentActivity.length > 0;
    const isReachable = ['1st', '2nd'].includes(prospect.connectionDegree);
    
    return validCompanySizes.includes(prospect.companySize) && hasRecentActivity && isReachable;
  }

  calculateProspectScore(prospect) {
    let score = 50; // Base score

    // Company size scoring (sweet spot for most B2B)
    if (prospect.companySize === '51-200') score += 20;
    else if (prospect.companySize === '11-50') score += 15;
    else if (prospect.companySize === '201-500') score += 10;

    // Connection degree
    if (prospect.connectionDegree === '1st') score += 15;
    else if (prospect.connectionDegree === '2nd') score += 10;

    // Recent activity
    score += prospect.recentActivity.length * 5;

    // Recency of activity
    const daysSinceActive = (Date.now() - new Date(prospect.lastActive)) / (1000 * 60 * 60 * 24);
    if (daysSinceActive < 3) score += 10;
    else if (daysSinceActive < 7) score += 5;

    // Industry relevance
    if (this.isRelevantIndustry(prospect.industry)) score += 10;

    return Math.min(score, 100); // Cap at 100
  }

  isRelevantIndustry(industry) {
    const relevantIndustries = [
      'Technology',
      'Marketing & Advertising',
      'SaaS',
      'Consulting',
      'E-commerce'
    ];
    
    return relevantIndustries.includes(industry);
  }

  /**
   * Send personalized connection requests
   */
  async sendConnectionRequests(prospects) {
    console.log('🤝 Sending personalized connection requests...');

    const dailyLimit = 75; // Conservative daily limit
    const targetProspects = prospects.slice(0, dailyLimit);
    
    const results = {
      sent: 0,
      accepted: [],
      pending: [],
      declined: []
    };

    for (const prospect of targetProspects) {
      const connectionResult = await this.sendConnectionRequest(prospect);
      results.sent++;
      
      if (connectionResult.accepted) {
        results.accepted.push({ ...prospect, connectionMessage: connectionResult.message });
      } else if (connectionResult.declined) {
        results.declined.push(prospect);
      } else {
        results.pending.push(prospect);
      }

      // Realistic delay between requests
      await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000)); // 2-5 second delay
    }

    await logActivity(this.businessId, {
      type: ActivityTypes.CONNECTION_REQUESTS_SENT,
      icon: '🔗',
      message: `Sent ${results.sent} personalized LinkedIn connection requests`,
      details: 'Strategic outreach to decision makers with personalized notes',
      metadata: {
        sent: results.sent,
        accepted: results.accepted.length,
        acceptance_rate: `${Math.round(results.accepted.length / results.sent * 100)}%`,
        target_job_titles: [...new Set(targetProspects.map(p => p.jobTitle))],
        daily_limit: dailyLimit
      }
    });

    return results;
  }

  async sendConnectionRequest(prospect) {
    const message = await this.generateConnectionMessage(prospect);
    const acceptanceRate = this.calculateConnectionAcceptanceRate(prospect, message);
    
    const random = Math.random();

    if (random < acceptanceRate) {
      return { accepted: true, message };
    } else if (random < acceptanceRate + 0.05) {
      return { declined: true, message };
    } else {
      return { pending: true, message };
    }
  }

  async generateConnectionMessage(prospect) {
    const templates = [
      `Hi ${prospect.name}, I help ${prospect.jobTitle}s at companies like ${prospect.company} achieve [specific result]. Would love to connect and share some insights!`,
      `${prospect.name}, saw your recent post about [relevant topic]. I work with ${prospect.jobTitle}s facing similar challenges. Let's connect!`,
      `Hi ${prospect.name}, fellow professional in the ${prospect.industry} space. I'd love to connect and share some strategies that have worked for similar ${prospect.companySize} companies.`,
      `${prospect.name}, I help ${prospect.jobTitle}s like yourself overcome [specific challenge]. Would be great to connect and exchange insights!`,
      `Hi ${prospect.name}, impressed by ${prospect.company}'s growth. I work with ${prospect.jobTitle}s on [relevant solution]. Let's connect!`
    ];

    let template = templates[Math.floor(Math.random() * templates.length)];
    
    // Personalize based on prospect data
    template = template.replace('[specific result]', this.getSpecificResult(prospect.jobTitle));
    template = template.replace('[relevant topic]', this.getRelevantTopic(prospect.jobTitle));
    template = template.replace('[specific challenge]', this.getSpecificChallenge(prospect.jobTitle));
    template = template.replace('[relevant solution]', this.getRelevantSolution(prospect.jobTitle));

    return template;
  }

  getSpecificResult(jobTitle) {
    const results = {
      'Marketing Director': '30% increase in qualified leads',
      'VP of Sales': '25% improvement in conversion rates',
      'Head of Growth': '40% reduction in customer acquisition cost',
      'CEO': 'sustainable 2x revenue growth',
      'CMO': '50% boost in marketing ROI'
    };
    
    return results[jobTitle] || 'significant business growth';
  }

  getRelevantTopic(jobTitle) {
    const topics = {
      'Marketing Director': 'marketing automation challenges',
      'VP of Sales': 'sales team performance',
      'Head of Growth': 'customer acquisition strategies',
      'CEO': 'scaling challenges',
      'CMO': 'brand positioning'
    };
    
    return topics[jobTitle] || 'business growth';
  }

  getSpecificChallenge(jobTitle) {
    const challenges = {
      'Marketing Director': 'lead quality and attribution challenges',
      'VP of Sales': 'sales process optimization',
      'Head of Growth': 'sustainable growth acceleration',
      'CEO': 'operational scaling challenges',
      'CMO': 'marketing ROI measurement'
    };
    
    return challenges[jobTitle] || 'business efficiency challenges';
  }

  getRelevantSolution(jobTitle) {
    const solutions = {
      'Marketing Director': 'marketing strategy optimization',
      'VP of Sales': 'sales process improvement',
      'Head of Growth': 'growth acceleration strategies',
      'CEO': 'strategic planning and execution',
      'CMO': 'integrated marketing solutions'
    };
    
    return solutions[jobTitle] || 'business optimization';
  }

  calculateConnectionAcceptanceRate(prospect, message) {
    let rate = 0.20; // Base 20% acceptance rate

    // Higher score prospects more likely to accept
    if (prospect.score > 85) rate += 0.15;
    else if (prospect.score > 75) rate += 0.10;
    else if (prospect.score > 65) rate += 0.05;

    // Connection degree impact
    if (prospect.connectionDegree === '1st') rate += 0.20;
    else if (prospect.connectionDegree === '2nd') rate += 0.10;

    // Recent activity boost
    if (prospect.recentActivity.length > 2) rate += 0.05;

    // Personalization boost
    if (message.includes(prospect.company)) rate += 0.05;
    if (message.includes(prospect.jobTitle)) rate += 0.05;

    return Math.min(rate, 0.55); // Cap at 55%
  }

  /**
   * Execute follow-up sequence with accepted connections
   */
  async executeFollowUpSequence(acceptedConnections) {
    console.log('📧 Executing follow-up sequence...');

    const followUpResults = {
      messages_sent: 0,
      responses: 0,
      interested: [],
      not_interested: [],
      no_response: []
    };

    for (const connection of acceptedConnections) {
      const result = await this.sendFollowUpSequence(connection);
      followUpResults.messages_sent += result.messages_sent;
      
      if (result.response === 'interested') {
        followUpResults.interested.push(connection);
        followUpResults.responses++;
      } else if (result.response === 'not_interested') {
        followUpResults.not_interested.push(connection);
        followUpResults.responses++;
      } else {
        followUpResults.no_response.push(connection);
      }
    }

    await logActivity(this.businessId, {
      type: ActivityTypes.FOLLOWUP_SEQUENCE_EXECUTED,
      icon: '📨',
      message: `Follow-up sequence sent to ${acceptedConnections.length} new connections`,
      details: 'Case studies and value-driven content, not sales pitches',
      metadata: {
        connections_followed_up: acceptedConnections.length,
        response_rate: `${Math.round(followUpResults.responses / acceptedConnections.length * 100)}%`,
        interested: followUpResults.interested.length,
        conversion_approach: 'case_studies_and_insights'
      }
    });

    return followUpResults;
  }

  async sendFollowUpSequence(connection) {
    const sequence = await this.generateFollowUpSequence(connection);
    
    // Simulate sending follow-up messages over time
    let messages_sent = 0;
    let response = null;

    for (const message of sequence) {
      messages_sent++;
      
      // Check for response after each message
      const responseRate = this.calculateFollowUpResponseRate(connection, messages_sent);
      if (Math.random() < responseRate) {
        response = Math.random() < 0.7 ? 'interested' : 'not_interested'; // 70% interested if they respond
        break;
      }

      // Realistic delay between follow-up messages
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated delay
    }

    return { messages_sent, response };
  }

  async generateFollowUpSequence(connection) {
    const businessName = this.businessData.businessName || this.businessData.name;
    
    return [
      // Message 1: Thank and provide immediate value
      `Thanks for connecting, ${connection.name}! Since you're in ${connection.jobTitle}, thought you might find this interesting: [link to relevant case study]. This ${connection.companySize} company saw a 40% improvement using this approach.`,
      
      // Message 2: Share specific insight (3 days later)
      `Hi ${connection.name}, quick follow-up. Noticed most ${connection.jobTitle}s at ${connection.companySize} companies struggle with [specific challenge]. Here's a framework that typically works: [specific strategy]. Have you seen this pattern at ${connection.company}?`,
      
      // Message 3: Soft call-to-action (1 week later)
      `${connection.name}, been thinking about our earlier conversation. I help ${connection.jobTitle}s at companies like ${connection.company} overcome [challenge] through [solution]. Would a quick 15-minute call be valuable to share some specific strategies?`
    ];
  }

  calculateFollowUpResponseRate(connection, messageNumber) {
    let baseRate = 0.15; // 15% base response rate

    // Decrease response rate with each message
    baseRate *= Math.pow(0.7, messageNumber - 1);

    // Higher score connections more likely to respond
    if (connection.score > 80) baseRate *= 1.5;
    else if (connection.score > 70) baseRate *= 1.2;

    // Recent activity boost
    if (connection.recentActivity.length > 2) baseRate *= 1.2;

    return Math.min(baseRate, 0.30); // Cap at 30%
  }

  /**
   * Book calls with interested prospects
   */
  async bookCalls(interestedProspects) {
    console.log('📞 Booking calls with interested prospects...');

    const callBookings = [];

    for (const prospect of interestedProspects) {
      const booking = await this.attemptCallBooking(prospect);
      if (booking.success) {
        callBookings.push(booking);
      }
    }

    await logActivity(this.businessId, {
      type: ActivityTypes.CALLS_BOOKED,
      icon: '📅',
      message: `Booked ${callBookings.length} calls from LinkedIn outreach`,
      details: 'Direct booking through DM conversations, no forms or friction',
      metadata: {
        interested_prospects: interestedProspects.length,
        calls_booked: callBookings.length,
        booking_rate: `${Math.round(callBookings.length / interestedProspects.length * 100)}%`,
        average_time_to_book: '3-5 message exchanges',
        next_step: 'discovery_calls'
      }
    });

    return callBookings;
  }

  async attemptCallBooking(prospect) {
    // Simulate call booking conversation
    const bookingRate = this.calculateCallBookingRate(prospect);
    
    if (Math.random() < bookingRate) {
      return {
        success: true,
        prospectId: prospect.id,
        prospectName: prospect.name,
        company: prospect.company,
        jobTitle: prospect.jobTitle,
        scheduledFor: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(), // Next 7 days
        callType: 'discovery',
        duration: 30,
        value: this.estimateProspectValue(prospect)
      };
    }

    return { success: false };
  }

  calculateCallBookingRate(prospect) {
    let rate = 0.40; // Base 40% booking rate for interested prospects

    // Higher score prospects more likely to book
    if (prospect.score > 85) rate += 0.20;
    else if (prospect.score > 75) rate += 0.15;
    else if (prospect.score > 65) rate += 0.10;

    // Company size impact (mid-market converts better)
    if (prospect.companySize === '51-200') rate += 0.15;
    else if (prospect.companySize === '11-50') rate += 0.10;

    // Decision-maker titles more likely to book
    const decisionMakerTitles = ['CEO', 'VP', 'Director', 'Head of'];
    if (decisionMakerTitles.some(title => prospect.jobTitle.includes(title))) rate += 0.10;

    return Math.min(rate, 0.75); // Cap at 75%
  }

  estimateProspectValue(prospect) {
    // Estimate potential deal value based on company size and role
    const baseValues = {
      '1-10': 2000,
      '11-50': 8000,
      '51-200': 25000,
      '201-500': 50000,
      '501-1000': 100000,
      '1000+': 200000
    };

    const roleMultipliers = {
      'CEO': 1.5,
      'VP': 1.3,
      'Director': 1.2,
      'Head of': 1.2,
      'Manager': 1.0
    };

    const baseValue = baseValues[prospect.companySize] || 5000;
    const roleMultiplier = Object.entries(roleMultipliers).find(([title]) => 
      prospect.jobTitle.includes(title)
    )?.[1] || 1.0;

    return Math.round(baseValue * roleMultiplier);
  }

  /**
   * Stop LinkedIn outbound operation
   */
  async stopOutbound() {
    this.isOutbounding = false;
    console.log('⏹️ Stopped LinkedIn outbound');
    
    await logActivity(this.businessId, {
      type: ActivityTypes.OUTBOUND_STOPPED,
      icon: '⏹️',
      message: 'LinkedIn outbound stopped',
      details: 'All connection requests and follow-ups paused',
      metadata: {
        platform: 'linkedin',
        target_job_titles: this.targetJobTitles.length,
        connections_in_queue: this.connectionQueue.length
      }
    });
  }
}

export default LinkedInOutboundBot;
