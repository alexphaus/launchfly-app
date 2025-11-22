// src/components/LaunchflyDashboard.js
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, Globe, Bot, Clock, TrendingUp, ChevronRight, ChevronDown, Zap, Eye, Mail, CheckCircle, Sparkles, Loader2, Wallet, X } from 'lucide-react';
import UserProfile from './UserProfile';
import FloatingChat from './FloatingChat';
import CustomersCard from './EnhancedCustomerCard';
import AllCustomersPage from './AllCustomersPage';
import BusinessManagementCard from './BusinessManagementCard';

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

// --- COMPONENT: Activity Detail Modal ---
const ActivityDetailModal = ({ activity, onClose }) => {
  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

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
      case 'success':
        return {
          title: 'AI Success Activity',
          details: [
            { label: 'Type', value: 'Customer Acquisition' },
            { label: 'Status', value: 'Completed' },
            { label: 'Time', value: activity.time }
          ]
        };
      case 'working':
        return {
          title: 'AI Working Activity',
          details: [
            { label: 'Type', value: 'Active Process' },
            { label: 'Status', value: 'In Progress' },
            { label: 'Time', value: activity.time }
          ]
        };
      default:
        return {
          title: 'AI Activity',
          details: [
            { label: 'Type', value: activity.type || 'General' },
            { label: 'Status', value: 'Completed' },
            { label: 'Time', value: activity.time }
          ]
        };
    }
  };

  const info = getDetailedInfo(activity);

  return (
    <div 
      onClick={onClose}
      style={{
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
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.colors.white,
          borderRadius: '20px',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: theme.shadows.xl
        }}
      >
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

// --- COMPONENT: Cash Out Modal ---
const CashOutModal = ({ isOpen, onClose, totalRevenue, availableToCashOut, business, bankDetails, todayRevenue = 0 }) => {
  const [speed, setSpeed] = useState('standard'); // 'standard' | 'instant'
  const [feePreview, setFeePreview] = useState(0);
  const [netAmount, setNetAmount] = useState(availableToCashOut);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (speed === 'instant' && bankDetails?.instantEligible) {
      const fee = Math.max(0.5, Math.round(availableToCashOut * 0.015 * 100) / 100);
      setFeePreview(fee);
      setNetAmount(Math.max(0, availableToCashOut - fee));
    } else {
      setFeePreview(0);
      setNetAmount(availableToCashOut);
      // Auto-fallback to standard if instant not eligible
      if (speed === 'instant' && !bankDetails?.instantEligible) {
        setSpeed('standard');
      }
    }
  }, [speed, availableToCashOut, bankDetails?.instantEligible]);

  if (!isOpen) return null;

  return (
    <div 
      onClick={(e) => {
        if (!isSubmitting) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'fadeIn 0.2s ease',
        padding: '20px'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '28px',
          padding: '0',
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25), 0 8px 16px rgba(0, 0, 0, 0.15)',
          animation: 'slideInUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header with gradient background */}
        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          padding: '28px 32px',
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Decorative circles */}
          <div style={{
            position: 'absolute',
            top: '-30px',
            right: '-30px',
            width: '120px',
            height: '120px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-20px',
            left: '-20px',
            width: '80px',
            height: '80px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '50%'
          }} />
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            position: 'relative',
            zIndex: 1
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={28} style={{ strokeWidth: 2.5 }} />
                <h2 style={{
                  fontSize: '26px',
                  fontWeight: '800',
                  margin: 0,
                  letterSpacing: '-0.5px'
                }}>
                  Cash Out
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                padding: '8px',
                borderRadius: '10px',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)',
                opacity: isSubmitting ? 0.5 : 1
              }}
              onMouseEnter={e => !isSubmitting && (e.target.style.background = 'rgba(255, 255, 255, 0.25)')}
              onMouseLeave={e => !isSubmitting && (e.target.style.background = 'rgba(255, 255, 255, 0.15)')}
            >
              <X size={20} color="white" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div style={{
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '32px',
          flex: 1
        }}>

          {/* Amount Summary - Prominent Display */}
          <div style={{
            textAlign: 'center',
            marginBottom: '32px'
          }}>
            <p style={{ 
              fontSize: '14px', 
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '600',
              margin: '0 0 12px 0'
            }}>
              Available Balance
            </p>
            <h3 style={{ 
              fontSize: '56px', 
              fontWeight: '900', 
              margin: '0 0 16px 0',
              color: '#059669',
              letterSpacing: '-2px',
              lineHeight: '1'
            }}>
              ${availableToCashOut.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              {todayRevenue > 0 && (
                <>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#dcfce7',
                    color: '#059669',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}>
                    <TrendingUp size={14} />
                    +${todayRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} today
                  </div>
                </>
              )}
              <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: '500' }}>
                ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total earned
              </span>
            </div>
          </div>

          {/* Payment Method - Enhanced */}
          <div style={{ marginBottom: '28px' }}>
            <h4 style={{ 
              fontSize: '15px', 
              fontWeight: '700', 
              color: '#374151',
              marginBottom: '14px',
              letterSpacing: '-0.2px'
            }}>
              Deposit To
            </h4>
            <div style={{
              background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)',
              border: '2px solid #e5e7eb',
              borderRadius: '16px',
              padding: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              transition: 'all 0.2s',
              cursor: 'default'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                flexShrink: 0
              }}>
                🏦
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ 
                  fontSize: '16px', 
                  fontWeight: '700', 
                  color: '#111827', 
                  margin: '0 0 4px 0',
                  letterSpacing: '-0.3px'
                }}>
                  {bankDetails?.bank_name || 'Bank Account'}
                </p>
                <p style={{ 
                  fontSize: '14px', 
                  color: '#6b7280', 
                  margin: 0,
                  fontWeight: '500'
                }}>
                  {bankDetails?.last4 ? `•••• •••• •••• ${bankDetails.last4}` : 'Secured by Stripe'}
                </p>
              </div>
              <CheckCircle size={22} color="#10b981" style={{ flexShrink: 0 }} />
            </div>
          </div>

          {/* Speed Selector - Improved UX */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ 
              fontSize: '15px', 
              fontWeight: '700', 
              color: '#374151',
              marginBottom: '14px',
              letterSpacing: '-0.2px'
            }}>
              Transfer Speed
            </h4>
            <div style={{ display: 'flex', gap: '12px' }}>
              {/* Standard Option */}
              <button
                onClick={() => setSpeed('standard')}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  background: speed === 'standard' 
                    ? 'linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%)'
                    : '#fafafa',
                  border: `2px solid ${speed === 'standard' ? '#10b981' : '#e5e7eb'}`,
                  borderRadius: '14px',
                  padding: '16px 14px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                  opacity: isSubmitting ? 0.6 : 1
                }}
                onMouseEnter={e => !isSubmitting && speed !== 'standard' && (e.target.style.borderColor = '#cbd5e1')}
                onMouseLeave={e => !isSubmitting && speed !== 'standard' && (e.target.style.borderColor = '#e5e7eb')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <Clock size={18} color={speed === 'standard' ? '#059669' : '#6b7280'} />
                  <span style={{ 
                    fontSize: '15px', 
                    fontWeight: '700',
                    color: speed === 'standard' ? '#059669' : '#374151'
                  }}>
                    Standard
                  </span>
                </div>
                <p style={{ 
                  fontSize: '13px', 
                  color: speed === 'standard' ? '#065f46' : '#6b7280',
                  margin: '0 0 6px 0',
                  fontWeight: '500'
                }}>
                  1-2 business days
                </p>
                <div style={{
                  display: 'inline-block',
                  background: speed === 'standard' ? '#10b981' : '#10b981',
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700'
                }}>
                  FREE
                </div>
              </button>

              {/* Instant Option */}
              <button
                onClick={() => bankDetails?.instantEligible && setSpeed('instant')}
                disabled={!bankDetails?.instantEligible || isSubmitting}
                style={{
                  flex: 1,
                  background: speed === 'instant' 
                    ? 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)'
                    : '#fafafa',
                  border: `2px solid ${speed === 'instant' ? '#f59e0b' : '#e5e7eb'}`,
                  borderRadius: '14px',
                  padding: '16px 14px',
                  cursor: (!bankDetails?.instantEligible || isSubmitting) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                  opacity: (!bankDetails?.instantEligible || isSubmitting) ? 0.5 : 1
                }}
                onMouseEnter={e => !isSubmitting && bankDetails?.instantEligible && speed !== 'instant' && (e.target.style.borderColor = '#cbd5e1')}
                onMouseLeave={e => !isSubmitting && bankDetails?.instantEligible && speed !== 'instant' && (e.target.style.borderColor = '#e5e7eb')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <Zap size={18} color={speed === 'instant' ? '#d97706' : '#6b7280'} />
                  <span style={{ 
                    fontSize: '15px', 
                    fontWeight: '700',
                    color: speed === 'instant' ? '#d97706' : '#374151'
                  }}>
                    Instant
                  </span>
                </div>
                <p style={{ 
                  fontSize: '13px', 
                  color: speed === 'instant' ? '#92400e' : '#6b7280',
                  margin: '0 0 6px 0',
                  fontWeight: '500'
                }}>
                  {bankDetails?.instantEligible ? 'Within minutes' : 'Not available'}
                </p>
                <div style={{
                  display: 'inline-block',
                  background: speed === 'instant' ? '#f59e0b' : '#d1d5db',
                  color: speed === 'instant' ? 'white' : '#6b7280',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700'
                }}>
                  1.5% FEE
                </div>
              </button>
            </div>
            
            {/* Instant eligibility message */}
            {!bankDetails?.instantEligible && (
              <div style={{
                marginTop: '12px',
                padding: '12px 14px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '12px',
                fontSize: '13px',
                color: '#92400e',
                display: 'flex',
                alignItems: 'start',
                gap: '10px'
              }}>
                <span style={{ fontSize: '16px', lineHeight: '1' }}>💡</span>
                <p style={{ margin: 0, lineHeight: '1.5', fontWeight: '500' }}>
                  Connect a debit card in your Stripe account to enable instant payouts
                </p>
              </div>
            )}
          </div>

          {/* Instant Fee Breakdown - Enhanced */}
          {speed === 'instant' && bankDetails?.instantEligible && (
            <div style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '2px solid #fde68a',
              borderRadius: '16px',
              padding: '18px',
              marginBottom: '20px'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginBottom: '14px',
                paddingBottom: '12px',
                borderBottom: '1px solid #fde68a'
              }}>
                <Zap size={18} color="#f59e0b" />
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: '700', 
                  color: '#92400e',
                  letterSpacing: '-0.2px'
                }}>
                  Instant Transfer Breakdown
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#78350f', fontWeight: '500' }}>
                    Transfer amount
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: '#78350f' }}>
                    ${availableToCashOut.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#78350f', fontWeight: '500' }}>
                    Instant fee (1.5%, min $0.50)
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: '#dc2626' }}>
                    -${feePreview.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                
                <div style={{
                  marginTop: '8px',
                  paddingTop: '12px',
                  borderTop: '2px solid #fde68a',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '15px', color: '#78350f', fontWeight: '700' }}>
                    You receive
                  </span>
                  <span style={{ fontSize: '20px', fontWeight: '900', color: '#059669', letterSpacing: '-0.5px' }}>
                    ${netAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              
              {bankDetails?.instantAvailable < availableToCashOut && (
                <div style={{ 
                  marginTop: '14px', 
                  padding: '10px 12px', 
                  background: '#fef3c7', 
                  borderRadius: '10px', 
                  fontSize: '13px',
                  color: '#92400e',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>⚠️</span>
                  <span>
                    Instant limit: ${bankDetails?.instantAvailable?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} available
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons - Fixed Footer */}
        <div style={{ 
          padding: '24px 32px',
          borderTop: '1px solid #e5e7eb',
          background: 'white',
          display: 'flex', 
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              flex: 1,
              background: 'white',
              border: '2px solid #e5e7eb',
              borderRadius: '14px',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '700',
              color: '#6b7280',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: isSubmitting ? 0.5 : 1
            }}
            onMouseEnter={e => !isSubmitting && (e.target.style.borderColor = '#cbd5e1')}
            onMouseLeave={e => !isSubmitting && (e.target.style.borderColor = '#e5e7eb')}
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setIsSubmitting(true);
              try {
                const response = await fetch('/api/cashout/request', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    businessId: business?.id,
                    amount: availableToCashOut,
                    speed
                  })
                });

                const result = await response.json();
                
                if (response.ok) {
                  alert(speed === 'instant' 
                    ? `✅ Instant cashout initiated! $${netAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will arrive shortly (fee: $${(feePreview).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`
                    : `✅ Cashout initiated! $${availableToCashOut.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will reach your bank in 1–2 business days.`);
                  window.location.reload();
                } else {
                  // Enhanced error handling with user-friendly messages
                  if (result.action === 'connect_bank') {
                    alert('❌ Please connect your bank account first.');
                  } else if (result.code === 'rate_limited') {
                    alert('⏰ Too many cashout requests. Please wait an hour before trying again.');
                  } else if (result.code === 'instant_not_supported') {
                    alert('💳 Instant payouts require a debit card. Please add one in your Stripe account settings or use standard payout.');
                  } else if (result.code === 'daily_limit_exceeded') {
                    alert('📅 Daily instant payout limit reached. Please try again tomorrow or use standard payout.');
                  } else if (result.code === 'instant_limit_exceeded') {
                    alert(`⚠️ Amount exceeds instant availability. Maximum instant: $${result.instantAvailable?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`);
                  } else if (result.code === 'insufficient_funds_with_fee') {
                    alert(`⚠️ Insufficient funds to cover instant fee. Fee: $${result.fee?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`);
                  } else {
                    alert(`❌ Cashout failed: ${result.error}`);
                  }
                  setIsSubmitting(false);
                }
              } catch (error) {
                console.error('Cashout error:', error);
                alert('❌ Cashout failed. Please try again.');
                setIsSubmitting(false);
              }
            }}
            disabled={isSubmitting}
            style={{
              flex: 2,
              background: isSubmitting 
                ? '#9ca3af'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '14px',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '800',
              color: 'white',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: isSubmitting ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
              letterSpacing: '-0.3px'
            }}
            onMouseEnter={e => !isSubmitting && (e.target.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => !isSubmitting && (e.target.style.transform = 'translateY(0)')}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                Processing...
              </>
            ) : (
              <>
                <DollarSign size={20} style={{ strokeWidth: 2.5 }} />
                Confirm Transfer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: Money Hero Card (PayPal Style) ---
const MoneyHeroCard = ({ totalRevenue, todayRevenue, availableBalance, onCashOutClick, theme }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0070f3 0%, #00c9ff 100%)',
      borderRadius: '24px',
      padding: '32px',
      color: 'white',
      marginBottom: '24px',
      boxShadow: '0 10px 40px rgba(0, 112, 243, 0.3)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative background elements */}
      <div style={{
        position: 'absolute',
        top: '-80px',
        right: '-80px',
        width: '250px',
        height: '250px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-50px',
        left: '-50px',
        width: '180px',
        height: '180px',
        background: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ 
          fontSize: '15px', 
          opacity: 0.9, 
          marginBottom: '8px',
          fontWeight: '500',
          letterSpacing: '0.3px'
        }}>
          💰 Your Balance
        </div>

        {/* Main Amount - Available Balance */}
        <div style={{ 
          fontSize: '52px', 
          fontWeight: '900', 
          marginBottom: '12px',
          lineHeight: '1',
          letterSpacing: '-0.5px'
        }}>
          ${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>

        {/* Today's Change and Total Earned */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: todayRevenue > 0 ? '28px' : '16px'
        }}>
          {todayRevenue > 0 && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(16, 185, 129, 0.25)',
              padding: '10px 18px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '700',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              backdropFilter: 'blur(10px)'
            }}>
              <span style={{ fontSize: '20px' }}>↑</span>
              +${todayRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} today
            </div>
          )}
          
          <div style={{
            fontSize: '16px',
            opacity: 0.9,
            fontWeight: '500'
          }}>
            {todayRevenue > 0 && '• '}${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total earned
          </div>
        </div>

        {/* Cash Out Button Section */}
        <div style={{
          marginTop: '28px',
          paddingTop: '28px',
          borderTop: '1px solid rgba(255, 255, 255, 0.25)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px'
          }}>
            <div>
              <div style={{ fontSize: '13px', opacity: 0.85, marginBottom: '6px', letterSpacing: '0.3px' }}>
                Ready to withdraw
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>
                ${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <button
              onClick={onCashOutClick}
              disabled={availableBalance <= 0}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              style={{
                background: availableBalance > 0 ? 'white' : 'rgba(255, 255, 255, 0.2)',
                color: availableBalance > 0 ? '#0070f3' : 'rgba(255, 255, 255, 0.5)',
                border: 'none',
                padding: '16px 32px',
                borderRadius: '14px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: availableBalance > 0 ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
                boxShadow: availableBalance > 0 ? '0 4px 16px rgba(0, 0, 0, 0.15)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transform: isHovered && availableBalance > 0 ? 'translateY(-2px)' : 'translateY(0)',
                opacity: availableBalance <= 0 ? 0.5 : 1
              }}
            >
              <DollarSign size={20} />
              <span>Cash Out Now</span>
              <span style={{ fontSize: '18px', transition: 'transform 0.2s', transform: isHovered ? 'translateX(3px)' : 'translateX(0)' }}>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: Revenue Dropdown for Header ---
const RevenueDropdown = ({ totalRevenue = 0, availableToCashOut = 0, canCashOut = false, theme, business, onCashOutClick, todayRevenue = 0 }) => {
  const [displayAvailable, setDisplayAvailable] = useState(availableToCashOut);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  useEffect(() => {
    if (availableToCashOut > displayAvailable) {
      const timer = setTimeout(() => {
        setDisplayAvailable(prev => Math.min(prev + 50, availableToCashOut));
      }, 25);
      return () => clearTimeout(timer);
    } else if (availableToCashOut < displayAvailable) {
      // Handle decrease (after cashout)
      setDisplayAvailable(availableToCashOut);
    }
  }, [availableToCashOut, displayAvailable]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDropdownOpen && !event.target.closest('.revenue-dropdown')) {
        setIsDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  return (
    <div className="revenue-dropdown" style={{ position: 'relative' }}>
      {/* Revenue Trigger Button */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
        }}
        onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
        onMouseLeave={e => e.target.style.transform = 'scale(1)'}
      >
        <DollarSign size={16} />
        {displayAvailable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        <ChevronDown size={14} style={{ 
          transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease'
        }} />
      </button>

      {/* Dropdown Content */}
      {isDropdownOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '8px',
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          minWidth: '280px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
          border: `1px solid ${theme.colors.borderLight}`,
          zIndex: 1000
        }}>
          {/* Revenue Display */}
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <p style={{ 
              fontSize: '12px', 
              color: theme.colors.textGray, 
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Available to Cash Out
            </p>
            <h3 style={{ 
              fontSize: '32px', 
              fontWeight: '900', 
              color: theme.colors.textDark,
              marginBottom: '8px'
            }}            >
              ${displayAvailable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '6px',
              marginBottom: '16px',
              flexWrap: 'wrap'
            }}>
              {todayRevenue > 0 && (
                <>
                  <span style={{ 
                    color: '#10b981', 
                    fontSize: '14px', 
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    ↑ +${todayRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} today
                  </span>
                  <span style={{ color: theme.colors.textGray }}>•</span>
                </>
              )}
              <span style={{ color: theme.colors.textGray, fontSize: '14px', fontWeight: '500' }}>
                ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
              </span>
            </div>
          </div>
          
          {/* Cash Out Button */}
            <button
            disabled={!canCashOut}
            onClick={() => {
              if (canCashOut) {
                onCashOutClick();
                setIsDropdownOpen(false);
              }
            }}
            style={{
              width: '100%',
              background: canCashOut ? theme.gradients.success : theme.colors.bgGray,
              border: 'none',
              padding: '12px 16px',
              borderRadius: '8px',
              color: canCashOut ? 'white' : theme.colors.textGray,
              fontSize: '14px',
              fontWeight: '600',
              cursor: canCashOut ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              opacity: canCashOut ? 1 : 0.6
            }}
            onMouseEnter={e => canCashOut && (e.target.style.transform = 'translateY(-1px)')}
            onMouseLeave={e => canCashOut && (e.target.style.transform = 'translateY(0)')}
          >
            <DollarSign size={16} />
            {canCashOut ? 'Cash Out Now' : 'Nothing to cash out yet'}
          </button>
        </div>
      )}
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
  
  // Live visitors: display real views; remove simulated/random noise
  useEffect(() => {
    if (showContent.complete) {
      setCurrentVisitors(Number(business?.views || 0));
    }
  }, [showContent.complete, business?.views]);

  const themeColors = businessData?.theme || {
    colors: { primary: '#007BFF', secondary: '#00B8D9' },
    gradient: 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)'
  };

  const handleCardClick = () => {
    if (showContent.complete && websiteUrl) {
      window.open(websiteUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      style={{
        background: 'white',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: theme.shadows.lg,
        marginBottom: '24px',
        transition: 'all 0.5s ease',
        cursor: showContent.complete && websiteUrl ? 'pointer' : 'default'
      }}
      onMouseEnter={(e) => {
        if (showContent.complete && websiteUrl) {
          e.currentTarget.style.transform = 'scale(1.02)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {/* Header */}
      <div style={{
        background: showContent.colors ? themeColors.gradient.replace(/;\s*$/, '') : 'linear-gradient(135deg, #e5e7eb 0%, #f3f4f6 100%)',
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
              onClick={(e) => e.stopPropagation()}
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
const AIActivityFeed = ({ generationStage, businessData, business, sessionId }) => {
  const router = useRouter();
  const [activities, setActivities] = useState([]);
  const [currentStage, setCurrentStage] = useState('');
  const [previousBusinessData, setPreviousBusinessData] = useState({});
  const [realActivitiesLoaded, setRealActivitiesLoaded] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);

  // Helper function to determine if an activity should show a progress spinner
  const shouldShowSpinner = (activity) => {
    const activityText = (activity.text || '').toLowerCase();

    // BLOCKLIST: Keywords for completed events that should NEVER have a spinner.
    const completedKeywords = [
      'visitor viewed',
      'visitor spent',
      'visitor returned',
      'visitor switched',
      'scrolled to',
      'setup skipped or failed',
      'are ready for checkout',
      'viewed page',
      'spent 14s on page',
      'returned to page'
    ];

    if (completedKeywords.some(keyword => activityText.includes(keyword))) {
      return false;
    }

    // ALLOWLIST: Conditions for showing a spinner.
    // Condition 1: The type is explicitly 'working'.
    if (activity.type === 'working') {
      return true;
    }

    // Condition 2: The text contains explicit "AI is working" phrases.
    const aiWorkIndicators = [
      'ai is now actively hunting',
      'ai is working',
      'ai is processing',
      'ai is analyzing',
      'ai is generating'
    ];

    if (aiWorkIndicators.some(indicator => activityText.includes(indicator))) {
      return true;
    }

    // Default to no spinner.
    return false;
  };
  
  // Fetch real activities from API when business is available
  useEffect(() => {
    if (business?.id && generationStage === 'complete' && !realActivitiesLoaded) {
      console.log('🎯 Starting real-time activity polling for customer acquisition');
      fetchRealActivities();
      setRealActivitiesLoaded(true);
      
      // Set up aggressive polling for customer acquisition activities
      const interval = setInterval(fetchRealActivities, 3000); // Poll every 3 seconds for real-time updates
      return () => clearInterval(interval);
    }
  }, [business?.id, generationStage, realActivitiesLoaded]);

  // Also start polling immediately when generation finishes to catch the transition
  useEffect(() => {
    if (business?.id && generationStage === 'complete') {
      // Wait a few seconds for activities to start appearing, then begin polling
      const startPollingTimer = setTimeout(() => {
        if (!realActivitiesLoaded) {
          console.log('🚀 Generation complete - starting customer acquisition activity monitoring');
          fetchRealActivities();
        }
      }, 5000); // Wait 5 seconds after completion
      
      return () => clearTimeout(startPollingTimer);
    }
  }, [business?.id, generationStage]);

  const fetchRealActivities = async () => {
    try {
      // Fetch up to 100 activities for better scrolling experience
      const response = await fetch(`/api/business/${business.id}/activities?limit=100`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.activities.length > 0) {
          console.log(`📊 Fetched ${data.activities.length} real customer acquisition activities`);
          
          // Filter activities to max 1 week ago for performance
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          
          const filteredActivities = data.activities.filter(activity => {
            if (!activity.created_at && !activity.timestamp) return true; // Keep activities without dates
            const activityDate = new Date(activity.created_at || activity.timestamp);
            return activityDate >= oneWeekAgo;
          });
          
          // Add transition activity to show the switch to real activities
          const transitionActivity = {
            id: 'transition-to-real',
            icon: '🎯',
            text: `AI is now actively hunting for real customers for ${businessData.businessName || 'your business'}`,
            type: 'success',
            time: 'Just now',
            details: 'Customer acquisition engine fully activated'
          };
          
          // Combine transition with filtered real activities (limit to 100 total for performance)
          const allActivities = [transitionActivity, ...filteredActivities].slice(0, 100);
          setActivities(allActivities);
          return;
        } else {
          // No real activities yet, but show that we're actively working
          if (!realActivitiesLoaded) {
            const workingActivity = {
              id: 'customer-acquisition-starting',
              icon: '🚀',
              text: 'Customer acquisition engine activated - AI is starting to hunt for prospects',
              type: 'working',
              time: 'Just now',
              details: 'Real activities will appear as the AI finds and contacts prospects'
            };
            setActivities(prev => [workingActivity, ...prev.slice(0, 6)]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching real activities:', error);
    }
  };

  // Track specific business data changes for granular updates (only during generation)
  useEffect(() => {
    if (!businessData || generationStage === 'complete' || realActivitiesLoaded) return;
    
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
  }, [businessData, previousBusinessData, generationStage, realActivitiesLoaded]);
  
  // Generation stage activities (only during generation)
  useEffect(() => {
    if (generationStage === 'complete' || realActivitiesLoaded) return;
    
    const stageActivities = {
      pending: { text: 'Initializing AI systems...', icon: '🤖', type: 'working' },
      queued: { text: 'Queued for processing...', icon: '⏳', type: 'working' },
      analyzing: { text: 'Analyzing your skills and market opportunity', icon: '🔍', type: 'working' },
      researching: { text: 'Researching profitable niches in your industry', icon: '📊', type: 'working' },
      building: { text: 'Building your website and creating products', icon: '🔨', type: 'working' },
      generating: { text: 'Generating your business content and products', icon: '⚡', type: 'working' },
      finalizing: { text: 'Optimizing for conversions and profit', icon: '✨', type: 'working' },
      complete: { text: 'Your business is ready! AI is now hunting for customers 🎉', icon: '🚀', type: 'success' }
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
  }, [generationStage, currentStage, realActivitiesLoaded]);
  
  // Transition to real activities when generation completes
  useEffect(() => {
    if (generationStage === 'complete' && !realActivitiesLoaded) {
      const timer = setTimeout(() => {
        // Clear simulated activities and fetch real ones
        setActivities([]);
        fetchRealActivities();
        setRealActivitiesLoaded(true);
      }, 3000); // Wait 3 seconds after completion
      
      return () => clearTimeout(timer);
    }
  }, [generationStage, realActivitiesLoaded]);

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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Activity indicator dots */}
          <div style={{ display: 'flex', gap: '4px' }}>
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
      </div>

      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '16px',
        maxHeight: '400px', // Fixed height to prevent card expansion
        overflowY: 'auto', // Enable vertical scrolling
        overflowX: 'hidden', // Disable horizontal scrolling
        paddingRight: '4px', // Add some padding for scrollbar
        scrollbarWidth: 'thin', // Firefox
        scrollbarColor: '#c1c1c1 #f1f1f1', // Firefox
        WebkitScrollbarWidth: '6px', // Webkit browsers
      }}>
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (generationStage === 'complete' && sessionId) {
                  setSelectedActivity(activity);
                }
              }}
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'start',
                opacity: index < 3 ? 1 : 0.9, // Keep first 3 items fully opaque, others slightly faded
                transition: 'all 0.3s',
                animation: index === 0 ? 'slideInLeft 0.5s ease' : 'none',
                cursor: generationStage === 'complete' && sessionId ? 'pointer' : 'default',
                padding: '8px',
                borderRadius: '8px',
                margin: '-8px'
              }}
              onMouseEnter={(e) => {
                if (generationStage === 'complete' && sessionId) {
                  e.currentTarget.style.background = theme.colors.bgLight;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: '20px', flexShrink: 0 }}>{activity.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
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
                  marginBottom: '4px',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word'
                }}>
                  {activity.text}
                  {shouldShowSpinner(activity) && (
                    <span style={{ 
                      display: 'inline-block',
                      marginLeft: '8px',
                      animation: 'pulse 1.5s ease-in-out infinite'
                    }}>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    </span>
                  )}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}>
                  <p style={{ 
                    fontSize: '13px', 
                    color: theme.colors.textGray, 
                    margin: 0,
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    flex: 1
                  }}>{activity.time}</p>
                  {generationStage === 'complete' && sessionId && (
                    <ChevronRight size={14} style={{ color: theme.colors.textGray, opacity: 0.6 }} />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Activity Detail Modal */}
      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </div>
  );
};

// --- COMPONENT: Insights / Growth Metrics ---
const InsightsCard = ({ isSetupComplete, generationStage, businessData, business }) => {
  // Calculate real business metrics
  const currentRevenue = business?.total_revenue || business?.revenue || 0;
  const milestone = currentRevenue < 1000 ? 1000 : currentRevenue < 5000 ? 5000 : 10000; // Dynamic milestone
  const progressPercentage = Math.min((currentRevenue / milestone) * 100, 100);
  
  // Enhanced metrics calculation using real data
  const totalVisitors = Math.max(
    Number(business?.total_visitors || 0),
    Number(business?.views || 0)
  );
  
  // Get prospects from multiple possible sources
  const totalProspects = Math.max(
    Number(business?.growth_data?.customers?.totalLeads || 0),
    Number(business?.total_leads || 0),
    Number(business?.total_prospects || 0),
    // Also check business_data for conversion metrics
    Number(business?.business_data?.conversionMetrics?.totalConversions || 0)
  );
  
  // Get conversion rate from real data or calculate
  const conversionRate = business?.growth_data?.customers?.conversionRate 
    ? (business.growth_data.customers.conversionRate * 100).toFixed(1)
    : totalVisitors > 0 && totalProspects > 0
      ? Math.min(((totalProspects / totalVisitors) * 100), 100).toFixed(1)
      : totalProspects > 0 && totalVisitors === 0
        ? '100.0' // If we have prospects but no tracked visitors, assume high conversion
        : '0.0';
  
  // Calculate pipeline value using real data
  const averageDealSize = business?.average_deal_size || 
                         business?.business_data?.averageOrderValue ||
                         150; // fallback
  const pipelineValue = totalProspects * averageDealSize;
  
  // Daily visitors calculation - more realistic approach
  const businessAge = business?.created_at 
    ? Math.max(1, Math.floor((Date.now() - new Date(business.created_at).getTime()) / (1000 * 60 * 60 * 24)))
    : 1;
  const dailyVisitors = Math.max(
    Math.floor(totalVisitors / Math.max(businessAge, 1)), // Average daily over business lifetime
    totalVisitors > 0 ? 1 : 0 // At least 1 if we have any visitors
  );
  
  // Growth trend calculation using real business data
  const getGrowthTrend = () => {
    if (generationStage !== 'complete') return { text: 'Building momentum...', percentage: 0 };
    
    // Calculate growth based on actual metrics
    const hasRevenue = currentRevenue > 0;
    const hasProspects = totalProspects > 0;
    const hasVisitors = totalVisitors > 0;
    const hasRecentActivity = business?.last_growth_campaign_at && 
      (Date.now() - new Date(business.last_growth_campaign_at).getTime()) < (7 * 24 * 60 * 60 * 1000); // Within last week
    
    let growthRate = 0;
    if (hasRevenue) growthRate += 15; // Revenue adds significant growth signal
    if (hasProspects) growthRate += 8; // Prospects indicate pipeline
    if (hasVisitors) growthRate += 5; // Visitors show traction
    if (hasRecentActivity) growthRate += 7; // Recent AI activity shows momentum
    
    // Add time-based growth (businesses naturally grow over time)
    const daysSinceGeneration = Math.floor(
      (Date.now() - new Date(business?.created_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24)
    );
    growthRate += Math.min(daysSinceGeneration * 2, 15); // Up to 15% from time
    
    // Cap at reasonable maximum
    growthRate = Math.min(growthRate, 45);
    
    return { text: `+${growthRate}%`, percentage: growthRate };
  };

  const growthTrend = getGrowthTrend();

  // Next milestone messaging
  const getNextMilestoneText = () => {
    if (currentRevenue === 0) return 'First sale incoming';
    if (currentRevenue < 1000) return `$${(1000 - currentRevenue).toFixed(0)} to $1K milestone`;
    if (currentRevenue < 5000) return `$${(5000 - currentRevenue).toFixed(0)} to $5K milestone`;
    if (currentRevenue < 10000) return `$${(10000 - currentRevenue).toFixed(0)} to $10K milestone`;
    return 'Scaling phase achieved';
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
      borderRadius: '20px',
      padding: '24px',
      marginBottom: '24px',
      border: '2px solid #fbbf24'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <TrendingUp size={24} color="#f59e0b" />
        <h3 style={{ fontSize: '22px', fontWeight: '700', color: '#92400e' }}>
          Insights
        </h3>
      </div>

      {/* Revenue Milestone Progress */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <p style={{ fontSize: '15px', color: '#92400e', margin: 0 }}>Revenue Milestone</p>
          <p style={{ fontSize: '15px', fontWeight: '600', color: '#78350f', margin: 0 }}>
            ${currentRevenue.toLocaleString()} / ${milestone.toLocaleString()}
          </p>
        </div>
        <div style={{
          width: '100%',
          height: '8px',
          background: 'rgba(245, 158, 11, 0.2)',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${progressPercentage}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: '4px',
            transition: 'width 0.5s ease'
          }} />
        </div>
      </div>

      {/* Enhanced Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <p style={{ fontSize: '15px', color: '#92400e', marginBottom: '4px' }}>Daily Visitors</p>
          <p style={{ fontSize: '22px', fontWeight: '700', color: '#78350f' }}>
            {dailyVisitors}
          </p>
          <p style={{ fontSize: '13px', color: '#92400e', opacity: 0.8 }}>
            {totalVisitors > 0 
              ? `${totalVisitors} total visits`
              : generationStage === 'complete' 
                ? 'AI building traffic...' 
                : 'Traffic coming soon'}
          </p>
        </div>
        <div>
          <p style={{ fontSize: '15px', color: '#92400e', marginBottom: '4px' }}>Conversion Rate</p>
          <p style={{ fontSize: '22px', fontWeight: '700', color: '#78350f' }}>
            {conversionRate}%
          </p>
          <p style={{ fontSize: '13px', color: '#92400e', opacity: 0.8 }}>
            {totalProspects > 0 
              ? 'Visitor to prospect'
              : generationStage === 'complete' 
                ? 'AI acquiring prospects...'
                : 'Prospects incoming'}
          </p>
        </div>
      </div>

      {/* Bottom Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <p style={{ fontSize: '15px', color: '#92400e', marginBottom: '4px' }}>Pipeline Value</p>
          <p style={{ fontSize: '20px', fontWeight: '700', color: '#78350f' }}>
            ${pipelineValue.toLocaleString()}
          </p>
          <p style={{ fontSize: '13px', color: '#92400e', opacity: 0.8 }}>
            {totalProspects > 0 
              ? `${totalProspects} active prospects`
              : generationStage === 'complete'
                ? 'Building prospect pipeline...'
                : 'Pipeline loading...'}
          </p>
        </div>
        <div>
          <p style={{ fontSize: '15px', color: '#92400e', marginBottom: '4px' }}>Growth Trend</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={16} color="#10b981" />
            <p style={{ fontSize: '20px', fontWeight: '700', color: '#10b981', margin: 0 }}>
              {growthTrend.text}
            </p>
          </div>
          <p style={{ fontSize: '13px', color: '#92400e', opacity: 0.8 }}>
            {generationStage === 'complete' 
              ? 'AI-driven growth'
              : 'Building momentum'}
          </p>
        </div>
      </div>

      {/* Next Milestone / Action Items */}
      {generationStage === 'complete' && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(245, 158, 11, 0.2)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '16px' }}>🎯</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '15px', color: '#92400e', fontWeight: '600', margin: 0 }}>
              Next Milestone
            </p>
            <p style={{ fontSize: '14px', color: '#92400e', margin: 0, opacity: 0.9 }}>
              {getNextMilestoneText()}
            </p>
          </div>
        </div>
      )}
      
      {/* Milestone Achievement Celebration */}
      {currentRevenue >= milestone && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(16, 185, 129, 0.2)',
          borderRadius: '8px',
          fontSize: '15px',
          color: '#047857',
          fontWeight: '600',
          textAlign: 'center',
          animation: 'fadeIn 0.5s ease'
        }}>
          🎉 Milestone achieved! Ready for next growth phase
        </div>
      )}
    </div>
  );
};

// --- COMPONENT: Simple Next Steps ---
const NextSteps = ({ onComplete, generationStage, setupStatus, onConnect, sessionId }) => {
  const router = useRouter();
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
            onClick={() => {
              if (sessionId) {
                router.push(`/dashboard/${sessionId}/settings`);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '16px',
              background: step.completed ? '#f0f9ff' : '#f0f9ff',
              border: `2px solid ${step.completed ? '#10b981' : '#3b82f6'}`,
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left',
              width: '100%'
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(4px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateX(0)')}
          >
            <span style={{ fontSize: '28px' }}>{step.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ 
                fontWeight: '600', 
                fontSize: '16px',
                color: theme.colors.textDark
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
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [bankDetails, setBankDetails] = useState(null);
  const [generationStarted, setGenerationStarted] = useState(false);
  const startedRef = useRef(false);

  // State for FloatingChat
  const [chatOpen, setChatOpen] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [cofounderStatus, setCofounderStatus] = useState(null);
  const [activities, setActivities] = useState([]);

  // Fetch cofounder status and activities for chat context
  useEffect(() => {
    if (business?.id) {
      fetchCofounderStatus();
      fetchActivities();
      fetchTodayRevenue();
      const interval = setInterval(() => {
        fetchCofounderStatus();
        fetchActivities();
        fetchTodayRevenue();
      }, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [business?.id]);

  const fetchCofounderStatus = async () => {
    try {
      const response = await fetch(`/api/ai-cofounder?businessId=${business.id}&action=status`);
      const data = await response.json();
      if (response.ok) {
        setCofounderStatus(data.status);
      }
    } catch (err) {
      console.error('Error fetching cofounder status:', err);
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await fetch(`/api/business/${business.id}/activities?limit=5`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setActivities(data.activities);
        }
      }
    } catch (err) {
      console.error('Error fetching activities for chat:', err);
    }
  };

  const fetchTodayRevenue = async () => {
    if (!business?.id) return;
    
    try {
      // Calculate today's start in ISO format
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();
      
      const response = await fetch(`/api/business/${business.id}/sales?since=${todayStart}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.sales) {
          const todayTotal = data.sales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
          setTodayRevenue(todayTotal);
        }
      }
    } catch (err) {
      console.error('Error fetching today revenue:', err);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatLoading(true);

    const newMessages = [...chatMessages, {
      id: Date.now(),
      type: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    }];
    setChatMessages(newMessages);

    try {
      const response = await fetch('/api/ai-cofounder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          action: 'conversation',
          data: {
            message: userMessage,
            context: {
              business: business.business_data,
              recentActivities: activities,
              status: cofounderStatus
            }
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        setChatMessages(prev => [...prev, {
          id: Date.now() + 1,
          type: 'ai',
          content: result.response || `I'm actively working on growing your business. What can I help with?`,
          timestamp: new Date().toISOString()
        }]);
      } else {
        throw new Error('AI response error');
      }
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'ai',
        content: 'I had a technical issue, but I\'m still working on your business in the background.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setChatLoading(false);
    }
  };
  
  // Fetch bank details and instant eligibility when cashout modal is opened
  const handleOpenCashOutModal = async () => {
    if (!business?.stripe_connect_account_id) {
      console.log('Bank not connected, cannot fetch details.');
      setShowCashOutModal(true);
      return;
    }

    try {
      const response = await fetch(`/api/stripe/connect/status?businessId=${business.id}`);
      const result = await response.json();
      if (response.ok && result.success) {
        setBankDetails({
          ...result.account_details,
          instantEligible: result.payout_options?.instantEligible || false,
          instantAvailable: result.payout_options?.instantAvailableUsd || 0
        });
      }
    } catch (error) {
      console.error('Failed to fetch bank details:', error);
    }
    setShowCashOutModal(true);
  };

  // Debug: Log business object to see what data is available
  console.log('Business object for Insights:', {
    id: business?.id,
    total_revenue: business?.total_revenue,
    views: business?.views,
    total_visitors: business?.total_visitors,
    total_leads: business?.total_leads,
    total_prospects: business?.total_prospects,
    growth_data: business?.growth_data,
    business_data: business?.business_data,
    created_at: business?.created_at,
    last_growth_campaign_at: business?.last_growth_campaign_at
  });
  
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
    bank: business?.bank_connected || false, // Only true if explicitly set after onboarding completion
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

  // Show All Customers page if requested
  if (showAllCustomers) {
    return (
      <AllCustomersPage
        business={business}
        onBack={() => setShowAllCustomers(false)}
      />
    );
  }

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
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              cursor: 'pointer',
              transition: 'transform 0.2s ease'
            }}
            onClick={() => window.location.reload()}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <span style={{ fontSize: '24px' }}>🚀</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: theme.colors.textDark }}>
              Launchfly
            </span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            {/* Revenue Dropdown
            <RevenueDropdown 
              totalRevenue={totalRevenue}
              todayRevenue={todayRevenue}
              availableToCashOut={
                // Use the new available_balance field
                parseFloat(business?.available_balance || 0)
              }
              canCashOut={parseFloat(business?.available_balance || 0) > 0} // Allow cashout when there's available balance
              theme={theme}
              business={business}
              onCashOutClick={handleOpenCashOutModal}
            /> */}
            
            {/* AI Active Indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                background: '#10b981',
                borderRadius: '50%',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }} />
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: theme.colors.textDark
              }}>
                AI Active
              </span>
            </div>
            
            <UserProfile theme={theme} session={session} business={business} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '0 24px'
      }}>

        {/* Money Hero Card - PayPal Style */}
        <MoneyHeroCard
          totalRevenue={totalRevenue}
          todayRevenue={todayRevenue}
          availableBalance={parseFloat(business?.available_balance || 0)}
          onCashOutClick={handleOpenCashOutModal}
          theme={theme}
        />

        {/* Real-time AI Activity Feed - Show how AI is working */}
        <AIActivityFeed 
          generationStage={generationStage}
          businessData={businessData}
          business={business}
          sessionId={session?.id}
        />

         {/* Customer Activity - Group with business performance */}
         {generationStage === 'complete' && (
           <CustomersCard 
             business={business} 
             onViewAll={() => setShowAllCustomers(true)}
           />
         )}

        {/* Live Website Preview with Real-time Updates */}
        <LiveWebsiteCard 
          subdomain={business?.subdomain}
          visitors={business?.views || 0}
          businessData={businessData}
          generationStage={generationStage}
          business={business}
        />

        {/* Insights - Revenue & Performance Metrics */}
        <InsightsCard 
          isSetupComplete={setupComplete}
          generationStage={generationStage}
          businessData={businessData}
          business={business}
        />

        {/* Simple Next Steps - Only show after generation */}
        {!setupComplete && (
          <NextSteps 
            onComplete={handleStepComplete}
            generationStage={generationStage}
            setupStatus={setupStatus}
            sessionId={session?.id}
            onConnect={async () => {
              try {
                const email = business?.form_data?.email;
                const res = await fetch('/api/stripe/connect', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ businessId: business.id, email })
                });
                const data = await res.json();
                if (!res.ok || !data?.url) throw new Error(data?.error || 'Failed to start Connect');
                window.location.href = data.url;
              } catch (e) {
                alert(`Stripe Connect error: ${e.message}`);
              }
            }}
          />
        )}
      </main>

      <FloatingChat
        isOpen={chatOpen}
        onToggle={() => {
          setChatOpen(!chatOpen);
          if (!chatOpen && hasUnreadMessages) {
            setHasUnreadMessages(false);
          }
        }}
        messages={chatMessages}
        input={chatInput}
        loading={chatLoading}
        onInputChange={setChatInput}
        onSubmit={handleChatSubmit}
        business={business}
        hasUnread={hasUnreadMessages}
      />

      {/* Cash Out Modal */}
      <CashOutModal
        isOpen={showCashOutModal}
        onClose={() => setShowCashOutModal(false)}
        totalRevenue={totalRevenue}
        todayRevenue={todayRevenue}
        availableToCashOut={parseFloat(business?.available_balance || 0)}
        business={business}
        bankDetails={bankDetails}
      />

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
        
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
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