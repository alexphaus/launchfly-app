import { inngest, EVENTS } from '../client';
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

/**
 * Automated Cold Email Outreach System
 * Handles prospect research, email generation, and sending
 */
export const coldEmailOutreach = inngest.createFunction(
  {
    id: 'cold-email-outreach',
    name: 'Cold Email Outreach Campaign',
    retries: 3,
    concurrency: {
      limit: 10, // Limit concurrent campaigns
    },
    throttle: {
      // Rate limit to avoid spam flags
      limit: 50,
      period: '1h',
    }
  },
  { event: EVENTS.COLD_OUTREACH_REQUESTED },
  async ({ event, step }) => {
    const { businessId, businessData, targetAudience, campaignGoal } = event.data;
    
    // Step 1: Generate prospect list based on target audience
    const prospects = await step.run('generate-prospects', async () => {
      const prompt = `
        Based on this business: ${businessData.businessName}
        Target audience: ${targetAudience || businessData.targetAudience}
        Products/Services: ${JSON.stringify(businessData.products)}
        
        Generate a list of 10 ideal prospect profiles (not real names) with:
        - Industry/Role
        - Company Size
        - Pain Points
        - Why they'd benefit from our solution
        
        Format as JSON array.
      `;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });
      
      const data = JSON.parse(response.choices[0].message.content);
      return data.prospects || [];
    });
    
    // Step 2: Generate personalized email templates
    const emailTemplates = await step.run('generate-email-templates', async () => {
      const templates = [];
      
      // Generate 3 different email variations for A/B testing
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
          model: "gpt-4-turbo-preview",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.8,
        });
        
        templates.push(JSON.parse(response.choices[0].message.content));
      }
      
      return templates;
    });
    
    // Step 3: Create outreach campaign in database
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
    
    // Step 4: Send emails in batches
    const batchSize = 10;
    const results = [];
    
    for (let i = 0; i < prospects.length; i += batchSize) {
      const batch = prospects.slice(i, i + batchSize);
      
      const batchResults = await step.run(`send-email-batch-${i}`, async () => {
        const batchSendResults = [];
        
        for (const prospect of batch) {
          // Select random template for A/B testing
          const template = emailTemplates[Math.floor(Math.random() * emailTemplates.length)];
          
          // Personalize the email
          const personalizedEmail = {
            subject: template.subject
              .replace('{{company}}', prospect.company || 'your company')
              .replace('{{industry}}', prospect.industry || 'your industry'),
            body: template.body
              .replace('{{firstName}}', prospect.firstName || 'there')
              .replace('{{company}}', prospect.company || 'your company')
              .replace('{{painPoint}}', prospect.painPoint || 'growing your business')
              .replace('{{benefit}}', prospect.benefit || 'increased efficiency')
          };
          
          // In production, you would send real emails here
          // For now, we'll simulate sending
          if (process.env.NODE_ENV === 'production' && prospect.email) {
            try {
              await resend.emails.send({
                from: 'Outreach <outreach@launchfly.ai>',
                to: prospect.email,
                subject: personalizedEmail.subject,
                html: personalizedEmail.body,
                tags: [{
                  name: 'campaign_id',
                  value: campaign.id
                }]
              });
              
              batchSendResults.push({
                prospect: prospect.id,
                status: 'sent',
                template_used: emailTemplates.indexOf(template)
              });
            } catch (error) {
              batchSendResults.push({
                prospect: prospect.id,
                status: 'failed',
                error: error.message
              });
            }
          } else {
            // Simulation mode
            batchSendResults.push({
              prospect: prospect.id,
              status: 'simulated',
              template_used: emailTemplates.indexOf(template),
              email: personalizedEmail
            });
          }
        }
        
        return batchSendResults;
      });
      
      results.push(...batchResults);
      
      // Wait between batches to avoid rate limits
      if (i + batchSize < prospects.length) {
        await step.sleep(`batch-delay-${i}`, '30s');
      }
    }
    
    // Step 5: Update campaign metrics
    await step.run('update-campaign-metrics', async () => {
      const sentCount = results.filter(r => r.status === 'sent' || r.status === 'simulated').length;
      
      await supabase
        .from('outreach_campaigns')
        .update({
          'metrics.sent': sentCount,
          last_batch_sent_at: new Date().toISOString()
        })
        .eq('id', campaign.id);
    });
    
    // Step 6: Schedule follow-up sequence
    await step.sendEvent('schedule-followups', {
      name: EVENTS.COLD_OUTREACH_FOLLOWUP,
      data: {
        campaignId: campaign.id,
        businessId,
        results,
        followUpDay: 3
      },
      ts: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days later
    });
    
    return {
      success: true,
      campaign_id: campaign.id,
      emails_sent: results.length,
      templates_used: emailTemplates.length,
      results
    };
  }
);