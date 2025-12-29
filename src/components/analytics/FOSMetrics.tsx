'use client';

import { 
  Users, 
  Send, 
  MessageSquare, 
  ThumbsUp, 
  CheckCircle, 
  TrendingUp, 
  Zap,
  DollarSign,
  Link as LinkIcon
} from 'lucide-react';

interface FOSMetricsProps {
  metrics: {
    totalProspects: number;
    totalSent: number;
    todayProspects: number;
    todayOpeners: number;
    replied: number;
    interested: number;
    converted: number;
    previewsGenerated: number;
    noResponse: number;
    costSaved: number;
    responseRate: number;
    conversionRate: number;
  };
}

export default function FOSMetrics({ metrics }: FOSMetricsProps) {
  return (
    <div className="mb-8 space-y-6">
      {/* Header & High-Level KPIs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Founder Operating System
            </h2>
            <p className="text-sm text-slate-500">Live performance tracking</p>
          </div>
          
          {/* Efficiency Badges */}
          <div className="flex gap-3">
            <div className="px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium flex items-center gap-2 border border-green-100">
              <DollarSign className="w-3.5 h-3.5" />
              ${metrics.costSaved.toFixed(2)} Saved
            </div>
            <div className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-medium flex items-center gap-2 border border-purple-100">
              <LinkIcon className="w-3.5 h-3.5" />
              {metrics.previewsGenerated} Previews
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-slate-100">
          <KPICard 
            label="Response Rate" 
            value={`${metrics.responseRate}%`} 
            subtext={`${metrics.replied} replies received`}
            trend="neutral"
          />
          <KPICard 
            label="Conversion Rate" 
            value={`${metrics.conversionRate}%`} 
            subtext={`${metrics.converted} deals won`}
            trend="positive"
          />
          <KPICard 
            label="Active Pipeline" 
            value={metrics.totalProspects - metrics.converted - metrics.noResponse} 
            subtext="Prospects in progress"
            trend="neutral"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel View */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-500" />
            Conversion Funnel
          </h3>
          
          <div className="space-y-4">
            <FunnelRow 
              label="Total Prospects" 
              count={metrics.totalProspects} 
              total={metrics.totalProspects}
              color="bg-slate-100"
              textColor="text-slate-700"
              icon={<Users className="w-4 h-4" />}
            />
            <FunnelRow 
              label="Outreach Sent" 
              count={metrics.totalSent} 
              total={metrics.totalProspects}
              color="bg-blue-50"
              textColor="text-blue-700"
              icon={<Send className="w-4 h-4" />}
            />
            <FunnelRow 
              label="Replied" 
              count={metrics.replied} 
              total={metrics.totalProspects}
              color="bg-indigo-50"
              textColor="text-indigo-700"
              icon={<MessageSquare className="w-4 h-4" />}
            />
            <FunnelRow 
              label="Interested" 
              count={metrics.interested} 
              total={metrics.totalProspects}
              color="bg-orange-50"
              textColor="text-orange-700"
              icon={<ThumbsUp className="w-4 h-4" />}
            />
            <FunnelRow 
              label="Converted" 
              count={metrics.converted} 
              total={metrics.totalProspects}
              color="bg-emerald-50"
              textColor="text-emerald-700"
              icon={<CheckCircle className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Daily Activity */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <CalendarIcon />
            Today's Activity
          </h3>
          
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-sm text-slate-500 mb-1">New Prospects Added</div>
              <div className="text-3xl font-bold text-slate-900">{metrics.todayProspects}</div>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="text-sm text-blue-600 mb-1">Openers Sent</div>
              <div className="text-3xl font-bold text-blue-900">{metrics.todayOpeners}</div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Pending Replies</span>
                <span className="font-medium text-slate-900">
                  {metrics.totalSent - metrics.replied - metrics.noResponse}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, subtext, trend }: { label: string, value: string | number, subtext: string, trend: 'positive' | 'negative' | 'neutral' }) {
  return (
    <div>
      <div className="text-sm font-medium text-slate-500 mb-1">{label}</div>
      <div className="text-3xl font-bold text-slate-900 mb-1">{value}</div>
      <div className="text-xs text-slate-400">{subtext}</div>
    </div>
  );
}

function FunnelRow({ label, count, total, color, textColor, icon }: { label: string, count: number, total: number, color: string, textColor: string, icon: React.ReactNode }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1 text-sm">
        <div className={`flex items-center gap-2 font-medium ${textColor}`}>
          {icon}
          {label}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-xs">{percentage}%</span>
          <span className="font-bold text-slate-900">{count}</span>
        </div>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full ${color.replace('bg-', 'bg-opacity-100 bg-').replace('50', '500')}`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
