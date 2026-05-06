'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
    LayoutDashboard,
    Users,
    Calendar,
    Settings,
    Bot,
    Search,
    MessageSquare,
    TrendingUp,
    Zap,
    Clock,
    ChevronRight,
    Play,
    Edit3,
    Activity,
    DollarSign,
    Target,
    ShieldCheck,
    Cpu,
    Terminal,
    Eye,
    Globe,
    ExternalLink
} from 'lucide-react';

/**
 * ModernCommandCenter Component
 * A high-end, brutalist-inspired dashboard for Launchfly autonomous agents.
 */
export default function ModernCommandCenter({ business, initialLeads = [], initialBookings = [], initialStats = {} }) {
    const [leads, setLeads] = useState(initialLeads);
    const [bookings, setBookings] = useState(initialBookings);
    const [stats, setStats] = useState({
        activeQuotes: initialStats.activeQuotes || 0,
        pipeline: initialStats.pipeline || 0,
        booked: initialStats.booked || 0,
    });
    const [activeTab, setActiveTab] = useState('overview');
    const [assistants, setAssistants] = useState([]);
    const [agentLogs, setAgentLogs] = useState([]);
    const [loadingAssistants, setLoadingAssistants] = useState(true);

    const supabase = createClientComponentClient();
    const businessData = business?.business_data || {};
    const businessName = businessData.businessName || business?.name || 'Your Business';
    const currency = businessData.currency || '₱';

    // Fetch Agents (Assistants)
    useEffect(() => {
        const fetchAssistants = async () => {
            setLoadingAssistants(true);
            const { data, error } = await supabase
                .from('assistants')
                .select('*')
                .eq('business_id', business.id)
                .eq('active', true);
            
            if (data) setAssistants(data);
            setLoadingAssistants(false);
        };
        fetchAssistants();
    }, [business.id]);

    // Fetch Latest Agent Logs (Tasks)
    useEffect(() => {
        const fetchLogs = async () => {
            const { data } = await supabase
                .from('agent_tasks')
                .select('id, goal, status, created_at, steps_used, tool_log')
                .eq('business_id', business.id)
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (data) setAgentLogs(data);
        };
        fetchLogs();

        // Subscribe to logs
        const taskChannel = supabase
            .channel('agent-activity')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'agent_tasks', filter: `business_id=eq.${business.id}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setAgentLogs(prev => [payload.new, ...prev].slice(0, 10));
                    } else if (payload.eventType === 'UPDATE') {
                        setAgentLogs(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
                    }
                }
            )
            .subscribe();

        return () => supabase.removeChannel(taskChannel);
    }, [business.id]);

    // Helper: Map assistant type to icon
    const getAgentIcon = (name) => {
        const lower = name.toLowerCase();
        if (lower.includes('research')) return <Search className="w-5 h-5" />;
        if (lower.includes('marketer') || lower.includes('blast')) return <TrendingUp className="w-5 h-5" />;
        if (lower.includes('reception') || lower.includes('chat')) return <MessageSquare className="w-5 h-5" />;
        if (lower.includes('operator') || lower.includes('manager')) return <Zap className="w-5 h-5" />;
        return <Bot className="w-5 h-5" />;
    };

    // Helper: Format Time
    const timeAgo = (date) => {
        const diff = new Date() - new Date(date);
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <div className="modern-dashboard">
            {/* ---- CSS STYLES ---- */}
            <style jsx global>{`
                :root {
                    --black: #0a0a08;
                    --off-black: #111110;
                    --card: #161614;
                    --border: #2a2a26;
                    --orange: #f97316;
                    --orange-hot: #fb923c;
                    --white: #f5f4ef;
                    --muted: #7a7a70;
                    --green: #22c55e;
                }

                .modern-dashboard {
                    background: var(--black);
                    color: var(--white);
                    font-family: 'DM Sans', sans-serif;
                    min-height: 100vh;
                    display: flex;
                    position: relative;
                }

                /* Noise texture */
                .modern-dashboard::before {
                    content: '';
                    position: fixed;
                    inset: 0;
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
                    pointer-events: none;
                    z-index: 0;
                    opacity: 0.5;
                }

                /* SIDEBAR */
                .sidebar {
                    width: 260px;
                    background: var(--off-black);
                    border-right: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    z-index: 10;
                    position: sticky;
                    top: 0;
                    height: 100vh;
                }

                .sidebar-logo {
                    padding: 2rem;
                    font-family: 'Bebas Neue', sans-serif;
                    font-size: 1.8rem;
                    color: var(--orange);
                    letter-spacing: 0.05em;
                }

                .nav-group {
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .nav-item {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    padding: 0.8rem 1rem;
                    color: var(--muted);
                    text-decoration: none;
                    font-size: 0.9rem;
                    font-weight: 500;
                    border-radius: 4px;
                    transition: all 0.2s;
                    cursor: pointer;
                }

                .nav-item:hover, .nav-item.active {
                    background: var(--card);
                    color: var(--white);
                }

                .nav-item.active {
                    color: var(--orange);
                }

                /* MAIN CONTENT */
                .main-content {
                    flex: 1;
                    padding: 2.5rem;
                    position: relative;
                    z-index: 1;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                /* HEADER */
                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-bottom: 3rem;
                }

                .welcome-text h1 {
                    font-family: 'Bebas Neue', sans-serif;
                    font-size: 3rem;
                    letter-spacing: 0.02em;
                    line-height: 1;
                }

                .welcome-text p {
                    color: var(--muted);
                    font-size: 0.95rem;
                    margin-top: 0.5rem;
                }

                .header-actions {
                    display: flex;
                    gap: 1rem;
                }

                /* STATS GRID */
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 1px;
                    background: var(--border);
                    border: 1px solid var(--border);
                    margin-bottom: 3rem;
                }

                .stat-card {
                    background: var(--card);
                    padding: 1.5rem 2rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .stat-label {
                    font-family: 'DM Mono', monospace;
                    font-size: 0.7rem;
                    color: var(--muted);
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }

                .stat-value {
                    font-family: 'Bebas Neue', sans-serif;
                    font-size: 2.2rem;
                    color: var(--white);
                }

                .stat-trend {
                    font-size: 0.75rem;
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                }

                /* AGENT SWARM */
                .section-title {
                    font-family: 'Bebas Neue', sans-serif;
                    font-size: 1.8rem;
                    margin-bottom: 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                }

                .agent-swarm {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1.5rem;
                    margin-bottom: 3rem;
                }

                .agent-card {
                    background: var(--card);
                    border: 1px solid var(--border);
                    padding: 1.8rem;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .agent-card:hover {
                    transform: translateY(-4px);
                    border-color: var(--orange);
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
                }

                .agent-card::after {
                    content: 'NEURAL_LINK_ACTIVE';
                    position: absolute;
                    top: 1rem;
                    right: -2rem;
                    font-family: 'DM Mono', monospace;
                    font-size: 0.5rem;
                    color: var(--orange);
                    opacity: 0;
                    transform: rotate(45deg);
                    transition: opacity 0.3s;
                }

                .agent-card:hover::after {
                    opacity: 0.4;
                }

                .agent-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.2rem;
                }

                .agent-identity {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                }

                .agent-icon {
                    width: 44px;
                    height: 44px;
                    background: rgba(249,115,22,0.05);
                    border: 1px solid rgba(249,115,22,0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--orange);
                    transition: all 0.3s;
                }

                .agent-card:hover .agent-icon {
                    background: var(--orange);
                    color: var(--black);
                    border-color: var(--orange);
                }

                .agent-name {
                    font-family: 'Bebas Neue', sans-serif;
                    font-size: 1.6rem;
                    letter-spacing: 0.04em;
                }

                .agent-status-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: var(--green);
                    box-shadow: 0 0 12px var(--green);
                    animation: pulse-green 2s infinite;
                }

                @keyframes pulse-green {
                    0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
                }

                .agent-mission {
                    font-size: 0.9rem;
                    color: var(--muted);
                    line-height: 1.6;
                    margin-bottom: 1.8rem;
                    height: 3rem;
                    overflow: hidden;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                }

                /* LOG TERMINAL */
                .operation-terminal {
                    background: var(--off-black);
                    border: 1px solid var(--border);
                    font-family: 'DM Mono', monospace;
                    font-size: 0.85rem;
                    display: flex;
                    flex-direction: column;
                    height: 400px;
                    position: relative;
                    overflow: hidden;
                }

                .operation-terminal::before {
                    content: " ";
                    position: absolute;
                    top: 0; left: 0; bottom: 0; right: 0;
                    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
                    z-index: 2;
                    background-size: 100% 2px, 3px 100%;
                    pointer-events: none;
                }

                .operation-terminal::after {
                    content: " ";
                    position: absolute;
                    top: 0; left: 0; bottom: 0; right: 0;
                    background: rgba(18, 16, 16, 0.1);
                    opacity: 0;
                    z-index: 2;
                    pointer-events: none;
                    animation: flicker 0.15s infinite;
                }

                @keyframes flicker {
                    0% { opacity: 0.27861; }
                    5% { opacity: 0.34769; }
                    10% { opacity: 0.23604; }
                    /* ... abbreviated ... */
                    100% { opacity: 0.27861; }
                }

                .scanline {
                    width: 100%;
                    height: 100px;
                    z-index: 3;
                    background: linear-gradient(0deg, rgba(0, 0, 0, 0) 0%, rgba(249, 115, 22, 0.1) 50%, rgba(0, 0, 0, 0) 100%);
                    opacity: 0.1;
                    position: absolute;
                    bottom: 100%;
                    animation: scanline 6s linear infinite;
                }

                @keyframes scanline {
                    0% { bottom: 100%; }
                    80% { bottom: 100%; }
                    100% { bottom: -100px; }
                }

                .terminal-header {
                    background: var(--card);
                    padding: 0.6rem 1rem;
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .terminal-title {
                    font-size: 0.7rem;
                    color: var(--muted);
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    text-transform: uppercase;
                }

                .terminal-body {
                    padding: 1rem;
                    flex: 1;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 0.8rem;
                }

                .log-entry {
                    display: flex;
                    gap: 1rem;
                    line-height: 1.5;
                }

                .log-time {
                    color: var(--muted);
                    flex-shrink: 0;
                    font-size: 0.75rem;
                }

                .log-content {
                    color: #c5c4bb;
                }

                .log-tag {
                    color: var(--orange);
                    font-weight: 700;
                    margin-right: 0.5rem;
                }

                .log-status {
                    display: inline-block;
                    padding: 0 0.4rem;
                    font-size: 0.65rem;
                    border-radius: 2px;
                    margin-left: 0.5rem;
                }

                .status-running { background: rgba(34,197,94,0.1); color: var(--green); border: 1px solid rgba(34,197,94,0.2); }
                .status-completed { background: rgba(59,130,246,0.1); color: #3b82f6; border: 1px solid rgba(59,130,246,0.2); }

                @media (max-width: 1024px) {
                    .sidebar { display: none; }
                    .stats-grid { grid-template-columns: repeat(2, 1fr); }
                    .agent-swarm { grid-template-columns: 1fr; }
                }
            `}</style>

            {/* ---- SIDEBAR ---- */}
            <aside className="sidebar">
                <div className="sidebar-logo">LAUNCHFLY</div>
                
                <nav className="nav-group">
                    <div className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                        <LayoutDashboard className="w-5 h-5" />
                        Overview
                    </div>
                    <div className={`nav-item ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>
                        <Cpu className="w-5 h-5" />
                        Agent Swarm
                    </div>
                    <div className={`nav-item ${activeTab === 'operations' ? 'active' : ''}`} onClick={() => setActiveTab('operations')}>
                        <Activity className="w-5 h-5" />
                        Operations
                    </div>
                    <div className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>
                        <Users className="w-5 h-5" />
                        Customers
                    </div>
                    <div className={`nav-item ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => setActiveTab('schedule')}>
                        <Calendar className="w-5 h-5" />
                        Schedule
                    </div>
                </nav>

                <div className="mt-auto nav-group border-t border-border">
                    <div className="nav-item">
                        <Settings className="w-5 h-5" />
                        Settings
                    </div>
                </div>
            </aside>

            {/* ---- MAIN CONTENT ---- */}
            <main className="main-content">
                {/* HEADER */}
                <header className="dashboard-header">
                    <div className="welcome-text">
                        <h1>COMMAND CENTER</h1>
                        <p>Autonomous Swarm Operating System for {businessName}</p>
                    </div>
                    <div className="header-actions">
                        <button className="btn-brutalist btn-brutalist-orange px-6" onClick={() => window.location.href = `/command/${business.id}/settings`}>
                            <Zap className="w-4 h-4 fill-current" />
                            Global Launch
                        </button>
                    </div>
                </header>

                {/* STATS OVERVIEW */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <span className="stat-label">Total Revenue</span>
                        <div className="stat-value">{currency}{(stats.pipeline * 0.85).toLocaleString()}</div>
                        <div className="stat-trend text-green-500">
                            <TrendingUp className="w-3 h-3" />
                            +12.5% this month
                        </div>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Leads In Pipe</span>
                        <div className="stat-value">{leads.length}</div>
                        <div className="stat-trend text-orange-500">
                            <Activity className="w-3 h-3" />
                            {stats.activeQuotes} active quotes
                        </div>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Job Completion</span>
                        <div className="stat-value">94.2%</div>
                        <div className="stat-trend text-blue-500">
                            <ShieldCheck className="w-3 h-3" />
                            Industry leading
                        </div>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Agent Efficiency</span>
                        <div className="stat-value">2.4m</div>
                        <div className="stat-trend text-muted">
                            <Zap className="w-3 h-3" />
                            Avg Response Time
                        </div>
                    </div>
                </div>

                {/* AGENT SWARM */}
                <h2 className="section-title">
                    <Bot className="w-6 h-6 text-orange" />
                    Autonomous Agent Swarm
                </h2>
                <div className="agent-swarm">
                    {loadingAssistants ? (
                        <div className="col-span-2 py-12 text-center text-muted border border-border bg-card">
                            Initialising Neural Swarm...
                        </div>
                    ) : (
                        assistants.map((agent) => (
                            <div key={agent.id} className="agent-card">
                                <div className="agent-header">
                                    <div className="agent-identity">
                                        <div className="agent-icon">
                                            {getAgentIcon(agent.name)}
                                        </div>
                                        <div className="agent-name">{agent.name}</div>
                                    </div>
                                    <div className="agent-status-dot"></div>
                                </div>
                                <p className="agent-mission">
                                    {agent.goal || 'Waiting for mission parameters...'}
                                </p>
                                <div className="agent-stats">
                                    <div className="agent-stat">
                                        <span className="agent-stat-label">Tasks</span>
                                        <span className="agent-stat-value">128</span>
                                    </div>
                                    <div className="agent-stat">
                                        <span className="agent-stat-label">Success Rate</span>
                                        <span className="agent-stat-value">98%</span>
                                    </div>
                                    <div className="agent-stat">
                                        <span className="agent-stat-label">Last Activity</span>
                                        <span className="agent-stat-value">{timeAgo(agent.updated_at)}</span>
                                    </div>
                                </div>
                                <div className="agent-actions">
                                    <button className="btn-brutalist btn-brutalist-orange" onClick={() => window.location.href = `/command/${business.id}/prompts?id=${agent.id}`}>
                                        <Edit3 className="w-4 h-4" />
                                        Prompt
                                    </button>
                                    <button className="btn-brutalist" onClick={() => window.location.href = `/command/${business.id}/automations?id=${agent.id}`}>
                                        <Zap className="w-4 h-4" />
                                        Automations
                                    </button>
                                    <button className="btn-brutalist">
                                        <Activity className="w-4 h-4" />
                                        Logs
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* OPERATION TERMINAL */}
                <h2 className="section-title">
                    <Terminal className="w-6 h-6 text-orange" />
                    Global Operation Logs
                </h2>
                <div className="operation-terminal">
                    <div className="scanline"></div>
                    <div className="terminal-header">
                        <div className="terminal-title">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Live Neural Feed
                        </div>
                        <div className="text-[0.65rem] text-muted font-mono">
                            UPSTASH_WORKFLOW_REPLAY_ACTIVE
                        </div>
                    </div>
                    <div className="terminal-body">
                        {agentLogs.length === 0 ? (
                            <div className="text-muted italic opacity-50">Awaiting agent activity...</div>
                        ) : (
                            agentLogs.map((log) => (
                                <div key={log.id} className="log-entry">
                                    <span className="log-time">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                                    <div className="log-content">
                                        <span className="log-tag">TASK_ID:{log.id.substring(0, 8)}</span>
                                        Agent received mission: "{log.goal}"
                                        <span className={`log-status status-${log.status}`}>
                                            {log.status.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                        <div className="log-entry">
                            <span className="log-time">[{new Date().toLocaleTimeString()}]</span>
                            <div className="log-content">
                                <span className="log-tag">SYSTEM</span>
                                Dashboard ready. Monitoring neural swarm...
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
