/**
 * @fileoverview Demo page for AI Sales Agent Configuration Panel
 * Shows the configuration interface for business owners
 */

'use client';

import React, { useState } from 'react';
import { ConfigPanel } from '../../../components/ai-sales';
import { Settings, Bot, Zap, Target, Brain, DollarSign } from 'lucide-react';

export default function AIConfigDemo() {
  const [showConfig, setShowConfig] = useState(false);
  const [businessId] = useState('demo-business-config');

  const features = [
    {
      icon: Bot,
      title: 'AI Personality',
      description: 'Customize your AI agent\'s tone, greeting, and communication style',
      color: 'blue'
    },
    {
      icon: Brain,
      title: 'Knowledge Base',
      description: 'Add your business info, products, FAQs, and objection handlers',
      color: 'purple'
    },
    {
      icon: DollarSign,
      title: 'Pricing Rules',
      description: 'Set pricing boundaries, discounts, and negotiation limits',
      color: 'green'
    },
    {
      icon: Target,
      title: 'Trigger Settings',
      description: 'Configure when and how the AI chat activates',
      color: 'orange'
    },
    {
      icon: Zap,
      title: 'Business Goals',
      description: 'Set objectives to guide AI behavior and optimization',
      color: 'red'
    },
    {
      icon: Settings,
      title: 'Advanced Options',
      description: 'Fine-tune aggressiveness, fallbacks, and compliance',
      color: 'gray'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-600 border-blue-200',
      purple: 'bg-purple-100 text-purple-600 border-purple-200',
      green: 'bg-green-100 text-green-600 border-green-200',
      orange: 'bg-orange-100 text-orange-600 border-orange-200',
      red: 'bg-red-100 text-red-600 border-red-200',
      gray: 'bg-gray-100 text-gray-600 border-gray-200'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      {/* Demo Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI Sales Agent Configuration
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Complete control panel for business owners to customize their AI sales assistant.
            Configure personality, knowledge, pricing rules, and behavioral triggers.
          </p>
        </div>

        {/* Configuration Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const colorClasses = getColorClasses(feature.color);
            
            return (
              <div key={index} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
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

        {/* Demo Action */}
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-4xl mx-auto mb-16">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-4">Try the Configuration Panel</h2>
            <p className="text-gray-600 mb-6">
              Experience the full configuration interface with live preview and real-time validation.
            </p>
            
            <button
              onClick={() => setShowConfig(true)}
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Settings className="w-5 h-5 mr-2" />
              Open Configuration Panel
            </button>
          </div>
        </div>

        {/* Configuration Options Preview */}
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6 text-center">Configuration Options</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Personality Settings */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Bot className="w-5 h-5 mr-2 text-blue-600" />
                Personality Settings
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Choose communication tone (Professional, Friendly, Casual, Enthusiastic)</li>
                <li>• Customize agent name and avatar</li>
                <li>• Set default greeting messages</li>
                <li>• Define message signatures</li>
              </ul>
            </div>

            {/* Knowledge Base */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Brain className="w-5 h-5 mr-2 text-purple-600" />
                Knowledge Base
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Add business description and value proposition</li>
                <li>• Manage product catalog with pricing</li>
                <li>• Create FAQ database</li>
                <li>• Configure objection handling responses</li>
              </ul>
            </div>

            {/* Pricing Rules */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                Pricing Rules
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Set base prices and minimum thresholds</li>
                <li>• Configure maximum discount percentages</li>
                <li>• Enable/disable price negotiation</li>
                <li>• Define volume discount tiers</li>
              </ul>
            </div>

            {/* Trigger Settings */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2 text-orange-600" />
                Trigger Settings
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Set intent score thresholds</li>
                <li>• Configure time delays and working hours</li>
                <li>• Enable exit intent detection</li>
                <li>• Control proactive messaging</li>
              </ul>
            </div>

            {/* Business Goals */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-red-600" />
                Business Goals
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Choose primary objective (Revenue, Conversions, AOV)</li>
                <li>• Set target conversion rates</li>
                <li>• Define focus products</li>
                <li>• Track performance metrics</li>
              </ul>
            </div>

            {/* Advanced Settings */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-gray-600" />
                Advanced Settings
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Adjust sales aggressiveness levels</li>
                <li>• Configure human handoff rules</li>
                <li>• Enable feedback collection</li>
                <li>• Ensure accessibility compliance</li>
              </ul>
            </div>
          </div>

          {/* Benefits */}
          <div className="mt-8 p-6 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-3 text-blue-900">Key Benefits</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-blue-800">
              <div>
                <strong>Complete Control:</strong> Fine-tune every aspect of your AI agent's behavior
              </div>
              <div>
                <strong>Real-time Preview:</strong> See changes instantly with live agent preview
              </div>
              <div>
                <strong>Export/Import:</strong> Save and share configurations across businesses
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-12 text-center">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">How to Use</h3>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
            <div className="flex items-center">
              <span className="text-blue-600 font-semibold mr-2">1.</span>
              Click "Open Configuration Panel" above
            </div>
            <div className="flex items-center">
              <span className="text-blue-600 font-semibold mr-2">2.</span>
              Navigate through the different configuration tabs
            </div>
            <div className="flex items-center">
              <span className="text-blue-600 font-semibold mr-2">3.</span>
              Customize settings and see real-time validation
            </div>
            <div className="flex items-center">
              <span className="text-blue-600 font-semibold mr-2">4.</span>
              Use the preview feature to test your agent
            </div>
            <div className="flex items-center">
              <span className="text-blue-600 font-semibold mr-2">5.</span>
              Save your configuration when ready
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Panel Modal */}
      {showConfig && (
        <ConfigPanel
          businessId={businessId}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}