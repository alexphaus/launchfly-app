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
const LiveWebsiteCard = ({ subdomain, visitors = 0 }) => {
  const [currentVisitors, setCurrentVisitors] = useState(visitors);
  const websiteUrl = `https://${subdomain}.launchfly.ai`;
  
  // Simulate live visitors
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentVisitors(prev => Math.max(0, prev + Math.floor(Math.random() * 5 - 2)));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
        background: theme.gradients.purple,
        padding: '24px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
              Your Website is Live! 🎉
            </h2>
            <p style={{ opacity: 0.9, marginBottom: '12px' }}>{websiteUrl}</p>
            
            {/* Live visitor count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
            </div>
          </div>
          
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
        </div>
      </div>
      
      {/* Website Preview */}
      <div style={{
        height: '300px',
        position: 'relative',
        background: '#f5f5f5'
      }}>
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
      </div>
    </div>
  );
};

// --- COMPONENT: AI Activity Feed ---
const AIActivityFeed = () => {
  const [activities, setActivities] = useState([
    { id: 1, type: 'lead', text: 'Found 12 potential customers in your niche', time: 'Just now', icon: '🔍' },
    { id: 2, type: 'email', text: 'Sarah from TechCorp opened your email!', time: '2 min ago', icon: '📧', highlight: true },
    { id: 3, type: 'money', text: '82% chance of $297 sale today', time: '5 min ago', icon: '💰' },
  ]);

  // Add new activities periodically
  useEffect(() => {
    const messages = [
      { type: 'lead', text: 'Analyzing competitor pricing strategies', icon: '📊' },
      { type: 'email', text: 'Sent follow-up to warm lead', icon: '📤' },
      { type: 'traffic', text: 'New visitor from LinkedIn!', icon: '🔗' },
      { type: 'optimization', text: 'Improved email subject line', icon: '✨' },
    ];

    const interval = setInterval(() => {
      const newActivity = {
        id: Date.now(),
        ...messages[Math.floor(Math.random() * messages.length)],
        time: 'Just now'
      };
      
      setActivities(prev => [newActivity, ...prev.slice(0, 2)]);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

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
        {activities.map((activity, index) => (
          <div
            key={activity.id}
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'start',
              opacity: index === 0 ? 1 : 0.8 - (index * 0.2),
              transform: `translateX(${index === 0 ? 0 : index * 5}px)`,
              transition: 'all 0.3s'
            }}
          >
            <span style={{ fontSize: '20px' }}>{activity.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ 
                fontSize: '15px',
                color: activity.highlight ? theme.colors.success : theme.colors.textDark,
                fontWeight: activity.highlight ? '600' : '500'
              }}>
                {activity.text}
              </p>
              <p style={{ fontSize: '13px', color: theme.colors.textGray }}>{activity.time}</p>
            </div>
          </div>
        ))}
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
const LaunchflyDashboard = ({ session, business }) => {
  const [setupComplete, setSetupComplete] = useState(false);
  const [totalEarned, setTotalEarned] = useState(0);
  
  // Mock data for demonstration
  const businessData = {
    subdomain: business?.subdomain || 'sarahs-consulting',
    totalRevenue: business?.total_revenue || 0,
    projectedRevenue: 2100,
    visitors: 23
  };

  // Simulate earnings
  useEffect(() => {
    if (setupComplete) {
      const timer = setTimeout(() => {
        setTotalEarned(297);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [setupComplete]);

  const handleStepComplete = (stepId) => {
    console.log('Completing step:', stepId);
    if (stepId === 'stripe') {
      setSetupComplete(true);
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
        {/* 1. Money Display */}
        <MoneyHero 
          totalEarned={totalEarned}
          projectedThisWeek={businessData.projectedRevenue}
          canCashOut={totalEarned > 0}
        />

        {/* 2. Website Proof */}
        <LiveWebsiteCard 
          subdomain={businessData.subdomain}
          visitors={businessData.visitors}
        />

        {/* 3. AI Activity */}
        <AIActivityFeed />

        {/* 4. Success Predictor */}
        <SuccessPredictor isSetupComplete={setupComplete} />

        {/* 5. Simple Next Steps */}
        {!setupComplete && (
          <NextSteps onComplete={handleStepComplete} />
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
      `}</style>
    </div>
  );
};

export default LaunchflyDashboard;