// src/components/AIAgentDashboard.js
/**
 * 24/7 AI Business Agent Dashboard
 * 
 * Shows:
 * - AI agent status and controls
 * - Recent optimizations and results
 * - Performance metrics and improvements
 * - AI insights and recommendations
 */

import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Play, 
  Pause, 
  Settings, 
  TrendingUp, 
  Brain, 
  Zap, 
  AlertTriangle,
  CheckCircle,
  Activity,
  Target,
  DollarSign,
  Users,
  BarChart3,
  Lightbulb,
  Refresh
} from 'lucide-react';

export default function AIAgentDashboard({ businessId, business, theme }) {
  const [agentData, setAgentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (businessId) {
      fetchAgentData();
    }
  }, [businessId]);

  const fetchAgentData = async () => {
    try {
      const response = await fetch(`/api/ai-agent?businessId=${businessId}`);
      const data = await response.json();
      setAgentData(data);
      setSettings(data.business?.settings || getDefaultSettings());
    } catch (error) {
      console.error('Error fetching AI agent data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultSettings = () => ({
    optimization_frequency: "hourly",
    auto_implement_changes: true,
    risk_tolerance: "medium",
    focus_areas: ["conversion", "email", "pricing", "traffic"],
    notification_preferences: {
      major_changes: true,
      daily_summary: true,
      weekly_report: true
    }
  });

  const handleAgentToggle = async () => {
    setActionLoading(true);
    try {
      const action = agentData?.business?.aiAgentEnabled ? 'disable' : 'enable';
      const response = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, action, settings })
      });
      
      const result = await response.json();
      if (result.success) {
        await fetchAgentData(); // Refresh data
      }
    } catch (error) {
      console.error('Error toggling AI agent:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualOptimization = async () => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, action: 'optimize_now' })
      });
      
      const result = await response.json();
      if (result.success) {
        // Refresh data after a short delay to show the new activity
        setTimeout(fetchAgentData, 2000);
      }
    } catch (error) {
      console.error('Error triggering manual optimization:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSettingsUpdate = async () => {
    try {
      const response = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, action: 'update_settings', settings })
      });
      
      const result = await response.json();
      if (result.success) {
        setShowSettings(false);
        await fetchAgentData();
      }
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-xl border shadow-sm">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-100">
            <Bot size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">24/7 AI Business Agent</h3>
            <p className="text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const isEnabled = agentData?.business?.aiAgentEnabled;
  const recentActivities = agentData?.recentActivities || [];
  const activeAlerts = agentData?.activeAlerts || [];

  return (
    <div className="space-y-6">
      {/* Main AI Agent Card */}
      <div className="p-6 bg-white rounded-xl border shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-lg ${isEnabled ? 'bg-green-100' : 'bg-gray-100'}`}>
              <Bot size={24} className={isEnabled ? 'text-green-600' : 'text-gray-400'} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">24/7 AI Business Agent</h3>
              <p className="text-sm text-gray-600">
                {isEnabled ? 'Actively optimizing your business' : 'Ready to activate'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              title="AI Agent Settings"
            >
              <Settings size={16} className="text-gray-600" />
            </button>
            
            {isEnabled && (
              <button
                onClick={handleManualOptimization}
                disabled={actionLoading}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Zap size={14} />
                <span>Optimize Now</span>
              </button>
            )}
            
            <button
              onClick={handleAgentToggle}
              disabled={actionLoading}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                isEnabled 
                  ? 'bg-red-100 hover:bg-red-200 text-red-700' 
                  : 'bg-green-100 hover:bg-green-200 text-green-700'
              }`}
            >
              {isEnabled ? <Pause size={14} /> : <Play size={14} />}
              <span>{actionLoading ? 'Processing...' : (isEnabled ? 'Pause' : 'Activate')}</span>
            </button>
          </div>
        </div>

        {/* Agent Status */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
            <div className="flex items-center space-x-2">
              <Activity size={16} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Status</span>
            </div>
            <p className="text-lg font-bold text-blue-900 mt-1">
              {isEnabled ? 'Active' : 'Inactive'}
            </p>
          </div>
          
          <div className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100">
            <div className="flex items-center space-x-2">
              <TrendingUp size={16} className="text-green-600" />
              <span className="text-sm font-medium text-green-900">Optimizations</span>
            </div>
            <p className="text-lg font-bold text-green-900 mt-1">
              {recentActivities.filter(a => a.type === 'ai_optimization').length}
            </p>
          </div>
          
          <div className="p-4 rounded-lg bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-100">
            <div className="flex items-center space-x-2">
              <Brain size={16} className="text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Insights</span>
            </div>
            <p className="text-lg font-bold text-purple-900 mt-1">
              {recentActivities.filter(a => a.type === 'market_research').length}
            </p>
          </div>
        </div>

        {/* Performance Alerts */}
        {activeAlerts.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
              <AlertTriangle size={16} className="text-orange-500 mr-2" />
              Performance Alerts
            </h4>
            <div className="space-y-2">
              {activeAlerts.slice(0, 3).map((alert, index) => (
                <div key={index} className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-900">
                        {alert.metric_name}: {alert.current_value} (threshold: {alert.threshold_value})
                      </p>
                      <p className="text-xs text-orange-600 mt-1">
                        Severity: {alert.severity}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      alert.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 p-4 rounded-lg bg-gray-50 border">
            <h4 className="font-semibold text-gray-900 mb-4">AI Agent Settings</h4>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Optimization Frequency
                </label>
                <select 
                  value={settings?.optimization_frequency || 'hourly'}
                  onChange={(e) => setSettings(prev => ({ ...prev, optimization_frequency: e.target.value }))}
                  className="w-full p-2 border rounded-lg text-sm"
                >
                  <option value="hourly">Every Hour</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Risk Tolerance
                </label>
                <select 
                  value={settings?.risk_tolerance || 'medium'}
                  onChange={(e) => setSettings(prev => ({ ...prev, risk_tolerance: e.target.value }))}
                  className="w-full p-2 border rounded-lg text-sm"
                >
                  <option value="low">Conservative</option>
                  <option value="medium">Balanced</option>
                  <option value="high">Aggressive</option>
                </select>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="flex items-center space-x-2">
                <input 
                  type="checkbox"
                  checked={settings?.auto_implement_changes || false}
                  onChange={(e) => setSettings(prev => ({ ...prev, auto_implement_changes: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Auto-implement AI recommendations</span>
              </label>
            </div>
            
            <div className="mt-4 flex items-center space-x-2">
              <button
                onClick={handleSettingsUpdate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Save Settings
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recent AI Activities */}
      <div className="p-6 bg-white rounded-xl border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900 flex items-center">
            <Activity size={16} className="text-blue-600 mr-2" />
            Recent AI Activities
          </h4>
          <button
            onClick={fetchAgentData}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            title="Refresh"
          >
            <Refresh size={14} className="text-gray-500" />
          </button>
        </div>
        
        {recentActivities.length > 0 ? (
          <div className="space-y-3">
            {recentActivities.slice(0, 5).map((activity, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50">
                <span className="text-lg">{activity.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-600 mt-1">{activity.details}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(activity.created_at).toLocaleString()}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  activity.type === 'ai_optimization' ? 'bg-blue-100 text-blue-800' :
                  activity.type === 'market_research' ? 'bg-green-100 text-green-800' :
                  activity.type === 'competitor_analysis' ? 'bg-purple-100 text-purple-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {activity.type.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Bot size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {isEnabled ? 'AI is analyzing your business...' : 'Activate AI agent to see optimization activities'}
            </p>
          </div>
        )}
      </div>

      {/* AI Insights Preview */}
      {isEnabled && (
        <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-100">
              <Lightbulb size={20} className="text-purple-600" />
            </div>
            <div>
              <h4 className="font-semibold text-purple-900">AI Insights</h4>
              <p className="text-sm text-purple-700">Powered by continuous analysis</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-white bg-opacity-60">
              <h5 className="font-medium text-purple-900 mb-2">Market Opportunities</h5>
              <p className="text-sm text-purple-800">
                AI is researching {business?.business_data?.industry || 'your industry'} trends and competitor strategies to find new growth opportunities.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-white bg-opacity-60">
              <h5 className="font-medium text-purple-900 mb-2">Performance Optimization</h5>
              <p className="text-sm text-purple-800">
                Continuously A/B testing landing pages, emails, and pricing to maximize conversions and revenue.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
