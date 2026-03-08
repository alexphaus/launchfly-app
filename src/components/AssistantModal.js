// src/components/AssistantModal.js
// ═══════════════════════════════════════════════════════════════════════════
// AI Assistant Configuration Modal
// ═══════════════════════════════════════════════════════════════════════════
//
// A clean, mobile-first modal that lets the business owner view & edit
// their AI employee's brain: system prompt, knowledge base, tools,
// follow-up sequence, and triggers.
//
// Tabs: Brain | Knowledge | Sequence | Triggers

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Bot, Brain, Activity,
  ChevronDown, ChevronUp, Plus, Trash2, Save,
  Check, RefreshCw, Zap, Globe, Copy,
  Eye, ToggleLeft, ToggleRight,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────

const TONES = [
  { id: 'friendly', label: 'Friendly', emoji: '😊', desc: 'Warm and casual' },
  { id: 'professional', label: 'Professional', emoji: '👔', desc: 'Polished and corporate' },
  { id: 'casual', label: 'Casual', emoji: '🤙', desc: 'Chill, like a friend' },
  { id: 'direct', label: 'Direct', emoji: '🎯', desc: 'Straight to the point' },
];

const GOALS = [
  { id: 'book_consultation', label: 'Book a Consultation', emoji: '📅', desc: 'Get prospects on a call or site visit' },
  { id: 'close_sale', label: 'Close a Sale', emoji: '💰', desc: 'Push toward checkout/payment' },
  { id: 'collect_review', label: 'Collect Reviews', emoji: '⭐', desc: 'Get happy customers to leave reviews' },
  { id: 'reactivate', label: 'Reactivate Old Leads', emoji: '🔄', desc: 'Win back ghosted prospects' },
];

const AVAILABLE_TOOLS = [
  { id: 'send_checkout_link', label: 'Send Checkout Link', emoji: '💳', desc: 'Stripe payment link' },
  { id: 'book_calendar', label: 'Book Calendar Slot', emoji: '📅', desc: 'Schedule appointments' },
  { id: 'send_template', label: 'Send Template', emoji: '📝', desc: 'Pre-approved WhatsApp templates' },
  { id: 'transfer_to_human', label: 'Transfer to Human', emoji: '🙋', desc: 'Escalate to the owner' },
  { id: 'send_financing_link', label: 'Send Financing Link', emoji: '🏦', desc: 'Financing application' },
  { id: 'lookup_customer', label: 'Lookup Customer', emoji: '🔍', desc: 'Check customer history' },
];

// ─── Automation Events & Actions ─────────────────────────────────────────

const AUTOMATION_EVENTS = [
  { id: 'inbound_whatsapp', label: 'WhatsApp Message Received', icon: '💬' },
  { id: 'missed_call', label: 'Missed Call', icon: '📞' },
  { id: 'booking_created', label: 'Booking Created', icon: '📅' },
  { id: 'booking_cancelled', label: 'Booking Cancelled', icon: '❌' },
  { id: 'payment_received', label: 'Payment Received', icon: '💰' },
  { id: 'quote_sent', label: 'Quote / Email Sent', icon: '📧' },
  { id: 'sequence_completed', label: 'Sequence Completed', icon: '✅' },
  { id: 'customer_replied', label: 'Customer Replied', icon: '↩️' },
  { id: 'external_webhook', label: 'External Webhook', icon: '⚡' },
];

const AUTOMATION_ACTIONS = [
  { id: 'send_whatsapp', label: 'Send WhatsApp', icon: '💬', configFields: ['message'] },
  { id: 'delay', label: 'Wait / Delay', icon: '⏳', configFields: ['delayHours'] },
  { id: 'trigger_voice_call', label: 'AI Voice Call', icon: '📞', configFields: [] },
  { id: 'notify_owner', label: 'Notify Owner', icon: '🔔', configFields: ['message'] },
  { id: 'call_webhook', label: 'Call Webhook URL', icon: '🌐', configFields: ['url'] },
  { id: 'update_status', label: 'Update Customer Status', icon: '🏷️', configFields: ['status'] },
  { id: 'send_template', label: 'Send Template', icon: '📝', configFields: ['templateSid', 'contentVars'] },
  { id: 'start_sequence', label: 'Start Legacy Sequence', icon: '🔄', configFields: [] },
];

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ─── Component ───────────────────────────────────────────────────────────

export default function AssistantModal({ isOpen, onClose, business }) {
  const [activeTab, setActiveTab] = useState('brain');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'saved' | 'error'

  // Assistant config state
  const [config, setConfig] = useState({
    name: 'AI Sales Assistant',
    tone: 'friendly',
    goal: 'book_consultation',
    system_prompt: null,
    custom_rules: [],
    knowledge_base: { pricing: [], faq: [], objections: [] },
    tools_enabled: ['send_checkout_link', 'book_calendar', 'send_template', 'transfer_to_human'],
    sequence_steps: [],
    trigger_config: { whatsapp_webhook: true, missed_call: true },
  });

  const [promptMode, setPromptMode] = useState('auto'); // 'auto' | 'custom'
  const [expandedSection, setExpandedSection] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Assistant switcher state
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [assistantList, setAssistantList] = useState([]);
  const [currentAssistantId, setCurrentAssistantId] = useState(null);
  const [switching, setSwitching] = useState(false);

  // ── Load assistant config ──────────────────────────────────────────────
  // Apply assistant data to local config state
  const applyAssistantData = useCallback((assistant) => {
    if (!assistant) return;
    setCurrentAssistantId(assistant.id);
    setConfig({
      name: assistant.name || 'AI Sales Assistant',
      tone: assistant.tone || 'friendly',
      goal: assistant.goal || 'book_consultation',
      system_prompt: assistant.system_prompt,
      custom_rules: assistant.custom_rules || [],
      knowledge_base: assistant.knowledge_base || { pricing: [], faq: [], objections: [] },
      tools_enabled: assistant.tools_enabled || [],
      sequence_steps: assistant.sequence_steps || [],
      trigger_config: assistant.trigger_config || {},
    });
    setPromptMode(assistant.system_prompt ? 'custom' : 'auto');
  }, []);

  const loadAssistant = useCallback(async () => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/assistants?businessId=${business.id}`, { cache: 'no-store' });
      const data = await res.json();

      if (data.assistant) {
        applyAssistantData(data.assistant);
      } else if (data.defaults) {
        setCurrentAssistantId(null);
        setConfig(data.defaults);
        setPromptMode('auto');
      }
    } catch (err) {
      console.error('Failed to load assistant:', err);
    } finally {
      setLoading(false);
    }
  }, [business?.id, applyAssistantData]);

  const loadAssistantList = useCallback(async () => {
    if (!business?.id) return;
    try {
      const res = await fetch(`/api/assistants?businessId=${business.id}&list=true`, { cache: 'no-store' });
      const data = await res.json();
      setAssistantList(data.assistants || []);
    } catch (err) {
      console.error('Failed to load assistant list:', err);
    }
  }, [business?.id]);

  const switchAssistant = async (assistantId) => {
    if (!business?.id || switching) return;
    setSwitching(true);
    setShowSwitcher(false);
    setLoading(true);
    try {
      const res = await fetch('/api/assistants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, assistantId }),
      });
      const data = await res.json();
      if (res.ok && data.assistant) {
        applyAssistantData(data.assistant);
        loadAssistantList();
        loadActivity();
      }
    } catch (err) {
      console.error('Failed to switch assistant:', err);
    } finally {
      setSwitching(false);
      setLoading(false);
    }
  };

  const createNewAssistant = async () => {
    if (!business?.id || switching) return;
    setSwitching(true);
    setShowSwitcher(false);
    setLoading(true);
    try {
      const res = await fetch('/api/assistants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, createNew: true }),
      });
      const data = await res.json();
      if (res.ok && data.assistant) {
        applyAssistantData(data.assistant);
        loadAssistantList();
        loadActivity();
      }
    } catch (err) {
      console.error('Failed to create assistant:', err);
    } finally {
      setSwitching(false);
      setLoading(false);
    }
  };

  const loadActivity = useCallback(async () => {
    if (!business?.id) return;
    setLoadingActivity(true);
    try {
      const res = await fetch(`/api/assistants/activity?businessId=${business.id}`, { cache: 'no-store' });
      const data = await res.json();
      setActivityLog(data.activities || []);
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setLoadingActivity(false);
    }
  }, [business?.id]);

  useEffect(() => {
    if (isOpen) {
      loadAssistant();
      loadActivity();
      loadAssistantList();
    }
  }, [isOpen, loadAssistant, loadActivity, loadAssistantList]);

  // ── Save assistant config ──────────────────────────────────────────────
  const saveAssistant = async () => {
    if (!business?.id) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/assistants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          assistantId: currentAssistantId,
          ...config,
          system_prompt: promptMode === 'custom' ? config.system_prompt : null,
        }),
      });
      const data = await res.json();

      if (res.ok && data.assistant) {
        applyAssistantData(data.assistant);
        setSaveStatus('saved');
        loadAssistantList();
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Failed to save assistant:', err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  // ── Knowledge base helpers ─────────────────────────────────────────────
  const addKBItem = (section) => {
    const kb = { ...config.knowledge_base };
    if (section === 'pricing') {
      kb.pricing = [...(kb.pricing || []), { service: '', price: '', unit: 'job' }];
    } else if (section === 'faq') {
      kb.faq = [...(kb.faq || []), { q: '', a: '' }];
    } else if (section === 'objections') {
      kb.objections = [...(kb.objections || []), { trigger: '', response: '' }];
    }
    setConfig({ ...config, knowledge_base: kb });
  };

  const updateKBItem = (section, index, field, value) => {
    const kb = { ...config.knowledge_base };
    kb[section] = [...kb[section]];
    kb[section][index] = { ...kb[section][index], [field]: value };
    setConfig({ ...config, knowledge_base: kb });
  };

  const removeKBItem = (section, index) => {
    const kb = { ...config.knowledge_base };
    kb[section] = kb[section].filter((_, i) => i !== index);
    setConfig({ ...config, knowledge_base: kb });
  };

  // ── Tool toggle ────────────────────────────────────────────────────────
  const toggleTool = (toolId) => {
    const tools = config.tools_enabled.includes(toolId)
      ? config.tools_enabled.filter(t => t !== toolId)
      : [...config.tools_enabled, toolId];
    setConfig({ ...config, tools_enabled: tools });
  };

  // ── Automation rule helpers ─────────────────────────────────────────────
  const getRules = () => config.trigger_config?.rules || [];

  const setRules = (rules) => {
    setConfig({
      ...config,
      trigger_config: { ...config.trigger_config, rules },
    });
  };

  const addRule = () => {
    setRules([...getRules(), {
      id: `rule_${Date.now()}`,
      event: 'quote_sent',
      conditions: [],
      actions: [
        { type: 'send_whatsapp', config: { message: 'Hey {firstName}, just sent you an estimate for {businessName}. Let me know if you have questions!' } },
        { type: 'delay', config: { delayHours: 48 } },
        { type: 'send_whatsapp', config: { message: 'Hi {firstName}, wanted to follow up on the quote. Ready to get started?' } },
      ],
      enabled: true,
    }]);
  };

  const updateRule = (index, field, value) => {
    const rules = [...getRules()];
    rules[index] = { ...rules[index], [field]: value };
    setRules(rules);
  };

  const removeRule = (index) => {
    setRules(getRules().filter((_, i) => i !== index));
  };

  const addActionToRule = (ruleIndex) => {
    const rules = [...getRules()];
    rules[ruleIndex] = {
      ...rules[ruleIndex],
      actions: [...rules[ruleIndex].actions, { type: 'send_whatsapp', config: { message: '' } }],
    };
    setRules(rules);
  };

  const updateActionInRule = (ruleIndex, actionIndex, field, value) => {
    const rules = [...getRules()];
    const actions = [...rules[ruleIndex].actions];
    if (field === 'type') {
      actions[actionIndex] = { type: value, config: {} };
    } else {
      actions[actionIndex] = { ...actions[actionIndex], config: { ...actions[actionIndex].config, [field]: value } };
    }
    rules[ruleIndex] = { ...rules[ruleIndex], actions };
    setRules(rules);
  };

  const removeActionFromRule = (ruleIndex, actionIndex) => {
    const rules = [...getRules()];
    rules[ruleIndex] = {
      ...rules[ruleIndex],
      actions: rules[ruleIndex].actions.filter((_, i) => i !== actionIndex),
    };
    setRules(rules);
  };

  const addConditionToRule = (ruleIndex) => {
    const rules = [...getRules()];
    rules[ruleIndex] = {
      ...rules[ruleIndex],
      conditions: [...(rules[ruleIndex].conditions || []), { field: 'message', op: 'contains', value: '' }],
    };
    setRules(rules);
  };

  const updateConditionInRule = (ruleIndex, condIndex, field, value) => {
    const rules = [...getRules()];
    const conditions = [...(rules[ruleIndex].conditions || [])];
    conditions[condIndex] = { ...conditions[condIndex], [field]: value };
    rules[ruleIndex] = { ...rules[ruleIndex], conditions };
    setRules(rules);
  };

  const removeConditionFromRule = (ruleIndex, condIndex) => {
    const rules = [...getRules()];
    rules[ruleIndex] = {
      ...rules[ruleIndex],
      conditions: (rules[ruleIndex].conditions || []).filter((_, i) => i !== condIndex),
    };
    setRules(rules);
  };

  // ── Custom rule helpers ────────────────────────────────────────────────
  const addCustomRule = () => {
    setConfig({ ...config, custom_rules: [...config.custom_rules, ''] });
  };

  const updateCustomRule = (index, value) => {
    const rules = [...config.custom_rules];
    rules[index] = value;
    setConfig({ ...config, custom_rules: rules });
  };

  const removeCustomRule = (index) => {
    setConfig({ ...config, custom_rules: config.custom_rules.filter((_, i) => i !== index) });
  };

  if (!isOpen) return null;

  const businessName = business?.business_data?.businessName || business?.name || 'Your Business';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 relative">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Bot className="w-5 h-5 text-emerald-600" />
            </div>
            <button
              onClick={() => setShowSwitcher(!showSwitcher)}
              className="flex items-center gap-1.5 hover:bg-slate-50 rounded-lg px-1.5 py-1 -mx-1.5 transition-colors"
            >
              <div className="text-left">
                <h2 className="font-bold text-lg text-slate-900 leading-tight">{config.name}</h2>
                <p className="text-xs text-slate-500">
                  {config.tone.charAt(0).toUpperCase() + config.tone.slice(1)} · {GOALS.find(g => g.id === config.goal)?.label || config.goal}
                </p>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showSwitcher ? 'rotate-180' : ''}`} />
            </button>

            {/* ── Switcher Dropdown ───────────────────────────────────── */}
            {showSwitcher && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSwitcher(false)} />
                <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Switch Assistant</p>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {assistantList.map(a => (
                      <button
                        key={a.id}
                        onClick={() => a.id !== currentAssistantId && switchAssistant(a.id)}
                        disabled={switching}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                          a.id === currentAssistantId
                            ? 'bg-emerald-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                          a.id === currentAssistantId
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {TONES.find(t => t.id === a.tone)?.emoji || '🤖'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            a.id === currentAssistantId ? 'text-emerald-700' : 'text-slate-700'
                          }`}>{a.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {GOALS.find(g => g.id === a.goal)?.label || a.goal}
                          </p>
                        </div>
                        {a.id === currentAssistantId && (
                          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={createNewAssistant}
                    disabled={switching}
                    className="w-full flex items-center gap-3 px-3 py-2.5 border-t border-slate-100 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                      <Plus className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-sm font-medium text-blue-600">Create New Assistant</p>
                  </button>
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* ── Tab Bar ───────────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-100 px-2 shrink-0">
          {[
            { id: 'brain', label: 'Brain', Icon: Brain },
            { id: 'activity', label: 'Activity', Icon: Activity },
            { id: 'triggers', label: 'Automations', Icon: Zap },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-emerald-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <tab.Icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-600 rounded-t" />
              )}
            </button>
          ))}
        </div>

        {/* ── Content ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* ═══ BRAIN TAB ═══ */}
              {activeTab === 'brain' && (
                <div className="space-y-5">
                  {/* Name */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                      Assistant Name
                    </label>
                    <input
                      type="text"
                      value={config.name}
                      onChange={e => setConfig({ ...config, name: e.target.value })}
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      placeholder="AI Sales Assistant"
                    />
                  </div>

                  {/* Tone */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                      Tone
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {TONES.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setConfig({ ...config, tone: t.id })}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            config.tone === t.id
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{t.emoji}</span>
                            <span className="text-sm font-medium">{t.label}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 ml-6">{t.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Goal */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                      Primary Goal
                    </label>
                    <div className="space-y-2">
                      {GOALS.map(g => (
                        <button
                          key={g.id}
                          onClick={() => setConfig({ ...config, goal: g.id })}
                          className={`w-full p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${
                            config.goal === g.id
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <span className="text-xl">{g.emoji}</span>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{g.label}</p>
                            <p className="text-[11px] text-slate-500">{g.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* System Prompt */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        System Prompt
                      </label>
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                        <button
                          onClick={() => setPromptMode('auto')}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                            promptMode === 'auto' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'
                          }`}
                        >
                          Auto
                        </button>
                        <button
                          onClick={() => setPromptMode('custom')}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                            promptMode === 'custom' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'
                          }`}
                        >
                          Custom
                        </button>
                      </div>
                    </div>

                    {promptMode === 'auto' ? (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs text-slate-500 font-medium">Auto-generated from your business data</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-mono bg-white p-2 rounded-lg border border-slate-100 max-h-32 overflow-y-auto">
                          You are the {config.tone} AI assistant for <strong>{businessName}</strong>.{'\n'}
                          Your goal is to: {GOALS.find(g => g.id === config.goal)?.label || config.goal}.{'\n'}
                          {config.knowledge_base.pricing?.length > 0 && `\nPricing: ${config.knowledge_base.pricing.map(p => `${p.service}: ${p.price}/${p.unit}`).join(', ')}`}
                          {config.knowledge_base.faq?.length > 0 && `\n${config.knowledge_base.faq.length} FAQ answers loaded.`}
                          {config.custom_rules?.length > 0 && `\n${config.custom_rules.length} custom rules applied.`}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-2">
                          The full prompt is built automatically from your knowledge base, pricing, and business info.
                          Switch to <span className="font-medium">Custom</span> to write your own.
                        </p>
                      </div>
                    ) : (
                      <textarea
                        value={config.system_prompt || ''}
                        onChange={e => setConfig({ ...config, system_prompt: e.target.value })}
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm font-mono resize-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        rows={8}
                        placeholder={`You are the sales assistant for ${businessName}.\nYour tone is: ${config.tone}.\nYour primary goal is to: ${GOALS.find(g => g.id === config.goal)?.label || config.goal}.\n\nHere are your approved pricing guidelines:\n- ...\n\nHere is your FAQ knowledge base:\n- ...`}
                      />
                    )}
                  </div>

                  {/* Custom Rules */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Custom Rules
                      </label>
                      <button onClick={addCustomRule} className="text-xs text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add Rule
                      </button>
                    </div>
                    {config.custom_rules.length === 0 ? (
                      <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl text-center">
                        No custom rules yet. Add rules like &quot;Never offer discounts&quot; or &quot;Always ask for zip code.&quot;
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {config.custom_rules.map((rule, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              type="text"
                              value={rule}
                              onChange={e => updateCustomRule(i, e.target.value)}
                              className="flex-1 p-2.5 border border-slate-200 rounded-lg text-sm focus:border-emerald-500 outline-none"
                              placeholder="e.g. Never offer discounts over 10%"
                            />
                            <button onClick={() => removeCustomRule(i)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Knowledge Base */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">
                      Knowledge Base
                    </label>

                    <div className="space-y-4">

                  {/* Pricing */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => setExpandedSection(expandedSection === 'pricing' ? null : 'pricing')}
                        className="flex items-center gap-2 text-sm font-bold text-slate-700"
                      >
                        💰 Pricing Guidelines
                        <span className="text-xs text-slate-400 font-normal">({(config.knowledge_base.pricing || []).length})</span>
                        {expandedSection === 'pricing' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button onClick={() => { addKBItem('pricing'); setExpandedSection('pricing'); }} className="text-xs text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                    {expandedSection === 'pricing' && (
                      <div className="space-y-2">
                        {(config.knowledge_base.pricing || []).length === 0 ? (
                          <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl text-center">
                            Add your services and pricing so the AI can quote accurately.
                          </p>
                        ) : (
                          (config.knowledge_base.pricing || []).map((item, i) => (
                            <div key={i} className="bg-slate-50 p-3 rounded-xl space-y-2">
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={item.service}
                                  onChange={e => updateKBItem('pricing', i, 'service', e.target.value)}
                                  className="flex-1 p-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-500 outline-none"
                                  placeholder="Service name"
                                />
                                <button onClick={() => removeKBItem('pricing', i)} className="p-2 text-slate-400 hover:text-red-500">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={item.price}
                                  onChange={e => updateKBItem('pricing', i, 'price', e.target.value)}
                                  className="flex-1 p-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-500 outline-none"
                                  placeholder="Price (e.g. $8,000 - $15,000)"
                                />
                                <input
                                  type="text"
                                  value={item.unit}
                                  onChange={e => updateKBItem('pricing', i, 'unit', e.target.value)}
                                  className="w-20 p-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-500 outline-none"
                                  placeholder="per..."
                                />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* FAQ */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => setExpandedSection(expandedSection === 'faq' ? null : 'faq')}
                        className="flex items-center gap-2 text-sm font-bold text-slate-700"
                      >
                        ❓ FAQ Knowledge Base
                        <span className="text-xs text-slate-400 font-normal">({(config.knowledge_base.faq || []).length})</span>
                        {expandedSection === 'faq' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button onClick={() => { addKBItem('faq'); setExpandedSection('faq'); }} className="text-xs text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                    {expandedSection === 'faq' && (
                      <div className="space-y-2">
                        {(config.knowledge_base.faq || []).length === 0 ? (
                          <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl text-center">
                            Add common questions your customers ask.
                          </p>
                        ) : (
                          (config.knowledge_base.faq || []).map((item, i) => (
                            <div key={i} className="bg-slate-50 p-3 rounded-xl space-y-2">
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={item.q}
                                  onChange={e => updateKBItem('faq', i, 'q', e.target.value)}
                                  className="flex-1 p-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-500 outline-none"
                                  placeholder="Question"
                                />
                                <button onClick={() => removeKBItem('faq', i)} className="p-2 text-slate-400 hover:text-red-500">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <textarea
                                value={item.a}
                                onChange={e => updateKBItem('faq', i, 'a', e.target.value)}
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm resize-none focus:border-emerald-500 outline-none"
                                rows={2}
                                placeholder="Answer"
                              />
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Objection Handling */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => setExpandedSection(expandedSection === 'objections' ? null : 'objections')}
                        className="flex items-center gap-2 text-sm font-bold text-slate-700"
                      >
                        🛡️ Objection Handling
                        <span className="text-xs text-slate-400 font-normal">({(config.knowledge_base.objections || []).length})</span>
                        {expandedSection === 'objections' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button onClick={() => { addKBItem('objections'); setExpandedSection('objections'); }} className="text-xs text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                    {expandedSection === 'objections' && (
                      <div className="space-y-2">
                        {(config.knowledge_base.objections || []).length === 0 ? (
                          <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl text-center">
                            Add objections and how the AI should respond.
                          </p>
                        ) : (
                          (config.knowledge_base.objections || []).map((item, i) => (
                            <div key={i} className="bg-slate-50 p-3 rounded-xl space-y-2">
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={item.trigger}
                                  onChange={e => updateKBItem('objections', i, 'trigger', e.target.value)}
                                  className="flex-1 p-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-500 outline-none"
                                  placeholder='When customer says... (e.g. "too expensive")'
                                />
                                <button onClick={() => removeKBItem('objections', i)} className="p-2 text-slate-400 hover:text-red-500">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <textarea
                                value={item.response}
                                onChange={e => updateKBItem('objections', i, 'response', e.target.value)}
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm resize-none focus:border-emerald-500 outline-none"
                                rows={2}
                                placeholder="AI should respond with..."
                              />
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                    </div>
                  </div>

                  {/* Tools */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                      Tools Enabled
                    </label>
                    <div className="space-y-1.5">
                      {AVAILABLE_TOOLS.map(tool => (
                        <button
                          key={tool.id}
                          onClick={() => toggleTool(tool.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                            config.tools_enabled.includes(tool.id)
                              ? 'border-emerald-200 bg-emerald-50'
                              : 'border-slate-200 bg-slate-50 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span>{tool.emoji}</span>
                            <div className="text-left">
                              <p className="text-sm font-medium text-slate-900">{tool.label}</p>
                              <p className="text-[11px] text-slate-500">{tool.desc}</p>
                            </div>
                          </div>
                          {config.tools_enabled.includes(tool.id)
                            ? <ToggleRight className="w-5 h-5 text-emerald-600" />
                            : <ToggleLeft className="w-5 h-5 text-slate-400" />
                          }
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ ACTIVITY TAB ═══ */}
              {activeTab === 'activity' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">Conversations, calls &amp; bookings</p>
                    <button
                      onClick={loadActivity}
                      disabled={loadingActivity}
                      className="text-xs text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingActivity ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                  </div>

                  {loadingActivity && activityLog.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full" />
                    </div>
                  ) : activityLog.length === 0 ? (
                    <div className="text-center py-10">
                      <Activity className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">No activity yet.</p>
                      <p className="text-xs text-slate-300 mt-1">WhatsApp chats, calls, and bookings will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {activityLog.map((evt, i) => (
                        <div key={evt.id || i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                            evt.type === 'conversation' ? 'bg-emerald-100'
                              : evt.type === 'call' ? 'bg-blue-100'
                              : evt.type === 'booking' ? 'bg-amber-100'
                              : 'bg-purple-100'
                          }`}>
                            {evt.icon || '⚡'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 leading-snug">{evt.title}</p>
                            {evt.detail && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{evt.detail}</p>}
                          </div>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 mt-1">
                            {formatTimeAgo(evt.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ═══ AUTOMATIONS TAB ═══ */}
              {activeTab === 'triggers' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-xs text-blue-700">
                      <strong>Automations</strong> — Build workflows with delays. Example: Quote Sent → Wait 48h → WhatsApp → Wait 24h → Call.
                    </p>
                  </div>

                  {/* Webhook URL */}
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Globe className="w-3 h-3" /> Webhook URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/assistants/trigger?businessId=${business?.id || ''}`}
                        className="flex-1 p-2 border border-slate-200 rounded-lg text-[11px] font-mono bg-white"
                      />
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/api/assistants/trigger?businessId=${business?.id || ''}`;
                          navigator.clipboard.writeText(url);
                        }}
                        className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      External tools can POST here to trigger automations
                    </p>
                  </div>

                  {/* Rules */}
                  {getRules().map((rule, ruleIdx) => (
                    <div
                      key={rule.id || ruleIdx}
                      className={`border-2 rounded-xl overflow-hidden transition-all ${
                        rule.enabled !== false ? 'border-emerald-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-70'
                      }`}
                    >
                      {/* Rule header */}
                      <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-xs font-bold text-slate-700">Rule {ruleIdx + 1}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateRule(ruleIdx, 'enabled', rule.enabled === false)}
                            className="p-1"
                          >
                            {rule.enabled !== false
                              ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                              : <ToggleLeft className="w-5 h-5 text-slate-400" />
                            }
                          </button>
                          <button onClick={() => removeRule(ruleIdx)} className="p-1 hover:bg-red-50 rounded">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </div>

                      <div className="p-3 space-y-3">
                        {/* WHEN */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">When</label>
                          <select
                            value={rule.event}
                            onChange={e => updateRule(ruleIdx, 'event', e.target.value)}
                            className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                          >
                            {AUTOMATION_EVENTS.map(ev => (
                              <option key={ev.id} value={ev.id}>{ev.icon} {ev.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* IF conditions */}
                        {(rule.conditions || []).length > 0 && (
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">If</label>
                            <div className="space-y-2">
                              {(rule.conditions || []).map((cond, condIdx) => (
                                <div key={condIdx} className="flex gap-1.5 items-center">
                                  <input
                                    type="text"
                                    value={cond.field}
                                    onChange={e => updateConditionInRule(ruleIdx, condIdx, 'field', e.target.value)}
                                    className="w-24 p-2 border border-slate-200 rounded-lg text-xs"
                                    placeholder="field"
                                  />
                                  <select
                                    value={cond.op}
                                    onChange={e => updateConditionInRule(ruleIdx, condIdx, 'op', e.target.value)}
                                    className="p-2 border border-slate-200 rounded-lg text-xs bg-white"
                                  >
                                    <option value="contains">contains</option>
                                    <option value="equals">equals</option>
                                    <option value="gt">&gt;</option>
                                    <option value="lt">&lt;</option>
                                    <option value="exists">exists</option>
                                    <option value="not_exists">not exists</option>
                                  </select>
                                  {!['exists', 'not_exists'].includes(cond.op) && (
                                    <input
                                      type="text"
                                      value={cond.value || ''}
                                      onChange={e => updateConditionInRule(ruleIdx, condIdx, 'value', e.target.value)}
                                      className="flex-1 p-2 border border-slate-200 rounded-lg text-xs"
                                      placeholder="value"
                                    />
                                  )}
                                  <button onClick={() => removeConditionFromRule(ruleIdx, condIdx)} className="p-1 hover:bg-red-50 rounded">
                                    <X className="w-3 h-3 text-red-400" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() => addConditionToRule(ruleIdx)}
                          className="text-[11px] text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add condition
                        </button>

                        {/* THEN actions (sequential workflow) */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Then (runs in order)</label>
                          <div className="space-y-1">
                            {(rule.actions || []).map((action, actIdx) => {
                              const actionDef = AUTOMATION_ACTIONS.find(a => a.id === action.type);
                              const isDelay = action.type === 'delay';
                              return (
                                <div key={actIdx}>
                                  {/* Timeline connector */}
                                  {actIdx > 0 && (
                                    <div className="flex items-center justify-center py-0.5">
                                      <div className="w-px h-3 bg-slate-300" />
                                    </div>
                                  )}
                                  <div className={`rounded-lg p-2.5 space-y-2 ${isDelay ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
                                    <div className="flex items-center gap-1.5">
                                      {isDelay && <span className="text-sm">⏳</span>}
                                      <select
                                        value={action.type}
                                        onChange={e => updateActionInRule(ruleIdx, actIdx, 'type', e.target.value)}
                                        className="flex-1 p-2 border border-slate-200 rounded-lg text-xs bg-white"
                                      >
                                        {AUTOMATION_ACTIONS.map(act => (
                                          <option key={act.id} value={act.id}>{act.icon} {act.label}</option>
                                        ))}
                                      </select>
                                      <button onClick={() => removeActionFromRule(ruleIdx, actIdx)} className="p-1 hover:bg-red-50 rounded">
                                        <X className="w-3 h-3 text-red-400" />
                                      </button>
                                    </div>
                                    {/* Config fields */}
                                    {actionDef?.configFields?.includes('delayHours') && (
                                      <div className="flex items-center gap-2">
                                        <label className="text-[10px] text-amber-600 font-bold whitespace-nowrap">Wait</label>
                                        <input
                                          type="number"
                                          min="0.5"
                                          step="0.5"
                                          value={action.config?.delayHours || 24}
                                          onChange={e => updateActionInRule(ruleIdx, actIdx, 'delayHours', parseFloat(e.target.value) || 1)}
                                          className="w-20 p-2 border border-amber-300 rounded-lg text-xs text-center bg-white"
                                        />
                                        <span className="text-[10px] text-amber-600 font-medium">hours</span>
                                      </div>
                                    )}
                                    {actionDef?.configFields?.includes('message') && (
                                      <textarea
                                        value={action.config?.message || ''}
                                        onChange={e => updateActionInRule(ruleIdx, actIdx, 'message', e.target.value)}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-xs resize-none"
                                        rows={2}
                                        placeholder="Message... use {firstName}, {businessName}, {quoteAmount}"
                                      />
                                    )}
                                    {actionDef?.configFields?.includes('url') && (
                                      <input
                                        type="url"
                                        value={action.config?.url || ''}
                                        onChange={e => updateActionInRule(ruleIdx, actIdx, 'url', e.target.value)}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                        placeholder="https://hooks.zapier.com/..."
                                      />
                                    )}
                                    {actionDef?.configFields?.includes('status') && (
                                      <input
                                        type="text"
                                        value={action.config?.status || ''}
                                        onChange={e => updateActionInRule(ruleIdx, actIdx, 'status', e.target.value)}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                        placeholder="e.g. hot_lead, vip, inactive"
                                      />
                                    )}
                                    {actionDef?.configFields?.includes('templateSid') && (
                                      <div className="space-y-1.5">
                                        <input
                                          type="text"
                                          value={action.config?.templateSid || ''}
                                          onChange={e => updateActionInRule(ruleIdx, actIdx, 'templateSid', e.target.value)}
                                          className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono"
                                          placeholder="HX... (Twilio Content SID)"
                                        />
                                        <input
                                          type="text"
                                          value={action.config?.contentVars || ''}
                                          onChange={e => updateActionInRule(ruleIdx, actIdx, 'contentVars', e.target.value)}
                                          className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                          placeholder='Variables: {businessName}, {firstName} (comma-separated)'
                                        />
                                        <p className="text-[10px] text-slate-400">
                                          Template variables map to {'{{1}}'}, {'{{2}}'}, etc. in order. Supports {'{ }'} placeholders.
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <button
                            onClick={() => addActionToRule(ruleIdx)}
                            className="mt-1.5 text-[11px] text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add step
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add rule button */}
                  <button
                    onClick={addRule}
                    className="w-full p-4 border-2 border-dashed border-slate-200 rounded-xl text-sm font-medium text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4" /> Add Automation Rule
                  </button>

                  {/* Variables hint */}
                  {getRules().length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Available Variables</p>
                      <p className="text-[11px] text-amber-700 font-mono">
                        {'{firstName}'} {'{customerName}'} {'{businessName}'} {'{phone}'} {'{event}'} {'{amount}'} {'{message}'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer: Save Button ───────────────────────────────────────── */}
        <div className="px-5 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={saveAssistant}
            disabled={saving}
            className={`w-full py-3 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 ${
              saveStatus === 'saved'
                ? 'bg-emerald-100 text-emerald-700'
                : saveStatus === 'error'
                ? 'bg-red-100 text-red-700'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            } disabled:opacity-50`}
          >
            {saving ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Saving...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <Check className="w-4 h-4" /> Saved!
              </>
            ) : saveStatus === 'error' ? (
              'Failed to save — try again'
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
