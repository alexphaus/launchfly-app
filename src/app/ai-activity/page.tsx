// src/app/ai-activity/page.tsx
/**
 * AI Cofounder Activity Dashboard
 * 
 * Real-time view of what your AI cofounder is doing:
 * - Live activity feed
 * - Strategic insights and recommendations
 * - Performance analysis and optimizations
 * - Conversation summaries
 * - Market intelligence updates
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AIActivityPage() {
  const searchParams = useSearchParams();
  const businessId = searchParams.get('businessId');
  
  const [activities, setActivities] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [status, setStatus] = useState('loading');
  const [cofounderStatus, setCofounderStatus] = useState<any>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    
    loadAICofounderData();
    
    // Set up real-time updates
    const interval = setInterval(loadAICofounderData, 10000); // Every 10 seconds
    setIsLive(true);
    
    return () => {
      clearInterval(interval);
      setIsLive(false);
    };
  }, [businessId]);

  const loadAICofounderData = async () => {
    try {
      // Load AI cofounder overview
      const overviewResponse = await fetch(`/api/ai-cofounder?businessId=${businessId}`);
      const overview = await overviewResponse.json();
      
      // Load recent activities
      const activitiesResponse = await fetch(`/api/ai-cofounder?businessId=${businessId}&action=status`);
      const activitiesData = await activitiesResponse.json();
      
      // Load insights
      const insightsResponse = await fetch(`/api/ai-cofounder?businessId=${businessId}&action=insights`);
      const insightsData = await insightsResponse.json();
      
      setCofounderStatus(overview.overview);
      setActivities(activitiesData.recentActivities || []);
      setInsights(insightsData.insights || []);
      setStatus('loaded');
      
    } catch (error) {
      console.error('Error loading AI cofounder data:', error);
      setStatus('error');
    }
  };

  const triggerThinking = async () => {
    try {
      setStatus('thinking');
      
      const response = await fetch('/api/ai-cofounder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          action: 'think'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh data to show new insights
        setTimeout(loadAICofounderData, 2000);
      }
      
      setStatus('loaded');
    } catch (error) {
      console.error('Error triggering thinking:', error);
      setStatus('error');
    }
  };

  const getActivityIcon = (type: string) => {
    const icons = {
      'cofounder_welcome': '👋',
      'strategic_thinking': '🧠',
      'market_intelligence': '📡',
      'conversation_handled': '💬',
      'optimization_completed': '🔄',
      'landing_optimization': '🎨',
      'email_optimization': '📧',
      'traffic_optimization': '🎯',
      'pricing_optimization': '💰',
      'competitor_analysis': '🕵️',
      'customer_acquisition': '🎯',
      'performance_analysis': '📊',
      'weekly_review': '📋',
      'daily_insights': '💡'
    };
    
    return icons[type as keyof typeof icons] || '🤖';
  };

  const getActivityColor = (priority: string) => {
    const colors = {
      'high': 'text-red-600 bg-red-50 border-red-200',
      'medium': 'text-yellow-600 bg-yellow-50 border-yellow-200',
      'normal': 'text-blue-600 bg-blue-50 border-blue-200',
      'low': 'text-gray-600 bg-gray-50 border-gray-200'
    };
    
    return colors[priority as keyof typeof colors] || colors.normal;
  };

  if (!businessId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Business ID Required</h1>
          <p className="text-gray-600">Please provide a business ID to view AI cofounder activity.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">🤖</span>
              </div>
              <div className="ml-4">
                <h1 className="text-xl font-semibold text-gray-900">AI Cofounder Dashboard</h1>
                <p className="text-sm text-gray-500">Real-time intelligence and optimization</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {isLive && (
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="ml-2 text-sm text-gray-600">Live</span>
                </div>
              )}
              
              <button
                onClick={triggerThinking}
                disabled={status === 'thinking'}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {status === 'thinking' ? 'Thinking...' : 'Trigger Thinking'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Status Overview */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Cofounder Status</h2>
              
              {cofounderStatus && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      cofounderStatus.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {cofounderStatus.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Insights</span>
                    <span className="text-sm font-medium text-gray-900">
                      {cofounderStatus.totalInsights}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Conversations</span>
                    <span className="text-sm font-medium text-gray-900">
                      {cofounderStatus.totalConversations}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Performance</span>
                    <span className="text-sm font-medium text-gray-900">
                      {cofounderStatus.performanceScore}/100
                    </span>
                  </div>
                  
                  {cofounderStatus.lastActive && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Last Active</span>
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(cofounderStatus.lastActive).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Latest Insights */}
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Latest Strategic Insights</h2>
              
              <div className="space-y-3">
                {insights.slice(0, 3).map((insight, index) => (
                  <div key={index} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <h3 className="text-sm font-medium text-purple-900 mb-1">
                      {insight.insight_type}
                    </h3>
                    <p className="text-xs text-purple-700">
                      {insight.content?.substring(0, 100)}...
                    </p>
                  </div>
                ))}
                
                {insights.length === 0 && (
                  <p className="text-sm text-gray-500 italic">
                    No insights generated yet. Trigger thinking to generate strategic insights.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Live Activity Feed */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Live Activity Feed</h2>
                <p className="text-sm text-gray-500">What your AI cofounder is doing right now</p>
              </div>
              
              <div className="p-6">
                {status === 'loading' && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    <span className="ml-3 text-gray-600">Loading AI cofounder activity...</span>
                  </div>
                )}
                
                {status === 'error' && (
                  <div className="text-center py-12">
                    <span className="text-red-600">Error loading AI cofounder data</span>
                  </div>
                )}
                
                {status === 'loaded' && (
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex-shrink-0">
                          <span className="text-2xl">{getActivityIcon(activity.type)}</span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-900">
                              {activity.message}
                            </h3>
                            <span className="text-xs text-gray-500">
                              {new Date(activity.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-600 mt-1">
                            {activity.details}
                          </p>
                          
                          {activity.metadata?.priority && (
                            <div className="mt-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                                getActivityColor(activity.metadata.priority)
                              }`}>
                                {activity.metadata.priority} priority
                              </span>
                            </div>
                          )}
                          
                          {activity.metadata?.requiresUserAttention && (
                            <div className="mt-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                                👀 Requires attention
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {activities.length === 0 && (
                      <div className="text-center py-12">
                        <span className="text-2xl mb-4 block">🤖</span>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">AI Cofounder Initializing</h3>
                        <p className="text-gray-600">Your AI cofounder is getting ready to start optimizing your business.</p>
                        <button
                          onClick={triggerThinking}
                          className="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                        >
                          Activate AI Cofounder
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow mt-6 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => triggerAction('analyze_performance')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-2xl block mb-2">📊</span>
                  <span className="text-sm font-medium text-gray-900">Analyze Performance</span>
                </button>
                
                <button
                  onClick={() => triggerAction('research_market')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-2xl block mb-2">🔍</span>
                  <span className="text-sm font-medium text-gray-900">Research Market</span>
                </button>
                
                <button
                  onClick={() => triggerAction('optimize_campaigns')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-2xl block mb-2">🎯</span>
                  <span className="text-sm font-medium text-gray-900">Optimize Campaigns</span>
                </button>
                
                <button
                  onClick={() => triggerAction('generate_insights')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-2xl block mb-2">💡</span>
                  <span className="text-sm font-medium text-gray-900">Generate Insights</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  async function triggerAction(actionType: string) {
    try {
      const response = await fetch('/api/ai-cofounder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          action: 'execute_task',
          data: {
            name: actionType,
            description: `User-triggered ${actionType}`,
            priority: 'high'
          }
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh activities to show new action
        setTimeout(loadAICofounderData, 1000);
      }
    } catch (error) {
      console.error('Error triggering action:', error);
    }
  }
}
