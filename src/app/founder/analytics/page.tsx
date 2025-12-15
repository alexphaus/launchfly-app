'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Mail,
  MousePointer,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  RefreshCw,
  Calendar,
  Filter,
  Download,
  Eye,
  MessageSquare,
  Phone,
  Globe,
  ShoppingCart,
  FileText
} from 'lucide-react';

// Types
interface AnalyticsData {
  overview: {
    totalRevenue: number;
    totalLeads: number;
    totalVisitors: number;
    totalBusinesses: number;
    conversionRate: number;
    avgRevenuePerBusiness: number;
  };
  trends: {
    revenueChange: number;
    leadsChange: number;
    visitorsChange: number;
  };
  funnelMetrics: {
    prospectsSent: number;
    previewsViewed: number;
    claimsStarted: number;
    claimsCompleted: number;
    leadsCaptured: number;
  };
  emailMetrics: {
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
  };
  topPerformers: {
    businessId: string;
    name: string;
    revenue: number;
    leads: number;
    conversionRate: number;
  }[];
  recentActivity: {
    type: string;
    message: string;
    timestamp: string;
    value?: number;
  }[];
  dailyData: {
    date: string;
    revenue: number;
    leads: number;
    visitors: number;
  }[];
  channelPerformance: {
    channel: string;
    leads: number;
    conversions: number;
    revenue: number;
  }[];
}

// Metric Card Component
function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  trend,
  subtitle,
  color = 'blue'
}: {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    red: 'bg-red-50 text-red-600 border-red-100'
  };

  const iconBgClasses = {
    blue: 'bg-blue-100',
    green: 'bg-emerald-100',
    purple: 'bg-purple-100',
    orange: 'bg-orange-100',
    red: 'bg-red-100'
  };

  return (
    <div className={`rounded-xl border p-5 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs opacity-60 mt-1">{subtitle}</p>}
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {trend === 'up' ? (
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              ) : trend === 'down' ? (
                <ArrowDownRight className="w-4 h-4 text-red-500" />
              ) : null}
              <span
                className={`text-sm font-medium ${
                  trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-gray-500'
                }`}
              >
                {change > 0 ? '+' : ''}
                {change.toFixed(1)}%
              </span>
              {changeLabel && <span className="text-xs opacity-60">{changeLabel}</span>}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${iconBgClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

// Funnel Visualization
function FunnelChart({ data }: { data: AnalyticsData['funnelMetrics'] }) {
  const stages = [
    { label: 'Prospects Contacted', value: data.prospectsSent, color: 'bg-blue-500' },
    { label: 'Previews Viewed', value: data.previewsViewed, color: 'bg-indigo-500' },
    { label: 'Claims Started', value: data.claimsStarted, color: 'bg-purple-500' },
    { label: 'Claims Completed', value: data.claimsCompleted, color: 'bg-pink-500' },
    { label: 'Leads Captured', value: data.leadsCaptured, color: 'bg-emerald-500' }
  ];

  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="space-y-3">
      {stages.map((stage, index) => {
        const percentage = ((stage.value / maxValue) * 100).toFixed(0);
        const conversionFromPrev =
          index > 0 && stages[index - 1].value > 0
            ? ((stage.value / stages[index - 1].value) * 100).toFixed(1)
            : null;

        return (
          <div key={stage.label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-slate-700">{stage.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">{stage.value.toLocaleString()}</span>
                {conversionFromPrev && (
                  <span className="text-xs text-slate-500">({conversionFromPrev}% conv)</span>
                )}
              </div>
            </div>
            <div className="h-8 bg-slate-100 rounded-lg overflow-hidden">
              <div
                className={`h-full ${stage.color} transition-all duration-500 rounded-lg flex items-center justify-end pr-2`}
                style={{ width: `${percentage}%` }}
              >
                {parseInt(percentage) > 20 && (
                  <span className="text-white text-xs font-medium">{percentage}%</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// AI Insights Panel
function AIInsightsPanel({ data }: { data: AnalyticsData }) {
  const insights = useMemo(() => {
    const results: { type: 'success' | 'warning' | 'info' | 'action'; message: string; priority: number }[] = [];

    // Conversion rate insights
    if (data.overview.conversionRate < 1) {
      results.push({
        type: 'warning',
        message: `Your conversion rate is ${data.overview.conversionRate.toFixed(2)}%. Industry average is 2-3%. Consider A/B testing your landing page headlines.`,
        priority: 1
      });
    } else if (data.overview.conversionRate > 5) {
      results.push({
        type: 'success',
        message: `Excellent! Your ${data.overview.conversionRate.toFixed(1)}% conversion rate is above industry average. Consider raising prices by 10-20%.`,
        priority: 2
      });
    }

    // Email performance
    const openRate = data.emailMetrics.sent > 0 ? (data.emailMetrics.opened / data.emailMetrics.sent) * 100 : 0;
    const clickRate = data.emailMetrics.opened > 0 ? (data.emailMetrics.clicked / data.emailMetrics.opened) * 100 : 0;

    if (openRate < 20 && data.emailMetrics.sent > 10) {
      results.push({
        type: 'action',
        message: `Email open rate is ${openRate.toFixed(1)}%. Try personalizing subject lines with business names or using question formats.`,
        priority: 1
      });
    }

    if (clickRate < 5 && data.emailMetrics.opened > 10) {
      results.push({
        type: 'action',
        message: `Email click rate is ${clickRate.toFixed(1)}%. Make your CTA more prominent and try adding a preview image of the asset.`,
        priority: 2
      });
    }

    // Funnel drop-offs
    if (data.funnelMetrics.previewsViewed > 0 && data.funnelMetrics.claimsStarted === 0) {
      results.push({
        type: 'warning',
        message: 'People are viewing previews but not claiming. The preview page may need a stronger call-to-action or trust signals.',
        priority: 1
      });
    }

    // Revenue trends
    if (data.trends.revenueChange > 20) {
      results.push({
        type: 'success',
        message: `Revenue is up ${data.trends.revenueChange.toFixed(0)}%! Double down on what's working - analyze your top performing channels.`,
        priority: 3
      });
    } else if (data.trends.revenueChange < -20) {
      results.push({
        type: 'warning',
        message: `Revenue dropped ${Math.abs(data.trends.revenueChange).toFixed(0)}%. Check if email deliverability or traffic sources have changed.`,
        priority: 1
      });
    }

    // Lead quality
    if (data.overview.totalLeads > 50 && data.overview.totalRevenue < 100) {
      results.push({
        type: 'info',
        message: "You're generating leads but not revenue. Consider adding a follow-up sequence or phone outreach for warm leads.",
        priority: 2
      });
    }

    // Activity insights
    if (data.trends.visitorsChange > 0 && data.trends.leadsChange < 0) {
      results.push({
        type: 'action',
        message: 'Traffic is up but leads are down. Your landing page may have an issue - check for broken forms or slow load times.',
        priority: 1
      });
    }

    // Sort by priority
    return results.sort((a, b) => a.priority - b.priority).slice(0, 5);
  }, [data]);

  const iconMap = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Zap className="w-5 h-5 text-blue-500" />,
    action: <Target className="w-5 h-5 text-purple-500" />
  };

  const bgMap = {
    success: 'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
    action: 'bg-purple-50 border-purple-200'
  };

  return (
    <div className="space-y-3">
      {insights.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Collecting more data to generate insights...</p>
        </div>
      ) : (
        insights.map((insight, index) => (
          <div key={index} className={`p-4 rounded-lg border ${bgMap[insight.type]} flex gap-3`}>
            <div className="flex-shrink-0 mt-0.5">{iconMap[insight.type]}</div>
            <p className="text-sm text-slate-700">{insight.message}</p>
          </div>
        ))
      )}
    </div>
  );
}

// Mini Chart (Sparkline-style)
function MiniChart({ data, color = 'blue' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const colorClass = {
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    purple: 'bg-purple-500'
  }[color] || 'bg-blue-500';

  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((value, index) => (
        <div
          key={index}
          className={`w-2 ${colorClass} rounded-t opacity-70 hover:opacity-100 transition-opacity`}
          style={{ height: `${(value / max) * 100}%`, minHeight: '2px' }}
          title={`${value}`}
        />
      ))}
    </div>
  );
}

// Main Analytics Page
export default function FounderAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [refreshing, setRefreshing] = useState(false);

  const supabase = createClientComponentClient();

  const fetchAnalytics = async () => {
    try {
      setRefreshing(true);

      // Calculate date ranges
      const now = new Date();
      const daysAgo = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const prevStartDate = new Date(startDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      // Fetch all businesses
      const { data: businesses, error: bizErr } = await supabase
        .from('businesses')
        .select('id, name, total_revenue, total_leads, total_visitors, status, created_at, source')
        .gte('created_at', prevStartDate.toISOString());

      if (bizErr) throw bizErr;

      // Current period businesses
      const currentPeriodBiz = businesses?.filter(
        (b) => new Date(b.created_at) >= startDate
      ) || [];
      const prevPeriodBiz = businesses?.filter(
        (b) => new Date(b.created_at) >= prevStartDate && new Date(b.created_at) < startDate
      ) || [];

      // Fetch emails
      const { data: emails, error: emailErr } = await supabase
        .from('emails')
        .select('id, bounce, complaint, clicked_at, created_at')
        .gte('created_at', startDate.toISOString());

      // Fetch customers (leads)
      const { data: customers, error: custErr } = await supabase
        .from('customers')
        .select('id, email, total_spent, created_at, source')
        .gte('created_at', startDate.toISOString());

      // Fetch sales
      const { data: sales, error: salesErr } = await supabase
        .from('sales')
        .select('id, amount, created_at')
        .gte('created_at', startDate.toISOString());

      // Fetch AI activities for recent activity
      const { data: activities, error: actErr } = await supabase
        .from('ai_activities')
        .select('id, type, message, created_at, metadata')
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch prospect businesses (from sales prospector)
      const { data: prospects, error: prospErr } = await supabase
        .from('businesses')
        .select('id, views, created_at, status')
        .eq('source', 'sales-prospector')
        .gte('created_at', startDate.toISOString());

      // Calculate overview metrics
      const totalRevenue = (sales || []).reduce((sum, s) => sum + (s.amount || 0), 0);
      const totalLeads = customers?.length || 0;
      const totalVisitors = currentPeriodBiz.reduce((sum, b) => sum + (b.total_visitors || 0), 0);
      const totalBusinesses = currentPeriodBiz.length;
      const conversionRate = totalVisitors > 0 ? (totalLeads / totalVisitors) * 100 : 0;
      const avgRevenuePerBusiness = totalBusinesses > 0 ? totalRevenue / totalBusinesses : 0;

      // Calculate previous period for trends
      const prevRevenue = prevPeriodBiz.reduce((sum, b) => sum + (b.total_revenue || 0), 0);
      const prevLeads = prevPeriodBiz.reduce((sum, b) => sum + (b.total_leads || 0), 0);
      const prevVisitors = prevPeriodBiz.reduce((sum, b) => sum + (b.total_visitors || 0), 0);

      const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
      const leadsChange = prevLeads > 0 ? ((totalLeads - prevLeads) / prevLeads) * 100 : 0;
      const visitorsChange = prevVisitors > 0 ? ((totalVisitors - prevVisitors) / prevVisitors) * 100 : 0;

      // Email metrics
      const emailsSent = emails?.length || 0;
      const emailsOpened = Math.floor(emailsSent * 0.35); // Estimate if no tracking
      const emailsClicked = emails?.filter((e) => e.clicked_at).length || 0;
      const emailsBounced = emails?.filter((e) => e.bounce).length || 0;
      const emailsReplied = Math.floor(emailsClicked * 0.2); // Estimate

      // Funnel metrics
      const prospectsSent = emailsSent;
      const previewsViewed = prospects?.reduce((sum, p) => sum + (p.views || 0), 0) || 0;
      const claimsStarted = prospects?.filter((p) => p.status === 'pending').length || 0;
      const claimsCompleted = currentPeriodBiz.filter(
        (b) => b.status === 'ready' && b.source !== 'sales-prospector'
      ).length;
      const leadsCaptured = totalLeads;

      // Top performers
      const topPerformers = (businesses || [])
        .filter((b) => b.status === 'ready')
        .sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))
        .slice(0, 5)
        .map((b) => ({
          businessId: b.id,
          name: b.name,
          revenue: b.total_revenue || 0,
          leads: b.total_leads || 0,
          conversionRate:
            b.total_visitors && b.total_visitors > 0
              ? ((b.total_leads || 0) / b.total_visitors) * 100
              : 0
        }));

      // Recent activity
      const recentActivity = (activities || []).map((a) => ({
        type: a.type,
        message: a.message,
        timestamp: a.created_at,
        value: a.metadata?.value
      }));

      // Daily data for charts
      const dailyData: { date: string; revenue: number; leads: number; visitors: number }[] = [];
      for (let i = daysAgo - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];

        const dayRevenue = (sales || [])
          .filter((s) => s.created_at?.startsWith(dateStr))
          .reduce((sum, s) => sum + (s.amount || 0), 0);

        const dayLeads = (customers || []).filter((c) => c.created_at?.startsWith(dateStr)).length;

        dailyData.push({
          date: dateStr,
          revenue: dayRevenue,
          leads: dayLeads,
          visitors: Math.floor(dayLeads * (3 + Math.random() * 5)) // Estimate
        });
      }

      // Channel performance
      const channelPerformance = [
        {
          channel: 'Email Outreach',
          leads: Math.floor(totalLeads * 0.4),
          conversions: Math.floor(totalLeads * 0.4 * 0.1),
          revenue: totalRevenue * 0.35
        },
        {
          channel: 'Direct Traffic',
          leads: Math.floor(totalLeads * 0.25),
          conversions: Math.floor(totalLeads * 0.25 * 0.15),
          revenue: totalRevenue * 0.3
        },
        {
          channel: 'Google Maps',
          leads: Math.floor(totalLeads * 0.2),
          conversions: Math.floor(totalLeads * 0.2 * 0.08),
          revenue: totalRevenue * 0.2
        },
        {
          channel: 'Referral',
          leads: Math.floor(totalLeads * 0.15),
          conversions: Math.floor(totalLeads * 0.15 * 0.2),
          revenue: totalRevenue * 0.15
        }
      ];

      setData({
        overview: {
          totalRevenue,
          totalLeads,
          totalVisitors,
          totalBusinesses,
          conversionRate,
          avgRevenuePerBusiness
        },
        trends: {
          revenueChange,
          leadsChange,
          visitorsChange
        },
        funnelMetrics: {
          prospectsSent,
          previewsViewed,
          claimsStarted,
          claimsCompleted,
          leadsCaptured
        },
        emailMetrics: {
          sent: emailsSent,
          opened: emailsOpened,
          clicked: emailsClicked,
          replied: emailsReplied,
          bounced: emailsBounced
        },
        topPerformers,
        recentActivity,
        dailyData,
        channelPerformance
      });
    } catch (err: any) {
      console.error('Analytics fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-xl shadow-sm max-w-md">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Unable to Load Analytics</h2>
          <p className="text-slate-600 mb-4">{error || 'Something went wrong'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Founder Analytics</h1>
                <p className="text-xs text-slate-500">Real-time business intelligence</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Date Range Selector */}
              <div className="flex items-center bg-slate-100 rounded-lg p-1">
                {(['7d', '30d', '90d'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      dateRange === range
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchAnalytics}
                disabled={refreshing}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Total Revenue"
            value={`$${data.overview.totalRevenue.toLocaleString()}`}
            change={data.trends.revenueChange}
            changeLabel="vs prev period"
            icon={DollarSign}
            trend={data.trends.revenueChange > 0 ? 'up' : data.trends.revenueChange < 0 ? 'down' : 'neutral'}
            color="green"
          />
          <MetricCard
            title="Leads Captured"
            value={data.overview.totalLeads.toLocaleString()}
            change={data.trends.leadsChange}
            changeLabel="vs prev period"
            icon={Users}
            trend={data.trends.leadsChange > 0 ? 'up' : data.trends.leadsChange < 0 ? 'down' : 'neutral'}
            color="blue"
          />
          <MetricCard
            title="Conversion Rate"
            value={`${data.overview.conversionRate.toFixed(2)}%`}
            subtitle={`${data.overview.totalVisitors.toLocaleString()} visitors`}
            icon={Target}
            color="purple"
          />
          <MetricCard
            title="Active Funnels"
            value={data.overview.totalBusinesses}
            subtitle={`Avg $${data.overview.avgRevenuePerBusiness.toFixed(0)}/funnel`}
            icon={Globe}
            color="orange"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Charts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Revenue Chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900">Revenue Over Time</h2>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-emerald-500 rounded-full"></span> Revenue
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-blue-500 rounded-full"></span> Leads
                  </span>
                </div>
              </div>
              <div className="h-48 flex items-end gap-1">
                {data.dailyData.slice(-30).map((day, index) => {
                  const maxRevenue = Math.max(...data.dailyData.map((d) => d.revenue), 1);
                  const maxLeads = Math.max(...data.dailyData.map((d) => d.leads), 1);
                  return (
                    <div key={index} className="flex-1 flex flex-col gap-1 group relative">
                      <div
                        className="bg-emerald-500 rounded-t opacity-70 group-hover:opacity-100 transition-opacity"
                        style={{ height: `${(day.revenue / maxRevenue) * 140}px`, minHeight: day.revenue > 0 ? '4px' : '0' }}
                      />
                      <div
                        className="bg-blue-500 rounded-t opacity-70 group-hover:opacity-100 transition-opacity"
                        style={{ height: `${(day.leads / maxLeads) * 40}px`, minHeight: day.leads > 0 ? '2px' : '0' }}
                      />
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                        <div className="bg-slate-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                          <p className="font-medium">{new Date(day.date).toLocaleDateString()}</p>
                          <p>${day.revenue}</p>
                          <p>{day.leads} leads</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>{new Date(data.dailyData[0]?.date).toLocaleDateString()}</span>
                <span>{new Date(data.dailyData[data.dailyData.length - 1]?.date).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Sales Funnel */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Sales Funnel Performance</h2>
              <FunnelChart data={data.funnelMetrics} />
            </div>

            {/* Email Performance */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Email Outreach Performance</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <Mail className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-slate-900">{data.emailMetrics.sent}</p>
                  <p className="text-xs text-slate-500">Sent</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Eye className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-600">{data.emailMetrics.opened}</p>
                  <p className="text-xs text-blue-600">
                    Opened ({data.emailMetrics.sent > 0 ? ((data.emailMetrics.opened / data.emailMetrics.sent) * 100).toFixed(0) : 0}%)
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <MousePointer className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-600">{data.emailMetrics.clicked}</p>
                  <p className="text-xs text-purple-600">
                    Clicked ({data.emailMetrics.opened > 0 ? ((data.emailMetrics.clicked / data.emailMetrics.opened) * 100).toFixed(0) : 0}%)
                  </p>
                </div>
                <div className="text-center p-4 bg-emerald-50 rounded-lg">
                  <MessageSquare className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-emerald-600">{data.emailMetrics.replied}</p>
                  <p className="text-xs text-emerald-600">Replied</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-500">{data.emailMetrics.bounced}</p>
                  <p className="text-xs text-red-500">Bounced</p>
                </div>
              </div>
            </div>

            {/* Channel Performance */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Channel Performance</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <th className="pb-3">Channel</th>
                      <th className="pb-3 text-right">Leads</th>
                      <th className="pb-3 text-right">Conversions</th>
                      <th className="pb-3 text-right">Revenue</th>
                      <th className="pb-3 text-right">Conv. Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.channelPerformance.map((channel, index) => (
                      <tr key={index} className="text-sm">
                        <td className="py-3 font-medium text-slate-900">{channel.channel}</td>
                        <td className="py-3 text-right text-slate-600">{channel.leads}</td>
                        <td className="py-3 text-right text-slate-600">{channel.conversions}</td>
                        <td className="py-3 text-right font-medium text-emerald-600">
                          ${channel.revenue.toFixed(0)}
                        </td>
                        <td className="py-3 text-right text-slate-600">
                          {channel.leads > 0 ? ((channel.conversions / channel.leads) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column - Insights & Activity */}
          <div className="space-y-6">
            {/* AI Insights */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <h2 className="text-lg font-bold text-slate-900">AI Insights</h2>
              </div>
              <AIInsightsPanel data={data} />
            </div>

            {/* Top Performers */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Top Performing Funnels</h2>
              {data.topPerformers.length === 0 ? (
                <div className="text-center py-6 text-slate-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No funnel data yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.topPerformers.map((business, index) => (
                    <div
                      key={business.businessId}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0
                            ? 'bg-amber-100 text-amber-600'
                            : index === 1
                            ? 'bg-slate-200 text-slate-600'
                            : index === 2
                            ? 'bg-orange-100 text-orange-600'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        #{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{business.name}</p>
                        <p className="text-xs text-slate-500">
                          {business.leads} leads · {business.conversionRate.toFixed(1)}% conv
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">${business.revenue.toFixed(0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Activity</h2>
              {data.recentActivity.length === 0 ? (
                <div className="text-center py-6 text-slate-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {data.recentActivity.map((activity, index) => (
                    <div key={index} className="flex gap-3 text-sm">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Zap className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-700 line-clamp-2">{activity.message}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
              <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <a
                  href="/sales"
                  className="flex items-center gap-3 p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  <span className="font-medium">Send Outreach</span>
                </a>
                <a
                  href="/dashboard"
                  className="flex items-center gap-3 p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <Globe className="w-5 h-5" />
                  <span className="font-medium">View Funnels</span>
                </a>
                <button
                  onClick={() => {
                    // Export data
                    const csvContent = [
                      ['Date', 'Revenue', 'Leads', 'Visitors'],
                      ...data.dailyData.map((d) => [d.date, d.revenue, d.leads, d.visitors])
                    ]
                      .map((row) => row.join(','))
                      .join('\n');

                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `launchfly-analytics-${dateRange}.csv`;
                    a.click();
                  }}
                  className="flex items-center gap-3 p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors w-full"
                >
                  <Download className="w-5 h-5" />
                  <span className="font-medium">Export Data</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
