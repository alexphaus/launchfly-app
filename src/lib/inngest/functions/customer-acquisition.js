/**
 * Inngest Function: Customer Acquisition via Cold Email Outreach
 * 
 * This function handles real cold email outreach for newly generated businesses,
 * replacing the simulated version with actual email sending and prospect tracking.
 */

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import OpenAI from 'openai';
import { inngest, INNGEST_EVENTS } from '../inngest.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000,
  maxRetries: 2
});

export const emailOutreachFunction = inngest.createFunction(
  { 
    id: 'email-outreach',
    name: 'Cold Email Customer Acquisition',
    retries: 1,
    timeout: '10m', // 10 minutes for email generation and sending
  },
  { event: INNGEST_EVENTS.EMAIL_OUTREACH_REQUESTED },
  async ({ event, step }) => {
    const { businessId, sessionId, businessData, opportunity } = event.data;
    
    console.log('Starting email outreach for business:', { businessId });

    // Step 1: Find prospects (placeholder for now - will integrate Apollo.io later)
    const prospects = await step.run('find-prospects', async () => {
      console.log('Finding prospects for:', businessData.businessName);
      
      // TODO: Integrate with Apollo.io API
      // For now, return mock data that could be real prospects
      const mockProspects = [
        { 
          id: 'prospect-1',
          email: 'founder@example.com', 
          name: 'John Doe', 
          company: 'Acme Corp',
          title: 'CEO',
          industry: opportunity.targetIndustry || 'Technology'
        },
        { 
          id: 'prospect-2',
          email: 'ceo@startup.com', 
          name: 'Jane Smith', 
          company: 'Growth Startup',
          title: 'Founder',
          industry: opportunity.targetIndustry || 'Technology'
        },
        { 
          id: 'prospect-3',
          email: 'director@enterprise.com', 
          name: 'Mike Johnson', 
          company: 'Enterprise Solutions',
          title: 'Director of Operations',
          industry: opportunity.targetIndustry || 'Technology'
        }
      ];
      
      console.log(`Found ${mockProspects.length} prospects for outreach`);
      return mockProspects;
    });

    // Step 2: Generate personalized emails using OpenAI
    const emails = await step.run('generate-emails', async () => {
      console.log('Generating personalized emails...');
      
      const emailPromises = prospects.map(async (prospect) => {
        const prompt = `
          Generate a personalized cold email for B2B outreach.
          
          Business Details:
          - Name: ${businessData.businessName}
          - Industry: ${opportunity.targetIndustry}
          - Value Proposition: ${opportunity.valueProposition}
          - Products/Services: ${businessData.products?.[0]?.name || 'Professional services'}
          
          Prospect Details:
          - Name: ${prospect.name}
          - Title: ${prospect.title}
          - Company: ${prospect.company}
          - Industry: ${prospect.industry}
          
          Requirements:
          - Professional and personalized tone
          - Clear value proposition
          - Specific to their industry and role
          - Include a clear call-to-action
          - Keep it under 150 words
          - Subject line should be engaging but not salesy
          
          Return JSON format:
          {
            "subject": "Subject line here",
            "body": "Email body here"
          }
        `;
        
        const response = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 500
        });
        
        const emailContent = JSON.parse(response.choices[0].message.content);
        
        return {
          prospectId: prospect.id,
          prospect,
          subject: emailContent.subject,
          body: emailContent.body
        };
      });
      
      const generatedEmails = await Promise.all(emailPromises);
      console.log(`Generated ${generatedEmails.length} personalized emails`);
      return generatedEmails;
    });

    // Step 3: Send emails via Resend and track in database
    const sentEmails = await step.run('send-emails', async () => {
      console.log('Sending emails via Resend...');
      
      const emailResults = [];
      
      for (const email of emails) {
        try {
          // Create email_outreach record first
          const { data: outreachRecord, error: insertError } = await supabase
            .from('email_outreach')
            .insert({
              business_id: businessId,
              prospect_id: email.prospectId,
              email_type: 'cold_outreach',
              subject: email.subject,
              content: email.body,
              recipient_email: email.prospect.email,
              recipient_name: email.prospect.name,
              recipient_company: email.prospect.company,
              status: 'sending'
            })
            .select()
            .single();
            
          if (insertError) {
            console.error('Failed to create outreach record:', insertError);
            continue;
          }
          
          // Send actual email via Resend
          const emailResult = await resend.emails.send({
            from: `${businessData.businessName} <hello@launchfly.ai>`,
            to: [email.prospect.email],
            subject: email.subject,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <p>Hi ${email.prospect.name},</p>
                ${email.body.split('\n').map(line => `<p>${line}</p>`).join('')}
                <p>Best regards,<br/>
                ${businessData.businessName} Team</p>
                
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #666;">
                  You received this email because we believe our solution could help ${email.prospect.company}.
                  If you'd prefer not to receive future emails, please reply with "unsubscribe".
                </p>
              </div>
            `,
            text: email.body
          });
          
          // Update outreach record with success
          await supabase
            .from('email_outreach')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString(),
              email_id: emailResult.data?.id
            })
            .eq('id', outreachRecord.id);
            
          emailResults.push({
            prospectId: email.prospectId,
            outreachId: outreachRecord.id,
            emailId: emailResult.data?.id,
            status: 'sent'
          });
          
          console.log(`Email sent to ${email.prospect.email} (ID: ${emailResult.data?.id})`);
          
          // Add delay between emails to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`Failed to send email to ${email.prospect.email}:`, error);
          
          // Update outreach record with failure
          await supabase
            .from('email_outreach')
            .update({ 
              status: 'failed',
              error_message: error.message
            })
            .eq('business_id', businessId)
            .eq('prospect_id', email.prospectId);
            
          emailResults.push({
            prospectId: email.prospectId,
            status: 'failed',
            error: error.message
          });
        }
      }
      
      console.log(`Email sending completed: ${emailResults.filter(r => r.status === 'sent').length} sent, ${emailResults.filter(r => r.status === 'failed').length} failed`);
      return emailResults;
    });

    // Step 4: Update business metrics with real data
    await step.run('update-metrics', async () => {
      console.log('Updating business metrics...');
      
      const sentCount = sentEmails.filter(email => email.status === 'sent').length;
      const failedCount = sentEmails.filter(email => email.status === 'failed').length;
      
      // Update business growth_data with real email metrics
      await supabase
        .from('businesses')
        .update({ 
          growth_data: {
            email_campaigns: {
              total_sent: sentCount,
              total_failed: failedCount,
              last_campaign_date: new Date().toISOString(),
              prospects_contacted: prospects.length
            }
          },
          latest_email_campaign: {
            id: `campaign-${Date.now()}`,
            type: 'cold_outreach',
            sent_at: new Date().toISOString(),
            emails_sent: sentCount,
            prospects: prospects.length
          }
        })
        .eq('id', businessId);
        
      // Create marketing campaign record
      const { data: campaignRecord } = await supabase
        .from('marketing_campaigns')
        .insert({
          business_id: businessId,
          channel: 'email',
          campaign_data: {
            type: 'cold_outreach',
            target_audience: prospects.map(p => ({ 
              name: p.name, 
              company: p.company, 
              industry: p.industry 
            })),
            emails_sent: sentCount,
            emails_failed: failedCount,
            strategy: 'personalized_b2b_outreach'
          },
          status: 'completed',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
        .select()
        .single();
        
      console.log('Business metrics updated with real email data');
      return {
        emailsSent: sentCount,
        emailsFailed: failedCount,
        campaignId: campaignRecord?.id
      };
    });

    console.log('Email outreach completed successfully:', { 
      businessId, 
      prospectsFound: prospects.length,
      emailsSent: sentEmails.filter(e => e.status === 'sent').length
    });
    
    return {
      success: true,
      businessId,
      prospects: prospects.length,
      emailsSent: sentEmails.filter(e => e.status === 'sent').length,
      emailsFailed: sentEmails.filter(e => e.status === 'failed').length,
      sentEmails
    };
  }
);