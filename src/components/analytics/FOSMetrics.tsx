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
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-slate-900 mb-4">
        🎯 Founder Operating System Metrics
      </h2>
      
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          label="Total Prospects"
          value={metrics.totalProspects}
          emoji="📋"
          color="slate"
        />
        <StatCard
          label="Today Added"
          value={metrics.todayProspects}
          emoji="🆕"
          color="blue"
        />
        <StatCard
          label="Openers Sent Today"
          value={metrics.todayOpeners}
          emoji="📤"
          color="indigo"
        />
        <StatCard
          label="Replied"
          value={metrics.replied}
          emoji="💬"
          color="green"
        />
        <StatCard
          label="Interested"
          value={metrics.interested}
          emoji="🔥"
          color="orange"
        />
        <StatCard
          label="Converted"
          value={metrics.converted}
          emoji="🎉"
          color="emerald"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Response Rate</span>
            <span className="text-lg">📊</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {metrics.responseRate}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {metrics.replied} / {metrics.totalProspects} replied
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Close Rate</span>
            <span className="text-lg">🎯</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {metrics.conversionRate}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {metrics.converted} / {metrics.replied} converted
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Previews Generated</span>
            <span className="text-lg">🔗</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {metrics.previewsGenerated}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Only for interested leads
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">AI Cost Saved</span>
            <span className="text-lg">💰</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            ${metrics.costSaved.toFixed(2)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            By not auto-generating previews
          </div>
        </div>
      </div>

      {/* Pipeline Summary */}
      <div className="mt-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border p-4">
        <h3 className="font-medium text-slate-700 mb-3">📈 Pipeline Summary</h3>
        <div className="flex items-center gap-2 text-sm overflow-x-auto pb-2">
          <PipelineStage label="New" count={metrics.totalProspects - metrics.replied - metrics.noResponse} color="gray" />
          <Arrow />
          <PipelineStage label="Sent" count={metrics.todayOpeners} color="blue" />
          <Arrow />
          <PipelineStage label="Replied" count={metrics.replied} color="green" />
          <Arrow />
          <PipelineStage label="Preview" count={metrics.previewsGenerated} color="purple" />
          <Arrow />
          <PipelineStage label="Won" count={metrics.converted} color="emerald" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  emoji, 
  color 
}: { 
  label: string; 
  value: number; 
  emoji: string; 
  color: string;
}) {
  const colorMap: Record<string, string> = {
    slate: 'text-slate-900',
    blue: 'text-blue-600',
    indigo: 'text-indigo-600',
    green: 'text-green-600',
    orange: 'text-orange-600',
    emerald: 'text-emerald-600',
    purple: 'text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-lg">{emoji}</span>
      </div>
      <div className={`text-2xl font-bold ${colorMap[color] || 'text-slate-900'}`}>
        {value}
      </div>
    </div>
  );
}

function PipelineStage({ 
  label, 
  count, 
  color 
}: { 
  label: string; 
  count: number; 
  color: string;
}) {
  const bgMap: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
    emerald: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className={`px-3 py-2 rounded-lg ${bgMap[color] || 'bg-gray-100'} whitespace-nowrap`}>
      <span className="font-medium">{count}</span>
      <span className="ml-1 text-xs opacity-75">{label}</span>
    </div>
  );
}

function Arrow() {
  return (
    <span className="text-slate-300 flex-shrink-0">→</span>
  );
}
