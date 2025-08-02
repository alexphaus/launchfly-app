// components/EnhancedAIActivityFeed.js
'use client';
import { useState, useEffect } from 'react';

const EnhancedAIActivityFeed = ({ activities, currentActivity, isStreaming }) => {
  const [visibleActivities, setVisibleActivities] = useState([]);

  useEffect(() => {
    // Show activities one by one with animation
    activities.forEach((activity, index) => {
      setTimeout(() => {
        setVisibleActivities(prev => {
          if (!prev.find(a => a.id === activity.id)) {
            return [...prev, activity];
          }
          return prev;
        });
      }, index * 300);
    });
  }, [activities]);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'skeleton_ready': return '🏗️';
      case 'basic_info_ready': return '📝';
      case 'theme_ready': return '🎨';
      case 'hero_ready': return '✨';
      case 'product_ready': return '📦';
      case 'business_complete': return '🚀';
      case 'first_visitor': return '🎉';
      default: return '⚡';
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'skeleton_ready': return 'text-blue-600';
      case 'basic_info_ready': return 'text-purple-600';
      case 'theme_ready': return 'text-pink-600';
      case 'hero_ready': return 'text-yellow-600';
      case 'product_ready': return 'text-green-600';
      case 'business_complete': return 'text-indigo-600';
      case 'first_visitor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 flex items-center">
            <span className="mr-2">🤖</span>
            AI Activity Feed
          </h3>
          {isStreaming && (
            <div className="flex items-center space-x-2 text-sm text-blue-600">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Working...</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4 max-h-64 overflow-y-auto">
        {/* Current Activity (if streaming) */}
        {isStreaming && currentActivity && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400 animate-pulse">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full animate-spin border-2 border-white border-t-transparent"></div>
              <span className="text-blue-800 font-medium">{currentActivity}</span>
            </div>
          </div>
        )}
        
        {/* Activity History */}
        <div className="space-y-2">
          {visibleActivities.length === 0 && !isStreaming ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">🤖</div>
              <p>AI will show progress here</p>
            </div>
          ) : (
            visibleActivities.map((activity, index) => (
              <div 
                key={activity.id}
                className={`flex items-start space-x-3 p-2 rounded-lg transition-all duration-500 transform ${
                  index === visibleActivities.length - 1 && isStreaming
                    ? 'bg-blue-50 scale-105'
                    : 'hover:bg-gray-50'
                } animate-slideIn`}
                style={{
                  animationDelay: `${index * 100}ms`
                }}
              >
                <div className={`text-lg ${getActivityColor(activity.type)} flex-shrink-0`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 font-medium">{activity.text}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Completion Message */}
        {!isStreaming && visibleActivities.length > 0 && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center space-x-2">
              <span className="text-green-600 text-lg">✅</span>
              <span className="text-green-800 font-medium">Business generation complete!</span>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .animate-slideIn {
          animation: slideIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};

export default EnhancedAIActivityFeed;
