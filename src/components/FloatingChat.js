// src/components/FloatingChat.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle,
  Send,
  Brain,
  Loader2
} from 'lucide-react';

const theme = {
  colors: {
    primary: '#0ea5e9',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    textDark: '#1f2937',
    textGray: '#6b7280',
    textLight: '#9ca3af',
    background: '#f8fafc',
    white: '#ffffff'
  },
  gradients: {
    primary: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
    ai: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
  }
};

// Chat Message Component
const ChatMessage = ({ message }) => (
  <div style={{
    marginBottom: '12px',
    display: 'flex',
    justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start'
  }}>
    <div style={{
      maxWidth: '80%',
      padding: '8px 12px',
      borderRadius: '12px',
      background: message.type === 'user' ? theme.colors.primary : theme.colors.background,
      color: message.type === 'user' ? 'white' : theme.colors.textDark,
      fontSize: '14px',
      lineHeight: '1.4'
    }}>
      {message.content}
      <div style={{
        fontSize: '11px',
        opacity: 0.7,
        marginTop: '4px'
      }}>
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  </div>
);

// Floating Chat Component
export default function FloatingChat({ isOpen, onToggle, messages, input, loading, onInputChange, onSubmit, business, hasUnread }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const getSmartSuggestions = () => {
    const revenue = business?.total_revenue || business?.revenue || 0;
    const leads = business?.growth_data?.customers?.totalLeads || business?.total_prospects || 0;
    const hasWebsite = !!business?.subdomain || !!business?.website_url;

    if (revenue > 0) {
      return [
        'How can I scale to $10k/month?',
        'What\'s working best right now?',
        'Show me my conversion metrics'
      ];
    } else if (leads > 0) {
      return [
        'How do I convert these leads?',
        'What should I say in follow-ups?',
        'When will I get my first sale?'
      ];
    } else if (hasWebsite) {
      return [
        'How do I get more visitors?',
        'Where should I find customers?',
        'What\'s my next step?'
      ];
    }
    return [
      'What are you working on?',
      'When will my site be ready?',
      'How does this work?'
    ];
  };

  const suggestions = getSmartSuggestions();
  const showSuggestions = messages.length === 0 || (messages.length > 0 && messages[messages.length - 1].type === 'ai');

  return (
    <>
      {/* Chat Toggle Button */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 1000
      }}>
        <button
          onClick={onToggle}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: theme.gradients.primary,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0, 123, 255, 0.3)',
            transition: 'all 0.3s ease',
            position: 'relative'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <MessageCircle size={24} color="white" />
          )}
          
          {hasUnread && !isOpen && (
            <div style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: '12px',
              height: '12px',
              background: '#ef4444',
              borderRadius: '50%',
              border: '2px solid white',
              animation: 'pulse 2s infinite'
            }} />
          )}
        </button>
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '24px',
          width: '360px',
          height: '480px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          border: '1px solid #e5e7eb',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInUp 0.3s ease'
        }}>
          {/* Chat Header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #e5e7eb',
            borderRadius: '16px 16px 0 0',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: theme.gradients.ai,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Brain size={16} color="white" />
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: theme.colors.textDark }}>
                  AI Cofounder
                </h4>
                <p style={{ fontSize: '12px', color: theme.colors.textGray, margin: 0 }}>
                  Working on {business?.business_data?.businessName || 'your business'}
                </p>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {messages.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: theme.colors.textGray,
                fontSize: '14px',
                marginTop: '40px'
              }}>
                <Brain size={32} color={theme.colors.textLight} style={{ margin: '0 auto 12px' }} />
                <p>Hi! Ask me anything about your business progress.</p>
              </div>
            ) : (
              messages.map(message => (
                <ChatMessage key={message.id} message={message} />
              ))
            )}
            
            {loading && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-start',
                marginBottom: '12px'
              }}>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '16px 16px 16px 4px',
                  background: theme.colors.background,
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

            {showSuggestions && !loading && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginTop: '8px',
                justifyContent: 'flex-start'
              }}>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      onInputChange(suggestion);
                      // A bit of a hack to submit form from outside
                      setTimeout(() => {
                        const fakeEvent = { preventDefault: () => {} };
                        onSubmit(fakeEvent);
                      }, 100);
                    }}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${theme.colors.textLight}`,
                      borderRadius: '16px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      color: theme.colors.textGray,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = theme.colors.background;
                      e.target.style.borderColor = theme.colors.primary;
                      e.target.style.color = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'transparent';
                      e.target.style.borderColor = theme.colors.textLight;
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

          {/* Chat Input */}
          <div style={{
            padding: '16px',
            borderTop: '1px solid #e5e7eb',
            borderRadius: '0 0 16px 16px'
          }}>
            <form onSubmit={onSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Ask about your progress..."
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: `1px solid ${theme.colors.textLight}`,
                  borderRadius: '20px',
                  fontSize: '14px',
                  outline: 'none',
                  background: '#f8fafc'
                }}
                onFocus={(e) => e.target.style.borderColor = theme.colors.primary}
                onBlur={(e) => e.target.style.borderColor = theme.colors.textLight}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                style={{
                  width: '40px',
                  height: '40px',
                  background: theme.gradients.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !input.trim() ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => !loading && input.trim() && (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% { 
            opacity: 1; 
            transform: scale(1);
          }
          50% { 
            opacity: 0.8; 
            transform: scale(1.05);
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};
