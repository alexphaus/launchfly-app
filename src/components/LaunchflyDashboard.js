import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ChevronRight, Globe, DollarSign, Users, Rocket, Check, Star, TrendingUp, Mail, Share2, CreditCard, Zap, ArrowRight, Sparkles, BarChart3, Clock, MessageSquare, Phone, X, AlertCircle } from 'lucide-react';

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
  const [todayRevenue, setTodayRevenue] = useState(47293);

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
      { month: 'Month 1', revenue: 0 },
      { month: 'Month 2', revenue: 0 },
      { month: 'Month 3', revenue: 0 },
      { month: 'Month 4', revenue: 0 },
      { month: 'Month 5', revenue: 0 },
      { month: 'Month 6', revenue: 0 }
    ]
  };

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

  // Simulate live notifications based on business type
  useEffect(() => {
    if (showBusiness) {
      const businessType = business?.form_data?.businessType || 'business';
      const notificationMessages = [
        { id: 1, text: `Sarah from NYC just launched her ${businessType}!`, time: "2 min ago" },
        { id: 2, text: `Your domain ${businessData.domain} is available!`, time: "Just now" },
        { id: 3, text: `3 competitors analyzed in your niche`, time: "1 min ago" }
      ];

      const timer = setTimeout(() => {
        setNotifications(notificationMessages);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [showBusiness, business, businessData.domain]);

  // Show AI Coach at strategic moments
  useEffect(() => {
    if (showBusiness) {
      // Show welcome message after 3 seconds
      setTimeout(() => {
        setAiCoachMessage(`🎉 Congrats ${userName}! I'm your AI success coach. 90% of users who connect payments in the first hour make their first sale within 48 hours. Want me to help you set it up?`);
        setShowAiCoach(true);
      }, 3000);

      // Show urgency message after 30 seconds if no action
      setTimeout(() => {
        if (completedSteps.length === 0) {
          setAiCoachMessage(`⚡ Quick tip: I see 2 people just visited similar ${business?.form_data?.businessType || 'business'} sites. Claiming your domain now ensures you get the customers first!`);
          setShowAiCoach(true);
        }
      }, 30000);
    }
  }, [showBusiness, completedSteps, userName, business]);

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
    
    // Call parent handler
    if (onStepComplete) {
      onStepComplete(stepId);
    }
    
    // AI Coach responds to actions
    if (stepId === 1) {
      setAiCoachMessage(`🎯 Perfect! Domain secured. Now let's get payments set up so you don't miss any sales. Users typically get their first customer within 24 hours!`);
      setShowAiCoach(true);
    } else if (stepId === 2) {
      setAiCoachMessage(`💰 You're all set to receive payments! Want me to show you the email template that converts at 47%? It's perfect for your first outreach.`);
      setShowAiCoach(true);
    }
  };

  const handlePhoneSubmit = () => {
    if (phoneNumber && onPhoneCapture) {
      onPhoneCapture(phoneNumber);
      setShowPhoneCapture(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handlePhoneSubmit();
    }
  };

  const stageMessages = {
    analyzing: "Analyzing your skills and market opportunities...",
    researching: `Researching profitable niches in ${business?.form_data?.businessType || 'your industry'}...`,
    building: "Building your personalized business plan...",
    finalizing: "Finalizing your website and marketing strategy...",
    complete: "Your business is ready!",
    error: "Something went wrong. Please refresh and try again."
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header with Live Revenue Counter */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Rocket className="w-6 h-6 text-blue-600" />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Launchfly
              </span>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-gray-600">Launchfly users earned</span>
                <span className="font-bold text-green-600">${todayRevenue.toLocaleString()}</span>
                <span className="text-gray-600">today</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">Welcome, {userName}!</span>
                <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:shadow-lg transition-all">
                  Upgrade to Pro
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* AI Generation Animation */}
        {!showBusiness && stage !== 'error' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 animate-pulse"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-16 h-16 text-white animate-spin" />
              </div>
            </div>
            
            <div className="text-center space-y-4 max-w-md">
              <h2 className="text-3xl font-bold text-gray-900">
                Creating Your Business...
              </h2>
              <p className="text-lg text-gray-600 animate-pulse">
                {stageMessages[stage]}
              </p>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
                >
                  <div className="h-full bg-white/30 animate-pulse"></div>
                </div>
              </div>
              <p className="text-sm text-gray-500">{progress}% Complete</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {stage === 'error' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <div className="text-red-600 text-6xl">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900">Oops! Something went wrong</h2>
            <p className="text-gray-600">Please refresh the page and try again.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        )}

        {/* Phone Capture Modal */}
        {showPhoneCapture && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-slideUp">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900">📱 Get Instant Updates</h3>
                <button 
                  onClick={() => setShowPhoneCapture(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-600 mb-4">
                Get notified instantly when someone visits your site or when you make your first sale!
              </p>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="+1 (555) 123-4567"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    onClick={handlePhoneSubmit}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all"
                  >
                    Get Updates
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  We'll text you only important updates. No spam, ever.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Business Dashboard */}
        {showBusiness && (
          <div className="animate-fadeIn space-y-8">
            {/* Success Banner with Urgency */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                    <Check className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Congratulations! Your Business is Ready 🎉</h2>
                    <p className="text-green-100">Complete setup in next 24h to lock in founder pricing</p>
                  </div>
                </div>
                <button className="bg-white text-green-600 px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all flex items-center gap-2">
                  Launch Now <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              {/* Urgency Timer */}
              <div className="mt-4 flex items-center gap-2 text-sm text-green-100">
                <Clock className="w-4 h-4" />
                <span>Launch bonus expires in: 23:47:12</span>
              </div>
            </div>

            {/* Trust Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium">
                  🛡️ 30-Day Money Back Guarantee + We Pay You $100 If You Don't Make Your First Sale in 30 Days
                </p>
              </div>
            </div>

            {/* Business Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Website Preview */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-600" />
                    Your Website Preview
                  </h3>
                </div>
                <div className="p-6">
                  {/* Mock Website */}
                  <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg p-8 text-white">
                    <div className="text-center space-y-4">
                      <div className="text-6xl">{businessData.logo}</div>
                      <h1 className="text-4xl font-bold">{businessData.businessName || businessData.name}</h1>
                      <p className="text-xl text-blue-100">{businessData.tagline}</p>
                      <div className="flex gap-4 justify-center mt-8">
                        <button className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all">
                          Start Free Trial
                        </button>
                        <button className="bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-400 transition-all">
                          View Programs
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span>Live at {businessData.domain}</span>
                    </div>
                    <button className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1">
                      Customize Design <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="space-y-6">
                {/* Revenue Potential */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900">Revenue Potential</h3>
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    {businessData.revenue || businessData.monthlyRevenue}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">Based on market analysis</p>
                </div>

                {/* Live Activity */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Live Activity</h3>
                  <div className="space-y-3">
                    {notifications.map((notif) => (
                      <div key={notif.id} className="flex items-start gap-3 text-sm">
                        <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 animate-pulse"></div>
                        <div className="flex-1">
                          <p className="text-gray-700">{notif.text}</p>
                          <p className="text-gray-500 text-xs">{notif.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Urgency Box */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-900">
                    🔥 17 people viewing {business?.form_data?.businessType || 'similar'} businesses right now
                  </p>
                </div>
              </div>
            </div>

            {/* Products & Services */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                Your Products & Services
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(businessData.products || []).slice(0, 3).map((product, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-6 hover:border-blue-600 hover:shadow-lg transition-all">
                    <h4 className="font-semibold text-gray-900 mb-2">{product.name}</h4>
                    <p className="text-2xl font-bold text-blue-600 mb-3">{product.price}</p>
                    <p className="text-sm text-gray-600 mb-4">{product.description}</p>
                    <button className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-all text-sm font-medium">
                      Edit Product
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue Projection Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  6-Month Revenue Projection
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={businessData.monthlyData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value) => `$${value}`}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#3B82F6" 
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Target Customers */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Your Target Customers
                </h3>
                <div className="space-y-4">
                  {(businessData.targetCustomers || []).slice(0, 3).map((customer, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {index + 1}
                      </div>
                      <p className="text-gray-700">{customer}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Steps */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-6">🚀 Launch Your Business in 3 Steps</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/10 backdrop-blur rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
                      1
                    </div>
                    {completedSteps.includes(1) || completedSteps.includes('1') ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-white/60" />
                    )}
                  </div>
                  <h4 className="font-semibold mb-2">Claim Your Domain</h4>
                  <p className="text-sm text-blue-100 mb-4">Secure {businessData.domain} before someone else does</p>
                  <button 
                    onClick={() => completeStep(1)}
                    disabled={completedSteps.includes(1) || completedSteps.includes('1')}
                    className="w-full bg-white text-blue-600 py-2 rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {completedSteps.includes(1) || completedSteps.includes('1') ? 'Completed ✓' : 'Claim Now'}
                  </button>
                </div>
                
                <div className="bg-white/10 backdrop-blur rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
                      2
                    </div>
                    {completedSteps.includes(2) || completedSteps.includes('2') ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-white/60" />
                    )}
                  </div>
                  <h4 className="font-semibold mb-2">Connect Payments</h4>
                  <p className="text-sm text-blue-100 mb-4">Start accepting payments in 2 minutes</p>
                  <button 
                    onClick={() => completeStep(2)}
                    disabled={completedSteps.includes(2) || completedSteps.includes('2')}
                    className="w-full bg-white text-blue-600 py-2 rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {completedSteps.includes(2) || completedSteps.includes('2') ? 'Completed ✓' : 'Connect Stripe'}
                  </button>
                </div>
                
                <div className="bg-white/10 backdrop-blur rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
                      3
                    </div>
                    {completedSteps.includes(3) || completedSteps.includes('3') ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-white/60" />
                    )}
                  </div>
                  <h4 className="font-semibold mb-2">Launch & Share</h4>
                  <p className="text-sm text-blue-100 mb-4">Go live and get your first customers</p>
                  <button 
                    onClick={() => completeStep(3)}
                    disabled={completedSteps.includes(3) || completedSteps.includes('3')}
                    className="w-full bg-white text-blue-600 py-2 rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {completedSteps.includes(3) || completedSteps.includes('3') ? 'Completed ✓' : 'Go Live'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* AI Success Coach */}
      {showAiCoach && (
        <div className="fixed bottom-6 right-6 max-w-sm z-50 animate-slideUp">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-white" />
                <span className="font-semibold text-white">AI Success Coach</span>
              </div>
              <button 
                onClick={() => setShowAiCoach(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-700 leading-relaxed">{aiCoachMessage}</p>
              <div className="mt-4 flex gap-2">
                <button className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:shadow-lg transition-all">
                  Yes, Help Me!
                </button>
                <button 
                  onClick={() => setShowAiCoach(false)}
                  className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg transition-all"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};

export default LaunchflyDashboard;