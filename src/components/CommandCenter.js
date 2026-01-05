// src/components/CommandCenter.js
// Mobile-first Command Center Dashboard - "The WhatsApp OS for Service Pros"
'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
    Settings, Snowflake, Wrench, MessageCircle, CheckCircle,
    Calendar, Megaphone, QrCode, Bot, Phone, Clock, X,
    Zap, TrendingUp, Users, ChevronRight
} from 'lucide-react';

export default function CommandCenter({ business, initialLeads = [], initialStats = {} }) {
    const [leads, setLeads] = useState(initialLeads);
    const [stats, setStats] = useState({
        activeQuotes: initialStats.activeQuotes || 0,
        pipeline: initialStats.pipeline || 0,
        booked: initialStats.booked || 0,
    });
    const [showBlastModal, setShowBlastModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);
    const [scheduleDate, setScheduleDate] = useState('tomorrow');
    const [scheduleTime, setScheduleTime] = useState('morning');
    const [sendingBlast, setSendingBlast] = useState(false);

    const supabase = createClientComponentClient();
    const businessData = business?.business_data || {};
    const businessName = businessData.businessName || business?.name || 'Your Business';
    const currency = businessData.currency || '₱';
    const niche = businessData.niche || 'Service';

    // Real-time subscription for new leads
    useEffect(() => {
        if (!business?.id) return;

        const channel = supabase
            .channel('command-leads')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'customers',
                    filter: `business_id=eq.${business.id}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setLeads(prev => [payload.new, ...prev].slice(0, 20));
                        setStats(prev => ({ ...prev, activeQuotes: prev.activeQuotes + 1 }));
                    } else if (payload.eventType === 'UPDATE') {
                        setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new : l));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [business?.id]);

    // Format time ago
    const timeAgo = (date) => {
        const now = new Date();
        const then = new Date(date);
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    // Get service icon
    const getServiceIcon = (notes) => {
        if (!notes) return <Wrench className="w-6 h-6" />;
        const lower = notes.toLowerCase();
        if (lower.includes('clean')) return <Snowflake className="w-6 h-6" />;
        if (lower.includes('repair') || lower.includes('leak')) return <Wrench className="w-6 h-6" />;
        return <Zap className="w-6 h-6" />;
    };

    // Get service color
    const getServiceColor = (notes) => {
        if (!notes) return 'bg-slate-100 text-slate-600';
        const lower = notes.toLowerCase();
        if (lower.includes('clean')) return 'bg-blue-100 text-blue-600';
        if (lower.includes('repair')) return 'bg-orange-100 text-orange-600';
        return 'bg-purple-100 text-purple-600';
    };

    // Parse lead details from notes
    const parseLeadDetails = (lead) => {
        let service = niche;
        let estimate = null;
        let details = {};

        if (lead.notes) {
            // Parse JOB QUOTE REQUEST format
            const estimateMatch = lead.notes.match(/Estimate:\s*([^\n]+)/);
            if (estimateMatch) estimate = estimateMatch[1].trim();

            const detailsMatch = lead.notes.match(/Details:\s*({.*})/);
            if (detailsMatch) {
                try {
                    details = JSON.parse(detailsMatch[1]);
                    if (details.serviceLabel) service = details.serviceLabel;
                    if (details.units) service += ` (${details.units} Unit${details.units > 1 ? 's' : ''})`;
                } catch (e) { }
            }
        }

        return { service, estimate, details };
    };

    // Get lead status badge
    const getStatusBadge = (lead) => {
        const status = lead.status || 'new';
        const createdAt = new Date(lead.created_at);
        const hoursSince = (Date.now() - createdAt) / (1000 * 60 * 60);

        if (status === 'booked' || status === 'confirmed') {
            return { text: 'BOOKED', color: 'bg-green-100 text-green-700' };
        }
        if (hoursSince < 1) {
            return { text: `New Lead (${timeAgo(lead.created_at)})`, color: 'bg-green-100 text-green-700' };
        }
        if (hoursSince < 24) {
            return { text: 'WAITING FOR REPLY', color: 'bg-yellow-100 text-yellow-700', isWaiting: true };
        }
        return { text: 'FOLLOW UP NEEDED', color: 'bg-red-100 text-red-700' };
    };

    // Open WhatsApp
    const openWhatsApp = (phone, name) => {
        const cleanPhone = phone?.replace(/\D/g, '');
        if (cleanPhone) {
            const message = encodeURIComponent(`Hi ${name || 'there'}! Following up on your quote request...`);
            window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
        }
    };

    // Mark as booked
    const markAsBooked = async (leadId) => {
        const { error } = await supabase
            .from('customers')
            .update({ status: 'booked' })
            .eq('id', leadId);

        if (!error) {
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: 'booked' } : l));
            setStats(prev => ({
                ...prev,
                activeQuotes: Math.max(0, prev.activeQuotes - 1),
                booked: prev.booked + 1
            }));
        }
    };

    // Open schedule modal for a lead
    const openScheduleModal = (lead) => {
        setSelectedLead(lead);
        setScheduleDate('tomorrow');
        setScheduleTime('morning');
        setShowScheduleModal(true);
    };

    // Format date for display
    const formatScheduleDate = () => {
        const today = new Date();
        if (scheduleDate === 'today') {
            return 'Today';
        } else if (scheduleDate === 'tomorrow') {
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            return 'Tomorrow';
        } else {
            // Custom date
            return new Date(scheduleDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        }
    };

    // Format time for display
    const formatScheduleTime = () => {
        if (scheduleTime === 'morning') return '9:00 AM';
        if (scheduleTime === 'afternoon') return '2:00 PM';
        if (scheduleTime === 'evening') return '5:00 PM';
        return scheduleTime;
    };

    // Handle schedule confirmation - "Pick, Click & Send"
    const handleScheduleConfirm = async () => {
        if (!selectedLead) return;

        const dateStr = formatScheduleDate();
        const timeStr = formatScheduleTime();
        const customerName = selectedLead.name || 'there';
        const phone = selectedLead.phone?.replace(/\D/g, '');

        // 1. Format the confirmation message
        const message = `Hi ${customerName}! ✅ I've confirmed your schedule for *${dateStr} at ${timeStr}*.\n\nI'll see you then! Please reply YES to confirm.\n\n- ${businessName}`;

        // 2. Mark as booked in database
        const { error } = await supabase
            .from('customers')
            .update({
                status: 'booked',
                notes: `${selectedLead.notes || ''}\n[SCHEDULED ${new Date().toISOString()}]: ${dateStr} at ${timeStr}`
            })
            .eq('id', selectedLead.id);

        if (!error) {
            // 3. Update local state
            setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, status: 'booked' } : l));
            setStats(prev => ({
                ...prev,
                activeQuotes: Math.max(0, prev.activeQuotes - 1),
                booked: prev.booked + 1
            }));
        }

        // 4. Close modal
        setShowScheduleModal(false);
        setSelectedLead(null);

        // 5. Open WhatsApp with pre-filled message
        if (phone) {
            const encodedMsg = encodeURIComponent(message);
            window.open(`https://wa.me/${phone}?text=${encodedMsg}`, '_blank');
        }
    };

    // Send blast
    const sendBlast = async () => {
        setSendingBlast(true);
        try {
            const response = await fetch('/api/whatsapp/blast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessId: business.id,
                    template: 'promo',
                    message: `🔥 ${niche} Promo! 10% OFF this week only. Reply "BOOK" to claim your slot! - ${businessName}`
                })
            });

            if (response.ok) {
                alert('✅ Blast sent successfully!');
                setShowBlastModal(false);
            } else {
                alert('❌ Failed to send blast');
            }
        } catch (err) {
            console.error('Blast error:', err);
            alert('❌ Error sending blast');
        } finally {
            setSendingBlast(false);
        }
    };

    // Download QR
    const downloadQR = () => {
        window.open(`/api/assets/flyer?businessId=${business.id}&format=sticker`, '_blank');
    };

    // Count old leads for blast
    const oldLeadsCount = leads.filter(l => {
        const hoursSince = (Date.now() - new Date(l.created_at)) / (1000 * 60 * 60);
        return hoursSince > 72 && l.status !== 'booked';
    }).length;

    return (
        <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 rounded-b-3xl shadow-lg sticky top-0 z-50">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-lg font-bold">{businessName}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-medium text-green-400">Digital Receptionist: ONLINE</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowSettingsModal(true)}
                        className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        <Settings className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Active Quotes</p>
                        <p className="text-2xl font-bold text-white">{stats.activeQuotes}</p>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Pipeline</p>
                        <p className="text-2xl font-bold text-green-400">
                            {currency}{stats.pipeline >= 1000 ? `${(stats.pipeline / 1000).toFixed(0)}k` : stats.pipeline}
                        </p>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Booked</p>
                        <p className="text-2xl font-bold text-blue-400">{stats.booked}</p>
                    </div>
                </div>
            </div>

            {/* Live Job Feed */}
            <div className="p-5">
                <h2 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">Live Job Feed</h2>

                {leads.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="font-bold text-slate-700 mb-2">No leads yet</h3>
                        <p className="text-sm text-slate-500">Share your quote page to start getting leads!</p>
                        <button
                            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/q/${business.id}`)}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg text-sm"
                        >
                            Copy Quote Link
                        </button>
                    </div>
                ) : (
                    leads.slice(0, 10).map((lead) => {
                        const { service, estimate } = parseLeadDetails(lead);
                        const status = getStatusBadge(lead);

                        return (
                            <div
                                key={lead.id}
                                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 relative overflow-hidden"
                            >
                                {status.isWaiting && (
                                    <div className="absolute top-0 right-0 bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                                        {status.text}
                                    </div>
                                )}

                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-lg ${getServiceColor(lead.notes)}`}>
                                        {getServiceIcon(lead.notes)}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-900">{service}</h3>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {lead.name || 'Customer'} • {lead.phone || 'No phone'}
                                        </p>
                                        {estimate && (
                                            <p className="text-lg font-black text-slate-900 mt-1">{estimate}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Bot activity */}
                                {lead.email_sequence_day && lead.email_sequence_day > 1 && (
                                    <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center gap-2">
                                        <Bot className="w-4 h-4 text-slate-400" />
                                        <p className="text-xs text-slate-600">
                                            <span className="font-bold">Bot:</span> Sent follow-up #{lead.email_sequence_day - 1}
                                        </p>
                                    </div>
                                )}

                                {/* Status badge for non-waiting */}
                                {!status.isWaiting && (
                                    <div className="mt-3 flex gap-2">
                                        <span className={`px-2 py-1 text-[10px] font-bold rounded ${status.color}`}>
                                            {status.text}
                                        </span>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <button
                                        onClick={() => openWhatsApp(lead.phone, lead.name)}
                                        className="flex items-center justify-center gap-2 py-2 bg-green-500 text-white rounded-lg font-bold text-sm hover:bg-green-600 transition-colors"
                                    >
                                        <MessageCircle className="w-4 h-4" /> WhatsApp
                                    </button>
                                    {lead.status === 'booked' || lead.status === 'confirmed' ? (
                                        <button
                                            disabled
                                            className="flex items-center justify-center gap-2 py-2 bg-green-100 text-green-700 rounded-lg font-bold text-sm"
                                        >
                                            <CheckCircle className="w-4 h-4" /> Booked ✓
                                        </button>
                                    ) : status.isWaiting ? (
                                        <button
                                            onClick={() => markAsBooked(lead.id)}
                                            className="flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-200 transition-colors"
                                        >
                                            <CheckCircle className="w-4 h-4" /> Booked
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => openScheduleModal(lead)}
                                            className="flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors"
                                        >
                                            <Calendar className="w-4 h-4" /> Schedule
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Quick Actions */}
            <div className="px-5 pb-5">
                <h2 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">Quick Actions</h2>

                {/* Blast Promo Card - Always visible */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 rounded-xl shadow-lg text-white mb-4 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 bg-white/10 w-24 h-24 rounded-full blur-2xl"></div>

                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur">
                            <Megaphone className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-bold">Blast Promo</h3>
                    </div>
                    <p className="text-sm text-blue-100 mb-4">
                        Send "10% Off Promo" to {oldLeadsCount || leads.length || 'your'} old leads?
                    </p>
                    <button
                        onClick={() => setShowBlastModal(true)}
                        className="w-full py-2 bg-white text-blue-700 font-bold rounded-lg text-sm hover:bg-blue-50 transition-colors"
                    >
                        Send Blast
                    </button>
                </div>

                {/* QR Download */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <QrCode className="w-5 h-5 text-slate-700" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-slate-900">Van Sticker QR</h3>
                            <p className="text-xs text-slate-500">Get more offline leads</p>
                        </div>
                    </div>
                    <button
                        onClick={downloadQR}
                        className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors"
                    >
                        Download
                    </button>
                </div>

                {/* Quote Page Link */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <Zap className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-slate-900">Quote Page</h3>
                            <p className="text-xs text-slate-500">Share with customers</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/q/${business.id}`);
                            alert('Link copied!');
                        }}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Copy Link
                    </button>
                </div>
            </div>

            {/* Blast Modal */}
            {showBlastModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg">Send Blast</h3>
                            <button onClick={() => setShowBlastModal(false)}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-slate-600 mb-4">
                            This will send a WhatsApp message to {oldLeadsCount} leads who haven&apos;t booked in the last 3 days.
                        </p>
                        <div className="bg-slate-50 p-3 rounded-lg text-sm mb-4">
                            🔥 {niche} Promo! 10% OFF this week only. Reply &quot;BOOK&quot; to claim your slot! - {businessName}
                        </div>
                        <button
                            onClick={sendBlast}
                            disabled={sendingBlast}
                            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50"
                        >
                            {sendingBlast ? 'Sending...' : `Send to ${oldLeadsCount} Leads`}
                        </button>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg">Settings</h3>
                            <button onClick={() => setShowSettingsModal(false)}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <a
                                href={`/dashboard`}
                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100"
                            >
                                <span className="font-medium">Full Dashboard</span>
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                            </a>
                            <a
                                href={`/preview/${business.id}`}
                                target="_blank"
                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100"
                            >
                                <span className="font-medium">View Landing Page</span>
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                            </a>
                            <a
                                href={`/q/${business.id}`}
                                target="_blank"
                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100"
                            >
                                <span className="font-medium">View Quote Page</span>
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Schedule Modal - "Pick, Click & Send" */}
            {showScheduleModal && selectedLead && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center">
                    <div className="bg-white rounded-t-3xl w-full max-w-md p-6 animate-slide-up">
                        <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mb-4"></div>

                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="font-bold text-lg">Schedule Job</h3>
                                <p className="text-sm text-slate-500">{selectedLead.name || 'Customer'}</p>
                            </div>
                            <button
                                onClick={() => { setShowScheduleModal(false); setSelectedLead(null); }}
                                className="p-2 hover:bg-slate-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Date Selection */}
                        <div className="mb-6">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                When is the job?
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => setScheduleDate('today')}
                                    className={`py-3 rounded-xl font-semibold text-sm transition-colors ${scheduleDate === 'today'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    Today
                                </button>
                                <button
                                    onClick={() => setScheduleDate('tomorrow')}
                                    className={`py-3 rounded-xl font-semibold text-sm transition-colors ${scheduleDate === 'tomorrow'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    Tomorrow
                                </button>
                                <input
                                    type="date"
                                    onChange={(e) => setScheduleDate(e.target.value)}
                                    className={`py-3 px-2 rounded-xl font-semibold text-sm text-center transition-colors ${scheduleDate !== 'today' && scheduleDate !== 'tomorrow'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                        </div>

                        {/* Time Selection */}
                        <div className="mb-6">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                What time?
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => setScheduleTime('morning')}
                                    className={`py-3 rounded-xl font-semibold text-sm transition-colors ${scheduleTime === 'morning'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    🌅 Morning
                                </button>
                                <button
                                    onClick={() => setScheduleTime('afternoon')}
                                    className={`py-3 rounded-xl font-semibold text-sm transition-colors ${scheduleTime === 'afternoon'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    ☀️ Afternoon
                                </button>
                                <button
                                    onClick={() => setScheduleTime('evening')}
                                    className={`py-3 rounded-xl font-semibold text-sm transition-colors ${scheduleTime === 'evening'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    🌙 Evening
                                </button>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                            <p className="text-xs text-green-600 font-bold mb-1">Message Preview:</p>
                            <p className="text-sm text-green-800">
                                &quot;Hi {selectedLead.name || 'there'}! ✅ I&apos;ve confirmed your schedule for <strong>{formatScheduleDate()} at {formatScheduleTime()}</strong>. I&apos;ll see you then! Please reply YES to confirm.&quot;
                            </p>
                        </div>

                        {/* Confirm Button */}
                        <button
                            onClick={handleScheduleConfirm}
                            className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-base flex items-center justify-center gap-2 transition-colors"
                        >
                            <MessageCircle className="w-5 h-5" />
                            Confirm & Send WhatsApp
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
