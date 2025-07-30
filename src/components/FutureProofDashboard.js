// components/FutureProofDashboard.js - Showcase the new approach
'use client';

import { useState, useEffect } from 'react';
import { ValueLayers, SuccessGuarantees } from '@/lib/core/index.js';

const theme = {
  colors: {
    primary: '#2563eb',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    text: '#1f2937',
    textGray: '#6b7280',
    bgLight: '#f9fafb',
    white: '#ffffff'
  }
};

export default function FutureProofDashboard({ session, business, onAction }) {
  const [currentPhase, setCurrentPhase] = useState('discovery');
  const [valueLayer, setValueLayer] = useState('best');
  
  useEffect(() => {
    // Determine current phase based on session data
    if (session?.stage === 'complete' && business?.status === 'ready') {
      setCurrentPhase('scaling');
    } else if (session?.stage === 'growing') {
      setCurrentPhase('growth');
    } else if (session?.stage === 'building') {
      setCurrentPhase('execution');
    } else {
      setCurrentPhase('discovery');
    }
  }, [session, business]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                🚀 Future-Proof Business Launch
              </h1>
              <p className="text-gray-600 mt-1">
                Success partnership, not just website generation
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <ValueLayerSelector 
                current={valueLayer} 
                onChange={setValueLayer}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Phase Progress */}
            <PhaseProgress currentPhase={currentPhase} />
            
            {/* Current Phase Content */}
            {currentPhase === 'discovery' && (
              <DiscoveryPhase 
                session={session} 
                onAction={onAction}
                valueLayer={valueLayer}
              />
            )}
            
            {currentPhase === 'execution' && (
              <ExecutionPhase 
                business={business} 
                session={session}
                onAction={onAction}
              />
            )}
            
            {currentPhase === 'growth' && (
              <GrowthPhase 
                business={business} 
                session={session}
                onAction={onAction}
              />
            )}
            
            {currentPhase === 'scaling' && (
              <ScalingPhase 
                business={business} 
                session={session}
                onAction={onAction}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <SuccessGuaranteeCard valueLayer={valueLayer} />
            <ValuePropositionCard />
            <CustomerAcquisitionCard />
          </div>
        </div>
      </div>
    </div>
  );
}

function ValueLayerSelector({ current, onChange }) {
  return (
    <div className="flex items-center space-x-2">
      <label className="text-sm font-medium text-gray-700">Value Layer:</label>
      <select 
        value={current} 
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded-md px-3 py-1 text-sm"
      >
        {Object.entries(ValueLayers).map(([key, layer]) => (
          <option key={key} value={key}>
            {layer.value} - {layer.price}
          </option>
        ))}
      </select>
    </div>
  );
}

function PhaseProgress({ currentPhase }) {
  const phases = [
    { key: 'discovery', name: 'Discovery', description: 'Find profitable opportunity' },
    { key: 'execution', name: 'Execution', description: 'Create business presence' },
    { key: 'growth', name: 'Growth', description: 'Generate customers' },
    { key: 'scaling', name: 'Scaling', description: 'Optimize for profit' }
  ];

  const currentIndex = phases.findIndex(p => p.key === currentPhase);

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Future-Proof Business Development
      </h2>
      
      <div className="flex items-center space-x-4">
        {phases.map((phase, index) => (
          <div key={phase.key} className="flex items-center">
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
              ${index <= currentIndex 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-500'
              }
            `}>
              {index + 1}
            </div>
            <div className="ml-3 min-w-0 flex-1">
              <p className={`text-sm font-medium ${
                index <= currentIndex ? 'text-gray-900' : 'text-gray-500'
              }`}>
                {phase.name}
              </p>
              <p className="text-xs text-gray-500">{phase.description}</p>
            </div>
            {index < phases.length - 1 && (
              <div className={`mx-4 h-0.5 w-8 ${
                index < currentIndex ? 'bg-blue-600' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DiscoveryPhase({ session, onAction, valueLayer }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🔍 Opportunity Discovery
        </h3>
        <p className="text-gray-600 mb-6">
          We're analyzing your background to find a profitable business opportunity 
          that matches your skills and market demand.
        </p>
        
        {session?.stage === 'analyzing' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-3"></div>
              <p className="text-blue-800 font-medium">
                Analyzing market opportunities...
              </p>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="text-center">
            <div className="text-2xl mb-2">📊</div>
            <h4 className="font-medium text-gray-900">Market Analysis</h4>
            <p className="text-sm text-gray-600">Identify profitable niches</p>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2">🎯</div>
            <h4 className="font-medium text-gray-900">Competition Gap</h4>
            <p className="text-sm text-gray-600">Find underserved markets</p>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2">💰</div>
            <h4 className="font-medium text-gray-900">Revenue Potential</h4>
            <p className="text-sm text-gray-600">Calculate earning potential</p>
          </div>
        </div>
      </div>
      
      <ValueDeliveryCard layer={ValueLayers[valueLayer]} />
    </div>
  );
}

function ExecutionPhase({ business, session, onAction }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🏗️ Business Creation
        </h3>
        <p className="text-gray-600 mb-6">
          Using the best available AI tools to create your business presence, 
          while we focus on the success systems that AI can't replicate.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">AI-Generated (Commodity)</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Website and design</li>
              <li>• Content and copy</li>
              <li>• Basic marketing materials</li>
              <li>• Technical setup</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Our Secret Sauce (Moat)</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Customer acquisition strategy</li>
              <li>• Conversion optimization</li>
              <li>• Market positioning</li>
              <li>• Success partnerships</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function GrowthPhase({ business, session, onAction }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📈 Customer Acquisition
        </h3>
        <p className="text-gray-600 mb-6">
          This is where we add real value - bringing you paying customers 
          through proven strategies that AI can't replicate.
        </p>
        
        <CustomerAcquisitionStrategies />
      </div>
    </div>
  );
}

function ScalingPhase({ business, session, onAction }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🚀 Business Scaling
        </h3>
        <p className="text-gray-600 mb-6">
          Optimizing for sustainable growth and long-term success.
        </p>
        
        <BusinessMetrics business={business} />
      </div>
    </div>
  );
}

function SuccessGuaranteeCard({ valueLayer }) {
  const guarantee = SuccessGuarantees[valueLayer];
  
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
      <div className="flex items-center mb-4">
        <div className="text-2xl mr-3">🛡️</div>
        <h3 className="text-lg font-semibold">Success Guarantee</h3>
      </div>
      <p className="text-blue-100 mb-4">{guarantee}</p>
      <p className="text-sm text-blue-200">
        Your success is our business model. We only win when you win.
      </p>
    </div>
  );
}

function ValuePropositionCard() {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Why This Approach Wins
      </h3>
      <div className="space-y-3">
        <div className="flex items-start">
          <div className="text-green-600 mr-3 mt-0.5">✓</div>
          <div>
            <p className="font-medium text-gray-900">Technology Agnostic</p>
            <p className="text-sm text-gray-600">Use best AI for creation, focus on success</p>
          </div>
        </div>
        <div className="flex items-start">
          <div className="text-green-600 mr-3 mt-0.5">✓</div>
          <div>
            <p className="font-medium text-gray-900">Defensible Moat</p>
            <p className="text-sm text-gray-600">Relationships and proven systems</p>
          </div>
        </div>
        <div className="flex items-start">
          <div className="text-green-600 mr-3 mt-0.5">✓</div>
          <div>
            <p className="font-medium text-gray-900">Guaranteed Results</p>
            <p className="text-sm text-gray-600">Success partnership, not just tools</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomerAcquisitionCard() {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Customer Acquisition (Our Moat)
      </h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">LinkedIn Outreach</span>
          <span className="font-medium">2-5 leads/week</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Content Marketing</span>
          <span className="font-medium">Organic growth</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Partnership Deals</span>
          <span className="font-medium">Referral pipeline</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Community Building</span>
          <span className="font-medium">Brand authority</span>
        </div>
      </div>
    </div>
  );
}

function ValueDeliveryCard({ layer }) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-blue-600">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Value Layer: {layer.value}
      </h3>
      <p className="text-2xl font-bold text-blue-600 mb-2">{layer.price}</p>
      <p className="text-sm text-gray-600 mb-4">Moat: {layer.moat}</p>
      <div className="bg-blue-50 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          This layer remains valuable regardless of AI advancement because it requires 
          human relationships, market knowledge, and proven success systems.
        </p>
      </div>
    </div>
  );
}

function CustomerAcquisitionStrategies() {
  const strategies = [
    { name: 'Direct Outreach', progress: 75, status: 'active' },
    { name: 'Content Marketing', progress: 60, status: 'active' },
    { name: 'Partnership Deals', progress: 30, status: 'starting' },
    { name: 'Community Building', progress: 85, status: 'successful' }
  ];

  return (
    <div className="space-y-4">
      {strategies.map((strategy) => (
        <div key={strategy.name} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900">{strategy.name}</h4>
            <span className={`px-2 py-1 text-xs rounded-full ${
              strategy.status === 'successful' ? 'bg-green-100 text-green-800' :
              strategy.status === 'active' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {strategy.status}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full" 
              style={{ width: `${strategy.progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">{strategy.progress}% complete</p>
        </div>
      ))}
    </div>
  );
}

function BusinessMetrics({ business }) {
  const metrics = [
    { label: 'Monthly Revenue', value: '$2,340', change: '+12%' },
    { label: 'Active Customers', value: '8', change: '+3' },
    { label: 'Conversion Rate', value: '4.2%', change: '+0.8%' },
    { label: 'Traffic', value: '1,240', change: '+25%' }
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">{metric.label}</p>
          <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
          <p className="text-sm text-green-600">{metric.change}</p>
        </div>
      ))}
    </div>
  );
}
