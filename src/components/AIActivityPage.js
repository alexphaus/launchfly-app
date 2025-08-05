// src/components/AIActivityPage.js
import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Bot, Clock, Search, Filter, MessageSquare, 
  Zap, Eye, ChevronRight, Loader2, Send, X, Play, 
  Pause, BarChart3, Users, Mail, Target, TrendingUp,
  Calendar, ExternalLink, RefreshCw, Settings
} from 'lucide-react';

// Use the same theme from LaunchflyDashboard for consistency
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
    purple: '#8b5cf6',
    emerald: '#10b981',
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

// AI Status Component
const AIStatus = ({ business, stats }) => {
  const [isRunning, setIsRunning] = useState(true);
  
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      borderRadius: '20px',
      padding: '24px',
      color: 'white',
      marginBottom: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-20%',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
        borderRadius: '50%'
      }} />
      
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
              AI Working for {business?.business_data?.businessName || 'Your Business'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                background: isRunning ? '#10b981' : '#f59e0b',
                borderRadius: '50%',
                animation: isRunning ? 'pulse 2s infinite' : 'none'
              }} />
              <span style={{ opacity: 0.9 }}>
                {isRunning ? 'Actively working' : 'Paused'} • {stats.totalActivities} activities today
              </span>
            </div>
          </div>
          
          <button
            onClick={() => setIsRunning(!isRunning)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px'
            }}
          >
            {isRunning ? <Pause size={16} /> : <Play size={16} />}
            {isRunning ? 'Pause AI' : 'Resume AI'}
          </button>
        </div>
        
        {/* Quick Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: window.innerWidth < 640 ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(120px, 1fr))', 
          gap: '16px' 
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
              {stats.emailsSent || 0}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Emails Sent</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#00B8D9' }}>
              {stats.prospectsFound || 0}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Prospects Found</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>
              {stats.meetingsBooked || 0}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Meetings Booked</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#ec4899' }}>
              {Math.round(stats.responseRate || 0)}%
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Response Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Activity Timeline Component
const ActivityTimeline = ({ activities, onActivityClick, searchTerm, filterType }) => {
  const filteredActivities = activities.filter(activity => {
    const matchesSearch = !searchTerm || 
      activity.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.details?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' || activity.type === filterType;
    
    return matchesSearch && matchesFilter;
  });

  const getActivityIcon = (activity) => {
    switch (activity.type) {
      case 'email_sent': return '📤';
      case 'email_opened': return '📬';
      case 'email_replied': return '💬';
      case 'prospect_search': return '🔍';
      case 'meeting_booked': return '📅';
      case 'optimization': return '📊';
      case 'linkedin_outreach': return '💼';
      case 'content_created': return '✍️';
      case 'metrics_update': return '📈';
      default: return activity.icon || '🤖';
    }
  };

  const getActivityColor = (activity) => {
    switch (activity.type) {
      case 'email_sent': return theme.colors.orange;
      case 'email_opened': return theme.colors.primary;
      case 'email_replied': return theme.colors.success;
      case 'prospect_search': return theme.colors.purple;
      case 'meeting_booked': return theme.colors.success;
      case 'optimization': return theme.colors.orange;
      case 'metrics_update': return theme.colors.emerald;
      default: return theme.colors.textGray;
    }
  };

  return (
    <div style={{
          background: theme.colors.white,
    borderRadius: '16px',
    padding: window.innerWidth < 640 ? '16px' : '24px',
    boxShadow: theme.shadows.md,
    height: window.innerWidth < 768 ? '400px' : 'calc(100vh - 400px)',
    overflow: 'auto'
    }}>
      <h3 style={{ 
        fontSize: '18px', 
        fontWeight: '600', 
        marginBottom: '20px',
        color: theme.colors.textDark
      }}>
        Activity Timeline
      </h3>
      
      {filteredActivities.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          color: theme.colors.textGray
        }}>
          <Bot size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <p>No activities found</p>
          {searchTerm && <p style={{ fontSize: '14px' }}>Try adjusting your search</p>}
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Timeline line */}
          <div style={{
            position: 'absolute',
            left: '20px',
            top: '10px',
            bottom: '10px',
            width: '2px',
            background: theme.colors.borderLight
          }} />
          
          {filteredActivities.map((activity, index) => (
            <div
              key={activity.id}
              onClick={() => onActivityClick(activity)}
              style={{
                position: 'relative',
                paddingLeft: '60px',
                paddingBottom: '24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              {/* Timeline dot */}
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '4px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: getActivityColor(activity),
                border: `2px solid ${theme.colors.white}`,
                boxShadow: theme.shadows.sm,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '8px'
              }}>
                {index === 0 && <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: theme.colors.white,
                  animation: 'pulse 2s infinite'
                }} />}
              </div>
              
              <div style={{
                background: theme.colors.bgLight,
                borderRadius: '12px',
                padding: '16px',
                border: `1px solid ${theme.colors.borderLight}`,
                transition: 'all 0.2s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>
                    {getActivityIcon(activity)}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontSize: '15px',
                      fontWeight: '600',
                      color: theme.colors.textDark,
                      margin: 0,
                      marginBottom: '4px'
                    }}>
                      {activity.text}
                    </p>
                    {activity.details && (
                      <p style={{
                        fontSize: '13px',
                        color: theme.colors.textGray,
                        margin: 0,
                        marginBottom: '8px'
                      }}>
                        {activity.details}
                      </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '12px',
                        color: theme.colors.textGray
                      }}>
                        {activity.time}
                      </span>
                      <ChevronRight size={16} style={{ color: theme.colors.textGray }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Live Chat Component
const LiveChat = ({ business }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      message: `Hi! I'm actively working on growing ${business?.business_data?.businessName || 'your business'}. What would you like to know about my current activities?`,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      message: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentMessage = inputMessage;
    setInputMessage('');
    setIsTyping(true);

    try {
      // Send message to AI chat API
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business?.id,
          message: currentMessage,
          sessionId: business?.session_id
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        const aiMessage = {
          id: Date.now() + 1,
          type: 'ai',
          message: data.response,
          timestamp: new Date(),
          suggestions: data.suggestions || []
        };

        setMessages(prev => [...prev, aiMessage]);
      } else {
        // Fallback to simulated response if API fails
        const fallbackMessage = {
          id: Date.now() + 1,
          type: 'ai',
          message: "I'm currently processing your request. The AI systems are working on multiple growth strategies for your business. Please try again in a moment.",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, fallbackMessage]);
      }
    } catch (error) {
      console.error('Error sending message to AI:', error);
      
      // Fallback response
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        message: "I'm experiencing high activity right now while working on your business growth. The AI is actively running campaigns and optimizing results. Please try again shortly.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{
          background: theme.colors.white,
    borderRadius: '16px',
    padding: window.innerWidth < 640 ? '16px' : '24px',
    boxShadow: theme.shadows.md,
    height: window.innerWidth < 768 ? '400px' : 'calc(100vh - 400px)',
    display: 'flex',
    flexDirection: 'column'
    }}>
      <h3 style={{ 
        fontSize: '18px', 
        fontWeight: '600', 
        marginBottom: '20px',
        color: theme.colors.textDark,
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <MessageSquare size={20} />
        Chat with AI
      </h3>
      
      {/* Messages */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        marginBottom: '16px',
        padding: '0 4px'
      }}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '16px'
            }}
          >
            <div style={{
              maxWidth: '80%',
              padding: '12px 16px',
              borderRadius: message.type === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: message.type === 'user' ? theme.colors.primary : theme.colors.bgLight,
              color: message.type === 'user' ? 'white' : theme.colors.textDark,
              fontSize: '14px',
              lineHeight: '1.4'
            }}>
              {message.message}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: '16px 16px 16px 4px',
              background: theme.colors.bgLight,
              color: theme.colors.textGray,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              AI is typing...
            </div>
          </div>
        )}
        
        {/* Show suggestions from the last AI message */}
        {messages.length > 0 && messages[messages.length - 1].type === 'ai' && messages[messages.length - 1].suggestions && (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '8px', 
            marginBottom: '16px',
            justifyContent: 'flex-start'
          }}>
            {messages[messages.length - 1].suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  setInputMessage(suggestion);
                  setTimeout(() => handleSendMessage(), 100);
                }}
                style={{
                  background: 'transparent',
                  border: `1px solid ${theme.colors.borderLight}`,
                  borderRadius: '16px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  color: theme.colors.textGray,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = theme.colors.bgLight;
                  e.target.style.borderColor = theme.colors.primary;
                  e.target.style.color = theme.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.borderColor = theme.colors.borderLight;
                  e.target.style.color = theme.colors.textGray;
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '12px',
        background: theme.colors.bgLight,
        borderRadius: '12px',
        border: `1px solid ${theme.colors.borderLight}`
      }}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Ask AI about current activities..."
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: '14px',
            color: theme.colors.textDark
          }}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputMessage.trim()}
          style={{
            background: inputMessage.trim() ? theme.colors.primary : theme.colors.textGray,
            border: 'none',
            borderRadius: '8px',
            padding: '8px',
            color: 'white',
            cursor: inputMessage.trim() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

// Activity Detail Modal
const ActivityDetailModal = ({ activity, onClose }) => {
  if (!activity) return null;

  const getDetailedInfo = (activity) => {
    switch (activity.type) {
      case 'email_sent':
        return {
          title: 'Cold Email Sent',
          details: [
            { label: 'Recipient', value: activity.metadata?.recipientEmail || 'Contact' },
            { label: 'Company', value: activity.metadata?.recipientCompany || 'N/A' },
            { label: 'Subject', value: activity.metadata?.subject || 'N/A' },
            { label: 'Campaign', value: activity.metadata?.campaignId || 'Cold Outreach' }
          ]
        };
      case 'prospect_search':
        return {
          title: 'Prospect Discovery',
          details: [
            { label: 'Industry', value: activity.metadata?.industry || 'N/A' },
            { label: 'Prospects Found', value: activity.metadata?.count || 0 },
            { label: 'Source', value: activity.metadata?.source || 'Database' },
            { label: 'Search Terms', value: activity.metadata?.searchTerms || 'N/A' }
          ]
        };
      default:
        return {
          title: 'AI Activity',
          details: [
            { label: 'Type', value: activity.type },
            { label: 'Status', value: 'Completed' },
            { label: 'Time', value: activity.time }
          ]
        };
    }
  };

  const info = getDetailedInfo(activity);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: theme.colors.white,
        borderRadius: '20px',
        padding: '32px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: theme.shadows.xl
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: theme.colors.textDark, margin: 0 }}>
            {info.title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: theme.colors.textGray
            }}
          >
            <X size={24} />
          </button>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px',
          padding: '16px',
          background: theme.colors.bgLight,
          borderRadius: '12px'
        }}>
          <span style={{ fontSize: '24px' }}>{activity.icon}</span>
          <div>
            <p style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: theme.colors.textDark }}>
              {activity.text}
            </p>
            <p style={{ fontSize: '14px', color: theme.colors.textGray, margin: 0 }}>
              {activity.time}
            </p>
          </div>
        </div>
        
        {activity.details && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: theme.colors.textDark }}>
              Description
            </h4>
            <p style={{ fontSize: '14px', color: theme.colors.textGray, lineHeight: '1.5' }}>
              {activity.details}
            </p>
          </div>
        )}
        
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: theme.colors.textDark }}>
            Details
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {info.details.map((detail, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: theme.colors.textGray }}>{detail.label}</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: theme.colors.textDark }}>
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Main AI Activity Page Component
const AIActivityPage = ({ session, business, onBack }) => {
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (business?.id) {
      fetchActivities();
      fetchStats();
      
      // Set up real-time polling
      const interval = setInterval(fetchActivities, 5000);
      return () => clearInterval(interval);
    }
  }, [business?.id]);

  const fetchActivities = async () => {
    try {
      const response = await fetch(`/api/business/${business.id}/activities?limit=50`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setActivities(data.activities);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching activities:', error);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    // Calculate stats from activities
    const emailsSent = activities.filter(a => a.type === 'email_sent').length;
    const prospectsFound = activities.filter(a => a.type === 'prospect_search').reduce((sum, a) => sum + (a.metadata?.count || 0), 0);
    const meetingsBooked = activities.filter(a => a.type === 'meeting_booked').length;
    const emailsOpened = activities.filter(a => a.type === 'email_opened').length;
    const responseRate = emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0;

    setStats({
      totalActivities: activities.length,
      emailsSent,
      prospectsFound,
      meetingsBooked,
      responseRate
    });
  };

  useEffect(() => {
    fetchStats();
  }, [activities]);

  const filterOptions = [
    { value: 'all', label: 'All Activities' },
    { value: 'email_sent', label: 'Emails Sent' },
    { value: 'prospect_search', label: 'Prospect Search' },
    { value: 'email_opened', label: 'Email Opens' },
    { value: 'meeting_booked', label: 'Meetings' },
    { value: 'optimization', label: 'Optimizations' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading AI activities...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, #f8fafc, #e0f2fe)',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        marginBottom: '24px'
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'transparent',
            border: 'none',
            color: theme.colors.textGray,
            cursor: 'pointer',
            fontSize: '16px',
            marginBottom: '20px'
          }}
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>
        
        <AIStatus business={business} stats={stats} />
        
        {/* Controls */}
        <div style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          flexDirection: window.innerWidth < 640 ? 'column' : 'row'
        }}>
          <div style={{
            position: 'relative',
            flex: 1,
            minWidth: '200px'
          }}>
            <Search size={20} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: theme.colors.textGray
            }} />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 12px 12px 40px',
                borderRadius: '12px',
                border: `1px solid ${theme.colors.borderLight}`,
                fontSize: '14px',
                outline: 'none',
                background: theme.colors.white
              }}
            />
          </div>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: `1px solid ${theme.colors.borderLight}`,
              fontSize: '14px',
              outline: 'none',
              background: theme.colors.white,
              cursor: 'pointer'
            }}
          >
            {filterOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          <button
            onClick={fetchActivities}
            style={{
              background: theme.colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px'
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: window.innerWidth > 768 ? '1fr 400px' : '1fr',
        gap: '24px'
      }}>
        <ActivityTimeline
          activities={activities}
          onActivityClick={setSelectedActivity}
          searchTerm={searchTerm}
          filterType={filterType}
        />
        
        <LiveChat business={business} />
      </div>
      
      {/* Activity Detail Modal */}
      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AIActivityPage;