'use client';

import React, { useState } from 'react';
import {
  Bot, TrendingUp, Users,
  ChevronRight, Zap, Settings,
  Clock, ArrowUpRight,
  Workflow, Database, PhoneCall, Shield,
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
  agents = [],
  activities = [],
  pendingApproval = null,
}) {
  const [activeTab, setActiveTab] = useState('overview');

  const businessName = business?.business_data?.businessName || business?.name || 'Launchfly Business';
  const currency = business?.business_data?.currency || '$';

  const activeAgents = agents.filter((a) => a.hasActiveTask).length;
  const totalAgents = agents.length;
  const agentLimit = initialStats.agentLimit || Math.max(totalAgents, 1);

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
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
                  {activeAgents > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f97316] opacity-75"></span>}
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
        <main className="relative z-10 px-8 py-6 md:py-8 max-w-[1100px] mx-auto space-y-8">
          
          {/* Header Section */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#2a2a26] pb-5">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 font-dm-mono text-[0.62rem] tracking-[0.16em] text-[#f97316] uppercase mb-2.5 px-2.5 py-1 border border-[#f97316]/30 bg-[#f97316]/10">
                <span className="w-[5px] h-[5px] bg-[#f97316] rounded-full animate-pulse shrink-0"></span>
                Command Center Active
              </div>
              <h1 className="text-[clamp(2.25rem,6vw,3.75rem)] font-bebas uppercase leading-[0.92] tracking-[0.02em] text-[#f5f4ef]">
                System <span className="text-[#f97316]">Overview</span>
              </h1>
              <p className="mt-2.5 text-[#a8a79d] max-w-[520px] text-[0.95rem] md:text-[1rem] leading-snug font-light">
                Monitor your autonomous agents, track revenue generation, and manage active customer conversations across the platform.
              </p>
            </div>
            
            <div className="flex gap-3 shrink-0 w-full md:w-auto md:justify-end">
              <button type="button" className="btn-primary btn-primary-compact w-full md:w-auto justify-center">
                <Zap size={16} />
                Deploy Agent
              </button>
            </div>
          </header>

          {/* Top Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[1.5px] bg-[#2a2a26] border-[1.5px] border-[#2a2a26]">
            {/* Stat Box 1 */}
            <div className="bg-[#161614] p-[2rem] hover-border-orange group">
              <div className="flex justify-between items-start mb-[0.3rem]">
                <span className="font-dm-mono text-[0.78rem] tracking-[0.1em] text-[#7a7a70] uppercase">Pipeline Value</span>
                <TrendingUp size={18} className="text-[#f97316]" />
              </div>
              <div className="flex items-baseline gap-[0.3rem]">
                <span className="text-[1.3rem] font-bold text-[#f97316] font-dm-mono">{currency}</span>
                <span className="text-[2.8rem] text-[#f97316] font-bebas leading-[1] tracking-[0.03em]">{(initialStats.pipeline || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Stat Box 2 */}
            <div className="bg-[#161614] p-[2rem] hover-border-orange group">
              <div className="flex justify-between items-start mb-[0.3rem]">
                <span className="font-dm-mono text-[0.78rem] tracking-[0.1em] text-[#7a7a70] uppercase">Active Agents</span>
                <Workflow size={18} className="text-[#3b82f6]" />
              </div>
              <div className="flex items-baseline gap-[0.3rem]">
                <span className="text-[2.8rem] text-[#f5f4ef] font-bebas leading-[1] tracking-[0.03em]">{totalAgents}</span>
                <span className="text-[#7a7a70] text-[0.85rem] font-dm-mono">/ {agentLimit} limits</span>
              </div>
            </div>

            {/* Stat Box 3 */}
            <div className="bg-[#161614] p-[2rem] hover-border-orange group">
              <div className="flex justify-between items-start mb-[0.3rem]">
                <span className="font-dm-mono text-[0.78rem] tracking-[0.1em] text-[#7a7a70] uppercase">Active Leads</span>
                <Users size={18} className="text-[#a855f7]" />
              </div>
              <div className="flex items-baseline gap-[0.3rem]">
                <span className="text-[2.8rem] text-[#f5f4ef] font-bebas leading-[1] tracking-[0.03em]">{initialStats.activeQuotes || 0}</span>
              </div>
            </div>
          </div>

          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-10">
            
            {/* Left Column: Autonomous Agents */}
            <div className="space-y-8">
              <div className="flex justify-between items-end border-b border-[#2a2a26] pb-3">
                <div>
                  <div className="font-dm-mono text-[0.68rem] tracking-[0.22em] text-[#f97316] uppercase mb-[0.8rem]">Autonomous</div>
                  <h2 className="text-[clamp(2.4rem,5vw,3.2rem)] font-bebas leading-[1] tracking-[0.02em] m-0">
                    Swarm Operations
                  </h2>
                </div>
                <button className="btn-ghost mb-2">
                  View All Logs <ArrowUpRight size={14} />
                </button>
              </div>

              {/* Agent Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-[1.5px] bg-[#2a2a26] border-[1.5px] border-[#2a2a26]">
                {agents.length === 0 ? (
                  <div className="bg-[#161614] p-[2rem] md:col-span-2 flex flex-col items-center justify-center gap-4 min-h-[240px]">
                    <Bot size={32} className="text-[#7a7a70]" />
                    <p className="text-[#7a7a70] font-dm-mono text-[0.85rem] tracking-[0.1em] uppercase text-center">
                      No active assistants yet.<br />Deploy your first AI agent to begin.
                    </p>
                  </div>
                ) : (
                  agents.map((agent) => {
                    const Icon = getIcon(agent.iconKey);
                    const accent = agent.accentColor || '#22c55e';
                    const statusColor = agent.statusColor || accent;
                    return (
                      <div key={agent.id} className="bg-[#161614] p-[2rem] hover-border-orange relative">
                        <div className="absolute top-0 right-0 p-4">
                          <span className="flex h-3 w-3 relative">
                            {agent.pulse && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: statusColor }}></span>
                            )}
                            <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: statusColor }}></span>
                          </span>
                        </div>
                        <div className="text-[2rem] mb-[1rem]" style={{ color: accent }}>
                          <Icon size={32} />
                        </div>
                        <h3 className="text-[1.4rem] font-bebas tracking-[0.04em] mb-[0.6rem] text-[#f5f4ef]">{agent.name}</h3>
                        <p className="text-[0.9rem] text-[#7a7a70] leading-[1.65] h-12 line-clamp-2">{agent.description}</p>

                        <div className="mt-4 pt-4 border-t border-[#2a2a26]">
                          <div className="flex justify-between font-dm-mono text-[0.65rem] tracking-[0.12em] uppercase mb-2 gap-2">
                            <span className="text-[#7a7a70] line-clamp-1 flex-1">Task: {agent.taskTitle}</span>
                            <span style={{ color: statusColor }} className="shrink-0">{agent.statusLabel}</span>
                          </div>
                          {agent.statusMode === 'segmented' ? (
                            <div className="w-full bg-[#0a0a08] h-1.5 overflow-hidden flex">
                              <div className="h-full w-1/3" style={{ backgroundColor: statusColor }}></div>
                              <div className="h-full w-2/3 border-l border-[#0a0a08]" style={{ backgroundColor: statusColor, opacity: 0.3 }}></div>
                            </div>
                          ) : agent.statusMode === 'progress' ? (
                            <div className="w-full bg-[#0a0a08] h-1.5 overflow-hidden">
                              <div
                                className={agent.status === 'pending' ? 'h-full animate-pulse' : 'h-full transition-all'}
                                style={{ backgroundColor: statusColor, width: `${Math.max(agent.progress, 5)}%` }}
                              ></div>
                            </div>
                          ) : (
                            <div className="w-full bg-[#0a0a08] h-1.5 overflow-hidden">
                              <div className="h-full" style={{ backgroundColor: accent, opacity: 0.25, width: '100%' }}></div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Add Agent CTA */}
                <button className="bg-[#111110] hover:bg-[#161614] p-[2rem] flex flex-col items-center justify-center gap-4 transition-colors group min-h-[240px] cursor-pointer">
                  <div className="text-[2rem] text-[#7a7a70] group-hover:text-[#f97316] transition-colors">
                    <Zap size={32} />
                  </div>
                  <span className="font-dm-mono text-[0.8rem] tracking-[0.1em] uppercase text-[#7a7a70] group-hover:text-[#f5f4ef] transition-colors border-b border-[#2a2a26] group-hover:border-[#f97316] pb-1">Deploy New Agent</span>
                </button>
              </div>
              
              {/* Recent Activity Log */}
              <div className="mt-[3.5rem] relative">
                 <div className="font-dm-mono text-[0.68rem] tracking-[0.22em] text-[#f97316] uppercase mb-[0.8rem]">System Log</div>
                 <div className="bg-[#111110] border-[1px] border-[#2a2a26] p-[2rem] font-dm-mono text-[0.85rem] space-y-4">
                    {activities.length === 0 ? (
                      <div className="text-[#7a7a70] text-center py-4">
                        No agent activity yet. Once your assistants run, you&apos;ll see their tool calls and outcomes here in real-time.
                      </div>
                    ) : (
                      activities.map((entry, idx) => (
                        <div
                          key={entry.id}
                          className={`flex gap-4 items-start ${idx < activities.length - 1 ? 'pb-4 border-b border-[#2a2a26]' : ''}`}
                        >
                          <span className="text-[#7a7a70] shrink-0">{formatLogTime(entry.created_at)}</span>
                          <span className="shrink-0" style={{ color: entry.color }}>[{entry.tag}]</span>
                          <span className="text-[#c5c4bb] leading-[1.5] line-clamp-2">{entry.text}</span>
                        </div>
                      ))
                    )}
                 </div>
              </div>
            </div>

            {/* Right Column: Customers & Actions */}
            <div className="space-y-8">
              <div className="flex justify-between items-end border-b border-[#2a2a26] pb-3">
                <h2 className="text-[clamp(2rem,4vw,2.4rem)] font-bebas leading-[1] tracking-[0.02em] m-0">
                  Live Action
                </h2>
              </div>

              <div className="border-[1.5px] border-[#2a2a26] bg-[#2a2a26] gap-[1.5px] flex flex-col">
                {initialLeads.length > 0 ? (
                  initialLeads.slice(0, 5).map((lead) => {
                    const badge = getStatusBadge(lead.status);
                    return (
                      <div key={lead.id} className="bg-[#161614] p-5 hover-border-orange cursor-pointer group">
                        <div className="flex justify-between items-start mb-2 gap-3">
                          <h4 className="font-bebas text-[1.2rem] text-[#f5f4ef] tracking-[0.04em] line-clamp-1">
                            {getCustomerName(lead)}
                          </h4>
                          <span
                            className="inline-block font-dm-mono text-[0.65rem] tracking-[0.12em] px-[0.6rem] py-[0.2rem] uppercase shrink-0 border"
                            style={{ backgroundColor: badge.bg, borderColor: badge.border, color: badge.text }}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-[0.92rem] text-[#7a7a70] line-clamp-1 mb-3">{getCustomerSummary(lead)}</p>
                        <div className="flex justify-between items-center">
                          <span className="text-[#7a7a70] text-[0.8rem] flex items-center gap-1">
                            <Clock size={12}/> {formatTimeAgo(lead.updated_at || lead.created_at)}
                          </span>
                          <button className="text-[#f97316] opacity-0 group-hover:opacity-100 transition-opacity uppercase font-dm-mono text-[0.8rem] tracking-wider flex items-center gap-1">
                            View <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-[#161614] p-6 text-center">
                    <p className="text-[#7a7a70] font-dm-mono text-[0.8rem] tracking-[0.1em] uppercase">
                      No live leads yet. New conversations and bookings will appear here.
                    </p>
                  </div>
                )}
              </div>

              <div className="text-center">
                <button className="btn-ghost">
                  View All Customers
                </button>
              </div>
              
              {/* Quick Actions (Need Human Help) — only when there's a real pending approval */}
              {pendingApproval && (
                <div className="mt-8 bg-[#111110] border-t border-[#2a2a26] border-b border-[#2a2a26] relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-[55%] h-[120%] bg-[linear-gradient(135deg,transparent_40%,rgba(249,115,22,0.12)_100%)] border-l border-[rgba(249,115,22,0.2)] transform -skew-x-[8deg] pointer-events-none"></div>
                   <div className="p-8 relative z-10">
                     <h3 className="font-bebas text-[1.5rem] tracking-[0.04em] mb-2 text-[#f5f4ef]">Need Human Help?</h3>
                     <p className="text-[#c5c4bb] text-[0.92rem] leading-[1.65] mb-6">
                       {pendingApproval.count > 1
                         ? `${pendingApproval.count} agents are waiting for your approval. `
                         : 'Your AI is waiting for your approval before continuing. '}
                       <span className="text-[#f5f4ef] line-clamp-2 block mt-2">&quot;{pendingApproval.question}&quot;</span>
                     </p>
                     <button className="btn-primary w-full justify-center">
                       <Shield size={16} /> Review Approval
                     </button>
                   </div>
                </div>
              )}
            </div>

          </div>
        </main>
      </div>
    </>
  );
}
