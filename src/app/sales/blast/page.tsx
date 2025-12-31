'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { REENGAGEMENT_TEMPLATES, fillWhatsAppTemplate, generateWhatsAppLink } from '../../../lib/whatsapp-templates';
import { SERVICE_TEMPLATES, getServiceTemplate } from '../../../lib/content-library';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Lead {
    id: string;
    email: string;
    phone?: string;
    created_at: string;
    status: string;
    business_id: string;
}

interface Business {
    id: string;
    name: string;
    service_type?: string;
    whatsapp_number?: string;
    phone_number?: string;
}

export default function BlastPage() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [selectedTemplate, setSelectedTemplate] = useState(REENGAGEMENT_TEMPLATES[0]);
    const [customMessage, setCustomMessage] = useState('');
    const [promoDetails, setPromoDetails] = useState('10% off this week only!');
    const [isLoading, setIsLoading] = useState(true);
    const [sendingBlast, setSendingBlast] = useState(false);
    const [blastResults, setBlastResults] = useState<{ sent: number; failed: number } | null>(null);
    const [business, setBusiness] = useState<Business | null>(null);

    useEffect(() => {
        loadLeads();
    }, []);

    const loadLeads = async () => {
        setIsLoading(true);
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get user's business
            const { data: businesses } = await supabase
                .from('businesses')
                .select('*')
                .eq('user_id', user.id)
                .limit(1);

            if (businesses && businesses.length > 0) {
                setBusiness(businesses[0]);

                // Get leads/customers for this business with phone numbers
                const { data: customers } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('business_id', businesses[0].id)
                    .not('phone', 'is', null)
                    .order('created_at', { ascending: false });

                if (customers) {
                    setLeads(customers);
                }
            }
        } catch (error) {
            console.error('Error loading leads:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleLeadSelection = (leadId: string) => {
        const newSelected = new Set(selectedLeads);
        if (newSelected.has(leadId)) {
            newSelected.delete(leadId);
        } else {
            newSelected.add(leadId);
        }
        setSelectedLeads(newSelected);
    };

    const selectAllWithPhone = () => {
        const leadsWithPhone = leads.filter(l => l.phone);
        setSelectedLeads(new Set(leadsWithPhone.map(l => l.id)));
    };

    const clearSelection = () => {
        setSelectedLeads(new Set());
    };

    const getPreviewMessage = () => {
        const template = selectedTemplate;
        const serviceType = business?.service_type || 'other';
        const serviceTemplate = getServiceTemplate(serviceType);

        return fillWhatsAppTemplate(template, {
            name: 'Customer',
            service: serviceTemplate.name,
            business_name: business?.name || 'Your Business',
            promo_details: promoDetails
        });
    };

    const handleSendBlast = async () => {
        if (selectedLeads.size === 0) {
            alert('Please select at least one lead');
            return;
        }

        setSendingBlast(true);
        setBlastResults(null);

        let sent = 0;
        let failed = 0;

        const selectedLeadsList = leads.filter(l => selectedLeads.has(l.id));

        for (const lead of selectedLeadsList) {
            if (!lead.phone) {
                failed++;
                continue;
            }

            try {
                const serviceType = business?.service_type || 'other';
                const serviceTemplate = getServiceTemplate(serviceType);

                const message = fillWhatsAppTemplate(selectedTemplate, {
                    name: lead.email.split('@')[0], // Use email prefix as name fallback
                    service: serviceTemplate.name,
                    business_name: business?.name || 'Your Business',
                    promo_details: promoDetails
                });

                const waLink = generateWhatsAppLink(lead.phone, message);

                // Open WhatsApp link (one at a time with delay to avoid spam detection)
                window.open(waLink, '_blank');
                sent++;

                // Add delay between opens
                await new Promise(resolve => setTimeout(resolve, 1500));

            } catch (error) {
                console.error('Error sending to', lead.email, error);
                failed++;
            }
        }

        setBlastResults({ sent, failed });
        setSendingBlast(false);
    };

    const leadsWithPhone = leads.filter(l => l.phone);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading leads...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">📢 Re-engagement Blast</h1>
                            <p className="text-gray-600 text-sm">Send promotional messages to past leads via WhatsApp</p>
                        </div>
                        <a href="/sales" className="text-blue-600 hover:underline">
                            ← Back to Sales
                        </a>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left: Lead Selection */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm border p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">Select Leads ({leadsWithPhone.length} with phone)</h2>
                                <div className="flex gap-2">
                                    <button
                                        onClick={selectAllWithPhone}
                                        className="text-sm px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        onClick={clearSelection}
                                        className="text-sm px-3 py-1 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {leadsWithPhone.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <p className="text-4xl mb-4">📭</p>
                                    <p>No leads with phone numbers yet.</p>
                                    <p className="text-sm mt-2">Leads come from your landing page forms.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {leadsWithPhone.map((lead) => (
                                        <div
                                            key={lead.id}
                                            onClick={() => toggleLeadSelection(lead.id)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedLeads.has(lead.id)
                                                    ? 'bg-blue-50 border-blue-300'
                                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedLeads.has(lead.id)}
                                                    onChange={() => { }}
                                                    className="w-4 h-4 text-blue-600"
                                                />
                                                <div className="flex-1">
                                                    <div className="font-medium text-gray-900">{lead.email}</div>
                                                    <div className="text-sm text-gray-500">📱 {lead.phone}</div>
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {new Date(lead.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedLeads.size > 0 && (
                                <div className="mt-4 pt-4 border-t">
                                    <p className="text-sm text-gray-600">
                                        <span className="font-semibold text-blue-600">{selectedLeads.size}</span> leads selected
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Message Composer */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl shadow-sm border p-6 sticky top-24">
                            <h2 className="text-lg font-semibold mb-4">Message Template</h2>

                            {/* Template Selection */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Choose Template
                                </label>
                                <select
                                    value={selectedTemplate.id}
                                    onChange={(e) => {
                                        const template = REENGAGEMENT_TEMPLATES.find(t => t.id === e.target.value);
                                        if (template) setSelectedTemplate(template);
                                    }}
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    {REENGAGEMENT_TEMPLATES.map((template) => (
                                        <option key={template.id} value={template.id}>
                                            {template.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">{selectedTemplate.description}</p>
                            </div>

                            {/* Promo Details Input */}
                            {selectedTemplate.id === 'blast_seasonal' && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Promo Details
                                    </label>
                                    <input
                                        type="text"
                                        value={promoDetails}
                                        onChange={(e) => setPromoDetails(e.target.value)}
                                        placeholder="e.g. 20% off this week!"
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            )}

                            {/* Message Preview */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Preview
                                </label>
                                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                    <div className="flex items-start gap-2">
                                        <span className="text-2xl">💬</span>
                                        <div className="whitespace-pre-wrap text-sm text-gray-800">
                                            {getPreviewMessage()}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Risk Warning */}
                            <div className={`p-3 rounded-lg mb-4 ${selectedTemplate.riskLevel === 'low'
                                    ? 'bg-green-50 border border-green-200'
                                    : 'bg-yellow-50 border border-yellow-200'
                                }`}>
                                <div className="flex items-center gap-2">
                                    <span>{selectedTemplate.riskLevel === 'low' ? '✅' : '⚠️'}</span>
                                    <span className="text-sm">
                                        {selectedTemplate.riskLevel === 'low'
                                            ? 'Safe template - low ban risk'
                                            : 'Moderate risk - use sparingly'}
                                    </span>
                                </div>
                                {selectedTemplate.cooldownHours && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        Recommended: Wait {selectedTemplate.cooldownHours}h between sends
                                    </p>
                                )}
                            </div>

                            {/* Send Button */}
                            <button
                                onClick={handleSendBlast}
                                disabled={selectedLeads.size === 0 || sendingBlast}
                                className={`w-full py-3 rounded-lg font-semibold transition-all ${selectedLeads.size === 0 || sendingBlast
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                            >
                                {sendingBlast ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Sending...
                                    </span>
                                ) : (
                                    <span>📤 Send to {selectedLeads.size} Leads</span>
                                )}
                            </button>

                            {/* Results */}
                            {blastResults && (
                                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <h3 className="font-semibold text-blue-800">Blast Complete!</h3>
                                    <p className="text-sm text-blue-700">
                                        ✅ {blastResults.sent} sent
                                        {blastResults.failed > 0 && ` | ❌ ${blastResults.failed} failed`}
                                    </p>
                                    <p className="text-xs text-blue-600 mt-2">
                                        WhatsApp tabs opened. Complete sending in each tab.
                                    </p>
                                </div>
                            )}

                            {/* Instructions */}
                            <div className="mt-4 text-xs text-gray-500">
                                <p className="font-medium mb-1">How it works:</p>
                                <ol className="list-decimal pl-4 space-y-1">
                                    <li>Select leads to message</li>
                                    <li>Choose a template</li>
                                    <li>Click Send - WhatsApp tabs open</li>
                                    <li>Click Send in each WhatsApp tab</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
