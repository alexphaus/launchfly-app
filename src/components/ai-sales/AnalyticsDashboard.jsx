/**
 * @fileoverview Analytics dashboard for AI Sales performance monitoring
 * Comprehensive analytics visualization with real-time metrics
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  DollarSign,
  Target,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Calendar,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';

/**
 * Main analytics dashboard component
 * @param {Object} props - Component props
 * @param {string} props.businessId - Business ID
 * @returns {JSX.Element}
 */
const AnalyticsDashboard = ({ businessId }) => {
  const [timeRange, setTimeRange] = useState('7d');
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/analytics/performance?businessId=${businessId}&timeRange=${timeRange}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial load and auto-refresh
  useEffect(() => {
    fetchAnalytics();

    if (autoRefresh) {
      const interval = setInterval(fetchAnalytics, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [businessId, timeRange, autoRefresh]);

  const timeRangeOptions = [
    { value: '1d', label: 'Last 24h' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' }
  ];

  if (loading && !metrics) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={fetchAnalytics} />;
  }

  if (!metrics) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Sales Analytics</h2>
          <p className="text-gray-600">
            Performance insights for {businessId} • {timeRange === '1d' ? 'Last 24 hours' : timeRange === '7d' ? 'Last 7 days' : 'Last 30 days'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {timeRangeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-lg transition-colors ${
              autoRefresh 
                ? 'bg-green-100 text-green-700 border border-green-200' 
                : 'bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          </button>

          {/* Manual Refresh */}
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Visitors"
          value={metrics.summary.totalVisitors.toLocaleString()}
          change={12.5}
          icon={Users}
          color="blue"
        />
        <MetricCard
          title="Conversions"
          value={metrics.summary.totalConversions}
          change={8.3}
          icon={Target}
          color="green"
        />
        <MetricCard
          title="Revenue"
          value={`$${metrics.summary.totalRevenue.toLocaleString()}`}
          change={15.2}
          icon={DollarSign}
          color="purple"
        />
        <MetricCard
          title="Conversion Rate"
          value={`${(metrics.summary.conversionRate * 100).toFixed(1)}%`}
          change={-2.1}
          icon={TrendingUp}
          color="orange"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <ChartCard title="Revenue Over Time" icon={DollarSign}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.timeSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value) => [`$${value}`, 'Revenue']}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                dot={{ fill: '#8b5cf6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Conversion Funnel */}
        <ChartCard title="Conversion Funnel" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={getFunnelData(metrics)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Performance */}
        <MetricsCard title="AI Performance" icon={Zap}>
          <div className="space-y-3">
            <MetricRow 
              label="Response Time" 
              value={`${metrics.metrics.aiResponseTime}ms`}
              status={metrics.metrics.aiResponseTime < 2000 ? 'good' : 'warning'}
            />
            <MetricRow 
              label="Accuracy Rate" 
              value={`${(metrics.metrics.aiAccuracyRate * 100).toFixed(1)}%`}
              status={metrics.metrics.aiAccuracyRate > 0.9 ? 'good' : 'warning'}
            />
            <MetricRow 
              label="Error Rate" 
              value={`${(metrics.metrics.errorRate * 100).toFixed(1)}%`}
              status={metrics.metrics.errorRate < 0.05 ? 'good' : 'warning'}
            />
          </div>
        </MetricsCard>

        {/* User Experience */}
        <MetricsCard title="User Experience" icon={Users}>
          <div className="space-y-3">
            <MetricRow 
              label="Satisfaction Score" 
              value={`${metrics.metrics.userSatisfaction}/5.0`}
              status={metrics.metrics.userSatisfaction > 4.0 ? 'good' : 'warning'}
            />
            <MetricRow 
              label="Chat Completion" 
              value={`${(metrics.metrics.chatCompletionRate * 100).toFixed(1)}%`}
              status={metrics.metrics.chatCompletionRate > 0.7 ? 'good' : 'warning'}
            />
            <MetricRow 
              label="Avg Session Duration" 
              value={`${Math.floor(metrics.metrics.avgSessionDuration / 60)}m ${metrics.metrics.avgSessionDuration % 60}s`}
              status="neutral"
            />
          </div>
        </MetricsCard>

        {/* Sales Metrics */}
        <MetricsCard title="Sales Performance" icon={Target}>
          <div className="space-y-3">
            <MetricRow 
              label="Chat to Lead Rate" 
              value={`${(metrics.metrics.chatToLeadRate * 100).toFixed(1)}%`}
              status={metrics.metrics.chatToLeadRate > 0.3 ? 'good' : 'warning'}
            />
            <MetricRow 
              label="Chat to Sale Rate" 
              value={`${(metrics.metrics.chatToSaleRate * 100).toFixed(1)}%`}
              status={metrics.metrics.chatToSaleRate > 0.05 ? 'good' : 'warning'}
            />
            <MetricRow 
              label="Average Order Value" 
              value={`$${metrics.metrics.averageOrderValue.toFixed(2)}`}
              status="neutral"
            />
          </div>
        </MetricsCard>
      </div>

      {/* Experiments Section */}
      <ExperimentsSection experiments={metrics.experiments} />

      {/* Insights and Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightsCard insights={metrics.insights} />
        <RecommendationsCard recommendations={metrics.recommendations} />
      </div>
    </div>
  );
};

/**
 * Metric card component
 */
const MetricCard = ({ title, value, change, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600'
  };

  const isPositive = change > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-lg p-6"
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className={`flex items-center text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
          {Math.abs(change)}%
        </div>
      </div>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      <p className="text-gray-600 text-sm">{title}</p>
    </motion.div>
  );
};

/**
 * Chart card wrapper
 */
const ChartCard = ({ title, icon: Icon, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-xl shadow-lg p-6"
  >
    <div className="flex items-center mb-4">
      <Icon className="w-5 h-5 text-gray-600 mr-2" />
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
    </div>
    {children}
  </motion.div>
);

/**
 * Metrics card for grouped metrics
 */
const MetricsCard = ({ title, icon: Icon, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-xl shadow-lg p-6"
  >
    <div className="flex items-center mb-4">
      <Icon className="w-5 h-5 text-gray-600 mr-2" />
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
    </div>
    {children}
  </motion.div>
);

/**
 * Individual metric row
 */
const MetricRow = ({ label, value, status }) => {
  const statusColors = {
    good: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600',
    neutral: 'text-gray-600'
  };

  const StatusIcon = status === 'good' ? CheckCircle : status === 'warning' ? AlertCircle : null;

  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center">
        <span className={`font-semibold ${statusColors[status]}`}>{value}</span>
        {StatusIcon && <StatusIcon className={`w-4 h-4 ml-1 ${statusColors[status]}`} />}
      </div>
    </div>
  );
};

/**
 * Experiments section
 */
const ExperimentsSection = ({ experiments }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-xl shadow-lg p-6"
  >
    <h3 className="text-lg font-semibold text-gray-900 mb-4">A/B Test Results</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(experiments).map(([key, experiment]) => (
        <div key={key} className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900">{key.replace(/([A-Z])/g, ' $1').trim()}</h4>
            <span className={`px-2 py-1 text-xs rounded-full ${
              experiment.status === 'running' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {experiment.status}
            </span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Winner:</span>
              <span className="font-medium">{experiment.winner}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Confidence:</span>
              <span className="font-medium">{experiment.confidence}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Lift:</span>
              <span className="font-medium text-green-600">+{experiment.lift}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);

/**
 * Insights card
 */
const InsightsCard = ({ insights }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-xl shadow-lg p-6"
  >
    <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Insights</h3>
    <div className="space-y-4">
      {insights.map((insight, index) => (
        <div key={index} className={`p-4 rounded-lg border-l-4 ${
          insight.type === 'success' ? 'bg-green-50 border-green-400' :
          insight.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
          'bg-blue-50 border-blue-400'
        }`}>
          <h4 className="font-medium text-gray-900">{insight.title}</h4>
          <p className="text-sm text-gray-600 mt-1">{insight.message}</p>
          {insight.action && (
            <p className="text-sm font-medium text-blue-600 mt-2">{insight.action}</p>
          )}
        </div>
      ))}
    </div>
  </motion.div>
);

/**
 * Recommendations card
 */
const RecommendationsCard = ({ recommendations }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-xl shadow-lg p-6"
  >
    <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimization Recommendations</h3>
    <div className="space-y-4">
      {recommendations.map((rec, index) => (
        <div key={index} className="p-4 border rounded-lg">
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-medium text-gray-900">{rec.title}</h4>
            <span className={`px-2 py-1 text-xs rounded-full ${
              rec.priority === 'high' ? 'bg-red-100 text-red-800' :
              rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {rec.priority}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Expected: {rec.expectedImpact}</span>
            <span>Effort: {rec.effort}</span>
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);

/**
 * Loading skeleton
 */
const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
    <div className="grid grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-32 bg-gray-200 rounded animate-pulse"></div>
      ))}
    </div>
    <div className="grid grid-cols-2 gap-6">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="h-80 bg-gray-200 rounded animate-pulse"></div>
      ))}
    </div>
  </div>
);

/**
 * Error state
 */
const ErrorState = ({ error, onRetry }) => (
  <div className="text-center py-12">
    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
    <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load analytics</h3>
    <p className="text-gray-600 mb-4">{error}</p>
    <button
      onClick={onRetry}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
    >
      Try Again
    </button>
  </div>
);

/**
 * Empty state
 */
const EmptyState = () => (
  <div className="text-center py-12">
    <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
    <h3 className="text-lg font-medium text-gray-900 mb-2">No data available</h3>
    <p className="text-gray-600">Analytics data will appear once visitors start interacting with your AI agent.</p>
  </div>
);

/**
 * Get funnel data for chart
 */
function getFunnelData(metrics) {
  const { totalVisitors, summary } = metrics;
  const chatOpens = Math.floor(totalVisitors * metrics.metrics.chatOpenRate);
  
  return [
    { stage: 'Visitors', count: totalVisitors },
    { stage: 'Chat Opens', count: chatOpens },
    { stage: 'Engaged', count: Math.floor(chatOpens * 0.7) },
    { stage: 'Qualified', count: Math.floor(summary.totalConversions * 2) },
    { stage: 'Conversions', count: summary.totalConversions }
  ];
}

export default AnalyticsDashboard;