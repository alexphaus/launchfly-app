// src/components/ai-activity/ActivityStats.js
import { 
  EnvelopeIcon, 
  UserGroupIcon, 
  CalendarIcon, 
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

export default function ActivityStats({ stats }) {
  const statCards = [
    {
      title: 'Total Activities',
      value: stats.totalActivities,
      icon: ChartBarIcon,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      change: '+12%',
      changeType: 'positive'
    },
    {
      title: 'Prospects Found',
      value: stats.prospectsFound,
      icon: UserGroupIcon,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      change: '+28%',
      changeType: 'positive'
    },
    {
      title: 'Emails Sent',
      value: stats.emailsSent,
      icon: EnvelopeIcon,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      change: '+15%',
      changeType: 'positive'
    },
    {
      title: 'Response Rate',
      value: `${stats.responseRate}%`,
      icon: ArrowTrendingUpIcon,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      change: '+5%',
      changeType: 'positive'
    },
    {
      title: 'Meetings Booked',
      value: stats.meetingsBooked,
      icon: CalendarIcon,
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50',
      change: '+2',
      changeType: 'positive'
    },
    {
      title: 'Avg Response Time',
      value: '2.4h',
      icon: ClockIcon,
      color: 'bg-pink-500',
      bgColor: 'bg-pink-50',
      change: '-30min',
      changeType: 'positive'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat, index) => (
          <div 
            key={index}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color.replace('bg-', 'text-')}`} />
              </div>
              {stat.change && (
                <span className={`text-xs font-medium ${
                  stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.change}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.title}</p>
          </div>
        ))}
      </div>

      {/* Performance Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Performance Overview</h3>
        
        <div className="space-y-4">
          {/* Campaign Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-2"></div>
              <span className="text-sm font-medium text-gray-700">Campaign Status</span>
            </div>
            <span className="text-sm font-semibold text-green-600">Active</span>
          </div>

          {/* Success Rate Bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">Overall Success Rate</span>
              <span className="text-sm font-medium text-gray-900">73%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: '73%' }}
              ></div>
            </div>
          </div>

          {/* Quick Insights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-900">Best Performing</p>
              <p className="text-xs text-blue-700 mt-1">
                Tech industry prospects showing 32% higher engagement
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-sm font-medium text-green-900">Optimization Tip</p>
              <p className="text-xs text-green-700 mt-1">
                Morning emails getting 45% better open rates
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}