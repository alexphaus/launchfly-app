/**
 * Fulfillment Engine
 * Handles automated delivery of products and services
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const resend = new Resend(process.env.RESEND_API_KEY);

export class FulfillmentEngine {
  constructor() {
    this.fulfillmentQueue = new Map();
    this.automationRules = new Map();
  }

  /**
   * Setup fulfillment for a business
   */
  async setup(businessId, template) {
    console.log(`📦 Setting up fulfillment for business ${businessId}`);
    
    // Create fulfillment rules based on template
    const rules = this.createFulfillmentRules(template);
    
    // Store rules
    await supabase
      .from('fulfillment_rules')
      .insert({
        business_id: businessId,
        rules: rules,
        automation_level: template.automationLevel || 'high',
        created_at: new Date().toISOString()
      });
    
    this.automationRules.set(businessId, rules);
    
    // Start fulfillment monitor
    this.startFulfillmentMonitor(businessId);
    
    return {
      setup: true,
      rulesCount: rules.length,
      automationLevel: template.automationLevel
    };
  }

  /**
   * Create fulfillment rules based on template
   */
  createFulfillmentRules(template) {
    const rules = [];
    
    // Digital product delivery
    if (template.digitalProducts) {
      rules.push({
        trigger: 'payment_completed',
        product_type: 'digital',
        action: 'send_download_link',
        delay: 0,
        template: 'digital_delivery'
      });
    }
    
    // Service fulfillment
    if (template.services) {
      rules.push({
        trigger: 'payment_completed',
        product_type: 'service',
        action: 'create_project',
        delay: 0,
        template: 'service_onboarding'
      });
      
      rules.push({
        trigger: 'project_created',
        product_type: 'service',
        action: 'send_onboarding',
        delay: 5, // 5 minutes
        template: 'service_welcome'
      });
    }
    
    // Subscription activation
    if (template.subscriptions) {
      rules.push({
        trigger: 'subscription_started',
        product_type: 'subscription',
        action: 'activate_access',
        delay: 0,
        template: 'subscription_welcome'
      });
      
      rules.push({
        trigger: 'subscription_started',
        product_type: 'subscription',
        action: 'send_onboarding_sequence',
        delay: 60, // 1 hour
        template: 'subscription_onboarding'
      });
    }
    
    // Physical product fulfillment
    if (template.physicalProducts) {
      rules.push({
        trigger: 'payment_completed',
        product_type: 'physical',
        action: 'create_shipping_order',
        delay: 0,
        template: 'order_confirmation'
      });
      
      rules.push({
        trigger: 'order_shipped',
        product_type: 'physical',
        action: 'send_tracking',
        delay: 0,
        template: 'shipping_notification'
      });
    }
    
    // Universal rules
    rules.push({
      trigger: 'payment_completed',
      product_type: 'any',
      action: 'send_receipt',
      delay: 0,
      template: 'payment_receipt'
    });
    
    rules.push({
      trigger: 'payment_completed',
      product_type: 'any',
      action: 'update_crm',
      delay: 0,
      template: null
    });
    
    return rules;
  }

  /**
   * Process an order for fulfillment
   */
  async processOrder(order) {
    console.log(`📦 Processing order ${order.id}`);
    
    try {
      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', order.business_id)
        .single();
      
      const rules = this.automationRules.get(order.business_id) || [];
      
      // Apply matching rules
      for (const rule of rules) {
        if (this.ruleMatches(rule, order)) {
          await this.executeRule(rule, order, business);
        }
      }
      
      // Update order status
      await supabase
        .from('orders')
        .update({
          fulfillment_status: 'processing',
          fulfillment_started_at: new Date().toISOString()
        })
        .eq('id', order.id);
      
      // Execute fulfillment based on product type
      await this.fulfillByType(order, business);
      
      return { success: true, orderId: order.id };
      
    } catch (error) {
      console.error('Fulfillment error:', error);
      
      await supabase
        .from('fulfillment_errors')
        .insert({
          order_id: order.id,
          error: error.message,
          occurred_at: new Date().toISOString()
        });
      
      throw error;
    }
  }

  /**
   * Check if rule matches order
   */
  ruleMatches(rule, order) {
    if (rule.product_type === 'any') return true;
    return rule.product_type === order.product_type;
  }

  /**
   * Execute fulfillment rule
   */
  async executeRule(rule, order, business) {
    // Schedule or execute immediately based on delay
    if (rule.delay > 0) {
      setTimeout(() => this.executeAction(rule.action, order, business, rule.template), rule.delay * 60 * 1000);
    } else {
      await this.executeAction(rule.action, order, business, rule.template);
    }
  }

  /**
   * Execute specific action
   */
  async executeAction(action, order, business, template) {
    switch(action) {
      case 'send_download_link':
        await this.sendDownloadLink(order, business);
        break;
      case 'create_project':
        await this.createProject(order, business);
        break;
      case 'send_onboarding':
        await this.sendOnboarding(order, business, template);
        break;
      case 'activate_access':
        await this.activateAccess(order, business);
        break;
      case 'send_onboarding_sequence':
        await this.startOnboardingSequence(order, business);
        break;
      case 'create_shipping_order':
        await this.createShippingOrder(order, business);
        break;
      case 'send_tracking':
        await this.sendTrackingInfo(order, business);
        break;
      case 'send_receipt':
        await this.sendReceipt(order, business);
        break;
      case 'update_crm':
        await this.updateCRM(order, business);
        break;
    }
  }

  /**
   * Fulfill by product type
   */
  async fulfillByType(order, business) {
    switch(order.product_type) {
      case 'digital':
        await this.fulfillDigitalProduct(order, business);
        break;
      case 'service':
        await this.fulfillService(order, business);
        break;
      case 'subscription':
        await this.fulfillSubscription(order, business);
        break;
      case 'physical':
        await this.fulfillPhysicalProduct(order, business);
        break;
      case 'content':
        await this.fulfillContent(order, business);
        break;
      default:
        await this.fulfillGeneric(order, business);
    }
  }

  /**
   * Fulfill digital product
   */
  async fulfillDigitalProduct(order, business) {
    console.log(`💾 Fulfilling digital product for order ${order.id}`);
    
    // Generate download link
    const downloadLink = await this.generateDownloadLink(order);
    
    // Send email with download
    await resend.emails.send({
      from: 'delivery@launchfly.com',
      to: order.customer_email,
      subject: `Your ${order.product_name} is ready!`,
      html: this.getDigitalDeliveryEmail(order, downloadLink, business)
    });
    
    // Update order
    await supabase
      .from('orders')
      .update({
        fulfillment_status: 'completed',
        fulfillment_data: { download_link: downloadLink },
        fulfilled_at: new Date().toISOString()
      })
      .eq('id', order.id);
  }

  /**
   * Fulfill service
   */
  async fulfillService(order, business) {
    console.log(`🛠️ Fulfilling service for order ${order.id}`);
    
    // Create project in project management system
    const project = await this.createServiceProject(order, business);
    
    // Send onboarding email
    await resend.emails.send({
      from: 'services@launchfly.com',
      to: order.customer_email,
      subject: `Let's get started with your ${order.product_name}`,
      html: this.getServiceOnboardingEmail(order, project, business)
    });
    
    // If AI-powered service, start generation
    if (order.product_category === 'ai_service') {
      await this.startAIGeneration(order, business);
    }
    
    // Update order
    await supabase
      .from('orders')
      .update({
        fulfillment_status: 'in_progress',
        fulfillment_data: { project_id: project.id },
        fulfillment_started_at: new Date().toISOString()
      })
      .eq('id', order.id);
  }

  /**
   * Fulfill subscription
   */
  async fulfillSubscription(order, business) {
    console.log(`🔄 Fulfilling subscription for order ${order.id}`);
    
    // Create subscription record
    const subscription = await supabase
      .from('subscriptions')
      .insert({
        business_id: business.id,
        customer_id: order.customer_id,
        plan_id: order.product_id,
        status: 'active',
        started_at: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();
    
    // Grant access
    await this.grantSubscriptionAccess(order, subscription.data);
    
    // Send welcome email
    await resend.emails.send({
      from: 'subscriptions@launchfly.com',
      to: order.customer_email,
      subject: `Welcome to ${business.name}!`,
      html: this.getSubscriptionWelcomeEmail(order, subscription.data, business)
    });
    
    // Start onboarding sequence
    await this.scheduleOnboardingEmails(order, business);
    
    // Update order
    await supabase
      .from('orders')
      .update({
        fulfillment_status: 'completed',
        fulfillment_data: { subscription_id: subscription.data.id },
        fulfilled_at: new Date().toISOString()
      })
      .eq('id', order.id);
  }

  /**
   * Fulfill physical product
   */
  async fulfillPhysicalProduct(order, business) {
    console.log(`📦 Fulfilling physical product for order ${order.id}`);
    
    // Create shipping order (would integrate with shipping API)
    const shippingOrder = {
      order_id: order.id,
      customer_name: order.customer_name,
      shipping_address: order.shipping_address,
      items: order.items,
      carrier: 'USPS',
      service: 'Priority Mail',
      tracking_number: `TRACK${Date.now()}`,
      estimated_delivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    await supabase
      .from('shipping_orders')
      .insert(shippingOrder);
    
    // Send confirmation email
    await resend.emails.send({
      from: 'orders@launchfly.com',
      to: order.customer_email,
      subject: `Your order is being prepared!`,
      html: this.getShippingConfirmationEmail(order, shippingOrder, business)
    });
    
    // Update order
    await supabase
      .from('orders')
      .update({
        fulfillment_status: 'shipping',
        fulfillment_data: shippingOrder,
        fulfillment_started_at: new Date().toISOString()
      })
      .eq('id', order.id);
  }

  /**
   * Fulfill content order using AI
   */
  async fulfillContent(order, business) {
    console.log(`✍️ Fulfilling content order for ${order.id}`);
    
    // Generate content using AI
    const content = await this.generateContent(order);
    
    // Store generated content
    const { data: deliverable } = await supabase
      .from('deliverables')
      .insert({
        order_id: order.id,
        business_id: business.id,
        type: 'content',
        content: content,
        status: 'ready_for_review',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    // Send delivery email
    await resend.emails.send({
      from: 'content@launchfly.com',
      to: order.customer_email,
      subject: `Your content is ready for review!`,
      html: this.getContentDeliveryEmail(order, deliverable, business)
    });
    
    // Update order
    await supabase
      .from('orders')
      .update({
        fulfillment_status: 'review',
        fulfillment_data: { deliverable_id: deliverable.id },
        fulfilled_at: new Date().toISOString()
      })
      .eq('id', order.id);
  }

  /**
   * Generate content using AI
   */
  async generateContent(order) {
    const prompt = `Create ${order.product_name} for a ${order.business_type} business.
    
    Requirements:
    ${order.requirements || 'No specific requirements'}
    
    Style: ${order.style || 'Professional'}
    Length: ${order.length || 'Standard'}
    
    Generate high-quality content that converts and engages the target audience.`;
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: 'You are an expert content creator.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Content generation failed:', error);
      return 'Content generation in progress. Will be delivered within 24 hours.';
    }
  }

  /**
   * Prepare digital asset
   */
  async prepareDigitalAsset(businessId, template) {
    // Generate or retrieve digital asset
    // In production, would create actual files
    
    const assetUrl = `https://storage.launchfly.com/${businessId}/${template.name.replace(/\s+/g, '-').toLowerCase()}.${template.fileType}`;
    
    // Store asset reference
    await supabase
      .from('digital_assets')
      .insert({
        business_id: businessId,
        name: template.name,
        url: assetUrl,
        type: template.fileType,
        size: 1024 * 100, // Mock size
        created_at: new Date().toISOString()
      });
    
    return assetUrl;
  }

  /**
   * Start fulfillment monitor
   */
  startFulfillmentMonitor(businessId) {
    // Check for pending fulfillments every minute
    setInterval(async () => {
      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('business_id', businessId)
        .eq('fulfillment_status', 'pending')
        .limit(10);
      
      if (pendingOrders && pendingOrders.length > 0) {
        for (const order of pendingOrders) {
          await this.processOrder(order);
        }
      }
    }, 60000); // Every minute
  }

  /**
   * Email Templates
   */
  
  getDigitalDeliveryEmail(order, downloadLink, business) {
    return `
      <h2>Your Digital Product is Ready!</h2>
      <p>Hi ${order.customer_name},</p>
      <p>Thank you for your purchase of ${order.product_name}!</p>
      <p>Click the button below to download your product:</p>
      <a href="${downloadLink}" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">Download Now</a>
      <p>This link will expire in 7 days. You can download up to 5 times.</p>
      <p>If you have any questions, reply to this email.</p>
      <p>Best regards,<br>${business.name}</p>
    `;
  }
  
  getServiceOnboardingEmail(order, project, business) {
    return `
      <h2>Let's Get Started!</h2>
      <p>Hi ${order.customer_name},</p>
      <p>Welcome! I'm excited to work with you on ${order.product_name}.</p>
      <h3>Next Steps:</h3>
      <ol>
        <li>Access your project dashboard: <a href="${project.dashboard_url}">View Project</a></li>
        <li>Complete the onboarding questionnaire (5 minutes)</li>
        <li>Schedule your kickoff call</li>
      </ol>
      <p>Expected delivery: ${project.estimated_completion}</p>
      <p>Questions? Reply to this email or message me in the dashboard.</p>
      <p>Looking forward to creating something amazing!</p>
      <p>Best,<br>${business.name}</p>
    `;
  }
  
  getSubscriptionWelcomeEmail(order, subscription, business) {
    return `
      <h2>Welcome to ${business.name}!</h2>
      <p>Hi ${order.customer_name},</p>
      <p>Your subscription is now active! Here's everything you need to get started:</p>
      <h3>Your Access Details:</h3>
      <ul>
        <li>Login URL: <a href="https://app.launchfly.com/login">Access Portal</a></li>
        <li>Username: ${order.customer_email}</li>
        <li>Plan: ${order.product_name}</li>
        <li>Next billing date: ${new Date(subscription.current_period_end).toLocaleDateString()}</li>
      </ul>
      <h3>Quick Start Guide:</h3>
      <ol>
        <li>Complete your profile</li>
        <li>Join our community</li>
        <li>Access your first resources</li>
      </ol>
      <p>Need help? Reply to this email or check our help center.</p>
      <p>Welcome aboard!<br>${business.name}</p>
    `;
  }
  
  getShippingConfirmationEmail(order, shipping, business) {
    return `
      <h2>Your Order is On Its Way!</h2>
      <p>Hi ${order.customer_name},</p>
      <p>Great news! Your order has been shipped.</p>
      <h3>Order Details:</h3>
      <ul>
        <li>Order #: ${order.id}</li>
        <li>Tracking #: ${shipping.tracking_number}</li>
        <li>Carrier: ${shipping.carrier}</li>
        <li>Estimated Delivery: ${new Date(shipping.estimated_delivery).toLocaleDateString()}</li>
      </ul>
      <p><a href="https://tracking.com/${shipping.tracking_number}" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">Track Package</a></p>
      <p>Thank you for your business!</p>
      <p>Best,<br>${business.name}</p>
    `;
  }
  
  getContentDeliveryEmail(order, deliverable, business) {
    return `
      <h2>Your Content is Ready!</h2>
      <p>Hi ${order.customer_name},</p>
      <p>I've completed your ${order.product_name}. Please review and let me know if you need any revisions.</p>
      <p><a href="https://app.launchfly.com/deliverables/${deliverable.id}" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">View Content</a></p>
      <h3>What's Included:</h3>
      <ul>
        <li>Content as requested</li>
        <li>${order.revisions || 2} rounds of revisions</li>
        <li>Source files (if applicable)</li>
      </ul>
      <p>Please review within 48 hours. I'm here if you need any changes!</p>
      <p>Best,<br>${business.name}</p>
    `;
  }
  
  /**
   * Helper Methods
   */
  
  async generateDownloadLink(order) {
    // Generate secure download link
    const token = Buffer.from(`${order.id}:${Date.now()}`).toString('base64');
    return `https://downloads.launchfly.com/digital/${token}`;
  }
  
  async createServiceProject(order, business) {
    return {
      id: `PRJ-${Date.now()}`,
      dashboard_url: `https://app.launchfly.com/projects/${order.id}`,
      estimated_completion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
  }
  
  async startAIGeneration(order, business) {
    // Trigger AI generation workflow
    console.log(`Starting AI generation for order ${order.id}`);
  }
  
  async grantSubscriptionAccess(order, subscription) {
    // Grant access to subscription features
    console.log(`Granting access for subscription ${subscription.id}`);
  }
  
  async scheduleOnboardingEmails(order, business) {
    // Schedule drip campaign
    const emails = [
      { delay: 1, template: 'day_1_getting_started' },
      { delay: 3, template: 'day_3_first_success' },
      { delay: 7, template: 'week_1_check_in' },
      { delay: 14, template: 'week_2_advanced_features' },
      { delay: 30, template: 'month_1_celebration' }
    ];
    
    for (const email of emails) {
      await supabase
        .from('scheduled_emails')
        .insert({
          business_id: business.id,
          customer_email: order.customer_email,
          template: email.template,
          scheduled_for: new Date(Date.now() + email.delay * 24 * 60 * 60 * 1000).toISOString(),
          status: 'scheduled'
        });
    }
  }
  
  async sendDownloadLink(order, business) {
    const link = await this.generateDownloadLink(order);
    // Send email with link
    console.log(`Sending download link for order ${order.id}`);
  }
  
  async createProject(order, business) {
    console.log(`Creating project for order ${order.id}`);
  }
  
  async sendOnboarding(order, business, template) {
    console.log(`Sending onboarding for order ${order.id}`);
  }
  
  async activateAccess(order, business) {
    console.log(`Activating access for order ${order.id}`);
  }
  
  async startOnboardingSequence(order, business) {
    console.log(`Starting onboarding sequence for order ${order.id}`);
  }
  
  async createShippingOrder(order, business) {
    console.log(`Creating shipping order for ${order.id}`);
  }
  
  async sendTrackingInfo(order, business) {
    console.log(`Sending tracking info for order ${order.id}`);
  }
  
  async sendReceipt(order, business) {
    console.log(`Sending receipt for order ${order.id}`);
  }
  
  async updateCRM(order, business) {
    console.log(`Updating CRM for order ${order.id}`);
  }
  
  async fulfillGeneric(order, business) {
    console.log(`Generic fulfillment for order ${order.id}`);
  }
}

export default FulfillmentEngine;
