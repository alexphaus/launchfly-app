// src/components/SocialSellingDashboard.js
// Dashboard component for managing social selling campaigns

'use client';

import React, { useState, useEffect } from 'react';

const SocialSellingDashboard = ({ businessId }) => {
  const [campaignStatus, setCampaignStatus] = useState(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState(['reddit', 'facebook']);
  const [campaignResults, setCampaignResults] = useState(null);

  useEffect(() => {
    fetchCampaignStatus();
  }, [businessId]);

  const fetchCampaignStatus = async () => {
    try {
      const response = await fetch(`/api/social-selling?businessId=${businessId}`);
      const data = await response.json();
      setCampaignStatus(data);
    } catch (error) {
      console.error('Error fetching campaign status:', error);
    }
  };

  const launchCampaign = async () => {
    setIsLaunching(true);
    try {
      const response = await fetch('/api/social-selling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          platforms: selectedPlatforms,
          options: {
            priority: 'high_conversion'
          }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setCampaignResults(data);
        fetchCampaignStatus(); // Refresh status
      } else {
        alert('Failed to launch campaign: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error launching campaign:', error);
      alert('Error launching campaign');
    } finally {
      setIsLaunching(false);
    }
  };

  const stopCampaign = async () => {
    setIsStopping(true);
    try {
      const response = await fetch(`/api/social-selling?businessId=${businessId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        setCampaignResults(null);
        fetchCampaignStatus(); // Refresh status
      } else {
        alert('Failed to stop campaign: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error stopping campaign:', error);
      alert('Error stopping campaign');
    } finally {
      setIsStopping(false);
    }
  };

  const platformInfo = {
    reddit: {
      name: 'Reddit Infiltration',
      icon: '🔴',
      strategy: 'Monitor subreddits, drop helpful answers, DM positive engagers',
      priority: 'Primary - Highest intent'
    },
    facebook: {
      name: 'Facebook Group Harvesting',
      icon: '📘', 
      strategy: 'Join groups, identify active members, friend requests + value DMs',
      priority: 'Primary - High conversion'
    },
    linkedin: {
      name: 'LinkedIn Outbound',
      icon: '💼',
      strategy: 'Search job titles, connection requests, case study follow-ups',
      priority: 'Secondary - Professional network'
    },
    twitter: {
      name: 'Twitter Reply Guy',
      icon: '🐦',
      strategy: 'Reply to big accounts, DM everyone who likes your replies',
      priority: 'Secondary - Broad reach'
    },
    instagram: {
      name: 'Instagram DM Campaign',
      icon: '📸',
      strategy: 'Find competitors\' followers, engage first, then value DMs',
      priority: 'Secondary - Visual engagement'
    }
  };

  if (!campaignStatus) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-2">🎯 Direct Social Selling</h2>
        <p className="text-blue-100">
          Forget "post 3x daily and hope for engagement." This is direct social selling - 
          finding buyers and converting them where they already hang out.
        </p>
      </div>

      {/* Strategy Overview */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-yellow-400 text-xl">💡</span>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-yellow-800">
              The Architecture: Find → Engage → Convert
            </h3>
            <p className="text-yellow-700 mt-1">
              <strong>Discovery Bot:</strong> Finds relevant groups/forums/hashtags<br/>
              <strong>Engagement Bot:</strong> Builds warm lead list through strategic engagement<br/>
              <strong>Conversion Bot:</strong> Sends personalized DMs and books calls
            </p>
          </div>
        </div>
      </div>

      {/* Platform Selection */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Platform Strategy</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {Object.entries(platformInfo).map(([platform, info]) => (
            <div
              key={platform}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedPlatforms.includes(platform)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => {
                if (selectedPlatforms.includes(platform)) {
                  setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
                } else {
                  setSelectedPlatforms([...selectedPlatforms, platform]);
                }
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{info.icon}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  info.priority.includes('Primary') 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {info.priority.split(' - ')[0]}
                </span>
              </div>
              <h4 className="font-medium text-gray-900 mb-1">{info.name}</h4>
              <p className="text-sm text-gray-600 mb-2">{info.strategy}</p>
              <p className="text-xs text-gray-500">{info.priority}</p>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-4">
          <p className="text-sm text-blue-800">
            <strong>Recommended:</strong> Start with Reddit + Facebook Groups (highest intent, easiest automation, least likely to get banned).
            Add LinkedIn for B2B. Skip TikTok/YouTube (too content-heavy).
          </p>
        </div>
      </div>

      {/* Campaign Controls */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Campaign Management</h3>
        
        {!campaignStatus.hasActiveCampaign ? (
          <div>
            <p className="text-gray-600 mb-4">
              Selected platforms: {selectedPlatforms.map(p => platformInfo[p].name).join(', ')}
            </p>
            <button
              onClick={launchCampaign}
              disabled={isLaunching || selectedPlatforms.length === 0}
              className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLaunching ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Launching Campaign...
                </span>
              ) : (
                '🚀 Launch Social Selling Campaign'
              )}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-green-600 font-medium">✅ Campaign Active</p>
                <p className="text-sm text-gray-600">
                  Last launched: {campaignStatus.lastCampaign?.created_at ? 
                    new Date(campaignStatus.lastCampaign.created_at).toLocaleString() : 
                    'Unknown'
                  }
                </p>
              </div>
              <button
                onClick={stopCampaign}
                disabled={isStopping}
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {isStopping ? 'Stopping...' : '⏹️ Stop Campaign'}
              </button>
            </div>

            {campaignResults && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Campaign Results</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Estimated Reach</p>
                    <p className="font-semibold">{campaignResults.campaign.estimatedReach?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Conversions</p>
                    <p className="font-semibold">{campaignResults.campaign.estimatedConversions || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">First Sale ETA</p>
                    <p className="font-semibold">{campaignResults.campaign.estimatedFirstSale || 'TBD'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Platforms</p>
                    <p className="font-semibold">{campaignResults.campaign.platforms?.length || 0}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* How It Works */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">How Direct Social Selling Works</h3>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">1</span>
            <div>
              <h4 className="font-medium">Reddit/Forum Infiltration</h4>
              <p className="text-gray-600 text-sm">Monitor subreddits for problems your product solves. Drop helpful answers with soft pitch at the end. DM people who engage positively.</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">2</span>
            <div>
              <h4 className="font-medium">Facebook Group Harvesting</h4>
              <p className="text-gray-600 text-sm">Join 20-30 niche groups. Scrape members who engage with relevant posts. Send friend requests → warm DMs with value-first approach.</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">3</span>
            <div>
              <h4 className="font-medium">LinkedIn Outbound</h4>
              <p className="text-gray-600 text-sm">Search job titles that match ideal customer. Send 50-100 connection requests daily with personalized notes. Follow up with case studies, not pitches.</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">4</span>
            <div>
              <h4 className="font-medium">Twitter Reply Guy Strategy</h4>
              <p className="text-gray-600 text-sm">Monitor keywords in your niche. Reply to big accounts' tweets with valuable insights. DM everyone who likes your replies.</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">5</span>
            <div>
              <h4 className="font-medium">Instagram DM Campaigns</h4>
              <p className="text-gray-600 text-sm">Find competitors' followers. Engage with their posts first (like, comment). DM with "noticed you follow [competitor], thought you might like..."</p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Metrics */}
      <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
        <h4 className="font-medium text-green-800 mb-2">🎯 Success Goal</h4>
        <p className="text-green-700 text-sm">
          <strong>One client + one Facebook group + aggressive DM strategy = first sale in 48 hours.</strong>
          <br/>
          This approach can absolutely get businesses to $1000+ through direct social selling.
        </p>
      </div>
    </div>
  );
};

export default SocialSellingDashboard;
