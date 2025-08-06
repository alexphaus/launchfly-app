/**
 * @fileoverview Visual intent score indicator for development/testing
 * Shows real-time visitor intent score and signals
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Eye, 
  MousePointer, 
  Clock, 
  DollarSign, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Target
} from 'lucide-react';

/**
 * Intent indicator component for debugging/development
 * @param {Object} props - Component props
 * @param {Object} props.intentAnalysis - Current intent analysis
 * @param {boolean} props.visible - Whether to show the indicator
 * @param {string} props.position - Position on screen ('bottom-left', 'bottom-right', 'top-left', 'top-right')
 * @returns {JSX.Element}
 */
const IntentIndicator = ({ 
  intentAnalysis, 
  visible = process.env.NODE_ENV === 'development',
  position = 'bottom-left' 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!visible || !intentAnalysis) return null;
  
  const { score, stage, signals, componentScores, confidence, recommendations } = intentAnalysis;
  
  // Position classes
  const positionClasses = {
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4'
  };
  
  // Score color
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-red-600 bg-red-100';
    if (score >= 60) return 'text-orange-600 bg-orange-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };
  
  // Stage emoji
  const getStageEmoji = (stage) => {
    const stageMap = {
      awareness: '👀',
      interest: '🤔',
      consideration: '🔍',
      decision: '💭',
      exit_intent: '🚨'
    };
    return stageMap[stage] || '👀';
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`fixed ${positionClasses[position]} z-50 font-mono text-xs`}
    >
      {/* Compact View */}
      <motion.div
        className={`rounded-lg border-2 border-gray-300 bg-white shadow-lg cursor-pointer ${
          isExpanded ? 'rounded-b-none border-b-0' : ''
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="p-3 flex items-center space-x-3">
          <div className={`rounded-full px-2 py-1 font-bold ${getScoreColor(score)}`}>
            {score}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg">{getStageEmoji(stage)}</span>
            <span className="font-semibold text-gray-700">
              {stage.replace('_', ' ')}
            </span>
          </div>
          <div className="text-gray-400">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </motion.div>
      
      {/* Expanded View */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border-2 border-t-0 border-gray-300 rounded-b-lg shadow-lg"
          >
            <div className="p-4 space-y-4 max-w-sm">
              {/* Component Scores */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                  <Target className="w-4 h-4 mr-1" />
                  Component Scores
                </h4>
                <div className="space-y-1">
                  {Object.entries(componentScores).map(([component, score]) => (
                    <div key={component} className="flex justify-between">
                      <span className="capitalize text-gray-600">{component}:</span>
                      <span className="font-semibold">{Math.round(score)}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Key Signals */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                  <Activity className="w-4 h-4 mr-1" />
                  Key Signals
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center">
                    <MousePointer className="w-3 h-3 mr-1 text-blue-500" />
                    <span>Mouse: {Math.round(signals.mouseVelocity)}px/s</span>
                  </div>
                  <div className="flex items-center">
                    <Eye className="w-3 h-3 mr-1 text-green-500" />
                    <span>Scroll: {Math.round(signals.scrollDepth)}%</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1 text-purple-500" />
                    <span>Time: {signals.timeOnPage}s</span>
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="w-3 h-3 mr-1 text-yellow-500" />
                    <span>Pricing: {signals.pricingViews}</span>
                  </div>
                </div>
                
                {/* Special indicators */}
                <div className="mt-2 space-y-1">
                  {signals.exitIntent && (
                    <div className="flex items-center text-red-600">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      <span>Exit Intent Detected!</span>
                    </div>
                  )}
                  {signals.ctaHovers > 0 && (
                    <div className="text-blue-600">
                      CTA Hovers: {signals.ctaHovers}
                    </div>
                  )}
                  {signals.viewedProducts.length > 0 && (
                    <div className="text-green-600">
                      Products Viewed: {signals.viewedProducts.length}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Confidence & Recommendations */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-700">Confidence:</span>
                  <span className={`font-bold ${confidence > 70 ? 'text-green-600' : confidence > 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {confidence}%
                  </span>
                </div>
                
                {recommendations.length > 0 && (
                  <div>
                    <h5 className="font-semibold text-gray-700 mb-1">Recommendations:</h5>
                    <div className="space-y-1">
                      {recommendations.slice(0, 2).map((rec, index) => (
                        <div key={index} className={`text-xs p-2 rounded ${
                          rec.priority === 'urgent' ? 'bg-red-50 text-red-700' :
                          rec.priority === 'high' ? 'bg-orange-50 text-orange-700' :
                          rec.priority === 'medium' ? 'bg-yellow-50 text-yellow-700' :
                          'bg-blue-50 text-blue-700'
                        }`}>
                          <div className="font-semibold">{rec.action}</div>
                          <div>{rec.message}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Device Info */}
              <div className="text-xs text-gray-500 border-t pt-2">
                <div>Device: {signals.deviceInfo?.type || 'unknown'}</div>
                <div>Browser: {signals.deviceInfo?.browser?.name || 'unknown'}</div>
                <div>Referrer: {signals.referrer === 'direct' ? 'Direct' : 'External'}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default IntentIndicator;