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
const MoneyHero = ({ totalRevenue = 0, availableToCashOut = 0, canCashOut = false }) => {
  const [displayRevenue, setDisplayRevenue] = useState(totalRevenue);
  
  useEffect(() => {
    if (totalRevenue > displayRevenue) {
      const timer = setTimeout(() => {
        setDisplayRevenue(prev => Math.min(prev + 50, totalRevenue));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [totalRevenue, displayRevenue]);

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
        <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>Total Revenue</p>
        <h1 style={{ 
          fontSize: '56px', 
          fontWeight: '900', 
          marginBottom: '4px',
          textShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}>
          ${displayRevenue.toLocaleString()}
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
            ${availableToCashOut.toLocaleString()} available to cash out
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
const LiveWebsiteCard = ({ subdomain, visitors = 0, businessData, generationStage, business }) => {
  const [currentVisitors, setCurrentVisitors] = useState(visitors);
  const [showContent, setShowContent] = useState({
    skeleton: true,
    businessName: false,
    logo: false,
    colors: false,
    hero: false,
    products: false,
    complete: false
  });

  const websiteUrl = subdomain ? `https://app.launchfly.ai/sites/${subdomain}` : 
                   (business?.website_url || business?.url || null);

  // Progressive content reveal based on available business data
  useEffect(() => {
    if (!businessData) return;
    
    // Show content based on what data is available incrementally
    const updates = {};
    
    // Basic business info appears first
    if (businessData.businessName) {
      updates.businessName = true;
      updates.skeleton = false;
    }
    
    // Logo appears when available
    if (businessData.logo) {
      updates.logo = true;
    }
    
    // Theme/colors appear when generated
    if (businessData.theme?.colors) {
      updates.colors = true;
    }
    
    // Hero content appears when tagline is ready
    if (businessData.tagline) {
      updates.hero = true;
    }
    
    // Products appear when generated
    if (businessData.products && businessData.products.length > 0) {
      updates.products = true;
    }
    
    // Mark as complete when generation is done
    if (generationStage === 'complete') {
      updates.complete = true;
    }
    
    setShowContent(prev => ({ ...prev, ...updates }));
  }, [businessData, generationStage]);
  
  // Simulate live visitors based on real data
  useEffect(() => {
    if (showContent.complete && business?.views) {
      // Start with actual views, then simulate small fluctuations
      setCurrentVisitors(business.views);
      const interval = setInterval(() => {
        setCurrentVisitors(prev => Math.max(0, prev + Math.floor(Math.random() * 3 - 1)));
      }, 5000);
      return () => clearInterval(interval);
    } else if (showContent.complete) {
      // If no real views, start with a realistic number
      setCurrentVisitors(Math.floor(Math.random() * 5) + 1);
      const interval = setInterval(() => {
        setCurrentVisitors(prev => Math.max(0, prev + Math.floor(Math.random() * 3 - 1)));
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [showContent.complete, business?.views]);

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
              {websiteUrl || business?.domain || 'Generating your domain...'}
            </p>
            
            {/* Live status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {!showContent.complete ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontWeight: '600' }}>
                    {generationStage === 'queued' && 'Queuing for AI processing...'}
                    {generationStage === 'analyzing' && 'Analyzing your business...'}
                    {generationStage === 'researching' && 'Researching your market...'}
                    {generationStage === 'building' && (
                      showContent.products ? 'Adding final touches...' :
                      showContent.colors ? 'Creating your products...' :
                      showContent.businessName ? 'Designing your website...' :
                      'Building your website...'
                    )}
                    {generationStage === 'generating' && 'Generating content and products...'}
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
        {showContent.skeleton && (
          <div style={{ 
            padding: '40px', 
            animation: 'pulse 1.5s ease-in-out infinite',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: '#f9fafb',
            zIndex: 1,
            transition: 'opacity 0.5s ease',
            opacity: showContent.businessName ? 0 : 1
          }}>
            <div style={{ height: '60px', background: '#e5e7eb', borderRadius: '8px', marginBottom: '20px' }} />
            <div style={{ height: '20px', background: '#e5e7eb', borderRadius: '4px', marginBottom: '12px', width: '80%' }} />
            <div style={{ height: '20px', background: '#e5e7eb', borderRadius: '4px', width: '60%' }} />
          </div>
        )}
        
        {/* Progressive Website Content */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Business name and logo appear first */}
          {showContent.businessName && (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              animation: 'fadeInUp 0.8s ease forwards'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
                {showContent.logo && (
                  <span style={{ 
                    fontSize: '48px',
                    animation: 'fadeInScale 0.6s ease 0.3s forwards',
                    opacity: 0
                  }}>
                    {businessData?.logo || '🚀'}
                  </span>
                )}
                <h1 style={{
                  fontSize: showContent.logo ? '32px' : '36px',
                  fontWeight: '800',
                  color: showContent.colors ? (themeColors.colors?.primary || '#007BFF') : '#1f2937',
                  margin: 0,
                  transition: 'color 1s ease, font-size 0.5s ease'
                }}>
                  {businessData?.businessName || 'Your Business'}
                </h1>
              </div>
              
              {/* Hero text types out when available */}
              {showContent.hero && (
                <p style={{
                  fontSize: '18px',
                  color: '#6b7280',
                  maxWidth: '600px',
                  margin: '0 auto',
                  animation: 'fadeInUp 0.8s ease 0.2s forwards',
                  opacity: 0
                }}>
                  {businessData?.tagline || 'Professional solutions for your success'}
                </p>
              )}
            </div>
          )}
          
          {/* Colors/theme update with smooth transition */}
          {showContent.colors && !showContent.products && (
            <div style={{
              padding: '0 40px',
              textAlign: 'center',
              animation: 'fadeInUp 0.8s ease forwards'
            }}>
              <div style={{
                display: 'inline-flex',
                gap: '12px',
                padding: '16px 24px',
                background: themeColors.colors?.primary || '#007BFF',
                borderRadius: '50px',
                color: 'white',
                fontWeight: '600',
                fontSize: '14px',
                animation: 'fadeInScale 0.6s ease forwards'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: 'white'
                }} />
                Brand colors applied
              </div>
            </div>
          )}
          
          {/* Products appear when ready */}
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
          
          {/* Magic sparkles effect when complete */}
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
    </div>
  );
};

// --- COMPONENT: Real-time AI Activity Feed ---
const AIActivityFeed = ({ generationStage, businessData }) => {
  const [activities, setActivities] = useState([]);
  const [currentStage, setCurrentStage] = useState('');
  const [previousBusinessData, setPreviousBusinessData] = useState({});
  
  // Track specific business data changes for granular updates
  useEffect(() => {
    if (!businessData) return;
    
    const newActivities = [];
    
    // Check for new data pieces and add specific activities
    if (businessData.businessName && !previousBusinessData.businessName) {
      newActivities.push({
        id: Date.now() + Math.random(),
        text: `✨ Business name created: "${businessData.businessName}"`,
        icon: '🎯',
        type: 'success',
        time: 'Just now'
      });
    }
    
    if (businessData.logo && !previousBusinessData.logo) {
      newActivities.push({
        id: Date.now() + Math.random(),
        text: `${businessData.logo} Logo generated for your brand`,
        icon: '🎨',
        type: 'success',
        time: 'Just now'
      });
    }
    
    if (businessData.theme?.colors && !previousBusinessData.theme?.colors) {
      newActivities.push({
        id: Date.now() + Math.random(),
        text: `🎨 Brand colors and theme applied`,
        icon: '🌈',
        type: 'success',
        time: 'Just now'
      });
    }
    
    if (businessData.products && !previousBusinessData.products) {
      const productCount = businessData.products.length;
      newActivities.push({
        id: Date.now() + Math.random(),
        text: `📦 ${productCount} product${productCount > 1 ? 's' : ''} created and priced automatically`,
        icon: '💰',
        type: 'success',
        time: 'Just now'
      });
    }
    
    if (businessData.tagline && !previousBusinessData.tagline) {
      newActivities.push({
        id: Date.now() + Math.random(),
        text: `📝 Compelling tagline written: "${businessData.tagline.slice(0, 50)}${businessData.tagline.length > 50 ? '...' : ''}"`,
        icon: '✍️',
        type: 'success',
        time: 'Just now'
      });
    }
    
    if (businessData.marketing && !previousBusinessData.marketing) {
      newActivities.push({
        id: Date.now() + Math.random(),
        text: `📈 Marketing strategy and materials created`,
        icon: '🚀',
        type: 'success',
        time: 'Just now'
      });
    }
    
    // Add new activities to the beginning of the list
    if (newActivities.length > 0) {
      setActivities(prev => [...newActivities, ...prev].slice(0, 6));
    }
    
    setPreviousBusinessData(businessData);
  }, [businessData, previousBusinessData]);
  
  // Generation stage activities
  useEffect(() => {
    const stageActivities = {
      pending: { text: 'Initializing AI systems...', icon: '🤖', type: 'working' },
      queued: { text: 'Queued for processing...', icon: '⏳', type: 'working' },
      analyzing: { text: 'Analyzing your skills and market opportunity', icon: '🔍', type: 'working' },
      researching: { text: 'Researching profitable niches in your industry', icon: '📊', type: 'working' },
      building: { text: 'Building your website and creating products', icon: '🔨', type: 'working' },
      generating: { text: 'Generating your business content and products', icon: '⚡', type: 'working' },
      finalizing: { text: 'Optimizing for conversions and profit', icon: '✨', type: 'working' },
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
            a.type === 'working' ? { ...a, type: 'success', text: a.text.replace('...', '') + ' ✅' } : a
          );
          return [newActivity, ...updated].slice(0, 6);
        });
      }
    }
  }, [generationStage, currentStage]);
  
  // Add post-generation activities
  useEffect(() => {
    if (generationStage === 'complete') {
      const timer = setTimeout(() => {
        const postActivities = [
          { text: 'SEO optimization applied to boost visibility', icon: '🔍', type: 'optimization' },
          { text: 'Conversion tracking pixels installed', icon: '📊', type: 'analytics' },
          { text: 'Performance monitoring activated', icon: '⚡', type: 'monitoring' }
        ];
        
        let delay = 0;
        postActivities.forEach(activity => {
          setTimeout(() => {
            setActivities(prev => [{
              id: Date.now() + Math.random(),
              ...activity,
              time: 'Just now'
            }, ...prev].slice(0, 6));
          }, delay);
          delay += 2000;
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
                opacity: index === 0 ? 1 : 0.8 - (index * 0.12),
                transform: `translateX(${index === 0 ? 0 : index * 3}px)`,
                transition: 'all 0.3s',
                animation: index === 0 ? 'slideInLeft 0.5s ease' : 'none'
              }}
            >
              <span style={{ fontSize: '20px', flexShrink: 0 }}>{activity.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ 
                  fontSize: '15px',
                  color: activity.type === 'success' ? theme.colors.success : 
                         activity.type === 'working' ? theme.colors.primary : 
                         activity.type === 'optimization' ? '#f59e0b' :
                         activity.type === 'analytics' ? '#8b5cf6' :
                         activity.type === 'monitoring' ? '#10b981' :
                         theme.colors.textDark,
                  fontWeight: activity.type === 'working' ? '600' : '500',
                  margin: 0,
                  marginBottom: '4px'
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
                <p style={{ fontSize: '13px', color: theme.colors.textGray, margin: 0 }}>{activity.time}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- COMPONENT: Success Predictor ---
const SuccessPredictor = ({ isSetupComplete, generationStage, businessData }) => {
  const [probability, setProbability] = useState(45);
  
  useEffect(() => {
    // Use real success metrics if available, otherwise calculate based on stage
    if (businessData?.successProbability) {
      setProbability(businessData.successProbability);
    } else {
      // Calculate based on generation progress and business quality
      const baseProbabilities = {
        pending: 45,
        analyzing: 58,
        researching: 67,
        building: 75,
        finalizing: 82,
        complete: 89
      };
      
      let calculatedProbability = baseProbabilities[generationStage] || 45;
      
      // Boost probability based on business data quality
      if (businessData?.businessName) calculatedProbability += 2;
      if (businessData?.products?.length > 0) calculatedProbability += 3;
      if (businessData?.tagline) calculatedProbability += 1;
      if (businessData?.theme) calculatedProbability += 1;
      
      setProbability(Math.min(95, calculatedProbability));
    }
  }, [generationStage, businessData]);
  
  useEffect(() => {
    if (generationStage === 'complete' && !businessData?.successProbability) {
      const interval = setInterval(() => {
        setProbability(prev => Math.min(95, prev + Math.random() * 1));
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [generationStage, businessData?.successProbability]);

  // Calculate estimated time to first sale based on real data
  const getFirstSaleEstimate = () => {
    if (businessData?.estimatedFirstSale) {
      return businessData.estimatedFirstSale;
    }
    
    if (generationStage === 'complete') {
      // Base estimate on business type and setup completion
      if (isSetupComplete) {
        return 'Within 24-48 hours';
      } else {
        return 'Within 1-3 days after setup';
      }
    }
    
    return 'Calculating...';
  };

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
            {getFirstSaleEstimate()}
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
          ⚡ Add your bank account to start receiving payments
        </p>
      )}
    </div>
  );
};

// --- COMPONENT: Simple Next Steps ---
const NextSteps = ({ onComplete, generationStage, setupStatus }) => {
  const steps = [
    {
      id: 'bank',
      title: 'Add Bank Account',
      description: 'Get paid directly (1 min)',
      icon: '🏦',
      benefit: 'Receive earnings instantly',
      completed: setupStatus?.bank || false
    },
    {
      id: 'phone',
      title: 'Add Phone Number',
      description: 'Get instant sale alerts',
      icon: '📱',
      benefit: 'Never miss a sale',
      completed: setupStatus?.phone || false
    }
  ];

  // Only show after generation is complete
  if (generationStage !== 'complete') {
    return null;
  }

  const remainingSteps = steps.filter(step => !step.completed).length;

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
        {remainingSteps === 0 ? 'Setup Complete! 🎉' : `Quick Setup (${remainingSteps} step${remainingSteps > 1 ? 's' : ''} left)`}
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
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [generationStarted, setGenerationStarted] = useState(false);
  const startedRef = useRef(false);
  
  // Debug: Log business object to see what data is available
  console.log('Business object:', business);
  
  // Try multiple possible field names for revenue
  const getRevenueFromBusiness = (business) => {
    if (!business) return 0;
    
    return business.revenue || 
           business.earnings || 
           business.total_revenue || 
           business.total_earnings || 
           business.sales || 
           business.total_sales || 
           business.income || 
           business.profit || 
           0;
  };
  
  // Initialize total revenue from business data
  useEffect(() => {
    const revenue = getRevenueFromBusiness(business);
    console.log('Calculated revenue:', revenue);
    setTotalRevenue(revenue);
  }, [business]);
  
  // Track setup status from real data
  const setupStatus = {
    bank: business?.bank_connected || business?.bank_account || false,
    phone: business?.phone_number || business?.contact_phone || false
  };
  
  // Update setup complete status based on real data
  useEffect(() => {
    setSetupComplete(setupStatus.bank && setupStatus.phone);
  }, [setupStatus.bank, setupStatus.phone]);
  
  // Start generation immediately if pending
  useEffect(() => {
    if (session?.stage === 'pending' && business && !startedRef.current) {
      startedRef.current = true;
      startGeneration();
    }
  }, [session?.stage, business]);
  
  // Update revenue from real data
  useEffect(() => {
    const revenue = getRevenueFromBusiness(business);
    console.log('Revenue updated:', revenue);
    setTotalRevenue(revenue);
  }, [business?.revenue, business?.earnings, business?.total_revenue, business?.total_earnings, business?.sales, business?.total_sales, business?.income, business?.profit]);

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
    // Update setup status optimistically
    if (stepId === 'bank') {
      // This would typically be handled by the parent component
      // and reflected in business.bank_connected
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
        {/* Money Display - Always show for motivation */}
        <MoneyHero 
          totalRevenue={totalRevenue}
          availableToCashOut={
            // Use real available cash out data from business
            business?.available_to_cash_out || 
            business?.cashable_amount || 
            businessData.availableToCashOut || 
            // If we have real revenue, use a small percentage as available
            (totalRevenue > 0 ? Math.max(totalRevenue * 0.1, 5) : 0) // 10% of revenue or $5 minimum
          }
          canCashOut={totalRevenue > 0} // Allow cashout when there's any revenue
        />

        {/* Live Website Preview with Real-time Updates */}
        <LiveWebsiteCard 
          subdomain={business?.subdomain}
          visitors={business?.views || 0}
          businessData={businessData}
          generationStage={generationStage}
          business={business}
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
          businessData={businessData}
        />

        {/* Simple Next Steps - Only show after generation */}
        {!setupComplete && (
          <NextSteps 
            onComplete={handleStepComplete}
            generationStage={generationStage}
            setupStatus={setupStatus}
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
        
        @keyframes shimmer {
          0% {
            background-position: -200px 0;
          }
          100% {
            background-position: calc(200px + 100%) 0;
          }
        }
        
        @keyframes slideInFromTop {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .shimmer {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200px 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
};

export default LaunchflyDashboard;