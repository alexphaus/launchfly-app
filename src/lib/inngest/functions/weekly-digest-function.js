/**
 * Weekly Digest Inngest Function
 * 
 * The only scheduled function we keep - runs once a week
 * Generates data-driven digests without expensive AI calls
 */

import { inngest } from '../client.js';
import { WeeklyDigest } from '@/lib/ai-cofounder/weekly-digest.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Weekly digest generation - runs every Monday at 9 AM
 * This is cheap because it only reads data, no AI calls
 */
export const generateWeeklyDigests = inngest.createFunction(
  {
    id: 'minimal-ai-weekly-digest',
    name: 'Generate Weekly Business Digests',
    concurrency: {
      limit: 5,
      key: 'weekly-digest'
    }
  },
  { cron: '0 9 * * 1' }, // Monday at 9 AM
  async ({ event, step }) => {
    console.log('📊 Generating weekly digests for all businesses...');

    // Get all businesses with AI enabled
    const businesses = await step.run('get-businesses', async () => {
      const { data } = await supabase
        .from('businesses')
        .select('id, name, form_data')
        .eq('ai_enabled', true)
        .eq('status', 'ready');
      
      return data || [];
    });

    if (businesses.length === 0) {
      return { message: 'No businesses with AI enabled' };
    }

    console.log(`Found ${businesses.length} businesses to generate digests for`);

    // Generate digest for each business
    const results = [];
    for (const business of businesses) {
      const result = await step.run(`generate-digest-${business.id}`, async () => {
        try {
          const digest = new WeeklyDigest(business.id);
          const digestData = await digest.generateDigest();
          
          if (!digestData) {
            return { businessId: business.id, success: false, error: 'Failed to generate digest' };
          }

          // Send digest email to business owner if they have email
          const ownerEmail = business.form_data?.email;
          if (ownerEmail && digestData.highlights.length > 0) {
            await sendDigestEmail(ownerEmail, business.name, digestData);
          }

          return { 
            businessId: business.id, 
            success: true, 
            highlights: digestData.highlights.length,
            concerns: digestData.concerns.length,
            hasGoal: !!digestData.currentGoal
          };
        } catch (error) {
          console.error(`Error generating digest for business ${business.id}:`, error);
          return { businessId: business.id, success: false, error: error.message };
        }
      });

      results.push(result);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`✅ Weekly digests completed: ${successful} successful, ${failed} failed`);

    return {
      success: true,
      businesses: businesses.length,
      successful,
      failed,
      results
    };
  }
);

/**
 * Send digest email to business owner
 */
async function sendDigestEmail(email, businessName, digestData) {
  try {
    // Simple email template (no AI needed)
    const subject = `Weekly Update: ${businessName}`;
    
    const highlights = digestData.highlights.map(h => `• ${h}`).join('\n');
    const concerns = digestData.concerns.length > 0 
      ? `\n\nAreas to focus on:\n${digestData.concerns.map(c => `• ${c}`).join('\n')}`
      : '';
    
    const goalSection = digestData.currentGoal
      ? `\n\nWeekly Goal: ${digestData.currentGoal.description}\nProgress: ${digestData.goalProgress?.percentage || 0}%`
      : '\n\nReady to set a weekly goal? Reply to this email with your goal for this week.';

    const message = `Hi there!

Here's your weekly business update for ${businessName}:

This week's highlights:
${highlights}${concerns}${goalSection}

Keep up the great work!

Your AI Cofounder
--
Reply to this email to chat with your AI or set a new weekly goal.`;

    // Send via Resend (assuming it's configured)
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    await resend.emails.send({
      from: 'AI Cofounder <ai@launchfly.com>',
      to: email,
      subject,
      text: message
    });

    console.log(`📧 Weekly digest sent to ${email}`);
  } catch (error) {
    console.error('Error sending digest email:', error);
    // Don't throw - email failure shouldn't break digest generation
  }
}

export const weeklyDigestFunctions = [
  generateWeeklyDigests
];

