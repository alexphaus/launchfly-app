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
  X, Bot, Brain, BookOpen, Zap, Radio,
  ChevronDown, ChevronUp, Plus, Trash2, Save,
  Phone, MessageCircle, Mail, Clock, Check,
  Pencil, Eye, ToggleLeft, ToggleRight,
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

const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { id: 'retell_voice', label: 'AI Voice Call', icon: '📞' },
  { id: 'sms', label: 'SMS', icon: '📱' },
  { id: 'email', label: 'Email', icon: '✉️' },
];

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

  // ── Load assistant config ──────────────────────────────────────────────
  const loadAssistant = useCallback(async () => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/assistants?businessId=${business.id}`);
      const data = await res.json();

      if (data.assistant) {
        setConfig({
          name: data.assistant.name || 'AI Sales Assistant',
          tone: data.assistant.tone || 'friendly',
          goal: data.assistant.goal || 'book_consultation',
          system_prompt: data.assistant.system_prompt,
          custom_rules: data.assistant.custom_rules || [],
          knowledge_base: data.assistant.knowledge_base || { pricing: [], faq: [], objections: [] },
          tools_enabled: data.assistant.tools_enabled || [],
          sequence_steps: data.assistant.sequence_steps || [],
          trigger_config: data.assistant.trigger_config || {},
        });
        setPromptMode(data.assistant.system_prompt ? 'custom' : 'auto');
      } else if (data.defaults) {
        setConfig(data.defaults);
        setPromptMode('auto');
      }
    } catch (err) {
      console.error('Failed to load assistant:', err);
    } finally {
      setLoading(false);
    }
  }, [business?.id]);

  useEffect(() => {
    if (isOpen) loadAssistant();
  }, [isOpen, loadAssistant]);

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
          ...config,
          system_prompt: promptMode === 'custom' ? config.system_prompt : null,
        }),
      });

      if (res.ok) {
        setSaveStatus('saved');
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

  // ── Sequence step helpers ──────────────────────────────────────────────
  const addSequenceStep = () => {
    const steps = [...config.sequence_steps];
    const lastStep = steps[steps.length - 1];
    const newDay = lastStep ? lastStep.dayOffset + 3 : 0;
    steps.push({
      step: steps.length,
      dayOffset: newDay,
      hour: 10,
      minute: 0,
      channel: 'whatsapp',
      message: '',
      voicemail: '',
    });
    setConfig({ ...config, sequence_steps: steps });
  };

  const updateSequenceStep = (index, field, value) => {
    const steps = [...config.sequence_steps];
    steps[index] = { ...steps[index], [field]: value };
    // Re-index step numbers
    steps.forEach((s, i) => { s.step = i; });
    setConfig({ ...config, sequence_steps: steps });
  };

  const removeSequenceStep = (index) => {
    const steps = config.sequence_steps.filter((_, i) => i !== index);
    steps.forEach((s, i) => { s.step = i; });
    setConfig({ ...config, sequence_steps: steps });
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

  // ── Trigger toggle ─────────────────────────────────────────────────────
  const toggleTrigger = (key) => {
    setConfig({
      ...config,
      trigger_config: { ...config.trigger_config, [key]: !config.trigger_config[key] },
    });
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
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Bot className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-900">{config.name}</h2>
              <p className="text-xs text-slate-500">
                {config.tone.charAt(0).toUpperCase() + config.tone.slice(1)} · {GOALS.find(g => g.id === config.goal)?.label || config.goal}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* ── Tab Bar ───────────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-100 px-2 shrink-0">
          {[
            { id: 'brain', label: 'Brain', Icon: Brain },
            { id: 'knowledge', label: 'Knowledge', Icon: BookOpen },
            { id: 'sequence', label: 'Sequence', Icon: Clock },
            { id: 'triggers', label: 'Triggers', Icon: Radio },
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

              {/* ═══ KNOWLEDGE TAB ═══ */}
              {activeTab === 'knowledge' && (
                <div className="space-y-5">
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
              )}

              {/* ═══ SEQUENCE TAB ═══ */}
              {activeTab === 'sequence' && (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <p className="text-xs text-emerald-700">
                      <strong>Follow-up sequence</strong> — Define the automated messages your AI sends after a quote/lead comes in.
                      Each step fires at the specified day and time in the prospect&apos;s timezone.
                    </p>
                  </div>

                  {/* Timeline */}
                  {config.sequence_steps.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500 mb-3">No follow-up sequence configured yet.</p>
                      <button
                        onClick={addSequenceStep}
                        className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        <Plus className="w-4 h-4 inline mr-1" /> Add First Step
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {config.sequence_steps.map((step, i) => (
                        <div key={i} className="relative">
                          {/* Timeline connector */}
                          {i < config.sequence_steps.length - 1 && (
                            <div className="absolute left-5 top-16 bottom-0 w-px bg-slate-200 -mb-3" />
                          )}

                          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                            {/* Step header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                  step.channel === 'retell_voice' ? 'bg-blue-100 text-blue-600'
                                    : step.channel === 'sms' ? 'bg-purple-100 text-purple-600'
                                    : step.channel === 'email' ? 'bg-amber-100 text-amber-600'
                                    : 'bg-emerald-100 text-emerald-600'
                                }`}>
                                  {CHANNELS.find(c => c.id === step.channel)?.icon || '💬'}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900">
                                    {step.dayOffset === 0 ? 'Immediately' : `Day ${step.dayOffset}`}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    {step.hour === -1 ? 'Within 60s' : `${step.hour}:${String(step.minute).padStart(2,'0')} local time`}
                                  </p>
                                </div>
                              </div>
                              <button onClick={() => removeSequenceStep(i)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Step fields */}
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="text-[10px] text-slate-400 font-medium">Day</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={step.dayOffset}
                                    onChange={e => updateSequenceStep(i, 'dayOffset', parseInt(e.target.value) || 0)}
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-500 outline-none"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[10px] text-slate-400 font-medium">Hour</label>
                                  <input
                                    type="number"
                                    min="-1"
                                    max="23"
                                    value={step.hour}
                                    onChange={e => updateSequenceStep(i, 'hour', parseInt(e.target.value))}
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-500 outline-none"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[10px] text-slate-400 font-medium">Channel</label>
                                  <select
                                    value={step.channel}
                                    onChange={e => updateSequenceStep(i, 'channel', e.target.value)}
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-500 outline-none bg-white"
                                  >
                                    {CHANNELS.map(ch => (
                                      <option key={ch.id} value={ch.id}>{ch.icon} {ch.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 font-medium">Message</label>
                                <textarea
                                  value={step.message}
                                  onChange={e => updateSequenceStep(i, 'message', e.target.value)}
                                  className="w-full p-2 border border-slate-200 rounded-lg text-sm resize-none focus:border-emerald-500 outline-none"
                                  rows={3}
                                  placeholder="Hey {firstName}, just following up on the estimate..."
                                />
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  Variables: {'{firstName}'} {'{ownerName}'} {'{businessName}'} {'{jobType}'} {'{quoteAmount}'}
                                </p>
                              </div>
                              {step.channel === 'retell_voice' && (
                                <div>
                                  <label className="text-[10px] text-slate-400 font-medium">Voicemail Script</label>
                                  <textarea
                                    value={step.voicemail || ''}
                                    onChange={e => updateSequenceStep(i, 'voicemail', e.target.value)}
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm resize-none focus:border-emerald-500 outline-none"
                                    rows={2}
                                    placeholder="Hey {firstName}, this is a follow-up from..."
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Add step button */}
                      <button
                        onClick={addSequenceStep}
                        className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm font-medium text-slate-500 hover:border-emerald-500 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Add Step
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ═══ TRIGGERS TAB ═══ */}
              {activeTab === 'triggers' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-xs text-blue-700">
                      <strong>Triggers</strong> — How your AI assistant gets activated.
                      Enable the channels that make sense for your business.
                    </p>
                  </div>

                  {[
                    { key: 'whatsapp_webhook', icon: '💬', label: 'WhatsApp Inbound', desc: 'Respond when customers message your WhatsApp number' },
                    { key: 'missed_call', icon: '📞', label: 'Missed Call Auto-Text', desc: 'Send a template when you miss a call' },
                    { key: 'bcc_email', icon: '✉️', label: 'BCC Email Quotes', desc: 'Auto-follow-up when you BCC a quote email' },
                    { key: 'csv_campaign', icon: '📤', label: 'CSV Campaign Upload', desc: 'Upload a contact list to trigger outbound calls/messages' },
                    { key: 'zapier_webhook', icon: '⚡', label: 'Zapier / Make Webhook', desc: 'Trigger from external tools via webhook URL' },
                  ].map(trigger => (
                    <button
                      key={trigger.key}
                      onClick={() => toggleTrigger(trigger.key)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                        config.trigger_config[trigger.key]
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{trigger.icon}</span>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-slate-900">{trigger.label}</p>
                          <p className="text-[11px] text-slate-500">{trigger.desc}</p>
                        </div>
                      </div>
                      {config.trigger_config[trigger.key]
                        ? <ToggleRight className="w-6 h-6 text-emerald-600 shrink-0" />
                        : <ToggleLeft className="w-6 h-6 text-slate-400 shrink-0" />
                      }
                    </button>
                  ))}

                  {/* Webhook URL (if zapier enabled) */}
                  {config.trigger_config.zapier_webhook && (
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                        Webhook URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/quotes/new`}
                          className="flex-1 p-2 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                        />
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/api/quotes/new`;
                            navigator.clipboard.writeText(url);
                          }}
                          className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        POST with JSON: {`{ "name", "phone", "quote_amount", "job_type", "business_id": "${business?.id || 'xxx'}" }`}
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
