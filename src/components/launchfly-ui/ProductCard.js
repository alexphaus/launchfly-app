'use client';

import { useState } from 'react';

export default function ProductCard({ 
  product,
  businessId,
  businessSubdomain,
  className = ""
}) {
  const [loading, setLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ email: '', name: '' });
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);

  const handleBuyNow = () => {
    setShowCheckoutForm(true);
  };

  const handleCheckout = async () => {
    if (!customerInfo.email) {
      alert('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          businessId: businessId || null, // Handle null/undefined businessId
          customerEmail: customerInfo.email,
          customerName: customerInfo.name,
          subdomain: businessSubdomain
        })
      });

      const data = await response.json();

      if (response.ok && data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  return (
    <div className={`bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden ${className}`}>
      {/* Product Image */}
      {product.image && (
        <div className="aspect-video w-full overflow-hidden">
          <img 
            src={product.image} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      {/* Product Content */}
      <div className="p-6">
        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-dark, #1f2937)' }}>
          {product.name}
        </h3>
        
        <p className="text-gray-600 mb-4 line-clamp-3">
          {product.description}
        </p>
        
        {/* Price */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-2xl font-bold" style={{ color: 'var(--primary, #3b82f6)' }}>
            {product.price}
          </div>
          {product.originalPrice && (
            <div className="text-gray-500 line-through">
              {product.originalPrice}
            </div>
          )}
        </div>

        {/* Features/Benefits */}
        {product.features && product.features.length > 0 && (
          <ul className="space-y-1 mb-4 text-sm">
            {product.features.slice(0, 3).map((feature, index) => (
              <li key={index} className="flex items-center text-gray-600">
                <svg className="w-4 h-4 mr-2 flex-shrink-0" style={{ color: 'var(--primary, #3b82f6)' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        )}

        {/* Purchase Form or Button */}
        {showCheckoutForm ? (
          <div className="space-y-3">
            <input
              type="email"
              placeholder="Your email address"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={customerInfo.email}
              onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
            />
            <input
              type="text"
              placeholder="Your name (optional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={customerInfo.name}
              onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="flex-1 py-3 px-6 rounded-lg font-semibold transition-all text-white shadow-lg disabled:opacity-50"
                style={{ background: 'var(--primary, #3b82f6)' }}
              >
                {loading ? 'Processing...' : 'Buy Now'}
              </button>
              <button
                onClick={() => setShowCheckoutForm(false)}
                className="px-4 py-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleBuyNow}
            disabled={loading}
            className="w-full py-3 px-6 rounded-lg font-semibold transition-all hover:scale-105 text-white shadow-lg disabled:opacity-50"
            style={{ background: 'var(--primary, #3b82f6)' }}
          >
            Buy Now
          </button>
        )}
      </div>
    </div>
  );
}
