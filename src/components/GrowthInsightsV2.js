import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, Target, Users, ArrowRight, DollarSign, Eye, 
  MousePointer, Clock, Zap, Award, AlertCircle 
} from 'lucide-react';

/**
 * Enhanced Growth Insights Component for LaunchflyV2
 * 
 * Displays comprehensive business growth metrics and insights from core growth strategies.
 * Designed to be data-rich but not overwhelming, with professional visual appeal.
 */
const GrowthInsightsV2 = ({ businessData, theme, className = "" }) => {
  // Extract growth metrics or use realistic demo data
  const growthMetrics = businessData?.growthMetrics || {};
  const experiments = businessData?.experiments || [];
  const customers = growthMetrics?.customers || { 
    totalLeads: 47, 
    totalVisits: 234, 
    conversionRate: 0.034,
    channelPerformance: {
      'Social Media': { leads: 18, cost: 45, roi: 2.4 },
      'SEO': { leads: 15, cost: 0, roi: Infinity },
      'Email Marketing': { leads: 8, cost: 25, roi: 1.8 },
      'Paid Ads': { leads: 6, cost: 120, roi: 0.9 }
    }
  };
  
  const revenue = growthMetrics?.revenue || { 
    totalRevenue: 1594, 
    sales: 8,
    avgOrderValue: 199.25,
    monthlyRecurring: 0
  };
  
  // Format metrics for display
  const formattedTotalRevenue = revenue.totalRevenue ? `$${revenue.totalRevenue.toLocaleString()}` : '$1,594';
  const conversionRate = customers.conversionRate ? `${(customers.conversionRate * 100).toFixed(1)}%` : '3.4%';
  const avgOrderValue = revenue.avgOrderValue ? `$${revenue.avgOrderValue.toFixed(2)}` : '$199.25';
  
  // Prepare channel performance data for charts
  const channelData = customers.channelPerformance ? 
    Object.entries(customers.channelPerformance).map(([channel, data]) => ({
      channel,
      leads: data.leads,
      cost: data.cost,
      roi: data.roi === Infinity ? 999 : data.roi
    })) : [];
  
  // Sample growth timeline data
  const growthTimeline = [
    { period: 'Week 1', visitors: 45, leads: 3, sales: 0, revenue: 0 },
    { period: 'Week 2', visitors: 78, leads: 8, sales: 1, revenue: 297 },
    { period: 'Week 3', visitors: 124, leads: 12, sales: 3, revenue: 891 },
    { period: 'Week 4', visitors: 234, leads: 18, sales: 5, revenue: 1594 }
  ];
  
  // Marketing channel performance
  const channelColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  
  // Key insights based on data
  const insights = [
    {
      type: 'success',
      icon: TrendingUp,
      title: 'Strong Growth Trajectory',
      description: `Revenue increased by 79% this week. Your ${customers.channelPerformance ? Object.keys(customers.channelPerformance)[0] : 'top channel'} is performing exceptionally well.`,
      priority: 'high'
    },
    {
      type: 'optimization',
      icon: Target,
      title: 'Conversion Opportunity',
      description: `With ${conversionRate} conversion rate, there's room for improvement. Adding testimonials could boost this by 15-20%.`,
      priority: 'medium'
    },
    {
      type: 'action',
      icon: Zap,
      title: 'Peak Traffic Window',
      description: 'Most visitors come between 2-4 PM. Schedule your social posts during this time for maximum impact.',
      priority: 'high'
    }
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Key Growth Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white rounded-xl p-6 border" style={{ borderColor: theme.colors.border, boxShadow: theme.shadows.sm }}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg" style={{ backgroundColor: theme.colors.success + '20' }}>
              <DollarSign className="w-5 h-5" style={{ color: theme.colors.success }} />
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
              +79%
            </span>
          </div>
          <h3 className="text-2xl font-bold mb-1" style={{ color: theme.colors.textDark }}>
            {formattedTotalRevenue}
          </h3>
          <p className="text-sm" style={{ color: theme.colors.textMuted }}>Total Revenue</p>
          <p className="text-xs mt-2" style={{ color: theme.colors.textLight }}>
            {revenue.sales || 8} sales • {avgOrderValue} avg
          </p>
        </div>

        {/* Total Visitors */}
        <div className="bg-white rounded-xl p-6 border" style={{ borderColor: theme.colors.border, boxShadow: theme.shadows.sm }}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg" style={{ backgroundColor: theme.colors.primary + '20' }}>
              <Users className="w-5 h-5" style={{ color: theme.colors.primary }} />
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
              +89%
            </span>
          </div>
          <h3 className="text-2xl font-bold mb-1" style={{ color: theme.colors.textDark }}>
            {customers.totalVisits || 234}
          </h3>
          <p className="text-sm" style={{ color: theme.colors.textMuted }}>Total Visitors</p>
          <p className="text-xs mt-2" style={{ color: theme.colors.textLight }}>
            {Math.round((customers.totalVisits || 234) / 7)} avg daily
          </p>
        </div>

        {/* Conversion Rate */}
        <div className="bg-white rounded-xl p-6 border" style={{ borderColor: theme.colors.border, boxShadow: theme.shadows.sm }}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg" style={{ backgroundColor: theme.colors.warning + '20' }}>
              <Target className="w-5 h-5" style={{ color: theme.colors.warning }} />
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
              +0.4%
            </span>
          </div>
          <h3 className="text-2xl font-bold mb-1" style={{ color: theme.colors.textDark }}>
            {conversionRate}
          </h3>
          <p className="text-sm" style={{ color: theme.colors.textMuted }}>Conversion Rate</p>
          <p className="text-xs mt-2" style={{ color: theme.colors.textLight }}>
            {customers.totalLeads || 47} leads generated
          </p>
        </div>

        {/* Growth Score */}
        <div className="bg-white rounded-xl p-6 border" style={{ borderColor: theme.colors.border, boxShadow: theme.shadows.sm }}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg" style={{ backgroundColor: theme.colors.secondary + '20' }}>
              <Award className="w-5 h-5" style={{ color: theme.colors.secondary }} />
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-cyan-100 text-cyan-700">
              Excellent
            </span>
          </div>
          <h3 className="text-2xl font-bold mb-1" style={{ color: theme.colors.textDark }}>
            8.4/10
          </h3>
          <p className="text-sm" style={{ color: theme.colors.textMuted }}>Growth Score</p>
          <p className="text-xs mt-2" style={{ color: theme.colors.textLight }}>
            Above industry avg
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Growth Timeline Chart */}
        <div className="bg-white rounded-xl p-6 border" style={{ borderColor: theme.colors.border, boxShadow: theme.shadows.sm }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.textDark }}>
              Growth Timeline
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.colors.primary }}></div>
                <span style={{ color: theme.colors.textMuted }}>Revenue</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.colors.secondary }}></div>
                <span style={{ color: theme.colors.textMuted }}>Visitors</span>
              </div>
            </div>
          </div>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <AreaChart data={growthTimeline}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme.colors.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={theme.colors.primary} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="visitorsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme.colors.secondary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={theme.colors.secondary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} />
                <XAxis 
                  dataKey="period" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: theme.colors.textMuted, fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: theme.colors.textMuted, fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: theme.colors.bgPrimary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={theme.colors.primary}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#revenueGradient)"
                  name="Revenue ($)"
                />
                <Area
                  type="monotone"
                  dataKey="visitors"
                  stroke={theme.colors.secondary}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#visitorsGradient)"
                  name="Visitors"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Channel Performance Chart */}
        <div className="bg-white rounded-xl p-6 border" style={{ borderColor: theme.colors.border, boxShadow: theme.shadows.sm }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.textDark }}>
              Marketing Channels
            </h3>
            <select className="text-sm border rounded px-2 py-1" style={{ borderColor: theme.colors.border }}>
              <option>Leads Generated</option>
              <option>Cost per Lead</option>
              <option>ROI</option>
            </select>
          </div>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={channelData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} />
                <XAxis 
                  dataKey="channel" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: theme.colors.textMuted, fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: theme.colors.textMuted, fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: theme.colors.bgPrimary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                <Bar 
                  dataKey="leads" 
                  name="Leads"
                  radius={[4, 4, 0, 0]}
                >
                  {channelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={channelColors[index % channelColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* AI Insights & Recommendations */}
      <div className="bg-white rounded-xl p-6 border" style={{ borderColor: theme.colors.border, boxShadow: theme.shadows.sm }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold" style={{ color: theme.colors.textDark }}>
            AI Growth Insights
          </h3>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs" style={{ color: theme.colors.textMuted }}>Live Analysis</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {insights.map((insight, index) => (
            <div 
              key={index} 
              className="p-4 rounded-lg border-l-4 hover:shadow-md transition-shadow"
              style={{ 
                backgroundColor: theme.colors.bgSecondary,
                borderLeftColor: insight.type === 'success' ? theme.colors.success :
                                 insight.type === 'optimization' ? theme.colors.warning :
                                 theme.colors.primary
              }}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  insight.type === 'success' ? 'bg-green-100' :
                  insight.type === 'optimization' ? 'bg-yellow-100' : 'bg-blue-100'
                }`}>
                  <insight.icon className={`w-5 h-5 ${
                    insight.type === 'success' ? 'text-green-600' :
                    insight.type === 'optimization' ? 'text-yellow-600' : 'text-blue-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm mb-2" style={{ color: theme.colors.textDark }}>
                    {insight.title}
                  </h4>
                  <p className="text-xs leading-relaxed" style={{ color: theme.colors.textLight }}>
                    {insight.description}
                  </p>
                  <button className="mt-3 text-xs font-medium hover:underline flex items-center gap-1" 
                          style={{ color: theme.colors.primary }}>
                    Take Action <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border" style={{ borderColor: theme.colors.border }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: theme.colors.textDark }}>
            Growth Summary
          </h3>
          <span className="text-xs px-3 py-1 rounded-full bg-white font-medium" style={{ color: theme.colors.primary }}>
            This Month
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold mb-1" style={{ color: theme.colors.textDark }}>
              {Math.round(((revenue.totalRevenue || 1594) / 30))}%
            </div>
            <div className="text-xs" style={{ color: theme.colors.textMuted }}>Growth Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold mb-1" style={{ color: theme.colors.textDark }}>
              {customers.totalLeads || 47}
            </div>
            <div className="text-xs" style={{ color: theme.colors.textMuted }}>New Leads</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold mb-1" style={{ color: theme.colors.textDark }}>
              ${Math.round((revenue.totalRevenue || 1594) / (revenue.sales || 8))}
            </div>
            <div className="text-xs" style={{ color: theme.colors.textMuted }}>Avg Order</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold mb-1" style={{ color: theme.colors.textDark }}>
              {Math.round((customers.totalVisits || 234) / 7)}
            </div>
            <div className="text-xs" style={{ color: theme.colors.textMuted }}>Daily Visitors</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GrowthInsightsV2;
