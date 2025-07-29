// components/FutureProofDashboard.js
// New dashboard focused on business success rather than just website generation

'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Target,
  CheckCircle,
  AlertCircle,
  BarChart3,
  PieChart,
  Calendar,
  Phone,
  MessageSquare,
  Sparkles,
  Rocket,
  Shield,
  Clock
} from 'lucide-react';

const theme = {
  colors: {
    primary: '#007BFF',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    white: '#ffffff',
    borderLight: '#E4E7EB',
  },
  shadows: {
    md: '0 4px 8px -2px rgba(26, 43, 72, 0.1)',
    lg: '0 12px 20px -4px rgba(26, 43, 72, 0.1)',
  },
  gradients: {
    primary: 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)',
    success: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
  }
};

// Success Metrics Component
const SuccessMetrics = ({ businessData }) => {
  const metrics = useMemo(() => {
    const opportunity = businessData?.opportunity || {};
    const successPlan = businessData?.successPlan || {};
    
    return [
      {
        label: 'Market Size',
        value: opportunity.marketSize || '$2.5B market',
        icon: TrendingUp,
        color: theme.colors.primary
      },
      {
        label: 'Revenue Target',
        value: successPlan.revenue_milestones?.[0]?.target ? `$${successPlan.revenue_milestones[0].target}` : '$1,000',
        icon: DollarSign,
        color: theme.colors.success
      },
      {
        label: 'Time to Revenue',
        value: opportunity.timeToRevenue || '30 days',
        icon: Clock,
        color: theme.colors.warning
      },
      {
        label: 'Success Score',
        value: '95%',
        icon: Target,
        color: theme.colors.primary
      }
    ];
  }, [businessData]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {metrics.map((metric, index) => (
        <div 
          key={index}
          className="bg-white p-4 rounded-xl border"
          style={{ boxShadow: theme.shadows.md, borderColor: theme.colors.borderLight }}
        >
          <div className="flex items-center justify-between mb-2">
            <metric.icon className="w-5 h-5" style={{ color: metric.color }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: theme.colors.textDark }}>
            {metric.value}
          </p>
          <p className="text-sm" style={{ color: theme.colors.textGray }}>
            {metric.label}
          </p>
        </div>
      ))}
    </div>
  );
};

// Business Intelligence Panel
const BusinessIntelligence = ({ businessData }) => {
  const opportunity = businessData?.opportunity || {};
  const validation = businessData?.validation || {};

  return (
    <div className="bg-white rounded-xl p-6 mb-8" style={{ boxShadow: theme.shadows.lg }}>
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: theme.colors.textDark }}>
        <Sparkles className="w-5 h-5" style={{ color: theme.colors.primary }} />
        AI Market Intelligence
      </h3>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-semibold mb-3" style={{ color: theme.colors.textDark }}>
            Your Opportunity
          </h4>
          <div className="space-y-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: theme.colors.bgLight }}>
              <p className="font-medium text-sm" style={{ color: theme.colors.textDark }}>
                Niche: {opportunity.niche || 'Premium fitness coaching'}
              </p>
              <p className="text-sm" style={{ color: theme.colors.textGray }}>
                {opportunity.profitability || 'High-margin service business'}
              </p>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: theme.colors.bgLight }}>
              <p className="font-medium text-sm" style={{ color: theme.colors.textDark }}>
                Skills Match: {opportunity.skillsMatch || '92% alignment'}
              </p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-3" style={{ color: theme.colors.textDark }}>
            Market Validation
          </h4>
          <div className="space-y-3">
            {(validation.demandSignals || [
              'High search volume for fitness coaching',
              'Competitors earning $5k-15k/month',
              'Growing market trend'
            ]).map((signal, index) => (
              <div key={index} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" style={{ color: theme.colors.success }} />
                <span className="text-sm" style={{ color: theme.colors.textGray }}>
                  {signal}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Customer Acquisition Plan
const CustomerAcquisitionPlan = ({ businessData }) => {
  const customerPlan = businessData?.customerPlan || {};
  const channels = customerPlan.channels || {};

  return (
    <div className="bg-white rounded-xl p-6 mb-8" style={{ boxShadow: theme.shadows.lg }}>
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: theme.colors.textDark }}>
        <Users className="w-5 h-5" style={{ color: theme.colors.primary }} />
        Customer Acquisition System
      </h3>

      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <h4 className="font-semibold mb-3" style={{ color: theme.colors.textDark }}>
            Primary Channel
          </h4>
          <div className="p-4 rounded-lg border-2" style={{ borderColor: theme.colors.primary }}>
            <p className="font-medium" style={{ color: theme.colors.primary }}>
              {channels.primary || 'Instagram + DM outreach'}
            </p>
            <p className="text-sm mt-1" style={{ color: theme.colors.textGray }}>
              70% of marketing budget
            </p>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-3" style={{ color: theme.colors.textDark }}>
            Secondary Channel
          </h4>
          <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.bgLight }}>
            <p className="font-medium" style={{ color: theme.colors.textDark }}>
              {channels.secondary || 'Email marketing'}
            </p>
            <p className="text-sm mt-1" style={{ color: theme.colors.textGray }}>
              20% of marketing budget
            </p>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-3" style={{ color: theme.colors.textDark }}>
            Testing Channel
          </h4>
          <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.bgLight }}>
            <p className="font-medium" style={{ color: theme.colors.textDark }}>
              {channels.testing || 'TikTok content'}
            </p>
            <p className="text-sm mt-1" style={{ color: theme.colors.textGray }}>
              10% of marketing budget
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Success Milestones
const SuccessMilestones = ({ businessData }) => {
  const milestones = businessData?.successPlan?.revenue_milestones || [
    { month: 1, target: 1000, strategy: "Launch and first customers" },
    { month: 3, target: 5000, strategy: "Scale customer acquisition" },
    { month: 6, target: 10000, strategy: "Optimize and systematize" }
  ];

  return (
    <div className="bg-white rounded-xl p-6 mb-8" style={{ boxShadow: theme.shadows.lg }}>
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: theme.colors.textDark }}>
        <Target className="w-5 h-5" style={{ color: theme.colors.primary }} />
        Success Roadmap
      </h3>

      <div className="space-y-4">
        {milestones.map((milestone, index) => (
          <div key={index} className="flex items-center gap-4 p-4 rounded-lg" style={{ backgroundColor: theme.colors.bgLight }}>
            <div className="flex-shrink-0">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                style={{ background: index === 0 ? theme.gradients.primary : theme.colors.borderLight }}
              >
                M{milestone.month}
              </div>
            </div>
            <div className="flex-grow">
              <p className="font-semibold" style={{ color: theme.colors.textDark }}>
                ${milestone.target.toLocaleString()} Revenue Target
              </p>
              <p className="text-sm" style={{ color: theme.colors.textGray }}>
                {milestone.strategy}
              </p>
            </div>
            {index === 0 && (
              <div className="flex-shrink-0">
                <span className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: theme.colors.primary }}>
                  Current
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Success Guarantee
const SuccessGuarantee = ({ businessData }) => {
  const guarantee = businessData?.successPlan?.guarantee || {};

  return (
    <div className="rounded-xl p-6 text-white mb-8" style={{ background: theme.gradients.primary, boxShadow: theme.shadows.lg }}>
      <div className="flex items-center gap-4">
        <Shield className="w-12 h-12" />
        <div>
          <h3 className="text-2xl font-bold mb-2">Success Partnership Guarantee</h3>
          <p className="opacity-90">
            {guarantee.terms || "We don't profit until you profit. Our success is tied to your success."}
          </p>
          <p className="text-sm opacity-80 mt-2">
            {guarantee.protection || "Full refund + compensation if you don't hit your first milestone"}
          </p>
        </div>
      </div>
    </div>
  );
};

// Main Dashboard Component
const FutureProofDashboard = ({ session, business, onPhoneCapture, onStepComplete }) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const businessData = business?.business_data || {};
  const stage = session?.stage || 'pending';

  useEffect(() => {
    if (stage === 'complete' && businessData) {
      setLoading(false);
    }
  }, [stage, businessData]);

  if (loading || stage !== 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.colors.bgLight }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full animate-pulse mb-4 mx-auto" style={{ background: theme.gradients.primary }}>
            <Sparkles className="w-8 h-8 text-white m-4" />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: theme.colors.textDark }}>
            AI is analyzing your market opportunity...
          </h2>
          <p style={{ color: theme.colors.textGray }}>
            Building your intelligent business success system
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.bgLight }}>
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50" style={{ borderColor: theme.colors.borderLight }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-bold" style={{ color: theme.colors.textDark }}>
                {businessData.businessName || businessData.opportunity?.niche || 'Your Business'}
              </h1>
              <p className="text-sm" style={{ color: theme.colors.textGray }}>
                AI-Powered Success System
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button className="px-4 py-2 rounded-lg text-white font-medium" style={{ background: theme.gradients.primary }}>
                View Live Site
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Metrics */}
        <SuccessMetrics businessData={businessData} />

        {/* Success Guarantee */}
        <SuccessGuarantee businessData={businessData} />

        {/* Business Intelligence */}
        <BusinessIntelligence businessData={businessData} />

        {/* Customer Acquisition Plan */}
        <CustomerAcquisitionPlan businessData={businessData} />

        {/* Success Roadmap */}
        <SuccessMilestones businessData={businessData} />

        {/* Legacy website data (for backward compatibility) */}
        {businessData.products && (
          <div className="bg-white rounded-xl p-6" style={{ boxShadow: theme.shadows.lg }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: theme.colors.textDark }}>
              Your Products & Services
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              {businessData.products.map((product, index) => (
                <div key={index} className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.bgLight }}>
                  <h4 className="font-semibold" style={{ color: theme.colors.textDark }}>
                    {product.name}
                  </h4>
                  <p className="text-lg font-bold" style={{ color: theme.colors.primary }}>
                    {product.price}
                  </p>
                  <p className="text-sm" style={{ color: theme.colors.textGray }}>
                    {product.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default FutureProofDashboard;
