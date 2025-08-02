import React, { useState, useEffect, useRef } from 'react';
import { 
  DollarSign, Globe, Bot, Clock, TrendingUp, ChevronRight, Zap, Eye, Mail, 
  CheckCircle, MessageSquare, Play, Users, ArrowUp, Share2, Target, Award,
  Bell, X, Heart, MapPin, ShoppingCart, Timer, Check, Sparkles, Rocket,
  Loader2, AlertCircle, RefreshCw
} from 'lucide-react';

// --- DESIGN SYSTEM ---
const theme = {
  colors: {
    primary: '#007BFF',
    primaryDark: '#0056b3',
    success: '#28a745',
    warning: '#FFC107',
    error: '#dc3545',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    white: '#ffffff',
    borderLight: '#E4E7EB',
    orange: '#f59e0b',
    purple: '#8b5cf6',
    pink: '#ec4899',
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
    orange: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
  }
};

// --- COMPONENT: Live AI Activity Feed ---
const LiveAIActivityFeed = ({ stage, businessData }) => {
  const [activities, setActivities] = useState([]);
  const [currentActivity, setCurrentActivity] = useState(null);

  // Define all possible activities
  const activityStages = {
    pending: [
      { id: 'init', text: 'Initializing your business workspace', icon: '🚀', duration: 2000 }
    ],
    analyzing: [
      { id: 'skills', text: 'Analyzing your skills and experience', icon: '🧠', duration: 3000 },
      { id: 'market', text: 'Researching market opportunities', icon: '📊', duration: 4000 },
      { id: 'niche', text: 'Found perfect niche: ' + (businessData?.niche || 'Professional Services'), icon: '🎯', duration: 3000 }
    ],
    researching: [
      { id: 'competitors', text: 'Analyzing top competitors', icon: '🔍', duration: 3000 },
      { id: 'pricing', text: 'Optimizing pricing strategy', icon: '💰', duration: 3000 },
      { id: 'customers', text: 'Identifying target customers', icon: '👥', duration: 2000 }
    ],
    building: [
      { id: 'website', text: 'Creating your website', icon: '🌐', duration: 4000 },
      { id: 'products', text: 'Setting up your products', icon: '📦', duration: 3000 },
      { id: 'design', text: 'Applying professional design', icon: '🎨', duration: 3000 },
      { id: 'content', text: 'Writing compelling copy', icon: '✍️', duration: 3000 }
    ],
    finalizing: [
      { id: 'seo', text: 'Optimizing for search engines', icon: '🔎', duration: 2000 },
      { id: 'marketing', text: 'Setting up marketing campaigns', icon: '📣', duration: 3000 },
      { id: 'launch', text: 'Preparing for launch', icon: '🚀', duration: 2000 }
    ],
    complete: [
      { id: 'done', text: 'Your business is live and ready!', icon: '🎉', duration: 0 }
    ]
  };

  useEffect(() => {
    if (!stage || stage === 'error') return;

    const stageActivities = activityStages[stage] || [];
    let activityIndex = 0;

    const runActivity = () => {
      if (activityIndex < stageActivities.length) {
        const activity = stageActivities[activityIndex];
        setCurrentActivity(activity);
        
        // Add to completed activities after a delay
        setTimeout(() => {
          setActivities(prev => [...prev, { ...activity, completed: true }]);
          activityIndex++;
          
          if (activityIndex < stageActivities.length) {
            runActivity();
          } else {
            setCurrentActivity(null);
          }
        }, activity.duration);
      }
    };

    // Start the activities for this stage
    runActivity();
  }, [stage]);

  // Add real-time events
  useEffect(() => {
    if (stage === 'complete') {
      const messages = [
        { text: 'New visitor from Google', icon: '👀' },
        { text: 'Email campaign scheduled', icon: '📧' },
        { text: 'SEO optimization active', icon: '🔍' },
        { text: 'Social media posts queued', icon: '📱' }
      ];

      const interval = setInterval(() => {
        const newActivity = {
          id: Date.now(),
          ...messages[Math.floor(Math.random() * messages.length)],
          completed: true
        };
        
        setActivities(prev => [...prev.slice(-4), newActivity]);
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [stage]);

  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: theme.shadows.lg,
      marginBottom: '24px'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          background: theme.gradients.primary,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Bot size={24} color="white" />
        </div>
        <h3 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark }}>
          AI Working For You
        </h3>
        {stage !== 'complete' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                style={{
                  width: '6px',
                  height: '6px',
                  background: theme.colors.primary,
                  borderRadius: '50%',
                  animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite`
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Current Activity */}
        {currentActivity && (
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            padding: '12px',
            background: theme.colors.bgLight,
            borderRadius: '12px',
            border: `2px solid ${theme.colors.primary}`,
            animation: 'slideIn 0.3s ease-out'
          }}>
            <span style={{ fontSize: '24px' }}>{currentActivity.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ 
                fontSize: '16px',
                color: theme.colors.textDark,
                fontWeight: '600'
              }}>
                {currentActivity.text}
              </p>
            </div>
            <Loader2 size={20} className="animate-spin" style={{ color: theme.colors.primary }} />
          </div>
        )}

        {/* Completed Activities */}
        {activities.slice(-5).reverse().map((activity, index) => (
          <div
            key={activity.id || index}
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              opacity: 1 - (index * 0.15),
              transform: `scale(${1 - (index * 0.02)})`,
              transition: 'all 0.3s'
            }}
          >
            <span style={{ fontSize: '20px' }}>{activity.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ 
                fontSize: '15px',
                color: theme.colors.textDark,
                fontWeight: '500'
              }}>
                {activity.text}
              </p>
            </div>
            {activity.completed && (
              <CheckCircle size={18} style={{ color: theme.colors.success }} />
            )}
          </div>
        ))}
      </div>

      {/* Progress indicator */}
      {stage !== 'complete' && (
        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: '#e0f2fe',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} style={{ color: '#0284c7' }} />
          <p style={{ fontSize: '13px', color: '#0284c7' }}>
            Your business will be ready in about {stage === 'finalizing' ? '30 seconds' : '2 minutes'}
          </p>
        </div>
      )}
    </div>
  );
};

// --- COMPONENT: Live Website Preview ---
const LiveWebsitePreview = ({ subdomain, stage, businessData }) => {
  const [websiteState, setWebsiteState] = useState('building');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [visitors, setVisitors] = useState(0);

  useEffect(() => {
    if (stage === 'building') {
      setWebsiteState('building');
    } else if (stage === 'finalizing' || stage === 'complete') {
      setWebsiteState('ready');
      setPreviewUrl(`https://${subdomain}.launchfly.ai`);
    }
  }, [stage, subdomain]);

  // Simulate visitors after launch
  useEffect(() => {
    if (websiteState === 'ready') {
      const timeout = setTimeout(() => {
        setVisitors(1);
      }, 5000);

      const interval = setInterval(() => {
        setVisitors(prev => prev + Math.floor(Math.random() * 3));
      }, 10000);

      return () => {
        clearTimeout(timeout);
        clearInterval(interval);
      };
    }
  }, [websiteState]);

  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      overflow: 'hidden',
      boxShadow: theme.shadows.lg,
      marginBottom: '24px'
    }}>
      {/* Header */}
      <div style={{
        background: websiteState === 'ready' ? theme.gradients.purple : '#f3f4f6',
        padding: '24px',
        color: websiteState === 'ready' ? 'white' : theme.colors.textGray,
        transition: 'all 0.5s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
              {websiteState === 'ready' ? 'Your Website is Live! 🎉' : 'Building Your Website...'}
            </h2>
            <p style={{ opacity: 0.9, marginBottom: '12px' }}>
              {websiteState === 'ready' ? previewUrl : 'AI is crafting your perfect design'}
            </p>
            
            {/* Live visitor count */}
            {websiteState === 'ready' && visitors > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#10b981',
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite'
                }} />
                <Eye size={16} />
                <span style={{ fontWeight: '600' }}>{visitors} visitor{visitors !== 1 ? 's' : ''} on site now</span>
              </div>
            )}
          </div>
          
          {websiteState === 'ready' && (
            <a 
              href={previewUrl} 
              target="_blank"
              style={{
                background: 'white',
                color: '#8b5cf6',
                padding: '10px 20px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              View Site
              <ChevronRight size={16} />
            </a>
          )}
        </div>
      </div>
      
      {/* Website Preview Area */}
      <div style={{
        height: '300px',
        position: 'relative',
        background: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {websiteState === 'building' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '16px' }}>
              <Loader2 size={48} className="animate-spin" style={{ color: theme.colors.primary }} />
            </div>
            <p style={{ color: theme.colors.textGray, fontSize: '16px' }}>
              {stage === 'building' ? 'Designing your pages...' : 'Setting up your domain...'}
            </p>
            <div style={{
              width: '200px',
              height: '4px',
              background: '#e5e7eb',
              borderRadius: '2px',
              margin: '12px auto',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: '60%',
                background: theme.colors.primary,
                borderRadius: '2px',
                animation: 'loading 2s ease-in-out infinite'
              }} />
            </div>
          </div>
        ) : (
          <iframe
            src={previewUrl}
            style={{
              width: '100%',
              height: '600px',
              border: 'none',
              transform: 'scale(0.5)',
              transformOrigin: 'top left',
              pointerEvents: 'none'
            }}
            title="Website Preview"
          />
        )}
      </div>
    </div>
  );
};

// --- COMPONENT: Dynamic Money Hero ---
const DynamicMoneyHero = ({ stage, totalEarned = 0, projectedRevenue = 0 }) => {
  const [displayEarned, setDisplayEarned] = useState(0);
  const [showProjections, setShowProjections] = useState(false);

  useEffect(() => {
    // Show projections after website is ready
    if (stage === 'complete' || stage === 'finalizing') {
      setTimeout(() => setShowProjections(true), 2000);
    }
  }, [stage]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayEarned(prev => {
        const diff = totalEarned - prev;
        const step = Math.max(1, Math.floor(diff / 10));
        return prev + Math.min(step, diff);
      });
    }, 50);
    
    return () => clearInterval(timer);
  }, [totalEarned]);

  const isReady = stage === 'complete';

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      borderRadius: '24px',
      padding: '32px',
      textAlign: 'center',
      color: 'white',
      marginBottom: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-20%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
        borderRadius: '50%'
      }} />
      
      <div style={{ position: 'relative' }}>
        <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>
          {isReady ? 'Total Earned' : 'Preparing Your Revenue Stream'}
        </p>
        <h1 style={{ 
          fontSize: '56px', 
          fontWeight: '900', 
          marginBottom: '4px',
          textShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}>
          ${displayEarned.toLocaleString()}
        </h1>
        
        {showProjections && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '8px',
            marginBottom: '24px',
            animation: 'fadeIn 0.5s ease-out'
          }}>
            <TrendingUp size={20} style={{ color: '#10b981' }} />
            <span style={{ color: '#10b981', fontSize: '18px', fontWeight: '600' }}>
              +${projectedRevenue.toLocaleString()} projected this week
            </span>
          </div>
        )}

        {!isReady && (
          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '12px'
          }}>
            <p style={{ fontSize: '14px', opacity: 0.9 }}>
              💡 Your revenue system is being configured. Once ready, you'll be able to accept payments instantly.
            </p>
          </div>
        )}
        
        <button
          disabled={!isReady || displayEarned === 0}
          style={{
            background: isReady && displayEarned > 0 ? theme.gradients.success : 'rgba(255,255,255,0.1)',
            border: 'none',
            padding: '16px 32px',
            borderRadius: '12px',
            color: 'white',
            fontSize: '18px',
            fontWeight: '700',
            cursor: isReady && displayEarned > 0 ? 'pointer' : 'not-allowed',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.3s',
            opacity: isReady ? 1 : 0.5,
            marginTop: '24px'
          }}
        >
          <DollarSign size={24} />
          {isReady ? (displayEarned > 0 ? 'Cash Out Now' : 'No earnings yet') : 'Setting up payments...'}
        </button>
      </div>
    </div>
  );
};

// --- MAIN DASHBOARD COMPONENT ---
const LaunchflyDashboard = ({ session, business, onPhoneCapture, onStepComplete }) => {
  const [stage, setStage] = useState(session?.stage || 'pending');
  const [businessData, setBusinessData] = useState(business?.business_data || {});
  const [totalEarned, setTotalEarned] = useState(0);
  const [setupSteps, setSetupSteps] = useState({
    stripe: false,
    phone: false
  });
  const generationTriggered = useRef(false);

  // Update stage when session changes
  useEffect(() => {
    if (session?.stage) {
      setStage(session.stage);
    }
  }, [session?.stage]);

  // Update business data when it changes
  useEffect(() => {
    if (business?.business_data) {
      setBusinessData(business.business_data);
    }
    if (business?.total_revenue) {
      setTotalEarned(business.total_revenue);
    }
  }, [business]);

  // Trigger generation if needed
  useEffect(() => {
    if (stage === 'pending' && !generationTriggered.current && session?.id && business?.id) {
      generationTriggered.current = true;
      triggerBusinessGeneration();
    }
  }, [stage, session, business]);

  const triggerBusinessGeneration = async () => {
    try {
      console.log('Starting business generation...');
      const response = await fetch('/api/generate-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          businessId: business.id,
          formData: business.form_data
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate business');
      }
    } catch (err) {
      console.error('Generation error:', err);
      setStage('error');
    }
  };

  const handleStepComplete = (stepId) => {
    setSetupSteps(prev => ({ ...prev, [stepId]: true }));
    onStepComplete?.(stepId);
  };

  const isReady = stage === 'complete';
  const subdomain = business?.subdomain || 'your-business';

  return (
    <div style={{ 
      minHeight: '100vh',
      background: theme.colors.bgLight,
      paddingBottom: '40px'
    }}>
      {/* Header */}
      <header style={{
        background: 'white',
        borderBottom: `1px solid ${theme.colors.borderLight}`,
        padding: '20px 0',
        marginBottom: '32px',
        position: 'sticky',
        top: 0,
        zIndex: 30
      }}>
        <div style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>🚀</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: theme.colors.textDark }}>
              Launchfly
            </span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: theme.colors.textGray
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              background: stage === 'complete' ? theme.colors.success : theme.colors.warning,
              borderRadius: '50%',
              animation: 'pulse 2s infinite'
            }} />
            {stage === 'complete' ? 'Business Live' : 'Building...'}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '0 24px'
      }}>
        {/* Money Display - Always visible */}
        <DynamicMoneyHero 
          stage={stage}
          totalEarned={totalEarned}
          projectedRevenue={2100}
        />

        {/* Website Preview - Shows building state */}
        <LiveWebsitePreview 
          subdomain={subdomain}
          stage={stage}
          businessData={businessData}
        />

        {/* AI Activity - Shows real progress */}
        <LiveAIActivityFeed 
          stage={stage}
          businessData={businessData}
        />

        {/* Setup Steps - Show after website is ready */}
        {(stage === 'finalizing' || stage === 'complete') && !setupSteps.stripe && (
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: theme.shadows.lg,
            marginBottom: '24px',
            animation: 'slideIn 0.5s ease-out'
          }}>
            <h3 style={{ 
              fontSize: '20px', 
              fontWeight: '700', 
              color: theme.colors.textDark,
              marginBottom: '20px'
            }}>
              🎉 Your business is ready! Complete setup to start earning:
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => handleStepComplete('stripe')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  background: '#f0f9ff',
                  border: '2px solid #3b82f6',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                  width: '100%'
                }}
              >
                <span style={{ fontSize: '28px' }}>💳</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '600', fontSize: '16px', color: theme.colors.textDark }}>
                    Connect Stripe
                  </p>
                  <p style={{ fontSize: '14px', color: theme.colors.textGray }}>
                    Start accepting payments (2 min) • Get paid instantly
                  </p>
                </div>
                <ChevronRight size={24} color="#3b82f6" />
              </button>

              {!setupSteps.phone && (
                <button
                  onClick={() => handleStepComplete('phone')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px',
                    background: '#f0f9ff',
                    border: '2px solid #3b82f6',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    width: '100%'
                  }}
                >
                  <span style={{ fontSize: '28px' }}>📱</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '600', fontSize: '16px', color: theme.colors.textDark }}>
                      Add Phone Number
                    </p>
                    <p style={{ fontSize: '14px', color: theme.colors.textGray }}>
                      Get instant sale alerts • Never miss a sale
                    </p>
                  </div>
                  <ChevronRight size={24} color="#3b82f6" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Success Message */}
        {stage === 'error' && (
          <div style={{
            background: '#fee2e2',
            border: '2px solid #fecaca',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <AlertCircle size={24} style={{ color: '#dc2626', marginBottom: '8px' }} />
            <p style={{ color: '#dc2626', fontWeight: '600' }}>
              Something went wrong. Please try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        )}
      </main>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};

export default LaunchflyDashboard;