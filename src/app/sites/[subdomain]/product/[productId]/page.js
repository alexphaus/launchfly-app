'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Image from 'next/image';

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const [business, setBusiness] = useState(null);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    loadProductData();
  }, []);

  async function loadProductData() {
    try {
      const { data: businessData, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('subdomain', params.subdomain)
        .eq('status', 'ready')
        .single();

      if (error) throw error;

      setBusiness(businessData);
      
      // Find the specific product
      const products = businessData.business_data?.products || [];
      console.log('Available products:', products);
      console.log('Looking for productId:', params.productId);
      
      // Try to find by ID first
      let productData = products.find(p => p.id === params.productId);
      
      // If not found by ID, try by slug (name converted to URL-friendly format)
      if (!productData) {
        productData = products.find(p => 
          p.name.toLowerCase().replace(/\s+/g, '-') === params.productId
        );
      }
      
      // If still not found, try by index
      if (!productData) {
        const productIndex = parseInt(params.productId);
        if (!isNaN(productIndex) && products[productIndex]) {
          productData = products[productIndex];
        }
      }
      
      if (productData) {
        console.log('Found product:', productData);
        setProduct(productData);
      } else {
        console.error('Product not found:', params.productId);
        // Could show error message to user
      }
      
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePurchase() {
    if (!product || !business) return;
    
    setPurchasing(true);
    
    try {
      // Track the purchase attempt with analytics (if available)
      if (window.gtag) {
        window.gtag('event', 'begin_checkout', {
          currency: 'USD',
          value: parseFloat(product.price.replace(/[$,]/g, '')),
          items: [{
            item_id: product.id,
            item_name: product.name,
            price: parseFloat(product.price.replace(/[$,]/g, ''))
          }]
        });
      }
      
      // Create Stripe checkout session
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          productId: product.id,
          subdomain: params.subdomain,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error creating checkout session');
      }

      const { url, error } = await response.json();
      
      if (error) {
        throw new Error(error);
      }
      
      // Redirect to Stripe Checkout
      window.location.href = url;
      
    } catch (error) {
      console.error('Purchase error:', error);
      
      // Show user-friendly error message
      const errorMessage = document.createElement('div');
      errorMessage.className = 'fixed top-0 left-0 w-full p-4 bg-red-500 text-white text-center';
      errorMessage.textContent = 'Unable to process your payment. Please try again.';
      document.body.appendChild(errorMessage);
      
      setTimeout(() => {
        errorMessage.remove();
      }, 5000);
      
      setPurchasing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!product || !business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Product Not Found</h1>
          <p className="text-gray-600 mb-4">The product you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push(`/sites/${params.subdomain}`)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Website
          </button>
        </div>
      </div>
    );
  }

  const theme = business.business_data?.theme || {};
  const primaryColor = theme.colors?.primary || '#3b82f6';
  
  // Generate product images (placeholder for now)
  const productImages = product.images || [
    `https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=400&fit=crop`,
    `https://images.unsplash.com/photo-1556742111-a301076d9d18?w=600&h=400&fit=crop`,
    `https://images.unsplash.com/photo-1556742212-5b321f3c261b?w=600&h=400&fit=crop`
  ];

  return (
    <div className="min-h-screen bg-gray-50" style={{ '--primary': primaryColor }}>
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              onClick={() => router.push(`/sites/${params.subdomain}`)}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to {business.name}
            </button>
            <h1 className="text-lg font-semibold" style={{ color: primaryColor }}>
              {business.name}
            </h1>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="aspect-w-1 aspect-h-1 bg-white rounded-lg overflow-hidden shadow-lg">
              <Image
                src={productImages[selectedImage]}
                alt={product.name}
                width={600}
                height={400}
                className="w-full h-96 object-cover"
                priority
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              {productImages.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`aspect-w-1 aspect-h-1 bg-white rounded-lg overflow-hidden shadow-md transition-all ${
                    selectedImage === index ? 'ring-2 ring-blue-600' : 'hover:shadow-lg'
                  }`}
                >
                  <Image
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    width={200}
                    height={200}
                    className="w-full h-24 object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>
              <div className="flex items-center mb-6">
                <span className="text-4xl font-bold" style={{ color: primaryColor }}>
                  {product.price}
                </span>
                {product.originalPrice && (
                  <span className="text-xl text-gray-500 line-through ml-3">
                    {product.originalPrice}
                  </span>
                )}
              </div>
            </div>

            <div className="prose prose-lg max-w-none">
              <p className="text-gray-700 text-lg leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Features/Benefits */}
            {product.features && (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">What's Included:</h3>
                <ul className="space-y-2">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="w-5 h-5 mt-0.5 mr-3 flex-shrink-0" style={{ color: primaryColor }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Purchase Section */}
            <div className="bg-white p-6 rounded-lg shadow-lg border">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                  Total: {product.price}
                </span>
                <span className="text-sm text-gray-500">Secure Payment</span>
              </div>
              
              <button
                onClick={handlePurchase}
                disabled={purchasing}
                className="w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transform hover:-translate-y-0.5"
                style={{ 
                  backgroundColor: primaryColor,
                  color: 'white'
                }}
              >
                {purchasing ? (
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
              
              <div className="flex items-center justify-center mt-4 text-sm text-gray-500">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Secured by Stripe • 30-day money-back guarantee
              </div>
            </div>

            {/* Trust Signals */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t">
              <div className="text-center">
                <div className="text-2xl mb-2">🔒</div>
                <div className="text-sm font-medium text-gray-900">Secure Payment</div>
                <div className="text-xs text-gray-500">256-bit SSL</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">⚡</div>
                <div className="text-sm font-medium text-gray-900">Instant Access</div>
                <div className="text-xs text-gray-500">Immediate delivery</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">💯</div>
                <div className="text-sm font-medium text-gray-900">Satisfaction</div>
                <div className="text-xs text-gray-500">30-day guarantee</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
