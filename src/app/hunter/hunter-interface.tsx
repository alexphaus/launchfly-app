'use client'

import { useState } from 'react';
import { saveLead } from './actions';

export default function HunterInterface({ initialLeads }: { initialLeads: any[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [form, setForm] = useState({
    businessName: '',
    phone: '',
    service: '',
    area: ''
  });
  const [greeting, setGreeting] = useState<'Hi' | 'Salam'>('Hi');
  const [loading, setLoading] = useState(false);

  // Option A: "Salam boss 👋 You still handling [Service] jobs around [Area]?"
  // Universal: "Hi boss 👋..."
  const openerMessage = `${greeting} boss 👋 \nYou still handling ${form.service || '[SERVICE]'} jobs around ${form.area || '[AREA]'}?`;
  
  // Clean phone number for WhatsApp link
  const cleanPhone = form.phone.replace(/\D/g, '');
  const whatsappLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(openerMessage)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Open WhatsApp immediately to avoid popup blockers
    const waWindow = window.open(whatsappLink, '_blank');

    const formData = new FormData();
    formData.append('businessName', form.businessName);
    formData.append('phone', form.phone);
    formData.append('service', form.service);
    formData.append('area', form.area);

    const result = await saveLead(formData);
    
    if (result.success) {
      setLeads([result.lead, ...leads]);
      // Reset form partially (keep area/service as they might be hunting in same niche/area)
      setForm(prev => ({ ...prev, businessName: '', phone: '' })); 
    } else {
      alert('Error saving lead: ' + (result.error || 'Unknown error'));
      // If save failed, maybe we should warn the user that the WA window was opened for an unsaved lead?
      // But usually it's fine.
    }
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">🏹 Hunter Department</h1>
        <p className="text-gray-600 mt-2">
          Find high-quality raw material. Log details. Send opener. <span className="font-semibold text-red-600">Do not sell yet.</span>
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Input & Action */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span>🎯</span> New Target
            </h2>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setGreeting('Hi')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition ${greeting === 'Hi' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Hi
              </button>
              <button
                type="button"
                onClick={() => setGreeting('Salam')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition ${greeting === 'Salam' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Salam
              </button>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <input
                type="text"
                required
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                value={form.businessName}
                onChange={e => setForm({...form, businessName: e.target.value})}
                placeholder="e.g. Ali Plumbing Services"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                <input
                  type="text"
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  value={form.service}
                  onChange={e => setForm({...form, service: e.target.value})}
                  placeholder="e.g. Plumbing"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                <input
                  type="text"
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  value={form.area}
                  onChange={e => setForm({...form, area: e.target.value})}
                  placeholder="e.g. Ampang"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
              <input
                type="text"
                required
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                placeholder="e.g. 60123456789"
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-md border border-blue-100 mt-4">
              <label className="block text-xs font-semibold text-blue-600 uppercase mb-2">Opener Message (Option A)</label>
              <div className="whitespace-pre-wrap font-mono text-sm text-blue-900 bg-white p-3 rounded border border-blue-200">
                {openerMessage}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              {loading ? 'Saving...' : 'Log Lead & Open WhatsApp 🚀'}
            </button>
          </form>
        </div>

        {/* Right Column: Recent Logs */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>📋</span> Recent Hunts <span className="text-sm font-normal text-gray-500 ml-2">({leads.length})</span>
          </h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              {leads.length === 0 ? (
                <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                  <span className="text-4xl mb-2">🕸️</span>
                  <p>No leads logged yet.</p>
                  <p className="text-sm mt-1">Start hunting on Facebook/Google Maps!</p>
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-medium border-b sticky top-0">
                    <tr>
                      <th className="p-3 pl-4">Business</th>
                      <th className="p-3">Service/Area</th>
                      <th className="p-3 pr-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3 pl-4">
                          <div className="font-medium text-gray-900">{lead.business_name}</div>
                          <div className="text-gray-500 text-xs font-mono mt-0.5">{lead.phone}</div>
                        </td>
                        <td className="p-3">
                          <div className="text-gray-900">{lead.service}</div>
                          <div className="text-gray-500 text-xs mt-0.5">{lead.area}</div>
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            lead.status === 'contacted' ? 'bg-green-100 text-green-800' : 
                            lead.status === 'new' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {lead.status === 'contacted' ? 'Sent' : lead.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
