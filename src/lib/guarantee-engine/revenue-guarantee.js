// src/lib/guarantee-engine/revenue-guarantee.js
/**
 * Revenue Guarantee Engine
 * 
 * Automatically enforces Launchfly's guarantees:
 * - First sale in 48 hours or pay user $100
 * - $1000 revenue in 60 days or work for free
 * 
 * This builds trust and ensures we deliver results
 */

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export class RevenueGuaranteeEngine {
  constructor() {
    this.guarantees = {
      FIRST_SALE_HOURS: 48,
      FIRST_SALE_PAYOUT: 100,
      REVENUE_TARGET: 1000,
      REVENUE_DAYS: 60
    };
  }

  /**
   * Start guarantee tracking for a new business
   */
  async startGuaranteeTracking(businessId) {
    const now = new Date();
    
    // Create guarantee record
    const { data: guarantee } = await supabase
      .from('revenue_guarantees')
      .insert({
        business_id: businessId,
        guarantee_type: 'standard',
        started_at: now,
        first_sale_deadline: new Date(now.getTime() + this.guarantees.FIRST_SALE_HOURS * 60 * 60 * 1000),
        revenue_target_deadline: new Date(now.getTime() + this.guarantees.REVENUE_DAYS * 24 * 60 * 60 * 1000),
        revenue_target: this.guarantees.REVENUE_TARGET,
        first_sale_payout: this.guarantees.FIRST_SALE_PAYOUT,
        status: 'active'
      })
      .select()
      .single();
      
    // Schedule check jobs
    await this.scheduleGuaranteeChecks(businessId, guarantee);
    
    return guarantee;
  }

  /**
   * Check if first sale guarantee is met
   */
  async checkFirstSaleGuarantee(businessId) {
    console.log(`🔍 Checking first sale guarantee for business ${businessId}`);
    
    // Get guarantee and business data
    const { data: guarantee } = await supabase
      .from('revenue_guarantees')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'active')
      .single();
      
    if (!guarantee) return;
    
    const { data: business } = await supabase
      .from('businesses')
      .select('*, user:profiles(*)')
      .eq('id', businessId)
      .single();
      
    // Check if first sale was made
    const hasFirstSale = business.first_payment_at !== null;
    const deadlinePassed = new Date() > new Date(guarantee.first_sale_deadline);
    
    if (!hasFirstSale && deadlinePassed) {
      // Guarantee failed - pay the user
      await this.payoutFirstSaleGuarantee(business, guarantee);
    } else if (hasFirstSale) {
      // Guarantee met - update status
      await supabase
        .from('revenue_guarantees')
        .update({
          first_sale_met: true,
          first_sale_met_at: business.first_payment_at
        })
        .eq('id', guarantee.id);
        
      await this.notifyGuaranteeSuccess(business, 'first_sale');
    }
  }

  /**
   * Pay out first sale guarantee
   */
  async payoutFirstSaleGuarantee(business, guarantee) {
    console.log(`💰 Paying out $${guarantee.first_sale_payout} guarantee to ${business.user.email}`);
    
    try {
      // Create Stripe payout
      const payout = await stripe.transfers.create({
        amount: guarantee.first_sale_payout * 100, // Convert to cents
        currency: 'usd',
        destination: business.stripe_connect_account_id || business.user.stripe_account_id,
        description: `Launchfly First Sale Guarantee - Business ${business.id}`,
        metadata: {
          business_id: business.id,
          guarantee_id: guarantee.id,
          type: 'first_sale_guarantee'
        }
      });
      
      // Update guarantee record
      await supabase
        .from('revenue_guarantees')
        .update({
          first_sale_payout_completed: true,
          first_sale_payout_at: new Date(),
          first_sale_payout_id: payout.id
        })
        .eq('id', guarantee.id);
        
      // Log activity
      await supabase
        .from('ai_activities')
        .insert({
          business_id: business.id,
          type: 'guarantee_payout',
          icon: '💰',
          message: `First sale guarantee activated: $${guarantee.first_sale_payout} paid`,
          details: 'We promised a sale in 48 hours. Promise kept with payment.',
          metadata: {
            payout_amount: guarantee.first_sale_payout,
            payout_id: payout.id
          }
        });
        
      // Send email notification
      await resend.emails.send({
        from: 'Launchfly <guarantees@launchfly.ai>',
        to: business.user.email,
        subject: '💰 Your $100 Guarantee Payment is On the Way!',
        html: `
          <h2>We Keep Our Promises</h2>
          <p>Hi ${business.user.full_name || 'there'},</p>
          
          <p>We guaranteed you'd make your first sale within 48 hours. Since that hasn't happened yet, 
          we're sending you $${guarantee.first_sale_payout} as promised.</p>
          
          <p><strong>But we're not giving up!</strong></p>
          
          <p>Our AI is learning from this and implementing new strategies to get you sales. 
          We're still committed to getting you to $1,000 in revenue.</p>
          
          <p>The $${guarantee.first_sale_payout} has been sent to your account and should arrive within 1-2 business days.</p>
          
          <p>Keep watching your dashboard - sales are coming!</p>
          
          <p>Best,<br>The Launchfly Team</p>
        `
      });
      
    } catch (error) {
      console.error('Error processing guarantee payout:', error);
      
      // Mark for manual review
      await supabase
        .from('revenue_guarantees')
        .update({
          needs_manual_review: true,
          review_reason: `Payout error: ${error.message}`
        })
        .eq('id', guarantee.id);
    }
  }

  /**
   * Check revenue target guarantee
   */
  async checkRevenueGuarantee(businessId) {
    console.log(`📊 Checking revenue guarantee for business ${businessId}`);
    
    const { data: guarantee } = await supabase
      .from('revenue_guarantees')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'active')
      .single();
      
    if (!guarantee) return;
    
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
      
    const currentRevenue = business.total_revenue || 0;
    const deadlinePassed = new Date() > new Date(guarantee.revenue_target_deadline);
    
    if (currentRevenue >= guarantee.revenue_target) {
      // Guarantee met!
      await supabase
        .from('revenue_guarantees')
        .update({
          revenue_target_met: true,
          revenue_target_met_at: new Date(),
          final_revenue: currentRevenue,
          status: 'completed'
        })
        .eq('id', guarantee.id);
        
      await this.notifyGuaranteeSuccess(business, 'revenue_target');
      
    } else if (deadlinePassed) {
      // Guarantee period ended - activate free service
      await this.activateFreeService(business, guarantee);
    } else {
      // Still time left - intensify efforts
      const daysLeft = Math.ceil((new Date(guarantee.revenue_target_deadline) - new Date()) / (24 * 60 * 60 * 1000));
      const revenueNeeded = guarantee.revenue_target - currentRevenue;
      
      if (daysLeft <= 7) {
        await this.intensifyEfforts(business, revenueNeeded, daysLeft);
      }
    }
  }

  /**
   * Activate free service until $1000 target is met
   */
  async activateFreeService(business, guarantee) {
    console.log(`🆓 Activating free service for business ${business.id}`);
    
    // Update guarantee status
    await supabase
      .from('revenue_guarantees')
      .update({
        free_service_activated: true,
        free_service_activated_at: new Date(),
        status: 'free_service'
      })
      .eq('id', guarantee.id);
      
    // Suspend revenue share
    await supabase
      .from('businesses')
      .update({
        revenue_share_suspended: true,
        revenue_share_suspended_reason: 'guarantee_activation'
      })
      .eq('id', business.id);
      
    // Intensify all acquisition efforts
    await this.maximizeAcquisitionEfforts(business);
    
    // Notify user
    await resend.emails.send({
      from: 'Launchfly <guarantees@launchfly.ai>',
      to: business.user.email,
      subject: '🆓 Your Launchfly Service is Now FREE Until You Reach $1,000',
      html: `
        <h2>We're Working for FREE Until You Succeed</h2>
        
        <p>We promised you'd make $1,000 in 60 days. Since we haven't delivered yet, 
        your Launchfly service is now completely FREE until you reach that target.</p>
        
        <p><strong>Here's what we're doing:</strong></p>
        <ul>
          <li>✅ All fees waived until you hit $1,000</li>
          <li>✅ Intensified AI marketing efforts</li>
          <li>✅ Priority support from our team</li>
          <li>✅ New customer acquisition strategies deployed</li>
        </ul>
        
        <p>We don't make money until you do. That's our promise.</p>
        
        <p>Watch your dashboard for updates!</p>
      `
    });
  }

  /**
   * Intensify efforts when deadline approaches
   */
  async intensifyEfforts(business, revenueNeeded, daysLeft) {
    console.log(`🔥 Intensifying efforts: $${revenueNeeded} needed in ${daysLeft} days`);
    
    // Log urgency
    await supabase
      .from('ai_activities')
      .insert({
        business_id: business.id,
        type: 'guarantee_urgency',
        icon: '⚡',
        message: `Guarantee deadline approaching: $${revenueNeeded} needed in ${daysLeft} days`,
        details: 'AI is intensifying all customer acquisition efforts',
        metadata: {
          revenue_needed: revenueNeeded,
          days_remaining: daysLeft
        }
      });
      
    // Trigger emergency acquisition protocols
    await this.triggerEmergencyAcquisition(business, revenueNeeded);
  }

  /**
   * Emergency customer acquisition when deadline is near
   */
  async triggerEmergencyAcquisition(business, revenueTarget) {
    // This would integrate with your acquisition engine
    // For now, we'll outline the strategy
    
    const emergencyStrategies = [
      {
        channel: 'paid_ads',
        budget: Math.min(revenueTarget * 0.3, 300), // 30% of target or $300 max
        urgency: 'immediate'
      },
      {
        channel: 'email_blast',
        volume: 1000,
        offer: '50% off today only'
      },
      {
        channel: 'social_media_blitz',
        platforms: ['twitter', 'linkedin', 'facebook'],
        posts_per_day: 20
      },
      {
        channel: 'affiliate_activation',
        commission: '30%',
        urgency: 'high'
      }
    ];
    
    // Log emergency activation
    await supabase
      .from('guarantee_emergency_actions')
      .insert({
        business_id: business.id,
        revenue_target: revenueTarget,
        strategies: emergencyStrategies,
        activated_at: new Date()
      });
  }

  /**
   * Notify user of guarantee success
   */
  async notifyGuaranteeSuccess(business, type) {
    const messages = {
      first_sale: {
        subject: '🎉 First Sale Made! Guarantee Delivered!',
        icon: '🎉',
        activity: 'First sale guarantee met successfully'
      },
      revenue_target: {
        subject: '🎊 $1,000 Revenue Target Achieved!',
        icon: '🎊',
        activity: '$1,000 revenue guarantee completed'
      }
    };
    
    const message = messages[type];
    
    await supabase
      .from('ai_activities')
      .insert({
        business_id: business.id,
        type: 'guarantee_success',
        icon: message.icon,
        message: message.activity,
        details: 'Promise made, promise kept!',
        metadata: { guarantee_type: type }
      });
  }

  /**
   * Schedule automated guarantee checks
   */
  async scheduleGuaranteeChecks(businessId, guarantee) {
    // In production, use a job scheduler like Inngest
    // For now, we'll create scheduled check records
    
    await supabase
      .from('scheduled_guarantee_checks')
      .insert([
        {
          business_id: businessId,
          guarantee_id: guarantee.id,
          check_type: 'first_sale',
          scheduled_for: guarantee.first_sale_deadline,
          status: 'pending'
        },
        {
          business_id: businessId,
          guarantee_id: guarantee.id,
          check_type: 'revenue_target',
          scheduled_for: guarantee.revenue_target_deadline,
          status: 'pending'
        }
      ]);
  }
}

// Export singleton
let guaranteeEngine = null;

export function getRevenueGuaranteeEngine() {
  if (!guaranteeEngine) {
    guaranteeEngine = new RevenueGuaranteeEngine();
  }
  return guaranteeEngine;
}
