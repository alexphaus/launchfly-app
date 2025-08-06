// src/components/ConversionOptimizationCard.js
import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Target, Zap, TestTube, Trophy, RefreshCw } from 'lucide-react';

const ConversionOptimizationCard = ({ business, businessData }) => {
  const [optimizationData, setOptimizationData] = useState({
    activeExperiments: 0,
    totalVariants: 0,
    bestPerformer: null,
    averageImprovement: 0,
    totalConversions: 0,
    winningVariants: 0
  });

  useEffect(() => {
    if (!businessData) return;

    // Extract optimization data from business data
    const experiments = businessData.experiments || [];
    const activeExperiments = experiments.filter(exp => exp.status === 'active');
    const completedExperiments = experiments.filter(exp => exp.status === 'completed');
    
    // Calculate total variants
    const totalVariants = activeExperiments.reduce((sum, exp) => sum + (exp.variants?.length || 0), 0);
    
    // Get conversion metrics
    const conversionMetrics = businessData.conversionMetrics || {};
    const totalConversions = conversionMetrics.totalConversions || 0;
    
    // Find best performing variant
    let bestPerformer = null;
    let highestConversionRate = 0;
    
    Object.entries(conversionMetrics.conversionsByVariant || {}).forEach(([variantId, conversions]) => {
      // This is simplified - in production you'd calculate based on impressions
      if (conversions > highestConversionRate) {
        highestConversionRate = conversions;
        bestPerformer = variantId;
      }
    });
    
    // Calculate average improvement from completed experiments
    const improvements = completedExperiments
      .map(exp => exp.improvement || 0)
      .filter(imp => imp > 0);
    
    const averageImprovement = improvements.length > 0
      ? improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length
      : 0;
    
    setOptimizationData({
      activeExperiments: activeExperiments.length,
      totalVariants,
      bestPerformer,
      averageImprovement: Math.round(averageImprovement * 100),
      totalConversions,
      winningVariants: completedExperiments.length
    });
  }, [businessData]);

  const hasOptimization = optimizationData.activeExperiments > 0 || optimizationData.winningVariants > 0;

  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      padding: '24px',
      marginBottom: '16px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
      border: '1px solid #e5e7eb',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '200px',
        height: '200px',
        background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
        borderRadius: '50%',
        opacity: 0.05,
        transform: 'translate(50%, -50%)'
      }} />

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <TestTube size={24} color="white" />
        </div>
        <div>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#1a2b48',
            margin: 0
          }}>
            Conversion Optimization
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#5a6982',
            margin: '4px 0 0 0'
          }}>
            {hasOptimization ? 'AI-powered self-improvement active' : 'Optimization starting soon...'}
          </p>
        </div>
      </div>

      {hasOptimization ? (
        <>
          {/* Active Experiments */}
          {optimizationData.activeExperiments > 0 && (
            <div style={{
              background: '#f3f4f6',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <RefreshCw size={16} color="#6366f1" />
                <p style={{ fontSize: '14px', fontWeight: '600', color: '#4b5563', margin: 0 }}>
                  Active A/B Tests
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937', margin: 0 }}>
                    {optimizationData.activeExperiments}
                  </p>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0 0' }}>
                    Testing {optimizationData.totalVariants} variants
                  </p>
                </div>
                <div style={{
                  background: '#ddd6fe',
                  borderRadius: '8px',
                  padding: '8px 12px'
                }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#6d28d9', margin: 0 }}>
                    Learning...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            {/* Total Conversions */}
            <div style={{
              background: '#dcfce7',
              borderRadius: '12px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Target size={14} color="#16a34a" />
                <p style={{ fontSize: '13px', color: '#16a34a', fontWeight: '600', margin: 0 }}>
                  Conversions
                </p>
              </div>
              <p style={{ fontSize: '20px', fontWeight: '700', color: '#15803d', margin: 0 }}>
                {optimizationData.totalConversions}
              </p>
            </div>

            {/* Winning Variants */}
            <div style={{
              background: '#fef3c7',
              borderRadius: '12px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Trophy size={14} color="#d97706" />
                <p style={{ fontSize: '13px', color: '#d97706', fontWeight: '600', margin: 0 }}>
                  Winners Found
                </p>
              </div>
              <p style={{ fontSize: '20px', fontWeight: '700', color: '#92400e', margin: 0 }}>
                {optimizationData.winningVariants}
              </p>
            </div>
          </div>

          {/* Average Improvement */}
          {optimizationData.averageImprovement > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
              borderRadius: '12px',
              padding: '16px',
              color: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 4px 0', opacity: 0.9 }}>
                    Average Improvement
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp size={20} />
                    <p style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>
                      +{optimizationData.averageImprovement}%
                    </p>
                  </div>
                </div>
                <Zap size={32} style={{ opacity: 0.2 }} />
              </div>
            </div>
          )}
        </>
      ) : (
        /* Coming Soon State */
        <div style={{
          textAlign: 'center',
          padding: '40px 20px'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: '#f3f4f6',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <TestTube size={32} color="#9ca3af" />
          </div>
          <h4 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#4b5563',
            margin: '0 0 8px 0'
          }}>
            Optimization Engine Initializing
          </h4>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: 0,
            maxWidth: '300px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            Your landing page will start self-improving automatically once we gather initial visitor data
          </p>
        </div>
      )}

      {/* Info Footer */}
      <div style={{
        marginTop: '20px',
        paddingTop: '16px',
        borderTop: '1px solid #e5e7eb'
      }}>
        <p style={{
          fontSize: '12px',
          color: '#9ca3af',
          margin: 0,
          textAlign: 'center'
        }}>
          {hasOptimization 
            ? '🤖 AI analyzes performance every 30 minutes'
            : '🚀 First optimization cycle starts after 100 visitors'
          }
        </p>
      </div>
    </div>
  );
};

export default ConversionOptimizationCard;