'use client';

import React, { useState } from 'react';
import { 
  Bot, TrendingUp, Users, Activity, 
  ChevronRight, Zap, Settings, Command,
  MessageSquare, Clock, ArrowUpRight,
  Workflow, Database, PhoneCall, Shield
} from 'lucide-react';

export default function ModernCommandCenter({ business, initialLeads = [], initialBookings = [], initialStats = {} }) {
  const [activeTab, setActiveTab] = useState('overview');

  const businessName = business?.business_data?.businessName || business?.name || 'Launchfly Business';
  const currency = business?.business_data?.currency || '$';

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
                <span className="text-[2.8rem] text-[#f5f4ef] font-bebas leading-[1] tracking-[0.03em]">0</span>
                <span className="text-[#7a7a70] text-[0.85rem] font-dm-mono">/ 5 limits</span>
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
              <div className="bg-[#111110] border-[1px] border-[#2a2a26] p-[3rem] flex flex-col items-center justify-center text-center">
                <div className="text-[2rem] text-[#2a2a26] mb-4">
                  <Workflow size={48} />
                </div>
                <h3 className="font-bebas text-[1.5rem] tracking-[0.04em] text-[#7a7a70] mb-2">No Active Agents</h3>
                <p className="text-[#a8a89e] text-[0.9rem] max-w-[300px] mb-6">Deploy a new autonomous agent to handle your workflows.</p>
                <button className="bg-[#111110] border border-[#2a2a26] hover:border-[#f97316] text-[#7a7a70] hover:text-[#f97316] px-[2rem] py-[0.8rem] transition-colors flex items-center gap-2 font-dm-mono text-[0.8rem] tracking-[0.1em] uppercase">
                  <Zap size={16} /> Deploy Agent
                </button>
              </div>
              
              {/* Recent Activity Log */}
              <div className="mt-[3.5rem] relative">
                 <div className="font-dm-mono text-[0.68rem] tracking-[0.22em] text-[#f97316] uppercase mb-[0.8rem]">System Log</div>
                 <div className="bg-[#111110] border-[1px] border-[#2a2a26] p-[3rem] font-dm-mono text-[0.85rem] text-center text-[#7a7a70]">
                    No recent activity. Logs will appear here when agents are running.
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
                  initialLeads.slice(0, 5).map((lead, i) => (
                    <div key={i} className="bg-[#161614] p-5 hover-border-orange cursor-pointer group">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bebas text-[1.2rem] text-[#f5f4ef] tracking-[0.04em]">{lead.name || 'Unknown Lead'}</h4>
                        <span className="inline-block bg-[rgba(249,115,22,0.1)] border border-[rgba(249,115,22,0.25)] text-[#f97316] font-dm-mono text-[0.65rem] tracking-[0.12em] px-[0.6rem] py-[0.2rem] uppercase">
                          {lead.status || 'New'}
                        </span>
                      </div>
                      <p className="text-[0.92rem] text-[#7a7a70] line-clamp-1 mb-3">{lead.notes || 'No details provided.'}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-[#7a7a70] text-[0.8rem] flex items-center gap-1"><Clock size={12}/> Just now</span>
                        <button className="text-[#f97316] opacity-0 group-hover:opacity-100 transition-opacity uppercase font-dm-mono text-[0.8rem] tracking-wider flex items-center gap-1">
                          View <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-[#7a7a70] font-dm-mono text-[0.85rem] uppercase tracking-wider">
                    No active customers yet.
                  </div>
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
                   <p className="text-[#c5c4bb] text-[0.92rem] leading-[1.65] mb-6 max-w-[200px]">The AI is currently waiting for your approval on a quote sent to Dwight Schrute.</p>
                   <button className="btn-primary w-full justify-center">
                     <Shield size={16} /> Review Approval
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
