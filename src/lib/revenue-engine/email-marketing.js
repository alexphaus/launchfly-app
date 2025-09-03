/**
 * Email Marketing Engine
 * Automated email campaigns for revenue generation
 */

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class EmailMarketing {
  constructor() {
    this.campaigns = new Map();
    this.sequences = new Map();
  }

  /**
   * Launch email marketing campaigns for a business
   */
  async launchCampaigns(business, template) {
    console.log(`📧 Launching email campaigns for business ${business.id}`);
    
    const campaigns = [];
    
    // Welcome series for new subscribers
    campaigns.push(await this.createWelcomeSeries(business, template));
    
    // Abandoned cart recovery
    if (template.products || template.services) {
      campaigns.push(await this.createAbandonedCartCampaign(business));
    }
    
    // Product launch campaign
    campaigns.push(await this.createProductLaunchCampaign(business, template));
    
    // Re-engagement campaign
    campaigns.push(await this.createReEngagementCampaign(business));
    
    // Upsell/Cross-sell campaign
    campaigns.push(await this.createUpsellCampaign(business, template));
    
    // Store campaigns
    for (const campaign of campaigns) {
      await supabase
        .from('email_campaigns')
        .insert({
          business_id: business.id,
          ...campaign,
          created_at: new Date().toISOString()
        });
    }
    
    this.campaigns.set(business.id, campaigns);
    
    return {
      launched: true,
      campaignCount: campaigns.length
    };
  }

  /**
   * Create welcome series
   */
  async createWelcomeSeries(business, template) {
    const emails = [
      {
        day: 0,
        subject: `Welcome to ${business.name}! Here's your special gift 🎁`,
        preheader: 'Plus 20% off your first purchase',
        template: 'welcome_gift',
        content: await this.generateWelcomeEmail(business, template, 1)
      },
      {
        day: 2,
        subject: 'Our story (and why you'll love what we do)',
        preheader: 'Get to know us better',
        template: 'brand_story',
        content: await this.generateBrandStoryEmail(business, template)
      },
      {
        day: 4,
        subject: '5 ways to get the most from your purchase',
        preheader: 'Pro tips inside',
        template: 'value_tips',
        content: await this.generateValueEmail(business, template)
      },
      {
        day: 7,
        subject: 'Your exclusive 20% discount expires soon ⏰',
        preheader: 'Only 24 hours left',
        template: 'urgency_offer',
        content: await this.generateUrgencyEmail(business, template)
      }
    ];
    
    return {
      name: 'Welcome Series',
      type: 'automated',
      trigger: 'subscription',
      status: 'active',
      emails: emails,
      metrics: {
        expected_open_rate: 0.45,
        expected_click_rate: 0.12,
        expected_conversion_rate: 0.08
      }
    };
  }

  /**
   * Create abandoned cart campaign
   */
  async createAbandonedCartCampaign(business) {
    const emails = [
      {
        hour: 1,
        subject: 'You left something behind...',
        preheader: 'Complete your order in one click',
        template: 'cart_reminder',
        discount: 0
      },
      {
        hour: 24,
        subject: 'Still thinking it over? Here's 10% off',
        preheader: 'Limited time discount',
        template: 'cart_discount',
        discount: 10
      },
      {
        hour: 72,
        subject: 'Last chance! Your cart expires soon',
        preheader: 'Plus 15% off - our best offer',
        template: 'cart_final',
        discount: 15
      }
    ];
    
    return {
      name: 'Abandoned Cart Recovery',
      type: 'triggered',
      trigger: 'cart_abandoned',
      status: 'active',
      emails: emails,
      metrics: {
        expected_recovery_rate: 0.18,
        expected_revenue_per_email: 45
      }
    };
  }

  /**
   * Create product launch campaign
   */
  async createProductLaunchCampaign(business, template) {
    const emails = [
      {
        day: -7,
        subject: 'Something exciting is coming...',
        preheader: 'Be the first to know',
        template: 'launch_teaser'
      },
      {
        day: -3,
        subject: 'Sneak peek inside 👀',
        preheader: 'Early bird access starts soon',
        template: 'launch_preview'
      },
      {
        day: 0,
        subject: '🚀 IT\'S HERE! Plus your exclusive discount',
        preheader: '30% off for the next 48 hours',
        template: 'launch_announcement'
      },
      {
        day: 2,
        subject: 'Only 24 hours left for 30% off',
        preheader: 'Don\'t miss out',
        template: 'launch_urgency'
      }
    ];
    
    return {
      name: 'Product Launch',
      type: 'broadcast',
      trigger: 'manual',
      status: 'scheduled',
      emails: emails,
      metrics: {
        expected_open_rate: 0.35,
        expected_conversion_rate: 0.12
      }
    };
  }

  /**
   * Create re-engagement campaign
   */
  async createReEngagementCampaign(business) {
    const emails = [
      {
        subject: 'We miss you! Here\'s 25% off to come back',
        preheader: 'Exclusive offer just for you',
        template: 'win_back',
        segment: 'inactive_30_days'
      },
      {
        subject: 'New arrivals you\'ll love',
        preheader: 'Hand-picked for you',
        template: 'personalized_products',
        segment: 'inactive_60_days'
      },
      {
        subject: 'Last chance to stay subscribed',
        preheader: 'We\'d hate to see you go',
        template: 'resubscribe',
        segment: 'inactive_90_days'
      }
    ];
    
    return {
      name: 'Re-engagement',
      type: 'automated',
      trigger: 'inactivity',
      status: 'active',
      emails: emails,
      metrics: {
        expected_reactivation_rate: 0.22
      }
    };
  }

  /**
   * Create upsell campaign
   */
  async createUpsellCampaign(business, template) {
    const emails = [
      {
        day: 3,
        subject: 'Customers who bought this also love...',
        preheader: 'Complete your collection',
        template: 'cross_sell',
        trigger: 'post_purchase'
      },
      {
        day: 14,
        subject: 'Unlock VIP status with your next purchase',
        preheader: 'Exclusive benefits await',
        template: 'loyalty_upsell',
        trigger: 'post_purchase'
      },
      {
        day: 30,
        subject: 'Upgrade to our premium plan and save 40%',
        preheader: 'Limited time offer',
        template: 'plan_upgrade',
        trigger: 'post_purchase'
      }
    ];
    
    return {
      name: 'Upsell & Cross-sell',
      type: 'automated',
      trigger: 'purchase',
      status: 'active',
      emails: emails,
      metrics: {
        expected_upsell_rate: 0.15,
        expected_aov_increase: 35
      }
    };
  }

  /**
   * Generate email content using AI
   */
  async generateWelcomeEmail(business, template, emailNumber) {
    const prompt = `Create a welcome email for ${business.name}, a ${template.category} business.
    
    Email #${emailNumber} in welcome series.
    
    Include:
    - Warm, friendly greeting
    - Value proposition
    - 20% discount code: WELCOME20
    - 3 popular products/services
    - Clear CTA
    
    Tone: Friendly, enthusiastic, helpful
    Length: 150-200 words`;
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: 'You are an expert email copywriter.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Email generation failed:', error);
      return this.getDefaultWelcomeEmail(business);
    }
  }

  /**
   * Generate brand story email
   */
  async generateBrandStoryEmail(business, template) {
    const prompt = `Create a brand story email for ${business.name}.
    
    Include:
    - Founder story or mission
    - What makes us different
    - Customer success story
    - Soft CTA to browse products
    
    Tone: Authentic, inspiring
    Length: 200-250 words`;
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: 'You are an expert brand storyteller.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      return this.getDefaultBrandStory(business);
    }
  }

  /**
   * Generate value email
   */
  async generateValueEmail(business, template) {
    const prompt = `Create a value-focused email for ${business.name}.
    
    Include:
    - 5 tips for getting maximum value
    - Customer testimonial
    - Featured product with benefits
    - CTA to shop
    
    Tone: Helpful, educational
    Length: 200-250 words`;
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: 'You are an expert at creating valuable content.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      return this.getDefaultValueEmail(business);
    }
  }

  /**
   * Generate urgency email
   */
  async generateUrgencyEmail(business, template) {
    const prompt = `Create an urgency-driven email for ${business.name}.
    
    Include:
    - Discount expiring in 24 hours
    - Scarcity element
    - Social proof
    - Strong CTA
    - Countdown timer placeholder
    
    Tone: Urgent but not pushy
    Length: 100-150 words`;
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: 'You are an expert at creating urgency without being pushy.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      return this.getDefaultUrgencyEmail(business);
    }
  }

  /**
   * Send campaign email
   */
  async sendCampaignEmail(campaign, email, recipients) {
    console.log(`📤 Sending ${campaign.name} - ${email.subject} to ${recipients.length} recipients`);
    
    // Batch send to recipients
    const batchSize = 100;
    const batches = [];
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      const emails = batch.map(recipient => ({
        from: 'marketing@launchfly.com',
        to: recipient.email,
        subject: this.personalizeSubject(email.subject, recipient),
        html: this.personalizeContent(email.content, recipient),
        tags: {
          campaign: campaign.name,
          business_id: campaign.business_id
        }
      }));
      
      try {
        await resend.batch.send(emails);
        
        // Track sends
        await this.trackEmailSends(campaign, email, batch);
      } catch (error) {
        console.error('Batch send failed:', error);
      }
    }
  }

  /**
   * Personalize email subject
   */
  personalizeSubject(subject, recipient) {
    return subject
      .replace('{{first_name}}', recipient.first_name || 'Friend')
      .replace('{{company}}', recipient.company || '')
      .replace('{{location}}', recipient.location || '');
  }

  /**
   * Personalize email content
   */
  personalizeContent(content, recipient) {
    return content
      .replace(/\{\{first_name\}\}/g, recipient.first_name || 'Friend')
      .replace(/\{\{email\}\}/g, recipient.email)
      .replace(/\{\{company\}\}/g, recipient.company || 'your company')
      .replace(/\{\{recent_purchase\}\}/g, recipient.recent_purchase || 'your recent purchase')
      .replace(/\{\{recommended_products\}\}/g, this.getRecommendedProducts(recipient));
  }

  /**
   * Get recommended products for recipient
   */
  getRecommendedProducts(recipient) {
    // Would use ML/AI for real recommendations
    return `
      <div class="products">
        <div class="product">
          <img src="https://via.placeholder.com/150" alt="Product 1">
          <h4>Premium Package</h4>
          <p>Perfect for your needs</p>
          <a href="#" class="cta-button">Shop Now</a>
        </div>
      </div>
    `;
  }

  /**
   * Track email sends
   */
  async trackEmailSends(campaign, email, recipients) {
    const tracks = recipients.map(recipient => ({
      campaign_id: campaign.id,
      email_id: email.id,
      recipient_email: recipient.email,
      sent_at: new Date().toISOString(),
      status: 'sent'
    }));
    
    await supabase
      .from('email_tracking')
      .insert(tracks);
  }

  /**
   * Default email templates
   */
  
  getDefaultWelcomeEmail(business) {
    return `
      <h2>Welcome to ${business.name}!</h2>
      <p>We're thrilled to have you join our community.</p>
      <p>As a welcome gift, enjoy 20% off your first purchase with code: <strong>WELCOME20</strong></p>
      <h3>Popular with new customers:</h3>
      <ul>
        <li>Starter Package - Perfect for beginners</li>
        <li>Professional Bundle - Our best value</li>
        <li>Premium Service - White glove experience</li>
      </ul>
      <a href="https://shop.launchfly.com" class="button">Start Shopping</a>
      <p>Questions? Just reply to this email!</p>
    `;
  }
  
  getDefaultBrandStory(business) {
    return `
      <h2>Our Story</h2>
      <p>Every great business starts with a problem that needs solving.</p>
      <p>For us at ${business.name}, that problem was clear: businesses struggle to generate consistent revenue online.</p>
      <p>That's why we created a solution that actually works - combining AI technology with proven business models to help you succeed.</p>
      <blockquote>"This changed everything for my business. I went from zero to $5k/month in 60 days." - Sarah M.</blockquote>
      <a href="https://shop.launchfly.com" class="button">Explore Our Solutions</a>
    `;
  }
  
  getDefaultValueEmail(business) {
    return `
      <h2>5 Ways to Maximize Your Success</h2>
      <ol>
        <li><strong>Start with the basics</strong> - Master fundamentals first</li>
        <li><strong>Use our templates</strong> - Don't reinvent the wheel</li>
        <li><strong>Track everything</strong> - Data drives decisions</li>
        <li><strong>Ask for help</strong> - Our team is here for you</li>
        <li><strong>Stay consistent</strong> - Small daily actions compound</li>
      </ol>
      <p>Ready to level up?</p>
      <a href="https://shop.launchfly.com" class="button">Browse Solutions</a>
    `;
  }
  
  getDefaultUrgencyEmail(business) {
    return `
      <h2>⏰ Your 20% discount expires in 24 hours!</h2>
      <p>Don't miss out on this exclusive welcome offer.</p>
      <div class="countdown">[COUNTDOWN TIMER]</div>
      <p><strong>2,847 customers</strong> have already claimed their discount this week.</p>
      <p>Use code: <strong>WELCOME20</strong></p>
      <a href="https://shop.launchfly.com" class="button urgent">Claim Your Discount Now</a>
      <p><small>This offer won't be repeated.</small></p>
    `;
  }

  /**
   * Schedule email campaign
   */
  async scheduleCampaign(businessId, campaignId, startDate) {
    const campaign = this.campaigns.get(businessId)?.find(c => c.id === campaignId);
    
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    for (const email of campaign.emails) {
      const sendDate = new Date(startDate);
      sendDate.setDate(sendDate.getDate() + (email.day || 0));
      sendDate.setHours(sendDate.getHours() + (email.hour || 0));
      
      await supabase
        .from('scheduled_campaigns')
        .insert({
          business_id: businessId,
          campaign_id: campaignId,
          email_id: email.id,
          scheduled_for: sendDate.toISOString(),
          status: 'scheduled'
        });
    }
    
    return { scheduled: true, emailCount: campaign.emails.length };
  }
}

export default EmailMarketing;
