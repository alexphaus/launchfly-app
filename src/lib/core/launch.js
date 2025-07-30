// lib/core/launch.js - Create the business (technology agnostic)
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Business creation layer - technology agnostic
 * Uses whatever AI/tools work best, focuses on getting customers
 */
export async function launchBusiness(opportunity, userData, sessionId) {
  console.log('🚀 Launching business for opportunity:', opportunity.opportunity.name);
  
  // Step 1: Create business presence (website is just one channel)
  const presence = await createBusinessPresence(opportunity, userData);
  
  // Step 2: Set up customer acquisition systems
  const acquisitionSystems = await setupCustomerAcquisition(opportunity, presence);
  
  // Step 3: Create initial marketing campaigns
  const campaigns = await createInitialCampaigns(opportunity, presence);
  
  // Step 4: Set up tracking and optimization
  const tracking = await setupBusinessTracking(sessionId, presence);
  
  // Step 5: Generate first customer outreach
  const outreach = await generateInitialOutreach(opportunity, presence);
  
  return {
    business: presence,
    acquisition: acquisitionSystems,
    campaigns: campaigns,
    tracking: tracking,
    outreach: outreach,
    launchPlan: generateLaunchPlan(opportunity, presence)
  };
}

async function createBusinessPresence(opportunity, userData) {
  // Use AI for the website (technology layer - replaceable)
  const website = await generateWebsiteWithAI(opportunity, userData);
  
  // But focus on all channels for customer acquisition (moat layer)
  const digitalPresence = await createMultiChannelPresence(opportunity, website);
  
  return {
    website: website,
    socialProfiles: digitalPresence.social,
    marketplaceListings: digitalPresence.marketplaces,
    directoryListings: digitalPresence.directories,
    emailSequences: digitalPresence.email,
    contentCalendar: digitalPresence.content
  };
}

async function generateWebsiteWithAI(opportunity, userData) {
  // Enhanced AI generation focused on conversion, not just appearance
  const prompt = `Create a high-converting business website for this validated opportunity:

Business: ${opportunity.opportunity.name}
Success Probability: ${opportunity.confidence.percentage}%
Target Customers: ${opportunity.opportunity.targetCustomers?.join(', ')}
Revenue Projection: ${opportunity.revenueProjection?.month6}/month by month 6
Quick Wins: ${opportunity.quickWins?.immediate?.join(', ')}

Focus on:
1. Customer acquisition (not just looks)
2. Conversion optimization 
3. Trust building
4. Clear value proposition
5. Multiple contact methods

Generate comprehensive business data with proven conversion elements:`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system", 
        content: "You are a conversion optimization expert who creates websites that get customers, not just visitors."
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });

  const websiteData = JSON.parse(completion.choices[0].message.content);
  
  // Enhance with conversion optimization
  return enhanceForConversion(websiteData, opportunity);
}

async function createMultiChannelPresence(opportunity, website) {
  console.log('🌐 Creating multi-channel presence...');
  
  return {
    social: await createSocialProfiles(opportunity, website),
    marketplaces: await createMarketplaceListings(opportunity),
    directories: await createDirectoryListings(opportunity, website),
    email: await createEmailSequences(opportunity),
    content: await createContentCalendar(opportunity)
  };
}

async function setupCustomerAcquisition(opportunity, presence) {
  console.log('📈 Setting up customer acquisition systems...');
  
  const strategy = opportunity.customerAcquisitionPlan;
  
  return {
    primaryChannel: await setupPrimaryChannel(strategy.primaryChannel, opportunity, presence),
    secondaryChannel: await setupSecondaryChannel(strategy.secondaryChannel, opportunity, presence),
    outreachTemplates: await createOutreachTemplates(opportunity),
    followUpSequences: await createFollowUpSequences(opportunity),
    trackingSetup: await setupAcquisitionTracking(opportunity)
  };
}

async function createInitialCampaigns(opportunity, presence) {
  console.log('📢 Creating initial marketing campaigns...');
  
  return {
    contentMarketing: await createContentCampaign(opportunity, presence),
    emailMarketing: await createEmailCampaign(opportunity, presence),
    socialMedia: await createSocialCampaign(opportunity, presence),
    partnerships: await identifyPartnershipOpportunities(opportunity),
    paidAdvertising: await createPaidAdCampaign(opportunity, presence)
  };
}

async function setupBusinessTracking(sessionId, presence) {
  console.log('📊 Setting up business tracking...');
  
  // Create tracking record in database
  const { data: tracking } = await supabase
    .from('business_tracking')
    .insert({
      session_id: sessionId,
      website_url: presence.website.domain,
      acquisition_channels: presence.website.acquisitionChannels,
      conversion_goals: ['email_signup', 'purchase', 'consultation_booking'],
      tracking_setup: new Date().toISOString()
    })
    .select()
    .single();
  
  return {
    trackingId: tracking?.id,
    goals: ['visitor_to_lead', 'lead_to_customer', 'customer_retention'],
    metrics: ['traffic', 'conversions', 'revenue', 'customer_acquisition_cost'],
    dashboardUrl: `/tracking/${sessionId}`
  };
}

async function generateInitialOutreach(opportunity, presence) {
  console.log('💬 Generating initial customer outreach...');
  
  const targetCustomers = opportunity.opportunity.targetCustomers || [];
  const value_proposition = presence.website.tagline;
  
  // Generate personalized outreach for each customer type
  const outreachPlans = await Promise.all(
    targetCustomers.map(customerType => 
      createCustomerOutreachPlan(customerType, value_proposition, opportunity)
    )
  );
  
  return {
    plans: outreachPlans,
    templates: await createOutreachTemplates(opportunity),
    schedule: generateOutreachSchedule(outreachPlans),
    tracking: setupOutreachTracking(outreachPlans)
  };
}

// Helper functions for business creation

function enhanceForConversion(websiteData, opportunity) {
  return {
    ...websiteData,
    // Add conversion optimization elements
    acquisitionChannels: [
      opportunity.customerAcquisitionPlan?.primaryChannel,
      opportunity.customerAcquisitionPlan?.secondaryChannel
    ].filter(Boolean),
    conversionElements: {
      socialProof: generateSocialProof(opportunity),
      urgency: generateUrgencyElements(opportunity),
      riskReversal: generateRiskReversalElements(opportunity),
      valueStack: generateValueStack(opportunity)
    },
    leadMagnets: generateLeadMagnets(opportunity),
    contactMethods: [
      'email', 'phone', 'chat', 'consultation_booking'
    ]
  };
}

async function createSocialProfiles(opportunity, website) {
  const profiles = {};
  const channels = ['instagram', 'linkedin', 'facebook', 'twitter'];
  
  for (const channel of channels) {
    profiles[channel] = {
      username: generateUsername(website.businessName, channel),
      bio: generateSocialBio(opportunity, channel),
      contentPlan: generateSocialContentPlan(opportunity, channel),
      posting_schedule: generatePostingSchedule(channel)
    };
  }
  
  return profiles;
}

async function createMarketplaceListings(opportunity) {
  const marketplaces = ['fiverr', 'upwork', 'etsy', 'amazon', 'shopify'];
  const relevantMarketplaces = marketplaces.filter(mp => 
    isMarketplaceRelevant(mp, opportunity.opportunity.name)
  );
  
  return relevantMarketplaces.map(marketplace => ({
    platform: marketplace,
    listing: generateMarketplaceListing(opportunity, marketplace),
    pricing: generateMarketplacePricing(opportunity, marketplace),
    optimization: generateMarketplaceOptimization(marketplace)
  }));
}

async function createDirectoryListings(opportunity, website) {
  const directories = [
    'google_business',
    'yelp',
    'industry_specific_directories'
  ];
  
  return directories.map(directory => ({
    platform: directory,
    listing: generateDirectoryListing(opportunity, website, directory),
    verification_steps: getDirectoryVerificationSteps(directory)
  }));
}

async function createEmailSequences(opportunity) {
  const sequences = {
    welcome: generateWelcomeSequence(opportunity),
    nurture: generateNurtureSequence(opportunity),
    sales: generateSalesSequence(opportunity),
    retention: generateRetentionSequence(opportunity)
  };
  
  return sequences;
}

async function createContentCalendar(opportunity) {
  const contentTypes = ['blog_posts', 'social_media', 'email_newsletters', 'videos'];
  const calendar = {};
  
  for (const type of contentTypes) {
    calendar[type] = generateContentPlan(opportunity, type);
  }
  
  return calendar;
}

async function setupPrimaryChannel(channel, opportunity, presence) {
  const channelSetups = {
    'email': setupEmailMarketing(opportunity, presence),
    'social_media': setupSocialMediaMarketing(opportunity, presence),
    'content_marketing': setupContentMarketing(opportunity, presence),
    'paid_advertising': setupPaidAdvertising(opportunity, presence),
    'partnerships': setupPartnershipMarketing(opportunity, presence)
  };
  
  return channelSetups[channel] || channelSetups['email'];
}

async function setupSecondaryChannel(channel, opportunity, presence) {
  // Similar to primary but with different priorities
  return await setupPrimaryChannel(channel, opportunity, presence);
}

async function createOutreachTemplates(opportunity) {
  const templates = {};
  const channels = ['email', 'linkedin', 'phone', 'in_person'];
  
  for (const channel of channels) {
    templates[channel] = {
      initial_contact: generateInitialContactTemplate(opportunity, channel),
      follow_up_1: generateFollowUpTemplate(opportunity, channel, 1),
      follow_up_2: generateFollowUpTemplate(opportunity, channel, 2),
      closing: generateClosingTemplate(opportunity, channel)
    };
  }
  
  return templates;
}

function generateLaunchPlan(opportunity, presence) {
  return {
    day1: [
      'Set up tracking for all channels',
      'Send first 10 outreach messages',
      'Post initial content on social media',
      'Set up email automation'
    ],
    week1: [
      'Scale outreach to 50 prospects',
      'Launch content marketing campaign',
      'Set up marketplace listings',
      'Begin partnership outreach'
    ],
    month1: [
      'Optimize based on initial results',
      'Scale successful channels',
      'Launch paid advertising if organic is working',
      'Build referral program'
    ],
    goals: {
      week1: 'First customer conversation',
      week2: 'First paying customer',
      month1: `$${opportunity.revenueProjection?.month1 || 500} revenue`,
      month3: `$${opportunity.revenueProjection?.month3 || 2000} revenue`
    }
  };
}

// Utility functions (simplified for brevity)
function generateSocialProof(opportunity) {
  return {
    testimonials: 'Will be collected from first customers',
    statistics: `${opportunity.confidence.percentage}% success rate predicted`,
    certifications: 'Industry-relevant credentials'
  };
}

function generateUrgencyElements(opportunity) {
  return {
    limited_time_offer: 'First 10 customers get special pricing',
    scarcity: 'Limited availability for personalized service',
    bonus: 'Early customer bonuses and extra support'
  };
}

function generateRiskReversalElements(opportunity) {
  return {
    guarantee: '30-day money-back guarantee',
    trial: 'Free consultation or trial period',
    testimonials: 'Social proof from similar customers'
  };
}

function generateValueStack(opportunity) {
  const products = opportunity.opportunity.products || [];
  return products.map(product => ({
    item: product.name,
    value: product.price,
    description: product.description
  }));
}

function generateLeadMagnets(opportunity) {
  return [
    'Free consultation or strategy session',
    'Industry-specific guide or checklist',
    'Template or tool relevant to target customers'
  ];
}

function generateUsername(businessName, channel) {
  const cleanName = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${cleanName}${channel === 'instagram' ? 'official' : 'co'}`;
}

function generateSocialBio(opportunity, channel) {
  return `${opportunity.opportunity.description} | Helping ${opportunity.opportunity.targetCustomers?.[0]} | DM for consultation`;
}

function generateSocialContentPlan(opportunity, channel) {
  return {
    content_types: ['educational', 'behind_the_scenes', 'customer_success', 'tips'],
    posting_frequency: channel === 'instagram' ? 'daily' : '3x_week',
    content_pillars: ['expertise', 'results', 'personality', 'value']
  };
}

function generatePostingSchedule(channel) {
  const schedules = {
    instagram: ['9am', '1pm', '6pm'],
    linkedin: ['8am', '12pm', '5pm'],
    facebook: ['9am', '3pm', '7pm'],
    twitter: ['10am', '2pm', '8pm']
  };
  return schedules[channel] || schedules.instagram;
}

function isMarketplaceRelevant(marketplace, opportunityName) {
  const relevanceMap = {
    fiverr: ['service', 'freelance', 'creative', 'consulting'],
    upwork: ['consulting', 'professional', 'service'],
    etsy: ['creative', 'handmade', 'digital', 'art'],
    amazon: ['product', 'physical', 'book', 'course'],
    shopify: ['ecommerce', 'product', 'retail']
  };
  
  const keywords = relevanceMap[marketplace] || [];
  return keywords.some(keyword => 
    opportunityName.toLowerCase().includes(keyword)
  );
}

function generateMarketplaceListing(opportunity, marketplace) {
  return {
    title: `${opportunity.opportunity.name} - ${opportunity.opportunity.description}`,
    description: `Professional ${opportunity.opportunity.name} service for ${opportunity.opportunity.targetCustomers?.join(', ')}`,
    pricing: opportunity.opportunity.products?.[0]?.price || '$97',
    tags: generateMarketplaceTags(opportunity, marketplace),
    images: 'Professional service images needed'
  };
}

function generateMarketplaceTags(opportunity, marketplace) {
  return [
    opportunity.opportunity.name?.toLowerCase(),
    ...(opportunity.opportunity.targetCustomers || []).map(c => c.toLowerCase()),
    'professional',
    'quality',
    'results'
  ].filter(Boolean);
}

// Export all functions
export {
  createBusinessPresence,
  setupCustomerAcquisition,
  createInitialCampaigns,
  setupBusinessTracking,
  generateInitialOutreach
};
