import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { 
  ChevronRight, Globe, DollarSign, Users, Rocket, Check, TrendingUp, 
  Sparkles, Clock, X, AlertCircle, MessageSquare, Eye, ShoppingCart,
  Target, Zap, Star, Activity, Calendar, Bell, Settings, 
  ArrowUp, ArrowDown, Play, Pause, RefreshCw, ExternalLink,
  Phone, Mail, MapPin, Heart, Share2, Award, Lightbulb
} from 'lucide-react';

// Enhanced theme with more colors and styling options
const theme = {
  colors: {
    primary: '#007BFF',
    primaryDark: '#0056b3',
    primaryLight: '#E7F3FF',
    secondary: '#00B8D9',
    secondaryLight: '#E0F7FA',
    success: '#28a745',
    successLight: '#E8F5E8',
    warning: '#FFC107',
    warningLight: '#FFF8E1',
    error: '#dc3545',
    errorLight: '#FFEBEE',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    textLight: '#8B95A7',
    bgLight: '#F8FAFC',
    bgWhite: '#ffffff',
    bgGray: '#F1F5F9',
    borderLight: '#E2E8F0',
    borderMedium: '#CBD5E1',
    purple: '#8B5CF6',
    purpleLight: '#F3F0FF',
    orange: '#F97316',
    orangeLight: '#FFF7ED',
    pink: '#EC4899',
    pinkLight: '#FDF2F8',
    indigo: '#6366F1',
    indigoLight: '#EEF2FF',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  gradients: {
    primary: 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)',
    success: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
    purple: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)',
    orange: 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)',
    pink: 'linear-gradient(135deg, #EC4899 0%, #F472B6 100%)',
  }
};

// Mock data generators for a more realistic dashboard
const generateRevenueData = () => {
  const days = 30;
  const data = [];
  let revenue = 1000;
  
  for (let i = 0; i < days; i++) {
    revenue += Math.random() * 500 - 100;
    revenue = Math.max(0, revenue);
    data.push({
      day: i + 1,
      revenue: Math.round(revenue),
      visitors: Math.round(50 + Math.random() * 100),
      conversions: Math.round(Math.random() * 10),
    });
  }
  return data;
};

const generateTrafficSources = () => [
  { name: 'Organic Search', value: 45, color: theme.colors.primary },
  { name: 'Social Media', value: 25, color: theme.colors.purple },
  { name: 'Direct', value: 20, color: theme.colors.success },
  { name: 'Referrals', value: 10, color: theme.colors.orange }
];

// Enhanced Loading State Component
const GenerationLoader = ({ progress, stageMessage }) => {
  const steps = useMemo(() => [
    { id: 'analyzing', text: 'Analyzing your skills & goals', icon: Target },
    { id: 'researching', text: 'Researching profitable niches', icon: TrendingUp },
    { id: 'building', text: 'Building your business & website', icon: Rocket },
    { id: 'finalizing', text: 'Finalizing marketing campaigns', icon: Sparkles },
  ], []);

  const currentStepIndex = useMemo(() => {
    const stageOrder = ['analyzing', 'researching', 'building', 'finalizing', 'complete'];
    const index = stageOrder.indexOf(stageMessage);
    return index;
  }, [stageMessage]);

  const completedPercentage = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto p-8">
        <div className="text-center mb-8">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div 
              className="absolute inset-0 rounded-full border-4 border-blue-600 transition-all duration-500"
              style={{
                clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos(2 * Math.PI * completedPercentage / 100 - Math.PI/2)}% ${50 + 50 * Math.sin(2 * Math.PI * completedPercentage / 100 - Math.PI/2)}%, 50% 50%)`
              }}
            ></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-blue-600 animate-pulse" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Creating Your Business</h2>
          <p className="text-gray-600 mb-6">Our AI is crafting your personalized business. This takes about 30 seconds.</p>
          
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${completedPercentage}%` }}
            ></div>
          </div>
          
          <p className="text-sm font-medium text-blue-600">{Math.round(completedPercentage)}% Complete</p>
        </div>

        <div className="space-y-4">
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;
            const Icon = step.icon;
            
            return (
              <div
                key={step.id}
                className={`flex items-center p-4 rounded-lg transition-all duration-300 ${
                  isCompleted ? 'bg-green-50 border border-green-200' :
                  isActive ? 'bg-blue-50 border border-blue-200' :
                  'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${
                  isCompleted ? 'bg-green-500' :
                  isActive ? 'bg-blue-500' :
                  'bg-gray-300'
                }`}>
                  {isCompleted ? (
                    <Check className="w-5 h-5 text-white" />
                  ) : isActive ? (
                    <Icon className="w-5 h-5 text-white animate-pulse" />
                  ) : (
                    <Icon className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${
                    isCompleted ? 'text-green-800' :
                    isActive ? 'text-blue-800' :
                    'text-gray-500'
                  }`}>
                    {step.text}
                  </p>
                  {isActive && (
                    <p className="text-sm text-blue-600 mt-1">In progress...</p>
                  )}
                  {isCompleted && (
                    <p className="text-sm text-green-600 mt-1">Completed ✓</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Launchfly users earned $47,234 today</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced Metric Card Component
const MetricCard = ({ 
  title, 
  value, 
  change, 
  changeType = 'positive', 
  icon: Icon, 
  color = theme.colors.primary,
  trend,
  subtitle,
  onClick 
}) => {
  const isPositive = changeType === 'positive';
  const changeColor = isPositive ? theme.colors.success : theme.colors.error;
  
  return (
    <div 
      className={`bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer border border-gray-100 ${onClick ? 'hover:scale-105' : ''}`}
      onClick={onClick}
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="w-5 h-5" style={{ color }} />
            <h3 className="text-sm font-medium text-gray-600">{title}</h3>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-500">{subtitle}</p>
            )}
            {change && (
              <div className="flex items-center gap-1">
                {isPositive ? (
                  <ArrowUp className="w-4 h-4" style={{ color: changeColor }} />
                ) : (
                  <ArrowDown className="w-4 h-4" style={{ color: changeColor }} />
                )}
                <span className="text-sm font-medium" style={{ color: changeColor }}>
                  {change}
                </span>
                <span className="text-xs text-gray-500">vs last week</span>
              </div>
            )}
          </div>
        </div>
        {trend && (
          <div className="w-16 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={color} 
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
};

// Business Health Score Component
const BusinessHealthScore = ({ score = 85 }) => {
  const getHealthColor = (score) => {
    if (score >= 80) return theme.colors.success;
    if (score >= 60) return theme.colors.warning;
    return theme.colors.error;
  };
  
  const healthColor = getHealthColor(score);
  
  return (
    <div className="bg-white rounded-xl p-6 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Business Health Score</h3>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: healthColor }}></div>
          <span className="text-sm text-gray-600">Live</span>
        </div>
      </div>
      
      <div className="relative w-32 h-32 mx-auto mb-4">
        <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-gray-200"
            stroke="currentColor"
            strokeWidth="3"
            fill="transparent"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            stroke={healthColor}
            strokeWidth="3"
            fill="transparent"
            strokeDasharray={`${score}, 100`}
            strokeLinecap="round"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold" style={{ color: healthColor }}>{score}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Website Performance</span>
          <span className="text-sm font-medium text-green-600">Excellent</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Conversion Rate</span>
          <span className="text-sm font-medium text-green-600">Above Average</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Customer Satisfaction</span>
          <span className="text-sm font-medium text-yellow-600">Good</span>
        </div>
      </div>
    </div>
  );
};

// Quick Actions Component
const QuickActions = ({ onAction }) => {
  const actions = [
    { id: 'optimize-seo', title: 'Optimize SEO', icon: Target, color: theme.colors.purple, description: 'Boost search rankings' },
    { id: 'run-ads', title: 'Run Ads', icon: Zap, color: theme.colors.orange, description: 'Start advertising campaign' },
    { id: 'email-campaign', title: 'Email Campaign', icon: Mail, color: theme.colors.pink, description: 'Send to subscribers' },
    { id: 'social-post', title: 'Social Media', icon: Share2, color: theme.colors.indigo, description: 'Share on platforms' },
  ];
  
  return (
    <div className="bg-white rounded-xl p-6 shadow-md">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            className="flex flex-col items-center p-4 rounded-lg border-2 border-gray-100 hover:border-gray-200 transition-all duration-200 hover:scale-105"
            style={{ '--hover-bg': `${action.color}15` }}
            onMouseEnter={(e) => e.target.style.backgroundColor = `${action.color}15`}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <action.icon className="w-6 h-6 mb-2" style={{ color: action.color }} />
            <span className="text-sm font-medium text-gray-900">{action.title}</span>
            <span className="text-xs text-gray-500 text-center">{action.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// Recent Activity Feed
const ActivityFeed = ({ activities = [] }) => {
  const defaultActivities = [
    { id: 1, type: 'visitor', message: 'New visitor from Google', time: '2 min ago', icon: Eye, color: theme.colors.primary },
    { id: 2, type: 'sale', message: 'John purchased Premium Package', time: '1 hour ago', icon: ShoppingCart, color: theme.colors.success },
    { id: 3, type: 'lead', message: 'Sarah subscribed to newsletter', time: '3 hours ago', icon: Mail, color: theme.colors.purple },
    { id: 4, type: 'traffic', message: 'Traffic spike detected', time: '5 hours ago', icon: TrendingUp, color: theme.colors.orange },
  ];
  
  const displayActivities = activities.length > 0 ? activities : defaultActivities;
  
  return (
    <div className="bg-white rounded-xl p-6 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
        <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">View All</button>
      </div>
      
      <div className="space-y-4">
        {displayActivities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${activity.color}20` }}
            >
              <activity.icon className="w-4 h-4" style={{ color: activity.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{activity.message}</p>
              <p className="text-xs text-gray-500">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// AI Insights Component
const AIInsights = ({ insights = [] }) => {
  const defaultInsights = [
    {
      id: 1,
      title: "Traffic Optimization",
      message: "Your conversion rate is 23% higher on mobile. Consider mobile-first design improvements.",
      type: "opportunity",
      priority: "high",
      action: "Optimize Mobile"
    },
    {
      id: 2,
      title: "Revenue Opportunity", 
      message: "Users who view your About page are 2x more likely to purchase. Add more social proof.",
      type: "insight",
      priority: "medium",
      action: "Add Testimonials"
    },
    {
      id: 3,
      title: "Customer Behavior",
      message: "Peak traffic is between 2-4 PM. Schedule your social posts during this window.",
      type: "tip",
      priority: "low",
      action: "Schedule Posts"
    }
  ];
  
  const displayInsights = insights.length > 0 ? insights : defaultInsights;
  
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return theme.colors.error;
      case 'medium': return theme.colors.warning;
      case 'low': return theme.colors.success;
      default: return theme.colors.primary;
    }
  };
  
  return (
    <div className="bg-white rounded-xl p-6 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-bold text-gray-900">AI Insights</h3>
        </div>
        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
          {displayInsights.length} new
        </span>
      </div>
      
      <div className="space-y-4">
        {displayInsights.map((insight) => (
          <div key={insight.id} className="border border-gray-100 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-medium text-gray-900">{insight.title}</h4>
              <span 
                className="text-xs px-2 py-1 rounded-full"
                style={{ 
                  backgroundColor: `${getPriorityColor(insight.priority)}20`,
                  color: getPriorityColor(insight.priority)
                }}
              >
                {insight.priority}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-3">{insight.message}</p>
            <button className="text-sm font-medium text-blue-600 hover:text-blue-800">
              {insight.action} →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Notifications Component
const NotificationCenter = ({ notifications = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const defaultNotifications = [
    {
      id: 1,
      type: 'visitor',
      title: 'New Visitor Alert',
      message: 'Someone from San Francisco just visited your website',
      timestamp: '2 minutes ago',
      unread: true,
      icon: Eye,
      color: theme.colors.primary
    },
    {
      id: 2,
      type: 'opportunity',
      title: 'Revenue Opportunity',
      message: 'Your About page has high engagement. Add a CTA button.',
      timestamp: '1 hour ago',
      unread: true,
      icon: Lightbulb,
      color: theme.colors.warning
    },
    {
      id: 3,
      type: 'milestone',
      title: 'Milestone Reached!',
      message: 'You\'ve reached 100 website visitors this week.',
      timestamp: '3 hours ago',
      unread: false,
      icon: Award,
      color: theme.colors.success
    }
  ];
  
  const displayNotifications = notifications.length > 0 ? notifications : defaultNotifications;
  const unreadCount = displayNotifications.filter(n => n.unread).length;
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
            {unreadCount}
          </span>
        )}
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 top-12 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Notifications</h3>
                <button className="text-sm text-blue-600 hover:text-blue-800">
                  Mark all read
                </button>
              </div>
            </div>
            
            <div className="divide-y divide-gray-100">
              {displayNotifications.map((notification) => (
                <div 
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${notification.unread ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${notification.color}20` }}
                    >
                      <notification.icon className="w-4 h-4" style={{ color: notification.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{notification.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-2">{notification.timestamp}</p>
                    </div>
                    {notification.unread && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 border-t border-gray-200">
              <button className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium">
                View All Notifications
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Success Onboarding Component
const OnboardingSuccess = ({ businessData, onGetStarted }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🎉 Your Business is Ready!
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            <strong>{businessData?.businessName || 'Your Business'}</strong> has been created successfully.
          </p>
          <p className="text-gray-500">
            Everything is set up and ready to start making money.
          </p>
        </div>

        {/* Business Preview Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-200">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-2xl font-bold">
              {businessData?.businessName?.charAt(0) || 'B'}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-1">
                {businessData?.businessName || 'Your Business'}
              </h3>
              <p className="text-gray-600 mb-3">
                {businessData?.tagline || 'Transform your passion into profit'}
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Globe className="w-4 h-4" />
                  <span>Website Ready</span>
                </div>
                <div className="flex items-center gap-1">
                  <ShoppingCart className="w-4 h-4" />
                  <span>Products Listed</span>
                </div>
                <div className="flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  <span>Marketing Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
            <div className="text-2xl font-bold text-green-600">$2K-5K</div>
            <div className="text-sm text-gray-600">Est. Monthly Revenue</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
            <div className="text-2xl font-bold text-blue-600">87%</div>
            <div className="text-sm text-gray-600">Success Probability</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
            <div className="text-2xl font-bold text-purple-600">24/7</div>
            <div className="text-sm text-gray-600">AI Marketing</div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            <Rocket className="w-5 h-5" />
            View My Dashboard
          </button>
          <p className="text-sm text-gray-500 mt-4">
            Your business is already optimized and ready to make sales
          </p>
        </div>
      </div>
    </div>
  );
};

// Main Dashboard Component
const LaunchflyDashboardV2 = ({ session, business, onPhoneCapture, onStepComplete }) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('7d');
  const [revenueData, setRevenueData] = useState([]);
  const [trafficSources, setTrafficSources] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  
  useEffect(() => {
    setRevenueData(generateRevenueData());
    setTrafficSources(generateTrafficSources());
    setIsLive(business?.status === 'ready');
    
    // Check if user has seen onboarding before
    const onboardingSeen = localStorage.getItem(`onboarding-seen-${business?.id}`);
    if (onboardingSeen) {
      setShowOnboarding(false);
      setHasSeenOnboarding(true);
    }
  }, [business]);
  
  // Handle loading/generation states
  const stage = session?.stage || 'pending';
  const showBusiness = business?.status === 'ready' && stage === 'complete';
  
  // If business is still being generated, show loading screen
  if (!showBusiness) {
    const stageMessages = {
      analyzing: "analyzing",
      researching: "researching", 
      building: "building",
      finalizing: "finalizing",
      complete: "complete",
      error: "error"
    };
    
    return <GenerationLoader stageMessage={stageMessages[stage] || 'analyzing'} />;
  }
  
  // Show onboarding success screen first time after generation
  if (showBusiness && showOnboarding && !hasSeenOnboarding) {
    return (
      <OnboardingSuccess 
        businessData={business?.business_data}
        onGetStarted={() => {
          setShowOnboarding(false);
          setHasSeenOnboarding(true);
          localStorage.setItem(`onboarding-seen-${business?.id}`, 'true');
        }}
      />
    );
  }
  
  // Calculate metrics
  const businessData = business?.business_data || {};
  const totalRevenue = business?.total_revenue || 0;
  const todayRevenue = Math.round(Math.random() * 500 + 100);
  const monthlyVisitors = Math.round(Math.random() * 5000 + 1000);
  const conversionRate = ((Math.random() * 3) + 1).toFixed(1);
  const customerSatisfaction = Math.round(Math.random() * 20 + 80);
  
  const metrics = [
    {
      title: 'Today\'s Revenue',
      value: `$${todayRevenue.toLocaleString()}`,
      change: '+12.5%',
      changeType: 'positive',
      icon: DollarSign,
      color: theme.colors.success,
      trend: revenueData.slice(-7).map(d => ({ value: d.revenue }))
    },
    {
      title: 'Monthly Visitors',
      value: monthlyVisitors.toLocaleString(),
      change: '+8.2%',
      changeType: 'positive',
      icon: Eye,
      color: theme.colors.primary,
      trend: revenueData.slice(-7).map(d => ({ value: d.visitors }))
    },
    {
      title: 'Conversion Rate',
      value: `${conversionRate}%`,
      change: '+0.3%',
      changeType: 'positive',
      icon: Target,
      color: theme.colors.purple,
      subtitle: 'Above industry avg'
    },
    {
      title: 'Active Customers',
      value: '47',
      change: '+5',
      changeType: 'positive',
      icon: Users,
      color: theme.colors.orange,
      subtitle: '2 new this week'
    }
  ];
  
  const handleQuickAction = (actionId) => {
    console.log('Quick action:', actionId);
    // Implement quick actions
  };
  
  const userName = businessData?.ownerName || session?.user_name || 'Entrepreneur';
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚀</span>
                <span className="text-xl font-bold text-gray-900">Launchfly</span>
              </div>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className="text-sm font-medium text-gray-700">
                  {businessData?.businessName || 'Your Business'}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${isLive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {isLive ? 'LIVE' : 'SETUP'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-sm bg-green-50 text-green-700 px-3 py-1 rounded-full">
                <Award className="w-4 h-4" />
                <span>Revenue Goal: 67% complete</span>
              </div>
              
              <NotificationCenter />
              
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Welcome back, {userName}!</span>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Settings</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Top Metrics Row */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Business Overview</h1>
              <div className="flex items-center gap-2">
                <select 
                  value={selectedTimeframe} 
                  onChange={(e) => setSelectedTimeframe(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
                <button className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {metrics.map((metric, index) => (
                <MetricCard key={index} {...metric} />
              ))}
            </div>
          </div>

          {/* Charts and Analytics Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Revenue Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-md">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Revenue Trend</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Revenue</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Visitors</span>
                  </div>
                </div>
              </div>
              
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.colors.primary} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={theme.colors.primary} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="visitorsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.colors.purple} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={theme.colors.purple} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" stroke="#666" fontSize={12} />
                    <YAxis stroke="#666" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke={theme.colors.primary} 
                      fillOpacity={1}
                      fill="url(#revenueGradient)" 
                      strokeWidth={3}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="visitors" 
                      stroke={theme.colors.purple} 
                      fillOpacity={1}
                      fill="url(#visitorsGradient)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Business Health Score */}
            <BusinessHealthScore />
          </div>

          {/* Secondary Row - Traffic Sources & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Traffic Sources */}
            <div className="bg-white rounded-xl p-6 shadow-md">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Traffic Sources</h3>
              <div className="flex items-center justify-center mb-6">
                <div className="w-64 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={trafficSources}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {trafficSources.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-3">
                {trafficSources.map((source, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: source.color }}
                      ></div>
                      <span className="text-sm font-medium text-gray-700">{source.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{source.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <QuickActions onAction={handleQuickAction} />
          </div>

          {/* Bottom Row - Activity Feed & AI Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ActivityFeed />
            <AIInsights />
          </div>

          {/* Business Details - Redesigned */}
          <div className="bg-white rounded-xl p-6 shadow-md">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Business Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Website Card */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-gray-900">Website</h4>
                </div>
                <p className="font-medium text-gray-900 mb-1">{businessData?.businessName || 'Your Business'}</p>
                <a 
                  href={`https://${business?.subdomain}.launchfly.ai`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  {business?.subdomain}.launchfly.ai
                  <ExternalLink className="w-3 h-3" />
                </a>
                <p className="text-sm text-gray-600 mt-2">{businessData?.tagline || 'Transform your passion into profit'}</p>
              </div>

              {/* Product Card */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ShoppingCart className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-gray-900">Top Product</h4>
                </div>
                {businessData.products && businessData.products.length > 0 ? (
                  <>
                    <p className="font-medium text-gray-900">{businessData.products[0].name}</p>
                    <p className="text-lg font-bold text-green-600 mb-2">{businessData.products[0].price}</p>
                    <p className="text-sm text-gray-600">{businessData.products[0].description}</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-gray-900">Premium Service</p>
                    <p className="text-lg font-bold text-green-600 mb-2">$297/month</p>
                    <p className="text-sm text-gray-600">Professional service offering</p>
                  </>
                )}
              </div>

              {/* Customer Card */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-purple-600" />
                  <h4 className="font-semibold text-gray-900">Target Customer</h4>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  {businessData.targetCustomers && businessData.targetCustomers.length > 0 
                    ? businessData.targetCustomers[0] 
                    : "Professional business owners and entrepreneurs"}
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Satisfaction: {customerSatisfaction}%</span>
                  <span>Retention: 94%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LaunchflyDashboardV2;
