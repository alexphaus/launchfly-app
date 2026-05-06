'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bot, TrendingUp, Users, Activity, 
  ChevronRight, Zap, Settings, Command,
  MessageSquare, Clock, ArrowUpRight,
  Workflow, Database, PhoneCall, Shield
} from 'lucide-react';

export default function ModernCommandCenter({ business, initialLeads = [], initialBookings = [], initialStats = {} }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const businessName = business?.business_data?.businessName || business?.name || 'Launchfly Business';
  const currency = business?.business_data?.currency || '$';

  // ──── FETCH REAL DATA FROM API ────
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const businessId = business?.id;
        if (!businessId) {
          setError('No business ID provided');
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/dashboard/stats?businessId=${businessId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
        }

        const data = await response.json();
        setDashboardData(data);
        setError(null);
      } catch (err) {
        console.error('Dashboard data fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [business?.id]);

  // ──── HELPER: Format relative time ────
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // ──── HELPER: Format time for logs ────
  const formatTime = (timestamp) => {
    if (!timestamp) return '00:00:00';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false });
  };

  // ──── FALLBACK DATA (if API fails) ────
  const stats = dashboardData?.stats || {
    pipeline: initialStats.pipeline || 12450,
    activeAgents: initialStats.activeAgents || 4,
    activeQuotes: initialStats.activeQuotes || 24,
  };

  const agents = dashboardData?.agents || [];
  const activityLog = dashboardData?.activityLog || [];
  const leads = dashboardData?.leads || initialLeads;

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
        <nav className="sticky top-0 z-50 border-b border-[#2a2a26] bg-[#0a0a08]/88 backdrop-blur-[12px] px-8 py-[1.2rem] flex justify-between items-center">
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
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f97316] opacity-75"></span>
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
        <main className="relative z-10 px-8 py-12 max-w-[1100px] mx-auto space-y-12">
          
          {/* Header Section */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#2a2a26] pb-10">
            <div>
              <div className="inline-flex items-center gap-[0.5rem] font-dm-mono text-[0.72rem] tracking-[0.18em] text-[#f97316] uppercase mb-[1.5rem] px-[0.8rem] py-[0.4rem] border border-[#f97316]/30 bg-[#f97316]/10">
                <span className="w-[6px] h-[6px] bg-[#f97316] rounded-full animate-pulse"></span>
                Command Center Active
              </div>
              <h1 className="text-[clamp(3.5rem,9vw,6rem)] font-bebas uppercase leading-[0.95] tracking-[0.02em] text-[#f5f4ef]">
                System <span className="text-[#f97316] block">Overview</span>
              </h1>
              <p className="mt-[1.8rem] text-[#c5c4bb] max-w-[580px] text-[1.2rem] leading-[1.7] font-light">
                Monitor your autonomous agents, track revenue generation, and manage active customer conversations across the platform.
              </p>
            </div>
            
            <div className="flex gap-4 mb-4 md:mb-0">
              <button className="btn-primary">
                <Zap size={18} />
                Deploy Agent
              </button>
            </div>
          </header>

          {/* Top Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[1.5px] bg-[#2a2a26] border-[1.5px] border-[#2a2a26]">
            {/* Stat Box 1: Pipeline Value */}
            <div className="bg-[#161614] p-[2rem] hover-border-orange group">
              <div className="flex justify-between items-start mb-[0.3rem]">
                <span className="font-dm-mono text-[0.78rem] tracking-[0.1em] text-[#7a7a70] uppercase">Pipeline Value</span>
                <TrendingUp size={18} className="text-[#f97316]" />
              </div>
              <div className="flex items-baseline gap-[0.3rem]">
                <span className="text-[1.3rem] font-bold text-[#f97316] font-dm-mono">{currency}</span>
                <span className="text-[2.8rem] text-[#f97316] font-bebas leading-[1] tracking-[0.03em]">
                  {loading ? '...' : (stats.pipeline || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Stat Box 2: Active Agents */}
            <div className="bg-[#161614] p-[2rem] hover-border-orange group">
              <div className="flex justify-between items-start mb-[0.3rem]">
                <span className="font-dm-mono text-[0.78rem] tracking-[0.1em] text-[#7a7a70] uppercase">Active Agents</span>
                <Workflow size={18} className="text-[#3b82f6]" />
              </div>
              <div className="flex items-baseline gap-[0.3rem]">
                <span className="text-[2.8rem] text-[#f5f4ef] font-bebas leading-[1] tracking-[0.03em]">
                  {loading ? '...' : stats.activeAgents || 0}
                </span>
                <span className="text-[#7a7a70] text-[0.85rem] font-dm-mono">/ {stats.totalAgents || 5} limit</span>
              </div>
            </div>

            {/* Stat Box 3: Active Leads */}
            <div className="bg-[#161614] p-[2rem] hover-border-orange group">
              <div className="flex justify-between items-start mb-[0.3rem]">
                <span className="font-dm-mono text-[0.78rem] tracking-[0.1em] text-[#7a7a70] uppercase">Active Leads</span>
                <Users size={18} className="text-[#a855f7]" />
              </div>
              <div className="flex items-baseline gap-[0.3rem]">
                <span className="text-[2.8rem] text-[#f5f4ef] font-bebas leading-[1] tracking-[0.03em]">
                  {loading ? '...' : stats.activeLeads || 0}
                </span>
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
                {/* Real Agent Cards from Database */}
                {!loading && agents.length > 0 ? (
                  agents.map((agent, idx) => {
                    const statusColors = {
                      'running': { bg: '#22c55e', text: '#22c55e' },
                      'completed': { bg: '#3b82f6', text: '#3b82f6' },
                      'pending': { bg: '#f97316', text: '#f97316' },
                      'paused': { bg: '#a855f7', text: '#a855f7' },
                      'failed': { bg: '#ef4444', text: '#ef4444' },
                      'idle': { bg: '#6b7280', text: '#6b7280' },
                    };
                    const colors = statusColors[agent.status] || statusColors['idle'];
                    
                    return (
                      <div key={agent.id} className="bg-[#161614] p-[2rem] hover-border-orange relative">
                        <div className="absolute top-0 right-0 p-4">
                          <span className="flex h-3 w-3 relative">
                            {agent.status === 'running' && (
                              <>
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: colors.bg }}></span>
                                <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: colors.bg }}></span>
                              </>
                            )}
                            {agent.status !== 'running' && (
                              <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: colors.bg }}></span>
                            )}
                          </span>
                        </div>
                        <div className="text-[2rem] mb-[1rem]" style={{ color: colors.text }}>
                          <Bot size={32} />
                        </div>
                        <h3 className="text-[1.4rem] font-bebas tracking-[0.04em] mb-[0.6rem] text-[#f5f4ef]">{agent.name}</h3>
                        <p className="text-[0.9rem] text-[#7a7a70] leading-[1.65] h-12 line-clamp-2">{agent.taskGoal}</p>
                        
                        <div className="mt-4 pt-4 border-t border-[#2a2a26]">
                          <div className="flex justify-between font-dm-mono text-[0.65rem] tracking-[0.12em] uppercase mb-2">
                            <span className="text-[#7a7a70]">Task: {agent.status}</span>
                            <span style={{ color: colors.text }}>{agent.status.toUpperCase()}</span>
                          </div>
                          <div className="w-full bg-[#0a0a08] h-1.5 overflow-hidden">
                            <div style={{ background: colors.bg, width: `${Math.min(agent.stepsUsed || 0, 100)}%` }} className="h-full" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : loading ? (
                  <div className="col-span-2 bg-[#161614] p-[2rem] text-center text-[#7a7a70]">
                    Loading agents...
                  </div>
                ) : (
                  <>
                    {/* Fallback: Mock agents if no real data */}
                    <div className="bg-[#161614] p-[2rem] hover-border-orange relative">
                      <div className="absolute top-0 right-0 p-4">
                        <span className="flex h-3 w-3 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22c55e]"></span>
                        </span>
                      </div>
                      <div className="text-[2rem] mb-[1rem] text-[#22c55e]">
                        <Bot size={32} />
                      </div>
                      <h3 className="text-[1.4rem] font-bebas tracking-[0.04em] mb-[0.6rem] text-[#f5f4ef]">Receptionist Alpha</h3>
                      <p className="text-[0.9rem] text-[#7a7a70] leading-[1.65] h-12 line-clamp-2">Handling inbound WhatsApp queries and scheduling appointments.</p>
                      
                      <div className="mt-4 pt-4 border-t border-[#2a2a26]">
                        <div className="flex justify-between font-dm-mono text-[0.65rem] tracking-[0.12em] uppercase mb-2">
                          <span className="text-[#7a7a70]">Task: Booking Lead</span>
                          <span className="text-[#f5f4ef]">Running</span>
                        </div>
                        <div className="w-full bg-[#0a0a08] h-1.5 overflow-hidden">
                          <div className="bg-[#22c55e] h-full" style={{ width: '75%' }}></div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#161614] p-[2rem] hover-border-orange relative">
                      <div className="absolute top-0 right-0 p-4">
                        <span className="flex h-3 w-3 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f97316] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-[#f97316]"></span>
                        </span>
                      </div>
                      <div className="text-[2rem] mb-[1rem] text-[#f97316]">
                        <Database size={32} />
                      </div>
                      <h3 className="text-[1.4rem] font-bebas tracking-[0.04em] mb-[0.6rem] text-[#f5f4ef]">Memory Consolidator</h3>
                      <p className="text-[0.9rem] text-[#7a7a70] leading-[1.65] h-12 line-clamp-2">Running background extraction to Knowledge Graph.</p>
                      
                      <div className="mt-4 pt-4 border-t border-[#2a2a26]">
                        <div className="flex justify-between font-dm-mono text-[0.65rem] tracking-[0.12em] uppercase mb-2">
                          <span className="text-[#7a7a70]">Task: Pruning Vector DB</span>
                          <span className="text-[#f97316]">Processing</span>
                        </div>
                        <div className="w-full bg-[#0a0a08] h-1.5 overflow-hidden">
                          <div className="bg-[#f97316] h-full animate-pulse" style={{ width: '100%' }}></div>
                        </div>
                      </div>
                    </div>
                  </>
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
                    {!loading && activityLog.length > 0 ? (
                      activityLog.map((activity, idx) => {
                        const typeColors = {
                          'running': '#3b82f6',
                          'completed': '#22c55e',
                          'pending': '#f97316',
                          'failed': '#ef4444',
                          'paused': '#a855f7',
                        };
                        const color = typeColors[activity.type] || '#7a7a70';
                        return (
                          <div key={idx} className="flex gap-4 items-start pb-4 border-b border-[#2a2a26]">
                            <span className="text-[#7a7a70] shrink-0">{formatTime(activity.timestamp)}</span>
                            <span style={{ color }} className="shrink-0">[{activity.type.toUpperCase()}]</span>
                            <span className="text-[#c5c4bb] leading-[1.5]">
                              {activity.message?.slice(0, 100) || 'Task executed'}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <>
                        <div className="flex gap-4 items-start pb-4 border-b border-[#2a2a26]">
                          <span className="text-[#7a7a70] shrink-0">10:42:05</span>
                          <span className="text-[#3b82f6] shrink-0">[CEO]</span>
                          <span className="text-[#c5c4bb] leading-[1.5]">Delegated task <span className="text-[#f97316]">"Follow up with Sarah"</span> to Receptionist Alpha.</span>
                        </div>
                        <div className="flex gap-4 items-start pb-4 border-b border-[#2a2a26]">
                          <span className="text-[#7a7a70] shrink-0">10:45:12</span>
                          <span className="text-[#22c55e] shrink-0">[Alpha]</span>
                          <span className="text-[#c5c4bb] leading-[1.5]">Generated Plan DAG (3 steps). Executing node: check_availability.</span>
                        </div>
                        <div className="flex gap-4 items-start pb-4 border-b border-[#2a2a26]">
                          <span className="text-[#7a7a70] shrink-0">10:46:30</span>
                          <span className="text-[#f97316] shrink-0">[Memory]</span>
                          <span className="text-[#c5c4bb] leading-[1.5]">Archived 4 stale vectors. Consolidated 2 entity relationships.</span>
                        </div>
                        <div className="flex gap-4 items-start">
                          <span className="text-[#7a7a70] shrink-0">10:48:01</span>
                          <span className="text-[#a855f7] shrink-0">[Evaluator]</span>
                          <span className="text-[#c5c4bb] leading-[1.5]">Critic check passed (9/10). Task completed successfully.</span>
                        </div>
                      </>
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
                {!loading && leads.length > 0 ? (
                  leads.slice(0, 5).map((lead, i) => (
                    <div key={i} className="bg-[#161614] p-5 hover-border-orange cursor-pointer group">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bebas text-[1.2rem] text-[#f5f4ef] tracking-[0.04em]">{lead.name || 'Unknown Lead'}</h4>
                        <span className={`inline-block border font-dm-mono text-[0.65rem] tracking-[0.12em] px-[0.6rem] py-[0.2rem] uppercase`}
                          style={{
                            background: lead.status === 'converted' ? 'rgba(34,197,94,0.1)' : lead.status === 'qualified' ? 'rgba(59,130,246,0.1)' : 'rgba(249,115,22,0.1)',
                            borderColor: lead.status === 'converted' ? 'rgba(34,197,94,0.25)' : lead.status === 'qualified' ? 'rgba(59,130,246,0.25)' : 'rgba(249,115,22,0.25)',
                            color: lead.status === 'converted' ? '#22c55e' : lead.status === 'qualified' ? '#3b82f6' : '#f97316',
                          }}>
                          {lead.status || 'New'}
                        </span>
                      </div>
                      <p className="text-[0.92rem] text-[#7a7a70] line-clamp-1 mb-3">{lead.notes || `${lead.phone || lead.email || 'No contact'}`}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-[#7a7a70] text-[0.8rem] flex items-center gap-1"><Clock size={12}/> {formatRelativeTime(lead.createdAt)}</span>
                        <button className="text-[#f97316] opacity-0 group-hover:opacity-100 transition-opacity uppercase font-dm-mono text-[0.8rem] tracking-wider flex items-center gap-1">
                          View <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : loading ? (
                  <div className="bg-[#161614] p-5 text-center text-[#7a7a70]">
                    Loading leads...
                  </div>
                ) : (
                  <>
                    <div className="bg-[#161614] p-5 hover-border-orange cursor-pointer group">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bebas text-[1.2rem] text-[#f5f4ef] tracking-[0.04em]">Michael Scott</h4>
                        <span className="inline-block bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.25)] text-[#22c55e] font-dm-mono text-[0.65rem] tracking-[0.12em] px-[0.6rem] py-[0.2rem] uppercase">
                          Booked
                        </span>
                      </div>
                      <p className="text-[0.92rem] text-[#7a7a70] line-clamp-1 mb-3">Needs a full AC cleaning unit 3.</p>
                      <div className="flex justify-between items-center">
                        <span className="text-[#7a7a70] text-[0.8rem] flex items-center gap-1"><Clock size={12}/> 5m ago</span>
                        <button className="text-[#f97316] opacity-0 group-hover:opacity-100 transition-opacity uppercase font-dm-mono text-[0.8rem] tracking-wider flex items-center gap-1">
                          View <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="bg-[#161614] p-5 hover-border-orange cursor-pointer group">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bebas text-[1.2rem] text-[#f5f4ef] tracking-[0.04em]">Pam Beesly</h4>
                        <span className="inline-block bg-[rgba(249,115,22,0.1)] border border-[rgba(249,115,22,0.25)] text-[#f97316] font-dm-mono text-[0.65rem] tracking-[0.12em] px-[0.6rem] py-[0.2rem] uppercase">
                          Quoted
                        </span>
                      </div>
                      <p className="text-[0.92rem] text-[#7a7a70] line-clamp-1 mb-3">Checking pricing for leak repair.</p>
                      <div className="flex justify-between items-center">
                        <span className="text-[#7a7a70] text-[0.8rem] flex items-center gap-1"><Clock size={12}/> 1h ago</span>
                        <button className="text-[#f97316] opacity-0 group-hover:opacity-100 transition-opacity uppercase font-dm-mono text-[0.8rem] tracking-wider flex items-center gap-1">
                          View <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="text-center">
                <button className="btn-ghost">
                  View All Customers
                </button>
              </div>
              
              {/* Quick Actions (Need Human Help) */}
              <div className="mt-8 bg-[#111110] border-t border-[#2a2a26] border-b border-[#2a2a26] relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-[55%] h-[120%] bg-[linear-gradient(135deg,transparent_40%,rgba(249,115,22,0.12)_100%)] border-l border-[rgba(249,115,22,0.2)] transform -skew-x-[8deg] pointer-events-none"></div>
                 <div className="p-8 relative z-10">
                   <h3 className="font-bebas text-[1.5rem] tracking-[0.04em] mb-2 text-[#f5f4ef]">Need Human Help?</h3>
                   <p className="text-[#c5c4bb] text-[0.92rem] leading-[1.65] mb-6 max-w-[200px]">
                     {stats.activeAgentTasks > 0 
                       ? `${stats.activeAgentTasks} task(s) running. Your AI is working autonomously.`
                       : 'No pending approvals. Your AI is operating smoothly.'}
                   </p>
                   <button className="btn-primary w-full justify-center">
                     <Shield size={16} /> {stats.activeAgentTasks > 0 ? 'View Active Tasks' : 'View Dashboard'}
                   </button>
                 </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </>
  );
}
