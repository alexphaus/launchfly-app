import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ChevronRight, Globe, DollarSign, Users, Rocket, Check, TrendingUp, Sparkles, Clock, X, AlertCircle, MessageSquare } from 'lucide-react';
import GrowthInsights from './GrowthInsights';

// --- NEW: Design System Inspired by styles.css ---
const theme = {
  colors: {
    primary: '#007BFF',
    primaryDark: '#0056b3',
    secondaryCta: '#00B8D9',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    white: '#ffffff',
    borderLight: '#E4E7EB',
    success: '#28a745',
    error: '#dc3545',
  },
  shadows: {
    md: '0 4px 8px -2px rgba(26, 43, 72, 0.1), 0 2px 4px -2px rgba(26, 43, 72, 0.06)',
    lg: '0 12px 20px -4px rgba(26, 43, 72, 0.1), 0 4px 6px -4px rgba(26, 43, 72, 0.05)',
    xl: '0 24px 32px -8px rgba(26, 43, 72, 0.12), 0 10px 12px -6px rgba(26, 43, 72, 0.08)',
  },
  gradients: {
    primary: 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)',
  }
};

// --- COMPONENT: Enhanced Loading State ---
const GenerationLoader = ({ progress, stageMessage }) => {
    const steps = useMemo(() => [
        { id: 'analyzing', text: 'Analyzing your skills & goals' },
        { id: 'researching', text: 'Researching profitable niches' },
        { id: 'building', text: 'Building your business & website' },
        { id: 'finalizing', text: 'Finalizing marketing campaigns' },
    ], []);

    const currentStepIndex = useMemo(() => {
        const stageOrder = ['analyzing', 'researching', 'building', 'finalizing', 'complete'];
        return stageOrder.indexOf(stageMessage);
    }, [stageMessage]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-4" style={{ color: theme.colors.textDark }}>
            <div className="relative mb-8">
                <div className="w-28 h-28 rounded-full animate-pulse" style={{ background: theme.gradients.primary }}></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-14 h-14 text-white" />
                </div>
            </div>
            <h2 className="text-3xl font-black mb-3 text-center" style={{ color: theme.colors.textDark }}>Crafting Your Business</h2>
            <p className="text-lg text-center max-w-md mb-8" style={{ color: theme.colors.textGray }}>The AI is working its magic. Your launchpad will be ready in moments.</p>

            <div className="w-full max-w-md space-y-3">
                {steps.map((step, index) => (
                    <div
                        key={step.id}
                        className={`flex items-center p-3 rounded-lg transition-all duration-500 ${index < currentStepIndex ? 'bg-green-100' : 'bg-gray-100'}`}
                    >
                        <div className="w-6 h-6 flex items-center justify-center mr-3">
                            {index < currentStepIndex ? (
                                <Check className="w-5 h-5 text-green-500" />
                            ) : index === currentStepIndex ? (
                                <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
                            ) : (
                                <Clock className="w-5 h-5 text-gray-400" />
                            )}
                        </div>
                        <span className={`font-medium ${index < currentStepIndex ? 'text-green-800' : 'text-gray-700'}`}>{step.text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- COMPONENT: Guarantee Card (from landing page) ---
const GuaranteeCard = () => (
    <div className="rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6" style={{ background: theme.colors.primary, color: theme.colors.white, boxShadow: theme.shadows.lg }}>
        <div className="flex-shrink-0">
             <svg className="w-20 h-20" viewBox="0 0 24 24" fill="currentColor"><path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9L10,17Z"/></svg>
        </div>
        <div>
            <h3 className="text-2xl font-bold mb-2">Our Ironclad Double Guarantee</h3>
            <p className="opacity-90">Your success is our business model. You're protected with our Revenue Guarantee and our Success Partnership. If you don't profit, we don't profit.</p>
        </div>
    </div>
);


// --- COMPONENT: Main Launch Checklist ---
const LaunchChecklist = ({ businessData, completedSteps, onStepComplete }) => {
    const steps = [
        { id: 1, title: "Claim Your Domain", description: `Secure ${businessData?.domain || 'your-business.com'} before someone else does.`, buttonText: "Claim Now", icon: "🌐" },
        { id: 2, title: "Activate Payments", description: "Connect Stripe to start accepting payments in 2 minutes.", buttonText: "Connect Stripe", icon: "💳" },
        { id: 3, title: "Launch & Get Customers", description: "Go live! Our AI will start finding your first customers immediately.", buttonText: "Activate Business", icon: "🚀" }
    ];

    return (
        <div className="bg-white rounded-2xl p-6 md:p-8" style={{ boxShadow: theme.shadows.lg }}>
            <h3 className="text-2xl font-extrabold mb-5" style={{ color: theme.colors.textDark }}>Your 3-Minute Launch Plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {steps.map((step, index) => {
                    const isCompleted = completedSteps.includes(step.id) || completedSteps.includes(String(step.id));
                    return (
                        <div key={step.id} className={`p-6 rounded-xl transition-all ${isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'} border`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-4xl">{step.icon}</div>
                                {isCompleted && <div className="w-7 h-7 flex items-center justify-center bg-green-500 text-white rounded-full"><Check className="w-5 h-5"/></div>}
                            </div>
                            <h4 className="text-lg font-bold mb-2" style={{ color: theme.colors.textDark }}>{step.title}</h4>
                            <p className="text-sm mb-5 min-h-[60px]" style={{ color: theme.colors.textGray }}>{step.description}</p>
                            <button
                                onClick={() => onStepComplete(step.id)}
                                disabled={isCompleted}
                                className={`w-full text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed`}
                                style={{
                                    background: isCompleted ? theme.colors.success : theme.colors.primary,
                                    boxShadow: theme.shadows.md
                                }}
                            >
                                {isCompleted ? 'Done!' : step.buttonText}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


// --- MAIN DASHBOARD COMPONENT ---
const LaunchflyDashboard = ({ session, business, onPhoneCapture, onStepComplete }) => {
    // --- State Management ---
    const stage = session?.stage || 'analyzing';
    const progress = session?.progress || 0;
    const existingCompletedSteps = session?.completed_steps || [];
    const userName = session?.userData?.name || business?.form_data?.name || 'there';
  
    const [showBusiness, setShowBusiness] = useState(false);
    const [completedSteps, setCompletedSteps] = useState(existingCompletedSteps);
    const [todayRevenue, setTodayRevenue] = useState(47293);
    const [aiCoach, setAiCoach] = useState({ show: false, message: '' });

    // --- Data Memos ---
    const businessData = useMemo(() => business?.business_data || {
        businessName: business?.name || "Generating Your Business...",
        tagline: "Your personalized business is being created...",
        domain: business?.subdomain ? `${business.subdomain}.launchfly.ai` : "yourbusiness.com",
        revenue: "$2,000-$5,000/month",
        products: [{ name: "AI-Generated Product", price: "$99", description: "High-value product tailored to your niche." }],
        targetCustomers: ["Your ideal customers are being identified..."],
        monthlyData: [
            { month: 'M1', revenue: 0 }, { month: 'M2', revenue: 1200 }, { month: 'M3', revenue: 2500 },
            { month: 'M4', revenue: 3800 }, { month: 'M5', revenue: 4500 }, { month: 'M6', revenue: 5100 }
        ]
    }, [business]);

    // Dynamic website URL generation
    const getWebsiteUrl = (subdomain) => {
        const baseUrl = process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || process.env.NEXT_PUBLIC_URL;
        const isDev = process.env.NODE_ENV === 'development' || baseUrl?.includes('localhost');
        
        if (isDev) {
            return `${baseUrl}/sites/${subdomain}`;
        } else {
            return `https://${subdomain}.launchfly.ai`;
        }
    };

    // --- Effects ---
    useEffect(() => {
        if (stage === 'complete' && business?.business_data) {
            setTimeout(() => setShowBusiness(true), 500);
        }
    }, [stage, business]);

    useEffect(() => {
        if (existingCompletedSteps.length > 0) {
            setCompletedSteps(existingCompletedSteps);
        }
    }, [existingCompletedSteps]);
    
    useEffect(() => {
        if (showBusiness) {
          setTimeout(() => {
            setAiCoach({ show: true, message: `🎉 Congrats ${userName}! I'm your AI success coach. The next step is to claim your domain. Let's get it done!` });
          }, 2000);
        }
    }, [showBusiness, userName]);

    useEffect(() => {
        const interval = setInterval(() => setTodayRevenue(prev => prev + Math.floor(Math.random() * 100) + 50), 5000);
        return () => clearInterval(interval);
    }, []);
    
    // --- Handlers ---
    const completeStep = (stepId) => {
        if (completedSteps.includes(stepId) || completedSteps.includes(String(stepId))) return;
        const newSteps = [...completedSteps, stepId];
        setCompletedSteps(newSteps);
        if (onStepComplete) onStepComplete(stepId);

        // AI Coach Responses
        if (stepId === 1) {
            setAiCoach({ show: true, message: `🎯 Domain secured! Now, let's activate payments. Users who do this in the first hour are 3x more likely to get a sale in 48 hours.` });
        } else if (stepId === 2) {
            setAiCoach({ show: true, message: `💰 You're ready to get paid! It's time to launch. Click 'Activate Business' and I'll immediately start running ads to find your first customers.` });
        } else if (stepId === 3) {
            setAiCoach({ show: true, message: `🚀 You are LIVE! I'm now analyzing the market and will notify you the moment your first visitor arrives. Exciting! 🔥` });
        }
    };
    
    const stageMessages = {
        analyzing: "analyzing", researching: "researching", building: "building", finalizing: "finalizing", complete: "complete",
        error: "Something went wrong. Please refresh and try again."
    };

    return (
        <div className="min-h-screen" style={{ backgroundColor: theme.colors.bgLight }}>
            {/* --- Header --- */}
            <header className="bg-white/80 backdrop-blur-lg border-b sticky top-0 z-50" style={{ borderColor: theme.colors.borderLight }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🚀</span>
                            <span className="text-2xl font-extrabold" style={{ color: theme.colors.textDark }}>Launchfly</span>
                        </div>
                        <div className="hidden md:flex items-center gap-2 text-sm p-2 rounded-lg" style={{ background: theme.colors.bgLight}}>
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span style={{color: theme.colors.textGray}}>Launchfly Users Earned</span>
                            <span className="font-bold" style={{color: theme.colors.success}}>${todayRevenue.toLocaleString()}</span>
                            <span style={{color: theme.colors.textGray}}>Today</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm hidden sm:block" style={{color: theme.colors.textGray}}>Welcome, {userName}!</span>
                            <button className="text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity" style={{background: theme.colors.primary}}>
                                My Account
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* --- Main Content --- */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                {!showBusiness ? (
                    <GenerationLoader progress={progress} stageMessage={stageMessages[stage]} />
                ) : (
                    <div className="space-y-8 animate-fadeIn">
                        {/* --- Top Section: Welcome & Guarantee --- */}
                        <div className="text-center">
                            <h1 className="text-3xl md:text-4xl font-black mb-2" style={{ color: theme.colors.textDark }}>
                                Welcome, {userName}! Your Business is Ready.
                            </h1>
                            <p className="text-lg" style={{ color: theme.colors.textGray }}>
                                Complete the steps below to launch and get your first paying customers.
                            </p>
                        </div>
                        
                        <GuaranteeCard />
                        
                        {/* --- Middle Section: Launch Checklist --- */}
                        <LaunchChecklist businessData={businessData} completedSteps={completedSteps} onStepComplete={completeStep} />
                        
                        {/* --- Growth Section: Insights from Core Architecture --- */}
                        {businessData?.growthMetrics || completedSteps?.includes('3') ? (
                            <GrowthInsights businessData={businessData} theme={theme} />
                        ) : null}

                        {/* --- Bottom Section: Business Details --- */}
                        <div className="bg-white rounded-2xl p-6 md:p-8" style={{ boxShadow: theme.shadows.lg }}>
                            <h3 className="text-2xl font-extrabold mb-5" style={{ color: theme.colors.textDark }}>Your Business Details</h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Website & Products */}
                                <div className="space-y-6">
                                    <h4 className="font-bold text-lg flex items-center gap-2" style={{color: theme.colors.textDark}}><Globe className="w-5 h-5" style={{color: theme.colors.primary}} /> Website & Products</h4>
                                    <div className="p-6 rounded-xl border" style={{borderColor: theme.colors.borderLight}}>
                                        <p className="font-semibold">{businessData?.businessName || 'Your Business'}</p>
                                        <a href={getWebsiteUrl(business.subdomain)} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline flex items-center gap-2" style={{color: theme.colors.primary}}>
                                            <Globe className="w-4 h-4" />
                                            {business.subdomain}.launchfly.ai
                                        </a>
                                        <p className="text-sm mt-2" style={{color: theme.colors.textGray}}>{businessData?.tagline || 'Transform your passion into profit'}</p>
                                        <div className="mt-4">
                                            <a 
                                                href={getWebsiteUrl(business.subdomain)} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold hover:opacity-90 transition-opacity"
                                                style={{background: theme.colors.primary}}
                                            >
                                                <Globe className="w-4 h-4" />
                                                Visit Your Website
                                            </a>
                                        </div>
                                    </div>
                                    <div className="p-6 rounded-xl border" style={{borderColor: theme.colors.borderLight}}>
                                        {businessData.products && businessData.products.length > 0 ? (
                                            <>
                                                <p className="font-semibold mb-2">{businessData.products[0].name} - <span style={{color: theme.colors.primary}}>{businessData.products[0].price}</span></p>
                                                <p className="text-sm" style={{color: theme.colors.textGray}}>{businessData.products[0].description}</p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="font-semibold mb-2">Premium Service - <span style={{color: theme.colors.primary}}>$297/month</span></p>
                                                <p className="text-sm" style={{color: theme.colors.textGray}}>Professional service offering coming soon</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {/* Revenue & Customers */}
                                <div className="space-y-6">
                                     <h4 className="font-bold text-lg flex items-center gap-2" style={{color: theme.colors.textDark}}><TrendingUp className="w-5 h-5" style={{color: theme.colors.primary}} /> Revenue & Customers</h4>
                                     <div className="p-6 rounded-xl border" style={{borderColor: theme.colors.borderLight}}>
                                        <p className="text-sm font-medium" style={{color: theme.colors.textGray}}>Est. Monthly Revenue</p>
                                        <p className="text-2xl font-bold" style={{color: theme.colors.success}}>{businessData?.revenue || businessData?.monthlyRevenue || '$2,000-$5,000/month'}</p>
                                     </div>
                                      <div className="p-6 rounded-xl border" style={{borderColor: theme.colors.borderLight}}>
                                        <p className="font-semibold mb-2 flex items-center gap-2"><Users className="w-5 h-5" style={{color: theme.colors.primary}}/> Ideal Customer Profile</p>
                                        <p className="text-sm" style={{color: theme.colors.textGray}}>
                                            {businessData.targetCustomers && businessData.targetCustomers.length > 0 
                                                ? businessData.targetCustomers[0] 
                                                : "Professional business owners and entrepreneurs"}
                                        </p>
                                     </div>
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </main>

            {/* --- AI Success Coach --- */}
            {aiCoach.show && (
                <div className="fixed bottom-6 right-6 max-w-sm w-full z-50 animate-slideUp">
                    <div className="rounded-xl shadow-xl border overflow-hidden" style={{backgroundColor: theme.colors.white, borderColor: theme.colors.borderLight}}>
                         <div className="p-4 flex items-center justify-between" style={{ background: theme.gradients.primary }}>
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-white" />
                                <span className="font-semibold text-white">AI Success Coach</span>
                            </div>
                            <button onClick={() => setAiCoach({ ...aiCoach, show: false })} className="text-white/80 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4">
                            <p className="text-sm leading-relaxed" style={{color: theme.colors.textGray}}>{aiCoach.message}</p>
                            <button onClick={() => setAiCoach({ ...aiCoach, show: false })} className="mt-4 w-full text-white font-bold py-2 px-4 rounded-lg" style={{background: theme.colors.primary}}>
                                Got it!
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Re-usable CSS animations */}
            <style jsx>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fadeIn { animation: fadeIn 0.6s ease-out forwards; }
                .animate-slideUp { animation: slideUp 0.5s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default LaunchflyDashboard;