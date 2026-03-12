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
  Download, Upload, CopyPlus, AlertTriangle,
  ArrowLeft, Phone, MessageCircle,
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
  { id: 'call_completed', label: 'Voice Call Completed', icon: '📱' },
  { id: 'new_lead_created', label: 'New Lead Created', icon: '🆕' },
  { id: 'user_inactive', label: 'Customer Went Silent', icon: '😶' },
  { id: 'prospect_found', label: 'Prospect Found', icon: '🎯' },
  { id: 'daily_schedule', label: 'Daily Schedule', icon: '⏰' },
];

const AUTOMATION_ACTIONS = [
  { id: 'ai_response', label: 'AI Response', icon: '🤖', configFields: [] },
  { id: 'send_whatsapp', label: 'Send WhatsApp', icon: '💬', configFields: ['message'] },
  { id: 'condition_branch', label: 'If / Else Branch', icon: '🔀', configFields: [] },
  { id: 'delay', label: 'Wait / Delay', icon: '⏳', configFields: ['delayHours'] },
  { id: 'trigger_voice_call', label: 'AI Voice Call', icon: '📞', configFields: ['fromNumber', 'retellAgentId', 'jobType'] },
  { id: 'notify_owner', label: 'Notify Owner', icon: '🔔', configFields: ['message'] },
  { id: 'call_webhook', label: 'Call Webhook URL', icon: '🌐', configFields: ['url', 'webhookHeaders'] },
  { id: 'update_status', label: 'Update Customer Status', icon: '🏷️', configFields: ['status'] },
  { id: 'send_template', label: 'Send Template', icon: '📝', configFields: ['templateSid', 'contentVars'] },
  { id: 'send_email', label: 'Send Email', icon: '📧', configFields: ['emailSubject', 'emailBody'] },
  { id: 'send_sms', label: 'Send SMS', icon: '📱', configFields: ['message'] },
  { id: 'add_tag', label: 'Add Tag', icon: '🏷️', configFields: ['tag'] },
  { id: 'remove_tag', label: 'Remove Tag', icon: '🗑️', configFields: ['tag'] },
  { id: 'ai_followup', label: 'AI Smart Follow-up', icon: '🧠', configFields: [] },
  { id: 'ask_ai', label: 'Ask AI', icon: '🧩', configFields: ['aiPrompt', 'stopOnNo'] },
  { id: 'search_leads', label: 'Search Leads (Apify)', icon: '🔍', configFields: ['searchQuery', 'searchLocation', 'searchMaxResults'] },
  { id: 'stagger_outreach', label: 'Stagger Outreach', icon: '⏱️', configFields: ['staggerIntervalMin', 'staggerMaxPerDay'] },
];

// ─── Default Actions per Event ───────────────────────────────────────────

const DEFAULT_ACTIONS_BY_EVENT = {
  missed_call: [
    { type: 'send_template', config: { templateSid: '', contentVars: '{businessName}' } },
    { type: 'notify_owner', config: { message: '📞 Missed call from {phone} — auto-reply sent ✅' } },
  ],
  inbound_whatsapp: [
    { type: 'ai_response', config: {} },
  ],
  booking_created: [
    { type: 'notify_owner', config: { message: '📅 New booking from {customerName} ({phone})' } },
    { type: 'update_status', config: { status: 'booked' } },
  ],
  booking_cancelled: [
    { type: 'send_whatsapp', config: { message: 'Hey {firstName}, sorry to see you cancel. If you change your mind, just reply here and we\'ll get you rebooked! 🙏' } },
    { type: 'notify_owner', config: { message: '❌ Booking cancelled by {customerName} ({phone})' } },
  ],
  payment_received: [
    { type: 'send_whatsapp', config: { message: 'Thanks {firstName}! 🎉 Payment of ${amount} received. We\'ll be in touch with next steps!' } },
    { type: 'notify_owner', config: { message: '💰 Payment ${amount} from {customerName}' } },
  ],
  quote_sent: [
    { type: 'delay', config: { delayHours: 48 } },
    { type: 'send_whatsapp', config: { message: 'Hey {firstName}, just following up on the estimate from {businessName}. Any questions? Happy to help! 👍' } },
    { type: 'delay', config: { delayHours: 24 } },
    { type: 'send_whatsapp', config: { message: 'Hi {firstName}, wanted to check in one more time. Ready to get started? 🚀' } },
    { type: 'delay', config: { delayHours: 24 } },
    { type: 'trigger_voice_call', config: {} },
  ],
  sequence_completed: [
    { type: 'update_status', config: { status: 'sequence_done' } },
    { type: 'notify_owner', config: { message: '✅ Sequence completed for {customerName} — no reply. Manual follow-up needed?' } },
  ],
  customer_replied: [
    { type: 'notify_owner', config: { message: '↩️ {customerName} replied during sequence: {message}' } },
  ],
  external_webhook: [
    { type: 'notify_owner', config: { message: '⚡ External event: {event} from {customerName}' } },
  ],
  call_completed: [
    { type: 'send_whatsapp', config: { message: 'Hey {customerName} 👋 Just tried to call. I have something quick to show you — reply START when you\'re ready!' } },
  ],
  new_lead_created: [
    { type: 'add_tag', config: { tag: 'new_lead' } },
    { type: 'notify_owner', config: { message: '🆕 New lead: {customerName} ({phone})' } },
  ],
  user_inactive: [
    { type: 'ai_followup', config: {} },
    { type: 'delay', config: { delayHours: 48 } },
    { type: 'ai_followup', config: {} },
    { type: 'delay', config: { delayHours: 72 } },
    { type: 'ai_followup', config: {} },
  ],
  prospect_found: [
    { type: 'stagger_outreach', config: { staggerIntervalMin: 15, staggerMaxPerDay: 15 } },
    { type: 'ask_ai', config: { aiPrompt: 'Business: {customerName}\nCategory: {metadata.category}\nRating: {metadata.rating} ({metadata.reviews} reviews)\nLocation: {metadata.city}\n\nShould we reach out to this business?', stopOnNo: true } },
    { type: 'trigger_voice_call', config: { jobType: 'Prospecting Call' } },
  ],
  daily_schedule: [
    { type: 'search_leads', config: { searchQuery: 'contractors near me', searchLocation: 'Miami, FL', searchMaxResults: 50 } },
  ],
};

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importing, setImporting] = useState(false);

  // Activity detail state
  const [expandedActivity, setExpandedActivity] = useState(null);   // the clicked event
  const [activityDetail, setActivityDetail] = useState(null);       // { messages } or { transcript, summary, ... }
  const [loadingDetail, setLoadingDetail] = useState(false);

  // WhatsApp API config (per-business, stored in businesses.whatsapp_api_config)
  const [waConfig, setWaConfig] = useState({ instanceId: '', token: '' });
  const [waSaving, setWaSaving] = useState(false);
  const [waStatus, setWaStatus] = useState(null); // 'saved' | 'error'

  useEffect(() => {
    if (business?.whatsapp_api_config) {
      setWaConfig({
        instanceId: business.whatsapp_api_config.instanceId || '',
        token: business.whatsapp_api_config.token || '',
      });
    }
  }, [business?.whatsapp_api_config]);

  const saveWhatsAppConfig = async () => {
    if (!business?.id) return;
    setWaSaving(true);
    setWaStatus(null);
    try {
      const res = await fetch('/api/businesses/whatsapp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          instanceId: waConfig.instanceId,
          token: waConfig.token,
        }),
      });
      if (res.ok) {
        setWaStatus('saved');
        setTimeout(() => setWaStatus(null), 2000);
      } else {
        setWaStatus('error');
      }
    } catch {
      setWaStatus('error');
    } finally {
      setWaSaving(false);
    }
  };

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

  // ── Export current assistant ────────────────────────────────────────
  const exportAssistant = () => {
    const exportData = {
      _type: 'launchfly_assistant_export',
      _version: 1,
      _exportedAt: new Date().toISOString(),
      name: config.name,
      tone: config.tone,
      goal: config.goal,
      system_prompt: config.system_prompt,
      custom_rules: config.custom_rules,
      knowledge_base: config.knowledge_base,
      tools_enabled: config.tools_enabled,
      sequence_steps: config.sequence_steps,
      trigger_config: config.trigger_config,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_assistant.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Import assistant from file ─────────────────────────────────────────
  const importAssistant = async (file) => {
    if (!business?.id || importing) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data._type !== 'launchfly_assistant_export') {
        alert('Invalid file — not a Launchfly assistant export.');
        return;
      }
      // Create new assistant with imported data
      const res = await fetch('/api/assistants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, createNew: true, newName: data.name || 'Imported Assistant' }),
      });
      const result = await res.json();
      if (!res.ok || !result.assistant) {
        alert('Failed to create assistant for import.');
        return;
      }
      // Update with full config
      const updateRes = await fetch('/api/assistants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          assistantId: result.assistant.id,
          name: data.name || 'Imported Assistant',
          tone: data.tone || 'friendly',
          goal: data.goal || 'book_consultation',
          system_prompt: data.system_prompt ?? null,
          custom_rules: data.custom_rules || [],
          knowledge_base: data.knowledge_base || { pricing: [], faq: [], objections: [] },
          tools_enabled: data.tools_enabled || [],
          sequence_steps: data.sequence_steps || [],
          trigger_config: data.trigger_config || {},
        }),
      });
      const updated = await updateRes.json();
      if (updateRes.ok && updated.assistant) {
        applyAssistantData(updated.assistant);
        loadAssistantList();
      }
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import failed — invalid JSON file.');
    } finally {
      setImporting(false);
    }
  };

  // ── Duplicate current assistant ────────────────────────────────────────
  const duplicateAssistant = async () => {
    if (!business?.id || switching) return;
    setSwitching(true);
    setShowSwitcher(false);
    setLoading(true);
    try {
      // Create new assistant
      const res = await fetch('/api/assistants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, createNew: true, newName: config.name + ' (Copy)' }),
      });
      const result = await res.json();
      if (!res.ok || !result.assistant) return;
      // Copy full config
      const updateRes = await fetch('/api/assistants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          assistantId: result.assistant.id,
          name: config.name + ' (Copy)',
          tone: config.tone,
          goal: config.goal,
          system_prompt: config.system_prompt,
          custom_rules: config.custom_rules,
          knowledge_base: config.knowledge_base,
          tools_enabled: config.tools_enabled,
          sequence_steps: config.sequence_steps,
          trigger_config: config.trigger_config,
        }),
      });
      const updated = await updateRes.json();
      if (updateRes.ok && updated.assistant) {
        applyAssistantData(updated.assistant);
        loadAssistantList();
        loadActivity();
      }
    } catch (err) {
      console.error('Duplicate failed:', err);
    } finally {
      setSwitching(false);
      setLoading(false);
    }
  };

  // ── Delete current assistant ───────────────────────────────────────────
  const deleteAssistant = async () => {
    if (!business?.id || !currentAssistantId || switching) return;
    setSwitching(true);
    setConfirmDelete(false);
    setShowSwitcher(false);
    setLoading(true);
    try {
      const res = await fetch('/api/assistants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, assistantId: currentAssistantId }),
      });
      const result = await res.json();
      if (res.ok && result.ok) {
        // Reload — will pick up new active or show defaults
        await loadAssistant();
        await loadAssistantList();
        loadActivity();
      }
    } catch (err) {
      console.error('Delete failed:', err);
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

  // ── Load activity detail (chat or call) ────────────────────────────────
  const openActivityDetail = async (evt) => {
    setExpandedActivity(evt);
    setActivityDetail(null);
    setLoadingDetail(true);
    try {
      if (evt.type === 'conversation') {
        const res = await fetch(
          `/api/assistants/activity/chat?businessId=${business.id}&phone=${encodeURIComponent(evt.phone)}`,
          { cache: 'no-store' },
        );
        const data = await res.json();
        setActivityDetail({ type: 'chat', messages: data.messages || [] });
      } else if (evt.type === 'call' && evt.retellCallId) {
        const res = await fetch(
          `/api/assistants/activity/call?callId=${encodeURIComponent(evt.retellCallId)}`,
          { cache: 'no-store' },
        );
        const data = await res.json();
        setActivityDetail({
          type: 'call',
          transcript: data.transcript || [],
          summary: data.summary,
          sentiment: data.sentiment,
          duration: data.duration,
        });
      } else if (evt.type === 'call') {
        setActivityDetail({ type: 'call', transcript: [], summary: 'No Retell call ID available for this call.' });
      }
    } catch (err) {
      console.error('Failed to load activity detail:', err);
      setActivityDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeActivityDetail = () => {
    setExpandedActivity(null);
    setActivityDetail(null);
  };

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
    setConfig(prev => {
      const kb = { ...prev.knowledge_base };
      if (section === 'pricing') {
        kb.pricing = [...(kb.pricing || []), { service: '', price: '', unit: 'job' }];
      } else if (section === 'faq') {
        kb.faq = [...(kb.faq || []), { q: '', a: '' }];
      } else if (section === 'objections') {
        kb.objections = [...(kb.objections || []), { trigger: '', response: '' }];
      }
      return { ...prev, knowledge_base: kb };
    });
  };

  const updateKBItem = (section, index, field, value) => {
    setConfig(prev => {
      const kb = { ...prev.knowledge_base };
      kb[section] = [...kb[section]];
      kb[section][index] = { ...kb[section][index], [field]: value };
      return { ...prev, knowledge_base: kb };
    });
  };

  const removeKBItem = (section, index) => {
    setConfig(prev => {
      const kb = { ...prev.knowledge_base };
      kb[section] = kb[section].filter((_, i) => i !== index);
      return { ...prev, knowledge_base: kb };
    });
  };

  // ── Tool toggle ────────────────────────────────────────────────────────
  const toggleTool = (toolId) => {
    setConfig(prev => {
      const tools = prev.tools_enabled.includes(toolId)
        ? prev.tools_enabled.filter(t => t !== toolId)
        : [...prev.tools_enabled, toolId];
      return { ...prev, tools_enabled: tools };
    });
  };

  // ── Automation rule helpers ─────────────────────────────────────────────
  const getRulesFrom = (cfg) => cfg.trigger_config?.rules || [];
  const getRules = () => config.trigger_config?.rules || [];

  const setRules = (updater) => {
    setConfig(prev => {
      const prevRules = getRulesFrom(prev);
      const rules = typeof updater === 'function' ? updater(prevRules) : updater;
      return { ...prev, trigger_config: { ...prev.trigger_config, rules } };
    });
  };

  const addRule = () => {
    const defaultEvent = 'missed_call';
    const defaultActions = (DEFAULT_ACTIONS_BY_EVENT[defaultEvent] || []).map(a => ({ ...a, config: { ...a.config } }));
    setRules(prev => [...prev, {
      id: `rule_${Date.now()}`,
      event: defaultEvent,
      conditions: [],
      actions: defaultActions,
      enabled: true,
    }]);
  };

  const updateRule = (index, field, value) => {
    setRules(prev => {
      const rules = [...prev];
      rules[index] = { ...rules[index], [field]: value };
      return rules;
    });
  };

  const removeRule = (index) => {
    setRules(prev => prev.filter((_, i) => i !== index));
  };

  const addActionToRule = (ruleIndex) => {
    setRules(prev => {
      const rules = [...prev];
      rules[ruleIndex] = {
        ...rules[ruleIndex],
        actions: [...rules[ruleIndex].actions, { type: 'send_whatsapp', config: { message: '' } }],
      };
      return rules;
    });
  };

  const updateActionInRule = (ruleIndex, actionIndex, field, value) => {
    setRules(prev => {
      const rules = [...prev];
      const actions = [...rules[ruleIndex].actions];
      if (field === 'type') {
        if (value === 'condition_branch') {
          actions[actionIndex] = {
            type: value,
            config: {
              conditions: [{ field: 'outcome', op: 'equals', value: 'interested' }],
              thenActions: [{ type: 'send_whatsapp', config: { message: 'Nice! Let\'s move forward.' } }],
              elseActions: [{ type: 'send_whatsapp', config: { message: 'No worries — I can follow up later.' } }],
            },
          };
        } else {
          actions[actionIndex] = { type: value, config: {} };
        }
      } else {
        actions[actionIndex] = { ...actions[actionIndex], config: { ...actions[actionIndex].config, [field]: value } };
      }
      rules[ruleIndex] = { ...rules[ruleIndex], actions };
      return rules;
    });
  };

  const removeActionFromRule = (ruleIndex, actionIndex) => {
    setRules(prev => {
      const rules = [...prev];
      rules[ruleIndex] = {
        ...rules[ruleIndex],
        actions: rules[ruleIndex].actions.filter((_, i) => i !== actionIndex),
      };
      return rules;
    });
  };

  const addConditionToBranchAction = (ruleIndex, actionIndex) => {
    setRules(prev => {
      const rules = [...prev];
      const actions = [...rules[ruleIndex].actions];
      const action = actions[actionIndex];
      const cfg = action.config || {};
      const conditions = Array.isArray(cfg.conditions) ? cfg.conditions : [];
      actions[actionIndex] = {
        ...action,
        config: {
          ...cfg,
          conditions: [...conditions, { field: 'message', op: 'contains', value: '' }],
        },
      };
      rules[ruleIndex] = { ...rules[ruleIndex], actions };
      return rules;
    });
  };

  const updateConditionInBranchAction = (ruleIndex, actionIndex, condIndex, field, value) => {
    setRules(prev => {
      const rules = [...prev];
      const actions = [...rules[ruleIndex].actions];
      const action = actions[actionIndex];
      const cfg = action.config || {};
      const conditions = Array.isArray(cfg.conditions) ? [...cfg.conditions] : [];
      conditions[condIndex] = { ...conditions[condIndex], [field]: value };
      actions[actionIndex] = { ...action, config: { ...cfg, conditions } };
      rules[ruleIndex] = { ...rules[ruleIndex], actions };
      return rules;
    });
  };

  const removeConditionFromBranchAction = (ruleIndex, actionIndex, condIndex) => {
    setRules(prev => {
      const rules = [...prev];
      const actions = [...rules[ruleIndex].actions];
      const action = actions[actionIndex];
      const cfg = action.config || {};
      const conditions = Array.isArray(cfg.conditions) ? cfg.conditions.filter((_, i) => i !== condIndex) : [];
      actions[actionIndex] = { ...action, config: { ...cfg, conditions } };
      rules[ruleIndex] = { ...rules[ruleIndex], actions };
      return rules;
    });
  };

  const addBranchStep = (ruleIndex, actionIndex, branchKey) => {
    setRules(prev => {
      const rules = [...prev];
      const actions = [...rules[ruleIndex].actions];
      const action = actions[actionIndex];
      const cfg = action.config || {};
      const branchSteps = Array.isArray(cfg[branchKey]) ? cfg[branchKey] : [];
      actions[actionIndex] = {
        ...action,
        config: {
          ...cfg,
          [branchKey]: [...branchSteps, { type: 'send_whatsapp', config: { message: '' } }],
        },
      };
      rules[ruleIndex] = { ...rules[ruleIndex], actions };
      return rules;
    });
  };

  const updateBranchStep = (ruleIndex, actionIndex, branchKey, stepIndex, field, value) => {
    setRules(prev => {
      const rules = [...prev];
      const actions = [...rules[ruleIndex].actions];
      const action = actions[actionIndex];
      const cfg = action.config || {};
      const branchSteps = Array.isArray(cfg[branchKey]) ? [...cfg[branchKey]] : [];

      if (field === 'type') {
        branchSteps[stepIndex] = { type: value, config: {} };
      } else {
        const current = branchSteps[stepIndex] || { type: 'send_whatsapp', config: {} };
        branchSteps[stepIndex] = { ...current, config: { ...current.config, [field]: value } };
      }

      actions[actionIndex] = { ...action, config: { ...cfg, [branchKey]: branchSteps } };
      rules[ruleIndex] = { ...rules[ruleIndex], actions };
      return rules;
    });
  };

  const removeBranchStep = (ruleIndex, actionIndex, branchKey, stepIndex) => {
    setRules(prev => {
      const rules = [...prev];
      const actions = [...rules[ruleIndex].actions];
      const action = actions[actionIndex];
      const cfg = action.config || {};
      const branchSteps = Array.isArray(cfg[branchKey]) ? cfg[branchKey].filter((_, i) => i !== stepIndex) : [];
      actions[actionIndex] = { ...action, config: { ...cfg, [branchKey]: branchSteps } };
      rules[ruleIndex] = { ...rules[ruleIndex], actions };
      return rules;
    });
  };

  const addConditionToRule = (ruleIndex) => {
    setRules(prev => {
      const rules = [...prev];
      rules[ruleIndex] = {
        ...rules[ruleIndex],
        conditions: [...(rules[ruleIndex].conditions || []), { field: 'message', op: 'contains', value: '' }],
      };
      return rules;
    });
  };

  const updateConditionInRule = (ruleIndex, condIndex, field, value) => {
    setRules(prev => {
      const rules = [...prev];
      const conditions = [...(rules[ruleIndex].conditions || [])];
      conditions[condIndex] = { ...conditions[condIndex], [field]: value };
      rules[ruleIndex] = { ...rules[ruleIndex], conditions };
      return rules;
    });
  };

  const removeConditionFromRule = (ruleIndex, condIndex) => {
    setRules(prev => {
      const rules = [...prev];
      rules[ruleIndex] = {
        ...rules[ruleIndex],
        conditions: (rules[ruleIndex].conditions || []).filter((_, i) => i !== condIndex),
      };
      return rules;
    });
  };

  // ── Custom rule helpers ────────────────────────────────────────────────
  const addCustomRule = () => {
    setConfig(prev => ({ ...prev, custom_rules: [...prev.custom_rules, ''] }));
  };

  const updateCustomRule = (index, value) => {
    setConfig(prev => {
      const rules = [...prev.custom_rules];
      rules[index] = value;
      return { ...prev, custom_rules: rules };
    });
  };

  const removeCustomRule = (index) => {
    setConfig(prev => ({ ...prev, custom_rules: prev.custom_rules.filter((_, i) => i !== index) }));
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

                  {/* ── Manage actions ── */}
                  <div className="border-t border-slate-100 px-2 py-2 grid grid-cols-2 gap-1">
                    <button
                      onClick={() => { setShowSwitcher(false); exportAssistant(); }}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Export
                    </button>
                    <label
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" /> Import
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) { setShowSwitcher(false); importAssistant(file); }
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button
                      onClick={() => { setShowSwitcher(false); duplicateAssistant(); }}
                      disabled={!currentAssistantId || switching}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
                    >
                      <CopyPlus className="w-3.5 h-3.5" /> Duplicate
                    </button>
                    <button
                      onClick={() => { setShowSwitcher(false); setConfirmDelete(true); }}
                      disabled={!currentAssistantId || switching}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* ── Delete Confirmation ────────────────────────────────────── */}
        {confirmDelete && (
          <div className="mx-5 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">
                Delete <strong>{config.name}</strong>? This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 ml-6">
              <button
                onClick={deleteAssistant}
                className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 bg-white text-slate-600 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Tab Bar ───────────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-100 px-2 shrink-0">
          {[
            { id: 'brain', label: 'Brain', Icon: Brain },
            { id: 'triggers', label: 'Automations', Icon: Zap },
            { id: 'activity', label: 'Activity', Icon: Activity },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); closeActivityDetail(); }}
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
                      onChange={e => { const v = e.target.value; setConfig(prev => ({ ...prev, name: v })); }}
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
                          onClick={() => setConfig(prev => ({ ...prev, tone: t.id }))}
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
                          onClick={() => setConfig(prev => ({ ...prev, goal: g.id }))}
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

                      </div>
                    ) : (
                      <textarea
                        value={config.system_prompt || ''}
                        onChange={e => { const v = e.target.value; setConfig(prev => ({ ...prev, system_prompt: v })); }}
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
                        {(config.knowledge_base.pricing || []).length === 0 ? null : (
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
                        {(config.knowledge_base.faq || []).length === 0 ? null : (
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
                        {(config.knowledge_base.objections || []).length === 0 ? null : (
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

                  {/* ── WhatsApp Connection (UltraMsg) ── */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                      WhatsApp Connection
                    </label>
                    <div className="bg-slate-50 p-3 rounded-xl space-y-2">
                      {waConfig.instanceId && waConfig.token ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs text-emerald-700 font-medium">Connected</span>
                          <span className="text-[10px] text-slate-400">({waConfig.instanceId})</span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Not connected — enter your UltraMsg credentials below.</p>
                      )}
                      
                      {/* Anti-Ban Warning */}
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-2 flex gap-2 items-start">
                        <span className="text-amber-500 mt-0.5">⚠️</span>
                        <p className="text-[10px] text-amber-700 leading-relaxed">
                          <strong className="font-bold">Avoid Meta Bans:</strong> If using a brand-new SIM card, text manually with real humans for 3-5 days before turning on automated sequences. For first outreach messages, always ask a short &quot;ping&quot; question to get a reply before pitching.
                        </p>
                      </div>

                      <details className="text-xs">
                        <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600 select-none mt-2">
                          {waConfig.instanceId ? 'Edit credentials' : 'Setup WhatsApp API'}
                        </summary>
                        <div className="space-y-2 mt-2">
                          <input
                            type="text"
                            value={waConfig.instanceId}
                            onChange={e => setWaConfig(prev => ({ ...prev, instanceId: e.target.value }))}
                            className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono"
                            placeholder="Instance ID (e.g. instance164947)"
                          />
                          <input
                            type="text"
                            value={waConfig.token}
                            onChange={e => setWaConfig(prev => ({ ...prev, token: e.target.value }))}
                            className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono"
                            placeholder="Token"
                          />
                          {business?.id && (
                            <div className="bg-white p-2 border border-slate-200 rounded-lg">
                              <p className="text-[10px] text-slate-400 mb-1">Webhook URL (paste in UltraMsg dashboard):</p>
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  readOnly
                                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/ultramsg?businessId=${business.id}`}
                                  className="flex-1 p-1.5 border border-slate-200 rounded text-[10px] font-mono bg-slate-50"
                                />
                                <button
                                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/webhook/ultramsg?businessId=${business.id}`)}
                                  className="px-2 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded hover:bg-slate-800 transition-colors"
                                >
                                  Copy
                                </button>
                              </div>
                            </div>
                          )}
                          <button
                            onClick={saveWhatsAppConfig}
                            disabled={waSaving || !waConfig.instanceId || !waConfig.token}
                            className="w-full py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                          >
                            {waSaving ? 'Saving...' : waStatus === 'saved' ? '✓ Saved' : 'Save WhatsApp Config'}
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ ACTIVITY TAB ═══ */}
              {activeTab === 'activity' && (
                <div className="space-y-3">
                  {/* ── Detail View (chat or call transcript) ── */}
                  {expandedActivity ? (
                    <>
                      <button
                        onClick={closeActivityDetail}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Activity
                      </button>

                      {/* Header */}
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 ${
                          expandedActivity.type === 'conversation' ? 'bg-emerald-100' : 'bg-blue-100'
                        }`}>
                          {expandedActivity.type === 'conversation'
                            ? <MessageCircle className="w-4 h-4 text-emerald-600" />
                            : <Phone className="w-4 h-4 text-blue-600" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800">{expandedActivity.title}</p>
                          <p className="text-[11px] text-slate-400">{expandedActivity.detail} · {formatTimeAgo(expandedActivity.created_at)}</p>
                        </div>
                      </div>

                      {/* Loading */}
                      {loadingDetail && (
                        <div className="flex items-center justify-center py-10">
                          <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full" />
                        </div>
                      )}

                      {/* Chat messages */}
                      {activityDetail?.type === 'chat' && (
                        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                          {activityDetail.messages.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6">No messages found.</p>
                          ) : activityDetail.messages.map((msg, i) => (
                            <div key={msg.id || i} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                              <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed ${
                                msg.role === 'assistant'
                                  ? 'bg-emerald-50 text-slate-800 rounded-tl-md'
                                  : 'bg-blue-500 text-white rounded-tr-md'
                              }`}>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                <p className={`text-[9px] mt-1 ${msg.role === 'assistant' ? 'text-slate-400' : 'text-blue-200'}`}>
                                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Call transcript */}
                      {activityDetail?.type === 'call' && (
                        <div className="space-y-3">
                          {/* Call meta */}
                          {(activityDetail.summary || activityDetail.duration != null) && (
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-1.5">
                              {activityDetail.duration != null && (
                                <p className="text-xs text-blue-700">
                                  <strong>Duration:</strong> {Math.floor(activityDetail.duration / 60)}m {activityDetail.duration % 60}s
                                  {activityDetail.sentiment && <> · <strong>Sentiment:</strong> {activityDetail.sentiment}</>}
                                </p>
                              )}
                              {activityDetail.summary && (
                                <p className="text-xs text-blue-600">{activityDetail.summary}</p>
                              )}
                            </div>
                          )}

                          {/* Transcript bubbles */}
                          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                            {activityDetail.transcript.length === 0 ? (
                              <p className="text-xs text-slate-400 text-center py-6">
                                {activityDetail.summary || 'No transcript available for this call.'}
                              </p>
                            ) : activityDetail.transcript.map((u, i) => (
                              <div key={i} className={`flex ${u.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed ${
                                  u.role === 'assistant'
                                    ? 'bg-emerald-50 text-slate-800 rounded-tl-md'
                                    : 'bg-blue-500 text-white rounded-tr-md'
                                }`}>
                                  <p className="whitespace-pre-wrap">{u.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* ── Activity list ── */
                    <>
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
                          {activityLog.map((evt, i) => {
                            const isClickable = evt.type === 'conversation' || evt.type === 'call';
                            return (
                              <div
                                key={evt.id || i}
                                onClick={isClickable ? () => openActivityDetail(evt) : undefined}
                                className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                                  isClickable ? 'hover:bg-slate-50 cursor-pointer active:bg-slate-100' : 'hover:bg-slate-50'
                                }`}
                              >
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
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ═══ AUTOMATIONS TAB ═══ */}
              {activeTab === 'triggers' && (
                <div className="space-y-4">
                  {/* Webhook URL — collapsed by default */}
                  <details className="bg-slate-50 rounded-xl">
                    <summary className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 flex items-center gap-1.5 select-none">
                      <Globe className="w-3 h-3" /> Webhook URL
                    </summary>
                    <div className="px-3 pb-3">
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
                    </div>
                  </details>

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
                            onChange={e => {
                              const newEvent = e.target.value;
                              const preset = DEFAULT_ACTIONS_BY_EVENT[newEvent];
                              const rules = [...getRules()];
                              rules[ruleIdx] = {
                                ...rules[ruleIdx],
                                event: newEvent,
                                actions: preset ? preset.map(a => ({ ...a, config: { ...a.config } })) : rules[ruleIdx].actions,
                              };
                              setRules(rules);
                            }}
                            className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                          >
                            {AUTOMATION_EVENTS.map(ev => (
                              <option key={ev.id} value={ev.id}>{ev.icon} {ev.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Schedule config for daily_schedule */}
                        {rule.event === 'daily_schedule' && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                            <label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Schedule</label>
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] text-amber-700 font-medium whitespace-nowrap">Run at</label>
                              <input
                                type="time"
                                value={`${String(rule.scheduleConfig?.hour ?? 9).padStart(2, '0')}:${String(rule.scheduleConfig?.minute ?? 0).padStart(2, '0')}`}
                                onChange={e => {
                                  const [h, m] = e.target.value.split(':').map(Number);
                                  const rules = [...getRules()];
                                  rules[ruleIdx] = { ...rules[ruleIdx], scheduleConfig: { ...rules[ruleIdx].scheduleConfig, hour: h, minute: m } };
                                  setRules(rules);
                                }}
                                className="p-1.5 border border-amber-300 rounded-lg text-xs bg-white"
                              />
                              <select
                                value={rule.scheduleConfig?.timezone || 'America/New_York'}
                                onChange={e => {
                                  const rules = [...getRules()];
                                  rules[ruleIdx] = { ...rules[ruleIdx], scheduleConfig: { ...rules[ruleIdx].scheduleConfig, timezone: e.target.value } };
                                  setRules(rules);
                                }}
                                className="p-1.5 border border-amber-300 rounded-lg text-xs bg-white"
                              >
                                <option value="Pacific/Honolulu">Hawaii (-10)</option>
                                <option value="America/Los_Angeles">US Pacific (-8)</option>
                                <option value="America/Denver">US Mountain (-7)</option>
                                <option value="America/Chicago">US Central (-6)</option>
                                <option value="America/New_York">US Eastern (-5)</option>
                                <option value="America/Sao_Paulo">Brazil (-3)</option>
                                <option value="Europe/London">London (GMT)</option>
                                <option value="Europe/Madrid">Europe Central (+1)</option>
                                <option value="Europe/Istanbul">Turkey (+3)</option>
                                <option value="Asia/Dubai">Dubai / Gulf (+4)</option>
                                <option value="Asia/Kolkata">India (+5:30)</option>
                                <option value="Asia/Bangkok">SE Asia (+7)</option>
                                <option value="Asia/Singapore">Singapore (+8)</option>
                                <option value="Asia/Tokyo">Japan / Korea (+9)</option>
                                <option value="Australia/Sydney">Australia (+11)</option>
                              </select>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => {
                                const days = rule.scheduleConfig?.days || ['mon', 'tue', 'wed', 'thu', 'fri'];
                                const isActive = days.includes(day);
                                return (
                                  <button
                                    key={day}
                                    type="button"
                                    onClick={() => {
                                      const newDays = isActive ? days.filter(d => d !== day) : [...days, day];
                                      const rules = [...getRules()];
                                      rules[ruleIdx] = { ...rules[ruleIdx], scheduleConfig: { ...rules[ruleIdx].scheduleConfig, days: newDays } };
                                      setRules(rules);
                                    }}
                                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${isActive ? 'bg-amber-500 text-white' : 'bg-white text-amber-600 border border-amber-300'}`}
                                  >
                                    {day}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

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
                                    <option value="not_contains">not contains</option>
                                    <option value="equals">equals</option>
                                    <option value="not_equals">not equals</option>
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
                                  <div className={`rounded-lg p-2.5 space-y-2 ${isDelay ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-200'}`}>
                                    <div className="flex items-center gap-1.5">
                                      {isDelay && <span className="text-sm">⏳</span>}
                                      {action.type === 'condition_branch' && <span className="text-sm">🔀</span>}
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
                                    {action.type === 'condition_branch' && (
                                      <div className="space-y-3 border border-slate-200 bg-white rounded-lg p-3">
                                        <div>
                                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">If</p>
                                          <div className="space-y-1.5">
                                            {(action.config?.conditions || []).map((cond, condIdx) => (
                                              <div key={condIdx} className="flex gap-1.5 items-center">
                                                <input
                                                  type="text"
                                                  value={cond.field}
                                                  onChange={e => updateConditionInBranchAction(ruleIdx, actIdx, condIdx, 'field', e.target.value)}
                                                  className="w-24 p-2 border border-slate-200 rounded-lg text-xs"
                                                  placeholder="field"
                                                />
                                                <select
                                                  value={cond.op}
                                                  onChange={e => updateConditionInBranchAction(ruleIdx, actIdx, condIdx, 'op', e.target.value)}
                                                  className="p-2 border border-slate-200 rounded-lg text-xs bg-white"
                                                >
                                                  <option value="contains">contains</option>
                                                  <option value="not_contains">not contains</option>
                                                  <option value="equals">equals</option>
                                                  <option value="not_equals">not equals</option>
                                                  <option value="gt">&gt;</option>
                                                  <option value="lt">&lt;</option>
                                                  <option value="exists">exists</option>
                                                  <option value="not_exists">not exists</option>
                                                </select>
                                                {!['exists', 'not_exists'].includes(cond.op) && (
                                                  <input
                                                    type="text"
                                                    value={cond.value || ''}
                                                    onChange={e => updateConditionInBranchAction(ruleIdx, actIdx, condIdx, 'value', e.target.value)}
                                                    className="flex-1 p-2 border border-slate-200 rounded-lg text-xs"
                                                    placeholder="value"
                                                  />
                                                )}
                                                <button onClick={() => removeConditionFromBranchAction(ruleIdx, actIdx, condIdx)} className="p-1 hover:bg-red-50 rounded">
                                                  <X className="w-3 h-3 text-red-400" />
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                          <button
                                            onClick={() => addConditionToBranchAction(ruleIdx, actIdx)}
                                            className="mt-1.5 text-[11px] text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
                                          >
                                            <Plus className="w-3 h-3" /> Add branch condition
                                          </button>
                                        </div>

                                        {[
                                          { key: 'thenActions', label: 'Then (True)' },
                                          { key: 'elseActions', label: 'Else (False)' },
                                        ].map(branch => (
                                          <div key={branch.key} className="space-y-1.5 pt-2 border-t border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{branch.label}</p>
                                            <div className="space-y-1.5">
                                              {(action.config?.[branch.key] || []).map((branchAction, branchIdx) => {
                                                const branchActionDef = AUTOMATION_ACTIONS.find(a => a.id === branchAction.type);
                                                return (
                                                  <div key={branchIdx} className="bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                      <select
                                                        value={branchAction.type}
                                                        onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'type', e.target.value)}
                                                        className="flex-1 p-2 border border-slate-200 rounded-lg text-xs bg-white"
                                                      >
                                                        {AUTOMATION_ACTIONS.filter(a => a.id !== 'condition_branch').map(act => (
                                                          <option key={act.id} value={act.id}>{act.icon} {act.label}</option>
                                                        ))}
                                                      </select>
                                                      <button onClick={() => removeBranchStep(ruleIdx, actIdx, branch.key, branchIdx)} className="p-1 hover:bg-red-50 rounded">
                                                        <X className="w-3 h-3 text-red-400" />
                                                      </button>
                                                    </div>

                                                    {branchActionDef?.configFields?.includes('message') && (
                                                      <textarea
                                                        value={branchAction.config?.message || ''}
                                                        onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'message', e.target.value)}
                                                        className="w-full p-2 border border-slate-200 rounded-lg text-xs resize-none"
                                                        rows={2}
                                                        placeholder="Message..."
                                                      />
                                                    )}
                                                    {branchActionDef?.configFields?.includes('delayHours') && (
                                                      <input
                                                        type="number"
                                                        min="0.5"
                                                        step="0.5"
                                                        value={branchAction.config?.delayHours || 1}
                                                        onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'delayHours', parseFloat(e.target.value) || 1)}
                                                        className="w-24 p-2 border border-slate-200 rounded-lg text-xs text-center"
                                                      />
                                                    )}
                                                    {branchActionDef?.configFields?.includes('status') && (
                                                      <input
                                                        type="text"
                                                        value={branchAction.config?.status || ''}
                                                        onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'status', e.target.value)}
                                                        className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                                        placeholder="e.g. hot_lead"
                                                      />
                                                    )}
                                                    {branchActionDef?.configFields?.includes('tag') && (
                                                      <input
                                                        type="text"
                                                        value={branchAction.config?.tag || ''}
                                                        onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'tag', e.target.value)}
                                                        className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                                        placeholder="e.g. vip"
                                                      />
                                                    )}
                                                    {branchActionDef?.configFields?.includes('aiPrompt') && (
                                                      <div className="space-y-1.5">
                                                        <textarea
                                                          value={branchAction.config?.aiPrompt || ''}
                                                          onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'aiPrompt', e.target.value)}
                                                          className="w-full p-2 border border-slate-200 rounded-lg text-xs resize-none"
                                                          rows={3}
                                                          placeholder="Prompt for AI. Has full business context."
                                                        />
                                                        <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
                                                          <input
                                                            type="checkbox"
                                                            checked={branchAction.config?.stopOnNo === true || branchAction.config?.stopOnNo === 'true'}
                                                            onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'stopOnNo', e.target.checked)}
                                                            className="rounded border-slate-300"
                                                          />
                                                          <span className="font-medium">Stop chain if AI says NO</span>
                                                        </label>
                                                      </div>
                                                    )}
                                                    {branchActionDef?.configFields?.includes('searchQuery') && (
                                                      <div className="space-y-1.5">
                                                        <input
                                                          type="text"
                                                          value={branchAction.config?.searchQuery || ''}
                                                          onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'searchQuery', e.target.value)}
                                                          className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                                          placeholder="Search query, e.g. plumbers near me"
                                                        />
                                                        <input
                                                          type="text"
                                                          value={branchAction.config?.searchLocation || ''}
                                                          onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'searchLocation', e.target.value)}
                                                          className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                                          placeholder="Location, e.g. Miami, FL"
                                                        />
                                                        <div className="flex items-center gap-2">
                                                          <label className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Max</label>
                                                          <input
                                                            type="number"
                                                            min="5"
                                                            max="200"
                                                            value={branchAction.config?.searchMaxResults || 50}
                                                            onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'searchMaxResults', parseInt(e.target.value) || 50)}
                                                            className="w-20 p-2 border border-slate-200 rounded-lg text-xs text-center"
                                                          />
                                                        </div>
                                                      </div>
                                                    )}
                                                    {branchActionDef?.configFields?.includes('staggerIntervalMin') && (
                                                      <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-1.5">
                                                          <label className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Every</label>
                                                          <input
                                                            type="number"
                                                            min="5"
                                                            value={branchAction.config?.staggerIntervalMin || 15}
                                                            onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'staggerIntervalMin', parseInt(e.target.value) || 15)}
                                                            className="w-16 p-2 border border-slate-200 rounded-lg text-xs text-center"
                                                          />
                                                          <span className="text-[10px] text-slate-500">min</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                          <label className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Max/day</label>
                                                          <input
                                                            type="number"
                                                            min="1"
                                                            value={branchAction.config?.staggerMaxPerDay || 15}
                                                            onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'staggerMaxPerDay', parseInt(e.target.value) || 15)}
                                                            className="w-16 p-2 border border-slate-200 rounded-lg text-xs text-center"
                                                          />
                                                        </div>
                                                      </div>
                                                    )}
                                                    {branchActionDef?.configFields?.includes('emailSubject') && (
                                                      <div className="space-y-1.5">
                                                        <input
                                                          type="text"
                                                          value={branchAction.config?.emailSubject || ''}
                                                          onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'emailSubject', e.target.value)}
                                                          className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                                          placeholder="Email subject..."
                                                        />
                                                        <textarea
                                                          value={branchAction.config?.emailBody || ''}
                                                          onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'emailBody', e.target.value)}
                                                          className="w-full p-2 border border-slate-200 rounded-lg text-xs resize-none"
                                                          rows={3}
                                                          placeholder="Email body..."
                                                        />
                                                      </div>
                                                    )}
                                                    {branchActionDef?.configFields?.includes('templateSid') && (
                                                      <input
                                                        type="text"
                                                        value={branchAction.config?.templateSid || ''}
                                                        onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'templateSid', e.target.value)}
                                                        className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono"
                                                        placeholder="HX... (Twilio Content SID)"
                                                      />
                                                    )}
                                                    {branchActionDef?.configFields?.includes('url') && (
                                                      <input
                                                        type="url"
                                                        value={branchAction.config?.url || ''}
                                                        onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'url', e.target.value)}
                                                        className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                                        placeholder="https://hooks.zapier.com/..."
                                                      />
                                                    )}
                                                    {branchActionDef?.configFields?.includes('jobType') && (
                                                      <input
                                                        type="text"
                                                        value={branchAction.config?.jobType || ''}
                                                        onChange={e => updateBranchStep(ruleIdx, actIdx, branch.key, branchIdx, 'jobType', e.target.value)}
                                                        className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                                        placeholder="Call purpose, e.g. Sales Demo"
                                                      />
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                            <button
                                              onClick={() => addBranchStep(ruleIdx, actIdx, branch.key)}
                                              className="text-[11px] text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
                                            >
                                              <Plus className="w-3 h-3" /> Add {branch.label.toLowerCase()} step
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
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
                                        placeholder="Message... Variables: {firstName}, {businessName}, {phone}, {amount}"
                                      />
                                    )}
                                    {actionDef?.configFields?.includes('url') && (
                                      <div className="space-y-1.5">
                                        <input
                                          type="url"
                                          value={action.config?.url || ''}
                                          onChange={e => updateActionInRule(ruleIdx, actIdx, 'url', e.target.value)}
                                          className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                          placeholder="https://hooks.zapier.com/..."
                                        />
                                        <details className="text-xs">
                                          <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600 select-none">
                                            Advanced: custom headers
                                          </summary>
                                          <input
                                            type="text"
                                            value={action.config?.webhookHeaders || ''}
                                            onChange={e => updateActionInRule(ruleIdx, actIdx, 'webhookHeaders', e.target.value)}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono mt-1.5"
                                            placeholder='Authorization=Bearer xxx, X-Api-Key=abc'
                                          />
                                        </details>
                                      </div>
                                    )}
                                    {actionDef?.configFields?.includes('jobType') && (
                                      <input
                                        type="text"
                                        value={action.config?.jobType || ''}
                                        onChange={e => updateActionInRule(ruleIdx, actIdx, 'jobType', e.target.value)}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                        placeholder="Call purpose, e.g. Quote Follow-Up, Sales Demo"
                                      />
                                    )}
                                    {actionDef?.configFields?.includes('retellAgentId') && (
                                      <details className="text-xs">
                                        <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600 select-none">
                                          Advanced: custom number / agent ID
                                        </summary>
                                        <div className="space-y-1.5 mt-1.5">
                                          <input
                                            type="text"
                                            value={action.config?.fromNumber || ''}
                                            onChange={e => updateActionInRule(ruleIdx, actIdx, 'fromNumber', e.target.value)}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono"
                                            placeholder="From Number (blank = default)"
                                          />
                                          <input
                                            type="text"
                                            value={action.config?.retellAgentId || ''}
                                            onChange={e => updateActionInRule(ruleIdx, actIdx, 'retellAgentId', e.target.value)}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono"
                                            placeholder="Retell Agent ID (blank = Brain tab)"
                                          />
                                        </div>
                                      </details>
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

                                      </div>
                                    )}
                                    {actionDef?.configFields?.includes('emailSubject') && (
                                      <div className="space-y-1.5">
                                        <input
                                          type="text"
                                          value={action.config?.emailSubject || ''}
                                          onChange={e => updateActionInRule(ruleIdx, actIdx, 'emailSubject', e.target.value)}
                                          className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                          placeholder="Email subject... use {firstName}, {businessName}"
                                        />
                                        <textarea
                                          value={action.config?.emailBody || ''}
                                          onChange={e => updateActionInRule(ruleIdx, actIdx, 'emailBody', e.target.value)}
                                          className="w-full p-2 border border-slate-200 rounded-lg text-xs resize-none"
                                          rows={4}
                                          placeholder="Email body... use {firstName}, {businessName}, {amount}. Line breaks become <br> in the email."
                                        />
                                      </div>
                                    )}
                                    {actionDef?.configFields?.includes('tag') && (
                                      <input
                                        type="text"
                                        value={action.config?.tag || ''}
                                        onChange={e => updateActionInRule(ruleIdx, actIdx, 'tag', e.target.value)}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                        placeholder="e.g. hot_lead, vip, kitchen_remodel"
                                      />
                                    )}
                                    {actionDef?.configFields?.includes('aiPrompt') && (
                                      <div className="space-y-1.5">
                                        <textarea
                                          value={action.config?.aiPrompt || ''}
                                          onChange={e => updateActionInRule(ruleIdx, actIdx, 'aiPrompt', e.target.value)}
                                          className="w-full p-2 border border-slate-200 rounded-lg text-xs resize-none"
                                          rows={3}
                                          placeholder="Prompt for AI. Use {customerName}, {metadata.category}, {aiResponse}, etc. Has full business context."
                                        />
                                        <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={action.config?.stopOnNo === true || action.config?.stopOnNo === 'true'}
                                            onChange={e => updateActionInRule(ruleIdx, actIdx, 'stopOnNo', e.target.checked)}
                                            className="rounded border-slate-300"
                                          />
                                          <span className="font-medium">Stop chain if AI says NO</span> (for lead qualification)
                                        </label>
                                      </div>
                                    )}
                                    {actionDef?.configFields?.includes('searchQuery') && (
                                      <div className="space-y-1.5">
                                        <input
                                          type="text"
                                          value={action.config?.searchQuery || ''}
                                          onChange={e => updateActionInRule(ruleIdx, actIdx, 'searchQuery', e.target.value)}
                                          className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                          placeholder="Search query, e.g. plumbers near me"
                                        />
                                        <input
                                          type="text"
                                          value={action.config?.searchLocation || ''}
                                          onChange={e => updateActionInRule(ruleIdx, actIdx, 'searchLocation', e.target.value)}
                                          className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                          placeholder="Location, e.g. Miami, FL"
                                        />
                                        <div className="flex items-center gap-2">
                                          <label className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Max results</label>
                                          <input
                                            type="number"
                                            min="5"
                                            max="200"
                                            value={action.config?.searchMaxResults || 50}
                                            onChange={e => updateActionInRule(ruleIdx, actIdx, 'searchMaxResults', parseInt(e.target.value) || 50)}
                                            className="w-20 p-2 border border-slate-200 rounded-lg text-xs text-center"
                                          />
                                        </div>
                                      </div>
                                    )}
                                    {actionDef?.configFields?.includes('staggerIntervalMin') && (
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5">
                                          <label className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Every</label>
                                          <input
                                            type="number"
                                            min="5"
                                            value={action.config?.staggerIntervalMin || 15}
                                            onChange={e => updateActionInRule(ruleIdx, actIdx, 'staggerIntervalMin', parseInt(e.target.value) || 15)}
                                            className="w-16 p-2 border border-slate-200 rounded-lg text-xs text-center"
                                          />
                                          <span className="text-[10px] text-slate-500">min</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <label className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Max/day</label>
                                          <input
                                            type="number"
                                            min="1"
                                            value={action.config?.staggerMaxPerDay || 15}
                                            onChange={e => updateActionInRule(ruleIdx, actIdx, 'staggerMaxPerDay', parseInt(e.target.value) || 15)}
                                            className="w-16 p-2 border border-slate-200 rounded-lg text-xs text-center"
                                          />
                                        </div>
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
