// src/app/ai-activity/[businessId]/page.js
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import AIActivityTimeline from '../../../components/ai-activity/ActivityTimeline';
import AIChat from '../../../components/ai-activity/AIChat';
import ActivityStats from '../../../components/ai-activity/ActivityStats';
import ActivityDetailModal from '../../../components/ai-activity/ActivityDetailModal';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';

export default function AIActivityPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [activities, setActivities] = useState([]);
  const [businessData, setBusinessData] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalActivities: 0,
    emailsSent: 0,
    prospectsFound: 0,
    meetingsBooked: 0,
    responseRate: 0
  });
  
  const activitiesRef = useRef(null);

  useEffect(() => {
    loadBusinessData();
    loadActivities();
    setupRealtimeSubscription();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(loadActivities, 5000);
    
    return () => {
      clearInterval(interval);
      // Clean up realtime subscription
      supabase.channel('ai-activities').unsubscribe();
    };
  }, [params.businessId]);

  async function loadBusinessData() {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', params.businessId)
        .single();
      
      if (error) throw error;
      setBusinessData(data);
    } catch (error) {
      console.error('Error loading business:', error);
    }
  }

  async function loadActivities() {
    try {
      const response = await fetch(`/api/business/${params.businessId}/activities?limit=100`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setActivities(data.activities);
          calculateStats(data.activities);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading activities:', error);
      setLoading(false);
    }
  }

  function calculateStats(activities) {
    const stats = {
      totalActivities: activities.length,
      emailsSent: activities.filter(a => a.metadata?.type === 'email_sent').length,
      prospectsFound: activities.filter(a => a.metadata?.type === 'prospect_search')
        .reduce((sum, a) => sum + (a.metadata?.count || 0), 0),
      meetingsBooked: activities.filter(a => a.metadata?.type === 'meeting_booked').length,
      responseRate: 0
    };
    
    if (stats.emailsSent > 0) {
      const replies = activities.filter(a => a.metadata?.type === 'email_replied').length;
      stats.responseRate = Math.round((replies / stats.emailsSent) * 100);
    }
    
    setStats(stats);
  }

  function setupRealtimeSubscription() {
    const channel = supabase
      .channel('ai-activities')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_activities',
          filter: `business_id=eq.${params.businessId}`
        },
        (payload) => {
          console.log('New activity:', payload.new);
          // Add new activity to the top of the list
          setActivities(prev => [{
            ...payload.new,
            time: 'Just now'
          }, ...prev]);
        }
      )
      .subscribe();
  }

  const handleActivityClick = (activity) => {
    setSelectedActivity(activity);
  };

  const handleBackToDashboard = () => {
    // Find the session ID for this business
    router.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading AI activity...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={handleBackToDashboard}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeftIcon className="h-5 w-5 mr-1" />
                <span className="text-sm font-medium">Back to Dashboard</span>
              </button>
              <div className="ml-4 pl-4 border-l border-gray-300">
                <h1 className="text-xl font-semibold text-gray-900">
                  AI Activity Center
                </h1>
                {businessData && (
                  <p className="text-sm text-gray-500">
                    {businessData.business_name}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <ActivityStats stats={stats} />

        {/* Two Column Layout for Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Activity Timeline - Takes 2 columns on desktop */}
          <div className="lg:col-span-2">
            <AIActivityTimeline 
              activities={activities}
              onActivityClick={handleActivityClick}
              ref={activitiesRef}
            />
          </div>

          {/* AI Chat - Takes 1 column on desktop */}
          <div className="lg:col-span-1">
            <AIChat 
              businessId={params.businessId}
              businessData={businessData}
              onNewActivity={() => loadActivities()}
            />
          </div>
        </div>
      </div>

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          isOpen={!!selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </div>
  );
}