/**
 * @fileoverview Demo page for AI Sales Analytics Dashboard
 * Shows comprehensive performance monitoring and optimization insights
 */

'use client';

import React, { useState } from 'react';
import AnalyticsDashboard from '../../../components/ai-sales/AnalyticsDashboard';
import { BarChart3, TrendingUp, Target, Zap, Users, Brain } from 'lucide-react';

export default function AIAnalyticsDemo() {
  const [businessId] = useState('demo-business-analytics');

  const features = [
    {
      icon: BarChart3,
      title: 'Real-time Metrics',
      description: 'Live performance tracking with auto-refreshing dashboards',
      color: 'blue'
    },
    {
      icon: TrendingUp,
      title: 'Conversion Analytics',
      description: 'Detailed funnel analysis and conversion rate optimization',
      color: 'green'
    },
    {
      icon: Target,
      title: 'A/B Testing',
      description: 'Built-in experimentation with statistical significance',
      color: 'purple'
    },
    {
      icon: Zap,
      title: 'AI Performance',
      description: 'Monitor response times, accuracy, and error rates',
      color: 'yellow'
    },
    {
      icon: Users,
      title: 'User Experience',
      description: 'Satisfaction scores and engagement metrics',
      color: 'red'
    },
    {
      icon: Brain,
      title: 'Smart Insights',
      description: 'AI-generated recommendations for optimization',
      color: 'indigo'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-600 border-blue-200',
      green: 'bg-green-100 text-green-600 border-green-200',
      purple: 'bg-purple-100 text-purple-600 border-purple-200',
      yellow: 'bg-yellow-100 text-yellow-600 border-yellow-200',
      red: 'bg-red-100 text-red-600 border-red-200',
      indigo: 'bg-indigo-100 text-indigo-600 border-indigo-200'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              AI Sales Analytics Dashboard
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive performance monitoring, A/B testing, and optimization insights 
              for your AI sales agent with real-time metrics and actionable recommendations.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const colorClasses = getColorClasses(feature.color);
              
              return (
                <div key={index} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 border ${colorClasses}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Analytics Dashboard */}
      <div className="container mx-auto px-4 py-8">
        <AnalyticsDashboard businessId={businessId} />
      </div>

      {/* Features Breakdown */}
      <div className="bg-white">
        <div className="container mx-auto px-4 py-12">
          <h2 className="text-2xl font-semibold text-center mb-8">Comprehensive Analytics Features</h2>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Performance Monitoring */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
                Performance Monitoring
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Real-time visitor and conversion tracking</li>
                <li>• Revenue and AOV monitoring</li>
                <li>• Chat engagement metrics</li>
                <li>• AI response performance</li>
                <li>• User satisfaction scores</li>
                <li>• Time-series data visualization</li>
              </ul>
            </div>

            {/* A/B Testing */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2 text-purple-600" />
                A/B Testing & Optimization
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Automated experiment management</li>
                <li>• Statistical significance testing</li>
                <li>• Multi-variant testing support</li>
                <li>• Conversion lift measurement</li>
                <li>• Winner determination algorithms</li>
                <li>• Traffic allocation controls</li>
              </ul>
            </div>

            {/* AI Insights */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Brain className="w-5 h-5 mr-2 text-indigo-600" />
                AI-Powered Insights
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Automated performance analysis</li>
                <li>• Optimization recommendations</li>
                <li>• Anomaly detection</li>
                <li>• Predictive analytics</li>
                <li>• Custom alert thresholds</li>
                <li>• Actionable improvement suggestions</li>
              </ul>
            </div>

            {/* Data Visualization */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                Data Visualization
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Interactive charts and graphs</li>
                <li>• Conversion funnel visualization</li>
                <li>• Time-range filtering</li>
                <li>• Export capabilities</li>
                <li>• Mobile-responsive design</li>
                <li>• Custom dashboard layouts</li>
              </ul>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="mt-12 p-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
            <h3 className="text-xl font-semibold text-center mb-6 text-gray-900">Key Performance Indicators</h3>
            <div className="grid md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">5.2%</div>
                <div className="text-sm text-gray-600">Average Conversion Rate</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">$347</div>
                <div className="text-sm text-gray-600">Average Order Value</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">1.8s</div>
                <div className="text-sm text-gray-600">AI Response Time</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">4.7/5</div>
                <div className="text-sm text-gray-600">User Satisfaction</div>
              </div>
            </div>
          </div>

          {/* Demo Notice */}
          <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-semibold text-yellow-800 mb-2">Demo Analytics Data</h4>
            <p className="text-sm text-yellow-700">
              This dashboard displays simulated analytics data to demonstrate the full range of 
              features and capabilities. In production, all metrics would be based on real visitor 
              interactions and AI performance data from your business.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}