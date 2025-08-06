/**
 * @fileoverview AI Sales Agent Configuration Panel
 * Comprehensive UI for business owners to customize their AI sales agent
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  User,
  Brain,
  DollarSign,
  Target,
  Clock,
  Save,
  RotateCcw,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Edit3,
  Eye
} from 'lucide-react';
import useAIConfigStore from '../../stores/ai-config-store';

/**
 * Main configuration panel component
 * @param {Object} props - Component props
 * @param {string} props.businessId - Business ID
 * @param {Function} props.onClose - Close callback
 * @returns {JSX.Element}
 */
const ConfigPanel = ({ businessId, onClose }) => {
  const [activeTab, setActiveTab] = useState('personality');
  const [showPreview, setShowPreview] = useState(false);
  
  const {
    personality,
    knowledge,
    pricing,
    triggers,
    goals,
    advanced,
    isLoading,
    error,
    hasUnsavedChanges,
    lastSaved,
    updatePersonality,
    updateKnowledge,
    updatePricing,
    updateTriggers,
    updateGoals,
    updateAdvanced,
    saveConfiguration,
    loadConfiguration,
    resetToDefaults,
    clearError,
    exportConfiguration,
    importConfiguration
  } = useAIConfigStore();
  
  // Load configuration on mount
  useEffect(() => {
    if (businessId) {
      loadConfiguration(businessId);
    }
  }, [businessId, loadConfiguration]);
  
  const tabs = [
    { id: 'personality', label: 'Personality', icon: User },
    { id: 'knowledge', label: 'Knowledge', icon: Brain },
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'triggers', label: 'Triggers', icon: Target },
    { id: 'goals', label: 'Goals', icon: Clock },
    { id: 'advanced', label: 'Advanced', icon: Settings }
  ];
  
  const handleSave = async () => {
    const success = await saveConfiguration();
    if (success) {
      // Show success feedback
      setTimeout(() => clearError(), 3000);
    }
  };
  
  const handleExport = () => {
    const config = exportConfiguration();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-config-${businessId}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const handleImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target.result);
          importConfiguration(config);
        } catch (error) {
          console.error('Failed to import configuration:', error);
        }
      };
      reader.readAsText(file);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex overflow-hidden"
      >
        {/* Header */}
        <div className="flex flex-col w-full">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between text-white">
            <div>
              <h2 className="text-2xl font-bold">AI Sales Agent Configuration</h2>
              <p className="text-blue-100 text-sm">Customize your AI sales assistant</p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Status Indicators */}
              {hasUnsavedChanges && (
                <span className="text-yellow-200 text-sm flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Unsaved changes
                </span>
              )}
              {lastSaved && !hasUnsavedChanges && (
                <span className="text-green-200 text-sm flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Saved {new Date(lastSaved).toLocaleTimeString()}
                </span>
              )}
              
              {/* Action Buttons */}
              <button
                onClick={handleExport}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Export Configuration"
              >
                <Download className="w-5 h-5" />
              </button>
              
              <label className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer" title="Import Configuration">
                <Upload className="w-5 h-5" />
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
              
              <button
                onClick={() => setShowPreview(true)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Preview Agent"
              >
                <Eye className="w-5 h-5" />
              </button>
              
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
          
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-6 mt-4 rounded">
              <div className="flex">
                <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                <p className="text-red-700">{error}</p>
                <button onClick={clearError} className="ml-auto text-red-400 hover:text-red-600">
                  ✕
                </button>
              </div>
            </div>
          )}
          
          {/* Main Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-gray-50 border-r overflow-y-auto">
              <nav className="p-4 space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center px-4 py-3 rounded-lg text-left transition-colors ${
                        activeTab === tab.id
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
              
              {/* Action Buttons */}
              <div className="p-4 border-t space-y-2">
                <button
                  onClick={handleSave}
                  disabled={isLoading || !hasUnsavedChanges}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
                
                <button
                  onClick={resetToDefaults}
                  className="w-full flex items-center justify-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset to Defaults
                </button>
              </div>
            </div>
            
            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'personality' && (
                      <PersonalityPanel
                        personality={personality}
                        onChange={updatePersonality}
                      />
                    )}
                    {activeTab === 'knowledge' && (
                      <KnowledgePanel
                        knowledge={knowledge}
                        onChange={updateKnowledge}
                      />
                    )}
                    {activeTab === 'pricing' && (
                      <PricingPanel
                        pricing={pricing}
                        onChange={updatePricing}
                      />
                    )}
                    {activeTab === 'triggers' && (
                      <TriggersPanel
                        triggers={triggers}
                        onChange={updateTriggers}
                      />
                    )}
                    {activeTab === 'goals' && (
                      <GoalsPanel
                        goals={goals}
                        onChange={updateGoals}
                      />
                    )}
                    {activeTab === 'advanced' && (
                      <AdvancedPanel
                        advanced={advanced}
                        onChange={updateAdvanced}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Preview Modal */}
      {showPreview && (
        <AgentPreview
          config={{ personality, knowledge, pricing, triggers, goals, advanced }}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};

/**
 * Personality configuration panel
 */
const PersonalityPanel = ({ personality, onChange }) => {
  const tones = [
    { value: 'professional', label: 'Professional', description: 'Formal, knowledgeable, solution-focused' },
    { value: 'friendly', label: 'Friendly', description: 'Warm, approachable, helpful' },
    { value: 'casual', label: 'Casual', description: 'Relaxed, conversational, easy-going' },
    { value: 'enthusiastic', label: 'Enthusiastic', description: 'Energetic, passionate, motivating' }
  ];
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-4">AI Personality Settings</h3>
        <p className="text-gray-600 mb-6">
          Define how your AI sales assistant communicates with visitors.
        </p>
      </div>
      
      {/* Agent Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Agent Name
        </label>
        <input
          type="text"
          value={personality.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Sales Assistant"
        />
      </div>
      
      {/* Tone Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Communication Tone
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tones.map((tone) => (
            <div
              key={tone.value}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                personality.tone === tone.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onChange({ tone: tone.value })}
            >
              <div className="flex items-center mb-2">
                <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                  personality.tone === tone.value
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`} />
                <span className="font-medium">{tone.label}</span>
              </div>
              <p className="text-sm text-gray-600">{tone.description}</p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Greeting Message */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Default Greeting
        </label>
        <textarea
          value={personality.greeting}
          onChange={(e) => onChange({ greeting: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="Hi there! How can I help you today?"
        />
        <p className="text-sm text-gray-500 mt-1">
          This message will be shown when the chat opens.
        </p>
      </div>
      
      {/* Signature */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Message Signature
        </label>
        <input
          type="text"
          value={personality.signature}
          onChange={(e) => onChange({ signature: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Best regards"
        />
      </div>
    </div>
  );
};

/**
 * Knowledge base configuration panel
 */
const KnowledgePanel = ({ knowledge, onChange }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-4">Knowledge Base</h3>
        <p className="text-gray-600 mb-6">
          Provide information about your business, products, and common questions.
        </p>
      </div>
      
      {/* Business Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Business Description
        </label>
        <textarea
          value={knowledge.businessDescription}
          onChange={(e) => onChange({ businessDescription: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          placeholder="Describe what your business does and the value you provide..."
        />
      </div>
      
      {/* Products Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-medium">Products & Services</h4>
          <button className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4 mr-1" />
            Add Product
          </button>
        </div>
        
        <div className="space-y-4">
          {knowledge.products.map((product, index) => (
            <div key={product.id || index} className="border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Name
                  </label>
                  <input
                    type="text"
                    value={product.name}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Product name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price
                  </label>
                  <input
                    type="number"
                    value={product.price}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="99"
                  />
                </div>
                <div className="flex items-end">
                  <button className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={product.description}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Product description..."
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Pricing configuration panel
 */
const PricingPanel = ({ pricing, onChange }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-4">Pricing Rules</h3>
        <p className="text-gray-600 mb-6">
          Set pricing boundaries and discount rules for your AI sales agent.
        </p>
      </div>
      
      {/* Base Pricing */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Base Price ($)
          </label>
          <input
            type="number"
            value={pricing.basePrice}
            onChange={(e) => onChange({ basePrice: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Minimum Price ($)
          </label>
          <input
            type="number"
            value={pricing.minPrice}
            onChange={(e) => onChange({ minPrice: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Discount (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={pricing.maxDiscount}
            onChange={(e) => onChange({ maxDiscount: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      {/* Negotiation Settings */}
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={pricing.allowNegotiation}
            onChange={(e) => onChange({ allowNegotiation: e.target.checked })}
            className="mr-2"
          />
          <span className="text-sm font-medium text-gray-700">
            Allow AI to negotiate prices
          </span>
        </label>
      </div>
    </div>
  );
};

/**
 * Triggers configuration panel
 */
const TriggersPanel = ({ triggers, onChange }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-4">Chat Triggers</h3>
        <p className="text-gray-600 mb-6">
          Configure when and how the AI chat should activate.
        </p>
      </div>
      
      {/* Intent Threshold */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Intent Threshold: {triggers.intentThreshold}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={triggers.intentThreshold}
          onChange={(e) => onChange({ intentThreshold: Number(e.target.value) })}
          className="w-full"
        />
        <p className="text-sm text-gray-500 mt-1">
          Chat will trigger when visitor intent score reaches this threshold.
        </p>
      </div>
      
      {/* Time Delay */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Time Delay (seconds)
        </label>
        <input
          type="number"
          value={triggers.timeDelay}
          onChange={(e) => onChange({ timeDelay: Number(e.target.value) })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      {/* Toggle Options */}
      <div className="space-y-3">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={triggers.exitIntentEnabled}
            onChange={(e) => onChange({ exitIntentEnabled: e.target.checked })}
            className="mr-2"
          />
          <span className="text-sm font-medium text-gray-700">
            Enable exit intent detection
          </span>
        </label>
        
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={triggers.proactiveMessages}
            onChange={(e) => onChange({ proactiveMessages: e.target.checked })}
            className="mr-2"
          />
          <span className="text-sm font-medium text-gray-700">
            Send proactive messages
          </span>
        </label>
        
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={triggers.workingHoursOnly}
            onChange={(e) => onChange({ workingHoursOnly: e.target.checked })}
            className="mr-2"
          />
          <span className="text-sm font-medium text-gray-700">
            Only during working hours
          </span>
        </label>
      </div>
    </div>
  );
};

/**
 * Goals configuration panel
 */
const GoalsPanel = ({ goals, onChange }) => {
  const goalOptions = [
    { value: 'maximize_revenue', label: 'Maximize Revenue', description: 'Focus on higher-value sales' },
    { value: 'maximize_conversions', label: 'Maximize Conversions', description: 'Focus on closing more deals' },
    { value: 'maximize_aov', label: 'Maximize AOV', description: 'Focus on average order value' }
  ];
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-4">Business Goals</h3>
        <p className="text-gray-600 mb-6">
          Set your primary objectives to guide AI behavior.
        </p>
      </div>
      
      {/* Primary Goal */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Primary Goal
        </label>
        <div className="space-y-3">
          {goalOptions.map((goal) => (
            <div
              key={goal.value}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                goals.primary === goal.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onChange({ primary: goal.value })}
            >
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                  goals.primary === goal.value
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`} />
                <div>
                  <span className="font-medium">{goal.label}</span>
                  <p className="text-sm text-gray-600">{goal.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Target Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Conversion Rate (%)
          </label>
          <input
            type="number"
            value={goals.targetConversionRate}
            onChange={(e) => onChange({ targetConversionRate: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target AOV ($)
          </label>
          <input
            type="number"
            value={goals.targetAOV}
            onChange={(e) => onChange({ targetAOV: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Advanced settings panel
 */
const AdvancedPanel = ({ advanced, onChange }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-4">Advanced Settings</h3>
        <p className="text-gray-600 mb-6">
          Fine-tune AI behavior and fallback options.
        </p>
      </div>
      
      {/* Aggressiveness */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Sales Aggressiveness
        </label>
        <div className="flex space-x-4">
          {['low', 'medium', 'high'].map((level) => (
            <button
              key={level}
              onClick={() => onChange({ aggressiveness: level })}
              className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                advanced.aggressiveness === level
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
      
      {/* Fallback Options */}
      <div className="space-y-3">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={advanced.fallbackToHuman}
            onChange={(e) => onChange({ fallbackToHuman: e.target.checked })}
            className="mr-2"
          />
          <span className="text-sm font-medium text-gray-700">
            Fallback to human agent when needed
          </span>
        </label>
        
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={advanced.collectFeedback}
            onChange={(e) => onChange({ collectFeedback: e.target.checked })}
            className="mr-2"
          />
          <span className="text-sm font-medium text-gray-700">
            Collect visitor feedback
          </span>
        </label>
        
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={advanced.a11yCompliant}
            onChange={(e) => onChange({ a11yCompliant: e.target.checked })}
            className="mr-2"
          />
          <span className="text-sm font-medium text-gray-700">
            Ensure accessibility compliance
          </span>
        </label>
      </div>
      
      {/* Human Handoff Threshold */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Human Handoff Threshold
        </label>
        <input
          type="number"
          value={advanced.humanHandoffThreshold}
          onChange={(e) => onChange({ humanHandoffThreshold: Number(e.target.value) })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-sm text-gray-500 mt-1">
          Number of failed attempts before transferring to human agent.
        </p>
      </div>
    </div>
  );
};

/**
 * Agent preview modal
 */
const AgentPreview = ({ config, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-60 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Agent Preview</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>
          
          {/* Preview Chat */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start space-x-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="bg-gray-100 rounded-lg p-3">
                  <p className="text-sm">{config.personality.greeting}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">{config.personality.name}</p>
              </div>
            </div>
            
            <div className="text-center text-xs text-gray-400">
              Preview of your AI agent's greeting with {config.personality.tone} tone
            </div>
          </div>
          
          {/* Configuration Summary */}
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Agent Name:</span>
              <span className="font-medium">{config.personality.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tone:</span>
              <span className="font-medium capitalize">{config.personality.tone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Intent Threshold:</span>
              <span className="font-medium">{config.triggers.intentThreshold}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Max Discount:</span>
              <span className="font-medium">{config.pricing.maxDiscount}%</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ConfigPanel;