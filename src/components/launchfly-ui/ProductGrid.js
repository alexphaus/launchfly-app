'use client';

import ProductCard from './ProductCard';

export default function ProductGrid({ 
  title = "Our Products",
  subtitle = "Choose the perfect solution for your needs",
  products = []
}) {
  const defaultProducts = [
    {
      id: 'starter-package',
      name: 'Starter Package',
      price: '$99',
      period: 'one-time',
      description: 'Perfect for getting started',
      icon: '🚀',
      features: [
        'Basic setup included',
        'Email support',
        '30-day guarantee'
      ],
      ctaText: 'Get Started'
    },
    {
      id: 'premium-package',
      name: 'Premium Package',
      price: '$199',
      period: 'one-time',
      description: 'Most popular choice',
      icon: '⭐',
      features: [
        'Everything in Starter',
        'Priority support',
        'Advanced features',
        'Custom setup'
      ],
      ctaText: 'Go Premium',
      popular: true
    },
    {
      id: 'enterprise-package',
      name: 'Enterprise Package',
      price: '$499',
      period: 'one-time',
      description: 'For serious businesses',
      icon: '💎',
      features: [
        'Everything in Premium',
        'Dedicated support',
        'Custom development',
        'SLA guarantee'
      ],
      ctaText: 'Contact Sales'
    }
  ];

  const displayProducts = products.length > 0 ? products : defaultProducts;

  if (displayProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-20 bg-gray-50" id="products">
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

        {/* Products Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayProducts.map((product, index) => (
            <ProductCard
              key={product.id || index}
              product={product}
              featured={product.popular}
            />
          ))}
        </div>

        {/* Trust Signals */}
        <div className="mt-16 pt-12 border-t border-gray-200">
          <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-500">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Secure Payment
            </div>
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              24/7 Support
            </div>
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Money Back Guarantee
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
