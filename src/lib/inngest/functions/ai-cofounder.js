// src/lib/inngest/functions/ai-cofounder.js
/**
 * Inngest functions for AI Cofounder operations
 * Handles automated follow-ups, nurturing, and lead management
 */

import { inngest } from '../client';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import AICofounder, { LeadScoring, FollowUpCadence, ContentPersonalizer } from '../../ai-cofounder/core';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Daily AI Cofounder operations
 */
export const dailyAICofounderOperations = inngest.createFunction(
  {
    id: 'ai-cofounder-daily-operations',
    name: 'AI Cofounder Daily Operations',
    concurrency: {
      limit: 5,
      key: 'event.data.businessId'
    }
  },
  { cron: '0 9 * * *' }, // Run at 9 AM daily
  async ({ event, step }) => {
    console.log('🤖 Starting AI Cofounder daily operations');

    // Get all active businesses
    const { data: businesses } = await step.run('get-active-businesses', async () => {
      const { data } = await supabase
        .from('businesses')
        .select('id, business_data')
        .eq('status', 'active')
        .not('ai_cofounder_enabled', 'is', false);
      
      return { data };
    });

    // Run operations for each business
    const results = await step.run('run-operations', async () => {
      const operationResults = [];
      
      for (const business of businesses || []) {
        try {
          const aiCofounder = new AICofounder(business.id);
          const result = await aiCofounder.runDailyOperations();
          operationResults.push({
            businessId: business.id,
            success: true,
            result
          });
        } catch (error) {
          console.error(`Error running operations for business ${business.id}:`, error);
          operationResults.push({
            businessId: business.id,
            success: false,
            error: error.message
          });
        }
      }
      
      return operationResults;
    });

    return {
      success: true,
      businessesProcessed: results.length,
      results
    };
  }
);

/**
 * Send automated follow-up
 */
export const sendFollowUp = inngest.createFunction(
  {
    id: 'ai-cofounder-send-followup',
    name: 'Send AI Cofounder Follow-up',
    concurrency: {
      limit: 10
    }
  },
  { event: 'ai-cofounder/send-followup' },
  async ({ event, step }) => {
    const { businessId, leadId, content, attemptNumber, temperature } = event.data;

    // Get lead and business data
    const [lead, business] = await step.run('get-data', async () => {
      const { data: leadData } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();
      
      const { data: businessData } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
      
      return [leadData, businessData];
    });

    if (!lead || !business) {
      throw new Error('Lead or business not found');
    }

    // Send the follow-up email
    const emailResult = await step.run('send-email', async () => {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { border-bottom: 2px solid #007BFF; padding-bottom: 10px; margin-bottom: 20px; }
            .content { margin: 20px 0; }
            .cta { display: inline-block; background: #007BFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
            .ps { margin-top: 20px; font-style: italic; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              ${content.body.replace(/\n/g, '<br>')}
            </div>
            ${content.cta ? `<a href="${business.business_data?.website || '#'}" class="cta">${content.cta}</a>` : ''}
            <div class="footer">
              <p>Best regards,<br>${business.business_data?.founderName || 'The Team'}<br>${business.business_data?.businessName}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const result = await resend.emails.send({
        from: `${business.business_data?.businessName} <${business.business_data?.emailFrom || 'hello@launchfly.ai'}>`,
        to: lead.email,
        subject: content.subject,
        html: emailHtml,
        reply_to: business.business_data?.emailReplyTo || 'hello@launchfly.ai',
        tags: [
          { name: 'type', value: 'follow_up' },
          { name: 'attempt', value: attemptNumber.toString() },
          { name: 'temperature', value: temperature }
        ]
      });

      return result;
    });

    // Update follow-up record
    await step.run('update-records', async () => {
      // Update follow-up status
      await supabase
        .from('follow_ups')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('lead_id', leadId)
        .eq('attempt_number', attemptNumber);

      // Update lead record
      await supabase
        .from('leads')
        .update({
          last_contact_date: new Date().toISOString(),
          follow_up_count: attemptNumber,
          email_count: lead.email_count + 1
        })
        .eq('id', leadId);

      // Record interaction
      await supabase
        .from('lead_interactions')
        .insert({
          lead_id: leadId,
          business_id: businessId,
          type: 'email_sent',
          channel: 'email',
          details: {
            type: 'follow_up',
            attempt: attemptNumber,
            subject: content.subject
          }
        });

      // Log AI activity
      await supabase
        .from('ai_activities')
        .insert({
          business_id: businessId,
          type: 'follow_up_sent',
          description: `Sent follow-up #${attemptNumber} to ${lead.name}`,
          data: {
            lead_id: leadId,
            temperature,
            attempt: attemptNumber
          }
        });
    });

    return {
      success: true,
      leadId,
      attemptNumber,
      emailId: emailResult.id
    };
  }
);

/**
 * Send nurturing content
 */
export const sendNurturingContent = inngest.createFunction(
  {
    id: 'ai-cofounder-send-nurturing',
    name: 'Send Nurturing Content',
    concurrency: {
      limit: 10
    }
  },
  { event: 'ai-cofounder/send-nurturing' },
  async ({ event, step }) => {
    const { businessId, leadId, content, contentType } = event.data;

    // Get lead and business data
    const [lead, business] = await step.run('get-data', async () => {
      const { data: leadData } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();
      
      const { data: businessData } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
      
      return [leadData, businessData];
    });

    // Send nurturing email
    const emailResult = await step.run('send-nurturing-email', async () => {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .preview { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 16px; }
            .content { margin: 20px 0; }
            .resource-box { background: #e3f2fd; padding: 20px; border-radius: 8px; border-left: 4px solid #2196f3; margin: 20px 0; }
            .cta { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .ps { margin-top: 30px; padding: 15px; background: #fff3cd; border-radius: 6px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="preview">${content.preview}</div>
            <div class="content">
              ${content.content.replace(/\n/g, '<br>')}
            </div>
            ${content.ps_message ? `<div class="ps">P.S. ${content.ps_message}</div>` : ''}
            <div class="footer">
              <p>Providing value to ${lead.company || 'your business'},<br>${business.business_data?.founderName || 'The Team'}<br>${business.business_data?.businessName}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const result = await resend.emails.send({
        from: `${business.business_data?.businessName} <${business.business_data?.emailFrom || 'insights@launchfly.ai'}>`,
        to: lead.email,
        subject: content.subject,
        html: emailHtml,
        reply_to: business.business_data?.emailReplyTo || 'hello@launchfly.ai',
        tags: [
          { name: 'type', value: 'nurturing' },
          { name: 'content_type', value: contentType }
        ]
      });

      return result;
    });

    // Update records
    await step.run('update-nurturing-records', async () => {
      await supabase
        .from('lead_nurturing')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('lead_id', leadId)
        .eq('content_type', contentType)
        .order('created_at', { ascending: false })
        .limit(1);

      await supabase
        .from('lead_interactions')
        .insert({
          lead_id: leadId,
          business_id: businessId,
          type: 'email_sent',
          channel: 'email',
          details: {
            type: 'nurturing',
            content_type: contentType,
            subject: content.subject
          }
        });
    });

    return {
      success: true,
      leadId,
      contentType,
      emailId: emailResult.id
    };
  }
);

/**
 * Reactivation campaign for cold leads
 */
export const reactivationCampaign = inngest.createFunction(
  {
    id: 'ai-cofounder-reactivation',
    name: 'Lead Reactivation Campaign',
    concurrency: {
      limit: 5
    }
  },
  { event: 'ai-cofounder/reactivation-campaign' },
  async ({ event, step }) => {
    const { businessId, leadId, lastContactDays } = event.data;

    // Get data
    const [lead, business] = await step.run('get-reactivation-data', async () => {
      const { data: leadData } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();
      
      const { data: businessData } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
      
      return [leadData, businessData];
    });

    // Generate reactivation message
    const reactivationContent = await step.run('generate-reactivation', async () => {
      return await ContentPersonalizer.generateFollowUp(
        lead,
        business,
        1, // Reset attempt number for reactivation
        {
          previousInteractions: 0,
          temperature: 'cold',
          isReactivation: true,
          daysSinceContact: lastContactDays
        }
      );
    });

    // Send reactivation email with special offer or value
    await step.run('send-reactivation', async () => {
      await inngest.send({
        name: 'ai-cofounder/send-followup',
        data: {
          businessId,
          leadId,
          content: {
            ...reactivationContent,
            subject: `${lead.name}, quick question for you`,
            body: reactivationContent.body + '\n\nP.S. I noticed we haven\'t connected in a while. If our service isn\'t the right fit, just let me know and I\'ll stop reaching out.'
          },
          attemptNumber: 1,
          temperature: 'cold'
        }
      });
    });

    // Update lead status
    await step.run('update-lead-status', async () => {
      await supabase
        .from('leads')
        .update({
          status: 'contacted',
          conversation_stage: 'reactivation',
          ai_notes: `Reactivation campaign started after ${lastContactDays} days of inactivity`
        })
        .eq('id', leadId);
    });

    return {
      success: true,
      leadId,
      reactivated: true
    };
  }
);

/**
 * Process email responses and update lead scores
 */
export const processEmailResponse = inngest.createFunction(
  {
    id: 'ai-cofounder-process-response',
    name: 'Process Email Response',
    concurrency: {
      limit: 10
    }
  },
  { event: 'email/response-received' },
  async ({ event, step }) => {
    const { businessId, leadEmail, responseContent, sentiment } = event.data;

    // Get lead
    const lead = await step.run('get-lead', async () => {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('business_id', businessId)
        .eq('email', leadEmail)
        .single();
      
      return data;
    });

    if (!lead) {
      // Create new lead from response
      const newLead = await step.run('create-lead', async () => {
        const { data } = await supabase
          .from('leads')
          .insert({
            business_id: businessId,
            email: leadEmail,
            name: leadEmail.split('@')[0], // Extract name from email
            status: 'contacted',
            source: 'email_response'
          })
          .select()
          .single();
        
        return data;
      });
      
      lead = newLead;
    }

    // Record interaction
    await step.run('record-response', async () => {
      await supabase
        .from('lead_interactions')
        .insert({
          lead_id: lead.id,
          business_id: businessId,
          type: 'reply_received',
          channel: 'email',
          details: {
            sentiment,
            contentLength: responseContent.length
          }
        });

      // Update lead score based on response
      const currentScore = lead.score || 0;
      const scoreBoost = sentiment === 'positive' ? 30 : sentiment === 'neutral' ? 15 : 5;
      const newScore = currentScore + scoreBoost;

      await supabase
        .from('leads')
        .update({
          score: newScore,
          last_contact_date: new Date().toISOString(),
          status: sentiment === 'positive' ? 'hot' : 'warm'
        })
        .eq('id', lead.id);
    });

    // Notify user of hot lead if positive sentiment
    if (sentiment === 'positive') {
      await step.run('notify-hot-lead', async () => {
        await supabase
          .from('notifications')
          .insert({
            business_id: businessId,
            type: 'hot_lead',
            priority: 'high',
            title: `🔥 Hot Lead Response: ${lead.name || lead.email}`,
            message: `Positive response received! They seem interested in your service.`,
            data: { lead_id: lead.id, response_preview: responseContent.substring(0, 100) }
          });
      });
    }

    return {
      success: true,
      leadId: lead.id,
      sentiment,
      scoreUpdated: true
    };
  }
);

// Export all functions
export const aiCofounderFunctions = [
  dailyAICofounderOperations,
  sendFollowUp,
  sendNurturingContent,
  reactivationCampaign,
  processEmailResponse
];
