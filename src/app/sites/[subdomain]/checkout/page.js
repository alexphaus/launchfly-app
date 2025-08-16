// src/app/sites/[subdomain]/checkout/page.js
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function CheckoutPage() {
  const params = useParams();
  const { cart, getCartTotal, clearCart } = useCart();
  const [businessData, setBusinessData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    address: '',
    city: '',
    zip: '',
    country: ''
  });

  const supabase = createClientComponentClient();

  useEffect(() => {
    loadBusinessData();
  }, []);

  async function loadBusinessData() {
    try {
      const subdomain = await params.subdomain;
      
      const { data: business, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('subdomain', subdomain)
        .eq('status', 'ready')
        .single();

      if (business && !error) {
        setBusinessData(business);
      }
    } catch (error) {
      console.error('Error loading business data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout() {
    if (!customerInfo.name || !customerInfo.email) {
      alert('Please fill in your name and email address');
      return;
    }

    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }

    setProcessingPayment(true);

    try {
      const subdomain = await params.subdomain;
      
      // For multi-item checkout, we'll need to create a combined checkout session
      const response = await fetch('/api/stripe/checkout-multiple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: cart.map(item => ({
            productId: item.id,
            productName: item.name,
            productPrice: parseFloat(item.price.replace(/[^0-9.-]+/g, '')),
            quantity: item.quantity,
            productDescription: item.description
          })),
          businessId: businessData.id,
          subdomain: subdomain,
          customerEmail: customerInfo.email,
          customerName: customerInfo.name,
          customerAddress: {
            address: customerInfo.address,
            city: customerInfo.city,
            zip: customerInfo.zip,
            country: customerInfo.country
          }
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Something went wrong. Please try again.');
      setProcessingPayment(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 mb-4 mt-4">Your cart is empty</h1>
          <p className="text-gray-600 mb-4">Add some products to your cart before checking out.</p>
          <button
            onClick={() => window.history.back()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  const theme = businessData?.business_data?.theme || {};

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
          <div className="flex items-center">
            <button
              onClick={() => window.history.back()}
              className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-dark)' }}>
              Checkout
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Customer Information */}
          <div>
            <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-dark)' }}>
              Shipping Information
            </h2>
            
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-gray)' }}>
                    Address
                  </label>
                  <input
                    type="text"
                    value={customerInfo.address}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Street address"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-gray)' }}>
                      City
                    </label>
                    <input
                      type="text"
                      value={customerInfo.city}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-gray)' }}>
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={customerInfo.zip}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, zip: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="ZIP code"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-gray)' }}>
                    Country
                  </label>
                  <select
                    value={customerInfo.country}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Country</option>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="UK">United Kingdom</option>
                    <option value="AU">Australia</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                    <option value="IT">Italy</option>
                    <option value="ES">Spain</option>
                    <option value="NL">Netherlands</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div>
            <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-dark)' }}>
              Order Summary
            </h2>
            
            <div className="bg-white rounded-xl p-6 shadow-lg">
              {/* Cart Items */}
              <div className="space-y-4 mb-6">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4 py-4 border-b border-gray-100">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">{item.image || item.icon || '📦'}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{item.price}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-2 border-t border-gray-200 pt-4">
                <div className="flex justify-between text-base">
                  <span>Subtotal</span>
                  <span>${getCartTotal()}</span>
                </div>
                <div className="flex justify-between text-base">
                  <span>Shipping</span>
                  <span>Calculated at checkout</span>
                </div>
                <div className="flex justify-between text-base">
                  <span>Taxes</span>
                  <span>Calculated at checkout</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                  <span>Total</span>
                  <span>${getCartTotal()}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={processingPayment}
                className="w-full mt-6 py-4 px-8 rounded-xl font-bold text-lg text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  background: processingPayment ? '#94a3b8' : 'var(--primary)',
                  transform: processingPayment ? 'none' : 'hover:scale-105'
                }}
              >
                {processingPayment ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  `Complete Purchase - $${getCartTotal()}`
                )}
              </button>

              {/* Security Notice */}
              <div className="flex items-center justify-center text-sm text-gray-500 mt-4">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 0h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure payment powered by Stripe
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
