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
    <div className="min-h-screen bg-[#0a0a08] text-[#f5f4ef] font-sans selection:bg-[#f97316]/30">
      {/* Noise Texture Overlay */}
      <div 
        className="fixed inset-0 opacity-[0.04] pointer-events-none z-0 mix-blend-overlay" 
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}
      ></div>

      {/* Diagonal Accent Stripe (Hero feel) */}
      <div className="fixed top-[-10%] right-[-5%] w-[55%] h-[120%] pointer-events-none z-0 opacity-40 transform -skew-x-[8deg]" style={{ background: 'linear-gradient(135deg, transparent 40%, rgba(249,115,22,0.06) 100%)', borderLeft: '1px solid rgba(249,115,22,0.12)' }}></div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#2a2a26] bg-[#0a0a08]/80 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#f97316] text-[#0a0a08] flex items-center justify-center font-bold" style={{ clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)' }}>
            <Command size={18} />
          </div>
          <span className="font-bold tracking-widest text-[#f97316] uppercase text-lg" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: '0.08em' }}>
            {businessName}
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6 text-sm font-mono text-[#7a7a70] uppercase tracking-wider">
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
          
          <button className="bg-[#161614] border border-[#2a2a26] hover:border-[#f97316] text-[#f5f4ef] px-4 py-2 text-sm uppercase tracking-wider font-mono transition-colors flex items-center gap-2">
            <Settings size={16} />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 p-6 md:p-10 max-w-[1400px] mx-auto space-y-10">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#2a2a26] pb-8">
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.18em] text-[#f97316] uppercase mb-4 px-3 py-1 border border-[#f97316]/30 bg-[#f97316]/10">
              <span className="w-1.5 h-1.5 bg-[#f97316] rounded-full animate-pulse"></span>
              Command Center Active
            </div>
            <h1 className="text-4xl md:text-6xl font-bold uppercase" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: '0.02em', lineHeight: '0.95' }}>
              System <span className="text-[#f97316]">Overview</span>
            </h1>
            <p className="mt-4 text-[#a8a89e] max-w-xl leading-relaxed">
              Monitor your autonomous agents, track revenue generation, and manage active customer conversations across the platform.
            </p>
          </div>
          
          <div className="flex gap-4">
            <button className="bg-[#f97316] hover:bg-[#fb923c] text-[#0a0a08] font-bold py-3 px-6 text-sm tracking-wide uppercase transition-all transform hover:-translate-y-0.5 flex items-center gap-2" style={{ clipPath: 'polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)' }}>
              <Zap size={18} />
              Deploy Agent
            </button>
          </div>
        </header>

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-1 bg-[#2a2a26] border border-[#2a2a26]">
          {/* Stat Box 1 */}
          <div className="bg-[#111110] p-6 relative group overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#f97316] opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex justify-between items-start mb-4">
              <span className="font-mono text-[0.68rem] tracking-[0.22em] text-[#7a7a70] uppercase">Pipeline Value</span>
              <TrendingUp size={20} className="text-[#22c55e]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#f97316] font-mono">{currency}</span>
              <span className="text-5xl font-bold" style={{ fontFamily: '"Bebas Neue", sans-serif' }}>{(initialStats.pipeline || 12450).toLocaleString()}</span>
            </div>
            <div className="mt-4 inline-block bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] font-mono text-[0.65rem] tracking-widest px-2 py-1 uppercase">
              +14% this week
            </div>
          </div>

          {/* Stat Box 2 */}
          <div className="bg-[#111110] p-6 relative group overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#3b82f6] opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex justify-between items-start mb-4">
              <span className="font-mono text-[0.68rem] tracking-[0.22em] text-[#7a7a70] uppercase">Active Agents</span>
              <Workflow size={20} className="text-[#3b82f6]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold" style={{ fontFamily: '"Bebas Neue", sans-serif' }}>4</span>
              <span className="text-[#7a7a70] text-sm font-mono">/ 5 limits</span>
            </div>
            <div className="mt-4 flex gap-2">
              <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></div>
              <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              <div className="w-2 h-2 rounded-full bg-[#f97316] animate-pulse" style={{ animationDelay: '0.6s' }}></div>
            </div>
          </div>

          {/* Stat Box 3 */}
          <div className="bg-[#111110] p-6 relative group overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#a855f7] opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex justify-between items-start mb-4">
              <span className="font-mono text-[0.68rem] tracking-[0.22em] text-[#7a7a70] uppercase">Active Leads</span>
              <Users size={20} className="text-[#a855f7]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold" style={{ fontFamily: '"Bebas Neue", sans-serif' }}>{initialStats.activeQuotes || 24}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-[#a8a89e]">
              <Clock size={14} />
              <span>Avg response: 1.2s</span>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Autonomous Agents */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center border-b border-[#2a2a26] pb-3">
              <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: '0.04em' }}>
                Swarm Operations
              </h2>
              <button className="text-xs font-mono text-[#f97316] hover:text-[#fb923c] uppercase tracking-widest flex items-center gap-1">
                View All Logs <ArrowUpRight size={14} />
              </button>
            </div>

            {/* Agent Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 bg-[#2a2a26] border border-[#2a2a26]">
              {/* Agent 1 */}
              <div className="bg-[#161614] p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22c55e]"></span>
                  </span>
                </div>
                <div className="w-12 h-12 bg-[#22c55e]/10 border border-[#22c55e]/30 flex items-center justify-center mb-4 text-[#22c55e]">
                  <Bot size={24} />
                </div>
                <h3 className="text-xl font-bold text-[#f5f4ef] uppercase" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: '0.04em' }}>Receptionist Alpha</h3>
                <p className="text-[#7a7a70] text-sm mt-1 h-10 line-clamp-2">Handling inbound WhatsApp queries and scheduling appointments.</p>
                
                <div className="mt-6 pt-4 border-t border-[#2a2a26]">
                  <div className="flex justify-between text-xs font-mono text-[#7a7a70] uppercase tracking-wider mb-2">
                    <span>Task: Booking Lead</span>
                    <span className="text-[#f5f4ef]">Running</span>
                  </div>
                  <div className="w-full bg-[#0a0a08] h-1.5 overflow-hidden">
                    <div className="bg-[#22c55e] h-full" style={{ width: '75%' }}></div>
                  </div>
                </div>
              </div>

              {/* Agent 2 */}
              <div className="bg-[#161614] p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f97316] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#f97316]"></span>
                  </span>
                </div>
                <div className="w-12 h-12 bg-[#f97316]/10 border border-[#f97316]/30 flex items-center justify-center mb-4 text-[#f97316]">
                  <Database size={24} />
                </div>
                <h3 className="text-xl font-bold text-[#f5f4ef] uppercase" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: '0.04em' }}>Memory Consolidator</h3>
                <p className="text-[#7a7a70] text-sm mt-1 h-10 line-clamp-2">Running background extraction to Knowledge Graph.</p>
                
                <div className="mt-6 pt-4 border-t border-[#2a2a26]">
                  <div className="flex justify-between text-xs font-mono text-[#7a7a70] uppercase tracking-wider mb-2">
                    <span>Task: Pruning Vector DB</span>
                    <span className="text-[#f97316]">Processing</span>
                  </div>
                  <div className="w-full bg-[#0a0a08] h-1.5 overflow-hidden">
                    <div className="bg-[#f97316] h-full animate-pulse" style={{ width: '100%' }}></div>
                  </div>
                </div>
              </div>
              
              {/* Agent 3 */}
              <div className="bg-[#161614] p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3">
                  <span className="flex h-3 w-3 relative">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#a855f7]"></span>
                  </span>
                </div>
                <div className="w-12 h-12 bg-[#a855f7]/10 border border-[#a855f7]/30 flex items-center justify-center mb-4 text-[#a855f7]">
                  <Shield size={24} />
                </div>
                <h3 className="text-xl font-bold text-[#f5f4ef] uppercase" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: '0.04em' }}>CEO Overseer</h3>
                <p className="text-[#7a7a70] text-sm mt-1 h-10 line-clamp-2">Evaluating sub-agent performance and managing approvals.</p>
                
                <div className="mt-6 pt-4 border-t border-[#2a2a26]">
                  <div className="flex justify-between text-xs font-mono text-[#7a7a70] uppercase tracking-wider mb-2">
                    <span>Task: Waiting for Approval</span>
                    <span className="text-[#a855f7]">Paused</span>
                  </div>
                  <div className="w-full bg-[#0a0a08] h-1.5 overflow-hidden flex">
                    <div className="bg-[#a855f7] h-full w-1/3"></div>
                    <div className="bg-[#a855f7]/30 h-full w-2/3 border-l border-[#0a0a08]"></div>
                  </div>
                </div>
              </div>

              {/* Add Agent CTA */}
              <button className="bg-[#111110] hover:bg-[#161614] border-2 border-dashed border-[#2a2a26] hover:border-[#f97316] p-5 flex flex-col items-center justify-center gap-3 transition-colors group min-h-[220px]">
                <div className="w-12 h-12 rounded-full border border-[#2a2a26] group-hover:border-[#f97316] flex items-center justify-center text-[#7a7a70] group-hover:text-[#f97316] transition-colors">
                  <Zap size={20} />
                </div>
                <span className="font-mono text-sm tracking-wider uppercase text-[#7a7a70] group-hover:text-[#f97316] transition-colors">Deploy New Agent</span>
              </button>
            </div>
            
            {/* Recent Activity Log */}
            <div className="mt-8">
               <h3 className="font-mono text-[0.68rem] tracking-[0.22em] text-[#7a7a70] uppercase mb-4">System Event Log</h3>
               <div className="bg-[#111110] border border-[#2a2a26] p-4 font-mono text-xs space-y-3">
                  <div className="flex gap-4 items-start">
                    <span className="text-[#a8a89e]">10:42:05</span>
                    <span className="text-[#3b82f6]">[CEO]</span>
                    <span className="text-[#f5f4ef]">Delegated task <span className="text-[#f97316]">"Follow up with Sarah"</span> to Receptionist Alpha.</span>
                  </div>
                  <div className="flex gap-4 items-start">
                    <span className="text-[#a8a89e]">10:45:12</span>
                    <span className="text-[#22c55e]">[Alpha]</span>
                    <span className="text-[#f5f4ef]">Generated Plan DAG (3 steps). Executing node: check_availability.</span>
                  </div>
                  <div className="flex gap-4 items-start">
                    <span className="text-[#a8a89e]">10:46:30</span>
                    <span className="text-[#f97316]">[Memory]</span>
                    <span className="text-[#f5f4ef]">Archived 4 stale vectors. Consolidated 2 entity relationships.</span>
                  </div>
                  <div className="flex gap-4 items-start">
                    <span className="text-[#a8a89e]">10:48:01</span>
                    <span className="text-[#a855f7]">[Evaluator]</span>
                    <span className="text-[#f5f4ef]">Critic check passed (9/10). Task completed successfully.</span>
                  </div>
               </div>
            </div>
          </div>

          {/* Right Column: Customers & Actions */}
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-[#2a2a26] pb-3">
              <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: '0.04em' }}>
                Live Customers
              </h2>
            </div>

            <div className="bg-[#111110] border border-[#2a2a26] divide-y divide-[#2a2a26]">
              {initialLeads.length > 0 ? (
                initialLeads.slice(0, 5).map((lead, i) => (
                  <div key={i} className="p-4 hover:bg-[#161614] transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-[#f5f4ef]">{lead.name || 'Unknown Lead'}</h4>
                      <span className="text-[0.65rem] font-mono px-2 py-0.5 bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20 uppercase">
                        {lead.status || 'New'}
                      </span>
                    </div>
                    <p className="text-sm text-[#7a7a70] line-clamp-1 mb-3">{lead.notes || 'No details provided.'}</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#a8a89e] flex items-center gap-1"><Clock size={12}/> Just now</span>
                      <button className="text-[#f97316] opacity-0 group-hover:opacity-100 transition-opacity uppercase font-mono tracking-wider flex items-center gap-1">
                        View <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className="p-4 hover:bg-[#161614] transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-[#f5f4ef]">Michael Scott</h4>
                      <span className="text-[0.65rem] font-mono px-2 py-0.5 bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 uppercase">
                        Booked
                      </span>
                    </div>
                    <p className="text-sm text-[#7a7a70] line-clamp-1 mb-3">Needs a full AC cleaning unit 3.</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#a8a89e] flex items-center gap-1"><Clock size={12}/> 5m ago</span>
                      <button className="text-[#f97316] opacity-0 group-hover:opacity-100 transition-opacity uppercase font-mono tracking-wider flex items-center gap-1">
                        View <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 hover:bg-[#161614] transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-[#f5f4ef]">Pam Beesly</h4>
                      <span className="text-[0.65rem] font-mono px-2 py-0.5 bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20 uppercase">
                        Quoted
                      </span>
                    </div>
                    <p className="text-sm text-[#7a7a70] line-clamp-1 mb-3">Checking pricing for leak repair.</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#a8a89e] flex items-center gap-1"><Clock size={12}/> 1h ago</span>
                      <button className="text-[#f97316] opacity-0 group-hover:opacity-100 transition-opacity uppercase font-mono tracking-wider flex items-center gap-1">
                        View <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button className="w-full py-3 border border-[#2a2a26] text-sm font-mono text-[#7a7a70] hover:text-[#f5f4ef] hover:border-[#f5f4ef] transition-colors uppercase tracking-widest">
              View All Customers
            </button>
            
            {/* Quick Actions */}
            <div className="mt-8 p-6 bg-[#f97316] text-[#0a0a08] relative overflow-hidden" style={{ clipPath: 'polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%)' }}>
               <div className="absolute top-0 right-0 w-32 h-32 bg-[#fb923c] rounded-full blur-3xl opacity-50 -mr-10 -mt-10 pointer-events-none"></div>
               <h3 className="font-bold text-xl uppercase mb-2" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: '0.04em' }}>Need Human Help?</h3>
               <p className="text-sm opacity-90 mb-4 font-medium">The AI is currently waiting for your approval on a quote sent to Dwight Schrute.</p>
               <button className="bg-[#0a0a08] text-[#f5f4ef] px-4 py-2 text-sm font-bold uppercase tracking-wider w-full flex justify-center items-center gap-2 hover:bg-[#111110] transition-colors">
                 <Shield size={16} /> Review Approval
               </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
