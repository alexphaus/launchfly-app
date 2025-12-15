'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/dashboard')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Founder Analytics</h1>
            <p className="text-slate-600">Real-time overview of your lead generation business.</p>
          </div>
          <div className="flex gap-3">
             <Link href="/sales" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2">
                <span>+</span> New Prospect
             </Link>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard 
            title="Total Revenue" 
            value={`$${data.metrics.revenue.toLocaleString()}`} 
            trend="+12% vs last month" 
            trendUp={true}
            icon="💰"
          />
          <MetricCard 
            title="Active Clients" 
            value={data.metrics.customers} 
            trend="Stable" 
            icon="👥"
          />
          <MetricCard 
            title="Prospects Analyzed" 
            value={data.metrics.prospects} 
            trend="Growing" 
            trendUp={true}
            icon="🔍"
          />
          <MetricCard 
            title="Leads Generated" 
            value={data.metrics.leads} 
            subtitle="For your clients"
            icon="⚡"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chart / Activity Area */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Recent Activity Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900">Recent Activity</h2>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Last 10 Entries</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                    <tr>
                      <th className="px-6 py-4">Business</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Contact</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recentActivity.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">
                          {item.name || 'Unknown Business'}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-6 py-4">
                          {item.form_data?.prospectEmail || item.form_data?.prospectPhone || '-'}
                        </td>
                        <td className="px-6 py-4">
                          {new Date(item.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/preview/${item.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar / Insights */}
          <div className="space-y-8">
            {/* AI Insights Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">✨</span>
                <h2 className="text-lg font-bold">AI Strategic Insights</h2>
              </div>
              <div className="space-y-4">
                {data.insights.map((insight: string, i: number) => (
                  <div key={i} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                    <p className="text-sm leading-relaxed text-indigo-50">
                      {insight}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-white/10 text-xs text-indigo-200 text-center">
                Updated just now based on your live metrics
              </div>
            </div>

            {/* Conversion Funnel (Mini) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Funnel Health</h2>
              <div className="space-y-4">
                <FunnelStep 
                  label="Prospects Identified" 
                  value={data.metrics.prospects} 
                  max={data.metrics.prospects}
                  color="bg-slate-200" 
                />
                <FunnelStep 
                  label="Outreach Sent" 
                  value={data.metrics.outreach} 
                  max={data.metrics.prospects}
                  color="bg-blue-200" 
                />
                <FunnelStep 
                  label="Active Clients" 
                  value={data.metrics.customers} 
                  max={data.metrics.prospects}
                  color="bg-green-500" 
                  textColor="text-white" 
                />
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-slate-500">
                  Conversion Rate: <span className="font-bold text-slate-900">{data.metrics.conversionRate}%</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, trend, trendUp, icon, subtitle }: any) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-50 rounded-lg text-2xl">{icon}</div>
        {trend && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${trendUp ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
            {trend}
          </span>
        )}
      </div>
      <h3 className="text-slate-500 text-sm font-medium uppercase tracking-wide">{title}</h3>
      <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    prospect: 'bg-blue-50 text-blue-700 border-blue-200',
    ready: 'bg-green-50 text-green-700 border-green-200',
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    failed: 'bg-red-50 text-red-700 border-red-200'
  };
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function FunnelStep({ label, value, color, textColor = 'text-slate-700', max }: any) {
  const width = max ? Math.max(5, (value / max) * 100) + '%' : '100%';
  
  return (
    <div className="relative">
      <div className="flex justify-between text-xs font-semibold mb-1 text-slate-500">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="w-full bg-slate-50 rounded-lg overflow-hidden">
        <div 
          className={`h-8 flex items-center px-3 ${color} ${textColor} text-sm font-bold transition-all duration-500`}
          style={{ width }}
        >
          {/* Bar */}
        </div>
      </div>
    </div>
  );
}
