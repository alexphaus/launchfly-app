// Enhanced AI Cofounder Dashboard Component
'use client';

import { useState, useEffect } from 'react';
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
  MessageCircle,
  Send
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
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('status'); // status, activities, chat

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

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatLoading(true);

    // Add user message to chat
    const newMessages = [...chatMessages, {
      id: Date.now(),
      type: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    }];
    setChatMessages(newMessages);

    try {
      // Get AI response based on business context and memories
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
              recentActivities: activities.slice(0, 3),
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
          content: result.response || 'I understand your question and will work on it.',
          timestamp: new Date().toISOString()
        }]);
      } else {
        setChatMessages(prev => [...prev, {
          id: Date.now() + 1,
          type: 'ai',
          content: 'I apologize, but I encountered an issue processing your request. Let me continue working on your business growth.',
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'ai',
        content: 'I had a technical issue, but I\'m still actively working on growing your business in the background.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setChatLoading(false);
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
              Enhanced AI Cofounder
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                background: isRunning ? theme.colors.success : theme.colors.warning,
                borderRadius: '50%',
                animation: isRunning ? 'pulse 2s infinite' : 'none'
              }} />
              <span style={{ fontSize: '14px', color: theme.colors.textGray }}>
                {isRunning ? 'Actively thinking and executing' : 'Paused'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleThink}
            style={{
              background: theme.gradients.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px'
            }}
          >
            <Zap size={16} />
            Think Now
          </button>
          
          <button
            onClick={isRunning ? handleStop : handleStart}
            style={{
              background: isRunning ? theme.colors.warning : theme.colors.success,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px'
            }}
          >
            {isRunning ? <Pause size={16} /> : <Play size={16} />}
            {isRunning ? 'Pause' : 'Resume'}
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
            { id: 'status', label: 'Status', icon: <Settings size={16} /> },
            { id: 'activities', label: 'Activities', icon: <Activity size={16} /> },
            { id: 'chat', label: 'Chat', icon: <Bot size={16} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'activities') {
                  fetchAccomplishments();
                  fetchMemories();
                } else if (tab.id === 'chat' && chatMessages.length === 0) {
                  setChatMessages([{
                    id: 1,
                    type: 'ai',
                    content: `Hello! I'm your AI Cofounder for ${business.business_data?.businessName || 'your business'}. I'm actively working on growing your business using proven strategies from our Revenue Graph. What would you like to know?`,
                    timestamp: new Date().toISOString()
                  }]);
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
      {activeTab === 'status' && (
        <StatusTab 
          integrations={integrations}
          cofounderStatus={cofounderStatus}
          onAction={handleAction}
        />
      )}

      {activeTab === 'activities' && (
        <ActivitiesTab 
          activities={activities}
          accomplishments={accomplishments}
          onRefresh={() => {
            fetchActivities();
            fetchAccomplishments();
          }}
        />
      )}

      {activeTab === 'chat' && (
        <ChatTab 
          messages={chatMessages}
          input={chatInput}
          loading={chatLoading}
          onInputChange={setChatInput}
          onSubmit={handleChatSubmit}
          business={business}
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

// Activities Tab Component
const ActivitiesTab = ({ activities, accomplishments, onRefresh }) => (
  <div>
    {/* Current Activities */}
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
          Currently Working On
        </h4>
        <button
          onClick={onRefresh}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: theme.colors.primary,
            fontSize: '14px'
          }}
        >
          Refresh
        </button>
      </div>
      
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {activities.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '20px',
            color: theme.colors.textGray,
            fontSize: '14px'
          }}>
            <Clock size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            <div>AI is thinking... Check back in a few minutes</div>
          </div>
        ) : (
          activities.map((activity, index) => (
            <ActivityItem key={index} activity={activity} />
          ))
        )}
      </div>
    </div>

    {/* Accomplishments */}
    <div>
      <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
        Recent Accomplishments
      </h4>
      
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {accomplishments.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '20px',
            color: theme.colors.textGray,
            fontSize: '14px'
          }}>
            <CheckCircle size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            <div>Accomplishments will appear here as AI achieves goals</div>
          </div>
        ) : (
          accomplishments.map((accomplishment, index) => (
            <AccomplishmentItem key={index} accomplishment={accomplishment} />
          ))
        )}
      </div>
    </div>
  </div>
);

// Chat Tab Component
const ChatTab = ({ messages, input, loading, onInputChange, onSubmit, business }) => (
  <div style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
    {/* Chat Messages */}
    <div style={{ 
      flex: 1, 
      overflowY: 'auto', 
      marginBottom: '16px',
      border: `1px solid ${theme.colors.textLight}`,
      borderRadius: '8px',
      padding: '12px'
    }}>
      {messages.map(message => (
        <ChatMessage key={message.id} message={message} />
      ))}
      
      {loading && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          padding: '8px',
          color: theme.colors.textGray
        }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span>AI is thinking...</span>
        </div>
      )}
    </div>

    {/* Chat Input */}
    <form onSubmit={onSubmit} style={{ display: 'flex', gap: '8px' }}>
      <input
        type="text"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder="Ask about your business strategy, revenue, or any questions..."
        style={{
          flex: 1,
          padding: '8px 12px',
          border: `1px solid ${theme.colors.textLight}`,
          borderRadius: '8px',
          fontSize: '14px',
          outline: 'none'
        }}
        onFocus={(e) => e.target.style.borderColor = theme.colors.primary}
        onBlur={(e) => e.target.style.borderColor = theme.colors.textLight}
      />
      <button
        type="submit"
        disabled={loading || !input.trim()}
        style={{
          background: theme.gradients.primary,
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 16px',
          cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
          opacity: loading || !input.trim() ? 0.6 : 1,
          fontSize: '14px'
        }}
      >
        Send
      </button>
    </form>
  </div>
);

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
