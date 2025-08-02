import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, Globe, Bot, Clock, TrendingUp, ChevronRight, Zap, Eye, Mail, CheckCircle } from 'lucide-react';

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
  
  // Animate number increases
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
      {/* Background decoration */}
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

// --- COMPONENT: Live Website Preview ---
const LiveWebsiteCard = ({ subdomain, visitors = 0, isGenerating = false, generationStage = null, businessConcept = null, websiteContent = null, streamingContent = '' }) => {
  const [currentVisitors, setCurrentVisitors] = useState(visitors);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [displayContent, setDisplayContent] = useState(null);
  const websiteUrl = `https://${subdomain}.launchfly.ai`;
  
  // Simulate live visitors
  useEffect(() => {
    if (!isGenerating) {
      const interval = setInterval(() => {
        setCurrentVisitors(prev => Math.max(0, prev + Math.floor(Math.random() * 5 - 2)));
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  // Update generation progress based on stage
  useEffect(() => {
    if (isGenerating && generationStage) {
      const stageProgress = {
        'analyzing': 15,
        'researching': 35,
        'building': 65,
        'finalizing': 90,
        'complete': 100
      };
      
      const targetProgress = stageProgress[generationStage] || 0;
      
      // Animate progress
      const interval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev < targetProgress) {
            return Math.min(prev + 2, targetProgress);
          }
          return prev;
        });
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [isGenerating, generationStage]);

  // Update display content based on streaming data
  useEffect(() => {
    if (websiteContent) {
      setDisplayContent(websiteContent);
    } else if (businessConcept) {
      // Show basic content structure while building
      setDisplayContent({
        hero: {
          title: businessConcept.businessName,
          subtitle: businessConcept.tagline,
          ctaText: "Get Started"
        },
        theme: {
          primaryColor: "#3b82f6",
          secondaryColor: "#8b5cf6"
        }
      });
    }
  }, [websiteContent, businessConcept]);

  const getGenerationContent = () => {
    switch (generationStage) {
      case 'analyzing':
        return { title: 'Analyzing Your Business Idea...', subtitle: 'AI is studying your skills and market opportunities' };
      case 'researching':
        return { title: 'Researching Your Market...', subtitle: 'Finding your target customers and competitors' };
      case 'building':
        return { title: 'Building Your Website...', subtitle: 'Creating your professional business website' };
      case 'finalizing':
        return { title: 'Finalizing Your Business...', subtitle: 'Setting up products and payment processing' };
      case 'complete':
        return { title: 'Your Website is Live! 🎉', subtitle: websiteUrl };
      default:
        return { title: 'Your Website is Live! 🎉', subtitle: websiteUrl };
    }
  };

  const content = getGenerationContent();

  // Render live website preview during generation
  const renderLivePreview = () => {
    if (!isGenerating || !displayContent) {
      return (
        <div style={{ textAlign: 'center', color: theme.colors.textGray, padding: '60px 20px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
            {generationStage === 'building' ? 'Designing your website...' : 'Preparing your business...'}
          </p>
          <p style={{ fontSize: '14px' }}>
            Your website will appear here once it's ready
          </p>
        </div>
      );
    }

    // Show live website preview as it's being built
    const bgColor = displayContent.theme?.primaryColor || '#3b82f6';
    const secondaryColor = displayContent.theme?.secondaryColor || '#8b5cf6';
    
    return (
      <div style={{
        background: '#fff',
        minHeight: '300px',
        position: 'relative',
        fontSize: '12px',
        overflow: 'hidden'
      }}>
        {/* Mini website preview */}
        <div style={{
          background: `linear-gradient(135deg, ${bgColor} 0%, ${secondaryColor} 100%)`,
          color: 'white',
          padding: '20px',
          textAlign: 'center',
          position: 'relative'
        }}>
          {/* Hero section */}
          <div style={{
            opacity: displayContent.hero ? 1 : 0.3,
            transition: 'opacity 0.5s ease-in-out'
          }}>
            <h1 style={{ 
              fontSize: '18px', 
              fontWeight: 'bold', 
              margin: '0 0 8px 0',
              lineHeight: '1.2'
            }}>
              {displayContent.hero?.title || 'Your Business Name'}
            </h1>
            <p style={{ 
              fontSize: '12px', 
              opacity: 0.9, 
              margin: '0 0 16px 0' 
            }}>
              {displayContent.hero?.subtitle || 'Professional solutions for your success'}
            </p>
            <div style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '8px 16px',
              borderRadius: '20px',
              display: 'inline-block',
              fontSize: '10px',
              fontWeight: '600'
            }}>
              {displayContent.hero?.ctaText || 'Get Started'}
            </div>
          </div>

          {/* Streaming content indicator */}
          {streamingContent && (
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'rgba(255,255,255,0.2)',
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <div style={{
                width: '4px',
                height: '4px',
                background: '#10b981',
                borderRadius: '50%',
                animation: 'pulse 1s infinite'
              }} />
              Generating...
            </div>
          )}
        </div>

        {/* Features section */}
        <div style={{ padding: '16px', background: '#f9fafb' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            opacity: displayContent.features ? 1 : 0.3,
            transition: 'opacity 0.5s ease-in-out'
          }}>
            {(displayContent.features || [{}, {}, {}]).slice(0, 3).map((feature, i) => (
              <div key={i} style={{
                textAlign: 'center',
                padding: '8px',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '16px', marginBottom: '4px' }}>
                  {feature.icon || '⚡'}
                </div>
                <div style={{ fontSize: '8px', fontWeight: '600', marginBottom: '2px' }}>
                  {feature.title || 'Feature'}
                </div>
                <div style={{ fontSize: '7px', color: '#666', lineHeight: '1.2' }}>
                  {feature.description || 'Coming soon...'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Products/pricing section */}
        {displayContent.products && displayContent.products.length > 0 && (
          <div style={{ padding: '16px', background: 'white' }}>
            <div style={{
              textAlign: 'center',
              opacity: displayContent.products ? 1 : 0.3,
              transition: 'opacity 0.5s ease-in-out'
            }}>
              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
                background: '#f9fafb'
              }}>
                <div style={{ fontSize: '10px', fontWeight: '600', marginBottom: '4px' }}>
                  {displayContent.products[0].name}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: bgColor, marginBottom: '4px' }}>
                  {displayContent.products[0].price}
                </div>
                <div style={{ fontSize: '7px', color: '#666' }}>
                  {displayContent.products[0].description}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live building overlay */}
        {isGenerating && (
          <div style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            background: 'rgba(59, 130, 246, 0.95)',
            color: 'white',
            padding: '8px 12px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              background: '#10b981',
              borderRadius: '50%',
              animation: 'pulse 1s infinite'
            }} />
            <span>Building in real-time...</span>
            <div style={{ marginLeft: 'auto' }}>
              {generationProgress}%
            </div>
          </div>
        )}
      </div>
    );
  };

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
        background: isGenerating ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : theme.gradients.purple,
        padding: '24px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
              {content.title}
            </h2>
            <p style={{ opacity: 0.9, marginBottom: '16px' }}>{content.subtitle}</p>
            
            {/* Generation Progress Bar */}
            {isGenerating && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #10b981, #34d399)',
                    width: `${generationProgress}%`,
                    transition: 'width 0.3s ease',
                    boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
                  }} />
                </div>
                <p style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                  {generationProgress}% complete
                </p>
              </div>
            )}
            
            {/* Live visitor count or completion status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {!isGenerating ? (
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
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#fbbf24',
                    borderRadius: '50%',
                    animation: 'pulse 1s infinite'
                  }} />
                  <span style={{ fontWeight: '600' }}>Building in progress...</span>
                </div>
              )}
            </div>
          </div>
          
          {!isGenerating && (
            <a 
              href={websiteUrl} 
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
      
      {/* Website Preview */}
      <div style={{
        height: '300px',
        position: 'relative',
        background: isGenerating ? '#f3f4f6' : '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {isGenerating ? renderLivePreview() : (
          <>
            <iframe
              src={websiteUrl}
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
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, transparent 70%, rgba(255,255,255,0.9) 100%)'
            }} />
          </>
        )}
      </div>
    </div>
  );
};

// --- COMPONENT: AI Activity Feed ---
const AIActivityFeed = ({ isGenerating = false, generationStage = null, streamingContent = '', businessConcept = null }) => {
  const [activities, setActivities] = useState([]);

  // Generation stage activities for real-time progress
  const generationStages = {
    'analyzing': [
      { type: 'analyze', text: 'Analyzing your skills and experience ✅', icon: '🧠', completed: true },
      { type: 'analyze', text: 'Identifying profitable opportunities...', icon: '🎯', inProgress: true }
    ],
    'researching': [
      { type: 'analyze', text: 'Analyzing your skills and experience ✅', icon: '🧠', completed: true },
      { type: 'research', text: 'Researching your target market ✅', icon: '🔍', completed: true },
      { type: 'research', text: 'Finding competitor insights...', icon: '📊', inProgress: true }
    ],
    'building': [
      { type: 'analyze', text: 'Analyzing your skills and experience ✅', icon: '🧠', completed: true },
      { type: 'research', text: 'Researching your target market ✅', icon: '🔍', completed: true },
      { type: 'build', text: businessConcept ? `Building "${businessConcept.businessName}" ✅` : 'Building your website ✅', icon: '🏗️', completed: true },
      { type: 'build', text: 'Creating your products...', icon: '📦', inProgress: true }
    ],
    'finalizing': [
      { type: 'analyze', text: 'Analyzing your skills and experience ✅', icon: '🧠', completed: true },
      { type: 'research', text: 'Researching your target market ✅', icon: '🔍', completed: true },
      { type: 'build', text: businessConcept ? `Built "${businessConcept.businessName}" ✅` : 'Building your website ✅', icon: '🏗️', completed: true },
      { type: 'build', text: 'Creating your products ✅', icon: '📦', completed: true },
      { type: 'finalize', text: 'Setting up payment processing...', icon: '💳', inProgress: true }
    ],
    'complete': [
      { type: 'analyze', text: 'Analyzing your skills and experience ✅', icon: '🧠', completed: true },
      { type: 'research', text: 'Researching your target market ✅', icon: '🔍', completed: true },
      { type: 'build', text: businessConcept ? `Built "${businessConcept.businessName}" ✅` : 'Built your website ✅', icon: '🏗️', completed: true },
      { type: 'build', text: 'Created your products ✅', icon: '📦', completed: true },
      { type: 'finalize', text: 'Your business is ready! ✅', icon: '🚀', completed: true }
    ]
  };

  // Set activities based on generation stage
  useEffect(() => {
    if (isGenerating && generationStage && generationStages[generationStage]) {
      let stageActivities = [...generationStages[generationStage]];
      
      // Add streaming content indicator if we have streaming data
      if (streamingContent && generationStage === 'building') {
        stageActivities = stageActivities.map((activity, index) => {
          if (activity.inProgress && activity.type === 'build') {
            return {
              ...activity,
              text: 'Generating website content in real-time...',
              streamingText: streamingContent.length > 100 ? 
                streamingContent.substring(streamingContent.length - 100) + '...' : 
                streamingContent
            };
          }
          return activity;
        });
      }
      
      setActivities(stageActivities);
    } else if (!isGenerating) {
      // Default activities when not generating
      const defaultActivities = [
        { id: 1, type: 'lead', text: 'Found 12 potential customers in your niche', time: 'Just now', icon: '🔍' },
        { id: 2, type: 'email', text: 'Sarah from TechCorp opened your email!', time: '2 min ago', icon: '📧', highlight: true },
        { id: 3, type: 'money', text: '82% chance of $297 sale today', time: '5 min ago', icon: '💰' },
      ];
      
      setActivities(defaultActivities);
      
      // Add periodic updates for completed businesses
      const interval = setInterval(() => {
        const messages = [
          { type: 'lead', text: 'Analyzing competitor pricing strategies', icon: '📊' },
          { type: 'email', text: 'Sent follow-up to warm lead', icon: '📤' },
          { type: 'traffic', text: 'New visitor from LinkedIn!', icon: '🔗' },
          { type: 'optimization', text: 'Improved email subject line', icon: '✨' },
        ];

        const newActivity = {
          id: Date.now(),
          ...messages[Math.floor(Math.random() * messages.length)],
          time: 'Just now'
        };
        
        setActivities(prev => [newActivity, ...prev.slice(0, 2)]);
      }, 15000);

      return () => clearInterval(interval);
    }
  }, [isGenerating, generationStage, streamingContent, businessConcept]);

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
          background: isGenerating ? theme.gradients.purple : theme.gradients.primary,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Bot size={24} color="white" />
        </div>
        <h3 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark }}>
          {isGenerating ? 'AI Building Your Business' : 'AI Working For You'}
        </h3>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              style={{
                width: '6px',
                height: '6px',
                background: isGenerating ? '#8b5cf6' : theme.colors.primary,
                borderRadius: '50%',
                animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite`
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {activities.map((activity, index) => {
          const isCompleted = activity.completed;
          const isInProgress = activity.inProgress;
          
          return (
            <div
              key={activity.id || index}
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'start',
                opacity: isGenerating ? 1 : (index === 0 ? 1 : 0.8 - (index * 0.2)),
                transform: `translateX(${index === 0 ? 0 : index * 5}px)`,
                transition: 'all 0.3s'
              }}
            >
              <span style={{ fontSize: '20px' }}>{activity.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ 
                  fontSize: '15px',
                  color: isCompleted ? theme.colors.success : 
                        isInProgress ? theme.colors.primary :
                        activity.highlight ? theme.colors.success : theme.colors.textDark,
                  fontWeight: isCompleted || isInProgress || activity.highlight ? '600' : '500'
                }}>
                  {activity.text}
                  {isInProgress && (
                    <span style={{ 
                      marginLeft: '8px',
                      animation: 'pulse 1.5s infinite'
                    }}>
                      ⚡
                    </span>
                  )}
                </p>
                
                {/* Show streaming content for building activities */}
                {activity.streamingText && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    background: '#f3f4f6',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: theme.colors.textGray,
                    maxHeight: '60px',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '4px',
                      right: '8px',
                      background: '#10b981',
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      animation: 'pulse 1s infinite'
                    }} />
                    {activity.streamingText}
                  </div>
                )}
                
                <p style={{ fontSize: '13px', color: theme.colors.textGray }}>
                  {activity.time || (isCompleted ? 'Completed' : isInProgress ? 'In progress...' : 'Just now')}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- COMPONENT: Success Predictor ---
const SuccessPredictor = ({ isSetupComplete }) => {
  const [probability, setProbability] = useState(72);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setProbability(prev => Math.min(95, prev + Math.random() * 2));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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
            {isSetupComplete ? 'Within 24-48 hours' : 'Setup needed first'}
          </p>
        </div>
        <div>
          <p style={{ fontSize: '14px', color: '#92400e', marginBottom: '4px' }}>Today's Chance</p>
          <p style={{ fontSize: '24px', fontWeight: '800', color: '#78350f' }}>
            {probability}%
          </p>
        </div>
      </div>

      {!isSetupComplete && (
        <p style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(245, 158, 11, 0.2)',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#92400e',
          fontWeight: '500'
        }}>
          ⚡ Complete Stripe setup to start receiving payments
        </p>
      )}
    </div>
  );
};

// --- COMPONENT: Simple Next Steps ---
const NextSteps = ({ onComplete }) => {
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

  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: theme.shadows.lg
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
  const [streamingData, setStreamingData] = useState({
    businessConcept: null,
    websiteContent: null,
    streamingContent: '',
    currentStage: null
  });
  
  // Determine if business is being generated
  const isGenerating = session?.stage && !['complete', 'error'].includes(session.stage);
  const generationStage = session?.stage || 'complete';
  
  // Mock data for demonstration
  const businessData = {
    subdomain: business?.subdomain || business?.name?.toLowerCase().replace(/\s+/g, '-') || 'your-business',
    totalRevenue: business?.total_revenue || 0,
    projectedRevenue: 2100,
    visitors: isGenerating ? 0 : 23
  };

  // Handle streaming generation data
  useEffect(() => {
    if (isGenerating && session?.id && business?.id && !streamingData.businessConcept) {
      startStreamingGeneration();
    }
  }, [isGenerating, session?.id, business?.id]);

  const startStreamingGeneration = async () => {
    try {
      const response = await fetch('/api/generate-business-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          businessId: business.id,
          formData: business.form_data
        })
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamingData(data);
            } catch (e) {
              console.error('Error parsing streaming data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming generation error:', error);
    }
  };

  const handleStreamingData = (data) => {
    switch (data.type) {
      case 'concept_chunk':
        setStreamingData(prev => ({
          ...prev,
          streamingContent: data.accumulated
        }));
        break;
        
      case 'concept_complete':
        setStreamingData(prev => ({
          ...prev,
          businessConcept: data.concept,
          streamingContent: ''
        }));
        break;
        
      case 'website_chunk':
        setStreamingData(prev => ({
          ...prev,
          streamingContent: data.accumulated
        }));
        
        // Try to parse partial JSON for live updates
        try {
          const partialData = JSON.parse(data.accumulated);
          if (partialData.hero || partialData.features) {
            setStreamingData(prev => ({
              ...prev,
              websiteContent: partialData
            }));
          }
        } catch (e) {
          // Partial JSON, continue streaming
        }
        break;
        
      case 'complete':
        setStreamingData(prev => ({
          ...prev,
          websiteContent: data.businessData.website,
          streamingContent: ''
        }));
        break;
        
      case 'progress':
        setStreamingData(prev => ({
          ...prev,
          currentStage: data.stage
        }));
        break;
    }
  };

  // Simulate earnings for completed businesses
  useEffect(() => {
    if (setupComplete && !isGenerating) {
      const timer = setTimeout(() => {
        setTotalEarned(297);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [setupComplete, isGenerating]);

  const handleStepComplete = (stepId) => {
    console.log('Completing step:', stepId);
    if (stepId === 'stripe') {
      setSetupComplete(true);
    }
    // Call parent handler if provided
    if (onStepComplete) {
      onStepComplete(stepId);
    }
  };

  const handlePhoneCapture = (phoneNumber) => {
    console.log('Phone captured:', phoneNumber);
    // Call parent handler if provided
    if (onPhoneCapture) {
      onPhoneCapture(phoneNumber);
    }
  };

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

      {/* Main Content - Mobile First */}
      <main style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '0 24px'
      }}>
        {/* Money Hero - Show different content during generation */}
        <MoneyHero 
          totalEarned={isGenerating ? 0 : totalEarned}
          projectedThisWeek={isGenerating ? 0 : businessData.projectedRevenue}
          canCashOut={!isGenerating && totalEarned > 0}
        />

        {/* Live Website Preview with Generation Status */}
        <LiveWebsiteCard 
          subdomain={businessData.subdomain}
          visitors={businessData.visitors}
          isGenerating={isGenerating}
          generationStage={streamingData.currentStage || generationStage}
          businessConcept={streamingData.businessConcept}
          websiteContent={streamingData.websiteContent}
          streamingContent={streamingData.streamingContent}
        />

        {/* AI Activity with Generation Progress */}
        <AIActivityFeed 
          isGenerating={isGenerating}
          generationStage={streamingData.currentStage || generationStage}
          streamingContent={streamingData.streamingContent}
          businessConcept={streamingData.businessConcept}
        />

        {/* Show success predictor and next steps only after generation */}
        {!isGenerating && (
          <>
            <SuccessPredictor isSetupComplete={setupComplete} />
            
            {!setupComplete && (
              <NextSteps onComplete={handleStepComplete} />
            )}
          </>
        )}

        {/* Generation completion message */}
        {isGenerating && generationStage === 'complete' && (
          <div style={{
            background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
            borderRadius: '20px',
            padding: '32px',
            textAlign: 'center',
            color: 'white',
            marginBottom: '24px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '12px' }}>
              Your Business is Ready!
            </h2>
            <p style={{ fontSize: '18px', opacity: 0.9, marginBottom: '24px' }}>
              Your AI-powered business has been successfully created and is now live.
            </p>
            <div style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '12px',
              padding: '16px',
              display: 'inline-block'
            }}>
              <p style={{ fontSize: '14px', marginBottom: '8px' }}>Ready to start earning? Complete your setup:</p>
              <div style={{ display: 'flex', gap: '24px', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={16} />
                  <span style={{ fontSize: '14px' }}>Business Created</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={16} />
                  <span style={{ fontSize: '14px' }}>Website Live</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} />
                  <span style={{ fontSize: '14px' }}>Setup Pending</span>
                </div>
              </div>
            </div>
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

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LaunchflyDashboard;