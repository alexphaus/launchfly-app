// src/lib/inngest/functions/cold-outreach.js
// Enhanced cold-outreach.js - Combining the best of both systems
// This merges the orchestration excellence of cold-outreach.js 
// with the real prospect/email capabilities of customer-acquisition_1.js

import { inngest, EVENTS } from '../client';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Resend } from 'resend';
import { 
  findRealProspectsWithApollo, 
  generateRealisticProspects 
} from '@/lib/customer-acquisition'; // Import from your other file

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Enhanced Cold Email Outreach System
 * Combines real prospects with sophisticated campaign management
 */
export const enhancedColdEmailOutreach = inngest.createFunction(
  {
    id: 'enhanced-cold-email-outreach',
    name: 'Enhanced Cold Email Outreach Campaign',
    retries: 3,
    concurrency: {
      limit: 10,
    },
    throttle: {
      limit: 50,
      period: '1h',
    }
  },
  { event: EVENTS.COLD_OUTREACH_REQUESTED },
  async ({ event, step }) => {
    const { businessId, businessData, targetAudience, campaignGoal } = event.data;
    const canSendRealEmails = Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL && process.env.APOLLO_API_KEY);
    
    // Step 1: Generate REAL prospect list
    const prospects = await step.run('generate-real-prospects', async () => {
      console.log('🔍 Finding REAL prospects for cold outreach...');
      
      let realProspects = [];
      
      // Try to get real prospects from Apollo.io first
      if (process.env.APOLLO_API_KEY) {
        try {
          realProspects = await findRealProspectsWithApollo(businessData, 50);
          console.log(`✅ Found ${realProspects.length} real prospects from Apollo.io`);
        } catch (error) {
          console.error('Apollo.io error:', error);
        }
      }
      
      // If we don't have enough real prospects, generate realistic ones
      if (realProspects.length < 20) {
        console.log('📦 Supplementing with realistic prospect data...');
        const additionalProspects = generateRealisticProspects(
          businessData, 
          30 - realProspects.length,
          { industry: businessData.industry }
        );
        realProspects = [...realProspects, ...additionalProspects];
      }
      
      // If no real prospects and no Apollo key, skip outreach entirely
      if (realProspects.length === 0 && !process.env.APOLLO_API_KEY) {
        console.log('✋ Skipping outreach: no Apollo key and no real prospects.');
        return [];
      }

      // Store prospects in database
      const { data: savedProspects } = await supabase
        .from('prospects')
        .insert(
          realProspects.map(p => ({
            business_id: businessId,
            name: p.name,
            email: p.email,
            company: p.company,
            industry: p.industry,
            company_size: p.company_size,
            title: p.title,
            source: p.source || 'cold_outreach_campaign',
            status: 'discovered',
            created_at: new Date().toISOString()
          }))
        )
        .select();
      
      return savedProspects || realProspects;
    });
    
    // Step 2: Generate A/B test email templates (keep this excellent feature)
    const emailTemplates = await step.run('generate-email-templates', async () => {
      const templates = [];
      
      for (let i = 0; i < 3; i++) {
        const prompt = `
          Create a cold outreach email template for:
          Business: ${businessData.businessName}
          Value Proposition: ${businessData.tagline}
          Target Audience: ${targetAudience}
          Campaign Goal: ${campaignGoal || 'Generate interest and book meetings'}
          
          Template ${i + 1} of 3 - make each unique in approach:
          ${i === 0 ? 'Focus on pain points' : ''}
          ${i === 1 ? 'Focus on benefits and ROI' : ''}
          ${i === 2 ? 'Focus on social proof and urgency' : ''}
          
          Requirements:
          - Subject line that gets 30%+ open rate
          - Personalization tokens: {{firstName}}, {{company}}, {{painPoint}}
          - Under 150 words
          - Clear CTA
          - Professional but conversational tone
          
          Format as JSON with: subject, body, cta
        `;
        
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.8,
        });
        
        templates.push(JSON.parse(response.choices[0].message.content));
      }
      
      return templates;
    });
    
    // Step 3: Create campaign record
    const campaign = await step.run('create-campaign-record', async () => {
      const { data, error } = await supabase
        .from('outreach_campaigns')
        .insert({
          business_id: businessId,
          campaign_type: 'cold_email',
          status: 'active',
          total_prospects: prospects.length,
          email_templates: emailTemplates,
          metrics: {
            sent: 0,
            opened: 0,
            clicked: 0,
            replied: 0
          },
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    });
    
    // Abort if we cannot send real emails or no prospects available
    if (!canSendRealEmails || prospects.length === 0) {
      console.log('✋ Outreach aborted: missing keys or no real prospects.');
      return {
        success: true,
        campaign_id: null,
        emails_sent: 0,
        prospects_found: prospects.length,
        templates_used: emailTemplates.length,
        results: []
      };
    }

    // Step 4: Send REAL emails in batches
    const batchSize = 10;
    const results = [];
    let actualEmailsSent = 0;
    
    // 🧪 PLACEHOLDER: Send first email to test address for demo/testing purposes
    const testProspectResults = await step.run('send-test-email', async () => {
      if (!(process.env.ENABLE_TEST_EMAILS === 'true')) return [];
      const testProspect = {
        id: 'test-prospect-cold-001',
        name: 'Alex',
        email: 'axpg31@gmail.com',
        company: 'Test Company',
        industry: businessData.business_data?.industry || 'Technology'
      };
      
      console.log('📧 Sending test cold email to axpg31@gmail.com first...');
      
      // Use the first email template for the test
      const template = emailTemplates[0];
      const personalizedEmail = {
        to: testProspect.email,
        subject: template.subject.replace(/{{companyName}}/g, testProspect.company),
        body: template.body
          .replace(/{{recipientName}}/g, testProspect.name)
          .replace(/{{companyName}}/g, testProspect.company)
          .replace(/{{productName}}/g, businessData.business_data?.businessName || 'Our Solution')
          .replace(/{{keyBenefit}}/g, businessData.business_data?.tagline || 'increased efficiency')
      };
      
      try {
        // Send REAL test email
        const { data, error } = await resend.emails.send({
          from: process.env.FROM_EMAIL || 'AI Assistant <ai@launchfly.ai>',
          to: personalizedEmail.to,
          subject: personalizedEmail.subject,
          html: formatEmailAsHTML(personalizedEmail.body, businessData),
          tags: [
            { name: 'campaign_id', value: campaign.id },
            { name: 'business_id', value: businessId },
            { name: 'is_test_email', value: 'true' }
          ]
        });
        
        if (error) throw error;
        
        // Log the test email send
        await supabase
          .from('ai_activities')
          .insert({
            business_id: businessId,
            type: 'email_sent',
            icon: '📤',
            message: `Cold email sent to axpg31@gmail.com (TEST)`,
            details: `Subject: "${personalizedEmail.subject}"`,
            metadata: {
              prospect_id: testProspect.id,
              campaign_id: campaign.id,
              is_test_email: true
            }
          });
        
        console.log('✅ Test cold email sent successfully to axpg31@gmail.com');
        actualEmailsSent++;
        
        return [{
          prospect_id: testProspect.id,
          status: 'sent',
          template_used: 0,
          resend_id: data.id,
          sent_at: new Date().toISOString(),
          is_test: true
        }];
        
      } catch (error) {
        console.error(`Failed to send test email:`, error);
        return [{
          prospect_id: testProspect.id,
          status: 'failed',
          error: error.message,
          is_test: true
        }];
      }
    });
    
    results.push(...testProspectResults);
    
    for (let i = 0; i < prospects.length; i += batchSize) {
      const batch = prospects.slice(i, i + batchSize);
      
      const batchResults = await step.run(`send-real-email-batch-${i}`, async () => {
        const batchSendResults = [];
        
        for (const prospect of batch) {
          // Skip if no valid email
          if (!prospect.email || prospect.email.includes('@example')) {
            console.log(`⚠️ Skipping invalid email: ${prospect.email}`);
            continue;
          }
          
          // Select random template for A/B testing
          const template = emailTemplates[Math.floor(Math.random() * emailTemplates.length)];
          
          // Personalize the email
          const personalizedEmail = {
            to: prospect.email,
            subject: template.subject
              .replace('{{company}}', prospect.company || 'your company')
              .replace('{{industry}}', prospect.industry || 'your industry'),
            body: template.body
              .replace('{{firstName}}', prospect.name?.split(' ')[0] || 'there')
              .replace('{{company}}', prospect.company || 'your company')
              .replace('{{painPoint}}', businessData.painPoint || 'growing your business')
              .replace('{{benefit}}', businessData.valueProposition || 'increased efficiency')
          };
          
          try {
            // Send REAL email
            const { data, error } = await resend.emails.send({
              from: process.env.FROM_EMAIL || 'AI Assistant <ai@launchfly.ai>',
              to: personalizedEmail.to,
              subject: personalizedEmail.subject,
              html: formatEmailAsHTML(personalizedEmail.body, businessData),
              tags: [
                { name: 'campaign_id', value: campaign.id },
                { name: 'business_id', value: businessId },
                { name: 'template_index', value: emailTemplates.indexOf(template).toString() }
              ]
            });
            
            if (error) throw error;
            
            actualEmailsSent++;
            batchSendResults.push({
              prospect_id: prospect.id,
              status: 'sent',
              template_used: emailTemplates.indexOf(template),
              resend_id: data.id,
              sent_at: new Date().toISOString()
            });
            
            // Log the email send
            await supabase
              .from('ai_activities')
              .insert({
                business_id: businessId,
                type: 'email_sent',
                icon: '📤',
                message: `Cold email sent to ${prospect.name} at ${prospect.company}`,
                details: `Subject: "${personalizedEmail.subject}"`,
                metadata: {
                  prospect_id: prospect.id,
                  campaign_id: campaign.id,
                  template_index: emailTemplates.indexOf(template)
                }
              });
            
          } catch (error) {
            console.error(`Failed to send email to ${prospect.email}:`, error);
            batchSendResults.push({
              prospect_id: prospect.id,
              status: 'failed',
              error: error.message
            });
          }
          
          // Delay between emails to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        return batchSendResults;
      });
      
      results.push(...batchResults);
      
      // Wait between batches
      if (i + batchSize < prospects.length) {
        await step.sleep(`batch-delay-${i}`, '30s');
      }
    }
    
    // Step 5: Update campaign metrics
    await step.run('update-campaign-metrics', async () => {
      await supabase
        .from('outreach_campaigns')
        .update({
          'metrics.sent': actualEmailsSent,
          last_batch_sent_at: new Date().toISOString()
        })
        .eq('id', campaign.id);
        
      // Log summary
      await supabase
        .from('ai_activities')
        .insert({
          business_id: businessId,
          type: 'campaign_started',
          icon: '🚀',
          message: `Cold email campaign launched: ${actualEmailsSent} emails sent`,
          details: `A/B testing ${emailTemplates.length} different templates`,
          metadata: {
            campaign_id: campaign.id,
            emails_sent: actualEmailsSent,
            templates_count: emailTemplates.length
          }
        });
    });
    
    // Step 6: Schedule follow-up sequences (keep this excellent feature)
    if (actualEmailsSent > 0) {
      await step.sendEvent('schedule-followups', {
        name: EVENTS.COLD_OUTREACH_FOLLOWUP,
        data: {
          campaignId: campaign.id,
          businessId,
          results: results.filter(r => r.status === 'sent'),
          followUpDay: 3
        },
        ts: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      });
    }
    
    return {
      success: true,
      campaign_id: campaign.id,
      emails_sent: actualEmailsSent,
      prospects_found: prospects.length,
      templates_used: emailTemplates.length,
      results
    };
  }
);

/**
 * Format email as professional HTML
 */
function formatEmailAsHTML(text, businessData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        ${text.split('\n').map(line => 
          line.trim() ? `<p style="margin: 0 0 15px 0;">${line}</p>` : '<br>'
        ).join('')}
      </div>
      
      <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 13px; color: #6c757d; text-align: center;">
        <p style="margin: 0 0 10px 0;">
          <strong>${businessData.businessName}</strong><br>
          ${businessData.tagline || 'Professional Business Solutions'}
        </p>
        <p style="margin: 0; font-size: 11px;">
          This email was sent by an AI-powered business assistant.<br>
          <a href="#" style="color: #6c757d;">Unsubscribe</a> | 
          <a href="#" style="color: #6c757d;">View in browser</a>
        </p>
      </div>
    </body>
    </html>
  `;
}