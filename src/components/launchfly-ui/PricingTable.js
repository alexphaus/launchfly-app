'use client';

import { useParams } from 'next/navigation';

export default function PricingTable({ 
  title = "Choose Your Plan",
  subtitle = "Flexible pricing for every need",
  plans = [],
  products = [] // Add support for products
}) {
  const defaultPlans = [
    {
      name: "Starter",
      price: "$99",
      period: "month",
      description: "Perfect for getting started",
      features: [
        "Everything you need to begin",
        "Email support",
        "Basic features included",
        "30-day money-back guarantee"
      ],
      ctaText: "Get Started",
      popular: false
    },
    {
      name: "Professional",
      price: "$199",
      period: "month", 
      description: "Most popular choice",
      features: [
        "All Starter features",
        "Priority support",
        "Advanced features",
        "Custom integrations",
        "Analytics dashboard"
      ],
      ctaText: "Start Free Trial",
      popular: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large organizations",
      features: [
        "All Professional features",
        "Dedicated account manager",
        "Custom development",
        "SLA guarantee",
        "Advanced security"
      ],
      ctaText: "Contact Sales",
      popular: false
    }
  ];

  const params = useParams();
  
  // Use products if available, otherwise fall back to plans
  const displayItems = products.length > 0 ? products : (plans.length > 0 ? plans : defaultPlans);
  
  // Generate product URLs
  const getProductUrl = (item, index) => {
    if (products.length > 0) {
      // For products, create a URL-friendly slug
      const slug = item.id || item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `product-${index}`;
      return `/sites/${params?.subdomain || 'demo'}/product/${slug}`;
    }
    return '#'; // For plans, keep the default behavior
  };

  return (
    <section className="py-20 bg-gray-50" id="pricing">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
            {title}
          </h2>
          <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--text-gray, #6b7280)' }}>
            {subtitle}
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayItems.map((item, index) => (
            <div 
              key={index}
              className={`bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 relative ${
                item.popular ? 'ring-2' : ''
              }`}
              style={{ 
                ringColor: item.popular ? 'var(--primary, #3b82f6)' : 'transparent',
                transform: item.popular ? 'scale(1.05)' : 'scale(1)'
              }}
            >
              {/* Popular Badge */}
              {item.popular && (
                <div 
                  className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-sm font-bold"
                  style={{ background: 'var(--primary, #3b82f6)' }}
                >
                  Most Popular
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-dark, #1f2937)' }}>
                  {item.name}
                </h3>
                <p className="text-gray-600 mb-4">{item.description}</p>
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-bold" style={{ color: 'var(--primary, #3b82f6)' }}>
                    {item.price}
                  </span>
                  {item.period && (
                    <span className="text-gray-600 ml-1">/{item.period}</span>
                  )}
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {item.features?.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center">
                    <svg className="w-5 h-5 mr-3 flex-shrink-0" style={{ color: 'var(--primary, #3b82f6)' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: 'var(--text-gray, #6b7280)' }}>{feature}</span>
                  </li>
                )) || []}
              </ul>

              {/* CTA Button */}
              <a
                href={getProductUrl(item, index)}
                className={`block w-full py-3 px-6 rounded-lg font-semibold transition-all hover:scale-105 text-center ${
                  item.popular 
                    ? 'text-white shadow-lg' 
                    : 'border-2 hover:text-white'
                }`}
                style={{
                  background: item.popular ? 'var(--primary, #3b82f6)' : 'transparent',
                  borderColor: 'var(--primary, #3b82f6)',
                  color: item.popular ? 'white' : 'var(--primary, #3b82f6)',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!item.popular) {
                    e.target.style.background = 'var(--primary, #3b82f6)';
                    e.target.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!item.popular) {
                    e.target.style.background = 'transparent';
                    e.target.style.color = 'var(--primary, #3b82f6)';
                  }
                }}
              >
                {item.ctaText || (products.length > 0 ? 'View Details' : 'Get Started')}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
