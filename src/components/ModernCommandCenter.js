'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Bot, TrendingUp, Users,
  ChevronRight, Zap, Settings,
  Clock, ArrowUpRight,
  Workflow, Database, PhoneCall, Shield, MessageSquare
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────

const ICON_MAP = {
  bot: Bot,
  database: Database,
  shield: Shield,
  phone: PhoneCall,
  workflow: Workflow,
  trending: TrendingUp,
  users: Users,
  zap: Zap,
  message: MessageSquare,
};

function getIcon(key) {
  return ICON_MAP[key] || Bot;
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatLogTime(dateStr) {
  if (!dateStr) return '--:--:--';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/^(the|a|an)\s+/i, '').trim();
}

const STATUS_BADGE = {
  // Customer / lead pipeline statuses → badge tint
  lead: { label: 'New Lead', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)', text: '#f97316' },
  new: { label: 'New', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)', text: '#f97316' },
  qualified: { label: 'Qualified', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)', text: '#3b82f6' },
  contacted: { label: 'Contacted', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)', text: '#3b82f6' },
  quoted: { label: 'Quoted', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)', text: '#f97316' },
  warranty_activated: { label: 'Warranty', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)', text: '#f97316' },
  customer: { label: 'Customer', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)', text: '#22c55e' },
  booked: { label: 'Booked', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)', text: '#22c55e' },
  converted: { label: 'Converted', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)', text: '#22c55e' },
  paid: { label: 'Paid', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)', text: '#22c55e' },
};

function getStatusBadge(status) {
  const key = (status || '').toLowerCase();
  return STATUS_BADGE[key] || { label: status || 'New', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)', text: '#f97316' };
}

function getCustomerName(c) {
  if (c?.name) return c.name;
  const parts = [c?.first_name, c?.last_name].filter(Boolean);
  if (parts.length) return parts.join(' ');
  if (c?.email) return c.email;
  if (c?.phone) return c.phone;
  return 'Unknown lead';
}

function getCustomerSummary(c) {
  if (c?.notes) return c.notes;
  if (c?.last_outbound_type) return `Last touch: ${c.last_outbound_type}`;
  if (c?.email) return c.email;
  return 'No details yet.';
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ModernCommandCenter({
  business,
  initialLeads = [],
  initialBookings = [],
  initialStats = {},
  agents: initialAgents = [],
  activities: initialActivities = [],
  pendingApproval: initialPendingApproval = null,
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [leads, setLeads] = useState(initialLeads);
  const [agents, setAgents] = useState(initialAgents);
  const [activities, setActivities] = useState(initialActivities);
  const [pendingApproval, setPendingApproval] = useState(initialPendingApproval);
  const [stats, setStats] = useState({
    activeQuotes: initialStats.activeQuotes || 0,
    pipeline: initialStats.pipeline || 0,
    booked: initialStats.booked || 0,
    agentLimit: initialStats.agentLimit || 5,
  });

  const supabase = createClientComponentClient();

  useEffect(() => {
    if (business?.id) {
      localStorage.setItem('lastBusinessId', business.id);
    }
  }, [business?.id]);

  // ── Real-time Subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    if (!business?.id) return;

    // 1. Subscribe to customers (Leads)
    const customersChannel = supabase
      .channel(`command-leads-${business.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers', filter: `business_id=eq.${business.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setLeads(prev => [payload.new, ...prev].slice(0, 20));
            setStats(prev => ({ ...prev, activeQuotes: prev.activeQuotes + 1 }));
          } else if (payload.eventType === 'UPDATE') {
            setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new : l));
          } else if (payload.eventType === 'DELETE') {
            setLeads(prev => prev.filter(l => l.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // 2. Subscribe to agent_tasks (Agent Updates)
    const tasksChannel = supabase
      .channel(`command-tasks-${business.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_tasks', filter: `business_id=eq.${business.id}` },
        (payload) => {
          const task = payload.new;
          if (!task) return;

          // Extract agent name from role to match with our local agents state
          const role = task.role || '';
          const dashIdx = role.search(/\s[—–-]\s/);
          let taskAgentName = null;
          if (dashIdx > 0 && dashIdx < 60) taskAgentName = role.substring(0, dashIdx).trim();
          else {
            const m = role.match(/You are (?:the |an? )?(?:AI )?([^.\n]+?)(?:\s+for\s|\s+working\s|\.|\n)/i);
            if (m) taskAgentName = m[1].trim().substring(0, 40);
          }

          if (taskAgentName) {
            setAgents(prev => prev.map(agent => {
              if (agent.name && normalizeName(agent.name) === normalizeName(taskAgentName)) {
                // Update this agent with task info
                const ACTIVE_STATUSES = new Set(['running', 'pending', 'paused', 'waiting_approval', 'waiting_subtask']);
                const isActive = ACTIVE_STATUSES.has(task.status);
                
                // Mirror statusToUi from page.js
                let ui = { label: 'Idle', color: '#7a7a70', mode: 'idle', pulse: false };
                if (task.status === 'running') ui = { label: 'Running', color: '#22c55e', mode: 'progress', pulse: true };
                else if (task.status === 'pending') ui = { label: 'Queued', color: '#f97316', mode: 'progress', pulse: false };
                else if (task.status === 'waiting_approval') ui = { label: 'Awaiting Approval', color: '#a855f7', mode: 'segmented', pulse: true };
                else if (task.status === 'waiting_subtask') ui = { label: 'Waiting on Sub-Agent', color: '#a855f7', mode: 'progress', pulse: true };
                else if (task.status === 'paused') ui = { label: 'Paused', color: '#a855f7', mode: 'segmented', pulse: false };
                else if (task.status === 'completed') ui = { label: 'Completed', color: '#9ca3af', mode: 'idle', pulse: false };
                else if (task.status === 'failed') ui = { label: 'Failed', color: '#ef4444', mode: 'idle', pulse: false };

                const progress = isActive
                  ? Math.min(100, Math.round(((task.steps_used || 0) / 80) * 100) || (task.status === 'pending' ? 5 : 25))
                  : 0;

                return {
                  ...agent,
                  status: task.status,
                  statusLabel: ui.label,
                  statusColor: ui.color,
                  statusMode: ui.mode,
                  pulse: ui.pulse,
                  progress,
                  taskTitle: task.goal ? task.goal.replace(/^\[DELEGATED TASK\]\s*/i, '').substring(0, 60) : agent.taskTitle,
                  hasActiveTask: isActive,
                };
              }
              return agent;
            }));
          }

          // Also update activity log if there's a tool call
          if (task.tool_log && Array.isArray(task.tool_log) && task.tool_log.length > 0) {
            const lastTool = task.tool_log[task.tool_log.length - 1];
            if (lastTool && lastTool.tool && !lastTool.tool.startsWith('__')) {
              const newActivity = {
                id: `log-${task.id}-${Date.now()}`,
                tag: taskAgentName ? taskAgentName.substring(0, 14) : 'Agent',
                color: '#3b82f6',
                text: `Used ${lastTool.tool}`, // Simplified for now
                created_at: new Date().toISOString(),
              };
              setActivities(prev => [newActivity, ...prev].slice(0, 8));
            }
          }
        }
      )
      .subscribe();

    // 3. Subscribe to agent_pending_approvals
    const approvalsChannel = supabase
      .channel(`command-approvals-${business.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_pending_approvals', filter: `business_id=eq.${business.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (!payload.new.response) {
              setPendingApproval({
                id: payload.new.id,
                taskId: payload.new.task_id,
                question: payload.new.question,
                count: 1, // simplified
                createdAt: payload.new.created_at,
              });
            } else {
              setPendingApproval(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(customersChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(approvalsChannel);
    };
  }, [business?.id]);

  const businessName = business?.business_data?.businessName || business?.name || 'Launchfly Business';
  const currency = business?.business_data?.currency || '$';

  const activeAgentsCount = agents.filter((a) => a.hasActiveTask).length;
  const totalAgents = agents.length;
  const agentLimit = stats.agentLimit;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,700;1,300&display=swap');
        
        .font-bebas { font-family: 'Bebas Neue', sans-serif; }
        .font-dm-mono { font-family: 'DM Mono', monospace; }
        .font-dm-sans { font-family: 'DM Sans', sans-serif; }
        
        .hover-border-orange { position: relative; overflow: hidden; }
        .hover-border-orange::before {
          content: ''; position: absolute; top: 0; left: 0; width: 3px; height: 100%;
          background: #f97316; opacity: 0; transition: opacity 0.3s ease;
        }
        .hover-border-orange:hover::before { opacity: 1; }
        
        .btn-ghost {
          display: inline-flex; align-items: center; gap: 0.4rem; color: #7a7a70;
          font-size: 0.9rem; padding: 0.5rem 0; border-bottom: 1px solid #2a2a26;
          transition: color 0.2s, border-color 0.2s; cursor: pointer; background: transparent;
        }
        .btn-ghost:hover { color: #f5f4ef; border-color: #f5f4ef; }

        .btn-primary {
          display: inline-flex; align-items: center; gap: 0.5rem; background: #f97316;
          color: #0a0a08; font-weight: 700; font-size: 1rem; padding: 1rem 2.2rem;
          letter-spacing: 0.03em; clip-path: polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%);
          transition: all 0.2s; position: relative; overflow: hidden;
        }
        .btn-primary::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transform: translateX(-100%); transition: transform 0.4s;
        }
        .btn-primary:hover::after { transform: translateX(100%); }
        .btn-primary:hover { background: #fb923c; transform: translateY(-1px); }
        .btn-primary-compact {
          font-size: 0.875rem;
          padding: 0.65rem 1.35rem;
          letter-spacing: 0.04em;
        }
      `}} />

      <div className="min-h-screen bg-[#0a0a08] text-[#f5f4ef] font-dm-sans text-[16px] leading-[1.6] selection:bg-[#f97316]/30 overflow-x-hidden">
        {/* Noise Texture Overlay */}
        <div 
          className="fixed inset-0 opacity-50 pointer-events-none z-0" 
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.04\'/%3E%3C/svg%3E")' }}
        ></div>

        {/* Diagonal Accent Stripe (Hero feel) */}
        <div className="fixed top-[-10%] right-[-5%] w-[55%] h-[120%] pointer-events-none z-0 opacity-40 transform -skew-x-[8deg]" style={{ background: 'linear-gradient(135deg, transparent 40%, rgba(249,115,22,0.06) 100%)', borderLeft: '1px solid rgba(249,115,22,0.12)' }}></div>

        {/* Nav */}
        <nav className="sticky top-0 z-50 border-b border-[#2a2a26] bg-[#0a0a08]/88 backdrop-blur-[12px] px-8 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="font-bebas tracking-[0.08em] text-[#f97316] text-[1.6rem]">
              {businessName}
            </span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-6 text-[0.85rem] font-dm-mono text-[#7a7a70] uppercase tracking-wider">
              <button onClick={() => setActiveTab('overview')} className={`hover:text-[#f5f4ef] transition-colors ${activeTab === 'overview' ? 'text-[#f5f4ef] border-b border-[#f97316] pb-1' : ''}`}>Overview</button>
              <button onClick={() => setActiveTab('agents')} className={`hover:text-[#f5f4ef] transition-colors flex items-center gap-2 ${activeTab === 'agents' ? 'text-[#f5f4ef] border-b border-[#f97316] pb-1' : ''}`}>
                <span className="relative flex h-2 w-2">
                  {activeAgentsCount > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f97316] opacity-75"></span>}
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f97316]"></span>
                </span>
                Swarm Agents
              </button>
              <button onClick={() => setActiveTab('customers')} className={`hover:text-[#f5f4ef] transition-colors ${activeTab === 'customers' ? 'text-[#f5f4ef] border-b border-[#f97316] pb-1' : ''}`}>Customers</button>
            </div>
            
            <button className="bg-[#f97316] text-[#0a0a08] font-bold text-[0.85rem] px-[1.4rem] py-[0.6rem] tracking-[0.04em] uppercase transition-colors hover:bg-[#fb923c]" style={{ clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)' }}>
              <span className="flex items-center gap-2"><Settings size={14} /> Settings</span>
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="relative z-10 px-8 py-6 md:py-8 max-w-[1200px] mx-auto space-y-6">
          
          {/* Header Section */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 font-dm-mono text-[0.62rem] tracking-[0.16em] text-[#f97316] uppercase mb-2 px-2.5 py-1 border border-[#f97316]/30 bg-[#f97316]/10">
                <span className="w-[5px] h-[5px] bg-[#f97316] rounded-full animate-pulse shrink-0"></span>
                Swarm Active
              </div>
              <h1 className="text-[2.8rem] font-bebas uppercase leading-[0.92] tracking-[0.02em] text-[#f5f4ef]">
                Command <span className="text-[#f97316]">Center</span>
              </h1>
            </div>
            
            <div className="flex gap-3 shrink-0 w-full md:w-auto md:justify-end">
              <button type="button" className="btn-primary btn-primary-compact w-full md:w-auto justify-center">
                <Zap size={16} /> Deploy
              </button>
            </div>
          </header>

          {/* Top Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[1.5px] bg-[#2a2a26] border-[1.5px] border-[#2a2a26]">
            {/* Stat Box 1 */}
            <div className="bg-[#161614] p-[1.2rem] hover-border-orange group">
              <div className="flex justify-between items-start mb-[0.1rem]">
                <span className="font-dm-mono text-[0.7rem] tracking-[0.1em] text-[#7a7a70] uppercase">Revenue Pipeline</span>
              </div>
              <div className="flex items-baseline gap-[0.3rem]">
                <span className="text-[1.1rem] font-bold text-[#f97316] font-dm-mono">{currency}</span>
                <span className="text-[2.2rem] text-[#f97316] font-bebas leading-[1] tracking-[0.03em]">{stats.pipeline.toLocaleString()}</span>
              </div>
            </div>

            {/* Stat Box 2 */}
            <div className="bg-[#161614] p-[1.2rem] hover-border-orange group">
              <div className="flex justify-between items-start mb-[0.1rem]">
                <span className="font-dm-mono text-[0.7rem] tracking-[0.1em] text-[#7a7a70] uppercase">Swarm Health</span>
              </div>
              <div className="flex items-baseline gap-[0.3rem]">
                <span className="text-[2.2rem] text-[#f5f4ef] font-bebas leading-[1] tracking-[0.03em]">{activeAgentsCount}</span>
                <span className="text-[#7a7a70] text-[0.8rem] font-dm-mono uppercase">Working</span>
              </div>
            </div>

            {/* Stat Box 3 */}
            <div className="bg-[#161614] p-[1.2rem] hover-border-orange group">
              <div className="flex justify-between items-start mb-[0.1rem]">
                <span className="font-dm-mono text-[0.7rem] tracking-[0.1em] text-[#7a7a70] uppercase">Active Leads</span>
              </div>
              <div className="flex items-baseline gap-[0.3rem]">
                <span className="text-[2.2rem] text-[#f5f4ef] font-bebas leading-[1] tracking-[0.03em]">{stats.activeQuotes}</span>
              </div>
            </div>
          </div>

          {/* Agent Swarm Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[1.5px] bg-[#2a2a26] border-[1.5px] border-[#2a2a26]">
            {agents.map((agent) => {
              const Icon = getIcon(agent.iconKey);
              const accent = agent.accentColor || '#22c55e';
              const statusColor = agent.statusColor || accent;
              const isActive = agent.hasActiveTask;
              return (
                <div key={agent.id} className="bg-[#161614] p-[1.5rem] relative group hover:bg-[#1c1c1a] transition-colors">
                  <div className="absolute top-0 right-0 p-3">
                    <span className="flex h-2 w-2 relative">
                      {agent.pulse && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: statusColor }}></span>
                      )}
                      <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: statusColor }}></span>
                    </span>
                  </div>
                  <div className="text-[1.8rem] mb-[0.8rem] transition-colors duration-500" style={{ color: isActive ? accent : '#40403a' }}>
                    <Icon size={24} />
                  </div>
                  <h3 className="text-[1.1rem] font-bebas tracking-[0.04em] mb-[0.2rem] text-[#f5f4ef] uppercase">{agent.name}</h3>
                  <div className="flex justify-between font-dm-mono text-[0.6rem] tracking-[0.12em] uppercase mb-2.5">
                    <span style={{ color: statusColor }} className="shrink-0">{agent.statusLabel}</span>
                  </div>

                  <div className="mt-auto">
                    {agent.statusMode === 'segmented' ? (
                      <div className="w-full bg-[#0a0a08] h-1 overflow-hidden flex">
                        <div className="h-full w-1/3" style={{ backgroundColor: statusColor }}></div>
                        <div className="h-full w-2/3 border-l border-[#0a0a08]" style={{ backgroundColor: statusColor, opacity: 0.3 }}></div>
                      </div>
                    ) : agent.statusMode === 'progress' ? (
                      <div className="w-full bg-[#0a0a08] h-1 overflow-hidden">
                        <div
                          className={agent.status === 'pending' ? 'h-full animate-pulse' : 'h-full transition-all'}
                          style={{ backgroundColor: statusColor, width: `${Math.max(agent.progress, 5)}%` }}
                        ></div>
                      </div>
                    ) : (
                      <div className="w-full bg-[#0a0a08] h-1 overflow-hidden">
                        <div className="h-full transition-all duration-700" style={{ backgroundColor: isActive ? accent : '#2a2a26', opacity: isActive ? 0.25 : 0.5, width: '100%' }}></div>
                      </div>
                    )}
                    <div className="mt-2 text-[#7a7a70] font-dm-mono text-[0.55rem] tracking-[0.05em] uppercase truncate">
                      {agent.taskTitle}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Activity & Leads Section */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            <div className="space-y-6">
              {/* Quick Actions (Need Human Help) */}
              {pendingApproval && (
                <div className="bg-[#111110] border border-[#f97316]/50 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-[55%] h-[120%] bg-[linear-gradient(135deg,transparent_40%,rgba(249,115,22,0.12)_100%)] border-l border-[rgba(249,115,22,0.2)] transform -skew-x-[8deg] pointer-events-none"></div>
                   <div className="p-6 relative z-10">
                     <h3 className="font-bebas text-[1.4rem] tracking-[0.04em] mb-1 text-[#f5f4ef]">Human Intervention Required</h3>
                     <p className="text-[#c5c4bb] text-[0.85rem] leading-relaxed mb-4">
                       {pendingApproval.question}
                     </p>
                     <button className="btn-primary btn-primary-compact">
                       <Shield size={14} /> Review & Approve
                     </button>
                   </div>
                </div>
              )}

              {/* System Log */}
              <div className="space-y-4">
                <div className="font-dm-mono text-[0.62rem] tracking-[0.22em] text-[#f97316] uppercase">Real-Time Intelligence</div>
                <div className="bg-[#111110] border border-[#2a2a26] p-6 font-dm-mono text-[0.8rem] space-y-3 min-h-[400px]">
                {activities.length === 0 ? (
                  <div className="text-[#7a7a70] text-center py-10 italic">Waiting for swarm activity...</div>
                ) : (
                  activities.map((entry, idx) => (
                    <div key={entry.id} className={`flex gap-4 items-start ${idx < activities.length - 1 ? 'pb-3 border-b border-[#2a2a26]/50' : ''}`}>
                      <span className="text-[#4b4b44] shrink-0">{formatLogTime(entry.created_at)}</span>
                      <span className="shrink-0 font-bold" style={{ color: entry.color }}>{entry.tag}</span>
                      <span className="text-[#a8a79d] leading-relaxed">{entry.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Leads Sidebar */}
            <div className="space-y-4">
              <div className="font-dm-mono text-[0.62rem] tracking-[0.22em] text-[#f97316] uppercase">Inbound Pipeline</div>
              <div className="bg-[#111110] border border-[#2a2a26] divide-y divide-[#2a2a26]">
                {leads.length === 0 ? (
                  <div className="p-10 text-center text-[#7a7a70] text-[0.85rem]">No active leads.</div>
                ) : (
                  leads.slice(0, 8).map((lead) => {
                    const badge = getStatusBadge(lead.status);
                    return (
                      <div key={lead.id} className="p-4 hover:bg-[#161614] transition-colors cursor-pointer group">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[#f5f4ef] font-bebas text-[1.1rem] tracking-wide group-hover:text-[#f97316] transition-colors">
                            {getCustomerName(lead)}
                          </span>
                          <span className="text-[0.6rem] font-dm-mono uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="text-[0.75rem] text-[#7a7a70] truncate">{getCustomerSummary(lead)}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          </div>
        </main>
      </div>
    </>
  );
}
