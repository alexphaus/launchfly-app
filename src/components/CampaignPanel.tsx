'use client';

import { useState, useEffect } from 'react';

interface CampaignTemplate {
    id: string;
    name: string;
    emoji: string;
    preview: string;
}

interface CampaignPanelProps {
    businessId: string;
    onClose?: () => void;
}

export default function CampaignPanel({ businessId, onClose }: CampaignPanelProps) {
    const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');
    const [customMessage, setCustomMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [testMode, setTestMode] = useState(true);
    const [result, setResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);

    // Load templates
    useEffect(() => {
        fetch('/api/campaign')
            .then(res => res.json())
            .then(data => {
                setTemplates(data.templates || []);
                if (data.templates?.length > 0) {
                    setSelectedTemplate(data.templates[0].id);
                }
            })
            .catch(console.error);
    }, []);

    const handleSend = async () => {
        if (!selectedTemplate) return;

        setIsSending(true);
        setResult(null);

        try {
            const response = await fetch('/api/campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessId,
                    templateId: selectedTemplate,
                    customMessage: selectedTemplate === 'custom' ? customMessage : undefined,
                    channel: 'whatsapp',
                    testMode
                })
            });

            const data = await response.json();

            if (response.ok) {
                setResult({ success: true, message: data.message });
            } else {
                setResult({ error: data.error });
            }
        } catch (error: any) {
            setResult({ error: error.message });
        } finally {
            setIsSending(false);
        }
    };

    const selectedTemplateData = templates.find(t => t.id === selectedTemplate);

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">📣 Re-Engagement Blast</h2>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        ✕
                    </button>
                )}
            </div>

            <p className="text-sm text-slate-500 mb-4">
                Send a promotional message to all your past leads. Limited to 1 blast per week.
            </p>

            {/* Template Selection */}
            <div className="mb-4">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                    Choose Template
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {templates.map(template => (
                        <button
                            key={template.id}
                            onClick={() => setSelectedTemplate(template.id)}
                            className={`p-3 rounded-lg border text-left transition-all ${selectedTemplate === template.id
                                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            <span className="text-lg">{template.emoji}</span>
                            <span className="block text-sm font-medium mt-1">{template.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Preview */}
            {selectedTemplateData && selectedTemplate !== 'custom' && (
                <div className="mb-4">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                        Preview
                    </label>
                    <div className="bg-slate-100 rounded-lg p-3 text-sm text-slate-700">
                        {selectedTemplateData.preview}
                    </div>
                </div>
            )}

            {/* Custom Message Input */}
            {selectedTemplate === 'custom' && (
                <div className="mb-4">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                        Your Message
                    </label>
                    <textarea
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder="Hi {name}! Your custom message here..."
                        rows={5}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                        Use {'{name}'}, {'{business_name}'}, {'{service}'} for personalization
                    </p>
                </div>
            )}

            {/* Test Mode Toggle */}
            <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={testMode}
                        onChange={(e) => setTestMode(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-600">
                        🧪 Test mode (send to 1 lead only)
                    </span>
                </label>
            </div>

            {/* Result Message */}
            {result && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${result.success
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {result.success ? '✅ ' : '❌ '}
                    {result.message || result.error}
                </div>
            )}

            {/* Send Button */}
            <button
                onClick={handleSend}
                disabled={isSending || !selectedTemplate}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium shadow hover:shadow-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
                {isSending ? (
                    <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Sending...
                    </>
                ) : (
                    <>
                        📣 {testMode ? 'Send Test' : 'Send to All Leads'}
                    </>
                )}
            </button>

            <p className="text-xs text-center text-slate-400 mt-3">
                Messages sent via WhatsApp for 90%+ open rates
            </p>
        </div>
    );
}
