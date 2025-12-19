'use client';

import React, { useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, Users, DollarSign, MousePointerClick, 
  ArrowUpRight, ArrowDownRight, Activity, Calendar 
} from 'lucide-react';

export default function AnalyticsDashboard({ 
  data, 
  revenue, 
  leads, 
  businesses, 
  recentActivity 
}: { 
  data: any, 
  revenue: number, 
  leads: number, 
  businesses: number, 
  recentActivity: any[] 
}) {

  // Process data for charts
  const chartData = useMemo(() => {
    // Group by date
    const grouped = new Map();
    
    // Add businesses
    data.businesses.forEach((b: any) => {
      const date = new Date(b.created_at).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        timeZone: 'Asia/Manila'
      });
      if (!grouped.has(date)) grouped.set(date, { date, businesses: 0, leads: 0, revenue: 0 });
      grouped.get(date).businesses += 1;
      grouped.get(date).leads += (b.total_leads || 0);
    });

    // Add orders (revenue)
    data.orders.forEach((o: any) => {
      const date = new Date(o.created_at).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        timeZone: 'Asia/Manila'
      });
      if (!grouped.has(date)) grouped.set(date, { date, businesses: 0, leads: 0, revenue: 0 });
      grouped.get(date).revenue += (o.total_amount || 0);
    });

    // Convert to array and sort
    return Array.from(grouped.values())
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30); // Last 30 days
  }, [data]);

  // AI Insights Generation
  const insights = useMemo(() => {
    const insightsList = [];
    
    if (leads > 0 && businesses > 0) {
      const avgLeads = (leads / businesses).toFixed(1);
      insightsList.push({
        type: 'positive',
        text: `Your businesses are generating an average of ${avgLeads} leads each.`,
        icon: <TrendingUp className="w-4 h-4 text-green-600" />
      });
    }

    if (revenue > 0) {
      insightsList.push({
        type: 'positive',
        text: `Revenue is flowing! Total processed volume: $${revenue.toLocaleString()}.`,
        icon: <DollarSign className="w-4 h-4 text-green-600" />
      });
    } else {
      insightsList.push({
        type: 'neutral',
        text: "No revenue recorded yet. Focus on converting prospects to paid users.",
        icon: <Activity className="w-4 h-4 text-blue-600" />
      });
    }

    if (recentActivity.length > 0) {
      const recentLeads = recentActivity.filter(a => a.type.includes('lead') || a.type.includes('conversion')).length;
      if (recentLeads > 0) {
        insightsList.push({
          type: 'positive',
          text: `High activity detected: ${recentLeads} conversion events in the last batch.`,
          icon: <MousePointerClick className="w-4 h-4 text-purple-600" />
        });
      }
    }

    return insightsList;
  }, [leads, businesses, revenue, recentActivity]);

  return (
    <div className="space-y-8">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Total Revenue" 
          value={`$${revenue.toLocaleString()}`} 
          icon={<DollarSign className="w-6 h-6 text-green-600" />}
          trend="+12.5%" 
          trendUp={true}
        />
        <KpiCard 
          title="Active Businesses" 
          value={businesses.toString()} 
          icon={<Users className="w-6 h-6 text-blue-600" />}
          trend="+4 this week" 
          trendUp={true}
        />
        <KpiCard 
          title="Total Leads" 
          value={leads.toString()} 
          icon={<MousePointerClick className="w-6 h-6 text-purple-600" />}
          trend="+24%" 
          trendUp={true}
        />
        <KpiCard 
          title="Avg. Conversion" 
          value="3.2%" 
          icon={<Activity className="w-6 h-6 text-orange-600" />}
          trend="-0.4%" 
          trendUp={false}
        />
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue & Growth Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Growth Trajectory</h3>
              <p className="text-sm text-slate-500">Revenue and Business Growth (Last 30 Days)</p>
            </div>
            <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-sm">
              <option>Last 30 Days</option>
              <option>Last 90 Days</option>
              <option>All Time</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorBiz" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue ($)" />
                <Area type="monotone" dataKey="businesses" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorBiz)" name="Businesses" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Insights Panel */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Activity className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">AI Insights</h3>
              <p className="text-sm text-slate-500">Automated analysis</p>
            </div>
          </div>

          <div className="space-y-4">
            {insights.map((insight, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex gap-3">
                  <div className="mt-1">{insight.icon}</div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {insight.text}
                  </p>
                </div>
              </div>
            ))}
            
            {insights.length === 0 && (
              <p className="text-sm text-slate-500 italic">Not enough data for insights yet.</p>
            )}

            <div className="pt-4 mt-4 border-t border-slate-100">
              <button className="w-full py-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors">
                Generate Deep Report →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">Live Activity Feed</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="px-6 py-3">Event Type</th>
                <th className="px-6 py-3">Details</th>
                <th className="px-6 py-3">Time</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentActivity.map((activity: any) => (
                <tr key={activity.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {formatEventType(activity.type)}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    <div className="flex flex-col">
                      <span>{activity.message || 'No details'}</span>
                      {activity.businesses?.name && (
                        <span className="text-xs font-medium text-blue-600 mt-1">
                          Business: {activity.businesses.name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500" suppressHydrationWarning>
                    {new Date(activity.created_at).toLocaleString('en-US', { 
                      timeZone: 'Asia/Manila',
                      year: 'numeric',
                      month: 'numeric',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: 'numeric',
                      second: 'numeric',
                      hour12: true
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Completed
                    </span>
                  </td>
                </tr>
              ))}
              {recentActivity.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    No recent activity found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, trend, trendUp }: any) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
        </div>
        <div className="p-2 bg-slate-50 rounded-lg">
          {icon}
        </div>
      </div>
      <div className="flex items-center gap-1 text-sm">
        {trendUp ? (
          <ArrowUpRight className="w-4 h-4 text-green-600" />
        ) : (
          <ArrowDownRight className="w-4 h-4 text-red-600" />
        )}
        <span className={trendUp ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
          {trend}
        </span>
        <span className="text-slate-400 ml-1">vs last month</span>
      </div>
    </div>
  );
}

function formatEventType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
