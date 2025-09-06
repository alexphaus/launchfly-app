// src/lib/adaptive-ai-agent/index.js
import { createClient } from '@supabase/supabase-js';
import { createPlan } from './planner';
import { executeTask } from './executor';
import { reflectOnOutcome } from './reflector';
import { addMemory } from './memory';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export class AdaptiveAIAgent {
  constructor(businessId) {
    this.businessId = businessId;
    this.currentPlan = null;
  }

  /**
   * Activates the agent, creating a plan if one doesn't exist.
   */
  async start() {
    console.log(`🤖 Activating Adaptive AI Agent for business: ${this.businessId}`);
    
    // 1. Check for an active plan
    const { data: existingPlan } = await supabase
      .from('ai_plans')
      .select('*')
      .eq('business_id', this.businessId)
      .in('status', ['in_progress', 'pending'])
      .single();

    if (existingPlan) {
      this.currentPlan = existingPlan;
      console.log(`📃 Found existing plan: ${this.currentPlan.id}`);
    } else {
      // 2. If no plan, create one
      const business = await this.getBusinessData();
      if (!business) return { success: false, error: 'Business not found' };

      const objective = `Achieve first $1,000 in revenue for the business "${business.business_data?.businessName || business.name}".`;
      const newPlan = await createPlan(this.businessId, objective);
      this.currentPlan = newPlan;
      
      await supabase
        .from('businesses')
        .update({ current_plan_id: newPlan.id })
        .eq('id', this.businessId);

      await addMemory(this.businessId, `New objective set: ${objective}`, 'system_init');
    }
    
    await supabase
      .from('businesses')
      .update({ adaptive_agent_enabled: true })
      .eq('id', this.businessId);

    return { success: true, planId: this.currentPlan.id };
  }
  
  /**
   * The main "think-act" cycle of the agent.
   */
  async runCycle() {
    console.log(`🧠 Running agent cycle for business: ${this.businessId}`);
    
    // 1. Load the current plan and its tasks
    const { data: plan, error: planError } = await supabase
      .from('ai_plans')
      .select('*, ai_tasks(*)')
      .eq('business_id', this.businessId)
      .eq('status', 'in_progress')
      .order('priority', { foreignTable: 'ai_tasks', ascending: true })
      .single();

    if (planError || !plan) {
      console.log(`No active plan for business ${this.businessId}. Agent resting.`);
      return;
    }

    this.currentPlan = plan;

    // 2. Find the next task to execute
    const nextTask = this.currentPlan.ai_tasks.find(t => t.status === 'pending');
    if (!nextTask) {
      console.log(`✅ Plan ${this.currentPlan.id} has no more pending tasks. Reflecting on completion...`);
      // TODO: Add final reflection and plan completion logic
      await supabase.from('ai_plans').update({ status: 'completed' }).eq('id', this.currentPlan.id);
      return;
    }

    // 3. Execute the task
    const result = await executeTask(nextTask);

    // 4. Reflect on the outcome
    await reflectOnOutcome(this.currentPlan, nextTask, result);

    console.log(`🔄 Cycle complete for business ${this.businessId}.`);
  }

  async getBusinessData() {
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', this.businessId)
      .single();
    return data;
  }
}
