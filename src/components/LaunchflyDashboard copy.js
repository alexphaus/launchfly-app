import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ChevronRight, Globe, DollarSign, Users, Rocket, Check, TrendingUp, Sparkles, Clock, X, AlertCircle, MessageSquare, LayoutGrid, List, Settings, Bot } from 'lucide-react';
import GrowthInsights from './GrowthInsights';

// --- DESIGN SYSTEM ---
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
    orange: '#f59e0b',
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

// --- SUB-COMPONENT: Generation Loader ---
const GenerationLoader = ({ progress, stageMessage }) => {
    const steps = useMemo(() => [
        { id: 'analyzing', text: 'Analyzing your skills & goals' },
        { id: 'researching', text: 'Researching profitable niches' },
        { id: 'building', text: 'Building your business & website' },
        { id: 'finalizing', text: 'Finalizing marketing campaigns' },
    ], []);

    const currentStepIndex = useMemo(() => {
        const stageOrder = ['analyzing', 'researching', 'building', 'finalizing', 'complete'];
        const index = stageOrder.indexOf(stageMessage);
        return index;
    }, [stageMessage]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4" style={{ color: theme.colors.textDark, background: theme.colors.bgLight }}>
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

// --- SUB-COMPONENT: Onboarding Checklist ---
const LaunchChecklist = ({ businessData, onStepComplete }) => {
    const steps = [
        { id: 1, title: "Activate Payments", description: "Connect Stripe to start accepting payments.", buttonText: "Connect Stripe", icon: "💳" },
        { id: 2, title: "Launch Your Business", description: "Go live! Our AI will start finding customers.", buttonText: "Activate Business", icon: "🚀" }
    ];

    return (
        <div className="bg-white rounded-2xl p-6 md:p-8" style={{ boxShadow: theme.shadows.lg }}>
            <h3 className="text-2xl font-extrabold mb-2" style={{ color: theme.colors.textDark }}>Your 2-Step Launch Plan</h3>
            <p className="text-gray-500 mb-6">Complete these steps to start making money.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {steps.map((step) => (
                    <div key={step.id} className="p-6 rounded-xl border border-gray-200">
                        <div className="text-4xl mb-4">{step.icon}</div>
                        <h4 className="text-lg font-bold mb-2" style={{ color: theme.colors.textDark }}>{step.title}</h4>
                        <p className="text-sm mb-5 min-h-[40px]" style={{ color: theme.colors.textGray }}>{step.description}</p>
                        <button
                            onClick={() => onStepComplete(step.id)}
                            className="w-full text-white font-bold py-3 px-4 rounded-lg transition-all"
                            style={{ background: theme.colors.primary, boxShadow: theme.shadows.md }}
                        >
                            {step.buttonText}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: Mission Control Header ---
const MissionControlHeader = ({ businessName, userName }) => (
    <header className="bg-white/80 backdrop-blur-lg border-b sticky top-0 z-50" style={{ borderColor: theme.colors.borderLight }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-20">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🚀</span>
                    <div>
                        <span className="text-lg font-extrabold block" style={{ color: theme.colors.textDark }}>{businessName}</span>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs" style={{color: theme.colors.textGray}}>AI Status: Live & Optimizing</span>
                        </div>
                    </div>
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
);

// --- SUB-COMPONENT: Money Bar ---
const MoneyBar = ({ totalRevenue, payoutBalance }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: theme.shadows.lg }}>
            <h4 className="text-sm font-medium mb-2" style={{ color: theme.colors.textGray }}>Total Revenue</h4>
            <p className="text-4xl font-black" style={{ color: theme.colors.textDark }}>${totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: theme.shadows.lg }}>
            <h4 className="text-sm font-medium mb-2" style={{ color: theme.colors.textGray }}>Available for Payout</h4>
            <p className="text-4xl font-black" style={{ color: theme.colors.success }}>${payoutBalance.toLocaleString()}</p>
        </div>
        <div className="bg-green-500 rounded-2xl p-6 flex items-center justify-center text-white font-bold text-xl cursor-pointer hover:bg-green-600 transition-all" style={{ boxShadow: theme.shadows.lg }}>
            <DollarSign className="w-6 h-6 mr-2" />
            Cash Out Now
        </div>
    </div>
);

// --- SUB-COMPONENT: Tabbed Command Center ---
const TabbedCommandCenter = ({ activeTab, setActiveTab, businessData }) => {
    const tabs = [
        { name: 'Sales', icon: DollarSign },
        { name: 'Products', icon: List },
        { name: 'Growth', icon: TrendingUp },
        { name: 'Settings', icon: Settings },
    ];

    return (
        <div className="bg-white rounded-2xl" style={{ boxShadow: theme.shadows.lg }}>
            <div className="border-b" style={{ borderColor: theme.colors.borderLight }}>
                <nav className="flex gap-2 p-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.name}
                            onClick={() => setActiveTab(tab.name.toLowerCase())}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${activeTab === tab.name.toLowerCase() ? 'text-white' : ''}`}
                            style={{
                                background: activeTab === tab.name.toLowerCase() ? theme.colors.primary : 'transparent',
                                color: activeTab === tab.name.toLowerCase() ? theme.colors.white : theme.colors.textGray,
                            }}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.name}
                        </button>
                    ))}
                </nav>
            </div>
            <div className="p-6">
                {activeTab === 'sales' && <SalesView sales={businessData.sales} />}
                {activeTab === 'products' && <ProductsView products={businessData.products} />}
                {activeTab === 'growth' && <GrowthView growthData={businessData.growthMetrics} />}
                {activeTab === 'settings' && <SettingsView />}
            </div>
        </div>
    );
};

// --- TAB VIEWS ---
const SalesView = ({ sales }) => (
    <div>
        <h3 className="text-lg font-bold mb-4">Recent Sales</h3>
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className="text-left" style={{color: theme.colors.textGray}}>
                    <tr>
                        <th className="p-2">Customer</th>
                        <th className="p-2">Product</th>
                        <th className="p-2">Amount</th>
                        <th className="p-2">Date</th>
                    </tr>
                </thead>
                <tbody>
                    {sales.map(sale => (
                        <tr key={sale.id} className="border-b" style={{borderColor: theme.colors.borderLight}}>
                            <td className="p-2 font-medium" style={{color: theme.colors.textDark}}>{sale.customer}</td>
                            <td className="p-2">{sale.product}</td>
                            <td className="p-2 font-medium" style={{color: theme.colors.success}}>${sale.amount}</td>
                            <td className="p-2">{sale.date}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const ProductsView = ({ products }) => (
    <div>
        <h3 className="text-lg font-bold mb-4">Your Products</h3>
        {products.map(product => (
            <div key={product.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-50">
                <div>
                    <p className="font-bold">{product.name}</p>
                    <p className="text-sm" style={{color: theme.colors.textGray}}>{product.description}</p>
                </div>
                <div className="flex items-center gap-4">
                    <p className="font-bold text-lg" style={{color: theme.colors.primary}}>${product.price}</p>
                    <button className="px-3 py-1 text-sm font-semibold rounded-md border" style={{borderColor: theme.colors.borderLight}}>Edit</button>
                </div>
            </div>
        ))}
    </div>
);

const GrowthView = ({ growthData }) => (
    <div>
        <h3 className="text-lg font-bold mb-4">Growth & Insights</h3>
        <p style={{color: theme.colors.textGray}}>AI-powered growth analytics will appear here once you have more data.</p>
        {/* Placeholder for GrowthInsights component */}
    </div>
);

const SettingsView = () => (
    <div>
        <h3 className="text-lg font-bold mb-4">Settings</h3>
        <p style={{color: theme.colors.textGray}}>Manage your business details and integrations here.</p>
    </div>
);

// --- SUB-COMPONENT: AI Co-Pilot ---
const AICoPilot = ({ onAsk }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');

    const handleSend = () => {
        if (message.trim()) {
            onAsk(message);
            setMessage('');
            setIsOpen(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-110 transition-transform"
                style={{ background: theme.gradients.primary }}
            >
                <Bot className="w-8 h-8" />
            </button>
            {isOpen && (
                <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setIsOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-slideUp" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2"><Bot className="w-5 h-5" style={{color: theme.colors.primary}}/> AI Co-Pilot</h3>
                            <button onClick={() => setIsOpen(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-sm mb-4" style={{color: theme.colors.textGray}}>What would you like to change or know? (e.g., "Change my product price to $129")</p>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            className="w-full p-2 border rounded-lg mb-4"
                            style={{borderColor: theme.colors.borderLight}}
                            placeholder="Type your command..."
                            rows={3}
                        />
                        <button
                            onClick={handleSend}
                            className="w-full text-white font-bold py-3 px-4 rounded-lg"
                            style={{ background: theme.colors.primary }}
                        >
                            Send to AI
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};


// --- MAIN DASHBOARD COMPONENT ---
const LaunchflyDashboard = ({ session, business, onPhoneCapture, onStepComplete }) => {
    // --- State Management ---
    const stage = session?.stage || 'analyzing';
    const userName = session?.userData?.name || business?.form_data?.name || 'there';
    const [showBusiness, setShowBusiness] = useState(false);
    const [isOnboarding, setIsOnboarding] = useState(true);
    const [activeTab, setActiveTab] = useState('sales');

    // --- Data Memos & Mock Data ---
    const businessData = useMemo(() => {
        const baseData = business?.business_data || {};
        return {
            businessName: business?.name || "Your AI Business",
            ...baseData,
            // Mock data for demonstration
            sales: [
                { id: 1, customer: 'Jane Doe', product: 'Premium Package', amount: 199, date: '2025-08-02' },
                { id: 2, customer: 'John Smith', product: 'Starter Kit', amount: 99, date: '2025-08-01' },
            ],
            products: baseData.products || [{ id: 1, name: "AI-Generated Product", price: "99", description: "High-value product tailored to your niche." }],
            totalRevenue: business?.total_revenue || 298,
            payoutBalance: 250,
        };
    }, [business]);

    // --- Effects ---
    useEffect(() => {
        // Automatically show business dashboard if generation is complete
        if (stage === 'complete' && business?.business_data) {
            setShowBusiness(true);
        }
        // Check if onboarding is complete (e.g., based on a flag in Supabase)
        if (business?.completed_onboarding) {
            setIsOnboarding(false);
        }
    }, [stage, business]);

    // --- Handlers ---
    const handleOnboardingStep = (stepId) => {
        console.log(`Completed onboarding step: ${stepId}`);
        // In a real app, you'd update Supabase here
        if (onStepComplete) onStepComplete(stepId);
        
        // For demo, assume onboarding is done after the last step
        if (stepId === 2) {
            setIsOnboarding(false);
        }
    };

    const handleAICoPilotAsk = (message) => {
        console.log("AI Co-Pilot asked:", message);
        // Here you would send the message to your backend/AI orchestrator
    };

    // --- Render Logic ---
    if (!showBusiness) {
        return <GenerationLoader progress={session?.progress || 0} stageMessage={stage} />;
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: theme.colors.bgLight }}>
            <MissionControlHeader businessName={businessData.businessName} userName={userName} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                <div className="space-y-8 animate-fadeIn">
                    {isOnboarding ? (
                        <LaunchChecklist businessData={businessData} onStepComplete={handleOnboardingStep} />
                    ) : (
                        <>
                            <MoneyBar totalRevenue={businessData.totalRevenue} payoutBalance={businessData.payoutBalance} />
                            <TabbedCommandCenter activeTab={activeTab} setActiveTab={setActiveTab} businessData={businessData} />
                        </>
                    )}
                </div>
            </main>

            <AICoPilot onAsk={handleAICoPilotAsk} />
            
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