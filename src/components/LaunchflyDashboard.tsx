import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ChevronRight, Globe, DollarSign, Users, Rocket, Check, Star, TrendingUp, Mail, Share2, CreditCard, Zap, ArrowRight, Sparkles, BarChart3, Clock, MessageSquare, Phone, X, AlertCircle, Activity, Target, Shield } from 'lucide-react';

const LaunchflyDashboard = ({ session, business, onPhoneCapture, onStepComplete }) => {
  // Use real data from props
  const stage = session?.stage || 'analyzing';
  const progress = session?.progress || 0;
  const existingCompletedSteps = session?.completed_steps || [];
  const userName = session?.userData?.name || business?.form_data?.name || 'there';
  
  // Local state
  const [showBusiness, setShowBusiness] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [completedSteps, setCompletedSteps] = useState(existingCompletedSteps);
  const [showPhoneCapture, setShowPhoneCapture] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(session?.phone_number || '');
  const [showAiCoach, setShowAiCoach] = useState(false);
  const [aiCoachMessage, setAiCoachMessage] = useState('');
  const [todayRevenue, setTodayRevenue] = useState(12492);
  const [particles, setParticles] = useState([]);

  // Use real business data from props or defaults
  const businessData = business?.business_data || {
    businessName: business?.name || "Generating Your Business...",
    tagline: "Your personalized business is being created...",
    domain: business?.subdomain ? `${business.subdomain}.com` : "yourbusiness.com",
    logo: "🚀",
    revenue: "$2,000-$5,000/month",
    products: [
      { name: "Loading...", price: "$---", description: "Product details coming soon" }
    ],
    targetCustomers: ["Your ideal customers are being identified..."],
    monthlyData: [
      { month: 'Month 1', revenue: 500 },
      { month: 'Month 2', revenue: 1200 },
      { month: 'Month 3', revenue: 2800 },
      { month: 'Month 4', revenue: 4200 },
      { month: 'Month 5', revenue: 5500 },
      { month: 'Month 6', revenue: 7200 }
    ]
  };

  // Generate particles
  useEffect(() => {
    const newParticles = [];
    for (let i = 0; i < 30; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 20 + 20,
        delay: Math.random() * 5
      });
    }
    setParticles(newParticles);
  }, []);

  // Show business when complete
  useEffect(() => {
    if (stage === 'complete' && business?.business_data) {
      setTimeout(() => setShowBusiness(true), 500);
    }
  }, [stage, business]);

  // Sync completed steps from props
  useEffect(() => {
    if (existingCompletedSteps.length > 0) {
      setCompletedSteps(existingCompletedSteps);
    }
  }, [existingCompletedSteps]);

  // Show phone capture at the right time
  useEffect(() => {
    if (stage === 'researching' && !phoneNumber && !session?.phone_number) {
      setShowPhoneCapture(true);
    }
  }, [stage, phoneNumber, session?.phone_number]);

  // Simulate live notifications
  useEffect(() => {
    if (showBusiness) {
      const interval = setInterval(() => {
        const newNotifications = [
          { id: Date.now(), text: `New visitor from ${['NYC', 'LA', 'Chicago', 'Miami'][Math.floor(Math.random() * 4)]}`, icon: '👀' },
          { id: Date.now(), text: `Someone viewed your ${businessData.products[0]?.name || 'product'}`, icon: '🎯' },
          { id: Date.now(), text: `AI optimized your pricing`, icon: '🤖' }
        ];
        
        setNotifications(prev => [newNotifications[Math.floor(Math.random() * 3)], ...prev].slice(0, 5));
      }, 8000);

      return () => clearInterval(interval);
    }
  }, [showBusiness, businessData]);

  // Update today's revenue
  useEffect(() => {
    const interval = setInterval(() => {
      setTodayRevenue(prev => prev + Math.floor(Math.random() * 100) + 50);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const completeStep = (stepId) => {
    const newSteps = [...completedSteps, stepId];
    setCompletedSteps(newSteps);
    
    if (onStepComplete) {
      onStepComplete(stepId);
    }
  };

  const handlePhoneSubmit = () => {
    if (phoneNumber && onPhoneCapture) {
      onPhoneCapture(phoneNumber);
      setShowPhoneCapture(false);
    }
  };

  const stageMessages = {
    analyzing: "🔍 Analyzing market opportunities...",
    researching: "🎯 Finding your perfect niche...",
    building: "🛠️ Building your money machine...",
    finalizing: "✨ Activating AI systems...",
    complete: "🎉 Your business is live!",
    error: "⚠️ Something went wrong. Please refresh."
  };

  // Custom chart theme
  const chartTheme = {
    stroke: '#9945FF',
    fill: 'url(#colorGradient)',
    grid: '#1A1A2E',
    text: '#B8B8D0'
  };

  return (
    <div className="neon-dashboard">
      {/* Particle Background */}
      <div className="particle-container">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="particle"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animationDuration: `${particle.duration}s`,
              animationDelay: `${particle.delay}s`
            }}
          />
        ))}
      </div>

      {/* Gradient Mesh Background */}
      <div className="gradient-mesh">
        <div className="mesh-circle mesh-1"></div>
        <div className="mesh-circle mesh-2"></div>
        <div className="mesh-circle mesh-3"></div>
      </div>

      {/* Header */}
      <header className="dashboard-header">
        <div className="header-container">
          <div className="logo-section">
            <div className="logo-icon">⚡</div>
            <span className="logo-text">Launchfly</span>
          </div>
          
          <div className="header-stats">
            <div className="stat-item">
              <span className="stat-icon">💰</span>
              <span className="stat-value">${todayRevenue.toLocaleString()}</span>
              <span className="stat-label">Today's Platform Revenue</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">🔥</span>
              <span className="stat-value">{completedSteps.length}/3</span>
              <span className="stat-label">Setup Progress</span>
            </div>
          </div>

          <div className="header-actions">
            <button className="notification-btn">
              <MessageSquare size={20} />
              {notifications.length > 0 && <span className="notification-dot"></span>}
            </button>
            <button className="upgrade-btn">
              <Sparkles size={16} />
              <span>Upgrade</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* AI Generation Animation */}
        {!showBusiness && stage !== 'error' && (
          <div className="generation-container">
            <div className="generation-content">
              <div className="ai-orb">
                <div className="orb-core"></div>
                <div className="orb-ring ring-1"></div>
                <div className="orb-ring ring-2"></div>
                <div className="orb-ring ring-3"></div>
              </div>
              
              <h2 className="generation-title">
                <span className="glitch" data-text="AI is Creating">AI is Creating</span><br />
                <span className="gradient-text glitch" data-text="Your Business">Your Business</span>
              </h2>
              
              <p className="generation-status">{stageMessages[stage]}</p>
              
              {/* Progress Bar */}
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="progress-glow"></div>
                  </div>
                </div>
                <span className="progress-text">{progress}% Complete</span>
              </div>

              {/* Stage Pills */}
              <div className="stage-pills">
                <div className={`stage-pill ${['analyzing'].includes(stage) ? 'active' : ''}`}>
                  <Activity size={14} />
                  <span>Analyzing</span>
                </div>
                <div className={`stage-pill ${['researching'].includes(stage) ? 'active' : ''}`}>
                  <Target size={14} />
                  <span>Researching</span>
                </div>
                <div className={`stage-pill ${['building', 'finalizing'].includes(stage) ? 'active' : ''}`}>
                  <Zap size={14} />
                  <span>Building</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {stage === 'error' && (
          <div className="error-container">
            <div className="error-content">
              <div className="error-icon">⚠️</div>
              <h2>Oops! Something went wrong</h2>
              <p>Don't worry, your progress is saved. Please refresh to continue.</p>
              <button onClick={() => window.location.reload()} className="retry-btn">
                <Zap size={16} />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}

        {/* Phone Capture Modal */}
        {showPhoneCapture && (
          <div className="modal-overlay">
            <div className="phone-modal">
              <button onClick={() => setShowPhoneCapture(false)} className="modal-close">
                <X size={20} />
              </button>
              
              <div className="modal-icon">📱</div>
              <h3>Get Instant Alerts</h3>
              <p>We'll text you the moment you get your first sale!</p>
              
              <div className="phone-input-group">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handlePhoneSubmit()}
                  placeholder="+1 (555) 123-4567"
                  className="phone-input"
                />
                <button onClick={handlePhoneSubmit} className="phone-submit">
                  <ArrowRight size={18} />
                </button>
              </div>
              
              <p className="phone-disclaimer">
                <Shield size={12} />
                We'll only text important updates. No spam.
              </p>
            </div>
          </div>
        )}

        {/* Business Dashboard */}
        {showBusiness && (
          <div className="business-dashboard">
            {/* Success Banner */}
            <div className="success-banner">
              <div className="banner-content">
                <div className="banner-icon">
                  <Check size={24} />
                </div>
                <div className="banner-text">
                  <h2>Your Money Machine is Live! 🎉</h2>
                  <p>Complete the steps below to activate automatic income</p>
                </div>
                <div className="banner-timer">
                  <Clock size={16} />
                  <span>Launch bonus expires in: 23:47:12</span>
                </div>
              </div>
            </div>

            {/* Main Grid */}
            <div className="dashboard-grid">
              {/* Revenue Overview */}
              <div className="dashboard-card revenue-card">
                <div className="card-header">
                  <h3>
                    <DollarSign size={20} />
                    Revenue Overview
                  </h3>
                  <span className="live-indicator">
                    <span className="live-dot"></span>
                    LIVE
                  </span>
                </div>
                
                <div className="revenue-display">
                  <div className="revenue-main">
                    <span className="revenue-label">Projected Monthly</span>
                    <div className="revenue-amount">
                      {businessData.revenue || businessData.monthlyRevenue}
                    </div>
                  </div>
                  
                  <div className="revenue-chart">
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={businessData.monthlyData}>
                        <defs>
                          <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#9945FF" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#9945FF" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                        <XAxis dataKey="month" stroke={chartTheme.text} />
                        <YAxis stroke={chartTheme.text} />
                        <Tooltip 
                          contentStyle={{ 
                            background: '#1E1E2E', 
                            border: '1px solid #9945FF',
                            borderRadius: '10px'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="revenue" 
                          stroke={chartTheme.stroke}
                          fillOpacity={1} 
                          fill={chartTheme.fill}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Your Business */}
              <div className="dashboard-card business-card">
                <div className="card-header">
                  <h3>
                    <Globe size={20} />
                    Your Business
                  </h3>
                  <a href={`https://${businessData.domain}`} target="_blank" className="view-site-btn">
                    View Site
                    <ArrowRight size={14} />
                  </a>
                </div>
                
                <div className="business-preview">
                  <div className="preview-header">
                    <span className="business-logo">{businessData.logo}</span>
                    <div className="business-info">
                      <h4>{businessData.businessName || businessData.name}</h4>
                      <p>{businessData.tagline}</p>
                    </div>
                  </div>
                  
                  <div className="domain-badge">
                    <Globe size={14} />
                    {businessData.domain}
                  </div>
                </div>
              </div>

              {/* Live Activity */}
              <div className="dashboard-card activity-card">
                <div className="card-header">
                  <h3>
                    <Activity size={20} />
                    Live Activity
                  </h3>
                </div>
                
                <div className="activity-feed">
                  {notifications.length === 0 ? (
                    <p className="no-activity">Activity will appear here once you launch</p>
                  ) : (
                    notifications.map((notif) => (
                      <div key={notif.id} className="activity-item">
                        <span className="activity-icon">{notif.icon}</span>
                        <span className="activity-text">{notif.text}</span>
                        <span className="activity-time">just now</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Products */}
              <div className="dashboard-card products-card">
                <div className="card-header">
                  <h3>
                    <DollarSign size={20} />
                    Your Products
                  </h3>
                </div>
                
                <div className="products-grid">
                  {(businessData.products || []).slice(0, 3).map((product, index) => (
                    <div key={index} className="product-item">
                      <div className="product-header">
                        <h4>{product.name}</h4>
                        <span className="product-price">{product.price}</span>
                      </div>
                      <p className="product-description">{product.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Steps */}
              <div className="dashboard-card steps-card">
                <div className="card-header">
                  <h3>
                    <Rocket size={20} />
                    Launch Steps
                  </h3>
                  <span className="steps-progress">{completedSteps.length}/3 Complete</span>
                </div>
                
                <div className="launch-steps">
                  <div className={`step-item ${completedSteps.includes(1) || completedSteps.includes('1') ? 'completed' : ''}`}>
                    <div className="step-icon">
                      {completedSteps.includes(1) || completedSteps.includes('1') ? <Check size={16} /> : '1'}
                    </div>
                    <div className="step-content">
                      <h4>Claim Your Domain</h4>
                      <p>Secure {businessData.domain} before someone else</p>
                    </div>
                    <button 
                      onClick={() => completeStep(1)}
                      disabled={completedSteps.includes(1) || completedSteps.includes('1')}
                      className="step-btn"
                    >
                      {completedSteps.includes(1) || completedSteps.includes('1') ? 'Done' : 'Claim'}
                    </button>
                  </div>
                  
                  <div className={`step-item ${completedSteps.includes(2) || completedSteps.includes('2') ? 'completed' : ''}`}>
                    <div className="step-icon">
                      {completedSteps.includes(2) || completedSteps.includes('2') ? <Check size={16} /> : '2'}
                    </div>
                    <div className="step-content">
                      <h4>Connect Payments</h4>
                      <p>Start accepting money in 2 minutes</p>
                    </div>
                    <button 
                      onClick={() => completeStep(2)}
                      disabled={completedSteps.includes(2) || completedSteps.includes('2')}
                      className="step-btn"
                    >
                      {completedSteps.includes(2) || completedSteps.includes('2') ? 'Done' : 'Connect'}
                    </button>
                  </div>
                  
                  <div className={`step-item ${completedSteps.includes(3) || completedSteps.includes('3') ? 'completed' : ''}`}>
                    <div className="step-icon">
                      {completedSteps.includes(3) || completedSteps.includes('3') ? <Check size={16} /> : '3'}
                    </div>
                    <div className="step-content">
                      <h4>Go Live</h4>
                      <p>Activate AI marketing & get customers</p>
                    </div>
                    <button 
                      onClick={() => completeStep(3)}
                      disabled={completedSteps.includes(3) || completedSteps.includes('3')}
                      className="step-btn primary"
                    >
                      {completedSteps.includes(3) || completedSteps.includes('3') ? 'Live!' : 'Launch'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* AI Coach */}
      {showAiCoach && (
        <div className="ai-coach">
          <div className="coach-header">
            <div className="coach-avatar">🤖</div>
            <div className="coach-info">
              <h4>AI Success Coach</h4>
              <span className="coach-status">Online</span>
            </div>
            <button onClick={() => setShowAiCoach(false)} className="coach-close">
              <X size={16} />
            </button>
          </div>
          <div className="coach-message">
            <p>{aiCoachMessage}</p>
          </div>
          <div className="coach-actions">
            <button className="coach-btn primary">Yes, Help Me!</button>
            <button onClick={() => setShowAiCoach(false)} className="coach-btn">Later</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .neon-dashboard {
          min-height: 100vh;
          background: #0A0A0F;
          color: #FFFFFF;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', -apple-system, sans-serif;
        }

        /* Particle Background */
        .particle-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }

        .particle {
          position: absolute;
          background: #9945FF;
          border-radius: 50%;
          opacity: 0.3;
          animation: drift linear infinite;
        }

        @keyframes drift {
          0% {
            transform: translate(0, 100vh) scale(0);
            opacity: 0;
          }
          10% {
            opacity: 0.3;
          }
          90% {
            opacity: 0.3;
          }
          100% {
            transform: translate(100vw, -100vh) scale(1);
            opacity: 0;
          }
        }

        /* Gradient Mesh */
        .gradient-mesh {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0.3;
          z-index: 0;
        }

        .mesh-circle {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
        }

        .mesh-1 {
          width: 600px;
          height: 600px;
          background: #9945FF;
          top: -200px;
          right: -200px;
          animation: float-mesh 20s ease-in-out infinite;
        }

        .mesh-2 {
          width: 400px;
          height: 400px;
          background: #14F195;
          bottom: -100px;
          left: -100px;
          animation: float-mesh 25s ease-in-out infinite reverse;
        }

        .mesh-3 {
          width: 500px;
          height: 500px;
          background: #00D9FF;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: float-mesh 30s ease-in-out infinite;
        }

        @keyframes float-mesh {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -30px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        /* Header */
        .dashboard-header {
          position: relative;
          z-index: 100;
          background: rgba(10, 10, 15, 0.8);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding: 20px 0;
        }

        .header-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 30px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-icon {
          font-size: 28px;
          animation: pulse-glow 2s infinite;
        }

        @keyframes pulse-glow {
          0%, 100% {
            filter: drop-shadow(0 0 10px #9945FF);
          }
          50% {
            filter: drop-shadow(0 0 20px #9945FF);
          }
        }

        .logo-text {
          font-size: 24px;
          font-weight: 700;
        }

        .header-stats {
          display: flex;
          gap: 40px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .stat-icon {
          font-size: 20px;
        }

        .stat-value {
          font-size: 18px;
          font-weight: 600;
          color: #14F195;
        }

        .stat-label {
          font-size: 12px;
          color: #B8B8D0;
        }

        .header-actions {
          display: flex;
          gap: 15px;
          align-items: center;
        }

        .notification-btn {
          position: relative;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #FFFFFF;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .notification-btn:hover {
          background: rgba(153, 69, 255, 0.2);
          border-color: #9945FF;
        }

        .notification-dot {
          position: absolute;
          top: 5px;
          right: 5px;
          width: 8px;
          height: 8px;
          background: #FF006E;
          border-radius: 50%;
          animation: pulse-dot 2s infinite;
        }

        @keyframes pulse-dot {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.5);
          }
        }

        .upgrade-btn {
          background: linear-gradient(135deg, #9945FF 0%, #14F195 100%);
          border: none;
          color: #FFFFFF;
          padding: 10px 20px;
          border-radius: 50px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s ease;
        }

        .upgrade-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(153, 69, 255, 0.4);
        }

        /* Main Content */
        .dashboard-main {
          position: relative;
          z-index: 10;
          padding: 40px 30px;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Generation Animation */
        .generation-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 70vh;
        }

        .generation-content {
          text-align: center;
          max-width: 600px;
        }

        .ai-orb {
          width: 200px;
          height: 200px;
          margin: 0 auto 40px;
          position: relative;
        }

        .orb-core {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #9945FF, #14F195);
          border-radius: 50%;
          box-shadow: 0 0 60px rgba(153, 69, 255, 0.8);
          animation: pulse 2s ease-in-out infinite;
        }

        .orb-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          border: 2px solid;
          border-radius: 50%;
          opacity: 0.3;
        }

        .ring-1 {
          width: 120px;
          height: 120px;
          border-color: #9945FF;
          animation: rotate 10s linear infinite;
        }

        .ring-2 {
          width: 160px;
          height: 160px;
          border-color: #14F195;
          animation: rotate 15s linear infinite reverse;
        }

        .ring-3 {
          width: 200px;
          height: 200px;
          border-color: #00D9FF;
          animation: rotate 20s linear infinite;
        }

        @keyframes pulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
          }
        }

        @keyframes rotate {
          0% {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          100% {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }

        .generation-title {
          font-size: 48px;
          font-weight: 700;
          line-height: 1.2;
          margin-bottom: 20px;
        }

        .glitch {
          position: relative;
          display: inline-block;
        }

        .glitch::before,
        .glitch::after {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }

        .glitch::before {
          animation: glitch-1 0.5s infinite;
          color: #14F195;
          z-index: -1;
          opacity: 0.7;
        }

        .glitch::after {
          animation: glitch-2 0.5s infinite;
          color: #FF006E;
          z-index: -2;
          opacity: 0.7;
        }

        @keyframes glitch-1 {
          0% {
            clip-path: inset(40% 0 61% 0);
            transform: translate(-2px, -2px);
          }
          20% {
            clip-path: inset(92% 0 1% 0);
            transform: translate(2px, 2px);
          }
          40% {
            clip-path: inset(43% 0 1% 0);
            transform: translate(-2px, 2px);
          }
          60% {
            clip-path: inset(25% 0 58% 0);
            transform: translate(2px, -2px);
          }
          80% {
            clip-path: inset(54% 0 7% 0);
            transform: translate(-2px, 2px);
          }
          100% {
            clip-path: inset(58% 0 43% 0);
            transform: translate(2px, -2px);
          }
        }

        .gradient-text {
          background: linear-gradient(135deg, #9945FF 0%, #14F195 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .generation-status {
          font-size: 20px;
          color: #B8B8D0;
          margin-bottom: 40px;
        }

        /* Progress Bar */
        .progress-container {
          margin-bottom: 40px;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          overflow: hidden;
          position: relative;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #9945FF, #14F195);
          border-radius: 4px;
          transition: width 0.6s ease;
          position: relative;
        }

        .progress-glow {
          position: absolute;
          top: 0;
          right: 0;
          width: 100px;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100px);
          }
          100% {
            transform: translateX(100px);
          }
        }

        .progress-text {
          display: block;
          text-align: center;
          margin-top: 15px;
          font-size: 14px;
          color: #B8B8D0;
        }

        /* Stage Pills */
        .stage-pills {
          display: flex;
          gap: 15px;
          justify-content: center;
        }

        .stage-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          padding: 8px 16px;
          border-radius: 50px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 14px;
          color: #6B6B80;
          transition: all 0.3s ease;
        }

        .stage-pill.active {
          background: rgba(153, 69, 255, 0.2);
          border-color: #9945FF;
          color: #FFFFFF;
        }

        /* Error State */
        .error-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 70vh;
        }

        .error-content {
          text-align: center;
          max-width: 400px;
        }

        .error-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }

        .error-content h2 {
          font-size: 28px;
          margin-bottom: 15px;
        }

        .error-content p {
          color: #B8B8D0;
          margin-bottom: 30px;
        }

        .retry-btn {
          background: linear-gradient(135deg, #9945FF, #14F195);
          border: none;
          color: #FFFFFF;
          padding: 12px 30px;
          border-radius: 50px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s ease;
        }

        .retry-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(153, 69, 255, 0.4);
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .phone-modal {
          background: #1E1E2E;
          border: 1px solid rgba(153, 69, 255, 0.3);
          border-radius: 20px;
          padding: 40px;
          max-width: 400px;
          width: 90%;
          position: relative;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .modal-close {
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #FFFFFF;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .modal-close:hover {
          background: rgba(255, 0, 110, 0.2);
          border-color: #FF006E;
        }

        .modal-icon {
          font-size: 48px;
          text-align: center;
          margin-bottom: 20px;
        }

        .phone-modal h3 {
          font-size: 24px;
          text-align: center;
          margin-bottom: 10px;
        }

        .phone-modal p {
          text-align: center;
          color: #B8B8D0;
          margin-bottom: 30px;
        }

        .phone-input-group {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }

        .phone-input {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #FFFFFF;
          padding: 12px 20px;
          border-radius: 50px;
          font-size: 16px;
          outline: none;
          transition: all 0.3s ease;
        }

        .phone-input:focus {
          border-color: #9945FF;
          box-shadow: 0 0 20px rgba(153, 69, 255, 0.2);
        }

        .phone-submit {
          background: linear-gradient(135deg, #9945FF, #14F195);
          border: none;
          color: #FFFFFF;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .phone-submit:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 20px rgba(153, 69, 255, 0.4);
        }

        .phone-disclaimer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          font-size: 12px;
          color: #6B6B80;
        }

        /* Business Dashboard */
        .business-dashboard {
          animation: fadeIn 0.6s ease-out;
        }

        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Success Banner */
        .success-banner {
          background: linear-gradient(135deg, rgba(20, 241, 149, 0.2), rgba(153, 69, 255, 0.2));
          border: 1px solid rgba(20, 241, 149, 0.3);
          border-radius: 20px;
          padding: 30px;
          margin-bottom: 40px;
          position: relative;
          overflow: hidden;
        }

        .success-banner::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
          transform: rotate(45deg);
          animation: banner-sweep 3s ease-in-out infinite;
        }

        @keyframes banner-sweep {
          0% {
            transform: translateX(-100%) translateY(-100%) rotate(45deg);
          }
          100% {
            transform: translateX(100%) translateY(100%) rotate(45deg);
          }
        }

        .banner-content {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 30px;
          flex-wrap: wrap;
        }

        .banner-icon {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #14F195, #9945FF);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          box-shadow: 0 4px 20px rgba(20, 241, 149, 0.4);
        }

        .banner-text h2 {
          font-size: 28px;
          margin-bottom: 5px;
        }

        .banner-text p {
          color: #B8B8D0;
        }

        .banner-timer {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.1);
          padding: 10px 20px;
          border-radius: 50px;
          font-size: 14px;
          color: #FFD600;
        }

        /* Dashboard Grid */
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 30px;
        }

        /* Dashboard Cards */
        .dashboard-card {
          background: rgba(30, 30, 46, 0.7);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 30px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .dashboard-card:hover {
          transform: translateY(-5px);
          border-color: rgba(153, 69, 255, 0.3);
          box-shadow: 0 20px 40px rgba(153, 69, 255, 0.1);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
        }

        .card-header h3 {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 20px;
          font-weight: 600;
        }

        .live-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #14F195;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .live-dot {
          width: 8px;
          height: 8px;
          background: #14F195;
          border-radius: 50%;
          animation: pulse-dot 2s infinite;
        }

        /* Revenue Card */
        .revenue-display {
          text-align: center;
        }

        .revenue-main {
          margin-bottom: 30px;
        }

        .revenue-label {
          display: block;
          font-size: 14px;
          color: #B8B8D0;
          margin-bottom: 10px;
        }

        .revenue-amount {
          font-size: 42px;
          font-weight: 700;
          background: linear-gradient(135deg, #14F195, #9945FF);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 20px rgba(20, 241, 149, 0.5));
        }

        /* Business Card */
        .view-site-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #FFFFFF;
          padding: 8px 16px;
          border-radius: 50px;
          font-size: 14px;
          text-decoration: none;
          transition: all 0.3s ease;
        }

        .view-site-btn:hover {
          background: rgba(153, 69, 255, 0.2);
          border-color: #9945FF;
        }

        .business-preview {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 15px;
          padding: 25px;
        }

        .preview-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 20px;
        }

        .business-logo {
          font-size: 48px;
        }

        .business-info h4 {
          font-size: 22px;
          margin-bottom: 5px;
        }

        .business-info p {
          color: #B8B8D0;
          font-size: 14px;
        }

        .domain-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(153, 69, 255, 0.2);
          color: #9945FF;
          padding: 8px 16px;
          border-radius: 50px;
          font-size: 14px;
          font-weight: 500;
        }

        /* Activity Card */
        .activity-feed {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .no-activity {
          text-align: center;
          color: #6B6B80;
          padding: 40px 0;
        }

        .activity-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 15px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          font-size: 14px;
          animation: slideIn 0.4s ease-out;
        }

        @keyframes slideIn {
          0% {
            opacity: 0;
            transform: translateX(-20px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .activity-icon {
          font-size: 20px;
        }

        .activity-text {
          flex: 1;
          color: #B8B8D0;
        }

        .activity-time {
          font-size: 12px;
          color: #6B6B80;
        }

        /* Products Card */
        .products-grid {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .product-item {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 15px;
          padding: 20px;
          transition: all 0.3s ease;
        }

        .product-item:hover {
          border-color: rgba(153, 69, 255, 0.3);
          transform: translateX(5px);
        }

        .product-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .product-header h4 {
          font-size: 18px;
        }

        .product-price {
          font-size: 20px;
          font-weight: 600;
          color: #14F195;
        }

        .product-description {
          color: #B8B8D0;
          font-size: 14px;
        }

        /* Steps Card */
        .steps-progress {
          background: rgba(20, 241, 149, 0.2);
          color: #14F195;
          padding: 6px 12px;
          border-radius: 50px;
          font-size: 12px;
          font-weight: 600;
        }

        .launch-steps {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .step-item {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 15px;
          transition: all 0.3s ease;
        }

        .step-item:hover {
          border-color: rgba(153, 69, 255, 0.3);
        }

        .step-item.completed {
          border-color: rgba(20, 241, 149, 0.3);
          background: rgba(20, 241, 149, 0.05);
        }

        .step-icon {
          width: 40px;
          height: 40px;
          background: rgba(153, 69, 255, 0.2);
          border: 2px solid #9945FF;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          flex-shrink: 0;
        }

        .step-item.completed .step-icon {
          background: rgba(20, 241, 149, 0.2);
          border-color: #14F195;
          color: #14F195;
        }

        .step-content {
          flex: 1;
        }

        .step-content h4 {
          font-size: 16px;
          margin-bottom: 5px;
        }

        .step-content p {
          font-size: 14px;
          color: #B8B8D0;
        }

        .step-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #FFFFFF;
          padding: 10px 24px;
          border-radius: 50px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .step-btn:hover:not(:disabled) {
          background: rgba(153, 69, 255, 0.2);
          border-color: #9945FF;
        }

        .step-btn.primary {
          background: linear-gradient(135deg, #9945FF, #14F195);
          border: none;
        }

        .step-btn.primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(153, 69, 255, 0.4);
        }

        .step-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* AI Coach */
        .ai-coach {
          position: fixed;
          bottom: 30px;
          right: 30px;
          width: 350px;
          background: #1E1E2E;
          border: 1px solid rgba(153, 69, 255, 0.3);
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          z-index: 1000;
          animation: slideUp 0.4s ease-out;
        }

        @keyframes slideUp {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .coach-header {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .coach-avatar {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #9945FF, #14F195);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .coach-info h4 {
          font-size: 16px;
          margin-bottom: 2px;
        }

        .coach-status {
          font-size: 12px;
          color: #14F195;
        }

        .coach-close {
          margin-left: auto;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #FFFFFF;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .coach-close:hover {
          background: rgba(255, 0, 110, 0.2);
          border-color: #FF006E;
        }

        .coach-message {
          padding: 20px;
        }

        .coach-message p {
          line-height: 1.6;
          color: #B8B8D0;
        }

        .coach-actions {
          display: flex;
          gap: 10px;
          padding: 0 20px 20px;
        }

        .coach-btn {
          flex: 1;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #FFFFFF;
          padding: 10px 20px;
          border-radius: 50px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .coach-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .coach-btn.primary {
          background: linear-gradient(135deg, #9945FF, #14F195);
          border: none;
        }

        .coach-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(153, 69, 255, 0.4);
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .header-container {
            flex-wrap: wrap;
            gap: 20px;
          }

          .header-stats {
            display: none;
          }

          .dashboard-grid {
            grid-template-columns: 1fr;
          }

          .banner-content {
            flex-direction: column;
            text-align: center;
          }

          .banner-timer {
            margin-left: 0;
          }

          .generation-title {
            font-size: 36px;
          }

          .ai-coach {
            width: calc(100vw - 40px);
            right: 20px;
            bottom: 20px;
          }
        }
      `}</style>
    </div>
  );
};

export default LaunchflyDashboard;