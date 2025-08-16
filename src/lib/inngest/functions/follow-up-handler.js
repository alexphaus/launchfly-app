// src/lib/inngest/functions/follow-up-handler.js
import { inngest, EVENTS } from '../client';
import { createClient } from '@supabase/supabase-js';
import { logActivity, ActivityTypes } from '@/lib/activity-logger';
import { sendObjectionResponse } from '@/lib/ai-sales-agent';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Follow-up Task Handler
 * Processes scheduled follow-up tasks for prospects with objections
 */
export const followUpHandler = inngest.createFunction(
  {
    id: "follow-up-handler",
    name: "Follow-up Task Handler",
    concurrency: {
      limit: 10,
      key: "event.data.businessId"
    }
  },
  { event: "follow-up/due" },
  async ({ event, step }) => {
    const { businessId, prospectEmail, objectionType, taskId } = event.data;
    
    console.log(`📅 Processing follow-up for ${prospectEmail} in business ${businessId}`);

    try {
      // Get business and prospect data
      const [businessResult, prospectResult] = await Promise.all([
        step.run("get-business-data", async () => {
          const { data } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', businessId)
            .single();
          return data;
        }),
        
        step.run("get-prospect-data", async () => {
          const { data } = await supabase
            .from('prospects')
            .select('*')
            .eq('email', prospectEmail)
            .eq('business_id', businessId)
            .single();
          return data;
        })
      ]);

      if (!businessResult || !prospectResult) {
        throw new Error('Business or prospect not found');
      }

      // Generate follow-up message based on objection type
      const followUpMessage = await step.run("generate-follow-up", async () => {
        const { generateObjectionResponse } = await import('@/lib/ai-sales-agent.js');
        
        const followUpPrompt = `Generate a gentle follow-up message for a prospect who previously had a ${objectionType} objection. 
        This should be a soft touch, not pushy, and offer additional value or a different angle.`;
        
        const aiResponse = await generateObjectionResponse({
          type: objectionType,
          text: followUpPrompt,
          conversationHistory: []
        }, prospectResult, businessResult);
        
        return aiResponse;
      });

      // Send follow-up email
      await step.run("send-follow-up", async () => {
        await sendObjectionResponse(businessId, prospectResult, followUpMessage);
      });

      // Update follow-up task status
      await step.run("update-task-status", async () => {
        await supabase
          .from('follow_up_tasks')
          .update({ 
            status: 'completed',
            notes: `Follow-up sent: ${followUpMessage.response.substring(0, 100)}...`,
            updated_at: new Date().toISOString()
          })
          .eq('id', taskId);
      });

      // Log the follow-up activity
      await step.run("log-follow-up", async () => {
        await logActivity(businessId, {
          type: ActivityTypes.EMAIL_SENT,
          icon: '📤',
          message: `Follow-up sent to ${prospectResult.name}`,
          details: `Previous objection: ${objectionType}`,
          metadata: {
            prospectEmail,
            objectionType,
            followUpType: 'scheduled',
            taskId
          }
        });
      });

      return { 
        success: true, 
        followUpSent: true,
        prospectEmail,
        objectionType
      };

    } catch (error) {
      console.error('Error processing follow-up:', error);
      
      // Update task status to failed
      await supabase
        .from('follow_up_tasks')
        .update({ 
          status: 'failed',
          notes: `Error: ${error.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);
      
      throw error;
    }
  }
);

/**
 * Daily Follow-up Scheduler
 * Checks for due follow-up tasks and triggers them
 */
export const followUpScheduler = inngest.createFunction(
  {
    id: "follow-up-scheduler",
    name: "Follow-up Task Scheduler",
    concurrency: {
      limit: 1
    }
  },
  { event: "cron/daily" },
  async ({ event, step }) => {
    console.log('📅 Running daily follow-up scheduler');

    try {
      // Find all due follow-up tasks
      const dueTasks = await step.run("find-due-tasks", async () => {
        const { data } = await supabase
          .from('follow_up_tasks')
          .select('*')
          .eq('status', 'scheduled')
          .lte('follow_up_date', new Date().toISOString())
          .order('follow_up_date', { ascending: true });
        
        return data || [];
      });

      console.log(`Found ${dueTasks.length} due follow-up tasks`);

      // Process each due task
      for (const task of dueTasks) {
        await step.run(`process-task-${task.id}`, async () => {
          await inngest.send({
            name: "follow-up/due",
            data: {
              businessId: task.business_id,
              prospectEmail: task.prospect_email,
              objectionType: task.objection_type,
              taskId: task.id
            }
          });
        });
      }

      return {
        success: true,
        tasksProcessed: dueTasks.length
      };

    } catch (error) {
      console.error('Error in follow-up scheduler:', error);
      throw error;
    }
  }
);
