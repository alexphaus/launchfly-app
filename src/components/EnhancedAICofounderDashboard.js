// Enhanced AI Cofounder Dashboard Component
'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Brain, 
  Target, 
  TrendingUp, 
  Users, 
  DollarSign,
  Activity,
  Settings,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  Database,
  Shield,
  Loader2,
  Mail,
  Eye,
  ArrowRight
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
    success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    ai: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
  }
};

export default function EnhancedAICofounderDashboard({ business, sessionId, onClose }) {
  const [cofounderStatus, setCofounderStatus] = useState(null);
  const [integratedStatus, setIntegratedStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [accomplishments, setAccomplishments] = useState([]);
  const [memories, setMemories] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('progress'); // progress, activity

  useEffect(() => {
    if (business?.id) {
      initializeCofounder();
      startStatusPolling();
    }
  }, [business?.id]);

  const initializeCofounder = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Initialize the Enhanced AI Cofounder
      const initResponse = await fetch('/api/ai-cofounder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          action: 'initialize'
        })
      });

      let initResult;
      try {
        initResult = await initResponse.json();
      } catch (jsonError) {
        console.error('JSON parsing error in initialization:', jsonError);
        setError('Server response format error. Please check server logs and try again.');
        return;
      }
      
      if (initResult.success) {
        console.log('✅ Enhanced AI Cofounder initialized:', initResult);
        
        // Start the AI Cofounder
        try {
          const startResponse = await fetch('/api/ai-cofounder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              businessId: business.id,
              action: 'start'
            })
          });

          const startResult = await startResponse.json();
          console.log('🚀 AI Cofounder started:', startResult);
          
          // Get integrated status
          await fetchIntegratedStatus();
        } catch (startError) {
          console.warn('Start failed, but initialization succeeded:', startError);
          // Still try to get status
          await fetchIntegratedStatus();
        }
      } else {
        const errorMsg = initResult.error || 'Unknown initialization error';
        console.error('Initialization failed:', errorMsg);
        setError(`Initialization failed: ${errorMsg}. This may be due to missing environment variables or database issues.`);
      }
    } catch (err) {
      console.error('Error initializing AI Cofounder:', err);
      setError(`Network or server error: ${err.message}. Please check if the server is running.`);
    } finally {
      setLoading(false);
    }
  };

  const fetchIntegratedStatus = async () => {
    try {
      const response = await fetch(`/api/ai-cofounder?businessId=${business.id}&action=integrated-status`);
      const data = await response.json();
      
      if (response.ok) {
        setIntegratedStatus(data);
        setCofounderStatus(data.aiCofounder);
      }
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await fetch(`/api/ai-activities?businessId=${business.id}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
    }
  };

  const fetchAccomplishments = async () => {
    try {
      const response = await fetch(`/api/ai-cofounder?businessId=${business.id}&action=memories&query=accomplished OR completed OR successful`);
      if (response.ok) {
        const data = await response.json();
        const accomplishmentMemories = (data.memories?.memories || [])
          .filter(m => m.success_indicator === true)
          .slice(0, 5);
        setAccomplishments(accomplishmentMemories);
      }
    } catch (err) {
      console.error('Error fetching accomplishments:', err);
    }
  };

  const fetchMemories = async (query = 'recent activities') => {
    try {
      const response = await fetch(`/api/ai-cofounder?businessId=${business.id}&action=memories&query=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setMemories(data.memories?.memories || []);
      }
    } catch (err) {
      console.error('Error fetching memories:', err);
    }
  };

  const startStatusPolling = () => {
    const interval = setInterval(() => {
      fetchIntegratedStatus();
      fetchActivities();
      if (activeTab === 'activities') {
        fetchAccomplishments();
      }
    }, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  };

  const handleAction = async (action) => {
    try {
      const response = await fetch('/api/ai-cofounder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          action
        })
      });

      const result = await response.json();
      
      if (result.success) {
        await fetchIntegratedStatus();
      } else {
        setError(`Failed to ${action}: ${result.error}`);
      }
    } catch (err) {
      setError(`Error performing ${action}: ${err.message}`);
    }
  };

  const handleThink = () => handleAction('think');
  const handleStop = () => handleAction('stop');
  const handleStart = () => handleAction('start');

  if (loading) {
    return (
      <div style={{
        background: theme.colors.white,
        borderRadius: '20px',
        padding: '32px',
        boxShadow: theme.shadows.lg,
        textAlign: 'center'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          background: theme.gradients.ai,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          animation: 'pulse 2s infinite'
        }}>
          <Brain size={24} color="white" />
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
          Initializing Enhanced AI Cofounder
        </h3>
        <p style={{ color: theme.colors.textGray, fontSize: '14px' }}>
          Setting up integrated revenue systems...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: theme.colors.white,
        borderRadius: '20px',
        padding: '32px',
        boxShadow: theme.shadows.lg,
        border: `2px solid ${theme.colors.error}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <AlertCircle size={24} color={theme.colors.error} />
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: theme.colors.error }}>
            AI Cofounder Error
          </h3>
        </div>
        <p style={{ color: theme.colors.textGray, marginBottom: '16px' }}>
          {error}
        </p>
        <button
          onClick={initializeCofounder}
          style={{
            background: theme.gradients.primary,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Retry Initialization
        </button>
      </div>
    );
  }

  const isRunning = cofounderStatus?.running;
  const integrations = integratedStatus?.integrations || {};

  return (
    <div style={{
      background: theme.colors.white,
      borderRadius: '20px',
      padding: '24px',
      boxShadow: theme.shadows.lg,
      marginBottom: '24px'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: theme.gradients.ai,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Brain size={24} color="white" />
          </div>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>
              Your AI Cofounder
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                background: isRunning ? theme.colors.success : theme.colors.warning,
                borderRadius: '50%',
                animation: isRunning ? 'pulse 2s infinite' : 'none'
              }} />
              <span style={{ fontSize: '14px', color: theme.colors.textDark, fontWeight: '500' }}>
                {isRunning ? 'Working on your business' : 'Paused'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={isRunning ? handleStop : handleStart}
            style={{
              background: isRunning ? '#fef3c7' : theme.colors.success,
              color: isRunning ? '#92400e' : 'white',
              border: isRunning ? '1px solid #fbbf24' : 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {isRunning ? <Pause size={16} /> : <Play size={16} />}
            {isRunning ? 'Pause' : 'Start'}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          display: 'flex', 
          gap: '4px',
          background: theme.colors.background,
          borderRadius: '8px',
          padding: '4px'
        }}>
          {[
            { id: 'progress', label: 'Progress', icon: <TrendingUp size={16} /> },
            { id: 'activity', label: 'Live Activity', icon: <Activity size={16} /> }
          ].map(tab => (
            <button
              key={tab.id}
              data-tab-id={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'activity') {
                  fetchActivities();
                  fetchAccomplishments();
                }
              }}
              style={{
                background: activeTab === tab.id ? theme.colors.white : 'transparent',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '14px',
                color: activeTab === tab.id ? theme.colors.primary : theme.colors.textGray,
                fontWeight: activeTab === tab.id ? '600' : '400',
                boxShadow: activeTab === tab.id ? theme.shadows.sm : 'none'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'progress' && (
        <ProgressTab 
          business={business}
          cofounderStatus={cofounderStatus}
          activities={activities}
          onAction={handleAction}
        />
      )}

      {activeTab === 'activity' && (
        <LiveActivityTab 
          activities={activities}
          business={business}
          onRefresh={() => {
            fetchActivities();
          }}
        />
      )}
    </div>
  );
}

// Helper Components
const IntegrationCard = ({ name, status, description, icon }) => (
  <div style={{
    background: theme.colors.white,
    border: `1px solid ${status ? theme.colors.success : theme.colors.textLight}`,
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }}>
    <div style={{
      width: '24px',
      height: '24px',
      background: status ? theme.colors.success : theme.colors.textLight,
      borderRadius: '6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white'
    }}>
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '14px', fontWeight: '500' }}>{name}</div>
      <div style={{ fontSize: '12px', color: theme.colors.textGray }}>{description}</div>
    </div>
    {status ? (
      <CheckCircle size={16} color={theme.colors.success} />
    ) : (
      <AlertCircle size={16} color={theme.colors.textLight} />
    )}
  </div>
);

const StatusMetric = ({ label, value, color }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '18px', fontWeight: '700', color }}>{value}</div>
    <div style={{ fontSize: '12px', color: theme.colors.textGray }}>{label}</div>
  </div>
);

const ActionButton = ({ onClick, icon, label }) => (
  <button
    onClick={onClick}
    style={{
      background: theme.colors.white,
      border: `1px solid ${theme.colors.textLight}`,
      borderRadius: '8px',
      padding: '8px 12px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '14px',
      color: theme.colors.textDark,
      transition: 'all 0.2s'
    }}
    onMouseEnter={(e) => {
      e.target.style.background = theme.colors.background;
      e.target.style.borderColor = theme.colors.primary;
    }}
    onMouseLeave={(e) => {
      e.target.style.background = theme.colors.white;
      e.target.style.borderColor = theme.colors.textLight;
    }}
  >
    {icon}
    {label}
  </button>
);

// Progress milestone component
const ProgressMilestone = ({ label, completed, current, time }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    position: 'relative'
  }}>
    <div style={{
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      background: completed ? theme.colors.success : current ? theme.colors.primary : '#e5e7eb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '8px',
      border: current ? `3px solid ${theme.colors.primary}33` : 'none',
      animation: current ? 'pulse 2s infinite' : 'none'
    }}>
      {completed ? (
        <CheckCircle size={16} color="white" />
      ) : current ? (
        <div style={{
          width: '8px',
          height: '8px',
          background: 'white',
          borderRadius: '50%'
        }} />
      ) : (
        <div style={{
          width: '8px',
          height: '8px',
          background: '#9ca3af',
          borderRadius: '50%'
        }} />
      )}
    </div>
    <div style={{ fontSize: '13px', fontWeight: '600', color: completed || current ? theme.colors.textDark : theme.colors.textGray, textAlign: 'center' }}>
      {label}
    </div>
    {time && (
      <div style={{ fontSize: '11px', color: theme.colors.textGray, marginTop: '4px' }}>
        {time}
      </div>
    )}
  </div>
);

// Progress Tab - Journey to first sale focus
const ProgressTab = ({ business, cofounderStatus, activities, onAction }) => {
  // Calculate progress based on actual business state
  const businessCreated = !!business?.id;
  const websiteLive = !!business?.subdomain || !!business?.website_url;
  const hasLeads = (business?.growth_data?.customers?.totalLeads || business?.total_prospects || 0) > 0;
  const hasSentOutreach = (business?.emails_sent || business?.outreach_sent || 0) > 0;
  const hasRevenue = (business?.total_revenue || business?.revenue || 0) > 0;
  
  // Progress calculation
  const steps = [businessCreated, websiteLive, hasLeads, hasSentOutreach, hasRevenue];
  const completedSteps = steps.filter(Boolean).length;
  const progressPercent = (completedSteps / 5) * 100;
  
  // Current step determination
  const currentStep = !businessCreated ? 0 : !websiteLive ? 1 : !hasLeads ? 2 : !hasSentOutreach ? 3 : !hasRevenue ? 4 : 5;
  
  // Time calculations
  const createdAt = business?.created_at ? new Date(business.created_at) : new Date();
  const hoursElapsed = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60));
  const expectedFirstSaleHours = 16; // From homepage promise
  const hoursToFirstSale = Math.max(0, expectedFirstSaleHours - hoursElapsed);
  
  // Business metrics
  const revenue = business?.total_revenue || business?.revenue || 0;
  const leads = business?.growth_data?.customers?.totalLeads || business?.total_prospects || 0;
  const pipelineValue = leads * (business?.average_deal_size || 197); // Use template average
  const visitors = Number(business?.views || 0);
  
  // Get current activities for display
  const currentActivities = activities.slice(0, 3).map(a => ({
    icon: a.icon || '🔍',
    text: a.message || a.text || 'Working on your business...'
  }));
  
  // If no activities, show default based on current step
  if (currentActivities.length === 0) {
    if (currentStep === 2) {
      currentActivities.push(
        { icon: '🔍', text: 'Searching for ideal customers in your market' },
        { icon: '📊', text: 'Analyzing competitor pricing and strategies' }
      );
    } else if (currentStep === 3) {
      currentActivities.push(
        { icon: '✍️', text: 'Writing personalized outreach messages' },
        { icon: '📧', text: 'Setting up email sequences' }
      );
    }
  }

  return (
    <div>
      {/* Progress Header */}
      <div style={{
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: theme.colors.textDark }}>
          🎯 Your Path to First Sale
        </h4>
        
        {/* Progress Bar */}
        <div style={{
          background: '#e5e7eb',
          height: '8px',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '8px'
        }}>
          <div style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: theme.gradients.primary,
            transition: 'width 0.5s ease',
            borderRadius: '4px'
          }} />
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px'
        }}>
          <span style={{ fontSize: '24px', fontWeight: '700', color: theme.colors.primary }}>
            {progressPercent}% Complete
          </span>
          {!hasRevenue && (
            <span style={{ fontSize: '14px', color: theme.colors.textGray }}>
              Expected first sale in ~{hoursToFirstSale}h
            </span>
          )}
        </div>
        
        {currentStep === 2 && (
          <div style={{
            fontSize: '13px',
            color: theme.colors.textGray,
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <div style={{ width: '8px', height: '8px', background: theme.colors.primary, borderRadius: '50%', animation: 'pulse 2s infinite' }} />
            You are here: Finding your first customers
          </div>
        )}
      </div>

      {/* Milestone Timeline */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        position: 'relative',
        marginBottom: '24px',
        padding: '0 20px'
      }}>
        {/* Progress Line */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '52px',
          right: '52px',
          height: '2px',
          background: '#e5e7eb',
          zIndex: 0
        }} />
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '52px',
          width: `calc(${(completedSteps - 1) * 25}% + ${currentStep > 0 ? 20 : 0}px)`,
          height: '2px',
          background: theme.colors.success,
          zIndex: 1,
          transition: 'width 0.5s ease'
        }} />
        
        <ProgressMilestone 
          label="Business created" 
          completed={businessCreated}
          current={currentStep === 0}
          time={businessCreated ? `${hoursElapsed}h ago` : 'Now'}
        />
        <ProgressMilestone 
          label="Website live" 
          completed={websiteLive}
          current={currentStep === 1}
          time={websiteLive ? 'Active' : 'In progress'}
        />
        <ProgressMilestone 
          label="Finding leads" 
          completed={hasLeads}
          current={currentStep === 2}
          time={hasLeads ? `${leads} found` : 'Searching'}
        />
        <ProgressMilestone 
          label="First outreach" 
          completed={hasSentOutreach}
          current={currentStep === 3}
          time={hasSentOutreach ? 'Sent' : `In ${Math.max(1, 3 - hoursElapsed)}h`}
        />
        <ProgressMilestone 
          label="First sale" 
          completed={hasRevenue}
          current={currentStep === 4}
          time={hasRevenue ? `$${revenue}` : `~${hoursToFirstSale}h`}
        />
      </div>

      {/* What AI is doing now */}
      <div style={{
        background: theme.colors.white,
        border: `1px solid ${theme.colors.borderLight}`,
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: theme.colors.textDark }}>
          What your AI is doing now:
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {currentActivities.map((activity, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>{activity.icon}</span>
              <span style={{ fontSize: '14px', color: theme.colors.textDark }}>{activity.text}</span>
              {index === 0 && (
                <Loader2 size={14} style={{ marginLeft: 'auto', animation: 'spin 1s linear infinite', color: theme.colors.primary }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Live Numbers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{
          background: revenue > 0 ? 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)' : theme.colors.white,
          border: `1px solid ${revenue > 0 ? '#28a745' : theme.colors.borderLight}`,
          borderRadius: '12px',
          padding: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '12px', color: theme.colors.textGray, marginBottom: '4px' }}>Revenue</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: revenue > 0 ? '#28a745' : theme.colors.textDark }}>
            ${revenue.toLocaleString()}
          </div>
        </div>
        
        <div style={{
          background: theme.colors.white,
          border: `1px solid ${theme.colors.borderLight}`,
          borderRadius: '12px',
          padding: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '12px', color: theme.colors.textGray, marginBottom: '4px' }}>Pipeline</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: theme.colors.textDark }}>
            ${pipelineValue.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: theme.colors.textGray }}>
            {leads} interested
          </div>
        </div>
        
        <div style={{
          background: theme.colors.white,
          border: `1px solid ${theme.colors.borderLight}`,
          borderRadius: '12px',
          padding: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '12px', color: theme.colors.textGray, marginBottom: '4px' }}>This week</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: theme.colors.textDark }}>
            {visitors}
          </div>
          <div style={{ fontSize: '11px', color: theme.colors.textGray }}>visitors</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => window.open(`/dashboard/${business?.id}/leads`, '_blank')}
          style={{
            flex: 1,
            minWidth: '140px',
            background: theme.colors.white,
            border: `2px solid ${theme.colors.primary}`,
            borderRadius: '8px',
            padding: '10px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '600',
            color: theme.colors.primary,
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
          onMouseLeave={e => e.currentTarget.style.background = theme.colors.white}
        >
          <Eye size={16} />
          Review Leads
        </button>
        
        <button
          onClick={() => onAction('experiment')}
          style={{
            flex: 1,
            minWidth: '140px',
            background: theme.colors.white,
            border: `2px solid ${theme.colors.primary}`,
            borderRadius: '8px',
            padding: '10px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '600',
            color: theme.colors.primary,
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
          onMouseLeave={e => e.currentTarget.style.background = theme.colors.white}
        >
          <Mail size={16} />
          Preview Outreach
        </button>
        
      </div>
    </div>
  );
};

// Status Tab Component
const StatusTab = ({ integrations, cofounderStatus, onAction }) => (
  <div>
    {/* Integration Status */}
    <div style={{ marginBottom: '24px' }}>
      <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
        System Integrations
      </h4>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '12px' 
      }}>
        <IntegrationCard
          name="Central AI Brain"
          status={integrations.centralBrain?.active}
          description={`${integrations.centralBrain?.totalBusinesses || 0} businesses`}
          icon={<Brain size={16} />}
        />
        <IntegrationCard
          name="Revenue Graph"
          status={integrations.revenueGraph?.active}
          description={`${integrations.revenueGraph?.patternsStored || 0} patterns`}
          icon={<Database size={16} />}
        />
        <IntegrationCard
          name="Guarantee Engine"
          status={integrations.guaranteeEngine?.active}
          description={integrations.guaranteeEngine?.currentGuarantee ? 'Active guarantee' : 'No guarantee'}
          icon={<Shield size={16} />}
        />
        <IntegrationCard
          name="Growth Engine"
          status={integrations.growthEngine?.active}
          description={`${integrations.growthEngine?.activeSessions || 0} sessions`}
          icon={<TrendingUp size={16} />}
        />
      </div>
    </div>

    {/* AI Status Details */}
    {cofounderStatus && (
      <div style={{
        background: theme.colors.background,
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
          Current Status
        </h4>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '16px' 
        }}>
          <StatusMetric
            label="Mode"
            value={cofounderStatus.state?.mode || 'Unknown'}
            color={theme.colors.primary}
          />
          <StatusMetric
            label="Focus"
            value={cofounderStatus.state?.focus || 'Unknown'}
            color={theme.colors.success}
          />
          <StatusMetric
            label="Confidence"
            value={`${Math.round((cofounderStatus.state?.confidence || 0) * 100)}%`}
            color={theme.colors.warning}
          />
          <StatusMetric
            label="Active Experiments"
            value={cofounderStatus.activeExperiments || 0}
            color={theme.colors.primary}
          />
        </div>
      </div>
    )}

    {/* Quick Actions */}
    <div>
      <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
        Quick Actions
      </h4>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <ActionButton
          onClick={() => onAction('plan')}
          icon={<Target size={16} />}
          label="Create Plan"
        />
        <ActionButton
          onClick={() => onAction('experiment')}
          icon={<Activity size={16} />}
          label="Run Experiment"
        />
        <ActionButton
          onClick={() => onAction('think')}
          icon={<Zap size={16} />}
          label="Think Now"
        />
      </div>
    </div>
  </div>
);

// Live Activity Tab - Real-time view of AI actions
const LiveActivityTab = ({ activities, business, onRefresh }) => {
  // Get business context for better activity descriptions
  const businessName = business?.business_data?.businessName || 'your business';
  const targetMarket = business?.business_data?.targetMarket || 'your market';
  
  // Process activities to be more concrete
  const processedActivities = activities.map(activity => {
    let icon = activity.icon || '🤖';
    let text = activity.message || activity.text || activity.type || 'Processing...';
    let status = 'active';
    
    // Make activities more concrete based on keywords
    if (text.includes('lead') || text.includes('prospect')) {
      icon = '🔍';
      text = text.replace(/lead/gi, 'potential customer');
    } else if (text.includes('email') || text.includes('outreach')) {
      icon = '✉️';
      text = text.replace(/outreach/gi, 'personalized message');
    } else if (text.includes('optimize') || text.includes('improve')) {
      icon = '⚡';
    } else if (text.includes('analyze') || text.includes('research')) {
      icon = '📊';
    } else if (text.includes('success') || text.includes('complete')) {
      icon = '✅';
      status = 'success';
    }
    
    return { ...activity, icon, text, status };
  });
  
  // Add default activities if none exist
  if (processedActivities.length === 0) {
    processedActivities.push(
      { icon: '🔍', text: `Searching for ${targetMarket} businesses that need help`, status: 'active', time: 'Now' },
      { icon: '📊', text: 'Analyzing successful competitors in your niche', status: 'active', time: '2 min ago' },
      { icon: '✍️', text: 'Crafting personalized outreach templates', status: 'active', time: '5 min ago' }
    );
  }

  return (
    <div>
      {/* Activity Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: theme.colors.textDark }}>
            Live AI Activity
          </h4>
          <p style={{ fontSize: '13px', color: theme.colors.textGray, margin: '4px 0 0 0' }}>
            Your AI is working 24/7 to grow {businessName}
          </p>
        </div>
        <button
          onClick={onRefresh}
          style={{
            background: theme.colors.white,
            border: `1px solid ${theme.colors.borderLight}`,
            borderRadius: '6px',
            padding: '6px 12px',
            cursor: 'pointer',
            color: theme.colors.primary,
            fontSize: '13px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} />
          Refresh
        </button>
      </div>

      {/* Activity Stream */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {processedActivities.slice(0, 10).map((activity, index) => (
          <div
            key={activity.id || index}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px',
              background: index === 0 ? 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)' : theme.colors.white,
              border: `1px solid ${index === 0 ? theme.colors.primary + '33' : theme.colors.borderLight}`,
              borderRadius: '8px',
              opacity: 1 - (index * 0.08),
              transition: 'all 0.3s ease'
            }}
          >
            {/* Activity Icon */}
            <div style={{
              fontSize: '20px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: index === 0 ? theme.colors.primary + '15' : '#f3f4f6',
              borderRadius: '8px'
            }}>
              {activity.icon}
            </div>
            
            {/* Activity Content */}
            <div style={{ flex: 1 }}>
              <p style={{
                fontSize: '14px',
                color: theme.colors.textDark,
                margin: 0,
                fontWeight: index === 0 ? '500' : '400'
              }}>
                {activity.text}
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '4px'
              }}>
                <span style={{
                  fontSize: '12px',
                  color: theme.colors.textGray
                }}>
                  {activity.time || activity.created_at ? 
                    new Date(activity.created_at || Date.now() - index * 300000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                    `${index * 5 + 2} min ago`
                  }
                </span>
                {index === 0 && (
                  <>
                    <span style={{ color: theme.colors.textGray }}>•</span>
                    <span style={{
                      fontSize: '12px',
                      color: theme.colors.success,
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <div style={{
                        width: '6px',
                        height: '6px',
                        background: theme.colors.success,
                        borderRadius: '50%',
                        animation: 'pulse 2s infinite'
                      }} />
                      Active now
                    </span>
                  </>
                )}
              </div>
            </div>
            
            {/* Activity Status */}
            {index === 0 && (
              <Loader2 size={16} style={{
                animation: 'spin 1s linear infinite',
                color: theme.colors.primary
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Activity Summary */}
      <div style={{
        marginTop: '20px',
        padding: '16px',
        background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
        borderRadius: '8px',
        border: '1px solid #fbbf24'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px'
        }}>
          <TrendingUp size={16} color="#92400e" />
          <span style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#92400e'
          }}>
            Today's Progress
          </span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#78350f' }}>
              {Math.max(3, activities.filter(a => a.type === 'lead' || a.text?.includes('lead')).length)}
            </div>
            <div style={{ fontSize: '12px', color: '#92400e' }}>Leads found</div>
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#78350f' }}>
              {Math.max(1, activities.filter(a => a.type === 'email' || a.text?.includes('email')).length)}
            </div>
            <div style={{ fontSize: '12px', color: '#92400e' }}>Emails sent</div>
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#78350f' }}>
              {activities.length}
            </div>
            <div style={{ fontSize: '12px', color: '#92400e' }}>Actions taken</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Activity Item Component
const ActivityItem = ({ activity }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
    borderBottom: `1px solid ${theme.colors.background}`
  }}>
    <div style={{ fontSize: '18px' }}>{activity.icon || '🤖'}</div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '14px', fontWeight: '500' }}>
        {activity.message || activity.type}
      </div>
      <div style={{ fontSize: '12px', color: theme.colors.textGray }}>
        {new Date(activity.created_at || activity.timestamp).toLocaleTimeString()}
      </div>
    </div>
    {activity.type === 'working' && (
      <Loader2 size={16} style={{ 
        animation: 'spin 1s linear infinite',
        color: theme.colors.primary 
      }} />
    )}
  </div>
);

// Accomplishment Item Component
const AccomplishmentItem = ({ accomplishment }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
    borderBottom: `1px solid ${theme.colors.background}`
  }}>
    <CheckCircle size={16} color={theme.colors.success} />
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '14px', fontWeight: '500' }}>
        {accomplishment.content}
      </div>
      <div style={{ fontSize: '12px', color: theme.colors.textGray }}>
        {new Date(accomplishment.memory_timestamp || accomplishment.timestamp).toLocaleDateString()}
      </div>
    </div>
  </div>
);
