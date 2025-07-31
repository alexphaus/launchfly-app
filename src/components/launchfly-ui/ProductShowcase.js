'use client';

import { useState } from 'react';

export default function ProductShowcase({ 
  title = "Our Products",
  subtitle = "Choose the perfect solution for your needs",
  products = [],
  businessId,
  businessSubdomain
}) {
  const [loading, setLoading] = useState(null);

  const defaultProducts = [
    {
      name: "Starter Package",
      price: "$99",
      description: "Perfect for individuals and small teams getting started",
      features: [
        "Core features included",
        "Email support",
        "30-day money back guarantee"
      ]
    },
    {
      name: "Professional",
      price: "$299",
      description: "Everything you need to scale your business",
      features: [
        "All Starter features",
        "Priority support",
        "Advanced analytics",
        "Custom integrations"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      price: "$599",
      description: "For large organizations with custom needs",
      features: [
        "All Professional features",
        "Dedicated account manager",
        "Custom development",
        "SLA guarantee"
      ]
    }
  ];

  const displayProducts = products.length > 0 ? products : defaultProducts;

  const handlePurchase = async (product, index) => {
    setLoading(index);
    
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product.id || `product_${index}`,
          businessId: businessId,
          productName: product.name,
          price: product.price,
          businessSubdomain: businessSubdomain
        }),
      });

      const data = await response.json();
      
      if (data.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkoutUrl;
      } else {
        console.error('No checkout URL received');
        alert('Sorry, there was an error processing your request. Please try again.');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Sorry, there was an error processing your request. Please try again.');
    } finally {
      setLoading(null);
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
              key={index}
              className={`bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 relative ${
                product.popular ? 'ring-2' : ''
              }`}
              style={{ 
                ringColor: product.popular ? 'var(--primary, #3b82f6)' : 'transparent',
                transform: product.popular ? 'scale(1.05)' : 'scale(1)'
              }}
            >
              {/* Popular Badge */}
              {product.popular && (
                <div 
                  className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-sm font-bold"
                  style={{ background: 'var(--primary, #3b82f6)' }}
                >
                  Most Popular
                </div>
              )}

              {/* Product Header */}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-dark, #1f2937)' }}>
                  {product.name}
                </h3>
                <div className="text-4xl font-bold mb-4" style={{ color: 'var(--primary, #3b82f6)' }}>
                  {product.price}
                </div>
                <p className="text-gray-600">{product.description}</p>
              </div>

              {/* Features */}
              {product.features && (
                <ul className="space-y-3 mb-8">
                  {product.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <svg className="w-5 h-5 mr-3 flex-shrink-0" style={{ color: 'var(--primary, #3b82f6)' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: 'var(--text-gray, #6b7280)' }}>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Buy Button */}
              <button
                onClick={() => handlePurchase(product, index)}
                disabled={loading === index}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-all hover:scale-105 ${
                  product.popular 
                    ? 'text-white shadow-lg' 
                    : 'border-2 hover:text-white'
                } ${loading === index ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{
                  background: product.popular ? 'var(--primary, #3b82f6)' : 'transparent',
                  borderColor: 'var(--primary, #3b82f6)',
                  color: product.popular ? 'white' : 'var(--primary, #3b82f6)'
                }}
                onMouseEnter={(e) => {
                  if (!product.popular && loading !== index) {
                    e.target.style.background = 'var(--primary, #3b82f6)';
                    e.target.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!product.popular && loading !== index) {
                    e.target.style.background = 'transparent';
                    e.target.style.color = 'var(--primary, #3b82f6)';
                  }
                }}
              >
                {loading === index ? 'Processing...' : 'Buy Now'}
              </button>
            </div>
          ))}
        </div>

        {/* Trust Indicators */}
        <div className="mt-16 text-center">
          <div className="flex justify-center items-center gap-8 flex-wrap">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-600">Secure Checkout</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-600">Money Back Guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              <span className="text-gray-600">24/7 Support</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}