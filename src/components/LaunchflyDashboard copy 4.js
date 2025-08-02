import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { 
  ChevronRight, Globe, DollarSign, Users, Rocket, Check, TrendingUp, Sparkles, Clock, X, 
  AlertCircle, MessageSquare, LayoutGrid, List, Settings, Bot, Inbox, Target, Mail,
  Zap, Trophy, Bell, MapPin, Timer, Eye, ShoppingCart, ArrowUp, Star, Activity,
  TrendingDown, Award, Send, Calendar, Filter, RefreshCw, ExternalLink, Share2,
  CreditCard, Package, UserCheck, ArrowRight
} from 'lucide-react';
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
    warning: '#ffc107',
    orange: '#f59e0b',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(26, 43, 72, 0.05)',
    md: '0 4px 8px -2px rgba(26, 43, 72, 0.1), 0 2px 4px -2px rgba(26, 43, 72, 0.06)',
    lg: '0 12px 20px -4px rgba(26, 43, 72, 0.1), 0 4px 6px -4px rgba(26, 43, 72, 0.05)',
    xl: '0 24px 32px -8px rgba(26, 43, 72, 0.12), 0 10px 12px -6px rgba(26, 43, 72, 0.08)',
  },
  gradients: {
    primary: 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)',
    success: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
    warning: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)',
  }
};

// --- SUB-COMPONENT: Generation Loader ---
const GenerationLoader = ({ progress, stageMessage }) => {
    const steps = useMemo(() => [
        { id: 'analyzing', text: 'Analyzing your skills & goals', icon: '🔍' },
        { id: 'researching', text: 'Researching profitable niches', icon: '📊' },
        { id: 'building', text: 'Building your business & website', icon: '🏗️' },
        { id: 'finalizing', text: 'Finalizing marketing campaigns', icon: '🚀' },
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
                    <Sparkles className="w-14 h-14 text-white animate-spin-slow" />
                </div>
            </div>
            <h2 className="text-3xl font-black mb-3 text-center" style={{ color: theme.colors.textDark }}>Crafting Your Business</h2>
            <p className="text-lg text-center max-w-md mb-8" style={{ color: theme.colors.textGray }}>The AI is working its magic. Your business will be ready in moments.</p>

            <div className="w-full max-w-md space-y-3">
                {steps.map((step, index) => (
                    <div
                        key={step.id}
                        className={`flex items-center p-4 rounded-lg transition-all duration-500 ${
                            index < currentStepIndex ? 'bg-green-100' : 
                            index === currentStepIndex ? 'bg-blue-100 scale-105' : 
                            'bg-gray-100'
                        }`}
                    >
                        <div className="text-2xl mr-3">{step.icon}</div>
                        <div className="flex-1">
                            <span className={`font-medium ${
                                index < currentStepIndex ? 'text-green-800' : 
                                index === currentStepIndex ? 'text-blue-800' : 
                                'text-gray-700'
                            }`}>{step.text}</span>
                            {index === currentStepIndex && (
                                <div className="mt-1 text-xs text-blue-600">Processing...</div>
                            )}
                        </div>
                        <div className="w-6 h-6 flex items-center justify-center">
                            {index < currentStepIndex ? (
                                <Check className="w-5 h-5 text-green-500" />
                            ) : index === currentStepIndex ? (
                                <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
                            ) : (
                                <Clock className="w-5 h-5 text-gray-400" />
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 text-center">
                <p className="text-sm" style={{ color: theme.colors.textGray }}>
                    Did you know? 73% of Launchfly businesses make their first sale within 48 hours!
                </p>
            </div>
        </div>
    );
};

// --- NEW COMPONENT: Hot Leads Widget ---
const HotLeadsWidget = ({ leads, onContactLead }) => {
    const mockLeads = leads?.length > 0 ? leads : [
        { id: 1, name: 'Anonymous', company: 'TechCorp (detected)', location: 'San Francisco, CA', timeOnSite: '5:23', pagesViewed: ['Pricing', 'Features'], score: 85, status: 'hot' },
        { id: 2, name: 'Anonymous', company: null, location: 'New York, NY', timeOnSite: '2:45', pagesViewed: ['Home'], score: 45, status: 'warm' },
        { id: 3, email: 'sarah@example.com', name: 'Sarah M.', location: 'Austin, TX', timeOnSite: '8:12', pagesViewed: ['Pricing', 'Checkout'], score: 95, status: 'hot', inCheckout: true },
    ];

    return (
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: theme.shadows.lg }}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <Eye className="w-5 h-5" style={{ color: theme.colors.primary }} />
                    Hot Leads Right Now
                </h3>
                <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 animate-pulse">
                    {mockLeads.filter(l => l.status === 'hot').length} Active
                </span>
            </div>
            
            <div className="space-y-3">
                {mockLeads.map(lead => (
                    <div key={lead.id} className={`p-4 rounded-lg border-2 transition-all hover:scale-[1.02] ${
                        lead.status === 'hot' ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                    }`}>
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold">
                                        {lead.email || lead.company || 'Visitor'}
                                    </span>
                                    {lead.inCheckout && (
                                        <span className="text-xs px-2 py-0.5 bg-green-500 text-white rounded-full animate-pulse">
                                            In Checkout!
                                        </span>
                                    )}
                                    {lead.score > 80 && (
                                        <span className="text-xs">🔥</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-xs" style={{ color: theme.colors.textGray }}>
                                    <span className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {lead.location}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Timer className="w-3 h-3" />
                                        {lead.timeOnSite}
                                    </span>
                                </div>
                                <div className="mt-1 text-xs">
                                    Viewed: {lead.pagesViewed.join(' → ')}
                                </div>
                            </div>
                            <button
                                onClick={() => onContactLead(lead)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-md text-white transition-all hover:scale-105"
                                style={{ background: theme.colors.primary }}
                            >
                                <Mail className="w-3 h-3 inline mr-1" />
                                Contact
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="mt-4 pt-4 border-t text-center">
                <p className="text-xs" style={{ color: theme.colors.textGray }}>
                    💡 Tip: Visitors who view pricing are 3x more likely to buy
                </p>
            </div>
        </div>
    );
};

// --- NEW COMPONENT: Money Pipeline ---
const MoneyPipeline = ({ pipeline }) => {
    const mockPipeline = pipeline || {
        currentRevenue: 847,
        activeCheckouts: 3,
        activeCheckoutValue: 597,
        abandonedCarts: 2,
        abandonedValue: 298,
        projectedNext7Days: 2341,
        projectedNext30Days: 8923,
        nextMilestone: 1000,
        progressToMilestone: 84.7
    };

    return (
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: theme.shadows.lg }}>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5" style={{ color: theme.colors.success }} />
                Your Money Pipeline
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center p-4 rounded-lg bg-green-50">
                    <p className="text-3xl font-black" style={{ color: theme.colors.success }}>
                        ${mockPipeline.currentRevenue}
                    </p>
                    <p className="text-xs" style={{ color: theme.colors.textGray }}>Current Revenue</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-blue-50">
                    <p className="text-3xl font-black" style={{ color: theme.colors.primary }}>
                        ${mockPipeline.projectedNext7Days}
                    </p>
                    <p className="text-xs" style={{ color: theme.colors.textGray }}>Next 7 Days</p>
                </div>
            </div>

            {/* Active Opportunities */}
            <div className="space-y-3 mb-4">
                {mockPipeline.activeCheckouts > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-orange-600" />
                            <span className="text-sm font-medium">
                                {mockPipeline.activeCheckouts} people in checkout
                            </span>
                        </div>
                        <span className="font-bold text-orange-600">
                            ${mockPipeline.activeCheckoutValue}
                        </span>
                    </div>
                )}
                
                {mockPipeline.abandonedCarts > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-yellow-600" />
                            <span className="text-sm font-medium">
                                {mockPipeline.abandonedCarts} abandoned carts
                            </span>
                        </div>
                        <button className="text-xs font-semibold text-yellow-700 hover:text-yellow-800">
                            Recover ${mockPipeline.abandonedValue} →
                        </button>
                    </div>
                )}
            </div>

            {/* Milestone Progress */}
            <div className="pt-4 border-t">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-medium">
                        ${mockPipeline.currentRevenue} / ${mockPipeline.nextMilestone}
                    </span>
                    <span className="text-xs" style={{ color: theme.colors.textGray }}>
                        ${mockPipeline.nextMilestone - mockPipeline.currentRevenue} to go!
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                            width: `${mockPipeline.progressToMilestone}%`,
                            background: theme.gradients.success 
                        }}
                    />
                </div>
                <p className="text-xs mt-2 text-center" style={{ color: theme.colors.textGray }}>
                    🎯 Next milestone: First $1,000 month!
                </p>
            </div>
        </div>
    );
};

// --- NEW COMPONENT: Quick Actions ---
const QuickActions = ({ onAction }) => {
    const actions = [
        { 
            id: 'social', 
            icon: Share2, 
            label: 'Share on Social', 
            impact: '+15 visitors today',
            color: '#1877f2',
            description: 'Pre-written posts ready to copy'
        },
        { 
            id: 'email', 
            icon: Send, 
            label: 'Email Hot Leads', 
            impact: '+$200 potential',
            color: theme.colors.success,
            description: '3 warm leads to contact'
        },
        { 
            id: 'sale', 
            icon: Zap, 
            label: 'Run Flash Sale', 
            impact: '+$500 this week',
            color: theme.colors.orange,
            description: '20% off for 48 hours'
        },
        { 
            id: 'price', 
            icon: Target, 
            label: 'Test New Price', 
            impact: '+30% revenue',
            color: theme.colors.primary,
            description: 'A/B test higher pricing'
        }
    ];

    return (
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: theme.shadows.lg }}>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5" style={{ color: theme.colors.orange }} />
                Quick Actions
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {actions.map(action => (
                    <button
                        key={action.id}
                        onClick={() => onAction(action)}
                        className="p-4 rounded-lg border-2 text-left transition-all hover:scale-[1.02] hover:border-opacity-100"
                        style={{ borderColor: action.color + '40' }}
                    >
                        <div className="flex items-start gap-3">
                            <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: action.color + '20' }}
                            >
                                <action.icon className="w-5 h-5" style={{ color: action.color }} />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-sm">{action.label}</p>
                                <p className="text-xs" style={{ color: theme.colors.textGray }}>
                                    {action.description}
                                </p>
                                <p className="text-xs font-semibold mt-1" style={{ color: action.color }}>
                                    {action.impact}
                                </p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

// --- NEW COMPONENT: Smart Notifications ---
const SmartNotifications = ({ notifications, onAction }) => {
    const mockNotifications = notifications || [
        {
            id: 1,
            type: 'urgent',
            icon: '🔥',
            title: 'Someone from Google is on your site NOW',
            action: 'View Details',
            time: 'Just now'
        },
        {
            id: 2,
            type: 'money',
            icon: '💰',
            title: 'Cart abandoned 2 hours ago - $199 potential',
            action: 'Send Recovery Email',
            time: '2 hours ago'
        },
        {
            id: 3,
            type: 'insight',
            icon: '📈',
            title: 'Traffic spike detected - 5x normal visitors',
            action: 'Boost Capacity',
            time: '30 min ago'
        },
        {
            id: 4,
            type: 'opportunity',
            icon: '🎯',
            title: 'Your competitor just raised prices by 25%',
            action: 'See Opportunity',
            time: '1 hour ago'
        }
    ];

    const getTypeStyles = (type) => {
        switch(type) {
            case 'urgent': return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' };
            case 'money': return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' };
            case 'insight': return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' };
            case 'opportunity': return { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' };
            default: return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' };
        }
    };

    return (
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: theme.shadows.lg }}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <Bell className="w-5 h-5" style={{ color: theme.colors.primary }} />
                    Smart Alerts
                </h3>
                <span className="text-xs px-2 py-1 rounded-full bg-red-500 text-white">
                    {mockNotifications.length} New
                </span>
            </div>
            
            <div className="space-y-3">
                {mockNotifications.map(notification => {
                    const styles = getTypeStyles(notification.type);
                    return (
                        <div
                            key={notification.id}
                            className={`p-3 rounded-lg border ${styles.bg} ${styles.border} ${
                                notification.type === 'urgent' ? 'animate-pulse' : ''
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">{notification.icon}</span>
                                <div className="flex-1">
                                    <p className="text-sm font-medium mb-1">{notification.title}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs" style={{ color: theme.colors.textGray }}>
                                            {notification.time}
                                        </span>
                                        <button
                                            onClick={() => onAction(notification)}
                                            className={`text-xs font-semibold ${styles.text} hover:underline`}
                                        >
                                            {notification.action} →
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- NEW COMPONENT: Success Roadmap ---
const SuccessRoadmap = ({ currentStage, completedSteps }) => {
    const stages = [
        {
            id: 'launch',
            name: 'Launch',
            milestone: 'Business Live',
            tasks: ['Website active', 'Products listed', 'Payment ready'],
            timeEstimate: 'Day 1',
            icon: Rocket,
            completed: true
        },
        {
            id: 'momentum',
            name: 'Building Momentum',
            milestone: 'First $100',
            tasks: ['Share on social', 'Email 10 people', 'Run first ad'],
            timeEstimate: '2-3 days',
            icon: TrendingUp,
            completed: currentStage > 1
        },
        {
            id: 'growth',
            name: 'Growth Mode',
            milestone: 'First $1,000',
            tasks: ['Optimize pricing', 'Add testimonials', 'Scale ads'],
            timeEstimate: '2-3 weeks',
            icon: Target,
            completed: currentStage > 2
        },
        {
            id: 'scale',
            name: 'Scaling Up',
            milestone: '$5,000/month',
            tasks: ['Hire VA', 'Launch new products', 'Build email list'],
            timeEstimate: '2-3 months',
            icon: Trophy,
            completed: currentStage > 3
        }
    ];

    const currentStageIndex = Math.min(currentStage || 1, stages.length - 1);

    return (
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: theme.shadows.lg }}>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" style={{ color: theme.colors.primary }} />
                Your Success Roadmap
            </h3>
            
            <div className="relative">
                {/* Progress Line */}
                <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-gray-200"></div>
                <div 
                    className="absolute left-5 top-8 w-0.5 bg-blue-500 transition-all duration-500"
                    style={{ height: `${(currentStageIndex / (stages.length - 1)) * 100}%` }}
                ></div>
                
                {/* Stages */}
                <div className="space-y-8">
                    {stages.map((stage, index) => {
                        const Icon = stage.icon;
                        const isActive = index === currentStageIndex;
                        const isCompleted = index < currentStageIndex;
                        
                        return (
                            <div key={stage.id} className="relative flex gap-4">
                                <div className={`
                                    w-10 h-10 rounded-full flex items-center justify-center z-10
                                    ${isCompleted ? 'bg-green-500' : isActive ? 'bg-blue-500' : 'bg-gray-300'}
                                    ${isActive ? 'scale-125 shadow-lg' : ''}
                                    transition-all duration-300
                                `}>
                                    {isCompleted ? (
                                        <Check className="w-5 h-5 text-white" />
                                    ) : (
                                        <Icon className="w-5 h-5 text-white" />
                                    )}
                                </div>
                                
                                <div className={`flex-1 pb-8 ${isActive ? '' : 'opacity-60'}`}>
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h4 className="font-bold">{stage.name}</h4>
                                            <p className="text-sm font-semibold" style={{ color: theme.colors.primary }}>
                                                {stage.milestone}
                                            </p>
                                        </div>
                                        <span className="text-xs" style={{ color: theme.colors.textGray }}>
                                            {stage.timeEstimate}
                                        </span>
                                    </div>
                                    
                                    {isActive && (
                                        <div className="mt-3 space-y-2">
                                            {stage.tasks.map((task, taskIndex) => (
                                                <label key={taskIndex} className="flex items-center gap-2 text-sm cursor-pointer">
                                                    <input type="checkbox" className="rounded" />
                                                    <span>{task}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <div className="mt-6 p-4 rounded-lg bg-blue-50">
                <p className="text-sm">
                    <strong>You're in the top 15%!</strong> Most users are still in the Launch phase. 
                    Keep going - you're ahead of the curve! 🎉
                </p>
            </div>
        </div>
    );
};

// --- NEW COMPONENT: AI Business Advisor ---
const AIBusinessAdvisor = ({ insights, onTryThis }) => {
    const mockInsights = insights || {
        daily: {
            icon: '📊',
            title: 'Your best converting day is Tuesday',
            description: 'Schedule important launches and campaigns for Tuesdays',
            action: 'Set Tuesday Reminder'
        },
        opportunity: {
            icon: '💡',
            title: 'Similar businesses charge 30% more',
            description: 'Your pricing may be too low. Consider testing $129 instead of $99',
            action: 'Test Higher Price'
        },
        experiment: {
            icon: '🧪',
            title: 'Add urgency to increase sales',
            description: 'Limited time offers can boost conversions by 25-40%',
            action: 'Create Flash Sale'
        },
        prediction: {
            icon: '🔮',
            title: '82% chance of sale in next 24h',
            description: 'Based on current traffic patterns and lead quality',
            action: 'Prepare Follow-up'
        }
    };

    return (
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: theme.shadows.lg }}>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5" style={{ color: theme.colors.primary }} />
                Your AI Business Advisor
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(mockInsights).map(([key, insight]) => (
                    <div 
                        key={key}
                        className="p-4 rounded-lg border hover:border-blue-300 transition-all"
                        style={{ borderColor: theme.colors.borderLight }}
                    >
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">{insight.icon}</span>
                            <div className="flex-1">
                                <p className="font-semibold text-sm mb-1">{insight.title}</p>
                                <p className="text-xs mb-3" style={{ color: theme.colors.textGray }}>
                                    {insight.description}
                                </p>
                                <button
                                    onClick={() => onTryThis(key, insight)}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-md transition-all hover:scale-105"
                                    style={{ 
                                        background: theme.colors.primary + '20',
                                        color: theme.colors.primary 
                                    }}
                                >
                                    {insight.action} →
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="mt-4 text-center">
                <button className="text-sm font-semibold" style={{ color: theme.colors.primary }}>
                    Ask AI Anything →
                </button>
            </div>
        </div>
    );
};

// --- NEW COMPONENT: Competitive Benchmarking ---
const CompetitiveBenchmarking = ({ metrics }) => {
    const mockMetrics = metrics || {
        conversionRate: { value: 3.2, benchmark: 2.1, percentile: 85 },
        timeToFirstSale: { value: 1, benchmark: 3, percentile: 92 },
        averageOrderValue: { value: 149, benchmark: 127, percentile: 71 },
        visitorToLead: { value: 12, benchmark: 8, percentile: 78 }
    };

    const achievements = [
        { icon: '🏃', name: 'Speed Demon', description: 'First sale in 24 hours' },
        { icon: '👑', name: 'Conversion King', description: 'Top 15% conversion rate' },
        { icon: '🎯', name: 'Sharpshooter', description: '80%+ lead quality score' },
    ];

    return (
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: theme.shadows.lg }}>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5" style={{ color: theme.colors.warning }} />
                How You Compare
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
                {Object.entries(mockMetrics).map(([key, metric]) => {
                    const isAboveBenchmark = metric.value > metric.benchmark;
                    return (
                        <div key={key} className="text-center p-3 rounded-lg bg-gray-50">
                            <p className="text-xs mb-1" style={{ color: theme.colors.textGray }}>
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                            </p>
                            <p className={`text-2xl font-bold ${isAboveBenchmark ? 'text-green-600' : 'text-gray-700'}`}>
                                {metric.value}{key.includes('Rate') ? '%' : key.includes('Time') ? 'd' : ''}
                            </p>
                            <p className="text-xs mt-1">
                                Top {metric.percentile}% {isAboveBenchmark ? '🎉' : ''}
                            </p>
                        </div>
                    );
                })}
            </div>
            
            <div className="border-t pt-4">
                <p className="text-sm font-semibold mb-3">Your Achievements</p>
                <div className="flex flex-wrap gap-2">
                    {achievements.map((achievement, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-2 px-3 py-2 rounded-full bg-yellow-50 border border-yellow-200"
                        >
                            <span className="text-xl">{achievement.icon}</span>
                            <div>
                                <p className="text-xs font-semibold">{achievement.name}</p>
                                <p className="text-xs" style={{ color: theme.colors.textGray }}>
                                    {achievement.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- ENHANCED COMPONENT: Mission Control Header ---
const MissionControlHeader = ({ businessName, userName, siteUrl }) => {
    const [showDropdown, setShowDropdown] = useState(false);
    
    return (
        <header className="bg-white/80 backdrop-blur-lg border-b sticky top-0 z-50" style={{ borderColor: theme.colors.borderLight }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🚀</span>
                        <div>
                            <span className="text-lg font-extrabold block" style={{ color: theme.colors.textDark }}>{businessName}</span>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-xs" style={{color: theme.colors.textGray}}>AI: Active</span>
                                </div>
                                {siteUrl && (
                                    <a 
                                        href={siteUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-xs flex items-center gap-1 hover:text-blue-600"
                                        style={{color: theme.colors.primary}}
                                    >
                                        View Site <ExternalLink className="w-3 h-3" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="p-2 rounded-lg hover:bg-gray-100 relative">
                            <Bell className="w-5 h-5" style={{color: theme.colors.textGray}} />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                        </button>
                        <div className="relative">
                            <button 
                                onClick={() => setShowDropdown(!showDropdown)}
                                className="flex items-center gap-2 text-sm hover:opacity-80"
                            >
                                <span className="hidden sm:block" style={{color: theme.colors.textGray}}>
                                    {userName}
                                </span>
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                                    {userName?.charAt(0).toUpperCase()}
                                </div>
                            </button>
                            {showDropdown && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2">
                                    <a href="#" className="block px-4 py-2 text-sm hover:bg-gray-100">My Account</a>
                                    <a href="#" className="block px-4 py-2 text-sm hover:bg-gray-100">Billing</a>
                                    <a href="#" className="block px-4 py-2 text-sm hover:bg-gray-100">Help Center</a>
                                    <hr className="my-2" />
                                    <a href="#" className="block px-4 py-2 text-sm hover:bg-gray-100">Sign Out</a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

// --- MAIN DASHBOARD COMPONENT ---
const LaunchflyDashboard = ({ session, business, onPhoneCapture, onStepComplete }) => {
    // --- State Management ---
    const stage = session?.stage || 'analyzing';
    const userName = session?.userData?.name || business?.form_data?.name || 'there';
    const [showBusiness, setShowBusiness] = useState(false);
    const [activeView, setActiveView] = useState('overview');
    const [isOnboarding, setIsOnboarding] = useState(true);

    // --- Data Processing ---
    const businessData = useMemo(() => {
        const baseData = business?.business_data || {};
        return {
            businessName: business?.name || "Your AI Business",
            url: business?.subdomain ? `https://${business.subdomain}.launchfly.ai` : null,
            ...baseData,
            totalRevenue: business?.total_revenue || 0,
            views: business?.views || 0,
            firstSaleDate: business?.first_sale_date,
            growthMetrics: baseData.growthMetrics || {},
        };
    }, [business]);

    // --- Effects ---
    useEffect(() => {
        if (stage === 'complete' && business?.business_data) {
            setShowBusiness(true);
        }
        if (business?.completed_onboarding) {
            setIsOnboarding(false);
        }
    }, [stage, business]);

    // --- Handlers ---
    const handleContactLead = (lead) => {
        console.log('Contact lead:', lead);
        // Open email template modal or redirect to email client
    };

    const handleQuickAction = (action) => {
        console.log('Quick action:', action);
        // Handle different actions
    };

    const handleNotificationAction = (notification) => {
        console.log('Notification action:', notification);
        // Handle notification actions
    };

    const handleAIInsight = (key, insight) => {
        console.log('AI insight action:', key, insight);
        // Implement AI suggestions
    };

    // --- Render Logic ---
    if (!showBusiness) {
        return <GenerationLoader progress={session?.progress || 0} stageMessage={stage} />;
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: theme.colors.bgLight }}>
            <MissionControlHeader 
                businessName={businessData.businessName} 
                userName={userName} 
                siteUrl={businessData.url}
            />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* View Toggle */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveView('overview')}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                                activeView === 'overview' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'
                            }`}
                        >
                            <LayoutGrid className="w-4 h-4 inline mr-2" />
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveView('growth')}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                                activeView === 'growth' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'
                            }`}
                        >
                            <TrendingUp className="w-4 h-4 inline mr-2" />
                            Growth Lab
                        </button>
                    </div>
                    <button 
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white font-semibold text-sm hover:bg-gray-50"
                        onClick={() => window.location.reload()}
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>

                {activeView === 'overview' ? (
                    <div className="space-y-6">
                        {/* Row 1: Pipeline & Leads */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <MoneyPipeline pipeline={businessData.pipeline} />
                            <HotLeadsWidget leads={businessData.leads} onContactLead={handleContactLead} />
                        </div>

                        {/* Row 2: Actions & Notifications */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <QuickActions onAction={handleQuickAction} />
                            <SmartNotifications notifications={businessData.notifications} onAction={handleNotificationAction} />
                        </div>

                        {/* Row 3: AI Advisor & Benchmarking */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <AIBusinessAdvisor insights={businessData.aiInsights} onTryThis={handleAIInsight} />
                            <CompetitiveBenchmarking metrics={businessData.benchmarks} />
                        </div>

                        {/* Row 4: Success Roadmap */}
                        <SuccessRoadmap currentStage={2} completedSteps={session?.completed_steps} />
                    </div>
                ) : (
                    <div className="space-y-6">
                        <GrowthInsights businessData={businessData} theme={theme} />
                    </div>
                )}
            </main>

            {/* Floating AI Assistant */}
            <button
                className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-110 transition-transform group"
                style={{ background: theme.gradients.primary }}
            >
                <Bot className="w-7 h-7" />
                <span className="absolute bottom-full mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Ask AI anything
                </span>
            </button>

            <style jsx>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-fadeIn { animation: fadeIn 0.6s ease-out forwards; }
                .animate-slideUp { animation: slideUp 0.5s ease-out forwards; }
                .animate-spin-slow { animation: spin-slow 3s linear infinite; }
            `}</style>
        </div>
    );
};

export default LaunchflyDashboard;