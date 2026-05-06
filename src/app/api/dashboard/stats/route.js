// /api/dashboard/stats - Fetch real dashboard data from database
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return new Response(JSON.stringify({ error: 'businessId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ──── FETCH: Active Agents (from assistants table) ────
    const { data: assistants, error: assistantsError } = await supabase
      .from('assistants')
      .select('id, name, active, created_at, updated_at')
      .eq('business_id', businessId)
      .eq('active', true)
      .limit(10);

    if (assistantsError) {
      console.error('Assistants fetch error:', assistantsError);
    }

    // ──── FETCH: Active Tasks (from agent_tasks) ────
    const { data: agentTasks, error: tasksError } = await supabase
      .from('agent_tasks')
      .select('id, status, goal, steps_used, created_at, updated_at, messages, result')
      .eq('business_id', businessId)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (tasksError) {
      console.error('Agent tasks fetch error:', tasksError);
    }

    // ──── FETCH: Recent Leads ────
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, name, phone, email, status, notes, source, created_at, updated_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (leadsError) {
      console.error('Leads fetch error:', leadsError);
    }

    // ──── FETCH: Recent Customers ────
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, name, email, phone, status, total_spent, last_order_date, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (customersError) {
      console.error('Customers fetch error:', customersError);
    }

    // ──── CALCULATE: Statistics ────
    const stats = {
      // Pipeline value - sum total_spent from customers
      pipeline: customers?.reduce((sum, c) => sum + (c.total_spent || 0), 0) || 0,

      // Active agents count
      activeAgents: assistants?.filter(a => a.active)?.length || 0,
      totalAgents: assistants?.length || 0,

      // Active leads (from leads table)
      activeLeads: leads?.filter(l => ['new', 'contacted', 'qualified'].includes(l.status))?.length || 0,
      totalLeads: leads?.length || 0,

      // Active tasks count
      activeAgentTasks: agentTasks?.filter(t => ['running', 'pending'].includes(t.status))?.length || 0,
      completedTasks: agentTasks?.filter(t => t.status === 'completed')?.length || 0,
      totalTasks: agentTasks?.length || 0,

      // Customer metrics
      totalCustomers: customers?.length || 0,
      totalRevenue: customers?.reduce((sum, c) => sum + (c.total_spent || 0), 0) || 0,
    };

    // ──── FORMAT: Agent cards (limit to 3-4 for display) ────
    const agentCards = (assistants || [])
      .slice(0, 4)
      .map((agent, idx) => {
        // Find most recent task for this assistant
        const agentTask = agentTasks?.find(t => t.goal?.includes(agent.name));
        return {
          id: agent.id,
          name: agent.name,
          status: agentTask?.status || 'idle',
          lastUpdated: agentTask?.updated_at || agent.updated_at,
          taskGoal: agentTask?.goal || `Autonomous operations for ${agent.name}`,
          stepsUsed: agentTask?.steps_used || 0,
        };
      });

    // ──── FORMAT: Recent activity log (from agent_tasks) ────
    const activityLog = (agentTasks || [])
      .slice(0, 5)
      .map(task => ({
        timestamp: task.updated_at || task.created_at,
        type: task.status,
        message: task.goal,
        result: task.result?.slice(0, 100),
      }));

    // ──── FORMAT: Recent leads for "Live Action" section ────
    const recentLeads = (leads || [])
      .slice(0, 5)
      .map(lead => ({
        id: lead.id,
        name: lead.name || 'Unknown Lead',
        status: lead.status || 'new',
        notes: lead.notes || `Contact: ${lead.phone || lead.email || 'No contact'}`,
        createdAt: lead.created_at,
        source: lead.source,
      }));

    return Response.json({
      stats,
      agents: agentCards,
      activityLog,
      leads: recentLeads,
      customers: customers?.slice(0, 5) || [],
      meta: {
        assistantsCount: assistants?.length || 0,
        leadsCount: leads?.length || 0,
        customersCount: customers?.length || 0,
        tasksCount: agentTasks?.length || 0,
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch dashboard data' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
