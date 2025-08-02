// components/LaunchflyDashboard.js
import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, Globe, Bot, Clock, TrendingUp, ChevronRight, Zap, Eye, Mail, CheckCircle, Sparkles, Loader2 } from 'lucide-react';

// --- DESIGN SYSTEM ---
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

// --- COMPONENT: Money Hero Section ---
const MoneyHero = ({ totalEarned = 0, projectedThisWeek = 0, canCashOut = false }) => {
  const [displayEarned, setDisplayEarned] = useState(totalEarned);
  
  useEffect(() => {
    if (totalEarned > displayEarned) {
      const timer = setTimeout(() => {
        setDisplayEarned(prev => Math.min(prev + 50, totalEarned));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [totalEarned, displayEarned]);

  return (
    <div className="money-hero" style={{
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
        <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>Total Earned</p>
        <h1 style={{ 
          fontSize: '56px', 
          fontWeight: '900', 
          marginBottom: '4px',
          textShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}>
          ${displayEarned.toLocaleString()}
        </h1>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '8px',
          marginBottom: '24px'
        }}>
          <TrendingUp size={20} style={{ color: '#10b981' }} />
          <span style={{ color: '#10b981', fontSize: '18px', fontWeight: '600' }}>
            +${projectedThisWeek.toLocaleString()} this week
          </span>
        </div>
        
        <button
          disabled={!canCashOut}
          style={{
            background: canCashOut ? theme.gradients.success : 'rgba(255,255,255,0.1)',
            border: 'none',
            padding: '16px 32px',
            borderRadius: '12px',
            color: 'white',
            fontSize: '18px',
            fontWeight: '700',
            cursor: canCashOut ? 'pointer' : 'not-allowed',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.3s',
            opacity: canCashOut ? 1 : 0.5
          }}
          onMouseEnter={e => canCashOut && (e.target.style.transform = 'scale(1.05)')}
          onMouseLeave={e => canCashOut && (e.target.style.transform = 'scale(1)')}
        >
          <DollarSign size={24} />
          {canCashOut ? 'Cash Out Now' : 'Nothing to cash out yet'}
        </button>
      </div>
    </div>
  );
};

// --- COMPONENT: Live Website Preview with Real-time Updates ---
const LiveWebsiteCard = ({ subdomain, visitors = 0, businessData, generationStage }) => {
  const [currentVisitors, setCurrentVisitors] = useState(visitors);
  const [showContent, setShowContent] = useState({
    skeleton: true,
    businessName: false,
    colors: false,
    hero: false,
    products: false,
    complete: false
  });
  
  const websiteUrl = subdomain ? `https://${subdomain}.launchfly.ai` : null;
  
  // Progressive content reveal based on generation stage and business data
  useEffect(() => {
    if (!businessData) return;
    
    // Show content based on what data is available
    const updates = {};
    if (businessData.businessName) updates.businessName = true;
    if (businessData.theme) updates.colors = true;
    if (businessData.tagline) updates.hero = true;
    if (businessData.products && businessData.products.length > 0) updates.products = true;
    if (generationStage === 'complete') updates.complete = true;
    
    setShowContent(prev => ({ ...prev, ...updates }));
  }, [businessData, generationStage]);
  
  // Simulate live visitors after site is complete
  useEffect(() => {
    if (showContent.complete) {
      const interval = setInterval(() => {
        setCurrentVisitors(prev => Math.max(0, prev + Math.floor(Math.random() * 5 - 2)));
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [showContent.complete]);

  const themeColors = businessData?.theme || {
    colors: { primary: '#007BFF', secondary: '#00B8D9' },
    gradient: 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)'
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      overflow: 'hidden',
      boxShadow: theme.shadows.lg,
      marginBottom: '24px',
      transition: 'all 0.5s ease'
    }}>
      {/* Header */}
      <div style={{
        background: showContent.colors ? themeColors.gradient : 'linear-gradient(135deg, #e5e7eb 0%, #f3f4f6 100%)',
        padding: '24px',
        color: showContent.colors ? 'white' : '#6b7280',
        transition: 'all 1s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              marginBottom: '8px',
              opacity: showContent.businessName ? 1 : 0.3,
              transition: 'opacity 0.5s ease'
            }}>
              {generationStage === 'complete' ? 'Your Website is Live! 🎉' : 
               showContent.businessName ? 'Your Website is Building! ✨' : 
               'Preparing your website...'}
            </h2>
            <p style={{ opacity: 0.9, marginBottom: '12px' }}>
              {websiteUrl || 'Generating your domain...'}
            </p>
            
            {/* Live status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {!showContent.complete ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontWeight: '600' }}>
                    {generationStage === 'analyzing' && 'Analyzing your business...'}
                    {generationStage === 'researching' && 'Researching your market...'}
                    {generationStage === 'building' && 'Building your website...'}
                    {generationStage === 'finalizing' && 'Adding final touches...'}
                    {generationStage === 'pending' && 'Starting AI systems...'}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#10b981',
                    borderRadius: '50%',
                    animation: 'pulse 2s infinite'
                  }} />
                  <Eye size={16} />
                  <span style={{ fontWeight: '600' }}>{currentVisitors} on site now</span>
                </div>
              )}
            </div>
          </div>
          
          {showContent.complete && websiteUrl && (
            <a 
              href={websiteUrl} 
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'white',
                color: themeColors.colors?.primary || '#8b5cf6',
                padding: '10px 20px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.3s ease',
                opacity: 0,
                animation: 'fadeInScale 0.5s ease forwards'
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
      
      {/* Website Preview with Progressive Loading */}
      <div style={{
        height: '400px',
        position: 'relative',
        background: '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Skeleton loader */}
        {!showContent.businessName && (
          <div style={{ padding: '40px', animation: 'pulse 1.5s ease-in-out infinite' }}>
            <div style={{ height: '60px', background: '#e5e7eb', borderRadius: '8px', marginBottom: '20px' }} />
            <div style={{ height: '20px', background: '#e5e7eb', borderRadius: '4px', marginBottom: '12px', width: '80%' }} />
            <div style={{ height: '20px', background: '#e5e7eb', borderRadius: '4px', width: '60%' }} />
          </div>
        )}
        
        {/* Business name appears */}
        {showContent.businessName && (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            animation: 'fadeInUp 0.8s ease forwards'
          }}>
            <h1 style={{
              fontSize: '36px',
              fontWeight: '800',
              color: showContent.colors ? (themeColors.colors?.primary || '#007BFF') : '#e5e7eb',
              marginBottom: '16px',
              transition: 'color 1s ease'
            }}>
              {businessData?.businessName || 'Your Business'}
            </h1>
            
            {/* Hero text types out */}
            {showContent.hero && (
              <p style={{
                fontSize: '18px',
                color: '#6b7280',
                maxWidth: '600px',
                margin: '0 auto'
              }}>
                {businessData?.tagline || 'Professional solutions for your success'}
              </p>
            )}
          </div>
        )}
        
        {/* Products appear */}
        {showContent.products && businessData?.products && (
          <div style={{
            display: 'flex',
            gap: '20px',
            padding: '0 40px',
            marginTop: 'auto',
            marginBottom: '40px',
            animation: 'fadeInUp 0.8s ease forwards'
          }}>
            {businessData.products.slice(0, 3).map((product, index) => (
              <div
                key={index}
                style={{
                  flex: 1,
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  opacity: 0,
                  animation: `fadeInScale 0.5s ease ${index * 0.2}s forwards`
                }}
              >
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1a2b48', marginBottom: '8px' }}>
                  {product.name}
                </h3>
                <p style={{ fontSize: '24px', fontWeight: '800', color: themeColors.colors?.primary || '#007BFF' }}>
                  {product.price}
                </p>
              </div>
            ))}
          </div>
        )}
        
        {/* Magic sparkles effect */}
        {showContent.complete && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            animation: 'sparkleExplosion 1s ease forwards'
          }}>
            <Sparkles size={48} color="#fbbf24" />
          </div>
        )}
      </div>
    </div>
  );
};

// --- COMPONENT: Real-time AI Activity Feed ---
const AIActivityFeed = ({ generationStage, businessData }) => {
  const [activities, setActivities] = useState([]);
  const [currentStage, setCurrentStage] = useState('');
  
  // Generation stage activities
  useEffect(() => {
    const stageActivities = {
      pending: { text: 'Initializing AI systems...', icon: '🤖', type: 'system' },
      analyzing: { text: 'Analyzing your skills and market opportunity ✅', icon: '🔍', type: 'success' },
      researching: { text: 'Researching profitable niches in your industry...', icon: '📊', type: 'working' },
      building: { text: 'Building your website and products...', icon: '🔨', type: 'working' },
      finalizing: { text: 'Optimizing for conversions and profit...', icon: '✨', type: 'working' },
      complete: { text: 'Your business is ready! First visitors arriving soon 🎉', icon: '🚀', type: 'success' }
    };
    
    if (generationStage && generationStage !== currentStage) {
      setCurrentStage(generationStage);
      const activity = stageActivities[generationStage];
      
      if (activity) {
        const newActivity = {
          id: Date.now(),
          ...activity,
          time: 'Just now'
        };
        
        setActivities(prev => {
          // Mark previous working items as complete
          const updated = prev.map(a => 
            a.type === 'working' ? { ...a, type: 'success', text: a.text.replace('...', ' ✅') } : a
          );
          return [newActivity, ...updated].slice(0, 5);
        });
      }
    }
  }, [generationStage, currentStage]);
  
  // Add post-generation activities
  useEffect(() => {
    if (generationStage === 'complete') {
      const timer = setTimeout(() => {
        const postActivities = [
          { text: 'Found 12 potential customers in your niche', icon: '🎯', type: 'lead' },
          { text: 'Optimizing pricing based on competitor analysis', icon: '💰', type: 'optimization' },
          { text: 'First marketing campaign launching...', icon: '📤', type: 'email' }
        ];
        
        let delay = 0;
        postActivities.forEach(activity => {
          setTimeout(() => {
            setActivities(prev => [{
              id: Date.now(),
              ...activity,
              time: 'Just now'
            }, ...prev].slice(0, 5));
          }, delay);
          delay += 3000;
        });
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [generationStage]);

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
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {activities.length === 0 ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center',
            color: theme.colors.textGray
          }}>
            <Loader2 size={32} style={{ 
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite',
              opacity: 0.5
            }} />
            <p>Initializing AI systems...</p>
          </div>
        ) : (
          activities.map((activity, index) => (
            <div
              key={activity.id}
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'start',
                opacity: index === 0 ? 1 : 0.8 - (index * 0.15),
                transform: `translateX(${index === 0 ? 0 : index * 5}px)`,
                transition: 'all 0.3s',
                animation: index === 0 ? 'slideInLeft 0.5s ease' : 'none'
              }}
            >
              <span style={{ fontSize: '20px' }}>{activity.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ 
                  fontSize: '15px',
                  color: activity.type === 'success' ? theme.colors.success : 
                         activity.type === 'working' ? theme.colors.primary : 
                         theme.colors.textDark,
                  fontWeight: activity.type === 'working' ? '600' : '500'
                }}>
                  {activity.text}
                  {activity.type === 'working' && (
                    <span style={{ 
                      display: 'inline-block',
                      marginLeft: '8px',
                      animation: 'pulse 1.5s ease-in-out infinite'
                    }}>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    </span>
                  )}
                </p>
                <p style={{ fontSize: '13px', color: theme.colors.textGray }}>{activity.time}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- COMPONENT: Success Predictor ---
const SuccessPredictor = ({ isSetupComplete, generationStage }) => {
  const [probability, setProbability] = useState(45);
  
  useEffect(() => {
    // Increase probability as generation progresses
    const probabilities = {
      pending: 45,
      analyzing: 58,
      researching: 67,
      building: 75,
      finalizing: 82,
      complete: 89
    };
    
    if (probabilities[generationStage]) {
      setProbability(probabilities[generationStage]);
    }
  }, [generationStage]);
  
  useEffect(() => {
    if (generationStage === 'complete') {
      const interval = setInterval(() => {
        setProbability(prev => Math.min(95, prev + Math.random() * 2));
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [generationStage]);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
      borderRadius: '20px',
      padding: '24px',
      marginBottom: '24px',
      border: '2px solid #fbbf24'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <Zap size={24} color="#f59e0b" />
        <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#92400e' }}>
          Success Prediction
        </h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <p style={{ fontSize: '14px', color: '#92400e', marginBottom: '4px' }}>First Sale</p>
          <p style={{ fontSize: '18px', fontWeight: '700', color: '#78350f' }}>
            {generationStage === 'complete' ? 'Within 24-48 hours' : 'Calculating...'}
          </p>
        </div>
        <div>
          <p style={{ fontSize: '14px', color: '#92400e', marginBottom: '4px' }}>Today's Chance</p>
          <p style={{ 
            fontSize: '24px', 
            fontWeight: '800', 
            color: '#78350f',
            transition: 'all 0.5s ease'
          }}>
            {probability}%
          </p>
        </div>
      </div>

      {!isSetupComplete && generationStage === 'complete' && (
        <p style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(245, 158, 11, 0.2)',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#92400e',
          fontWeight: '500',
          animation: 'fadeIn 0.5s ease'
        }}>
          ⚡ Complete Stripe setup to start receiving payments
        </p>
      )}
    </div>
  );
};

// --- COMPONENT: Simple Next Steps ---
const NextSteps = ({ onComplete, generationStage }) => {
  const steps = [
    {
      id: 'stripe',
      title: 'Connect Stripe',
      description: 'Start accepting payments (2 min)',
      icon: '💳',
      benefit: 'Get paid instantly',
      completed: false
    },
    {
      id: 'phone',
      title: 'Add Phone Number',
      description: 'Get instant sale alerts',
      icon: '📱',
      benefit: 'Never miss a sale',
      completed: false
    }
  ];

  // Only show after generation is complete
  if (generationStage !== 'complete') {
    return null;
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: theme.shadows.lg,
      animation: 'fadeInUp 0.5s ease'
    }}>
      <h3 style={{ 
        fontSize: '20px', 
        fontWeight: '700', 
        color: theme.colors.textDark,
        marginBottom: '20px'
      }}>
        Quick Setup (2 steps left)
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {steps.map(step => (
          <button
            key={step.id}
            onClick={() => onComplete(step.id)}
            disabled={step.completed}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '16px',
              background: step.completed ? '#f3f4f6' : '#f0f9ff',
              border: `2px solid ${step.completed ? '#e5e7eb' : '#3b82f6'}`,
              borderRadius: '12px',
              cursor: step.completed ? 'default' : 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left',
              width: '100%'
            }}
            onMouseEnter={e => !step.completed && (e.currentTarget.style.transform = 'translateX(4px)')}
            onMouseLeave={e => !step.completed && (e.currentTarget.style.transform = 'translateX(0)')}
          >
            <span style={{ fontSize: '28px' }}>{step.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ 
                fontWeight: '600', 
                fontSize: '16px',
                color: step.completed ? theme.colors.textGray : theme.colors.textDark
              }}>
                {step.title}
              </p>
              <p style={{ fontSize: '14px', color: theme.colors.textGray }}>
                {step.description} • {step.benefit}
              </p>
            </div>
            {step.completed ? (
              <CheckCircle size={24} color="#10b981" />
            ) : (
              <ChevronRight size={24} color="#3b82f6" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

// --- MAIN DASHBOARD COMPONENT ---
const LaunchflyDashboard = ({ session, business, onPhoneCapture, onStepComplete }) => {
  const [setupComplete, setSetupComplete] = useState(false);
  const [totalEarned, setTotalEarned] = useState(0);
  const [generationStarted, setGenerationStarted] = useState(false);
  const startedRef = useRef(false);
  
  // Start generation immediately if pending
  useEffect(() => {
    if (session?.stage === 'pending' && business && !startedRef.current) {
      startedRef.current = true;
      startGeneration();
    }
  }, [session?.stage, business]);
  
  // Simulate earnings after setup
  useEffect(() => {
    if (setupComplete && session?.stage === 'complete') {
      const timer = setTimeout(() => {
        setTotalEarned(297);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [setupComplete, session?.stage]);

  const startGeneration = async () => {
    try {
      setGenerationStarted(true);
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
        throw new Error('Generation failed');
      }
    } catch (error) {
      console.error('Error starting generation:', error);
    }
  };

  const handleStepComplete = (stepId) => {
    if (stepId === 'stripe') {
      setSetupComplete(true);
    }
    if (onStepComplete) {
      onStepComplete(stepId);
    }
  };

  const businessData = business?.business_data || {};
  const generationStage = session?.stage || 'pending';

  return (
    <div style={{ 
      minHeight: '100vh',
      background: theme.colors.bgLight,
      paddingBottom: '40px'
    }}>
      {/* Simple Header */}
      <header style={{
        background: 'white',
        borderBottom: `1px solid ${theme.colors.borderLight}`,
        padding: '20px 0',
        marginBottom: '32px',
        position: 'sticky',
        top: 0,
        zIndex: 100
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
              background: theme.colors.success,
              borderRadius: '50%',
              animation: 'pulse 2s infinite'
            }} />
            AI Active
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '0 24px'
      }}>
        {/* Money Display */}
        <MoneyHero 
          totalEarned={totalEarned}
          projectedThisWeek={businessData.monthlyRevenue ? parseInt(businessData.monthlyRevenue.replace(/[^0-9]/g, '')) / 4 : 2100}
          canCashOut={totalEarned > 0}
        />

        {/* Live Website Preview with Real-time Updates */}
        <LiveWebsiteCard 
          subdomain={business?.subdomain}
          visitors={business?.views || 0}
          businessData={businessData}
          generationStage={generationStage}
        />

        {/* Real-time AI Activity */}
        <AIActivityFeed 
          generationStage={generationStage}
          businessData={businessData}
        />

        {/* Success Predictor */}
        <SuccessPredictor 
          isSetupComplete={setupComplete}
          generationStage={generationStage}
        />

        {/* Simple Next Steps - Only show after generation */}
        {!setupComplete && (
          <NextSteps 
            onComplete={handleStepComplete}
            generationStage={generationStage}
          />
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
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes sparkleExplosion {
          0% {
            transform: translate(-50%, -50%) scale(0) rotate(0deg);
            opacity: 0;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.5) rotate(180deg);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(0) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default LaunchflyDashboard;