// src/components/BusinessHealthDashboard.js
import React from 'react';
import { TrendingUp, Zap, Target, CheckCircle, AlertTriangle } from 'lucide-react';

const theme = {
  colors: {
    primary: '#007BFF',
    success: '#28a745',
    warning: '#f59e0b',
    error: '#dc3545',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    borderLight: '#E4E7EB',
  },
  gradients: {
    primary: 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)',
    success: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
    warning: 'linear-gradient(135deg, #f59e0b 0%, #f7b733 100%)',
    error: 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)',
  },
  shadows: {
    lg: '0 12px 20px rgba(26, 43, 72, 0.1)',
  },
};

const HealthScoreGauge = ({ score }) => {
  const getScoreColor = () => {
    if (score >= 75) return theme.colors.success;
    if (score >= 40) return theme.colors.warning;
    return theme.colors.error;
  };

  const circumference = 2 * Math.PI * 50;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: '120px', height: '120px' }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke={theme.colors.borderLight}
          strokeWidth="12"
        />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke={getScoreColor()}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
      }}>
        <span style={{ fontSize: '28px', fontWeight: '800', color: getScoreColor() }}>{score}</span>
        <p style={{ fontSize: '12px', color: theme.colors.textGray, margin: 0 }}>Health Score</p>
      </div>
    </div>
  );
};

const BusinessHealthDashboard = ({ business, session, setupStatus }) => {
  const calculateHealthScore = () => {
    if (!business || !session) return 0;

    let score = 0;
    const weights = {
      setup: 15,
      website: 15,
      traffic: 20,
      leads: 25,
      revenue: 25,
    };

    // 1. Setup Complete (Bank & Phone)
    if (setupStatus?.bank) score += weights.setup / 2;
    if (setupStatus?.phone) score += weights.setup / 2;

    // 2. Website Live
    if (session.stage === 'complete' && (business.subdomain || business.website_url)) {
      score += weights.website;
    }

    // 3. Traffic (visitors)
    const visitors = business.views || 0;
    const trafficScore = Math.min((visitors / 100) * 100, 100); // Capped at 100 visitors for full score
    score += (trafficScore / 100) * weights.traffic;

    // 4. Leads (prospects)
    const leads = business.total_prospects || 0;
    const leadsScore = Math.min((leads / 10) * 100, 100); // Capped at 10 leads for full score
    score += (leadsScore / 100) * weights.leads;

    // 5. Revenue
    const revenue = business.total_revenue || business.revenue || 0;
    const revenueScore = Math.min((revenue / 1000) * 100, 100); // Capped at $1000 for full score
    score += (revenueScore / 100) * weights.revenue;

    return Math.round(score);
  };

  const getRecommendations = (score) => {
    const recommendations = [];

    if (!setupStatus?.bank) {
      recommendations.push({
        icon: <Zap size={18} />,
        text: 'Connect your bank account to get paid instantly.',
        priority: 'high',
      });
    }

    if (session.stage !== 'complete') {
        recommendations.push({
          icon: <Zap size={18} />,
          text: 'Your website is being built by the AI. Hold tight!',
          priority: 'high',
        });
      }

    const visitors = business?.views || 0;
    if (session.stage === 'complete' && visitors < 50) {
      recommendations.push({
        icon: <TrendingUp size={18} />,
        text: 'Ask the AI cofounder to brainstorm strategies for driving more traffic.',
        priority: 'medium',
      });
    }

    const leads = business?.total_prospects || 0;
    if (visitors > 50 && leads < 5) {
      recommendations.push({
        icon: <Target size={18} />,
        text: 'Improve your website conversion. Ask the AI to analyze your landing page.',
        priority: 'medium',
      });
    }
    
    const revenue = business?.total_revenue || business?.revenue || 0;
    if (leads > 5 && revenue < 100) {
      recommendations.push({
        icon: <CheckCircle size={18} />,
        text: 'You have leads! Ask the AI for help converting them into paying customers.',
        priority: 'high',
      });
    }

    if (score > 75) {
        recommendations.push({
            icon: <CheckCircle size={18} />,
            text: 'Your business is healthy! Focus on scaling by asking the AI for advanced growth strategies.',
            priority: 'low',
        });
    }

    return recommendations.slice(0, 2);
  };

  const healthScore = calculateHealthScore();
  const recommendations = getRecommendations(healthScore);

  const getHealthStatus = () => {
    if (healthScore >= 75) return { text: 'Excellent', style: { color: theme.colors.success } };
    if (healthScore >= 40) return { text: 'Good', style: { color: theme.colors.warning } };
    return { text: 'Needs Attention', style: { color: theme.colors.error } };
  };

  const healthStatus = getHealthStatus();

  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: theme.shadows.lg,
      marginBottom: '24px',
      border: `2px solid ${getScoreColor(healthScore)}`,
      transition: 'border-color 0.5s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <HealthScoreGauge score={healthScore} />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: theme.colors.textDark, margin: '0 0 4px 0' }}>
            Business Health: <span style={healthStatus.style}>{healthStatus.text}</span>
          </h2>
          <p style={{ fontSize: '15px', color: theme.colors.textGray, margin: 0 }}>
            Your AI-powered guide to growth and success.
          </p>
        </div>
      </div>
      <div style={{ marginTop: '20px', borderTop: `1px solid ${theme.colors.borderLight}`, paddingTop: '20px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '16px' }}>
          AI Recommendations
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {recommendations.length > 0 ? (
            recommendations.map((rec, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: theme.colors.bgLight,
                padding: '12px',
                borderRadius: '12px',
              }}>
                <div style={{ color: rec.priority === 'high' ? theme.colors.primary : theme.colors.textGray }}>
                  {rec.icon}
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: theme.colors.textDark }}>{rec.text}</p>
              </div>
            ))
          ) : (
            <p style={{ fontSize: '14px', color: theme.colors.textGray }}>No specific recommendations at this time. Keep up the good work!</p>
          )}
        </div>
      </div>
    </div>
  );
};

function getScoreColor(score) {
    if (score >= 75) return theme.colors.success;
    if (score >= 40) return theme.colors.warning;
    return theme.colors.error;
}


export default BusinessHealthDashboard;
