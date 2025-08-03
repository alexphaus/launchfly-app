'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import EnhancedProductPage from '@/components/EnhancedProductPage';
import { CartProvider } from '@/components/launchfly-ui';

export default function ProductPage() {
  const params = useParams();
  const [businessData, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClientComponentClient();

  useEffect(() => {
    loadBusiness();
  }, []);

  async function loadBusiness() {
    try {
      const subdomain = await params.subdomain;

      // Get business data to check if it's e-commerce
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
      setLoading(false);
    } catch (error) {
      console.error('Error loading business:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if this is an e-commerce business
  const isEcommerce = businessData?.business_data?.businessModel === 'ecommerce' || 
                     businessData?.businessModel === 'ecommerce';

  // Use enhanced product page for e-commerce, otherwise use the original simple version
  if (isEcommerce) {
    return (
      <CartProvider>
        <EnhancedProductPage />
      </CartProvider>
    );
  }

  // Original simple product page for service businesses
  return <OriginalProductPage />;
}

// Original product page component for service-based businesses
function OriginalProductPage() {
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
          customerName: customerInfo.name
        })
      });

      const result = await response.json();

      if (result.url) {
        // Redirect to Stripe checkout
        window.location.href = result.url;
      } else {
        alert('Failed to initiate checkout. Please try again.');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setPurchaseLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📦</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h1>
          <p className="text-gray-600 mb-6">The product you're looking for doesn't exist.</p>
          <button
            onClick={() => router.back()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to site
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
        </div>
      </div>

      {/* Product Details */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-8">
            {/* Price */}
            <div className="text-center mb-8">
              <div className="text-5xl font-bold text-blue-600 mb-2">{product.price}</div>
              <p className="text-xl text-gray-600">{product.description}</p>
            </div>

            {/* Features */}
            {product.features && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">What's Included:</h3>
                <ul className="space-y-3">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Customer Info Form */}
            <div className="border-t pt-8">
              <h3 className="text-lg font-semibold mb-4">Your Information:</h3>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              {/* Purchase Button */}
              <button
                onClick={handlePurchase}
                disabled={purchaseLoading}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {purchaseLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  `Purchase ${product.name} - ${product.price}`
                )}
              </button>

              {/* Trust Signals */}
              <div className="flex justify-center items-center mt-6 text-sm text-gray-600">
                <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Secure payment powered by Stripe
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
