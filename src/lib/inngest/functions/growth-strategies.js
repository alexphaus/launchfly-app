// src/lib/inngest/functions/growth-strategies.js
/**
 * Growth Strategy Inngest Functions
 * 
 * Handles business growth activities including:
 * - Customer acquisition campaigns
 * - Cold email outreach automation
 * - Content marketing
 * - Growth experiments
 */

import { inngest, EventTypes } from "@/lib/inngest";
import { growBusiness } from "@/core/grow";
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Growth strategy orchestrator
 * Coordinates all growth activities for a business
 */
export const growthStrategyOrchestrator = inngest.createFunction(
  {
    id: "growth-strategy-orchestrator",
    name: "Growth Strategy Orchestrator",
    retries: 1,
    concurrency: {
      limit: 5,
      key: "event.data.businessId"
    }
  },
  { event: EventTypes.GROWTH_STRATEGY_STARTED },
  async ({ event, step }) => {
    const { businessId, businessData, strategies } = event.data;
    
    console.log(`📈 Starting growth orchestration for business: ${businessId}`);
    
    try {
      // Step 1: Run core growth analysis
      const growthMetrics = await step.run("analyze-growth-opportunities", async () => {
        console.log(`🔍 Analyzing growth opportunities for business: ${businessId}`);
        
        const result = await growBusiness(businessData, businessId);
        
        // Update business with growth data
        await supabase
          .from('businesses')
          .update({ 
            growth_data: result,
            updated_at: new Date().toISOString()
          })
          .eq('id', businessId);
        
        return result;
      });
      
      // Step 2: Start customer acquisition if requested
      if (strategies.includes('customer-acquisition')) {
        await step.run("trigger-customer-acquisition", async () => {
          await inngest.send({
            name: EventTypes.CUSTOMER_ACQUISITION_STARTED,
            data: { 
              businessId, 
              businessData: { ...businessData, growthMetrics },
              strategy: 'multi-channel'
            }
          });
        });
      }
      
      // Step 3: Start cold email campaign if requested
      if (strategies.includes('cold-outreach')) {
        await step.run("trigger-cold-email-campaign", async () => {
          await inngest.send({
            name: EventTypes.COLD_EMAIL_CAMPAIGN_STARTED,
            data: { 
              businessId, 
              businessData: { ...businessData, growthMetrics },
              campaign: {
                type: 'initial-outreach',
                targetSize: 100,
                industry: businessData.business_data?.industry
              }
            }
          });
        });
      }
      
      // Step 4: Schedule follow-up growth analysis
      await step.sleep("wait-for-initial-results", "24h");
      
      await step.run("schedule-growth-review", async () => {
        await inngest.send({
          name: EventTypes.GROWTH_EXPERIMENT_COMPLETED,
          data: { 
            businessId,
            experimentType: 'initial-growth-phase',
            scheduledAt: new Date().toISOString()
          }
        });
      });
      
      return {
        success: true,
        businessId,
        strategiesLaunched: strategies,
        growthMetrics
      };
      
    } catch (error) {
      console.error(`❌ Growth strategy failed for business: ${businessId}`, error);
      throw error;
    }
  }
);

/**
 * Customer acquisition function
 * Handles multi-channel customer acquisition campaigns
 */
export const customerAcquisitionCampaign = inngest.createFunction(
  {
    id: "customer-acquisition-campaign",
    name: "Customer Acquisition Campaign",
    retries: 2
  },
  { event: EventTypes.CUSTOMER_ACQUISITION_STARTED },
  async ({ event, step }) => {
    const { businessId, businessData, strategy } = event.data;
    
    console.log(`🎯 Starting customer acquisition for business: ${businessId}`);
    
    // Step 1: Generate target customer profiles
    const targetProfiles = await step.run("generate-target-profiles", async () => {
      const business = businessData.business_data;
      
      // AI-generated target customer profiles based on business
      const profiles = [
        {
          demographic: "Small business owners",
          painPoints: [business.painPoint],
          channels: ["LinkedIn", "Email", "Content Marketing"],
          budget: "$100-$1000",
          urgency: "High"
        },
        {
          demographic: "Freelancers and consultants", 
          painPoints: [business.painPoint],
          channels: ["Twitter", "Email", "Communities"],
          budget: "$50-$500",
          urgency: "Medium"
        }
      ];
      
      return profiles;
    });
    
    // Step 2: Create lead magnets and content
    const leadMagnets = await step.run("create-lead-magnets", async () => {
      return [
        {
          type: "guide",
          title: `Ultimate Guide to ${businessData.business_data?.industry} Success`,
          format: "PDF",
          targetProfile: targetProfiles[0]
        },
        {
          type: "template", 
          title: `${businessData.business_data?.valueProposition} Template`,
          format: "Downloadable",
          targetProfile: targetProfiles[1]
        }
      ];
    });
    
    // Step 3: Launch acquisition channels
    const campaigns = await step.run("launch-acquisition-channels", async () => {
      const launchedCampaigns = [];
      
      for (const profile of targetProfiles) {
        for (const channel of profile.channels) {
          const campaign = {
            id: `${businessId}-${channel}-${Date.now()}`,
            businessId,
            channel,
            targetProfile: profile,
            status: 'active',
            startedAt: new Date().toISOString()
          };
          
          launchedCampaigns.push(campaign);
          
          // Store campaign in database
          await supabase
            .from('marketing_campaigns')
            .insert({
              business_id: businessId,
              campaign_data: campaign,
              channel,
              status: 'active'
            });
        }
      }
      
      return launchedCampaigns;
    });
    
    // Step 4: Schedule performance review
    await step.sleep("wait-for-campaign-data", "7d");
    
    await step.run("review-campaign-performance", async () => {
      // Analyze campaign performance and optimize
      console.log(`📊 Reviewing campaign performance for business: ${businessId}`);
      
      // This would analyze actual performance data
      const performanceData = {
        businessId,
        reviewDate: new Date().toISOString(),
        campaigns: campaigns.length,
        status: 'reviewed'
      };
      
      await supabase
        .from('businesses')
        .update({ 
          latest_campaign_review: performanceData,
          updated_at: new Date().toISOString()
        })
        .eq('id', businessId);
    });
    
    return {
      success: true,
      businessId,
      campaignsLaunched: campaigns.length,
      targetProfiles: targetProfiles.length
    };
  }
);

/**
 * Cold email campaign orchestrator
 * Handles automated cold email outreach with AI personalization
 */
export const coldEmailCampaignOrchestrator = inngest.createFunction(
  {
    id: "cold-email-campaign-orchestrator", 
    name: "Cold Email Campaign Orchestrator",
    retries: 1
  },
  { event: EventTypes.COLD_EMAIL_CAMPAIGN_STARTED },
  async ({ event, step }) => {
    const { businessId, businessData, campaign } = event.data;
    
    console.log(`📧 Starting cold email campaign for business: ${businessId}`);
    
    // Step 1: Generate prospect list
    const prospects = await step.run("generate-prospect-list", async () => {
      const business = businessData.business_data;
      
      // AI-generated prospect list based on business type
      const generatedProspects = [];
      for (let i = 0; i < campaign.targetSize; i++) {
        generatedProspects.push({
          id: `prospect-${businessId}-${i}`,
          name: `Prospect ${i + 1}`,
          email: `prospect${i + 1}@example${i % 10}.com`,
          company: `${business.industry} Company ${i + 1}`,
          industry: business.industry,
          painPoint: business.painPoint,
          estimatedBudget: "$500-$2000",
          source: "AI Generated"
        });
      }
      
      return generatedProspects;
    });
    
    // Step 2: Generate personalized email templates
    const emailTemplates = await step.run("generate-email-templates", async () => {
      const business = businessData.business_data;
      
      return {
        subject: `Quick solution for ${business.industry} ${business.painPoint.toLowerCase()}`,
        template: `Hi {{name}},

I noticed {{company}} might be dealing with ${business.painPoint.toLowerCase()}.

We recently helped a similar ${business.industry.toLowerCase()} business ${business.valueProposition.toLowerCase()}.

The result? They saw a 40% improvement in just 30 days.

Would you be interested in a 10-minute call to see how this could work for {{company}}?

Best regards,
${business.businessName} Team

P.S. Here's a quick case study: [Link]`,
        
        followUp1: `Hi {{name}},

Following up on my email about ${business.painPoint.toLowerCase()} solutions for {{company}}.

I understand you're probably busy, but I wanted to share one quick insight that could save you hours of work this week.

[Insert specific tip related to their pain point]

Would you be open to a brief 10-minute call?

Best,
${business.businessName} Team`,

        followUp2: `Hi {{name}},

This is my final follow-up about helping {{company}} with ${business.painPoint.toLowerCase()}.

I'll assume you're either:
1. Already have this solved (awesome!)
2. Not a priority right now
3. My emails aren't reaching you

If it's #3 and you'd like to learn more, just reply "interested" and I'll send you our case study.

Best regards,
${business.businessName} Team`
      };
    });
    
    // Step 3: Send initial batch (25% of prospects)
    const initialBatch = prospects.slice(0, Math.ceil(prospects.length * 0.25));
    
    await step.run("send-initial-batch", async () => {
      console.log(`📤 Sending initial batch of ${initialBatch.length} emails`);
      
      for (const prospect of initialBatch) {
        try {
          // Personalize email
          const personalizedEmail = emailTemplates.template
            .replace(/{{name}}/g, prospect.name)
            .replace(/{{company}}/g, prospect.company);
          
          // In a real implementation, you would use a proper email service
          // For now, we'll simulate sending
          console.log(`📧 Sending email to ${prospect.email}: ${emailTemplates.subject}`);
          
          // Store email record
          await supabase
            .from('email_outreach')
            .insert({
              business_id: businessId,
              prospect_id: prospect.id,
              email_type: 'initial',
              subject: emailTemplates.subject,
              content: personalizedEmail,
              status: 'sent',
              sent_at: new Date().toISOString()
            });
          
          // Add delay between emails to avoid spam detection
          await new Promise(resolve => setTimeout(resolve, 5000));
          
        } catch (error) {
          console.error(`Failed to send email to ${prospect.email}:`, error);
        }
      }
      
      // Send batch completion event
      await inngest.send({
        name: EventTypes.COLD_EMAIL_BATCH_SENT,
        data: {
          businessId,
          batchType: 'initial',
          emailsSent: initialBatch.length,
          completedAt: new Date().toISOString()
        }
      });
    });
    
    // Step 4: Wait and send follow-up 1 (3 days later)
    await step.sleep("wait-for-followup-1", "3d");
    
    await step.run("send-followup-1", async () => {
      console.log(`📤 Sending first follow-up batch`);
      
      // Get prospects who haven't responded
      const { data: nonResponders } = await supabase
        .from('email_outreach')
        .select('prospect_id')
        .eq('business_id', businessId)
        .eq('email_type', 'initial')
        .is('response_received', null);
      
      const nonResponderIds = nonResponders?.map(r => r.prospect_id) || [];
      const followUpProspects = prospects.filter(p => nonResponderIds.includes(p.id));
      
      for (const prospect of followUpProspects.slice(0, 50)) { // Limit batch size
        const personalizedEmail = emailTemplates.followUp1
          .replace(/{{name}}/g, prospect.name)
          .replace(/{{company}}/g, prospect.company);
        
        await supabase
          .from('email_outreach')
          .insert({
            business_id: businessId,
            prospect_id: prospect.id,
            email_type: 'followup_1',
            subject: `Re: ${emailTemplates.subject}`,
            content: personalizedEmail,
            status: 'sent',
            sent_at: new Date().toISOString()
          });
        
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    });
    
    // Step 5: Wait and send final follow-up (7 days later)
    await step.sleep("wait-for-followup-2", "7d");
    
    await step.run("send-final-followup", async () => {
      console.log(`📤 Sending final follow-up batch`);
      
      // Similar logic for final follow-up
      // This would be the last automated touchpoint
    });
    
    // Step 6: Campaign analysis and reporting
    await step.run("analyze-campaign-results", async () => {
      const { data: campaignStats } = await supabase
        .from('email_outreach')
        .select('*')
        .eq('business_id', businessId);
      
      const results = {
        totalSent: campaignStats?.length || 0,
        responses: campaignStats?.filter(e => e.response_received)?.length || 0,
        meetings: campaignStats?.filter(e => e.meeting_scheduled)?.length || 0,
        conversions: 0, // Would track actual conversions
        campaignId: `campaign-${businessId}-${Date.now()}`
      };
      
      // Store campaign results
      await supabase
        .from('businesses')
        .update({ 
          latest_email_campaign: results,
          updated_at: new Date().toISOString()
        })
        .eq('id', businessId);
      
      console.log(`📊 Campaign results for business ${businessId}:`, results);
    });
    
    return {
      success: true,
      businessId,
      prospectCount: prospects.length,
      emailTemplates: Object.keys(emailTemplates).length
    };
  }
);

/**
 * Handle cold email batch sent events
 * Tracks email delivery and engagement
 */
export const handleColdEmailBatchSent = inngest.createFunction(
  {
    id: "handle-cold-email-batch-sent",
    name: "Handle Cold Email Batch Sent"
  },
  { event: EventTypes.COLD_EMAIL_BATCH_SENT },
  async ({ event }) => {
    const { businessId, batchType, emailsSent } = event.data;
    
    console.log(`📧 Batch sent for business ${businessId}: ${batchType} (${emailsSent} emails)`);
    
    // Update business metrics
    await supabase
      .from('businesses')
      .update({ 
        latest_email_batch: event.data,
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId);
    
    return { success: true };
  }
);
