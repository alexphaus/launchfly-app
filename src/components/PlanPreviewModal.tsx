'use client';

import { useState } from 'react';

interface PlanPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedPlan: 'professional' | 'scale';
  businessName: string;
  subdomain: string;
}

export default function PlanPreviewModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  selectedPlan, 
  businessName,
  subdomain 
}: PlanPreviewModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isOpen) return null;

  const planDetails = {
    professional: {
      name: 'Professional',
      price: '$497',
      period: 'lifetime',
      revenueShare: '10%',
      features: [
        'Keep 90% of all profits',
        'Access to ALL premium templates',
        '100-200 customers included',
        'Priority customer allocation',
        'Advanced AI optimization',
        'Priority support',
        'Custom business creation',
        'Unlimited business launches'
      ],
      color: '#667eea'
    },
    scale: {
      name: 'Scale',
      price: '$1,997',
      period: 'one-time',
      revenueShare: '5%',
      features: [
        'Keep 95% of all profits',
        'Launch up to 5 businesses',
        '200+ customers per business',
        'White-label options',
        '1-on-1 coaching sessions',
        'Custom integrations',
        'Advanced analytics',
        'Dedicated account manager'
      ],
      color: '#10b981'
    }
  };

  const plan = planDetails[selectedPlan];

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          position: 'relative'
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0.5rem',
              borderRadius: '50%',
              width: '2rem',
              height: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
          <h2 style={{
            margin: 0,
            color: '#1a1a1a',
            fontSize: '1.5rem',
            fontWeight: '700'
          }}>
            Confirm Your Plan
          </h2>
          <p style={{
            margin: '0.5rem 0 0 0',
            color: '#6b7280',
            fontSize: '0.9rem'
          }}>
            Review what's included with your {plan.name} plan
          </p>
        </div>

        {/* Business Summary */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #f3f4f6' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1a1a1a', fontSize: '1.1rem' }}>
            Your Business
          </h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>Business Name:</span>
              <span style={{ fontWeight: '600' }}>{businessName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>Website:</span>
              <span style={{ fontWeight: '600' }}>{subdomain}.launchfly.com</span>
            </div>
          </div>
        </div>

        {/* Plan Details */}
        <div style={{ padding: '1.5rem' }}>
          <div style={{
            background: `linear-gradient(135deg, ${plan.color}15 0%, ${plan.color}05 100%)`,
            border: `1px solid ${plan.color}30`,
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h3 style={{ margin: 0, color: '#1a1a1a' }}>{plan.name} Plan</h3>
              <div style={{
                background: plan.color,
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}>
                {plan.price} {plan.period}
              </div>
            </div>
            
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.8)',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              <strong style={{ color: plan.color }}>
                Revenue Share: Only {plan.revenueShare} - You keep {selectedPlan === 'professional' ? '90%' : '95%'}!
              </strong>
            </div>

            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {plan.features.map((feature, index) => (
                <li key={index} style={{ marginBottom: '0.5rem', color: '#374151' }}>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Money Back Guarantee */}
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🔒</span>
              <strong style={{ color: '#15803d' }}>30-Day Money Back Guarantee</strong>
            </div>
            <p style={{ margin: '0.5rem 0 0 1.7rem', color: '#15803d', fontSize: '0.9rem' }}>
              If you don't make your first sale within 30 days, we'll refund your entire payment.
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.875rem 1.5rem',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                background: 'white',
                color: '#374151',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              style={{
                flex: 2,
                padding: '0.875rem 1.5rem',
                border: 'none',
                borderRadius: '8px',
                background: `linear-gradient(135deg, ${plan.color} 0%, ${plan.color}dd 100%)`,
                color: 'white',
                fontWeight: '600',
                cursor: isConfirming ? 'not-allowed' : 'pointer',
                opacity: isConfirming ? 0.7 : 1,
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {isConfirming ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid transparent',
                    borderTop: '2px solid currentColor',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  Processing...
                </>
              ) : (
                `Proceed to Payment - ${plan.price}`
              )}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
