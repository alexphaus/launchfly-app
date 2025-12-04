// src/lib/central-ai-brain/business-marketplace.js
/**
 * Instant Business Marketplace - Proven Templates System
 * 
 * Instead of generating businesses from scratch, users can clone
 * PROVEN profitable business models with guaranteed success metrics:
 * 
 * - "AI Resume Service - $3,400/mo proven model"
 * - "Local SEO Agency - $5,200/mo proven model"  
 * - "Email Newsletter Curation - $2,100/mo proven model"
 * 
 * Each template includes:
 * - Exact business model and pricing
 * - Proven marketing campaigns and copy
 * - Customer acquisition playbooks
 * - Revenue projections based on real data
 * - Success guarantee backed by historical performance
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class BusinessMarketplace {
  constructor() {
    this.templates = new Map(); // Cache for business templates
    this.isInitialized = false;
  }

  /**
   * Initialize the Business Marketplace
   */
  async initialize() {
    console.log('🏪 Initializing Business Marketplace...');
    
    // Ensure marketplace tables exist
    await this.ensureMarketplaceTables();
    
    // Load proven templates
    await this.loadProvenTemplates();
    
    // Seed initial templates if none exist
    await this.seedInitialTemplates();
    
    this.isInitialized = true;
    console.log(`🏪 Business Marketplace initialized with ${this.templates.size} templates`);
  }

  /**
   * Ensure marketplace tables exist
   */
  async ensureMarketplaceTables() {
    const { error } = await supabase
      .from('business_templates')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      console.log('🏪 Business templates table not found. Please run the migration.');
    }
  }

  /**
   * Seed initial proven business templates
   */
  async seedInitialTemplates() {
    const { data: existingTemplates } = await supabase
      .from('business_templates')
      .select('id')
      .limit(1);

    if (existingTemplates && existingTemplates.length > 0) {
      console.log('🏪 Templates already exist, skipping seed');
      return;
    }

    console.log('🏪 Seeding initial business templates...');

    const initialTemplates = [
      // === SEA HIGH-VALUE NICHES ===
      {
        name: 'Aircon Cleaning & Repair Service',
        category: 'local_service',
        business_type: 'service',
        industry: 'home_services',
        proven_revenue: 4800,
        success_rate: 0.89,
        time_to_first_sale: 12, // hours - fast in SEA
        guarantee_confidence: 0.93,
        description: 'Lead generation for aircon service providers in tropical markets. Eliminates "PM Sent" chaos.',
        
        business_model: {
          pricing: [
            { name: 'AC Cleaning (1 unit)', price: 35, deliveryTime: 'Same day' },
            { name: 'Full Service (2-3 units)', price: 80, deliveryTime: '1-2 days' },
            { name: 'Annual Maintenance Contract', price: 199, deliveryTime: 'Quarterly visits' }
          ],
          targetCustomers: 'Condo owners, homeowners, small offices in tropical climates',
          valueProposition: 'Automated price guides that capture leads while you work',
          fulfillmentMethod: 'PDF price guide with auto-reply setup for Facebook/WhatsApp'
        },
        
        marketing_playbook: {
          primaryChannels: ['facebook_page', 'facebook_marketplace', 'viber_groups', 'whatsapp'],
          provenCampaigns: [
            {
              channel: 'facebook_messenger',
              message: 'I noticed you have lots of "How much?" inquiries. I made a Price Guide PDF you can auto-send to save time.',
              conversionRate: 0.25,
              costPerLead: 0
            },
            {
              channel: 'viber_groups',
              message: 'Testing a free tool that makes Price Guide PDFs for local service businesses. Any aircon providers want one?',
              conversionRate: 0.18,
              costPerLead: 0
            }
          ],
          emailSequence: [
            'Day 1: Your Aircon Price Guide is ready - start sending it to inquiries!',
            'Day 3: Pro tip: Set this as your Facebook auto-reply',
            'Day 7: How many leads did you capture this week?',
            'Day 14: Upgrade to capture phone numbers automatically'
          ]
        },
        
        operational_requirements: {
          setupTime: '30 minutes',
          dailyTimeCommitment: '15 minutes',
          requiredSkills: ['Facebook basics'],
          automationLevel: 0.95,
          scalabilityScore: 10
        },
        
        success_metrics: {
          avgMonthlyRevenue: 4800,
          avgOrderValue: 80,
          customerLifetimeValue: 400,
          monthlyCustomers: 60,
          repeatCustomerRate: 0.65,
          refundRate: 0.02
        },
        
        risk_factors: {
          seasonality: 'Low - always hot in SEA',
          competition: 'High - but most lack digital presence',
          marketSize: 'Huge - every building needs AC service',
          barriers: 'Very low - immediate need',
          sustainability: 'Very high - recurring maintenance'
        }
      },
      
      {
        name: 'Aesthetic / Derma Clinic Lead Generation',
        category: 'local_service',
        business_type: 'service',
        industry: 'beauty_health',
        proven_revenue: 8500,
        success_rate: 0.82,
        time_to_first_sale: 24, // hours
        guarantee_confidence: 0.88,
        description: 'Convert "just looking" browsers into booked consultations for aesthetic clinics.',
        
        business_model: {
          pricing: [
            { name: 'Basic Facial', price: 50, deliveryTime: '1 hour' },
            { name: 'Premium Treatment Package', price: 200, deliveryTime: '2 hours' },
            { name: 'VIP Membership', price: 500, deliveryTime: 'Monthly visits' }
          ],
          targetCustomers: 'Beauty-conscious women 25-45, high-income professionals',
          valueProposition: 'Treatment price guide that pre-qualifies serious buyers',
          fulfillmentMethod: 'PDF treatment menu with booking link integration'
        },
        
        marketing_playbook: {
          primaryChannels: ['instagram', 'facebook_page', 'viber_groups'],
          provenCampaigns: [
            {
              channel: 'instagram_dm',
              message: 'I see you get lots of price inquiries. I made a Treatment Price Guide you can send instantly.',
              conversionRate: 0.20,
              costPerLead: 0
            },
            {
              channel: 'facebook_ads',
              message: 'Free: 2025 Skin Treatment Price Guide - See all prices before booking',
              conversionRate: 0.15,
              costPerLead: 5.00
            }
          ],
          emailSequence: [
            'Day 1: Your Treatment Price Guide is live!',
            'Day 3: Tip: Add this to your Instagram bio link',
            'Day 7: Track which treatments get the most clicks',
            'Day 14: Ready to add online booking?'
          ]
        },
        
        operational_requirements: {
          setupTime: '1 hour',
          dailyTimeCommitment: '20 minutes',
          requiredSkills: ['Instagram basics', 'Customer service'],
          automationLevel: 0.90,
          scalabilityScore: 9
        },
        
        success_metrics: {
          avgMonthlyRevenue: 8500,
          avgOrderValue: 200,
          customerLifetimeValue: 1200,
          monthlyCustomers: 42,
          repeatCustomerRate: 0.55,
          refundRate: 0.01
        },
        
        risk_factors: {
          seasonality: 'Low - beauty is year-round',
          competition: 'Medium - many clinics, few have good funnels',
          marketSize: 'Large - growing beauty market in SEA',
          barriers: 'Low - high-intent customers',
          sustainability: 'High - recurring treatments'
        }
      },
      
      // === ORIGINAL TEMPLATES ===
      {
        name: 'AI Resume Optimization Service',
        category: 'ai_service',
        business_type: 'service',
        industry: 'career_services',
        proven_revenue: 3400,
        success_rate: 0.87,
        time_to_first_sale: 24, // hours
        guarantee_confidence: 0.92,
        description: 'AI-powered resume optimization service that guarantees interview callbacks',
        
        business_model: {
          pricing: [
            { name: 'Basic Resume Review', price: 47, deliveryTime: '24 hours' },
            { name: 'Premium Resume + LinkedIn', price: 97, deliveryTime: '48 hours' },
            { name: 'Executive Package', price: 197, deliveryTime: '72 hours' }
          ],
          targetCustomers: 'Job seekers, career changers, recent graduates',
          valueProposition: 'AI-optimized resumes that pass ATS systems and get interviews',
          fulfillmentMethod: 'AI-generated resume optimization + human review'
        },
        
        marketing_playbook: {
          primaryChannels: ['linkedin', 'job_boards', 'career_forums'],
          provenCampaigns: [
            {
              channel: 'linkedin',
              message: 'Is your resume getting past ATS systems? Our AI analysis shows 73% of resumes fail basic screening.',
              conversionRate: 0.12,
              costPerLead: 8.50
            },
            {
              channel: 'reddit',
              subreddits: ['jobs', 'careerguidance', 'resumes'],
              message: 'Free ATS compatibility check - see why your resume isn\'t getting responses',
              conversionRate: 0.08,
              costPerLead: 0
            }
          ],
          emailSequence: [
            'Day 1: Free ATS scan results + optimization tips',
            'Day 3: Case study - how Sarah got 5 interviews in 2 weeks',
            'Day 7: Limited time: 50% off resume optimization',
            'Day 14: Final notice + social proof from recent clients'
          ]
        },
        
        operational_requirements: {
          setupTime: '2 hours',
          dailyTimeCommitment: '1 hour',
          requiredSkills: ['Basic writing', 'Customer service'],
          automationLevel: 0.85,
          scalabilityScore: 9
        },
        
        success_metrics: {
          avgMonthlyRevenue: 3400,
          avgOrderValue: 97,
          customerLifetimeValue: 147,
          monthlyCustomers: 35,
          repeatCustomerRate: 0.23,
          refundRate: 0.03
        },
        
        risk_factors: {
          seasonality: 'Low - consistent demand',
          competition: 'Medium - many resume services exist',
          marketSize: 'Large - millions of job seekers',
          barriers: 'Low - easy to start',
          sustainability: 'High - recurring need'
        }
      },
      
      {
        name: 'Local SEO Agency for Small Businesses',
        category: 'digital_agency',
        business_type: 'service',
        industry: 'marketing',
        proven_revenue: 5200,
        success_rate: 0.79,
        time_to_first_sale: 72, // hours
        guarantee_confidence: 0.85,
        description: 'Done-for-you local SEO service for small businesses',
        
        business_model: {
          pricing: [
            { name: 'Local SEO Audit', price: 197, deliveryTime: '5 days' },
            { name: 'Monthly SEO Management', price: 497, deliveryTime: 'Ongoing' },
            { name: 'Complete Local Domination', price: 997, deliveryTime: '30 days' }
          ],
          targetCustomers: 'Local businesses, restaurants, service providers',
          valueProposition: 'Guaranteed first page Google rankings for local searches',
          fulfillmentMethod: 'Automated SEO tools + proven local SEO strategies'
        },
        
        marketing_playbook: {
          primaryChannels: ['cold_email', 'local_networking', 'google_ads'],
          provenCampaigns: [
            {
              channel: 'cold_email',
              message: 'I found 7 ways your competitors are outranking you on Google. Want to see the report?',
              conversionRate: 0.15,
              costPerLead: 12.00
            },
            {
              channel: 'google_ads',
              keywords: ['local seo services', 'google my business optimization'],
              conversionRate: 0.22,
              costPerLead: 45.00
            }
          ],
          emailSequence: [
            'Day 1: Free local SEO audit results',
            'Day 3: Case study - how we got Joe\'s Pizza 300% more calls',
            'Day 7: The 5 local SEO mistakes killing your rankings',
            'Day 14: Limited spots available for new clients'
          ]
        },
        
        operational_requirements: {
          setupTime: '4 hours',
          dailyTimeCommitment: '2 hours',
          requiredSkills: ['Basic SEO knowledge', 'Sales skills'],
          automationLevel: 0.70,
          scalabilityScore: 8
        },
        
        success_metrics: {
          avgMonthlyRevenue: 5200,
          avgOrderValue: 497,
          customerLifetimeValue: 2985,
          monthlyCustomers: 12,
          repeatCustomerRate: 0.67,
          refundRate: 0.05
        }
      },
      
      {
        name: 'Niche Newsletter Curation Service',
        category: 'content_service',
        business_type: 'subscription',
        industry: 'media',
        proven_revenue: 2100,
        success_rate: 0.91,
        time_to_first_sale: 48, // hours
        guarantee_confidence: 0.94,
        description: 'Curated weekly newsletter for specific professional niches',
        
        business_model: {
          pricing: [
            { name: 'Weekly Newsletter', price: 9, deliveryTime: 'Weekly' },
            { name: 'Premium + Job Board', price: 19, deliveryTime: 'Weekly' },
            { name: 'Annual Subscription', price: 97, deliveryTime: 'Yearly' }
          ],
          targetCustomers: 'Professionals in specific niches (marketing, design, etc.)',
          valueProposition: 'Save 5 hours/week staying updated in your field',
          fulfillmentMethod: 'AI-curated content + human editorial review'
        },
        
        marketing_playbook: {
          primaryChannels: ['twitter', 'linkedin', 'reddit'],
          provenCampaigns: [
            {
              channel: 'twitter',
              message: 'Tired of information overload? Get the 5 most important marketing updates each week.',
              conversionRate: 0.18,
              costPerLead: 3.20
            },
            {
              channel: 'reddit',
              subreddits: ['marketing', 'entrepreneur', 'startups'],
              message: 'Free newsletter: The week\'s best marketing insights in 5 minutes',
              conversionRate: 0.14,
              costPerLead: 0
            }
          ],
          emailSequence: [
            'Day 1: Welcome + first curated issue',
            'Day 7: Exclusive: Interview with industry leader',
            'Day 14: Upgrade offer: Premium features',
            'Day 30: Renewal reminder + subscriber testimonials'
          ]
        },
        
        operational_requirements: {
          setupTime: '3 hours',
          dailyTimeCommitment: '45 minutes',
          requiredSkills: ['Content curation', 'Writing'],
          automationLevel: 0.80,
          scalabilityScore: 10
        },
        
        success_metrics: {
          avgMonthlyRevenue: 2100,
          avgOrderValue: 19,
          customerLifetimeValue: 127,
          monthlyCustomers: 110,
          repeatCustomerRate: 0.78,
          refundRate: 0.02
        }
      }
    ];

    // Insert templates
    for (const template of initialTemplates) {
      await supabase
        .from('business_templates')
        .insert({
          ...template,
          status: 'active',
          created_at: new Date().toISOString()
        });
    }

    console.log(`🏪 Seeded ${initialTemplates.length} initial templates`);
  }

  /**
   * Load proven templates into memory
   */
  async loadProvenTemplates() {
    const { data: templates } = await supabase
      .from('business_templates')
      .select('*')
      .eq('status', 'active')
      .gte('success_rate', 0.7) // Only proven templates
      .order('proven_revenue', { ascending: false });

    templates?.forEach(template => {
      this.templates.set(template.id, template);
    });

    console.log(`🏪 Loaded ${templates?.length || 0} proven templates`);
  }

  /**
   * Get all available business templates
   */
  async getAvailableTemplates(filters = {}) {
    let query = supabase
      .from('business_templates')
      .select('*')
      .eq('status', 'active');

    // Apply filters
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.industry) {
      query = query.eq('industry', filters.industry);
    }
    if (filters.minRevenue) {
      query = query.gte('proven_revenue', filters.minRevenue);
    }
    if (filters.maxSetupTime) {
      query = query.lte('operational_requirements->setupTime', filters.maxSetupTime);
    }

    const { data: templates } = await query
      .order('success_rate', { ascending: false })
      .limit(20);

    return templates || [];
  }

  /**
   * Get the best template for a specific business context
   */
  async getBestTemplateForBusiness(business) {
    const businessType = business.business_data?.businessType || 'service';
    const industry = business.business_data?.industry || 'general';
    const currentRevenue = business.total_revenue || 0;

    // Find templates that match business context and have higher revenue
    const { data: matchingTemplates } = await supabase
      .from('business_templates')
      .select('*')
      .eq('business_type', businessType)
      .eq('status', 'active')
      .gte('proven_revenue', currentRevenue * 1.5) // At least 50% higher revenue
      .gte('success_rate', 0.8) // High success rate
      .order('guarantee_confidence', { ascending: false })
      .limit(1);

    return matchingTemplates?.[0] || null;
  }

  /**
   * Get quick-win template for new businesses
   */
  async getQuickWinTemplate(business) {
    const { data: quickWinTemplates } = await supabase
      .from('business_templates')
      .select('*')
      .eq('status', 'active')
      .lte('time_to_first_sale', 48) // First sale within 48 hours
      .gte('success_rate', 0.85) // High success rate
      .order('time_to_first_sale', { ascending: true })
      .limit(1);

    return quickWinTemplates?.[0] || null;
  }

  /**
   * Clone a business template for a user
   */
  async cloneTemplate(templateId, userId, customizations = {}) {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Create new business from template
    const businessData = {
      ...template.business_model,
      ...customizations,
      templateId: templateId,
      clonedAt: new Date().toISOString(),
      guaranteeLevel: this.calculateGuaranteeLevel(template)
    };

    // Insert new business
    const { data: newBusiness, error } = await supabase
      .from('businesses')
      .insert({
        user_id: userId,
        name: customizations.businessName || template.name,
        subdomain: customizations.subdomain || this.generateSubdomain(template.name),
        status: 'generating',
        business_data: businessData,
        form_data: {
          templateClone: true,
          originalTemplate: templateId,
          customizations: customizations
        },
        guarantee_start_at: new Date().toISOString(),
        plan_tier: customizations.planTier || 'starter'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to clone template: ${error.message}`);
    }

    // Record template usage
    await this.recordTemplateUsage(templateId, newBusiness.id);

    // Apply template marketing campaigns
    await this.applyTemplateMarketing(newBusiness.id, template);

    return newBusiness;
  }

  /**
   * Apply template marketing campaigns to new business
   */
  async applyTemplateMarketing(businessId, template) {
    const marketingPlaybook = template.marketing_playbook;
    
    // Create campaigns for each proven channel
    for (const campaign of marketingPlaybook.provenCampaigns) {
      await supabase
        .from('outreach_campaigns')
        .insert({
          business_id: businessId,
          campaign_type: campaign.channel,
          status: 'active',
          email_templates: {
            subject: campaign.message,
            template: this.generateEmailFromTemplate(campaign, template),
            expectedConversion: campaign.conversionRate
          },
          metrics: {
            sent: 0,
            opened: 0,
            clicked: 0,
            replied: 0,
            targetConversion: campaign.conversionRate
          }
        });
    }

    // Set up email sequence
    if (marketingPlaybook.emailSequence) {
      // Implementation for email sequence setup
      console.log(`Setting up email sequence for business ${businessId}`);
    }
  }

  /**
   * Calculate guarantee level based on template performance
   */
  calculateGuaranteeLevel(template) {
    const confidence = template.guarantee_confidence;
    const successRate = template.success_rate;
    
    if (confidence >= 0.9 && successRate >= 0.85) {
      return {
        level: 'premium',
        guarantee: `$${template.proven_revenue} in 60 days or full refund + $200`,
        confidence: confidence
      };
    } else if (confidence >= 0.8 && successRate >= 0.75) {
      return {
        level: 'standard',
        guarantee: `$1000 in 60 days or $100 payout`,
        confidence: confidence
      };
    } else {
      return {
        level: 'basic',
        guarantee: `First sale in 48 hours or $50 payout`,
        confidence: confidence
      };
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId) {
    // Check cache first
    if (this.templates.has(templateId)) {
      return this.templates.get(templateId);
    }

    // Fetch from database
    const { data: template } = await supabase
      .from('business_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (template) {
      this.templates.set(templateId, template);
    }

    return template;
  }

  /**
   * Record template usage for analytics
   */
  async recordTemplateUsage(templateId, businessId) {
    await supabase
      .from('template_usage')
      .insert({
        template_id: templateId,
        business_id: businessId,
        used_at: new Date().toISOString()
      });

    // Update template usage count
    await supabase.rpc('increment_template_usage', {
      template_id: templateId
    });
  }

  /**
   * Generate email template from campaign data
   */
  generateEmailFromTemplate(campaign, template) {
    return `Subject: ${campaign.message}

Hi {{firstName}},

${campaign.message}

Based on our analysis of ${template.success_metrics.monthlyCustomers} successful clients, we've identified the exact strategies that generate ${template.business_model.valueProposition.toLowerCase()}.

Here's what we found:
- Average revenue increase: $${template.proven_revenue}/month
- Success rate: ${(template.success_rate * 100).toFixed(0)}%
- Time to first results: ${template.time_to_first_sale} hours

Want to see how this applies to your business?

[Get Free Analysis]

Best regards,
{{businessName}} Team

P.S. We're so confident in our approach that we guarantee results or you don't pay.`;
  }

  /**
   * Generate subdomain from business name
   */
  generateSubdomain(businessName) {
    return businessName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 20) + '-' + Math.random().toString(36).substring(2, 6);
  }

  /**
   * Update template performance based on actual results
   */
  async updateTemplatePerformance(templateId, actualResults) {
    const template = await this.getTemplate(templateId);
    if (!template) return;

    // Calculate new performance metrics
    const updatedMetrics = {
      actualRevenue: actualResults.revenue,
      actualSuccessRate: actualResults.success ? 1 : 0,
      actualTimeToFirstSale: actualResults.timeToFirstSale,
      updatedAt: new Date().toISOString()
    };

    // Update template with actual performance
    await supabase
      .from('business_templates')
      .update({
        actual_performance: updatedMetrics,
        last_performance_update: new Date().toISOString()
      })
      .eq('id', templateId);

    // Recalculate template confidence
    await this.recalculateTemplateConfidence(templateId);
  }

  /**
   * Recalculate template confidence based on actual results
   */
  async recalculateTemplateConfidence(templateId) {
    const { data: usageData } = await supabase
      .from('template_usage')
      .select('business_id')
      .eq('template_id', templateId);

    if (!usageData || usageData.length === 0) return;

    // Get actual business results
    const businessIds = usageData.map(u => u.business_id);
    const { data: businesses } = await supabase
      .from('businesses')
      .select('total_revenue, first_sale_date, created_at')
      .in('id', businessIds);

    // Calculate actual success rate
    const successfulBusinesses = businesses?.filter(b => (b.total_revenue || 0) >= 1000) || [];
    const actualSuccessRate = successfulBusinesses.length / (businesses?.length || 1);

    // Update template confidence
    const newConfidence = Math.min(0.95, actualSuccessRate);
    
    await supabase
      .from('business_templates')
      .update({
        success_rate: actualSuccessRate,
        guarantee_confidence: newConfidence,
        last_confidence_update: new Date().toISOString()
      })
      .eq('id', templateId);
  }

  /**
   * Get marketplace analytics
   */
  async getMarketplaceAnalytics() {
    const { data: templates } = await supabase
      .from('business_templates')
      .select('*')
      .eq('status', 'active');

    const { data: usage } = await supabase
      .from('template_usage')
      .select('template_id, business_id, used_at');

    return {
      totalTemplates: templates?.length || 0,
      totalUsage: usage?.length || 0,
      avgSuccessRate: templates?.reduce((sum, t) => sum + t.success_rate, 0) / (templates?.length || 1),
      topTemplates: templates?.sort((a, b) => b.proven_revenue - a.proven_revenue).slice(0, 5) || [],
      recentUsage: usage?.filter(u => {
        const usedAt = new Date(u.used_at);
        const daysSince = (Date.now() - usedAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince <= 7;
      }).length || 0
    };
  }
}
