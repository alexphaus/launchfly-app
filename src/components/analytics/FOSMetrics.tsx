'use client';

interface FOSMetricsProps {
  metrics: {
    totalProspects: number;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            🎯 Founder Operating System
            <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded">FOS v1.0</span>
          </h2>
          <p className="text-sm text-slate-600">Hunter → Closer → Builder pipeline metrics</p>
        </div>
        <a 
          href="/sales" 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          Open Sales Cockpit →
        </a>
      </div>

      {/* Daily Goals */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
        <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
          📅 Today's Progress
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-slate-900">{metrics.todayProspects}/20</div>
            <div className="text-sm text-slate-600">Prospects Added</div>
            <div className={`text-xs mt-1 ${metrics.todayProspects >= 20 ? 'text-green-600' : 'text-slate-500'}`}>
              {metrics.todayProspects >= 20 ? '✓ Goal Hit!' : `${20 - metrics.todayProspects} more`}
            </div>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{metrics.todayOpeners}/20</div>
            <div className="text-sm text-slate-600">Openers Sent</div>
            <div className={`text-xs mt-1 ${metrics.todayOpeners >= 20 ? 'text-green-600' : 'text-slate-500'}`}>
              {metrics.todayOpeners >= 20 ? '✓ Goal Hit!' : `${20 - metrics.todayOpeners} more`}
            </div>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{metrics.replied}</div>
            <div className="text-sm text-slate-600">Total Replies</div>
            <div className="text-xs mt-1 text-slate-500">{metrics.responseRate}% response rate</div>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-emerald-600">{metrics.converted}</div>
            <div className="text-sm text-slate-600">Conversions</div>
            <div className="text-xs mt-1 text-slate-500">{metrics.conversionRate}% close rate</div>
          </div>
        </div>
      </div>

      {/* Sales Funnel */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">🔄 Sales Funnel</h3>
        <div className="space-y-3">
          {[
            { label: 'Total Prospects', count: metrics.totalProspects, color: 'bg-slate-500', pct: 100 },
            { label: 'Opener Sent', count: metrics.totalProspects - metrics.noResponse - (metrics.totalProspects - metrics.replied - metrics.noResponse - metrics.interested), color: 'bg-amber-500', pct: metrics.totalProspects ? Math.round(((metrics.replied + metrics.noResponse) / metrics.totalProspects) * 100) : 0 },
            { label: 'Replied', count: metrics.replied, color: 'bg-blue-500', pct: metrics.totalProspects ? Math.round((metrics.replied / metrics.totalProspects) * 100) : 0 },
            { label: 'Interested', count: metrics.interested, color: 'bg-indigo-500', pct: metrics.totalProspects ? Math.round((metrics.interested / metrics.totalProspects) * 100) : 0 },
            { label: 'Converted', count: metrics.converted, color: 'bg-emerald-500', pct: metrics.totalProspects ? Math.round((metrics.converted / metrics.totalProspects) * 100) : 0 },
          ].map((stage) => (
            <div key={stage.label} className="flex items-center gap-3">
              <div className="w-32 text-sm text-slate-600">{stage.label}</div>
              <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                <div 
                  className={`h-full ${stage.color} transition-all duration-500 flex items-center justify-end pr-2`}
                  style={{ width: `${Math.max(stage.pct, 5)}%` }}
                >
                  {stage.pct > 15 && <span className="text-white text-xs font-medium">{stage.count}</span>}
                </div>
              </div>
              <div className="w-12 text-right font-semibold text-slate-900">{stage.count}</div>
              <div className="w-14 text-right text-sm text-slate-500">{stage.pct}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Savings */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
        <h3 className="font-bold text-green-900 mb-4 flex items-center gap-2">
          💰 Cost Optimization (New System vs Old)
        </h3>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-700">${metrics.costSaved.toFixed(2)}</div>
            <div className="text-sm text-green-800">AI Cost Saved</div>
            <div className="text-xs text-green-600 mt-1">By not generating previews</div>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-700">
              {metrics.totalProspects - metrics.previewsGenerated}
            </div>
            <div className="text-sm text-green-800">Prospects w/o Preview</div>
            <div className="text-xs text-green-600 mt-1">No wasted generation</div>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{metrics.previewsGenerated}</div>
            <div className="text-sm text-green-800">Previews Generated</div>
            <div className="text-xs text-green-600 mt-1">Only for interested</div>
          </div>
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-700">
              {metrics.totalProspects ? Math.round((metrics.previewsGenerated / metrics.totalProspects) * 100) : 0}%
            </div>
            <div className="text-sm text-green-800">Preview Rate</div>
            <div className="text-xs text-green-600 mt-1">vs 100% before</div>
          </div>
        </div>
      </div>

      {/* FOS Schedule Reference */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">📅 Daily FOS Schedule</h3>
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="font-semibold text-blue-900">09:00-10:00</div>
            <div className="text-blue-700">🎣 Hunter Mode</div>
            <div className="text-xs text-blue-600 mt-1">Find 20 businesses, log only</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <div className="font-semibold text-amber-900">10:00-12:00</div>
            <div className="text-amber-700">📤 Closer Mode</div>
            <div className="text-xs text-amber-600 mt-1">Send openers + reply to leads</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <div className="font-semibold text-amber-900">14:00-16:00</div>
            <div className="text-amber-700">📤 Closer Mode</div>
            <div className="text-xs text-amber-600 mt-1">Follow-ups & closes</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3">
            <div className="font-semibold text-emerald-900">20:00-22:00</div>
            <div className="text-emerald-700">🔨 Builder Mode</div>
            <div className="text-xs text-emerald-600 mt-1">Fulfillment & fixes</div>
          </div>
        </div>
      </div>
    </div>
  );
}
