'use client';

import { useState } from 'react';

export default function ProductShowcase({ 
  title = "Our Products",
  subtitle = "Choose the perfect solution for your needs",
  products = [],
  subdomain
}) {
  const [loading, setLoading] = useState(false);

  const defaultProducts = [
    {
      id: "starter-package",
      name: "Starter Package",
      price: 99,
      description: "Perfect for getting started with your business growth",
      features: [
        "Initial consultation",
        "Basic setup and configuration",
        "Email support",
        "30-day money-back guarantee"
      ],
      popular: false
    },
    {
      id: "professional-package", 
      name: "Professional Package",
      price: 299,
      description: "Complete solution for serious business growth",
      features: [
        "Everything in Starter",
        "Advanced features and customization",
        "Priority support",
        "Monthly strategy sessions",
        "Performance analytics"
      ],
      popular: true
    },
    {
      id: "enterprise-package",
      name: "Enterprise Package", 
      price: 599,
      description: "Full-scale solution for large organizations",
      features: [
        "Everything in Professional",
        "Dedicated account manager",
        "Custom integrations",
        "24/7 phone support",
        "Quarterly business reviews"
      ],
      popular: false
    }
  ];

  const displayProducts = products.length > 0 ? products : defaultProducts;

  const handlePurchase = async (productId) => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          quantity: 1,
          subdomain
        }),
      });

      const { sessionId, error } = await response.json();
      
      if (error) {
        alert('Error creating checkout session: ' + error);
        return;
      }

      // Redirect to Stripe Checkout
      if (typeof window !== 'undefined' && window.stripe) {
        const { error: stripeError } = await window.stripe.redirectToCheckout({
          sessionId: sessionId,
        });

        if (stripeError) {
          alert('Stripe error: ' + stripeError.message);
        }
      } else {
        // Fallback: redirect manually to Stripe checkout
        window.location.href = `https://checkout.stripe.com/pay/${sessionId}`;
      }
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
            <div 
              key={product.id || index}
              className={`bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 relative ${
                product.popular ? 'ring-2 ring-opacity-50' : ''
              }`}
              style={{ 
                borderTop: `4px solid var(--primary, #3b82f6)`,
                ringColor: product.popular ? 'var(--primary, #3b82f6)' : 'transparent'
              }}
            >
              {product.popular && (
                <div 
                  className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-4 py-1 rounded-full text-white text-sm font-semibold"
                  style={{ backgroundColor: 'var(--primary, #3b82f6)' }}
                >
                  Most Popular
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-dark, #1f2937)' }}>
                  {product.name}
                </h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold" style={{ color: 'var(--primary, #3b82f6)' }}>
                    ${product.price}
                  </span>
                  <span className="text-gray-500 ml-1">one-time</span>
                </div>
                <p className="text-gray-600">{product.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {product.features?.map((feature, i) => (
                  <li key={i} className="flex items-center">
                    <svg className="w-5 h-5 mr-3 flex-shrink-0" style={{ color: 'var(--primary, #3b82f6)' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handlePurchase(product.id)}
                disabled={loading}
                className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-all duration-200 ${
                  product.popular 
                    ? 'text-white shadow-lg hover:shadow-xl hover:scale-105' 
                    : 'border-2 hover:text-white hover:shadow-lg'
                }`}
                style={{
                  background: product.popular ? 'var(--primary, #3b82f6)' : 'transparent',
                  borderColor: 'var(--primary, #3b82f6)',
                  color: product.popular ? 'white' : 'var(--primary, #3b82f6)'
                }}
                onMouseEnter={(e) => {
                  if (!product.popular) {
                    e.target.style.background = 'var(--primary, #3b82f6)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!product.popular) {
                    e.target.style.background = 'transparent';
                  }
                }}
              >
                {loading ? 'Loading...' : 'Buy Now'}
              </button>
            </div>
          ))}
        </div>

        {/* Trust Indicators */}
        <div className="text-center mt-12">
          <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-500">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              30-day money-back guarantee
            </div>
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
              </svg>
              Secure payment with Stripe
            </div>
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              24/7 customer support
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
