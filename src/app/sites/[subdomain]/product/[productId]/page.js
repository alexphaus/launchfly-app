// src/app/sites/[subdomain]/product/[productId]/page.js
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const [businessData, setBusiness] = useState(null);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: ''
  });

  const supabase = createClientComponentClient();

  useEffect(() => {
    loadBusinessAndProduct();
  }, []);

  async function loadBusinessAndProduct() {
    try {
      const subdomain = await params.subdomain;
      const productId = await params.productId;

      // Get business data
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('subdomain', subdomain)
        .eq('status', 'ready')
        .single();

      if (businessError || !business) {
        console.error('Business not found:', businessError);
        setLoading(false);
        return;
      }

      setBusiness(business);

      // Find the product in the business data
      const businessContent = business.business_data;
      let foundProduct = null;

      // Look for products in different places in the business data
      if (businessContent?.products && Array.isArray(businessContent.products)) {
        foundProduct = businessContent.products.find(p => p.id === productId || p.name === productId);
      }

      // Also check in pricing/plans
      if (!foundProduct && businessContent?.layout) {
        for (const section of businessContent.layout) {
          if (section.component === 'PricingTable' && section.props?.plans) {
            foundProduct = section.props.plans.find(p => 
              p.id === productId || 
              p.name === productId || 
              p.name.toLowerCase().replace(/\s+/g, '-') === productId
            );
            if (foundProduct) break;
          }
        }
      }

      setProduct(foundProduct);
      setLoading(false);
    } catch (error) {
      console.error('Error loading product:', error);
      setLoading(false);
    }
  }

  async function handlePurchase() {
    if (!customerInfo.name || !customerInfo.email) {
      alert('Please fill in your name and email address');
      return;
    }

    setPurchaseLoading(true);

    try {
      const subdomain = await params.subdomain;
      
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product.id || product.name,
          productName: product.name,
          productPrice: parseFloat(product.price.replace(/[^0-9.-]+/g, '')), // Extract number from price string
          productDescription: product.description,
          businessId: businessData.id,
          subdomain: subdomain,
          customerEmail: customerInfo.email,
          customerName: customerInfo.name,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Something went wrong. Please try again.');
      setPurchaseLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!businessData || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
          <p className="text-gray-600 mb-4">The product you're looking for doesn't exist.</p>
          <button
            onClick={() => router.back()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const theme = businessData.business_data?.theme || {};

  return (
    <div 
      className="min-h-screen bg-gray-50"
      style={{
        '--primary': theme.colors?.primary || '#3b82f6',
        '--secondary': theme.colors?.secondary || '#1e40af',
        '--text-dark': theme.colors?.textDark || '#1f2937',
        '--text-gray': theme.colors?.textGray || '#6b7280',
      }}
    >
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to {businessData.name}
            </button>
          </div>
        </div>
      </header>

      {/* Product Details */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Product Image/Icon */}
          <div className="bg-white rounded-2xl p-12 shadow-lg flex items-center justify-center">
            <div className="text-center">
              <div className="text-8xl mb-6">
                {product.icon || '📦'}
              </div>
              <div className="space-y-2">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {businessData.name}
                </div>
              </div>
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-dark)' }}>
                {product.name}
              </h1>
              <p className="text-xl mb-6" style={{ color: 'var(--text-gray)' }}>
                {product.description}
              </p>
              <div className="flex items-baseline mb-8">
                <span className="text-5xl font-bold" style={{ color: 'var(--primary)' }}>
                  {product.price}
                </span>
                {product.period && (
                  <span className="text-xl ml-2" style={{ color: 'var(--text-gray)' }}>
                    /{product.period}
                  </span>
                )}
              </div>
            </div>

            {/* Features */}
            {product.features && (
              <div>
                <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--text-dark)' }}>
                  What's Included:
                </h3>
                <ul className="space-y-3">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <svg 
                        className="w-5 h-5 mr-3 flex-shrink-0" 
                        style={{ color: 'var(--primary)' }} 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: 'var(--text-gray)' }}>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Customer Info Form */}
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-dark)' }}>
                Your Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-gray)' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-gray)' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your email address"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Purchase Button */}
            <button
              onClick={handlePurchase}
              disabled={purchaseLoading}
              className="w-full py-4 px-8 rounded-xl font-bold text-lg text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                background: purchaseLoading ? '#94a3b8' : 'var(--primary)',
                transform: purchaseLoading ? 'none' : 'hover:scale-105'
              }}
            >
              {purchaseLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                `Buy Now - ${product.price}`
              )}
            </button>

            {/* Security Notice */}
            <div className="flex items-center justify-center text-sm text-gray-500">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 0h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Secure payment powered by Stripe
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
