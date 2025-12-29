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
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Pipeline Summary</h3>
        <div className="flex items-center gap-4 overflow-x-auto pb-2">
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
    <div className={`px-4 py-3 rounded-lg ${bgMap[color] || 'bg-gray-100'} whitespace-nowrap flex flex-col items-center min-w-[100px]`}>
      <span className="text-2xl font-bold">{count}</span>
      <span className="text-xs font-medium uppercase tracking-wide opacity-75 mt-1">{label}</span>
    </div>
  );
}

function Arrow() {
  return (
    <span className="text-slate-300 flex-shrink-0">→</span>
  );
}
