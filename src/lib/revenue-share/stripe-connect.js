// src/lib/revenue-share/stripe-connect.js
/**
 * Stripe Connect Revenue Sharing System
 * 
 * Implements the revenue-sharing model that aligns Launchfly with customer success:
 * - Starter: 20% revenue share until $1k, then 15%
 * - Pro: 10% revenue share until $2k, then 8%  
 * - Scale: 5% revenue share until $5k, then 3%
 * 
 * This creates switching costs and partnership mentality vs. vendor relationship
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export class StripeConnectManager {
  constructor() {
    this.platformAccountId = process.env.STRIPE_PLATFORM_ACCOUNT_ID;
  }

  /**
   * Create Stripe Connect account for business
   */
  async createConnectAccount(business, userEmail) {
    try {
      console.log(`💳 Creating Stripe Connect account for business ${business.id}`);
      
      // Create Express account for easier onboarding
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: userEmail,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual', // Most users will be individuals
        metadata: {
          business_id: business.id,
          business_name: business.name,
          launchfly_plan: business.plan_tier || 'starter'
        }
      });

      // Store Connect account ID
      await supabase
        .from('businesses')
        .update({
          stripe_connect_account_id: account.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', business.id);

      // Log activity
      await supabase
        .from('ai_activities')
        .insert({
          business_id: business.id,
          type: 'stripe_connect_created',
          icon: '💳',
          message: 'Stripe Connect account created',
          details: 'Revenue sharing enabled. Customer payments will be split automatically.',
          metadata: {
            connectAccountId: account.id,
            planTier: business.plan_tier
          }
        });

      return account;
      
    } catch (error) {
      console.error('Error creating Stripe Connect account:', error);
      throw error;
    }
  }

  /**
   * Create onboarding link for Connect account
   */
  async createOnboardingLink(connectAccountId, businessId) {
    try {
      const accountLink = await stripe.accountLinks.create({
        account: connectAccountId,
        refresh_url: `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/dashboard/${businessId}/stripe-connect?refresh=true`,
        return_url: `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/dashboard/${businessId}/stripe-connect?success=true`,
        type: 'account_onboarding',
      });

      return accountLink.url;
      
    } catch (error) {
      console.error('Error creating onboarding link:', error);
      throw error;
    }
  }

  /**
   * Create checkout session with revenue sharing
   */
  async createRevenueShareCheckout(business, product, customerEmail) {
    try {
      const connectAccountId = business.stripe_connect_account_id;
      if (!connectAccountId) {
        throw new Error('Business does not have Stripe Connect account');
      }

      // Calculate revenue share based on plan tier
      const revenueShare = this.calculateRevenueShare(business, product.price);
      const applicationFee = Math.round(product.price * revenueShare.percentage);

      console.log(`💰 Creating checkout with ${revenueShare.percentage * 100}% revenue share (${applicationFee} cents)`);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: Math.round(product.price * 100), // Convert to cents
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/sites/${business.subdomain}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/sites/${business.subdomain}`,
        customer_email: customerEmail,
        
        // Revenue sharing configuration
        payment_intent_data: {
          application_fee_amount: applicationFee,
          transfer_data: {
            destination: connectAccountId,
          },
          metadata: {
            business_id: business.id,
            product_id: product.id,
            revenue_share_percentage: revenueShare.percentage,
            plan_tier: business.plan_tier
          }
        },
        
        metadata: {
          business_id: business.id,
          product_id: product.id,
          connect_account_id: connectAccountId
        }
      });

      // Log revenue share checkout
      await supabase
        .from('ai_activities')
        .insert({
          business_id: business.id,
          type: 'revenue_share_checkout',
          icon: '💰',
          message: `Checkout created with ${(revenueShare.percentage * 100).toFixed(1)}% revenue share`,
          details: `Customer pays $${product.price}, business receives $${(product.price * (1 - revenueShare.percentage)).toFixed(2)}, Launchfly receives $${(product.price * revenueShare.percentage).toFixed(2)}`,
          metadata: {
            sessionId: session.id,
            revenueShare: revenueShare,
            productPrice: product.price
          }
        });

      return session;
      
    } catch (error) {
      console.error('Error creating revenue share checkout:', error);
      throw error;
    }
  }

  /**
   * Calculate revenue share percentage based on plan and performance
   */
  calculateRevenueShare(business, saleAmount) {
    const planTier = business.plan_tier || 'starter';
    const currentRevenue = business.total_revenue || 0;
    
    // Revenue share tiers with performance-based reduction
    const tiers = {
      starter: {
        initial: 0.20, // 20% until $1k
        reduced: 0.15, // 15% after $1k
        threshold: 1000
      },
      pro: {
        initial: 0.10, // 10% until $2k
        reduced: 0.08, // 8% after $2k
        threshold: 2000
      },
      scale: {
        initial: 0.05, // 5% until $5k
        reduced: 0.03, // 3% after $5k
        threshold: 5000
      }
    };

    const tier = tiers[planTier] || tiers.starter;
    const percentage = currentRevenue >= tier.threshold ? tier.reduced : tier.initial;
    
    return {
      percentage: percentage,
      tier: planTier,
      currentRevenue: currentRevenue,
      threshold: tier.threshold,
      isReduced: currentRevenue >= tier.threshold
    };
  }

  /**
   * Process revenue share after successful payment
   */
  async processRevenueShare(paymentIntent, business) {
    try {
      const saleAmount = paymentIntent.amount / 100; // Convert from cents
      const revenueShare = this.calculateRevenueShare(business, saleAmount);
      const launchflyFee = saleAmount * revenueShare.percentage;
      const businessRevenue = saleAmount - launchflyFee;

      // Update business revenue
      await supabase
        .from('businesses')
        .update({
          total_revenue: (business.total_revenue || 0) + businessRevenue,
          last_sale_date: new Date().toISOString(),
          first_payment_at: business.first_payment_at || new Date().toISOString()
        })
        .eq('id', business.id);

      // Record revenue share transaction
      await supabase
        .from('revenue_share_transactions')
        .insert({
          business_id: business.id,
          payment_intent_id: paymentIntent.id,
          total_amount: saleAmount,
          business_amount: businessRevenue,
          launchfly_fee: launchflyFee,
          revenue_share_percentage: revenueShare.percentage,
          plan_tier: business.plan_tier,
          created_at: new Date().toISOString()
        });

      // Log activity
      await supabase
        .from('ai_activities')
        .insert({
          business_id: business.id,
          type: 'revenue_share_processed',
          icon: '💰',
          message: `Revenue share processed: $${businessRevenue.toFixed(2)} to business, $${launchflyFee.toFixed(2)} to Launchfly`,
          details: `${(revenueShare.percentage * 100).toFixed(1)}% revenue share on $${saleAmount} sale`,
          metadata: {
            paymentIntentId: paymentIntent.id,
            totalAmount: saleAmount,
            businessAmount: businessRevenue,
            launchflyFee: launchflyFee,
            revenueShare: revenueShare
          }
        });

      // Check if business hit revenue milestone for reduced fees
      if (!revenueShare.isReduced && (business.total_revenue + businessRevenue) >= revenueShare.threshold) {
        await this.sendMilestoneEmail(business, revenueShare.threshold);
      }

      return {
        success: true,
        businessAmount: businessRevenue,
        launchflyFee: launchflyFee,
        revenueShare: revenueShare
      };
      
    } catch (error) {
      console.error('Error processing revenue share:', error);
      throw error;
    }
  }

  /**
   * Send milestone achievement email
   */
  async sendMilestoneEmail(business, milestone) {
    const { data: user } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', business.user_id)
      .single();

    if (!user?.email) return;

    const newRate = this.calculateRevenueShare(business, 100).reduced * 100; // Get reduced rate

    const emailContent = `
    <h2>🎉 Milestone Achieved - Revenue Share Reduced!</h2>
    
    <p>Hi ${user.full_name},</p>
    
    <p>Congratulations! Your business "${business.name}" has reached $${milestone} in revenue!</p>
    
    <p><strong>Your revenue share has been automatically reduced to ${newRate}%</strong></p>
    
    <p>This means you now keep more of every sale. Our partnership is working!</p>
    
    <ul>
      <li>✅ Milestone: $${milestone} revenue achieved</li>
      <li>📉 New revenue share: ${newRate}% (reduced from previous rate)</li>
      <li>💰 You keep more of every future sale</li>
      <li>🚀 Business momentum is building</li>
    </ul>
    
    <p>Keep up the great work! Our AI continues to optimize your business for even better results.</p>
    
    <p><a href="https://launchfly.ai/dashboard/${business.subdomain}">View your dashboard →</a></p>
    
    <p>Best regards,<br>
    The Launchfly Team</p>
    `;

    const resend = new (await import('resend')).Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'Launchfly <success@launchfly.ai>',
      to: user.email,
      subject: `🎉 Milestone Achieved - Revenue Share Reduced to ${newRate}%`,
      html: emailContent
    });
  }

  /**
   * Get revenue share analytics
   */
  async getRevenueShareAnalytics(businessId = null) {
    let query = supabase
      .from('revenue_share_transactions')
      .select('*');
    
    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data: transactions } = await query
      .order('created_at', { ascending: false })
      .limit(100);

    const totalRevenue = transactions?.reduce((sum, t) => sum + t.total_amount, 0) || 0;
    const totalBusinessRevenue = transactions?.reduce((sum, t) => sum + t.business_amount, 0) || 0;
    const totalLaunchflyFees = transactions?.reduce((sum, t) => sum + t.launchfly_fee, 0) || 0;

    return {
      totalTransactions: transactions?.length || 0,
      totalRevenue: totalRevenue,
      totalBusinessRevenue: totalBusinessRevenue,
      totalLaunchflyFees: totalLaunchflyFees,
      averageRevenueShare: totalRevenue > 0 ? totalLaunchflyFees / totalRevenue : 0,
      recentTransactions: transactions?.slice(0, 10) || []
    };
  }

  /**
   * Check Connect account status
   */
  async checkConnectAccountStatus(connectAccountId) {
    try {
      const account = await stripe.accounts.retrieve(connectAccountId);
      
      return {
        id: account.id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        requirements: account.requirements,
        capabilities: account.capabilities
      };
      
    } catch (error) {
      console.error('Error checking Connect account status:', error);
      return null;
    }
  }
}

// Global instance
let stripeConnectInstance = null;

/**
 * Get Stripe Connect manager instance
 */
export function getStripeConnectManager() {
  if (!stripeConnectInstance) {
    stripeConnectInstance = new StripeConnectManager();
  }
  return stripeConnectInstance;
}
