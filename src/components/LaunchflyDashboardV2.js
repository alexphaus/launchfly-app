import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell 
} from 'recharts';
import { 
  ChevronRight, Globe, DollarSign, Users, Rocket, Check, TrendingUp, 
  Sparkles, Clock, X, AlertCircle, MessageSquare, Eye, ShoppingCart,
  Target, ArrowUpRight, ArrowDownRight, Calendar, Bell, Settings,
  ExternalLink, Zap, Activity, Award, RefreshCw
} from 'lucide-react';
import GrowthInsightsV2 from './GrowthInsightsV2';

// Enhanced theme with more sophisticated color palette
const theme = {
  colors: {
    primary: '#2563eb',
    primaryLight: '#3b82f6',
    primaryDark: '#1d4ed8',
    secondary: '#06b6d4',
    secondaryLight: '#22d3ee',
    success: '#10b981',
    successLight: '#34d399',
    warning: '#f59e0b',
    warningLight: '#fbbf24',
    error: '#ef4444',
    errorLight: '#f87171',
    textDark: '#0f172a',
    textMedium: '#334155',
    textLight: '#64748b',
    textMuted: '#94a3b8',
    bgPrimary: '#ffffff',
    bgSecondary: '#f8fafc',
    bgTertiary: '#f1f5f9',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
  gradients: {
    primary: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
    success: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
    warning: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
  }
};

// Enhanced Loading State for initial data loading
const DataLoader = ({ message = "Loading your business data..." }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="relative mb-6">
      <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    </div>
    <p className="text-lg font-medium text-slate-600">{message}</p>
  </div>
);

// Metric Card Component with enhanced styling
const MetricCard = ({ title, value, change, changeType, icon: Icon, trend, subtitle, className = "" }) => (
  <div className={`bg-white rounded-xl p-6 border hover:shadow-md transition-shadow ${className}`} style={{ borderColor: theme.colors.border, boxShadow: theme.shadows.sm }}>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center mb-2">
          <Icon className="w-5 h-5 mr-2" style={{ color: theme.colors.primary }} />
          <h3 className="text-sm font-medium" style={{ color: theme.colors.textLight }}>{title}</h3>
        </div>
        <div className="flex items-baseline mb-1">
          <span className="text-2xl font-bold" style={{ color: theme.colors.textDark }}>{value}</span>
          {change && (
            <span className={`ml-2 text-sm font-medium flex items-center ${
              changeType === 'positive' ? 'text-emerald-600' : 
              changeType === 'negative' ? 'text-red-600' : 'text-slate-500'
            }`}>
              {changeType === 'positive' ? <ArrowUpRight className="w-4 h-4 mr-1" /> : 
               changeType === 'negative' ? <ArrowDownRight className="w-4 h-4 mr-1" /> : null}
              {change}
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs" style={{ color: theme.colors.textMuted }}>{subtitle}</p>}
      </div>
      {trend && (
        <div className="w-16 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={changeType === 'positive' ? theme.colors.success : theme.colors.error}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  </div>
);

// Activity Feed Component
const ActivityFeed = ({ activities = [] }) => (
  <div className="bg-white rounded-xl p-6 border" style={{ borderColor: theme.colors.border, boxShadow: theme.shadows.sm }}>
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold" style={{ color: theme.colors.textDark }}>Recent Activity</h3>
      <button className="text-sm font-medium hover:underline" style={{ color: theme.colors.primary }}>View All</button>
    </div>
    <div className="space-y-3">
      {activities.length > 0 ? activities.map((activity, index) => (
        <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
            activity.type === 'sale' ? 'bg-emerald-500' :
            activity.type === 'visitor' ? 'bg-blue-500' :
            activity.type === 'lead' ? 'bg-purple-500' : 'bg-slate-500'
          }`}>
            {activity.type === 'sale' ? '$' : activity.type === 'visitor' ? '👁' : activity.type === 'lead' ? '📧' : '📊'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: theme.colors.textDark }}>{activity.message}</p>
            <p className="text-xs" style={{ color: theme.colors.textMuted }}>{activity.time}</p>
          </div>
        </div>
      )) : (
        <div className="text-center py-8">
          <Activity className="w-12 h-12 mx-auto mb-3" style={{ color: theme.colors.textMuted }} />
          <p className="text-sm" style={{ color: theme.colors.textLight }}>No recent activity</p>
          <p className="text-xs" style={{ color: theme.colors.textMuted }}>Activity will appear here as your business grows</p>
        </div>
      )}
    </div>
  </div>
);

// Quick Actions Component
const QuickActions = ({ business, onAction }) => {
  const actions = [
    { 
      id: 'view-site', 
      label: 'View Live Site', 
      icon: Globe, 
      color: 'primary',
      href: business?.subdomain ? `/sites/${business.subdomain}` : '#'
    },
    { 
      id: 'promote', 
      label: 'Run Ads', 
      icon: Zap, 
      color: 'warning',
      description: 'AI will find customers'
    },
    { 
      id: 'optimize', 
      label: 'Optimize Site', 
      icon: Target, 
      color: 'success',
      description: 'Improve conversion'
    },
    { 
      id: 'analyze', 
      label: 'Growth Report', 
      icon: TrendingUp, 
      color: 'secondary',
      description: 'Weekly insights'
    }
  ];

  return (
    <div className="bg-white rounded-xl p-6 border" style={{ borderColor: theme.colors.border, boxShadow: theme.shadows.sm }}>
      <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.textDark }}>Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => action.href ? window.open(action.href, '_blank') : onAction?.(action.id)}
            className="p-4 rounded-lg border text-left hover:shadow-md transition-all group"
            style={{ borderColor: theme.colors.borderLight }}
          >
            <action.icon className={`w-6 h-6 mb-2 group-hover:scale-110 transition-transform ${
              action.color === 'primary' ? 'text-blue-600' :
              action.color === 'warning' ? 'text-amber-600' :
              action.color === 'success' ? 'text-emerald-600' :
              action.color === 'secondary' ? 'text-cyan-600' : 'text-slate-600'
            }`} />
            <div>
              <p className="font-medium text-sm" style={{ color: theme.colors.textDark }}>{action.label}</p>
              {action.description && (
                <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>{action.description}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// Revenue Chart Component with enhanced styling
const RevenueChart = ({ data = [], period = '7d' }) => {
  const defaultData = [
    { date: 'Mon', revenue: 0, visitors: 12 },
    { date: 'Tue', revenue: 0, visitors: 19 },
    { date: 'Wed', revenue: 297, visitors: 24 },
    { date: 'Thu', revenue: 0, visitors: 31 },
    { date: 'Fri', revenue: 594, visitors: 28 },
    { date: 'Sat', revenue: 297, visitors: 22 },
    { date: 'Sun', revenue: 0, visitors: 18 }
  ];

  const chartData = data.length > 0 ? data : defaultData;

  return (
    <div className="bg-white rounded-xl p-6 border" style={{ borderColor: theme.colors.border, boxShadow: theme.shadows.sm }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold" style={{ color: theme.colors.textDark }}>Revenue & Traffic</h3>
        <div className="flex items-center gap-2">
          <select 
            className="text-sm border rounded px-2 py-1"
            style={{ borderColor: theme.colors.border }}
            value={period}
          >
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
          </select>
        </div>
      </div>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <AreaChart data={chartData}>
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
              dataKey="date" 
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
  );
};

// Goal Progress Component
const GoalProgress = ({ goals = [] }) => {
  const defaultGoals = [
    { name: 'First Sale', target: 1, current: 0, unit: 'sale', deadline: '7 days left' },
    { name: 'Monthly Revenue', target: 1000, current: 891, unit: '$', deadline: '12 days left' },
    { name: 'Website Visitors', target: 100, current: 134, unit: 'visitors', deadline: 'Achieved!' }
  ];

  const displayGoals = goals.length > 0 ? goals : defaultGoals;

  return (
    <div className="bg-white rounded-xl p-6 border" style={{ borderColor: theme.colors.border, boxShadow: theme.shadows.sm }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: theme.colors.textDark }}>Goals & Milestones</h3>
        <Award className="w-5 h-5" style={{ color: theme.colors.warning }} />
      </div>
      <div className="space-y-4">
        {displayGoals.map((goal, index) => {
          const progress = Math.min((goal.current / goal.target) * 100, 100);
          const isAchieved = progress >= 100;
          
          return (
            <div key={index} className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.bgSecondary }}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm" style={{ color: theme.colors.textDark }}>{goal.name}</h4>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  isAchieved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                }`}>
                  {goal.deadline}
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: theme.colors.textMuted }}>
                  {goal.current} / {goal.target} {goal.unit}
                </span>
                <span className="text-xs font-medium" style={{ color: theme.colors.textDark }}>
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    isAchieved ? 'bg-emerald-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// AI Insights Component
const AIInsights = ({ insights = [] }) => {
  const defaultInsights = [
    {
      type: 'opportunity',
      title: 'Peak Traffic Window',
      message: 'Your visitors are most active between 2-4 PM. Consider scheduling social posts during this time.',
      priority: 'high',
      action: 'Schedule Posts'
    },
    {
      type: 'improvement',
      title: 'Conversion Optimization',
      message: 'Adding customer testimonials to your homepage could increase conversions by 23%.',
      priority: 'medium',
      action: 'Add Testimonials'
    },
    {
      type: 'achievement',
      title: 'Milestone Reached',
      message: 'Congratulations! You\'ve exceeded your visitor goal for this week.',
      priority: 'low',
      action: 'View Analytics'
    }
  ];

  const displayInsights = insights.length > 0 ? insights : defaultInsights;

  return (
    <div className="bg-white rounded-xl p-6 border" style={{ borderColor: theme.colors.border, boxShadow: theme.shadows.sm }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: theme.colors.textDark }}>AI Insights</h3>
        <Sparkles className="w-5 h-5" style={{ color: theme.colors.warning }} />
      </div>
      <div className="space-y-3">
        {displayInsights.map((insight, index) => (
          <div key={index} className="flex items-start gap-3 p-4 rounded-lg hover:bg-slate-50 transition-colors">
            <div className={`w-2 h-2 rounded-full mt-2 ${
              insight.priority === 'high' ? 'bg-red-500' :
              insight.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
            }`}></div>
            <div className="flex-1">
              <h4 className="font-medium text-sm mb-1" style={{ color: theme.colors.textDark }}>{insight.title}</h4>
              <p className="text-sm mb-2" style={{ color: theme.colors.textLight }}>{insight.message}</p>
              <button className="text-xs font-medium hover:underline" style={{ color: theme.colors.primary }}>
                {insight.action} →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Dashboard Component
const LaunchflyDashboardV2 = ({ session, business, onPhoneCapture, onStepComplete }) => {
  // State Management
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);
  
  // Business data with fallbacks
  const businessData = useMemo(() => ({
    name: business?.name || business?.business_data?.businessName || 'Your Business',
    subdomain: business?.subdomain || 'your-business',
    domain: `${business?.subdomain || 'your-business'}.launchfly.ai`,
    totalRevenue: business?.total_revenue || 891,
    views: business?.views || 134,
    salesCount: 3,
    conversionRate: business?.views ? ((3 / business.views) * 100).toFixed(1) : '2.2',
    lastSaleDate: business?.last_sale_date || null,
    firstSaleDate: business?.first_sale_date || null,
    launchDate: business?.launch_date || new Date().toISOString(),
    ...business?.business_data
  }), [business]);

  // Sample data - in a real app, this would come from your API
  const [dashboardData, setDashboardData] = useState({
    todayRevenue: 297,
    todayVisitors: 24,
    weekRevenue: 1188,
    monthRevenue: 2940,
    conversionRate: businessData.conversionRate,
    activities: [
      { type: 'sale', message: 'New sale: Premium Package ($297)', time: '2 hours ago' },
      { type: 'visitor', message: '15 visitors from social media', time: '3 hours ago' },
      { type: 'lead', message: 'New email subscriber', time: '4 hours ago' }
    ]
  });

  // Effects
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Handlers
  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleQuickAction = (actionId) => {
    console.log('Quick action:', actionId);
    // Handle quick actions
  };

  // Calculate key metrics with trends
  const revenueMetrics = {
    today: { value: `$${dashboardData.todayRevenue}`, change: '+23%', changeType: 'positive' },
    week: { value: `$${dashboardData.weekRevenue}`, change: '+15%', changeType: 'positive' },
    month: { value: `$${dashboardData.monthRevenue}`, change: '+45%', changeType: 'positive' },
  };

  const trafficMetrics = {
    today: { value: dashboardData.todayVisitors.toString(), change: '+8%', changeType: 'positive' },
    week: { value: businessData.views.toString(), change: '+12%', changeType: 'positive' },
    conversion: { value: `${businessData.conversionRate}%`, change: '+0.3%', changeType: 'positive' },
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.bgSecondary }}>
      {/* Enhanced Header */}
      <header className="bg-white border-b sticky top-0 z-50" style={{ borderColor: theme.colors.border }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Business Name */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Rocket className="w-8 h-8" style={{ color: theme.colors.primary }} />
                <span className="text-xl font-bold" style={{ color: theme.colors.textDark }}>Launchfly</span>
              </div>
              <div className="hidden md:block w-px h-6 bg-slate-300"></div>
              <div className="hidden md:block">
                <h1 className="font-semibold" style={{ color: theme.colors.textDark }}>{businessData.name}</h1>
                <p className="text-sm" style={{ color: theme.colors.textMuted }}>{businessData.domain}</p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-4">
              <div className="hidden lg:flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span style={{ color: theme.colors.textMuted }}>Live</span>
                </div>
                <div style={{ color: theme.colors.textMuted }}>
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <button
                onClick={handleRefresh}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                disabled={refreshing}
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} style={{ color: theme.colors.textMuted }} />
              </button>
              <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <Bell className="w-5 h-5" style={{ color: theme.colors.textMuted }} />
              </button>
              <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <Settings className="w-5 h-5" style={{ color: theme.colors.textMuted }} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Today's Revenue"
            value={revenueMetrics.today.value}
            change={revenueMetrics.today.change}
            changeType={revenueMetrics.today.changeType}
            icon={DollarSign}
            subtitle="vs. yesterday"
          />
          <MetricCard
            title="Total Visitors"
            value={trafficMetrics.week.value}
            change={trafficMetrics.week.change}
            changeType={trafficMetrics.week.changeType}
            icon={Users}
            subtitle="this week"
          />
          <MetricCard
            title="Conversion Rate"
            value={trafficMetrics.conversion.value}
            change={trafficMetrics.conversion.change}
            changeType={trafficMetrics.conversion.changeType}
            icon={Target}
            subtitle="visitors to sales"
          />
          <MetricCard
            title="Website Views"
            value={trafficMetrics.today.value}
            change={trafficMetrics.today.change}
            changeType={trafficMetrics.today.changeType}
            icon={Eye}
            subtitle="today"
          />
        </div>

        {/* Charts and Insights Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <RevenueChart period={selectedPeriod} />
          </div>
          <div>
            <QuickActions business={business} onAction={handleQuickAction} />
          </div>
        </div>

        {/* Goals and Activity Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <GoalProgress />
          <ActivityFeed activities={dashboardData.activities} />
        </div>

        {/* Enhanced Growth Insights */}
        <div className="mb-8">
          <GrowthInsightsV2 businessData={businessData} theme={theme} />
        </div>

        {/* AI Insights */}
        <div className="mb-8">
          <AIInsights />
        </div>

        {/* Business Overview Card */}
        <div className="bg-white rounded-xl p-6 border" style={{ borderColor: theme.colors.border, boxShadow: theme.shadows.sm }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.textDark }}>Business Overview</h3>
            <a 
              href={`/sites/${business?.subdomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium hover:underline"
              style={{ color: theme.colors.primary }}
            >
              View Live Site <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.bgTertiary }}>
              <h4 className="font-medium mb-2" style={{ color: theme.colors.textDark }}>Business Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: theme.colors.textMuted }}>Launch Date:</span>
                  <span style={{ color: theme.colors.textDark }}>
                    {new Date(businessData.launchDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: theme.colors.textMuted }}>Total Revenue:</span>
                  <span style={{ color: theme.colors.success }} className="font-medium">
                    ${businessData.totalRevenue}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: theme.colors.textMuted }}>Total Sales:</span>
                  <span style={{ color: theme.colors.textDark }}>{businessData.salesCount}</span>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.bgTertiary }}>
              <h4 className="font-medium mb-2" style={{ color: theme.colors.textDark }}>Performance</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: theme.colors.textMuted }}>Avg. Daily Visitors:</span>
                  <span style={{ color: theme.colors.textDark }}>19</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: theme.colors.textMuted }}>Best Day:</span>
                  <span style={{ color: theme.colors.textDark }}>Friday</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: theme.colors.textMuted }}>Growth Rate:</span>
                  <span style={{ color: theme.colors.success }} className="font-medium">+23%</span>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.bgTertiary }}>
              <h4 className="font-medium mb-2" style={{ color: theme.colors.textDark }}>Next Steps</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 mt-0.5" style={{ color: theme.colors.success }} />
                  <span style={{ color: theme.colors.textDark }}>Business launched</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 mt-0.5" style={{ color: theme.colors.success }} />
                  <span style={{ color: theme.colors.textDark }}>First sale achieved</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5" style={{ color: theme.colors.warning }} />
                  <span style={{ color: theme.colors.textDark }}>Scale marketing</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LaunchflyDashboardV2;
