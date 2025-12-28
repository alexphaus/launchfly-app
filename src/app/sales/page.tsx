'use client';

import { useState, useEffect } from 'react';
import { 
  Search, 
  Users, 
  BookOpen, 
  Plus, 
  Copy, 
  Check, 
  MessageSquare, 
  ExternalLink, 
  Loader2,
  MapPin,
  Phone,
  Briefcase,
  Save,
  Trash2
} from 'lucide-react';

// --- Types ---

interface SalesLead {
  id: string;
  business_name: string;
  service: string;
  area: string;
  phone: string;
  url?: string;
  context?: string;
  status: 'new' | 'contacted' | 'replied' | 'converted' | 'rejected';
  notes?: string;
  created_at: string;
}

// --- Components ---

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<'hunter' | 'closer' | 'guide'>('hunter');
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);

  // Fetch leads on mount
  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setIsLoadingLeads(true);
    try {
      const res = await fetch('/api/sales/leads');
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (error) {
      console.error('Failed to fetch leads', error);
    } finally {
      setIsLoadingLeads(false);
    }
  };

  const handleLeadAdded = (newLead: SalesLead) => {
    setLeads([newLead, ...leads]);
    setActiveTab('closer'); // Switch to list view after adding
  };

  const handleLeadUpdated = (updatedLead: SalesLead) => {
    setLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-900">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Founder Operating System (v1.0)</h1>
          <p className="text-gray-600">Wear only ONE hat at a time. Never mix selling with building.</p>
        </header>

        {/* Tabs */}
        <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-200 mb-8 w-fit">
          <TabButton 
            active={activeTab === 'hunter'} 
            onClick={() => setActiveTab('hunter')} 
            icon={<Search className="w-4 h-4" />}
            label="1. Hunter (Find)"
          />
          <TabButton 
            active={activeTab === 'closer'} 
            onClick={() => setActiveTab('closer')} 
            icon={<Users className="w-4 h-4" />}
            label="2. Closer (Sell)"
          />
          <TabButton 
            active={activeTab === 'guide'} 
            onClick={() => setActiveTab('guide')} 
            icon={<BookOpen className="w-4 h-4" />}
            label="SOP Guide"
          />
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 min-h-[600px]">
          {activeTab === 'hunter' && <HunterView onLeadAdded={handleLeadAdded} />}
          {activeTab === 'closer' && <CloserView leads={leads} isLoading={isLoadingLeads} onUpdate={handleLeadUpdated} />}
          {activeTab === 'guide' && <GuideView />}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active 
          ? 'bg-blue-600 text-white shadow-sm' 
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// --- Hunter View ---

function HunterView({ onLeadAdded }: { onLeadAdded: (lead: SalesLead) => void }) {
  const [formData, setFormData] = useState({
    businessName: '',
    service: '',
    area: '',
    phone: '',
    url: '',
    context: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/sales/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        const newLead = await res.json();
        onLeadAdded(newLead);
        // Reset form
        setFormData({ businessName: '', service: '', area: '', phone: '', url: '', context: '' });
      }
    } catch (error) {
      console.error('Error adding lead:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-full mb-4">
          <Search className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Hunter Phase</h2>
        <p className="text-gray-500 mt-2">Find high-quality raw material. Do NOT send messages yet.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Business Name</label>
            <input 
              required
              type="text" 
              placeholder="e.g. Tip Top Aircon"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              value={formData.businessName}
              onChange={e => setFormData({...formData, businessName: e.target.value})}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Service Type (Niche)</label>
            <input 
              required
              type="text" 
              placeholder="e.g. Aircon Service"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              value={formData.service}
              onChange={e => setFormData({...formData, service: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Area / Location</label>
            <input 
              required
              type="text" 
              placeholder="e.g. Ampang"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              value={formData.area}
              onChange={e => setFormData({...formData, area: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">WhatsApp Number</label>
            <input 
              required
              type="text" 
              placeholder="e.g. +60123456789"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Website / Social URL (Optional)</label>
          <input 
            type="url" 
            placeholder="https://facebook.com/..."
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            value={formData.url}
            onChange={e => setFormData({...formData, url: e.target.value})}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Notes / Context (Optional)</label>
          <textarea 
            placeholder="Any extra details..."
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none h-24 resize-none"
            value={formData.context}
            onChange={e => setFormData({...formData, context: e.target.value})}
          />
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          <span>Save to List</span>
        </button>
      </form>
    </div>
  );
}

// --- Closer View ---

function CloserView({ leads, isLoading, onUpdate }: { leads: SalesLead[], isLoading: boolean, onUpdate: (lead: SalesLead) => void }) {
  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <Users className="w-12 h-12 mb-4 opacity-20" />
        <p>No leads found. Go to Hunter tab to add some.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 gap-4">
        {leads.map(lead => (
          <LeadCard key={lead.id} lead={lead} onUpdate={onUpdate} />
        ))}
      </div>
    </div>
  );
}

function LeadCard({ lead, onUpdate }: { lead: SalesLead, onUpdate: (lead: SalesLead) => void }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copiedOpener, setCopiedOpener] = useState(false);

  const openerText = `Salam boss 👋 You still handling ${lead.service} jobs around ${lead.area}?`;

  const copyOpener = () => {
    navigator.clipboard.writeText(openerText);
    setCopiedOpener(true);
    setTimeout(() => setCopiedOpener(false), 2000);
  };

  const updateStatus = async (status: SalesLead['status']) => {
    try {
      const res = await fetch('/api/sales/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, status })
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
      }
    } catch (error) {
      console.error('Failed to update status', error);
    }
  };

  const generatePreview = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/sales/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: lead.business_name,
          niche: lead.service,
          context: lead.context || `Business located in ${lead.area}. Service: ${lead.service}.`,
          url: lead.url,
          createPreview: true
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.previewUrl) {
          setPreviewUrl(data.previewUrl);
          updateStatus('converted');
        }
      }
    } catch (error) {
      console.error('Failed to generate preview', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const statusColors = {
    new: 'bg-gray-100 text-gray-700',
    contacted: 'bg-yellow-100 text-yellow-700',
    replied: 'bg-blue-100 text-blue-700',
    converted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700'
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="text-lg font-bold text-gray-900">{lead.business_name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${statusColors[lead.status]}`}>
              {lead.status}
            </span>
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
            <div className="flex items-center space-x-1">
              <Briefcase className="w-4 h-4" />
              <span>{lead.service}</span>
            </div>
            <div className="flex items-center space-x-1">
              <MapPin className="w-4 h-4" />
              <span>{lead.area}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Phone className="w-4 h-4" />
              <span>{lead.phone}</span>
            </div>
          </div>

          {/* Opener Box */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex items-center justify-between group">
            <code className="text-sm text-gray-800 font-mono">{openerText}</code>
            <button 
              onClick={copyOpener}
              className="ml-4 p-2 hover:bg-white rounded-md transition-colors text-gray-500 hover:text-blue-600"
              title="Copy Opener"
            >
              {copiedOpener ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col space-y-2 min-w-[160px]">
          {lead.status === 'new' && (
            <button 
              onClick={() => updateStatus('contacted')}
              className="w-full px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              Mark Contacted
            </button>
          )}
          
          {lead.status === 'contacted' && (
            <button 
              onClick={() => updateStatus('replied')}
              className="w-full px-4 py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors"
            >
              Mark Replied
            </button>
          )}

          {(lead.status === 'replied' || lead.status === 'converted') && !previewUrl && (
            <button 
              onClick={generatePreview}
              disabled={isGenerating}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              <span>Generate Preview</span>
            </button>
          )}

          {previewUrl && (
            <a 
              href={previewUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open Preview</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Guide View ---

function GuideView() {
  return (
    <div className="p-8 prose prose-blue max-w-none">
      <h2>🚀 LAUNCHFLY – FOUNDER OPERATING SYSTEM (FOS v1.0)</h2>
      
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 my-4">
        <p className="font-bold text-blue-900 m-0">Core Principle:</p>
        <p className="text-blue-800 m-0">👉 Wear only ONE hat at a time.<br/>👉 Never mix selling with building.</p>
      </div>

      <h3>1️⃣ DEPARTMENT: LEAD GENERATION (The Hunter)</h3>
      <ul>
        <li><strong>Goal:</strong> Find high-quality raw material → WhatsApp numbers of service businesses with pain.</li>
        <li><strong>Tasks:</strong> Scroll FB/Maps, Collect Name, Service, Area, Phone.</li>
        <li><strong>Rule:</strong> ❌ Never send messages in this phase. ✅ Only collect numbers.</li>
      </ul>

      <h3>2️⃣ DEPARTMENT: SALES (The Closer)</h3>
      <ul>
        <li><strong>Goal:</strong> Turn conversations into cash.</li>
        <li><strong>Opener:</strong> "Salam boss 👋 You still handling [Service] jobs around [Area]?"</li>
        <li><strong>Flow:</strong>
          <ol>
            <li>Send opener</li>
            <li>If "Yes" → Send preview link</li>
            <li>Say: "This captures customer details and creates a ready-to-send WhatsApp message. No monthly fees — you own it."</li>
            <li>Stop talking.</li>
          </ol>
        </li>
      </ul>

      <h3>3️⃣ DEPARTMENT: FULFILLMENT (The Builder)</h3>
      <ul>
        <li><strong>Goal:</strong> Deliver exactly what was sold.</li>
        <li><strong>Rule:</strong> ✅ Batch this work (evenings only). ❌ Don't interrupt selling to fix typos.</li>
      </ul>

      <h3>📅 DAILY FOUNDER SCHEDULE</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Time</th>
              <th className="p-2 text-left">Role</th>
              <th className="p-2 text-left">Task</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="p-2 border-b">09:00–10:00</td><td className="p-2 border-b">Hunter</td><td className="p-2 border-b">Find 20 businesses, log only</td></tr>
            <tr><td className="p-2 border-b">10:00–12:00</td><td className="p-2 border-b">Closer</td><td className="p-2 border-b">Send openers + reply to leads</td></tr>
            <tr><td className="p-2 border-b">12:00–14:00</td><td className="p-2 border-b">Break</td><td className="p-2 border-b">Don't message owners</td></tr>
            <tr><td className="p-2 border-b">14:00–16:00</td><td className="p-2 border-b">Closer</td><td className="p-2 border-b">Follow-ups & closes</td></tr>
            <tr><td className="p-2 border-b">20:00–22:00</td><td className="p-2 border-b">Builder</td><td className="p-2 border-b">Fulfillment & fixes</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
