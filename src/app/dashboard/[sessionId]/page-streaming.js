// app/dashboard/[sessionId]/page.js
'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useBusinessStream } from '@/hooks/useBusinessStream';
import LiveWebsitePreview from '@/components/LiveWebsitePreview';
import EnhancedAIActivityFeed from '@/components/EnhancedAIActivityFeed';

const theme = {
  colors: {
    primary: '#007BFF',
    primaryDark: '#0056b3',
    success: '#28a745',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    white: '#ffffff',
    borderLight: '#E4E7EB',
    orange: '#f59e0b',
  },
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.1)',
    md: '0 4px 8px rgba(26, 43, 72, 0.1)',
    lg: '0 12px 20px rgba(26, 43, 72, 0.1)',
    xl: '0 24px 32px rgba(26, 43, 72, 0.12)',
  },
  gradients: {
    primary: 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)',
    success: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
    purple: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
  }
};

export default function StreamingDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const [sessionData, setSessionData] = useState(null);
  const [businessData, setBusinessData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shouldStartStreaming, setShouldStartStreaming] = useState(false);
  
  const supabase = createClientComponentClient();

  // Use our streaming hook
  const {
    businessData: streamBusinessData,
    activities,
    currentActivity,
    isStreaming,
    error: streamError
  } = useBusinessStream(
    params.sessionId,
    businessData?.id,
    businessData?.form_data,
    shouldStartStreaming
  );

  useEffect(() => {
    loadInitialData();
  }, []);

  // Update business data from stream
  useEffect(() => {
    if (streamBusinessData) {
      setBusinessData(prev => ({
        ...prev,
        business_data: streamBusinessData,
        name: streamBusinessData.business_name || prev?.name,
        subdomain: streamBusinessData.subdomain || prev?.subdomain,
        views: streamBusinessData.views || prev?.views || 0
      }));
    }
  }, [streamBusinessData]);

  async function loadInitialData() {
    try {
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*, business:businesses(*)')
        .eq('id', params.sessionId)
        .single();

      if (sessionError) throw sessionError;

      console.log('Session loaded:', session);
      setSessionData(session);
      setBusinessData(session.business);
      setLoading(false);

      // Start streaming if session is pending
      if (session.stage === 'pending' && session.business) {
        console.log('Starting streaming generation...');
        setShouldStartStreaming(true);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  }

  const handlePhoneCapture = async (phoneNumber) => {
    try {
      await fetch('/api/phone/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: params.sessionId,
          phoneNumber
        })
      });
      
      // Update local state
      setBusinessData(prev => ({
        ...prev,
        phone_number: phoneNumber
      }));
    } catch (error) {
      console.error('Phone capture error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!sessionData || !businessData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Session Not Found</h1>
          <p className="text-gray-600">The dashboard session could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: theme.colors.bgLight }} className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-2xl mr-2">🚀</span>
              <h1 className="text-xl font-bold text-gray-800">Launchfly Dashboard</h1>
            </div>
            <div className="text-sm text-gray-600">
              {businessData?.name || 'Your Business'}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Stats */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-3xl font-bold text-green-600">
                  ${streamBusinessData?.revenue || 0}
                </div>
                <div className="text-gray-600">Total Earned</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-600">
                  {businessData?.views || 0}
                </div>
                <div className="text-gray-600">Website Visitors</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600">
                  {isStreaming ? '🔄' : '✅'}
                </div>
                <div className="text-gray-600">
                  {isStreaming ? 'Building...' : 'Ready'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Live Website Preview */}
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">🌐</span>
              Live Website Preview
            </h2>
            <LiveWebsitePreview 
              businessData={streamBusinessData}
              isStreaming={isStreaming}
              activities={activities}
            />
            
            {/* Website Link */}
            {businessData?.subdomain && !isStreaming && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-green-800">Your website is live!</div>
                    <div className="text-green-600 text-sm">
                      https://{businessData.subdomain}.launchfly.ai
                    </div>
                  </div>
                  <a
                    href={`https://${businessData.subdomain}.launchfly.ai`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Visit Site
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* AI Activity Feed */}
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">AI Progress</h2>
            <EnhancedAIActivityFeed 
              activities={activities}
              currentActivity={currentActivity}
              isStreaming={isStreaming}
            />
            
            {/* Phone Capture */}
            {!businessData?.phone_number && !isStreaming && (
              <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-gray-800 mb-3">Get Instant Notifications</h3>
                <p className="text-gray-600 mb-4">
                  Enter your phone number to get alerts when visitors arrive and sales happen!
                </p>
                <div className="flex space-x-3">
                  <input
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handlePhoneCapture(e.target.value);
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const input = e.target.parentElement.querySelector('input');
                      handlePhoneCapture(input.value);
                    }}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Subscribe
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {streamError && (
          <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <span className="text-red-500 text-xl mr-2">⚠️</span>
              <div>
                <div className="font-medium text-red-800">Generation Error</div>
                <div className="text-red-600 text-sm">{streamError}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
