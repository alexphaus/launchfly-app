// src/components/ConnectAccountStatus.js
import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Clock, CreditCard } from 'lucide-react';

const ConnectAccountStatus = ({ business, onUpdate }) => {
  const [connectStatus, setConnectStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (business?.id) {
      fetchConnectStatus();
    }
  }, [business?.id]);

  const fetchConnectStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/stripe/connect/status?businessId=${business.id}`);
      const result = await response.json();
      
      if (response.ok) {
        setConnectStatus(result);
        if (onUpdate) {
          onUpdate(result);
        }
      } else {
        console.error('Failed to fetch Connect status:', result.error);
      }
    } catch (error) {
      console.error('Connect status error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectBank = async () => {
    try {
      setConnecting(true);
      const response = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          email: business.form_data?.email || business.email,
          refreshUrl: window.location.href,
          returnUrl: window.location.href
        })
      });

      const result = await response.json();
      
      if (response.ok && result.onboarding_url) {
        window.location.href = result.onboarding_url;
      } else {
        alert(`Bank connection failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Connect onboarding error:', error);
      alert('Failed to start bank connection. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
        return <CheckCircle size={20} color="#10b981" />;
      case 'pending_verification':
        return <Clock size={20} color="#f59e0b" />;
      case 'requires_action':
        return <AlertCircle size={20} color="#ef4444" />;
      default:
        return <CreditCard size={20} color="#6b7280" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
        return '#10b981';
      case 'pending_verification':
        return '#f59e0b';
      case 'requires_action':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: '#f3f4f6',
            borderRadius: '50%',
            animation: 'pulse 1.5s ease-in-out infinite'
          }} />
          <div>
            <div style={{
              height: '20px',
              width: '150px',
              background: '#f3f4f6',
              borderRadius: '4px',
              marginBottom: '8px',
              animation: 'pulse 1.5s ease-in-out infinite'
            }} />
            <div style={{
              height: '16px',
              width: '200px',
              background: '#f3f4f6',
              borderRadius: '4px',
              animation: 'pulse 1.5s ease-in-out infinite'
            }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      marginBottom: '24px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'start',
        marginBottom: '16px'
      }}>
        <div>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#1a2b48',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🏦 Bank Account
          </h3>
          <p style={{
            fontSize: '16px',
            color: '#5a6982',
            margin: 0
          }}>
            Connect your bank account to receive payments instantly
          </p>
        </div>
      </div>

      {connectStatus ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px',
          background: connectStatus.connected ? '#f0f9ff' : '#fef3c7',
          borderRadius: '12px',
          border: `2px solid ${getStatusColor(connectStatus.status)}20`,
          marginBottom: '16px'
        }}>
          {getStatusIcon(connectStatus.status)}
          <div style={{ flex: 1 }}>
            <p style={{
              fontSize: '16px',
              fontWeight: '600',
              color: getStatusColor(connectStatus.status),
              margin: 0,
              marginBottom: '4px'
            }}>
              {connectStatus.message}
            </p>
            {connectStatus.requirements?.currently_due?.length > 0 && (
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: 0
              }}>
                Required: {connectStatus.requirements.currently_due.join(', ')}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {!connectStatus?.connected && (
        <button
          onClick={handleConnectBank}
          disabled={connecting}
          style={{
            width: '100%',
            background: connecting 
              ? '#9ca3af' 
              : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            border: 'none',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '16px',
            fontWeight: '700',
            color: 'white',
            cursor: connecting ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseEnter={e => !connecting && (e.target.style.transform = 'translateY(-1px)')}
          onMouseLeave={e => !connecting && (e.target.style.transform = 'translateY(0)')}
        >
          <CreditCard size={20} />
          {connecting ? 'Connecting...' : 'Connect Bank Account'}
        </button>
      )}

      {connectStatus?.connected && (
        <div style={{
          padding: '16px',
          background: '#f0f9ff',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: '14px',
            color: '#1e40af',
            margin: 0,
            fontWeight: '600'
          }}>
            ✅ Ready to receive payouts! You can now cash out your earnings.
          </p>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default ConnectAccountStatus;
