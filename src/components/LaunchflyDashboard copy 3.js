import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, Globe, Bot, Clock, TrendingUp, ChevronRight, Zap, Eye, Mail, 
  CheckCircle, Users, Target, AlertCircle, Trophy, MessageSquare, Share2,
  Tag, Activity, Briefcase, ArrowUp, ArrowDown, Star, Send, Play
} from 'lucide-react';

// --- DESIGN SYSTEM ---
const theme = {
  colors: {
    primary: '#007BFF',
    primaryDark: '#0056b3',
    success: '#28a745',
    warning: '#f59e0b',
    danger: '#dc3545',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    white: '#ffffff',
    borderLight: '#E4E7EB',
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
    gold: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
  }
};

// --- COMPONENT: Enhanced Money Pipeline ---
const MoneyPipeline = ({ currentRevenue = 0, projectedRevenue = 0, opportunities = [] }) => {
  const [displayRevenue, setDisplayRevenue] = useState(currentRevenue);
  const nextMilestone = currentRevenue < 1000 ? 1000 : Math.ceil(currentRevenue / 1000) * 1000 + 1000;
  const progressToMilestone = (currentRevenue / nextMilestone) * 100;

  useEffect(() => {
    if (currentRevenue > displayRevenue) {
      const timer = setTimeout(() => {
        setDisplayRevenue(prev => Math.min(prev + 50, currentRevenue));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentRevenue, displayRevenue]);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      borderRadius: '24px',
      padding: '32px',
      color: 'white',
      marginBottom: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background pattern */}
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
        {/* Current Revenue */}
        <div style={{ marginBottom: '32px' }}>
          <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>Total Revenue</p>
          <h1 style={{ 
            fontSize: '56px', 
            fontWeight: '900', 
            marginBottom: '4px',
            textShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            ${displayRevenue.toLocaleString()}
          </h1>
          
          {/* Active Opportunities */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '20px',
            marginTop: '16px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} style={{ color: '#10b981' }} />
              <span style={{ color: '#10b981', fontSize: '18px', fontWeight: '600' }}>
                +${projectedRevenue.toLocaleString()} projected
              </span>
            </div>
            
            {opportunities.length > 0 && (
              <div style={{ 
                background: 'rgba(239, 68, 68, 0.2)', 
                padding: '6px 12px', 
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#ef4444',
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite'
                }} />
                <span style={{ fontSize: '14px', fontWeight: '600' }}>
                  {opportunities.length} people in checkout
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Progress to Next Milestone */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', opacity: 0.8 }}>Progress to ${nextMilestone.toLocaleString()}</span>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>
              ${(nextMilestone - currentRevenue).toLocaleString()} to go
            </span>
          </div>
          <div style={{ 
            background: 'rgba(255,255,255,0.1)', 
            height: '12px', 
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: theme.gradients.success,
              height: '100%',
              width: `${progressToMilestone}%`,
              borderRadius: '6px',
              transition: 'width 0.5s ease',
              boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
            }} />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button style={{
            background: currentRevenue > 0 ? theme.gradients.success : 'rgba(255,255,255,0.1)',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '10px',
            color: 'white',
            fontSize: '16px',
            fontWeight: '700',
            cursor: currentRevenue > 0 ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: currentRevenue > 0 ? 1 : 0.5
          }}>
            <DollarSign size={20} />
            Cash Out
          </button>
          
          <button style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '12px 24px',
            borderRadius: '10px',
            color: 'white',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <TrendingUp size={20} />
            View Analytics
          </button>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: Hot Leads & Visitors ---
const HotLeads = ({ visitors = [], onContactLead }) => {
  const hotLeads = visitors.filter(v => v.score > 70 || v.timeOnSite > 180 || v.viewedPricing);
  
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
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Users size={24} color="white" />
          </div>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark }}>
              Hot Leads
            </h3>
            <p style={{ fontSize: '14px', color: theme.colors.textGray }}>
              {hotLeads.length} high-intent visitors
            </p>
          </div>
        </div>
        
        {hotLeads.length > 0 && (
          <span style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            Action Required
          </span>
        )}
      </div>

      {hotLeads.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          background: theme.colors.bgLight,
          borderRadius: '12px'
        }}>
          <p style={{ color: theme.colors.textGray, marginBottom: '8px' }}>
            No hot leads yet. They'll appear here when visitors show buying intent.
          </p>
          <p style={{ fontSize: '14px', color: theme.colors.textGray }}>
            (Viewing pricing, spending 3+ minutes, or from target companies)
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {hotLeads.slice(0, 3).map((lead, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
              background: theme.colors.bgLight,
              borderRadius: '12px',
              border: '1px solid transparent',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = theme.colors.primary;
              e.currentTarget.style.transform = 'translateX(4px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.transform = 'translateX(0)';
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h4 style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: theme.colors.textDark 
                  }}>
                    {lead.company || lead.location || 'Anonymous Visitor'}
                  </h4>
                  {lead.score > 80 && (
                    <span style={{
                      background: '#fef3c7',
                      color: '#d97706',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      🔥 HOT
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '14px', color: theme.colors.textGray, marginBottom: '4px' }}>
                  {lead.pages?.join(' → ') || 'Browsing your site'} • {lead.timeOnSite}s on site
                </p>
                {lead.email && (
                  <p style={{ fontSize: '13px', color: theme.colors.primary }}>
                    📧 {lead.email}
                  </p>
                )}
              </div>
              
              <button
                onClick={() => onContactLead(lead)}
                style={{
                  background: theme.colors.primary,
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Send size={16} />
                Contact
              </button>
            </div>
          ))}
          
          {hotLeads.length > 3 && (
            <button style={{
              background: 'transparent',
              border: 'none',
              color: theme.colors.primary,
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}>
              View all {hotLeads.length} leads
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// --- COMPONENT: Quick Actions Center ---
const QuickActions = ({ onAction }) => {
  const actions = [
    {
      id: 'social',
      icon: Share2,
      label: 'Share on Social',
      description: 'Pre-written posts ready',
      impact: '+15-30 visitors',
      color: '#3b82f6'
    },
    {
      id: 'email',
      icon: Mail,
      label: 'Email Warm Leads',
      description: '3 templates available',
      impact: '+$100-300',
      color: '#10b981'
    },
    {
      id: 'sale',
      icon: Tag,
      label: 'Run Flash Sale',
      description: '24-hour limited offer',
      impact: '+$200-500',
      color: '#f59e0b'
    },
    {
      id: 'price',
      icon: Zap,
      label: 'Test New Price',
      description: 'A/B test pricing',
      impact: '+20% revenue',
      color: '#8b5cf6'
    }
  ];

  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: theme.shadows.lg,
      marginBottom: '24px'
    }}>
      <h3 style={{ 
        fontSize: '20px', 
        fontWeight: '700', 
        color: theme.colors.textDark,
        marginBottom: '20px'
      }}>
        Quick Actions
      </h3>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '12px' 
      }}>
        {actions.map(action => (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            style={{
              background: theme.colors.bgLight,
              border: `2px solid ${theme.colors.borderLight}`,
              borderRadius: '12px',
              padding: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = action.color;
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = theme.shadows.md;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = theme.colors.borderLight;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                background: `${action.color}20`,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <action.icon size={20} color={action.color} />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ 
                  fontSize: '15px', 
                  fontWeight: '600', 
                  color: theme.colors.textDark,
                  marginBottom: '2px'
                }}>
                  {action.label}
                </h4>
                <p style={{ 
                  fontSize: '13px', 
                  color: theme.colors.textGray,
                  marginBottom: '4px'
                }}>
                  {action.description}
                </p>
                <span style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: action.color
                }}>
                  {action.impact}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// --- COMPONENT: Competitive Benchmarking ---
const Benchmarking = ({ metrics }) => {
  const achievements = [
    { id: 1, icon: '🏃', name: 'Speed Demon', description: 'First sale in 24 hours' },
    { id: 2, icon: '👑', name: 'Conversion King', description: 'Top 10% conversion rate' },
    { id: 3, icon: '🚀', name: 'Growth Rocket', description: '3x revenue in first month' }
  ];

  return (
    <div style={{
      background: theme.gradients.purple,
      borderRadius: '20px',
      padding: '24px',
      color: 'white',
      marginBottom: '24px'
    }}>
      <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px' }}>
        How You Compare
      </h3>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '36px', fontWeight: '800', marginBottom: '4px' }}>
            Top 15%
          </p>
          <p style={{ fontSize: '14px', opacity: 0.9 }}>
            Conversion Rate
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '36px', fontWeight: '800', marginBottom: '4px' }}>
            87%
          </p>
          <p style={{ fontSize: '14px', opacity: 0.9 }}>
            Faster than Average
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '36px', fontWeight: '800', marginBottom: '4px' }}>
            #47
          </p>
          <p style={{ fontSize: '14px', opacity: 0.9 }}>
            This Week's Rank
          </p>
        </div>
      </div>

      <div>
        <p style={{ fontSize: '14px', marginBottom: '12px', opacity: 0.9 }}>
          Achievements Unlocked
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {achievements.map(achievement => (
            <div key={achievement.id} style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '8px 16px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '20px' }}>{achievement.icon}</span>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>
                {achievement.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: Smart Notifications ---
const NotificationHub = ({ notifications = [] }) => {
  const priorityNotifications = notifications
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);

  const getNotificationStyle = (type) => {
    switch (type) {
      case 'hot':
        return { bg: '#fee2e2', color: '#dc2626', icon: '🔥' };
      case 'money':
        return { bg: '#d1fae5', color: '#065f46', icon: '💰' };
      case 'traffic':
        return { bg: '#dbeafe', color: '#1e3a8a', icon: '📈' };
      case 'opportunity':
        return { bg: '#fef3c7', color: '#92400e', icon: '🎯' };
      default:
        return { bg: '#f3f4f6', color: '#374151', icon: '📢' };
    }
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: theme.shadows.lg,
      marginBottom: '24px',
      maxHeight: '400px',
      overflowY: 'auto'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <h3 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark }}>
          Smart Alerts
        </h3>
        <span style={{
          background: theme.colors.danger,
          color: 'white',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '600'
        }}>
          {priorityNotifications.length} New
        </span>
      </div>

      {priorityNotifications.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: theme.colors.textGray
        }}>
          <AlertCircle size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
          <p>No alerts at the moment. Keep doing great!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {priorityNotifications.map((notification, index) => {
            const style = getNotificationStyle(notification.type);
            return (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '16px',
                background: style.bg,
                borderRadius: '12px',
                cursor: notification.action ? 'pointer' : 'default',
                transition: 'all 0.2s'
              }}
              onClick={() => notification.action && notification.action()}
              onMouseEnter={e => notification.action && (e.currentTarget.style.transform = 'translateX(4px)')}
              onMouseLeave={e => notification.action && (e.currentTarget.style.transform = 'translateX(0)')}
              >
                <span style={{ fontSize: '20px' }}>{style.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: style.color,
                    marginBottom: '4px'
                  }}>
                    {notification.title}
                  </p>
                  <p style={{ fontSize: '14px', color: theme.colors.textGray }}>
                    {notification.message}
                  </p>
                  {notification.actionText && (
                    <button style={{
                      background: 'none',
                      border: 'none',
                      color: style.color,
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      padding: '4px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '8px'
                    }}>
                      {notification.actionText}
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '12px', color: theme.colors.textGray }}>
                  {notification.time}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- COMPONENT: Success Roadmap ---
const SuccessRoadmap = ({ currentStage = 1, completedMilestones = [] }) => {
  const stages = [
    { 
      id: 1, 
      name: 'Launch', 
      icon: '🚀', 
      milestone: 'Business Live',
      tasks: ['Website active', 'Products listed', 'Payment setup']
    },
    { 
      id: 2, 
      name: 'First Sale', 
      icon: '💰', 
      milestone: '$1 - $100',
      tasks: ['Get 100 visitors', 'Make first sale', 'Collect feedback']
    },
    { 
      id: 3, 
      name: 'Momentum', 
      icon: '📈', 
      milestone: '$100 - $1,000',
      tasks: ['10+ sales', 'Build email list', 'Optimize pricing']
    },
    { 
      id: 4, 
      name: 'Scale', 
      icon: '🚀', 
      milestone: '$1,000+',
      tasks: ['Automate marketing', 'Add products', 'Hire help']
    }
  ];

  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: theme.shadows.lg,
      marginBottom: '24px'
    }}>
      <h3 style={{ 
        fontSize: '20px', 
        fontWeight: '700', 
        color: theme.colors.textDark,
        marginBottom: '20px'
      }}>
        Your Success Roadmap
      </h3>

      <div style={{ position: 'relative' }}>
        {/* Progress Line */}
        <div style={{
          position: 'absolute',
          top: '24px',
          left: '24px',
          right: '24px',
          height: '4px',
          background: theme.colors.borderLight,
          borderRadius: '2px',
          zIndex: 0
        }}>
          <div style={{
            height: '100%',
            width: `${((currentStage - 1) / (stages.length - 1)) * 100}%`,
            background: theme.gradients.primary,
            borderRadius: '2px',
            transition: 'width 0.5s ease'
          }} />
        </div>

        {/* Stages */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 1
        }}>
          {stages.map(stage => (
            <div key={stage.id} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: stage.id <= currentStage ? theme.gradients.primary : 'white',
                border: `3px solid ${stage.id <= currentStage ? theme.colors.primary : theme.colors.borderLight}`,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                marginBottom: '12px'
              }}>
                {stage.id < currentStage ? '✓' : stage.icon}
              </div>
              <h4 style={{
                fontSize: '14px',
                fontWeight: '600',
                color: stage.id <= currentStage ? theme.colors.textDark : theme.colors.textGray,
                marginBottom: '4px'
              }}>
                {stage.name}
              </h4>
              <p style={{
                fontSize: '12px',
                color: theme.colors.textGray
              }}>
                {stage.milestone}
              </p>
            </div>
          ))}
        </div>

        {/* Current Stage Details */}
        {currentStage <= stages.length && (
          <div style={{
            marginTop: '32px',
            padding: '20px',
            background: theme.colors.bgLight,
            borderRadius: '12px'
          }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: theme.colors.textDark,
              marginBottom: '12px'
            }}>
              Current Focus: {stages[currentStage - 1].name}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stages[currentStage - 1].tasks.map((task, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <input 
                    type="checkbox" 
                    style={{ cursor: 'pointer' }}
                    onChange={() => {}}
                  />
                  <label style={{
                    fontSize: '14px',
                    color: theme.colors.textGray,
                    cursor: 'pointer'
                  }}>
                    {task}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- COMPONENT: AI Business Advisor ---
const AIAdvisor = ({ insights = [], experiments = [] }) => {
  const [currentInsight, setCurrentInsight] = useState(0);

  const defaultInsights = [
    {
      type: 'pattern',
      icon: '📊',
      title: 'Best Converting Day',
      message: 'Your visitors convert 2.3x better on Tuesdays. Schedule your campaigns accordingly.',
      action: 'Schedule Campaign',
      impact: '+40% conversions'
    },
    {
      type: 'opportunity',
      icon: '💡',
      title: 'Pricing Opportunity',
      message: 'Similar businesses charge 30% more. Your quality justifies premium pricing.',
      action: 'Test Higher Price',
      impact: '+$300/month'
    },
    {
      type: 'prediction',
      icon: '🔮',
      title: 'Sale Prediction',
      message: '82% chance of a sale in the next 24 hours based on current traffic patterns.',
      action: 'Prepare Follow-up',
      impact: '$200-400 expected'
    }
  ];

  const displayInsights = insights.length > 0 ? insights : defaultInsights;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%)',
      borderRadius: '20px',
      padding: '24px',
      color: 'white',
      marginBottom: '24px'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bot size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: '700' }}>
              AI Business Advisor
            </h3>
            <p style={{ fontSize: '14px', opacity: 0.9 }}>
              Personalized insights for your success
            </p>
          </div>
        </div>
      </div>

      {/* Current Insight */}
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
          <span style={{ fontSize: '28px' }}>
            {displayInsights[currentInsight].icon}
          </span>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
              {displayInsights[currentInsight].title}
            </h4>
            <p style={{ fontSize: '15px', opacity: 0.95, marginBottom: '12px' }}>
              {displayInsights[currentInsight].message}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                background: 'rgba(16, 185, 129, 0.2)',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                {displayInsights[currentInsight].impact}
              </span>
              <button style={{
                background: 'white',
                color: '#1e3a8a',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {displayInsights[currentInsight].action}
                <Play size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Insight Navigation */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
        {displayInsights.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentInsight(index)}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              border: 'none',
              background: index === currentInsight ? 'white' : 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          />
        ))}
      </div>
    </div>
  );
};

// --- MAIN DASHBOARD COMPONENT ---
const EnhancedLaunchflyDashboard = ({ session, business }) => {
  const [setupComplete, setSetupComplete] = useState(false);
  
  // Mock data for demonstration - in real app, this would come from your database
  const [dashboardData, setDashboardData] = useState({
    revenue: {
      current: business?.total_revenue || 0,
      projected: 2100,
      opportunities: [
        { id: 1, value: 297, stage: 'checkout' },
        { id: 2, value: 149, stage: 'checkout' }
      ]
    },
    visitors: [
      { 
        id: 1, 
        company: 'TechCorp Solutions', 
        location: 'San Francisco', 
        email: 'sarah@techcorp.com',
        pages: ['Home', 'Pricing', 'Contact'],
        timeOnSite: 245,
        score: 85,
        viewedPricing: true
      },
      { 
        id: 2, 
        company: 'Growth Marketing Inc', 
        location: 'New York',
        pages: ['Home', 'Features'],
        timeOnSite: 120,
        score: 72,
        viewedPricing: false
      }
    ],
    notifications: [
      {
        type: 'hot',
        title: 'Hot Lead Alert!',
        message: 'Someone from Google is on your pricing page right now',
        time: 'Just now',
        priority: 10,
        actionText: 'View Details'
      },
      {
        type: 'money',
        title: 'You\'re close!',
        message: 'Just $203 away from your $1,000 milestone',
        time: '5 min ago',
        priority: 8
      },
      {
        type: 'traffic',
        title: 'Traffic Spike',
        message: 'Visitors up 5x in the last hour - something\'s working!',
        time: '1 hour ago',
        priority: 7
      }
    ],
    currentStage: 2,
    subdomain: business?.subdomain || 'your-business'
  });

  const handleContactLead = (lead) => {
    console.log('Contact lead:', lead);
    // Open email template or contact modal
  };

  const handleQuickAction = (actionId) => {
    console.log('Quick action:', actionId);
    // Handle different quick actions
  };

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setDashboardData(prev => ({
        ...prev,
        revenue: {
          ...prev.revenue,
          current: prev.revenue.current + Math.random() * 10
        }
      }));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ 
      minHeight: '100vh',
      background: theme.colors.bgLight
    }}>
      {/* Header */}
      <header style={{
        background: 'white',
        borderBottom: `1px solid ${theme.colors.borderLight}`,
        padding: '20px 0',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '1200px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a 
              href={`https://${dashboardData.subdomain}.launchfly.ai`}
              target="_blank"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: theme.colors.primary,
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              <Globe size={16} />
              View Site
            </a>
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
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '32px 24px'
      }}>
        {/* Row 1: Money Pipeline */}
        <MoneyPipeline 
          currentRevenue={dashboardData.revenue.current}
          projectedRevenue={dashboardData.revenue.projected}
          opportunities={dashboardData.revenue.opportunities}
        />

        {/* Row 2: Hot Leads + Quick Actions */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          '@media (max-width: 768px)': {
            gridTemplateColumns: '1fr'
          }
        }}>
          <HotLeads 
            visitors={dashboardData.visitors}
            onContactLead={handleContactLead}
          />
          <QuickActions onAction={handleQuickAction} />
        </div>

        {/* Row 3: AI Advisor */}
        <AIAdvisor />

        {/* Row 4: Benchmarking + Notifications */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          '@media (max-width: 768px)': {
            gridTemplateColumns: '1fr'
          }
        }}>
          <Benchmarking metrics={dashboardData.metrics} />
          <NotificationHub notifications={dashboardData.notifications} />
        </div>

        {/* Row 5: Success Roadmap */}
        <SuccessRoadmap 
          currentStage={dashboardData.currentStage}
          completedMilestones={dashboardData.completedMilestones}
        />
      </main>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        
        @media (max-width: 768px) {
          main > div[style*="grid"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default EnhancedLaunchflyDashboard;