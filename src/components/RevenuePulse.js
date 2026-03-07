// src/components/RevenuePulse.js
// "Revenue Pulse" — Money Left on the Table Detector
// Shows businesses exactly how much revenue they're missing and what to do about it
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    TrendingUp, TrendingDown, AlertTriangle, MessageCircle,
    ChevronRight, X, Zap, RefreshCw, DollarSign, Activity
} from 'lucide-react';

export default function RevenuePulse({ business, onOpenWhatsApp }) {
    const [pulse, setPulse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [dismissedLeaks, setDismissedLeaks] = useState(new Set());
    const [actionedLeaks, setActionedLeaks] = useState(new Set());
    const [lastRefresh, setLastRefresh] = useState(null);

    const currency = business?.business_data?.currency || '₱';

    const fetchPulse = useCallback(async () => {
        if (!business?.id) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/revenue-pulse?businessId=${business.id}`);
            const data = await res.json();
            if (data.success) {
                setPulse(data.pulse);
                setLastRefresh(new Date());
            } else {
                setError(data.error);
            }
        } catch (err) {
            console.error('Revenue Pulse fetch error:', err);
            setError('Failed to load');
        } finally {
            setLoading(false);
        }
    }, [business?.id]);

    useEffect(() => {
        fetchPulse();
        // Refresh every 10 minutes
        const interval = setInterval(fetchPulse, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchPulse]);

    // Handle WhatsApp action on a leak
    const handleLeakAction = (leak) => {
        if (leak.phone && leak.message) {
            const cleanPhone = leak.phone.replace(/\D/g, '');
            const encoded = encodeURIComponent(leak.message);
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            if (isMobile) {
                window.location.href = `whatsapp://send?phone=${cleanPhone}&text=${encoded}`;
            } else {
                window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`, '_blank');
            }

            setActionedLeaks(prev => new Set([...prev, leak.id]));
        }
    };

    // Dismiss a leak
    const dismissLeak = (leakId) => {
        setDismissedLeaks(prev => new Set([...prev, leakId]));
    };

    // Format large numbers
    const formatCurrency = (val) => {
        if (val >= 1000000) return `${currency}${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `${currency}${(val / 1000).toFixed(0)}k`;
        return `${currency}${val.toLocaleString()}`;
    };

    // Health score color
    const getHealthColor = (score) => {
        if (score >= 70) return { bg: 'bg-green-500', text: 'text-green-600', ring: 'ring-green-200', label: 'Healthy' };
        if (score >= 40) return { bg: 'bg-yellow-500', text: 'text-yellow-600', ring: 'ring-yellow-200', label: 'Needs Work' };
        return { bg: 'bg-red-500', text: 'text-red-600', ring: 'ring-red-200', label: 'Leaking' };
    };

    // Urgency badge colors
    const urgencyColors = {
        red: 'bg-red-100 text-red-700',
        orange: 'bg-orange-100 text-orange-700',
        blue: 'bg-blue-100 text-blue-700',
        green: 'bg-green-100 text-green-700',
    };

    // Leak type icon backgrounds
    const leakTypeStyles = {
        cold_lead: 'bg-red-100 text-red-600',
        overdue_followup: 'bg-orange-100 text-orange-600',
        service_due: 'bg-blue-100 text-blue-600',
        expired_warranty: 'bg-purple-100 text-purple-600',
    };

    if (loading && !pulse) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-slate-200 rounded-xl"></div>
                    <div className="flex-1">
                        <div className="h-4 bg-slate-200 rounded w-32 mb-1"></div>
                        <div className="h-3 bg-slate-100 rounded w-48"></div>
                    </div>
                </div>
                <div className="h-20 bg-slate-100 rounded-xl"></div>
            </div>
        );
    }

    if (error || !pulse) return null;

    const health = getHealthColor(pulse.healthScore);
    const visibleLeaks = pulse.leaks.filter(l => !dismissedLeaks.has(l.id));
    const hasLeaks = pulse.totalLeakage > 0;

    // --- COLLAPSED VIEW (Always visible) ---
    if (!expanded) {
        return (
            <div className="mb-4">
                <button
                    onClick={() => setExpanded(true)}
                    className="w-full text-left"
                >
                    <div className={`relative overflow-hidden rounded-2xl border shadow-sm transition-all hover:shadow-md ${hasLeaks
                            ? 'bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 border-red-200'
                            : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                        }`}>
                        {/* Decorative pulse animation for leaks */}
                        {hasLeaks && (
                            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-red-100 animate-ping opacity-20"></div>
                        )}

                        <div className="p-4 relative">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className={`p-2 rounded-xl ${hasLeaks ? 'bg-red-100' : 'bg-green-100'}`}>
                                        <Activity className={`w-5 h-5 ${hasLeaks ? 'text-red-600' : 'text-green-600'}`} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-slate-900">Revenue Pulse</h3>
                                        <p className="text-[10px] text-slate-500">
                                            {hasLeaks ? 'Money on the table' : 'Looking good!'}
                                        </p>
                                    </div>
                                </div>

                                {/* Health Score Mini */}
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ring-2 ${health.ring} ${health.bg}`}>
                                        <span className="text-white text-xs font-bold">{pulse.healthScore}</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                </div>
                            </div>

                            {hasLeaks ? (
                                <div className="flex items-center justify-between bg-white/60 backdrop-blur rounded-xl p-3 border border-red-100">
                                    <div>
                                        <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Money Left on Table</p>
                                        <p className="text-2xl font-black text-slate-900">
                                            {formatCurrency(pulse.totalLeakage)}
                                        </p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        {pulse.leakSummary.coldLeads.count > 0 && (
                                            <p className="text-[10px] text-slate-600">
                                                🔥 {pulse.leakSummary.coldLeads.count} unanswered
                                            </p>
                                        )}
                                        {pulse.leakSummary.serviceDue.count > 0 && (
                                            <p className="text-[10px] text-slate-600">
                                                🔧 {pulse.leakSummary.serviceDue.count} overdue service
                                            </p>
                                        )}
                                        {pulse.leakSummary.overdueFollowups.count > 0 && (
                                            <p className="text-[10px] text-slate-600">
                                                ⏰ {pulse.leakSummary.overdueFollowups.count} need follow-up
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white/60 backdrop-blur rounded-xl p-3 border border-green-100 text-center">
                                    <p className="text-sm font-medium text-green-700">
                                        All caught up! No revenue leaks detected.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </button>
            </div>
        );
    }

    // --- EXPANDED VIEW ---
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto animate-slide-up">
                {/* Header */}
                <div className={`sticky top-0 z-10 p-5 pb-4 rounded-t-3xl sm:rounded-t-2xl ${hasLeaks
                        ? 'bg-gradient-to-br from-slate-900 via-red-950 to-slate-900'
                        : 'bg-gradient-to-br from-slate-900 via-green-950 to-slate-900'
                    }`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 backdrop-blur rounded-xl">
                                <Activity className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="font-bold text-white text-lg">Revenue Pulse</h2>
                                <p className="text-xs text-white/60">
                                    Updated {lastRefresh ? new Date(lastRefresh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={fetchPulse}
                                className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                            >
                                <RefreshCw className={`w-4 h-4 text-white/70 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => setExpanded(false)}
                                className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                            >
                                <X className="w-4 h-4 text-white/70" />
                            </button>
                        </div>
                    </div>

                    {/* Big Number + Health Score */}
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">
                                {hasLeaks ? 'Money Left on Table' : 'Revenue This Month'}
                            </p>
                            <p className="text-4xl font-black text-white">
                                {hasLeaks
                                    ? formatCurrency(pulse.totalLeakage)
                                    : formatCurrency(pulse.estimatedMonthlyRevenue)
                                }
                            </p>
                        </div>

                        {/* Health Score Ring */}
                        <div className="flex flex-col items-center">
                            <div className="relative w-16 h-16">
                                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                                    <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                                    <circle
                                        cx="32" cy="32" r="28"
                                        fill="none"
                                        stroke={pulse.healthScore >= 70 ? '#22c55e' : pulse.healthScore >= 40 ? '#eab308' : '#ef4444'}
                                        strokeWidth="4"
                                        strokeDasharray={`${(pulse.healthScore / 100) * 176} 176`}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xl font-black text-white">{pulse.healthScore}</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-white/50 font-medium mt-1">{health.label}</p>
                        </div>
                    </div>

                    {/* Leak Summary Pills */}
                    {hasLeaks && (
                        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
                            {pulse.leakSummary.coldLeads.count > 0 && (
                                <span className="shrink-0 px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold">
                                    🔥 {pulse.leakSummary.coldLeads.count} cold leads
                                </span>
                            )}
                            {pulse.leakSummary.overdueFollowups.count > 0 && (
                                <span className="shrink-0 px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300 text-[10px] font-bold">
                                    ⏰ {pulse.leakSummary.overdueFollowups.count} overdue
                                </span>
                            )}
                            {pulse.leakSummary.serviceDue.count > 0 && (
                                <span className="shrink-0 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                                    🔧 {pulse.leakSummary.serviceDue.count} service due
                                </span>
                            )}
                            {pulse.leakSummary.expiredWarranties.count > 0 && (
                                <span className="shrink-0 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                                    🛡️ {pulse.leakSummary.expiredWarranties.count} warranties
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="p-5">
                    {/* TODAY'S MONEY MOVES */}
                    {pulse.moneyMoves.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5 text-amber-500" />
                                Today&apos;s Money Moves
                            </h3>

                            <div className="space-y-2">
                                {pulse.moneyMoves.map((move, idx) => (
                                    <div
                                        key={move.id}
                                        className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100"
                                    >
                                        <div className="text-xl mt-0.5">{move.icon}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 leading-tight">{move.action}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{move.impact}</p>
                                        </div>
                                        <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${urgencyColors[move.urgencyColor]}`}>
                                            {move.urgency}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* REVENUE LEAKS (Actionable) */}
                    {visibleLeaks.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                                Revenue Leaks — Tap to Fix
                            </h3>

                            <div className="space-y-2">
                                {visibleLeaks.map((leak) => {
                                    const isActioned = actionedLeaks.has(leak.id);
                                    const style = leakTypeStyles[leak.type] || 'bg-slate-100 text-slate-600';

                                    return (
                                        <div
                                            key={leak.id}
                                            className={`relative rounded-xl border transition-all ${isActioned
                                                    ? 'bg-green-50 border-green-200 opacity-70'
                                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <div className="p-3 flex items-start gap-3">
                                                {/* Icon */}
                                                <div className={`shrink-0 p-2 rounded-lg text-lg ${style}`}>
                                                    {leak.icon}
                                                </div>

                                                {/* Details */}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-semibold leading-tight ${isActioned ? 'text-green-700 line-through' : 'text-slate-900'}`}>
                                                        {leak.title}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-0.5">{leak.subtitle}</p>
                                                    <p className="text-xs font-bold text-slate-800 mt-1">
                                                        {currency}{leak.value.toLocaleString()} potential
                                                    </p>
                                                </div>

                                                {/* Action Button */}
                                                <div className="shrink-0 flex flex-col gap-1">
                                                    {!isActioned ? (
                                                        <button
                                                            onClick={() => handleLeakAction(leak)}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition-colors"
                                                        >
                                                            <MessageCircle className="w-3 h-3" />
                                                            {leak.actionLabel}
                                                        </button>
                                                    ) : (
                                                        <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold">
                                                            ✅ Sent
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() => dismissLeak(leak.id)}
                                                        className="text-[10px] text-slate-400 hover:text-slate-600 text-center"
                                                    >
                                                        Dismiss
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* LEAK BREAKDOWN (Visual) */}
                    {hasLeaks && (
                        <div className="mb-6">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                                Where You&apos;re Losing Money
                            </h3>

                            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                                {[
                                    { key: 'coldLeads', label: 'Unanswered Leads', icon: '🔥', color: 'bg-red-500' },
                                    { key: 'overdueFollowups', label: 'Overdue Follow-ups', icon: '⏰', color: 'bg-orange-500' },
                                    { key: 'serviceDue', label: 'Service Reminders', icon: '🔧', color: 'bg-blue-500' },
                                    { key: 'expiredWarranties', label: 'Expired Warranties', icon: '🛡️', color: 'bg-purple-500' },
                                ].map(({ key, label, icon, color }) => {
                                    const data = pulse.leakSummary[key];
                                    if (data.count === 0) return null;
                                    const pct = pulse.totalLeakage > 0
                                        ? Math.round((data.revenue / pulse.totalLeakage) * 100)
                                        : 0;

                                    return (
                                        <div key={key}>
                                            <div className="flex items-center justify-between text-sm mb-1">
                                                <span className="text-slate-700 font-medium">
                                                    {icon} {label} ({data.count})
                                                </span>
                                                <span className="font-bold text-slate-900">
                                                    {formatCurrency(data.revenue)}
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Footer CTA */}
                    <div className="text-center pb-4">
                        <p className="text-xs text-slate-400">
                            Revenue Pulse updates every 10 minutes
                        </p>
                        <button
                            onClick={() => setExpanded(false)}
                            className="mt-3 w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
                        >
                            Got It — Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
